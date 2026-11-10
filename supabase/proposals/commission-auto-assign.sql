-- Apply as one transaction. No existing commercial row is changed.
-- Preserve historical duplicate pairs; prohibit adding another row to any occupied pair.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.precios_personalizados IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA pth_commission_private;
REVOKE ALL ON SCHEMA pth_commission_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE pth_commission_private.price_pairs (
  gestor text NOT NULL,
  producto_id uuid NOT NULL,
  row_count bigint NOT NULL CHECK (row_count >= 0),
  PRIMARY KEY (gestor, producto_id)
);
CREATE TABLE pth_commission_private.assignment_receipts (
  actor_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  product_ids uuid[] NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, batch_id)
);
ALTER TABLE pth_commission_private.price_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pth_commission_private.assignment_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA pth_commission_private FROM PUBLIC, anon, authenticated, service_role;
-- Abort rather than silently omit unexpected null-key historical rows.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.precios_personalizados WHERE gestor IS NULL OR producto_id IS NULL) THEN
    RAISE EXCEPTION 'Hay claves de precios incompletas; revisar antes de instalar.';
  END IF;
END $$;
INSERT INTO pth_commission_private.price_pairs (gestor, producto_id, row_count)
SELECT gestor, producto_id, count(*) FROM public.precios_personalizados GROUP BY gestor, producto_id;

CREATE FUNCTION pth_commission_private.guard_price_pair()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE claimed bigint;
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    UPDATE pth_commission_private.price_pairs SET row_count = 0;
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.gestor IS NOT DISTINCT FROM OLD.gestor AND NEW.producto_id IS NOT DISTINCT FROM OLD.producto_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP <> 'DELETE' AND (NEW.gestor IS NULL OR NEW.producto_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='23502', MESSAGE='Gestor y producto son obligatorios.';
  END IF;
  IF TG_OP IN ('DELETE','UPDATE') THEN
    UPDATE pth_commission_private.price_pairs SET row_count = row_count - 1
      WHERE gestor = OLD.gestor AND producto_id = OLD.producto_id AND row_count > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'Registro técnico de precios inconsistente.'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    INSERT INTO pth_commission_private.price_pairs (gestor, producto_id, row_count)
    VALUES (NEW.gestor, NEW.producto_id, 1)
    ON CONFLICT (gestor, producto_id) DO UPDATE SET row_count = 1
      WHERE pth_commission_private.price_pairs.row_count = 0
    RETURNING row_count INTO claimed;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='El producto ya tiene una configuración para este gestor. Actualiza la página antes de guardar.';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION pth_commission_private.guard_price_pair() FROM PUBLIC, anon, authenticated, service_role;
-- AFTER avoids phantom reservations from INSERT ... ON CONFLICT DO NOTHING.
-- Violations still roll back the whole commercial statement and registry changes.
CREATE TRIGGER pth_price_pair_guard AFTER INSERT OR UPDATE OR DELETE ON public.precios_personalizados
FOR EACH ROW EXECUTE FUNCTION pth_commission_private.guard_price_pair();
CREATE TRIGGER pth_price_pair_truncate AFTER TRUNCATE ON public.precios_personalizados
FOR EACH STATEMENT EXECUTE FUNCTION pth_commission_private.guard_price_pair();

-- Only the authenticated Edge gateway's service role may call this function.
-- It must pass the actor ID obtained from its validated session, never browser input.
CREATE FUNCTION public.pth_assign_half_commissions(p_gestor_id uuid, p_batch_id uuid, p_product_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor public.gestores%ROWTYPE;
  product public.productos%ROWTYPE;
  ids uuid[];
  item uuid;
  receipt pth_commission_private.assignment_receipts%ROWTYPE;
  occupied bigint;
  added integer := 0;
  existing integer := 0;
  unavailable integer := 0;
  output jsonb;
BEGIN
  IF p_gestor_id IS NULL OR p_batch_id IS NULL OR p_product_ids IS NULL
     OR cardinality(p_product_ids) < 1 OR cardinality(p_product_ids) > 100
     OR array_position(p_product_ids, NULL) IS NOT NULL
     OR p_batch_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Lote no válido: se requieren de 1 a 100 productos.';
  END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO ids FROM unnest(p_product_ids) AS id;
  IF cardinality(ids) <> cardinality(p_product_ids) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='El lote contiene productos repetidos.';
  END IF;
  SELECT * INTO actor FROM public.gestores WHERE id=p_gestor_id FOR SHARE;
  IF NOT FOUND OR actor.estado IS DISTINCT FROM 'activo' OR actor.activo IS FALSE
     OR actor.parent_id IS NOT NULL OR actor.rol IS DISTINCT FROM 'gestor' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Solo un gestor principal activo puede asignar estas comisiones.';
  END IF;
  INSERT INTO pth_commission_private.assignment_receipts(actor_id,batch_id,product_ids)
    VALUES(p_gestor_id,p_batch_id,ids) ON CONFLICT(actor_id,batch_id) DO NOTHING;
  SELECT * INTO receipt FROM pth_commission_private.assignment_receipts
    WHERE actor_id=p_gestor_id AND batch_id=p_batch_id FOR UPDATE;
  IF receipt.product_ids IS DISTINCT FROM ids THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='El identificador del lote ya corresponde a otros productos.';
  END IF;
  IF receipt.result IS NOT NULL THEN RETURN receipt.result; END IF;
  FOREACH item IN ARRAY ids LOOP
    -- Stable order avoids opposing product/pair acquisition across simultaneous batches.
    SELECT * INTO product FROM public.productos WHERE id=item FOR SHARE;
    IF NOT FOUND OR product.disponible IS DISTINCT FROM 'SI' THEN
      unavailable := unavailable + 1; CONTINUE;
    END IF;
    INSERT INTO pth_commission_private.price_pairs(gestor,producto_id,row_count)
      VALUES(actor.nombre,item,0) ON CONFLICT(gestor,producto_id) DO NOTHING;
    SELECT row_count INTO occupied FROM pth_commission_private.price_pairs
      WHERE gestor=actor.nombre AND producto_id=item FOR UPDATE;
    IF occupied > 0 THEN
      existing := existing + 1;
      CONTINUE;
    END IF;
    IF product.comision IS NULL OR product.comision < 0 OR product.comision::text IN ('NaN','Infinity','-Infinity')
       OR product.precio IS NULL OR product.precio < 0 OR product.precio::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Hay un producto sin precio o comisión base válida. No se aplicó este lote.';
    END IF;
    INSERT INTO public.precios_personalizados(gestor,producto_id,nuevo_precio,comision_subgestor,visible_subgestor)
      VALUES(actor.nombre,item,product.precio,floor(product.comision / 2),true);
    added := added + 1;
  END LOOP;
  output := jsonb_build_object('batchId',p_batch_id,'requested',cardinality(ids),'inserted',added,
    'skippedExisting',existing,'skippedUnavailable',unavailable);
  UPDATE pth_commission_private.assignment_receipts SET result=output WHERE actor_id=p_gestor_id AND batch_id=p_batch_id;
  RETURN output;
END $$;
REVOKE ALL ON FUNCTION public.pth_assign_half_commissions(uuid,uuid,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pth_assign_half_commissions(uuid,uuid,uuid[]) TO service_role;
COMMIT;
