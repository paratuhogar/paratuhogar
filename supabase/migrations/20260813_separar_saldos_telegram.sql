create or replace function public.notify_telegram_on_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net, vault, pg_temp
as $function$
declare
  bot_token text;
  chat_id text;
  mensaje text;
  comision_mia_actual numeric := 0;
  tarifa_sistema_actual numeric := 0;
  total_mis_ventas numeric := 0;
  total_sistema numeric := 0;
  gran_total numeric := 0;
  r record;
  precio_unit_temp numeric;
  qty_temp int;
  gestor_limpio text;
begin
  if new.estado = 'Entregado' and (old.estado is null or old.estado != 'Entregado') then
    -- Serializa entregas simultáneas para que cada mensaje lea el último
    -- saldo confirmado y no publique totales parciales.
    perform pg_advisory_xact_lock(hashtext('pth_telegram_financial_totals'));

    select
      max(decrypted_secret) filter (where name = 'telegram_bot_token'),
      max(decrypted_secret) filter (where name = 'telegram_chat_id')
      into bot_token, chat_id
      from vault.decrypted_secrets
     where name in ('telegram_bot_token', 'telegram_chat_id');

    if bot_token is null or chat_id is null then
      raise warning 'Faltan telegram_bot_token o telegram_chat_id en Supabase Vault';
      return new;
    end if;

    gestor_limpio := lower(trim(coalesce(new.gestor, '')));

    qty_temp := 1;
    if new.producto ~* '^\s*(\d+)[xX]' then
      qty_temp := (regexp_match(new.producto, '^\s*(\d+)[xX]', 'i'))[1]::int;
    end if;
    if qty_temp <= 0 or qty_temp is null then qty_temp := 1; end if;

    precio_unit_temp := (coalesce(new.total, 0) - coalesce(new.costo_mensajeria, 0)) / qty_temp;
    if precio_unit_temp <= 60 then tarifa_sistema_actual := 0.50 * qty_temp;
    elsif precio_unit_temp <= 150 then tarifa_sistema_actual := 1.00 * qty_temp;
    elsif precio_unit_temp <= 399 then tarifa_sistema_actual := 2.00 * qty_temp;
    elsif precio_unit_temp <= 999 then tarifa_sistema_actual := 3.00 * qty_temp;
    else tarifa_sistema_actual := 5.00 * qty_temp;
    end if;

    if gestor_limpio like '%marcel%' then
      comision_mia_actual := coalesce(new.comision_total, 0);
    end if;

    select coalesce(sum(comision_total), 0)
      into total_mis_ventas
      from public.pedidos
     where estado = 'Entregado'
       and lower(trim(gestor)) like '%marcel%'
       and coalesce(lower(trim(pago_gestor)), 'pendiente') != 'pagado';

    total_sistema := 0;
    for r in
      select producto, total, costo_mensajeria
        from public.pedidos
       where estado = 'Entregado'
         and coalesce(lower(trim(pago_sistema)), 'pendiente') != 'pagado'
    loop
      qty_temp := 1;
      if r.producto ~* '^\s*(\d+)[xX]' then
        qty_temp := (regexp_match(r.producto, '^\s*(\d+)[xX]', 'i'))[1]::int;
      end if;
      if qty_temp <= 0 or qty_temp is null then qty_temp := 1; end if;

      precio_unit_temp := (coalesce(r.total, 0) - coalesce(r.costo_mensajeria, 0)) / qty_temp;
      if precio_unit_temp <= 60 then total_sistema := total_sistema + (0.50 * qty_temp);
      elsif precio_unit_temp <= 150 then total_sistema := total_sistema + (1.00 * qty_temp);
      elsif precio_unit_temp <= 399 then total_sistema := total_sistema + (2.00 * qty_temp);
      elsif precio_unit_temp <= 999 then total_sistema := total_sistema + (3.00 * qty_temp);
      else total_sistema := total_sistema + (5.00 * qty_temp);
      end if;
    end loop;

    gran_total := total_mis_ventas + total_sistema;

    if gestor_limpio like '%marcel%' then
      mensaje := '✅ *¡VENTA PROPIA ENTREGADA!* 🤑' || chr(10) || chr(10)
        || '📦 *Equipo:* ' || new.producto || chr(10)
        || '💰 *Comisión:* +$' || comision_mia_actual || ' USD' || chr(10)
        || '⚙️ *Tarifa Sist.:* +$' || tarifa_sistema_actual || ' USD';
    else
      mensaje := '🔔 *INGRESO DEL SISTEMA* 💻' || chr(10) || chr(10)
        || 'El gestor *' || new.gestor || '* entregó un pedido.' || chr(10)
        || '📦 *Equipo:* ' || new.producto || chr(10)
        || '⚙️ *Tu Tarifa:* +$' || tarifa_sistema_actual || ' USD';
    end if;

    mensaje := mensaje || chr(10) || chr(10)
      || '🏦 *BÓVEDA ACTUALIZADA* 🏦' || chr(10)
      || '⚙️ Deuda del sistema: *$' || total_sistema || ' USD*' || chr(10)
      || '💰 Comisiones pendientes de Marcel: *$' || total_mis_ventas || ' USD*' || chr(10)
      || '🧾 Total combinado: *$' || gran_total || ' USD*';

    perform net.http_post(
      url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('chat_id', chat_id, 'text', mensaje, 'parse_mode', 'Markdown')
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trigger_notify_delivery on public.pedidos;
create trigger trigger_notify_delivery
after update on public.pedidos
for each row execute function public.notify_telegram_on_delivery();
