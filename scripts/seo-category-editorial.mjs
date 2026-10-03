// Original draft copy: catalogue guidance, never a compatibility or delivery promise.
const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export const CATEGORY_EDITORIAL_CSS = '.editorial{margin:0 0 32px}.editorial h2{font-size:28px;margin:0 0 14px}.editorial>p{color:#475569;line-height:1.7}.editorial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.editorial-card{min-width:0;padding:20px;border:1px solid #dbe5f2;border-radius:20px;background:#fff}.editorial-card h3{font-size:18px;margin:0 0 10px}.editorial-card p{font-size:14px;line-height:1.7;color:#475569}.editorial-card a,.editorial-links a{color:#1a4789;font-weight:850;text-underline-offset:3px}.editorial-links{display:flex;gap:14px;flex-wrap:wrap}.editorial-note{border-left:3px solid #1a4789;padding-left:14px}.editorial-card small{display:block;margin-top:10px;color:#64748b;line-height:1.7}@media(max-width:650px){.editorial-grid{grid-template-columns:1fr}.editorial-card{padding:18px}}';

export const GUIDE_DRAFTS = [
 {
  slug:'energia/que-revisar-antes-de-elegir',
  title:'Qué revisar antes de elegir un equipo de energía',
  description:'Prepara tu consulta sobre estaciones, baterías e inversores: modelo, potencia indicada, conexiones, piezas incluidas y condiciones del equipo.',
  intro:'Una consulta concreta empieza por los equipos que necesitas usar y el modelo que estás mirando. Reúne estos datos antes de confirmar tu elección.',
  sections:[
   ['Empieza por tus equipos','Haz una lista de los equipos que quieres utilizar y si funcionarán a la vez. Conserva el modelo y una foto legible de su etiqueta. Así podrás preguntar por el producto concreto con los datos de tu instalación.'],
   ['Compara los datos de cada ficha','Revisa la potencia, capacidad, salidas y tensión cuando estén informadas. Una cifra en el nombre del producto no basta para decidir. Si falta un dato, pide la ficha o el manual del modelo exacto antes de comprar. No calcules horas de uso únicamente a partir del título.'],
   ['Pregunta qué estás comprando','Confirma si se vende una estación, una batería, un inversor o un conjunto. Solicita la lista de piezas incluidas y de las que necesitarías por separado. Comprueba con tu instalador los modelos, conexiones y requisitos de la instalación; un nombre parecido no confirma compatibilidad.'],
   ['Lleva estas preguntas a la consulta','¿Cuál es el modelo exacto? ¿Qué piezas incluye? ¿Hay manual del equipo? ¿Qué datos hacen falta para confirmar su uso en mi instalación? ¿Qué garantía corresponde a esta unidad y cómo se coordina la entrega?'],
   ['Continúa con el equipo elegido','Abre la ficha para revisar sus datos y utiliza Consultar. Si decides preparar un pedido, comprueba el producto y las condiciones antes de confirmar el envío.']
  ],
  links:[['/categoria/energia/','Ver equipos de energía'],['/categoria/mundo-frio/antes-de-confirmar-el-pedido/','Revisar entrega y garantía']]
 },
 {
  slug:'mundo-frio/como-comparar-equipos',
  title:'Cómo comparar equipos de frío antes de comprar',
  description:'Revisa formato, modelo, medidas, alimentación y accesorios de refrigeradores, exhibidoras y splits antes de consultar por un equipo.',
  intro:'Elige primero el uso que necesitas y después compara los modelos disponibles. La ficha de un refrigerador, una exhibidora o un split responde a preguntas diferentes.',
  sections:[
   ['Refrigeradores y equipos compactos','Anota el modelo y la capacidad informada. Comprueba cómo se distribuye el espacio y confirma la función del equipo concreto. Revisa las medidas del aparato y del lugar donde irá; una medida del embalaje no sustituye las dimensiones del equipo.'],
   ['Exhibidoras para tu espacio','Comprueba el formato de la unidad y los accesorios que indique su ficha. Antes de elegirla, pregunta por el modelo exacto, sus condiciones de uso y las medidas necesarias para ubicarla. Confirma por separado cualquier accesorio que no aparezca incluido.'],
   ['Splits e instalación','Conserva los modelos de las unidades interior y exterior cuando estén informados. Pregunta por la alimentación, piezas incluidas y requisitos de instalación. Coordina la revisión del espacio con quien hará la instalación; el nombre o la capacidad anunciada no confirma por sí solos la adecuación al local.'],
   ['Separa el equipo de los servicios','Pregunta qué incluye la oferta y qué debe coordinarse aparte: transporte, instalación, accesorios o trabajos en el lugar. Solicita las condiciones de garantía del modelo elegido. El plazo informado en otra ficha no sustituye el de tu equipo.'],
   ['Compara con información completa','Abre las fichas que te interesen y consulta los datos pendientes. Conserva el modelo y las condiciones confirmadas antes de preparar el pedido.']
  ],
  links:[['/categoria/mundo-frio/','Ver equipos de frío'],['/categoria/mundo-frio/antes-de-confirmar-el-pedido/','Revisar entrega y garantía']]
 },
 {
  slug:'mundo-frio/antes-de-confirmar-el-pedido',
  title:'Qué confirmar sobre entrega y garantía antes del pedido',
  description:'Una lista breve para confirmar modelo, disponibilidad, importe de entrega, condiciones de garantía y forma de coordinar el pedido.',
  intro:'Antes de enviar el pedido, reúne las condiciones del producto concreto. Esta lista te ayuda a preguntar y revisar lo que falta confirmar.',
  sections:[
   ['Producto y disponibilidad','Comprueba el modelo, la cantidad que necesitas y la disponibilidad que te confirmen. El estado del catálogo orienta la consulta; confirma las unidades necesarias antes de cerrar la compra.'],
   ['Entrega y coste total','Lee la condición de mensajería de la ficha. Si indica coste adicional, solicita el importe para tu destino. Confirma la fecha o el plazo acordado, cómo se entrega el equipo y si habrá recogida o servicios separados. No des por incluido un servicio que no se haya confirmado.'],
   ['Garantía de esa unidad','Revisa el plazo informado para el producto y pregunta qué cubre, qué requisitos se aplican y con quién se tramita un caso. Solicita la documentación correspondiente. Las condiciones de otra marca o producto no se trasladan automáticamente a tu compra.'],
   ['Revisa el pedido preparado','Comprueba el producto y las cantidades en el carrito, junto con las condiciones coordinadas. Preparar el carrito no envía el pedido: el envío requiere la confirmación del formulario. Utiliza Consultar si necesitas aclarar algo antes de continuar.'],
   ['Conserva la información de tu compra','Guarda el comprobante y las condiciones que se te hayan confirmado. Al recibir el equipo, revisa el modelo, la documentación y las piezas incluidas; comunica cualquier diferencia mediante el canal acordado.']
  ],
  links:[['/categoria/mundo-frio/','Ver equipos de frío'],['/categoria/energia/','Ver equipos de energía']]
 }
];

