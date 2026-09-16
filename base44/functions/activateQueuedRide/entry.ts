import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, participant, cas, FINISHED, publicRide } from '../../shared/domain.ts';
export default req => api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities,ride=await participant(client,user,body.ride_id);
 if(ride.driver_id!==user.id||ride.status!=='ASSIGNED'||!ride.queued_after_ride_id) fail('No hay reserva para activar');
 const previous=await e.Ride.get(ride.queued_after_ride_id);
 if(!FINISHED.includes(previous.status) && previous.status !== 'PAYMENT_PENDING') fail('Terminá el viaje actual primero',409);
 await cas(e.Ride,{id:ride.id,status:'ASSIGNED'},{status:'DRIVER_APPROACHING',queued_after_ride_id:null});
 return {ride:publicRide(await e.Ride.get(ride.id),user.id)};
});
