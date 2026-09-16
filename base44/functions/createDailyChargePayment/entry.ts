import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, withLock, chargeBalance } from '../../shared/domain.ts';
import { requiredSecret, checkout } from '../../shared/payments.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities,charge=await e.DriverDailyCharge.get(body.charge_id);
 if(charge.driver_id!==user.id) fail('No autorizado',403);
 return withLock(e.DriverDailyCharge,charge.id,async()=>{
  const current=await e.DriverDailyCharge.get(charge.id);
  if(current.status!=='pending') fail('El cargo ya está regularizado');
  const balance=chargeBalance(current);
  await e.DriverDailyCharge.update(current.id,{late_fee:balance.late_fee || 0,total_due:balance.total_due || balance.amount});
  return checkout(client,'DriverDailyCharge',balance,{access_token:requiredSecret('MP_DAILY_CHARGE_ACCESS_TOKEN'),seller_id:requiredSecret('MP_DAILY_CHARGE_COLLECTOR_ID')},'daily');
 });
});