const categories = {
 energia:{
  heading:'Encuentra el equipo de energía que necesitas',
  intro:'Revisa el tipo de equipo y los datos de tu instalación antes de elegir. Consulta las piezas incluidas y el modelo exacto de cada opción.',
  choices:[['Estación portátil','Compara las estaciones de la categoría y revisa potencia, capacidad y salidas cuando estén informadas.'],['Batería o inversor','Ten a mano los modelos de los equipos que ya tienes. Confirma la configuración y las piezas necesarias con tu instalador.'],['Paneles y accesorios','Revisa el modelo, medidas y piezas incluidas. Pregunta por lo que necesitarías aparte para tu instalación.']],
  candidates:['estacion-de-energia-800w-gnercell','estacion-marsriva-mp6-pro','bateria-15kwh-must'],
  guide:GUIDE_DRAFTS[0]
 },
 'mundo-frio':{
  heading:'Compara equipos de frío para tu espacio',
  intro:'Empieza por el uso que necesitas: refrigeración, exhibición o aire acondicionado. Revisa el modelo y las condiciones de la ficha antes de preparar el pedido.',
  choices:[['Refrigeradores','Compara formato y capacidad informada. Confirma las medidas del equipo y el espacio donde irá.'],['Exhibidoras','Revisa el formato y los accesorios que indique la ficha. Pregunta por los datos necesarios para tu uso y ubicación.'],['Splits','Comprueba los modelos de las unidades y la alimentación informada. Coordina por separado las condiciones de instalación.']],
  candidates:['refrigerador-19pies-lg-smart-inverter','nevera-vertical-7pies-aucma','split-1-5-t-reymo-inverter'],
  guide:GUIDE_DRAFTS[1]
 }
};

