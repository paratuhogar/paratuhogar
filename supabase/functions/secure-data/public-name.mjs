import {actorKind} from './policy.mjs';
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
export async function publicName(db, body, actor) {
 if (!actor) fail('Inicia sesión para cambiar tu nombre público.',401);
 if (!actor.id || !['gestor','subgestor','admin'].includes(actorKind(actor))) fail('Esta cuenta no puede cambiar un nombre público.');
 if (Object.keys(body).some(key=>!['action','nombre_publico'].includes(key)) || !Object.hasOwn(body,'nombre_publico')) fail('Solo puedes cambiar tu propio nombre público.');
 const value=body.nombre_publico;
 if (value !== null && typeof value !== 'string') fail('Escribe un nombre válido.',400);
 const name=value===null?null:value.trim()||null;
 if (name!==null && (Array.from(name).length>40 || /[<>\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value))) fail('Usa hasta 40 caracteres, sin etiquetas ni caracteres de control.',400);
 const {data,error}=await db.from('gestores').update({nombre_publico:name}).eq('id',actor.id).select('id,nombre_publico').maybeSingle();
 if (error || !data || data.id!==actor.id) fail('No se pudo guardar tu nombre público. Vuelve a intentar.',503);
 return {data:{id:actor.id,nombre_publico:data.nombre_publico},error:null};
}
