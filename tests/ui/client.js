const listeners = new Set();
const state = { cases: [{id:'case',user_name:'Pasajero de prueba',user_id:'passenger',category:'safety',status:'open',description:'SOS de prueba local',ride_id:'ride'}], rides:[{id:'ride',status:'IN_PROGRESS',passenger_name:'Pasajero de prueba',driver_name:'Conductor de prueba',quoted_fare:8000}], charges:[] };
export const base44 = { entities:new Proxy({}, {get:()=>({filter:async()=> {
 const scenario = new URLSearchParams(window.location.search).get('history');
 if (scenario === 'error') throw new Error('Fallo de carga simulado');
 if (scenario !== 'sample') return [];
 return [
 {id:'completed',status:'COMPLETED',created_date:'2026-09-15T12:00:00Z',origin_address:'Plaza San Martín, Formosa',destination_address:'Costanera de Formosa',final_fare:0,quoted_fare:2500,payment_method:'cash',payment_status:'paid',driver_name:'Conductor de prueba',distance_km:3.2},
 {id:'active',status:'IN_PROGRESS',created_date:'2026-09-15T13:00:00Z',origin_address:'Centro',destination_address:'Terminal de ómnibus',quoted_fare:3200,payment_method:'qr'},
 {id:'cancelled',status:'CANCELLED',created_date:'2026-09-14T12:00:00Z',origin_address:'Centro',destination_address:'Barrio San Miguel',quoted_fare:2200}
 ];
 },subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}})}), functions:{invoke:async(name,body)=>{
 if(name==='adminPayments') {
 const samples={accounts:[{id:'account',driver_id:'Conductor de prueba',seller_id:'123456',status:'connected',expires_at:'2027-01-01'}],rides:[{id:'ride',driver_name:'Conductor de prueba',passenger_name:'Pasajero de prueba',payment_status:'paid',final_fare:8000,payment_id:'123'}],charges:[{id:'charge',driver_name:'Conductor de prueba',status:'pending',amount:5000,business_day:'2026-09-14'}],points:[]};
 return {data:{rows:samples[body.section],has_more:false,configuration:[{name:'MP_CLIENT_ID',configured:true},{name:'MP_WEBHOOK_SECRET',configured:false}]}};
 }
 if(name==='supportOperations') {if(body.action==='case') {state.cases=state.cases.map(c=>({...c,status:body.status,assigned_to:'soporte@test.local'})).filter(c=>!['resolved','closed'].includes(c.status));}return {data:structuredClone(state)};}
 if(name==='getAccountStatus') return {data:{blocked:true,unpaid_rides:[],charges:[{amount:5000}]}};
 if(name==='changeRideDestination') {if(body.action==='quote') return {data:{quote:{id:'q',destination_address:body.address,price:9000,total_distance_km:12,total_duration_min:25}}};return {data:{ride:{id:'ride',status:'IN_PROGRESS',final_fare:9000,destination_address:'Nuevo destino',fare_change_quote:null}}};}
 throw new Error('Unexpected fixture invocation '+name);
}}};
