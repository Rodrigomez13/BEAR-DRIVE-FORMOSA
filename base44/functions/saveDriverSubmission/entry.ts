import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { api, fail } from '../../shared/domain.ts';
const allowed={DriverApplication:['first_name','last_name','dni_number','birth_date','phone','address','city','province','postal_code','applicant_name','applicant_email','license_number','license_class','submitted_date'],Vehicle:['make','model','year','plate','color','nickname','segment','has_ac','photo_url'],DriverDocument:['application_id','subject','document_type','document_code','code','label','file_url','document_number','issued_at','expires_at','driver_id']};
export default req=>api(req,createClientFromRequest,async(client,user,body)=>{
 if(!allowed[body.entity]) fail('Entidad inválida');
 const e=client.asServiceRole.entities,entity=e[body.entity],data={};
 for(const key of allowed[body.entity]) if(body.data?.[key]!==undefined) data[key]=body.data[key];
 const owner=body.entity==='DriverApplication'?'user_id':'driver_id';data[owner]=user.id;
 if(body.entity==='DriverDocument') {
  const app=await e.DriverApplication.get(data.application_id);if(app.user_id!==user.id) fail('No autorizado',403);
 }
 if(body.id) {
  const current=await entity.get(body.id);
  if(current[owner]!==user.id) fail('No autorizado',403);
  if(['APPROVED','SUSPENDED','approved'].includes(current.status)) fail('Solicitá a soporte modificar datos ya aprobados',409);
 }
 data.status=body.entity==='Vehicle'?'pending':body.entity==='DriverDocument'?'PENDING':'SUBMITTED';
 return {record:body.id?await entity.update(body.id,data):await entity.create(data)};
});
