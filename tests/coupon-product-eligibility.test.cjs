// Disposable native PostgreSQL, real coupon/numbering/points functions. Included in release regression tests; no Docker or production access.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {startCouponsPostgres}=require('./helpers/coupons-postgres.cjs');
let db,actor,legacy,unclassified;let seq=30000000;
const phone=()=>String(++seq),migration='supabase/migrations/20261125115131_coupon_product_eligibility.sql';
const rpc=async(op,c={})=>(await db.service('select public.pth_coupon_admin($1,$2,$3) r',[actor,op,c])).rows[0].r;
async function campaign(patch={}){return rpc('save',{code:'T'+randomUUID().replaceAll('-','').slice(0,12).toUpperCase(),kind:'fixed',value:1000,minimum_cents:0,
 product_size:'Grande',product_min_cents:0,product_max_cents:null,starts_at:'2020-01-01Z',ends_at:'2100-01-01Z',total_limit:100,phone_limit:1,active:true,reason:'Synthetic test',...patch});}
async function product(size,price,provider='AA'){
 const id=randomUUID();await db.query('insert into productos(id,nombre,"tamaño_envio",precio,proveedor,disponible) values($1,$2,$3,$4,$5,$6)',[id,'Synthetic product',size,price,provider,'SI']);return{id,size,price,provider};
}
function cart(items,ph=phone()){
 const providers=[...new Set(items.map(x=>x.product.provider))],token='pthn2.1795348800000.p.1.'+randomUUID()+'.actor.payload.providers.signature';
 return providers.map((provider,index)=>{const lines=items.filter(x=>x.product.provider===provider).map(x=>({producto_id:x.product.id,cantidad:x.qty||1,unit_cents:Math.round(x.product.price*100)}));
  const gross=lines.reduce((sum,x)=>sum+x.unit_cents*x.cantidad,0);return{id:randomUUID(),submission_token:token,proveedor:provider,cliente:'Synthetic customer',telefono:ph,ci:'11111111111',direccion:'Synthetic address',municipio:'Habana',producto:'Canonical server products',
   total:gross/100+(index?0:5),costo_mensajeria:index?0:5,comision_total:0,estado:'Pendiente',gestor:'Venta Directa',origen:'Web',pago_gestor:'No aplica',_coupon_lines:lines};});
}
async function quote(c,rows){const q=(await db.service('select public.pth_coupon_quote($1,$2,$3,null) r',[c.code,rows[0].telefono,JSON.stringify(rows)])).rows[0].r;
 if(q.error)throw Object.assign(Error(q.error.message),{code:q.sqlstate});return q;}
const insert=async(rows,q,captures=null)=>(await db.service('select public.pth_insert_coupon_checkout($1,$2,$3,null) r',[JSON.stringify(rows),{...q,phone:rows[0].telefono},captures===null?null:JSON.stringify(captures)])).rows[0].r;
before(async()=>{
 db=await startCouponsPostgres();await db.query('alter table productos add column precio numeric');actor=randomUUID();
 await db.query("insert into gestores(id,nombre,rol) values($1,'Synthetic administrator','admin')",[actor]);
 legacy=await campaign({value:300,product_size:undefined,product_min_cents:undefined,product_max_cents:undefined});
 unclassified=await campaign({value:5,kind:'percent',product_size:undefined,product_min_cents:undefined,product_max_cents:undefined});
 await db.query(await fs.readFile(path.resolve(__dirname,'..',migration),'utf8'));
});
after(async()=>{await db?.stop();});

