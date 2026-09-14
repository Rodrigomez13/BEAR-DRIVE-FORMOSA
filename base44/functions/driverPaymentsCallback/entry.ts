import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { withLock, fail } from '../../shared/domain.ts';
import { mp, requiredSecret } from '../../shared/payments.ts';
export default async function(req) {
 try {
  const client=createClientFromRequest(req),e=client.asServiceRole.entities,url=new URL(req.url);
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(!state||!code) fail('Vinculación cancelada o inválida');
  const accounts=await e.PaymentAccount.filter({state}),account=accounts[0];
  if(!account||!(Date.parse(account.state_expires_at)>Date.now())) fail('La vinculación venció');
  await withLock(e.PaymentAccount,account.id,async()=>{
   const current=await e.PaymentAccount.get(account.id);
   if(current.state!==state||!(Date.parse(current.state_expires_at)>Date.now())||!current.verifier) fail('Enlace utilizado o vencido');
   const tokens=await mp('/oauth/token','',{client_id:requiredSecret('MP_CLIENT_ID'),client_secret:requiredSecret('MP_CLIENT_SECRET'),code,grant_type:'authorization_code',redirect_uri:requiredSecret('MP_REDIRECT_URI'),code_verifier:current.verifier});
   if(!tokens.access_token||!tokens.user_id) fail('Respuesta inválida del proveedor',502);
   if (current.seller_id && current.seller_id !== String(tokens.user_id)) fail('La cuenta receptora ya está vinculada. Contactá soporte para cambiarla.',409);
   await e.PaymentAccount.update(account.id,{access_token:tokens.access_token,refresh_token:tokens.refresh_token,seller_id:String(tokens.user_id),expires_at:new Date(Date.now()+tokens.expires_in*1000).toISOString(),state:null,verifier:null});
  });
  return Response.redirect(requiredSecret('APP_PUBLIC_URL').replace(/\/$/,'')+'/driver/profile?payments=connected',303);
 }catch(e){return Response.json({error:e.message},{status:e.status||500});}
}
