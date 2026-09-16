import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, all, eligibleVehicle, premiumEligible, ACTIVE } from '../../shared/domain.ts';
import { haversineKm } from '../../shared/pricing.ts';
export default req => api(req,createClientFromRequest,async (client,user) => {
 const e=client.asServiceRole.entities;
 const locations=await e.DriverLocation.filter({driver_id:user.id,online:true});
 const location=locations[0];
 if (!location || Date.now()-Date.parse(location.updated_date || location.created_date)>90000) return {rides:[]};
 const vehicle=await eligibleVehicle(client,user,location.vehicle_id);
 const active=await all(e.Ride,{driver_id:user.id,status:{$in:ACTIVE}});
 if(active.length>=2 || active.some(r=>r.status==='ASSIGNED')) return {rides:[]};
 const rides=await all(e.Ride,{status:'SEARCHING'});
 return {rides:rides.filter(r=>r.passenger_id!==user.id && (r.category!=='premium'||premiumEligible(vehicle)))
  .map(r=>({ ...r,distance_km:haversineKm(location.lat,location.lng,r.origin_lat,r.origin_lng) }))
  .filter(r=>r.distance_km <= (r.search_radius_km || 10) && Date.now()-Date.parse(r.search_started_at || r.created_date)<90000)
  .map(r=>({id:r.id,status:r.status,origin_address:r.origin_address,origin_lat:r.origin_lat,origin_lng:r.origin_lng,destination_address:r.destination_address,
   quoted_fare:r.quoted_fare,category:r.category,distance_km:r.distance_km,duration_min:r.duration_min,passenger_name:r.passenger_name,notes:r.notes}))};
});