test('legacy $3 campaign becomes medium with explicit system audit, not a fabricated administrator action',async()=>{
 const c=(await db.query('select * from pth_coupons.campaigns where id=$1',[legacy.id])).rows[0];
 assert.equal(c.product_size,'Mediano');assert.equal(c.value,'300');assert.equal(c.revision,legacy.revision+1);
 const audit=(await db.query('select * from pth_coupons.audit where campaign_id=$1 order by revision desc limit 1',[legacy.id])).rows[0];
 assert.equal(audit.actor_id,'00000000-0000-0000-0000-000000000000');assert.match(audit.reason,/sistema/i);
});
test('admin saves exact size and inclusive unit-price bounds; an old editor cannot erase them',async()=>{
 const c=await campaign({product_size:'Mediano',product_min_cents:2000,product_max_cents:10000,value:300});
 assert.equal(c.product_size,'Mediano');assert.equal(c.product_min_cents,2000);assert.equal(c.product_max_cents,10000);
 const {product_size,product_min_cents,product_max_cents,...old}=c;const updated=await rpc('save',{...old,reason:'Legacy edit'});
 assert.equal(updated.product_size,'Mediano');assert.equal(updated.product_min_cents,2000);assert.equal(updated.product_max_cents,10000);
});
test('unclassified legacy coupons cannot bypass size restrictions; an admin can classify them explicitly',async()=>{
 const rows=cart([{product:await product('Grande',50)}]);await assert.rejects(quote(unclassified,rows),e=>e.code==='PT409');
 const updated=await rpc('save',{...unclassified,product_size:'Grande',product_min_cents:0,product_max_cents:null,reason:'Clasificación explícita'});
 assert.equal((await quote(updated,rows)).discount_cents,250);
});
test('invalid size, missing scope on new campaign and inverted/fractional limits are rejected',async()=>{
 for(const patch of [{product_size:'Todos'},{product_size:null},{product_size:undefined},{product_min_cents:-1},{product_min_cents:1.2},{product_min_cents:200,product_max_cents:100},{product_max_cents:'bad'}])await assert.rejects(campaign(patch),e=>e.code==='PT400');
});
test('large coupon is refused for small and medium equipment even when expensive',async()=>{
 const c=await campaign();for(const size of ['Pequeño','Mediano'])await assert.rejects(quote(c,cart([{product:await product(size,999)}])),e=>e.code==='PT409');
});
test('bounds apply per unit, not multiplied quantities, and are inclusive at both ends',async()=>{
 const c=await campaign({product_size:'Pequeño',value:100,product_min_cents:2000,product_max_cents:5000});
 for(const price of [19.99,50.01])await assert.rejects(quote(c,cart([{product:await product('Pequeño',price),qty:100}])),e=>e.code==='PT409');
 for(const price of [20,50])assert.equal((await quote(c,cart([{product:await product('Pequeño',price)}]))).discount_cents,100);
});
test('mixed providers discount only eligible large subtotal, never shipping or ineligible items',async()=>{
 const c=await campaign(),rows=cart([{product:await product('Pequeño',100,'AA')},{product:await product('Grande',20,'BB')}]),q=await quote(c,rows);
 assert.equal(q.subtotal_cents,12000);assert.equal(q.eligible_subtotal_cents,2000);assert.equal(q.discount_cents,1000);
 assert.deepEqual(q.allocations,[{proveedor:'AA',gross_cents:10000,discount_cents:0,net_cents:10000},{proveedor:'BB',gross_cents:2000,discount_cents:1000,net_cents:1000}]);
 const receipts=await insert(rows,q);assert.equal(receipts.length,2);
 const orders=(await db.query('select proveedor,total,costo_mensajeria,comision_total from pedidos where id=any($1) order by proveedor',[rows.map(x=>x.id)])).rows;
 assert.deepEqual(orders.map(x=>[x.proveedor,Number(x.total),Number(x.costo_mensajeria),Number(x.comision_total)]),[['AA',105,5,0],['BB',10,0,0]]);
});
test('mixed lines from one provider cap discount at eligible amount and percent uses eligible subtotal',async()=>{
 const items=[{product:await product('Pequeño',100)},{product:await product('Grande',2)}];
 assert.equal((await quote(await campaign(),cart(items))).discount_cents,200);
 assert.equal((await quote(await campaign({kind:'percent',value:10}),cart(items))).discount_cents,20);
});
test('line forgery, incomplete lines, wrong provider, missing/unknown size and changed prices fail closed',async()=>{
 const c=await campaign(),p=await product('Grande',50);
 for(const mutate of [r=>delete r[0]._coupon_lines,r=>r[0]._coupon_lines[0].unit_cents=1,r=>r[0]._coupon_lines[0].cantidad=2,r=>r[0].proveedor='BB',r=>r[0]._coupon_lines=[]]){const rows=cart([{product:p}]);mutate(rows);await assert.rejects(quote(c,rows),e=>e.code==='PT409');}
 await db.query('update productos set "tamaño_envio"=null where id=$1',[p.id]);await assert.rejects(quote(c,cart([{product:p}])),e=>e.code==='PT409');
});
test('size/range/price changes after quote block submission; accepted receipt remains replayable',async()=>{
 const c=await campaign(),p=await product('Grande',50),rows=cart([{product:p}]),q=await quote(c,rows);
 await db.query('update productos set "tamaño_envio"=$2 where id=$1',[p.id,'Mediano']);await assert.rejects(insert(rows,q),e=>e.code==='PT409');
 await db.query('update productos set "tamaño_envio"=$2 where id=$1',[p.id,'Grande']);const saved=await insert(rows,q);
 await db.query('update productos set precio=999 where id=$1',[p.id]);assert.deepEqual(await insert(rows,q),saved);
 assert.equal((await db.query('select count(*) n from pth_coupons.redemptions where campaign_id=$1',[c.id])).rows[0].n,'1');
});
test('parallel confirmations redeem once; last campaign use permits exactly one different order',async()=>{
 const p=await product('Grande',50),c=await campaign({total_limit:1}),rows=cart([{product:p}]),q=await quote(c,rows);
 const results=await Promise.all(Array.from({length:8},()=>insert(rows,q)));assert.ok(results.every(r=>JSON.stringify(r)===JSON.stringify(results[0])));
 await assert.rejects(quote(c,cart([{product:p}])),e=>e.code==='PT409');
});
test('two already-quoted different customers racing the final use cannot both redeem',async()=>{
 const p=await product('Grande',50),c=await campaign({total_limit:1});
 const a=cart([{product:p}]),b=cart([{product:p}]),qa=await quote(c,a),qb=await quote(c,b);
 const outcomes=await Promise.allSettled([insert(a,qa),insert(b,qb)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason.code==='PT409').length,1);
 assert.equal((await db.query('select count(*) n from pth_coupons.redemptions where campaign_id=$1',[c.id])).rows[0].n,'1');
});
test('new helper remains invoker and unavailable to anonymous/signed-in roles',async()=>{
 const permissions=await db.query("select prosecdef,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc where oid='pth_coupons.eligible_rows(jsonb,text,bigint,bigint)'::regprocedure");
 assert.deepEqual(permissions.rows,[{prosecdef:false,anon:false,authenticated:false}]);
});
test('native SQL quote agrees with the actual gateway DTO and canonical line metadata',async()=>{
 const {quoteCoupon}=await import('../supabase/functions/secure-data/coupons.mjs');
 const c=await campaign(),rows=cart([{product:await product('Grande',50)}]);
 const adapter={rpc:async(fn,args)=>{assert.equal(fn,'pth_coupon_quote');return{data:(await db.service('select public.pth_coupon_quote($1,$2,$3,$4) r',[args.p_code,args.p_phone,JSON.stringify(args.p_rows),args.p_rate_key])).rows[0].r,error:null};}};
 const q=await quoteCoupon(adapter,{code:c.code,rows,phone:rows[0].telefono});assert.equal(q.discount_cents,1000);assert.equal(q.eligible_subtotal_cents,5000);
 assert.equal((await insert(rows,q)).length,1);
});
test('enabled points wrapper accepts coupon rows without metadata leakage and grants no commercial points',async()=>{
 await db.query("update pth_points.config set enabled=true,started_at=clock_timestamp()-interval '1 day'");
 const p=await product('Grande',50),c=await campaign(),rows=cart([{product:p}]),q=await quote(c,rows);
 const captures=rows.map(row=>({pedido_id:row.id,beneficiary_id:null,sales_channel:'direct',lines:[{producto_id:p.id,cantidad:1}]}));
 assert.equal((await insert(rows,q,captures)).length,1);assert.equal((await db.query('select count(*) n from pth_points.movements')).rows[0].n,'0');
});
