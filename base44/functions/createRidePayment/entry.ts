import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, withLock } from '../../shared/domain.ts';
import { sellerAccount, checkout } from '../../shared/payments.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 await participant(client,user,body.ride_id);
 return withLock(client.asServiceRole.entities.Ride,body.ride_id,async()=>{
  const ride=await participant(client,user,body.ride_id);
  if(ride.passenger_id!==user.id||ride.status!=='PAYMENT_PENDING'||ride.payment_method!=='qr') fail('Este viaje no admite un nuevo pago digital');
  return checkout(client,'Ride',ride,await sellerAccount(client,ride.driver_id),'ride');
 });
});
