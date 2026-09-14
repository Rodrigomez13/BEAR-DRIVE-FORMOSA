import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, withLock, fail } from '../../shared/domain.ts';
import { requiredSecret } from '../../shared/payments.ts';
export default req=>api(req,createClientFromRequest,async(client,user)=>{
 const e=client.asServiceRole.entities;
 const applications=await e.DriverApplication.filter({user_id:user.id,status:'APPROVED'});
 if(!applications.some(a=>a.reviewed_by)) fail('Necesitás aprobación como conductor',403);
 return withLock(e.User,user.id,async()=>{
  const state=crypto.randomUUID(),verifier=crypto.randomUUID()+crypto.randomUUID();
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const accounts=await e.PaymentAccount.filter({driver_id:user.id});
  const values={state,verifier,state_expires_at:new Date(Date.now()+600000).toISOString()};
  if(accounts.length) await e.PaymentAccount.update(accounts[0].id,values);else await e.PaymentAccount.create({driver_id:user.id,...values});
  const url=new URL('https://auth.mercadopago.com.ar/authorization');
  Object.entries({client_id:requiredSecret('MP_CLIENT_ID'),response_type:'code',platform_id:'mp',redirect_uri:requiredSecret('MP_REDIRECT_URI'),state,code_challenge:challenge,code_challenge_method:'S256'}).forEach(([k,v])=>url.searchParams.set(k,v));
  return {url:url.toString()};
 });
});
