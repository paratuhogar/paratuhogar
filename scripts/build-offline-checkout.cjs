/* The saved checkout uses the normal form's markup, IDs and labels. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const match=source.match(/<form id="checkout-form" class="[^"]*"[\s\S]*?<\/form>/);
if(!match)throw Error('Normal checkout form not found');
let markup=match[0].replace(/<!--[^]*?-->/g,'').replace(/\s+on(?:click|change|input|blur)="[^"]*"/g,'');
markup=markup.replace('class="flex-1 flex flex-col mt-4"','class="flex-1 flex flex-col mt-4" autocomplete="off"');
markup=markup.replace('Tu pedido se confirma personalmente','El mismo pedido, también sin conexión');
markup=markup.replace('Al finalizar abriremos WhatsApp con todos los datos. Un asesor confirmará disponibilidad, mensajería y horario antes de la entrega.','Completa los datos como siempre. Al confirmar, guardaremos el pedido en este teléfono y lo enviaremos cuando vuelva la conexión, con esta página abierta y tu misma cuenta.');
markup=markup.replace('id="gestor-checkout-tools" class="hidden','id="gestor-checkout-tools" class="');
markup=markup.replace('Pegar Datos de WhatsApp (Automático)','Pegar datos del cliente');
markup=markup.replace('<i class="fab fa-whatsapp text-xl"></i>','').replace('<span>Confirmar por WhatsApp</span>','<span>Confirmar y guardar pendiente</span>');
markup=markup.replace('No se realiza ningún cobro automático. Revisaremos los datos antes de coordinar la entrega.','El total usa los precios y las tarifas guardados. Si cambian antes de enviar, te pediremos revisar el pedido. No se realiza ningún cobro automático.');
// Optional owner verification remains server-only. Never show an offline claim.
markup=markup.replace(/<label id="assisted-sale-option"[\s\S]*?<\/label>/,'');
markup=markup.replace(/<div id="btn-coordinar-almacen"[\s\S]*?<\/div>/,'');
markup=markup.replace(/<span class="material-symbols-outlined[^\"]*">([^<]*)<\/span>/g,(_,icon)=>`<span class="checkout-icon" aria-hidden="true">${({verified_user:'✓',content_paste_go:'▣',person_search:'⌕',expand_more:'⌄',payments:'$ ',local_shipping:'▰'})[icon]||''}</span>`);
// Link labels to existing field IDs without changing the normal field order.
markup=markup.replace(/<label([^>]*)>([^]*?)<\/label>(\s*(?:<div class="relative">\s*)?)<(input|textarea|select)([^>]*\bid="([^"]+)"[^>]*)>/g,(all,attrs,label,gap,tag,inputAttrs,id)=>attrs.includes('for=')?all:`<label${attrs} for="${id}">${label}</label>${gap}<${tag}${inputAttrs}>`);
markup=markup.split('\n').map(line=>line.trimEnd()).join('\n');
const file=path.join(root,'offline-order.html'),existing=fs.readFileSync(file,'utf8');
const start='<!-- BEGIN SHARED CHECKOUT FORM -->',end='<!-- END SHARED CHECKOUT FORM -->';
if(!existing.includes(start)||!existing.includes(end))throw Error('Offline form markers not found');
const next=existing.slice(0,existing.indexOf(start))+start+'\n'+markup+'\n'+end+existing.slice(existing.indexOf(end)+end.length);
if(process.argv.includes('--check')){if(next!==existing)throw Error('Generated offline checkout differs from the normal form');}else fs.writeFileSync(file,next);
