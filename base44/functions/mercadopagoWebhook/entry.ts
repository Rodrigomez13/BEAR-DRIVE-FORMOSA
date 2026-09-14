import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { withLock, fail } from '../../shared/domain.ts';
import { verifyMP, mp, sellerAccount, requiredSecret, paymentMatches } from '../../shared/payments.ts';
import { finalizeRideCompletion } from '../../shared/rideCompletion.ts';
export default async function(req) {
 try {
  if(!await verifyMP(req)) return Response.json({error:'Firma inválida'},{status:401});
  const client=createClientFromRequest(req),e=client.asServiceRole.entities,url=new URL(req.url);
  const kind=url.searchParams.get('kind'),id=url.searchParams.get('record_id');
  if(!['ride','daily'].includes(kind)||!id) fail('Referencia inválida');
  const entity=kind==='ride'?e.Ride:e.DriverDailyCharge;
  return await withLock(entity,id,async()=>{
   const record=await entity.get(id);
   const account=kind==='ride'?await sellerAccount(client,record.driver_id):{access_token:requiredSecret('MP_DAILY_CHARGE_ACCESS_TOKEN'),seller_id:requiredSecret('MP_DAILY_CHARGE_COLLECTOR_ID')};
   const payment=await mp(`/v1/payments/${encodeURIComponent(url.searchParams.get('data.id'))}`,account.access_token);
   if(!paymentMatches(payment,record,account.seller_id,kind)) return Response.json({received:true,ignored:true});
   if(record.payment_id && record.payment_id!==String(payment.id)) {
    const existing=await e.SupportCase.filter({ride_id:kind==='ride'?id:null,description:`Pago duplicado ${payment.id}`});
    if(!existing.length) await e.SupportCase.create({user_id:record.passenger_id||record.driver_id,ride_id:kind==='ride'?id:null,category:'payment',status:'open',description:`Pago duplicado ${payment.id}`});
    return Response.json({received:true,duplicate:true});
   }
   if(kind==='ride') {
    if(!['PAYMENT_PENDING','COMPLETED','RATED'].includes(record.status)) return Response.json({received:true,ignored:true});
    if(record.status==='PAYMENT_PENDING') await entity.update(id,{status:'COMPLETED',payment_status:'paid',payment_id:String(payment.id),completed_date:new Date().toISOString(),final_fare:record.final_fare||record.quoted_fare});
    const completed=await entity.get(id);await finalizeRideCompletion(client,id,completed.completed_date);
   } else if(record.status==='pending') await entity.update(id,{status:'paid',paid_date:new Date().toISOString(),payment_id:String(payment.id)});
   return Response.json({received:true});
  });
 }catch(e){return Response.json({error:e.message},{status:e.status||500});}
}
