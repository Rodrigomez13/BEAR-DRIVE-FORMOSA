import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail, withLock, cas } from '../../shared/domain.ts';
import { quoteRoute } from '../../shared/quotes.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities;
 await participant(client,user,body.ride_id);
 return withLock(e.Ride,body.ride_id,async()=>{
  const ride=await participant(client,user,body.ride_id);
  if(ride.passenger_id!==user.id||ride.status!=='IN_PROGRESS') fail('Solo el pasajero puede cambiar el destino durante el viaje');
  if(body.action==='quote') {
   const loc=(await e.DriverLocation.filter({driver_id:ride.driver_id}))[0];
   if(!loc||Date.now()-Date.parse(loc.updated_date||loc.created_date)>30000) fail('Esperá una ubicación actual del conductor');
   const next=await quoteRoute(client,user.id,{origin_lat:loc.lat,origin_lng:loc.lng,destination_lat:body.lat,destination_lng:body.lng,destination_address:body.address,category:ride.category});
   const remaining=await quoteRoute(client,user.id,{origin_lat:loc.lat,origin_lng:loc.lng,destination_lat:ride.destination_lat,destination_lng:ride.destination_lng,category:ride.category});
   // Preserve the already contracted portion; replace the remaining route value.
   const quote={...next,price:Math.max(0,Math.round((ride.final_fare||ride.quoted_fare)-remaining.price))+next.price,
    total_distance_km:Math.max(0,ride.distance_km-remaining.distance_km)+next.distance_km,
    total_duration_min:Math.max(0,ride.duration_min-remaining.duration_min)+next.duration_min,
    revision:ride.destination_revision||0};
   await e.Ride.update(ride.id,{fare_change_quote:JSON.stringify(quote)});
   return {quote};
  }
  const quote=JSON.parse(ride.fare_change_quote||'null');
  if(body.action==='cancel') {await e.Ride.update(ride.id,{fare_change_quote:null});return {ride:await e.Ride.get(ride.id)};}
  if(body.action!=='confirm'||!quote||quote.id!==body.quote_id||Date.parse(quote.expires_at)<=Date.now()||quote.revision!==(ride.destination_revision||0)) fail('La propuesta venció. Volvé a cotizar.',409);
  if(ride.payment_checkout_url) fail('Ya existe un cobro iniciado. Contactá soporte',409);
  await cas(e.Ride,{id:ride.id,status:'IN_PROGRESS'}, {destination_lat:quote.destination_lat,destination_lng:quote.destination_lng,destination_address:quote.destination_address,
   final_fare:quote.price,distance_km:quote.total_distance_km,duration_min:quote.total_duration_min,destination_revision:(ride.destination_revision||0)+1,fare_change_quote:null});
  return {ride:await e.Ride.get(ride.id)};
 });
});
