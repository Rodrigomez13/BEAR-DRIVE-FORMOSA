import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, participant, fail } from '../../shared/domain.ts';
export default req => api(req, createClientFromRequest, async (client,user,body) => {
 const ride = await participant(client,user,body.ride_id);
 if (ride.passenger_id !== user.id || ride.status !== 'NO_DRIVERS') fail('Solo se puede reintentar una búsqueda agotada');
 const configs = await client.asServiceRole.entities.PricingConfig.filter({active:true});
 const percent = Math.min(20, Math.max(0, configs[0]?.retry_increase_percent ?? 5));
 const radius = Math.min(40, (ride.search_radius_km || 10) + (configs[0]?.retry_radius_step_km ?? 5));
 const q = await client.asServiceRole.entities.RideQuote.create({ passenger_id:user.id, category:ride.category,
  price:Math.round(ride.quoted_fare*(1+percent/100)), currency:'ARS', distance_km:ride.distance_km,duration_min:ride.duration_min,
  origin_lat:ride.origin_lat,origin_lng:ride.origin_lng,destination_lat:ride.destination_lat,destination_lng:ride.destination_lng,
  origin_address:ride.origin_address,destination_address:ride.destination_address,expires_at:new Date(Date.now()+300000).toISOString(),
  consumed:false,search_radius_km:radius,retry_count:(ride.retry_count||0)+1,retry_of:ride.id,provider:'retry_offer' });
 return { quote:{...q,quote_id:q.id}, increase_percent:percent };
});
