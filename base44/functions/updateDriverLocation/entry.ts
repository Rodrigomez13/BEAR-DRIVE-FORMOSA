import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, all, ACTIVE } from '../../shared/domain.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 if(!Number.isFinite(body.lat)||!Number.isFinite(body.lng)||Math.abs(body.lat)>90||Math.abs(body.lng)>180) fail('Ubicación inválida');
 const e=client.asServiceRole.entities,locations=await e.DriverLocation.filter({driver_id:user.id,online:true});
 if(!locations.length) fail('Conectate primero',409);
 const position={lat:body.lat,lng:body.lng,heading:Number.isFinite(body.heading)?body.heading:null};
 await e.DriverLocation.update(locations[0].id,position);
 const rides=await all(e.Ride,{driver_id:user.id,status:{$in:ACTIVE}});
 for(const ride of rides) await e.Ride.updateMany({id:ride.id,driver_id:user.id},{$set:{driver_lat:body.lat,driver_lng:body.lng,driver_heading:position.heading}});
 return {ok:true};
});
