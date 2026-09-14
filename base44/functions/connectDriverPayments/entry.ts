import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, withLock, fail } from '../../shared/domain.ts';
import { requiredSecret } from '../../shared/payments.ts';
export default req=>api(req,createClientFromRequest,async(client,user)=>{
 const e=client.asServiceRole.entities;
 const applications=await e.DriverApplication.filter({user_id:user.id,status:'APPROVED'});
 if(!applications.some(a=>a.reviewed_by)) fail('Necesitás aprobación como conductor',403);
 // User does not support updateMany. Serialize setup on the reviewed application.
 const application=applications.filter(a=>a.reviewed_by).sort((a,b)=>a.id.localeCompare(b.id))[0];
 const clientId=requiredSecret('MP_CLIENT_ID'),redirectUri=requiredSecret('MP_REDIRECT_URI');
 requiredSecret('MP_CLIENT_SECRET');
 if(!/^\d+$/.test(clientId)) fail('MP_CLIENT_ID debe ser el ID numérico de la aplicación de Mercado Pago',503);
 if(new URL(redirectUri).protocol!=='https:') fail('MP_REDIRECT_URI debe usar HTTPS',503);
 return withLock(e.DriverApplication,application.id,async()=>{
  const state=crypto.randomUUID(),verifier=crypto.randomUUID()+crypto.randomUUID();
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const accounts=await e.PaymentAccount.filter({driver_id:user.id});
  const values={state,verifier,state_expires_at:new Date(Date.now()+600000).toISOString()};
  if(accounts.length) await withLock(e.PaymentAccount,accounts[0].id,()=>e.PaymentAccount.update(accounts[0].id,values));else await e.PaymentAccount.create({driver_id:user.id,...values});
  const url=new URL('https://auth.mercadopago.com.ar/authorization');
  Object.entries({client_id:clientId,response_type:'code',platform_id:'mp',redirect_uri:redirectUri,state,code_challenge:challenge,code_challenge_method:'S256'}).forEach(([k,v])=>url.searchParams.set(k,v));
  return {url:url.toString()};
 });
});
