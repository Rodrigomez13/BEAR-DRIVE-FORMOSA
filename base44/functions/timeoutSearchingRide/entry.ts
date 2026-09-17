import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
// Workflows and clients may request expiry; server time and search generation decide it.
export default async function(req) {
 try {
  const client=createClientFromRequest(req), {ride_id}=await req.json();
  const e=client.asServiceRole.entities,ride=await e.Ride.get(ride_id);
  const started=ride.search_started_at||ride.created_date;
  if(ride.status!=='SEARCHING'||Date.now()-Date.parse(started)<90000) return Response.json({skipped:true});
  const result=await e.Ride.updateMany({id:ride.id,status:'SEARCHING',search_started_at:ride.search_started_at||null},{$set:{status:'NO_DRIVERS'}});
  return Response.json({timed_out:result.updated===1});
 }catch(e){return Response.json({error:e.message},{status:500});}
}
