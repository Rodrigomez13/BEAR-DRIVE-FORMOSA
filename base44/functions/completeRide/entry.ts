import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, withLock, cas, publicRide } from '../../shared/domain.ts';
import { sellerAccount, checkout } from '../../shared/payments.ts';
import { finalizeRideCompletion } from '../../shared/rideCompletion.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities;
 await participant(client,user,body.ride_id);
 return withLock(e.Ride,body.ride_id,async()=>{
  const ride=await participant(client,user,body.ride_id);
  if(ride.driver_id!==user.id) fail('Solo el conductor puede confirmar el cobro',403);
  if(['COMPLETED','RATED'].includes(ride.status)) {await finalizeRideCompletion(client,ride.id,ride.completed_date);return {ride:publicRide(ride,user.id),payment_status:'completed'};}
  if(ride.status!=='PAYMENT_PENDING') fail('El viaje no está listo para cobrar');
  if(ride.payment_method==='cash') {
   const date=new Date().toISOString();
   await cas(e.Ride,{id:ride.id,status:'PAYMENT_PENDING'},{status:'COMPLETED',payment_status:'paid',completed_date:date,final_fare:ride.final_fare||ride.quoted_fare});
   await finalizeRideCompletion(client,ride.id,date);
   return {ride:publicRide(await e.Ride.get(ride.id),user.id),payment_status:'completed'};
  }
  if(ride.payment_method!=='qr') fail('Pago anterior requiere conciliación por soporte');
  return checkout(client,'Ride',ride,await sellerAccount(client,ride.driver_id),'ride');
 });
});
