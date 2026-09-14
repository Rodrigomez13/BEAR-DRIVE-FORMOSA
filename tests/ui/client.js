const listeners = new Set();
const state = { cases: [{id:'case',user_name:'Pasajero de prueba',user_id:'passenger',category:'safety',status:'open',description:'SOS de prueba local',ride_id:'ride'}], rides:[{id:'ride',status:'IN_PROGRESS',passenger_name:'Pasajero de prueba',driver_name:'Conductor de prueba',quoted_fare:8000}], charges:[] };
export const base44 = { entities:new Proxy({}, {get:()=>({subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}})}), functions:{invoke:async(name,body)=>{
 if(name==='supportOperations') {if(body.action==='case') {state.cases=state.cases.map(c=>({...c,status:body.status,assigned_to:'soporte@test.local'})).filter(c=>!['resolved','closed'].includes(c.status));}return {data:structuredClone(state)};}
 if(name==='getAccountStatus') return {data:{blocked:true,unpaid_rides:[],charges:[{amount:5000}]}};
 if(name==='changeRideDestination') {if(body.action==='quote') return {data:{quote:{id:'q',destination_address:body.address,price:9000,total_distance_km:12,total_duration_min:25}}};return {data:{ride:{id:'ride',status:'IN_PROGRESS',final_fare:9000,destination_address:'Nuevo destino',fare_change_quote:null}}};}
 throw new Error('Unexpected fixture invocation '+name);
}}};
