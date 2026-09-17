import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, cas, publicRide } from '../../shared/domain.ts';
export default req => api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities,ride=await participant(client,user,body.ride_id);
 const driver=false;
 if((driver?ride.driver_id:ride.passenger_id)!==user.id) fail('No autorizado',403);
 if(!['SEARCHING','ASSIGNED','DRIVER_APPROACHING','DRIVER_ARRIVED','WAITING'].includes(ride.status)) fail('Este viaje requiere intervención de soporte para cancelarse',409);
 const reSearch=driver && ['ASSIGNED','DRIVER_APPROACHING'].includes(ride.status);
 const update=reSearch?{status:'SEARCHING',driver_id:null,driver_name:null,vehicle_id:null,vehicle_plate:null,vehicle_model:null,vehicle_color:null,queued_after_ride_id:null,search_started_at:new Date().toISOString()}:
  {status:'CANCELLED',cancelled_date:new Date().toISOString(),cancel_reason:String(body.reason|| (driver?'driver_cancelled':'passenger_cancelled')).slice(0,300)};
 await cas(e.Ride,{id:ride.id,status:ride.status},update);
 return {ride:publicRide(await e.Ride.get(ride.id),user.id),re_searched:reSearch};
});