export function categoryEditorial(slug, products, slugMap) {
 const copy=categories[slug];
 if(!copy)return {html:'',guideHTML:'',css:''};
 const guideURL='/categoria/'+copy.guide.slug+'/';
 const questions=`<section class="editorial" aria-labelledby="elegir-${escape(slug)}"><h2 id="elegir-${escape(slug)}">${escape(copy.heading)}</h2><p>${escape(copy.intro)}</p><div class="editorial-grid">${copy.choices.map(([title,body])=>`<article class="editorial-card"><h3>${escape(title)}</h3><p>${escape(body)}</p><a href="${guideURL}">Qué revisar antes de elegir</a></article>`).join('')}</div></section>`;
 const candidates=copy.candidates.map(candidate=>products.find(p=>slugMap.get(p)===candidate)).filter(Boolean);
 const cards=candidates.map(p=>`<article class="editorial-card"><h3><a href="/producto/${escape(slugMap.get(p))}/">${escape(p.nombre)}</a></h3><p>Abre la ficha para revisar el modelo y los datos informados.</p><small>Garantía informada: ${escape(String(p.garantia||'Consultar').trim())}<br>Entrega informada: ${escape(String(p.mensajeria||'Consultar').trim())}</small><p><a href="/producto/${escape(slugMap.get(p))}/">Ver ficha y consultar</a></p></article>`).join('');
 const candidateSection=cards?`<section class="editorial" aria-labelledby="fichas-${escape(slug)}"><h2 id="fichas-${escape(slug)}">Fichas para empezar a comparar</h2><div class="editorial-grid">${cards}</div></section>`:'';
 const shared='/categoria/'+GUIDE_DRAFTS[2].slug+'/';
 const guideHTML=`${candidateSection}<section class="guide"><h2>Prepara tu consulta</h2><p>Conserva el modelo y las preguntas que quieres aclarar. Revisa las condiciones de garantía y entrega de esa ficha y confirma la disponibilidad para la cantidad que necesitas.</p><nav class="editorial-links" aria-label="Guías de compra"><a href="${guideURL}">${escape(copy.guide.title)}</a><a href="${shared}">Entrega y garantía antes del pedido</a></nav><p class="editorial-note">Si falta un dato técnico, pide el manual del modelo exacto antes de decidir. Las condiciones se confirman para el equipo elegido.</p></section>`;
 return {html:questions,guideHTML,css:CATEGORY_EDITORIAL_CSS};
}

export function guideBody(guide) {
 return guide.sections.map(([heading,body])=>`<section><h2>${escape(heading)}</h2><p>${escape(body)}</p></section>`).join('\n')+`<nav class="guide-links" aria-label="Continuar la consulta">${guide.links.map(([href,label])=>`<a href="${escape(href)}">${escape(label)}</a>`).join('')}</nav>`;
}
