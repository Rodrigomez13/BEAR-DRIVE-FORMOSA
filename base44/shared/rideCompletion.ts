import { all, businessDay, chargeDue, withLock } from './domain.ts';
// Caller holds the ride lock. Effects are reconstructed by ride and business day.
export async function finalizeRideCompletion(client,rideId,completedDate) {
 const e=client.asServiceRole.entities,ride=await e.Ride.get(rideId);
 if(!ride||!['COMPLETED','RATED'].includes(ride.status)||ride.completion_effects_done) return;
 await withLock(e.User,ride.passenger_id,async()=>{
  const ledger=await all(e.BearPointsLedger,{user_id:ride.passenger_id});
  if(!ledger.some(row=>row.ride_id===rideId&&row.reason==='ride_completed')) await e.BearPointsLedger.create({user_id:ride.passenger_id,points:10,reason:'ride_completed',ride_id:rideId});
  const updated=await all(e.BearPointsLedger,{user_id:ride.passenger_id});
  const completed=await all(e.Ride,{passenger_id:ride.passenger_id,status:{$in:['COMPLETED','RATED']}});
  await e.User.update(ride.passenger_id,{bearpoints_balance:updated.reduce((s,r)=>s+r.points,0),total_rides:completed.length});
 });
 if(ride.driver_id) await withLock(e.User,ride.driver_id,async()=>{
  const day=businessDay(completedDate),charges=await e.DriverDailyCharge.filter({driver_id:ride.driver_id,business_day:day});
  if(!charges.length) await e.DriverDailyCharge.create({driver_id:ride.driver_id,driver_name:ride.driver_name||'',business_day:day,amount:5000,total_due:5000,currency:'ARS',status:'pending',due_at:chargeDue(day),trigger_ride_id:rideId});
  const queued=await e.Ride.filter({driver_id:ride.driver_id,status:'ASSIGNED',queued_after_ride_id:rideId});
  for(const next of queued) await e.Ride.updateMany({id:next.id,status:'ASSIGNED',queued_after_ride_id:rideId},{$set:{status:'DRIVER_APPROACHING',queued_after_ride_id:null}});
 });
 await e.Ride.update(rideId,{completion_effects_done:true});
}
