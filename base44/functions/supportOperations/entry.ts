import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail, all } from '../../shared/domain.ts';
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 const e=client.asServiceRole.entities;
 if(user.role!=='admin') fail('Solo el equipo de operaciones',403);
 if(body.action==='list') return {cases:await all(e.SupportCase,{status:{$in:['open','in_progress']}}),rides:await e.Ride.list('-created_date',100),charges:await all(e.DriverDailyCharge,{status:'pending'})};
 if(body.action==='case') {
  const item=await e.SupportCase.get(body.id);
  if(!['open','in_progress','resolved','closed'].includes(body.status)) fail('Estado inválido');
  if(['resolved','closed'].includes(body.status)&&!String(body.resolution||'').trim()) fail('Escribí la resolución');
  await e.SupportCase.update(item.id,{status:body.status,assigned_to:user.email,resolution:String(body.resolution||'').slice(0,2000)});
  await e.AuditLog.create({actor_id:user.id,action:'support_case_updated',entity_type:'SupportCase',entity_id:item.id,old_value:item.status,new_value:body.status,reason:body.resolution||''});
  return {ok:true};
 }
 fail('Acción desconocida');
});
