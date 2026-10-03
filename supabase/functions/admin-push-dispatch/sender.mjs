import {validatePushEndpoint} from '../secure-data/push.mjs';
// prepare encrypts synchronously. The final readiness snapshot runs afterward,
// with no further async work between an approved result and provider HTTP.
export function createPushSender({prepare,fetch:request}){
 return async(sub,payload,beforeSend)=>{
  const endpoint=validatePushEndpoint(sub.endpoint);
  const details=prepare(sub,payload,endpoint);
  if(beforeSend&&!await beforeSend())return null;
  const response=await request(endpoint,{method:'POST',headers:details.headers,
   body:new Uint8Array(details.body),redirect:'manual',signal:AbortSignal.timeout(12000)});
  await response.body?.cancel();return response.status;
 };
}
