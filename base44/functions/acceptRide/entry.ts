import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, all, ACTIVE, eligibleVehicle, premiumEligible, cas, publicRide } from '../../shared/domain.ts';
import { withUserLock } from '../../shared/userLock.ts';
import { haversineKm } from '../../shared/pricing.ts';
export default req => api(req,createClientFromRequest,async (client,user,body) => {
 const e=client.asServiceRole.entities;
 return withUserLock(client,user.id,async()=>{
  const vehicle=await eligibleVehicle(client,user,body.vehicle_id);
  const ride=await e.Ride.get(body.ride_id);
  if(ride.driver_id===user.id && ['ASSIGNED','DRIVER_APPROACHING'].includes(ride.status)) return {ride:publicRide(ride,user.id),queued:ride.status==='ASSIGNED'};
  if(ride.status!=='SEARCHING' || ride.passenger_id===user.id) fail('El viaje ya no está disponible',409);
  if(Date.now()-Date.parse(ride.search_started_at || ride.created_date)>=90000) fail('La búsqueda finalizó',409);
  const locations=await e.DriverLocation.filter({driver_id:user.id,online:true});
  const pos=locations[0];
  if(!pos || pos.vehicle_id!==vehicle.id || Date.now()-Date.parse(pos.updated_date||pos.created_date)>90000) fail('Actualizá tu ubicación antes de aceptar');
  if(haversineKm(pos.lat,pos.lng,ride.origin_lat,ride.origin_lng)>(ride.search_radius_km||10)) fail('Fuera del radio de búsqueda');
  if(ride.category==='premium'&&!premiumEligible(vehicle)) fail('El vehículo no cumple la antigüedad Premium',403);
  const active=await all(e.Ride,{driver_id:user.id,status:{$in:ACTIVE}});
  if(active.length>=2 || active.some(r=>r.status==='ASSIGNED')) fail('Ya tenés un viaje comprometido',409);
  if(ride.payment_method!=='cash' && !(await e.PaymentAccount.filter({driver_id:user.id})).some(a=>a.access_token)) fail('Vinculá Mercado Pago para aceptar viajes digitales',403);
  const queued=active.length>0;
  await cas(e.Ride,{id:ride.id,status:'SEARCHING'}, {status:queued?'ASSIGNED':'DRIVER_APPROACHING',queued_after_ride_id:active[0]?.id||null,
   driver_id:user.id,driver_name:user.full_name||'',vehicle_id:vehicle.id,vehicle_plate:vehicle.plate,vehicle_model:`${vehicle.make} ${vehicle.model}`,vehicle_color:vehicle.color});
  return {ride:publicRide(await e.Ride.get(ride.id),user.id),queued};
 });
});
