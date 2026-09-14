import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load the real handlers, replacing only the Deno SDK/runtime boundary.
const modules = new Map();
async function load(file) {
  const full = path.resolve(file);
  async function urlFor(filename) {
    if (modules.has(filename)) return modules.get(filename);
    let source = fs.readFileSync(filename, 'utf8')
      .replace(/import \{ createClientFromRequest \} from 'npm:[^']+';/g, 'const createClientFromRequest = req => { const f = globalThis.fixture; const id = req.headers.get("x-user"); return id ? {...f.client, auth:{me:async()=>f.db.User.find(u=>u.id===id)}} : f.client; };')
      .replace(/import \{ secrets \} from 'base44:runtime';/g, 'const secrets = {get: name => globalThis.fixture.secrets[name]};');
    for (const match of [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
      if (!match[1].startsWith('.')) continue;
      const url = await urlFor(path.resolve(path.dirname(filename), match[1]));
      source = source.replace(match[0], `from '${url}'`);
    }
    const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
    modules.set(filename, url);
    return url;
  }
  return import(await urlFor(full));
}
function matches(row, query) {
  return Object.entries(query).every(([key,value]) => {
    if (key === '$or') return value.some(q => matches(row,q));
    if (key === '$and') return value.every(q => matches(row,q));
    if (value === null) return row[key] == null;
    if (value && typeof value === 'object') {
      if ('$in' in value) return value.$in.includes(row[key]);
      if ('$gte' in value) return row[key] >= value.$gte;
    }
    return row[key] === value;
  });
}
function setup(seed = {}, userId = 'passenger') {
  const db = structuredClone(seed);
  db.User ||= [{id:'passenger'}, {id:'driver'}, {id:'driver2'}];
  const entities = new Proxy({}, { get: (_,name) => {
    db[name] ||= [];
    return {
      async get(id) { return structuredClone(db[name].find(r => r.id === id)); },
      async filter(query, sort, limit = 500, skip = 0) { return structuredClone(db[name].filter(r => matches(r,query)).slice(skip,skip+limit)); },
      async list(sort,limit=500) { return structuredClone(db[name].slice(0,limit)); },
      async create(data) { const row={id:`${name}-${db[name].length+1}`,created_date:new Date().toISOString(),...structuredClone(data)};db[name].push(row);return structuredClone(row); },
      async update(id,data) { const row=db[name].find(r=>r.id===id);assert.ok(row);Object.assign(row,structuredClone(data));return structuredClone(row); },
      async updateMany(query, update) {
        const rows=db[name].filter(r=>matches(r,query));
        rows.forEach(r=>Object.assign(r,structuredClone(update.$set)));
        return {updated:rows.length};
      },
    };
  }});
  const client={auth:{me:async()=>db.User.find(u=>u.id===userId)},asServiceRole:{entities}};
  globalThis.fixture={client,secrets:{},db};
  return db;
}
async function call(name, body, userId = '') {
  const handler=(await load(`base44/functions/${name}/entry.ts`)).default;
  const response=await handler(new Request('https://local.test',{method:'POST',headers:{'x-user':userId},body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const ride = overrides => ({id:'ride',passenger_id:'passenger',driver_id:'driver',status:'DRIVER_ARRIVED',start_pin:'1234',quoted_fare:8000,...overrides});
function driverSeed(extra = {}) {
  return {
    DriverApplication:[{id:'app',user_id:'driver',status:'APPROVED',reviewed_by:'admin'},{id:'app2',user_id:'driver2',status:'APPROVED',reviewed_by:'admin'}],
    Vehicle:[{id:'car',driver_id:'driver',status:'approved',year:2025,created_date:'2026-09-01',plate:'AA123BB'},{id:'car2',driver_id:'driver2',status:'approved',year:2025,created_date:'2026-09-01'}],
    DriverLocation:[{id:'loc',driver_id:'driver',vehicle_id:'car',online:true,lat:-26,lng:-58,updated_date:new Date().toISOString()},{id:'loc2',driver_id:'driver2',vehicle_id:'car2',online:true,lat:-26,lng:-58,updated_date:new Date().toISOString()}],
    DocumentRequirement:[{code:'license',required:true,enabled:true}],
    DriverDocument:[{driver_id:'driver',code:'license',status:'APPROVED',file_url:'file'},{driver_id:'driver2',code:'license',status:'APPROVED',file_url:'file'}],
    ...extra,
  };
}
test('generic transition rejects bypassing PIN and payment, for either participant',async()=>{
  for(const user of ['driver','passenger']) for(const [from,to] of [['DRIVER_ARRIVED','IN_PROGRESS'],['PAYMENT_PENDING','COMPLETED'],['SEARCHING','DRIVER_APPROACHING']]) {
    const db=setup({Ride:[ride({status:from})]},user);
    const response=await call('transitionRideStatus',{ride_id:'ride',target_status:to});
    assert.equal(response.status,403);assert.equal(db.Ride[0].status,from);
  }
});
test('arrival only allowed to assigned driver and conditional on current phase',async()=>{
  setup({Ride:[ride({status:'DRIVER_APPROACHING'})]},'driver');
  assert.equal((await call('transitionRideStatus',{ride_id:'ride',target_status:'DRIVER_ARRIVED'})).status,200);
  assert.equal((await call('transitionRideStatus',{ride_id:'ride',target_status:'DRIVER_ARRIVED'})).status,403);
});
test('PIN rate limit and correct PIN, with driver response redacted',async()=>{
  const db=setup({Ride:[ride()]},'driver');
  for(let i=0;i<5;i++) assert.equal((await call('validateRidePin',{ride_id:'ride',pin:'9999'})).status,400);
  assert.equal((await call('validateRidePin',{ride_id:'ride',pin:'1234'})).status,429);
  db.Ride[0].pin_locked_until=null;
  const result=await call('validateRidePin',{ride_id:'ride',pin:'1234'});
  assert.equal(result.status,200);assert.equal(result.data.ride.start_pin,undefined);assert.equal(db.Ride[0].status,'IN_PROGRESS');
});
test('create ignores forged fare and PIN; repeats same quote without duplicate ride',async()=>{
  const db=setup({RideQuote:[{id:'q',passenger_id:'passenger',price:8000,expires_at:new Date(Date.now()+60000).toISOString(),category:'basic'}]});
  const body={quote_id:'q',payment_method:'cash',quoted_fare:1,start_pin:'0000'};
  assert.equal((await call('createRide',body)).status,200);
  assert.equal((await call('createRide',body)).status,200);
  assert.equal(db.Ride.length,1);assert.equal(db.Ride[0].quoted_fare,8000);assert.notEqual(db.Ride[0].start_pin,'0000');
});
test('expired quote and another active ride prevent creation',async()=>{
  setup({RideQuote:[{id:'q',passenger_id:'passenger',expires_at:'2000-01-01'}]});
  assert.equal((await call('createRide',{quote_id:'q',payment_method:'cash'})).status,409);
  setup({Ride:[ride()],RideQuote:[{id:'q',passenger_id:'passenger',expires_at:'2099-01-01'}]});
  assert.equal((await call('createRide',{quote_id:'q',payment_method:'cash'})).status,409);
});
test('parallel create requests only create one ride',async()=>{
  const db=setup({RideQuote:[{id:'q',passenger_id:'passenger',price:8000,expires_at:'2099-01-01'}]});
  const response=await Promise.all([call('createRide',{quote_id:'q',payment_method:'cash'}),call('createRide',{quote_id:'q',payment_method:'cash'})]);
  assert.equal(db.Ride.length,1);assert.ok(response.some(r=>r.status===409));
});
test('completed and in-progress rides cannot be cancelled through passenger or driver endpoints',async()=>{
  for(const status of ['COMPLETED','IN_PROGRESS','PAYMENT_PENDING']) for(const [user,fn] of [['driver','driverCancelRide'],['passenger','passengerCancelRide']]) {
    const db=setup({Ride:[ride({status})]},user);
    assert.equal((await call(fn,{ride_id:'ride'})).status,409);assert.equal(db.Ride[0].status,status);
  }
});
test('search timeout never expires a newly restarted search or an accepted ride',async()=>{
  const db=setup({Ride:[ride({status:'SEARCHING',search_started_at:new Date().toISOString()})]});
  assert.equal((await call('timeoutSearchingRide',{ride_id:'ride'})).data.skipped,true);
  db.Ride[0].search_started_at=new Date(Date.now()-100000).toISOString();
  assert.equal((await call('timeoutSearchingRide',{ride_id:'ride'})).data.timed_out,true);
  db.Ride[0].status='DRIVER_APPROACHING';
  assert.equal((await call('timeoutSearchingRide',{ride_id:'ride'})).data.skipped,true);
});
test('first driver wins; vehicle details are loaded from server',async()=>{
  const db=setup(driverSeed({Ride:[ride({driver_id:null,status:'SEARCHING',origin_lat:-26,origin_lng:-58,payment_method:'cash',search_started_at:new Date().toISOString()})]}),'driver');
  const result=await call('acceptRide',{ride_id:'ride',vehicle_id:'car',vehicle_plate:'FORGED'});
  assert.equal(result.status,200);assert.equal(db.Ride[0].vehicle_plate,'AA123BB');assert.equal(result.data.ride.start_pin,undefined);
  globalThis.fixture.client.auth.me=async()=>db.User.find(u=>u.id==='driver2');
  assert.equal((await call('acceptRide',{ride_id:'ride',vehicle_id:'car2'})).status,409);
});
test('driver can reserve only one next ride; activation waits for completion',async()=>{
  const db=setup(driverSeed({Ride:[ride({id:'current',status:'IN_PROGRESS'}),ride({driver_id:null,status:'SEARCHING',origin_lat:-26,origin_lng:-58,payment_method:'cash',search_started_at:new Date().toISOString()})]}),'driver');
  const result=await call('acceptRide',{ride_id:'ride',vehicle_id:'car'});
  assert.equal(result.status,200);assert.equal(result.data.queued,true);assert.equal(db.Ride[1].status,'ASSIGNED');
  assert.equal((await call('activateQueuedRide',{ride_id:'ride'})).status,409);
  db.Ride[0].status='COMPLETED';
  assert.equal((await call('activateQueuedRide',{ride_id:'ride'})).status,200);
});
test('cash completion retry produces one daily charge and one points entry',async()=>{
  const db=setup({Ride:[ride({status:'PAYMENT_PENDING',payment_method:'cash'})],DailyChargeConfig:[{id:'daily-config',active:true,amount:5000,currency:'ARS'}]},'driver');
  assert.equal((await call('completeRide',{ride_id:'ride'})).status,200);
  assert.equal((await call('completeRide',{ride_id:'ride'})).status,200);
  assert.equal(db.DriverDailyCharge.length,1);assert.equal(db.DriverDailyCharge[0].amount,5000);assert.equal(db.BearPointsLedger.length,1);
});
test('Formosa business day and next-day 15h deadline',async()=>{
  const {businessDay,chargeDue,premiumEligible}=await load('base44/shared/domain.ts');
  assert.equal(businessDay('2026-09-15T02:59:59Z'),'2026-09-14');
  assert.equal(businessDay('2026-09-15T03:00:00Z'),'2026-09-15');
  assert.equal(chargeDue('2026-09-14'),'2026-09-15T18:00:00.000Z');
  assert.equal(premiumEligible({year:2023,created_date:'2026-09-14'}),true);
  assert.equal(premiumEligible({year:2022,created_date:'2026-09-14'}),false);
});
test('both roles blocked from new operations by unpaid passenger ride or overdue daily charge',async()=>{
  const {debtStatus}=await load('base44/shared/domain.ts');
  setup({DriverDailyCharge:[{driver_id:'passenger',status:'pending',business_day:'2020-01-01'}]});
  assert.equal((await debtStatus(globalThis.fixture.client,'passenger')).blocked,true);
  setup({Ride:[ride({status:'PAYMENT_PENDING'})]});
  assert.equal((await debtStatus(globalThis.fixture.client,'passenger')).blocked,true);
});
test('payment must match amount, currency, seller and immutable reference',async()=>{
  const {paymentMatches}=await load('base44/shared/payments.ts');
  const payment={status:'approved',currency_id:'ARS',transaction_amount:8000,collector_id:'seller',external_reference:'ride:ride'};
  assert.equal(paymentMatches(payment,ride(),'seller','ride'),true);
  for(const changes of [{currency_id:'USD'},{transaction_amount:1},{collector_id:'company'},{external_reference:'ride:other'},{status:'pending'}]) assert.equal(paymentMatches({...payment,...changes},ride(),'seller','ride'),false);
});
test('retry only returns a quote; no automatic new request or charge',async()=>{
  const db=setup({Ride:[ride({status:'NO_DRIVERS',search_radius_km:10})]});
  const result=await call('retryRideQuote',{ride_id:'ride'});
  assert.equal(result.status,200);assert.equal(result.data.quote.price,8400);assert.equal(result.data.quote.search_radius_km,15);assert.equal(db.Ride.length,1);
});
test('sensitive entity mutations and driver PIN reads are denied by schema',()=>{
  const schema=name=>JSON.parse(fs.readFileSync(`base44/entities/${name}.jsonc`,'utf8'));
  for(const name of ['Ride','DriverDailyCharge','PaymentAccount','RideQuote','Vehicle','DriverApplication']) {
    assert.equal(schema(name).rls.create,false);assert.equal(schema(name).rls.update,false);
  }
  assert.deepEqual(schema('Ride').properties.start_pin.rls.read,{'data.passenger_id':'{{user.id}}'});
  assert.equal(schema('PaymentAccount').rls.read,false);
});
test('simultaneous drivers get exactly one acceptance',async()=>{
  const db=setup(driverSeed({Ride:[ride({driver_id:null,status:'SEARCHING',origin_lat:-26,origin_lng:-58,payment_method:'cash',search_started_at:new Date().toISOString()})]}));
  const results=await Promise.all([call('acceptRide',{ride_id:'ride',vehicle_id:'car'},'driver'),call('acceptRide',{ride_id:'ride',vehicle_id:'car2'},'driver2')]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.ok(['driver','driver2'].includes(db.Ride[0].driver_id));
});
test('a third commitment and a mismatched Premium vehicle are rejected',async()=>{
  const db=setup(driverSeed({Ride:[ride({id:'current',status:'IN_PROGRESS'}),ride({id:'queued',status:'ASSIGNED'}),ride({driver_id:null,status:'SEARCHING',origin_lat:-26,origin_lng:-58,payment_method:'cash',search_started_at:new Date().toISOString()})]}),'driver');
  assert.equal((await call('acceptRide',{ride_id:'ride',vehicle_id:'car'})).status,409);
  db.Ride.splice(0,2);db.Vehicle[0].year=2010;db.Ride[0].category='premium';
  assert.equal((await call('acceptRide',{ride_id:'ride',vehicle_id:'car'})).status,403);
});
test('missing Routes configuration does not fall back to fabricated distance',async()=>{
  setup();
  const result=await call('calculateQuote',{origin_lat:-26,origin_lng:-58,destination_lat:-26.1,destination_lng:-58.1,category:'basic'});
  assert.equal(result.status,503);
});
test('destination change quote changes neither destination nor fare until confirmed',async()=>{
  const originalFetch=globalThis.fetch;
  const db=setup({Ride:[ride({status:'IN_PROGRESS',distance_km:10,duration_min:20,destination_lat:-26.1,destination_lng:-58.1,category:'basic'})],DriverLocation:[{driver_id:'driver',lat:-26,lng:-58,updated_date:new Date().toISOString()}],PricingConfig:[{active:true,base_fare:1000,per_km:100,per_min:10,min_fare:1000}]});
  globalThis.fixture.secrets.GOOGLE_ROUTES_API_KEY='test-only';
  globalThis.fetch=async()=>Response.json({routes:[{distanceMeters:5000,duration:'600s'}]});
  try {
    const result=await call('changeRideDestination',{ride_id:'ride',action:'quote',lat:-26.2,lng:-58.2,address:'Nuevo destino'});
    assert.equal(result.status,200);assert.equal(db.Ride[0].destination_lat,-26.1);assert.equal(db.Ride[0].final_fare,undefined);
    const accepted=await call('changeRideDestination',{ride_id:'ride',action:'confirm',quote_id:result.data.quote.id});
    assert.equal(accepted.status,200);assert.equal(db.Ride[0].destination_lat,-26.2);assert.equal(db.Ride[0].destination_revision,1);
    assert.equal((await call('changeRideDestination',{ride_id:'ride',action:'confirm',quote_id:result.data.quote.id})).status,409);
  } finally { globalThis.fetch=originalFetch; }
});
test('digital checkout uses driver token, reuses stored checkout and never company token',async()=>{
  const originalFetch=globalThis.fetch;
  const db=setup({Ride:[ride({status:'PAYMENT_PENDING',payment_method:'qr'})],PaymentAccount:[{id:'account',driver_id:'driver',access_token:'seller-token',seller_id:'seller',expires_at:'2099-01-01'}]});
  Object.assign(globalThis.fixture.secrets,{APP_PUBLIC_URL:'https://app.test',MP_WEBHOOK_URL:'https://api.test/hook',MERCADO_PAGO_ACCESS_TOKEN:'forbidden-company-token'});
  let requests=0;
  globalThis.fetch=async(url,options)=>{requests++;assert.equal(options.headers.Authorization,'Bearer seller-token');const body=JSON.parse(options.body);assert.equal(body.marketplace_fee,0);return Response.json({id:'preference',init_point:'https://mp.test/pay',collector_id:'seller'});};
  try {
    assert.equal((await call('createRidePayment',{ride_id:'ride'})).status,200);
    assert.equal((await call('createRidePayment',{ride_id:'ride'})).status,200);
    assert.equal(requests,1);assert.equal(db.Ride[0].status,'PAYMENT_PENDING');
  } finally {globalThis.fetch=originalFetch;}
});
test('Mercado Pago signature rejects unsigned, tampered and expired requests',async()=>{
  setup();globalThis.fixture.secrets.MP_WEBHOOK_SECRET='test-secret';
  const {verifyMP}=await load('base44/shared/payments.ts');
  const encoder=new TextEncoder();
  async function signed(timestamp) {
    const key=await crypto.subtle.importKey('raw',encoder.encode('test-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const hash=await crypto.subtle.sign('HMAC',key,encoder.encode(`id:123;request-id:request;ts:${timestamp};`));
    return { 'x-request-id':'request','x-signature':`ts=${timestamp},v1=${Buffer.from(hash).toString('hex')}` };
  }
  const url='https://local.test?data.id=123';
  assert.equal(await verifyMP(new Request(url)),false);
  const headers=await signed(Math.floor(Date.now()/1000));
  assert.equal(await verifyMP(new Request(url,{headers})),true);
  assert.equal(await verifyMP(new Request('https://local.test?data.id=999',{headers})),false);
  assert.equal(await verifyMP(new Request(url,{headers:await signed(1)})),false);
});

test('OAuth uses a supported lock and returns a PKCE URL without leaking secrets', async () => {
  const db=setup(driverSeed(), 'driver');
  Object.assign(fixture.secrets,{MP_CLIENT_ID:'123456',MP_CLIENT_SECRET:'private',MP_REDIRECT_URI:'https://example.test/callback'});
  const original=fixture.client.asServiceRole.entities;
  fixture.client.asServiceRole.entities=new Proxy(original,{get(target,name){
    if(name==='User') return {...target.User,updateMany:async()=>{throw new Error('Bulk user update not allowed');}};
    return target[name];
  }});
  const result=await call('connectDriverPayments',{});
  assert.equal(result.status,200);
  const url=new URL(result.data.url);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('state'),db.PaymentAccount[0].state);
  assert.equal(url.searchParams.get('code_challenge').length,43);
  assert.ok(!JSON.stringify(result.data).includes('private'));
  assert.equal(db.DriverApplication[0].operation_lock,null);
});

test('Payment account status exposes only the current driver metadata', async () => {
  setup({PaymentAccount:[{id:'a',driver_id:'driver',seller_id:'seller',access_token:'secret',refresh_token:'secret2',state:'secret3',verifier:'secret4',expires_at:'2099-01-01'},{id:'b',driver_id:'other',access_token:'other-secret'}]},'driver');
  const result=await call('getDriverPaymentAccount',{});
  assert.equal(result.status,200);
  assert.equal(result.data.account.status,'connected');
  assert.ok(!JSON.stringify(result.data).includes('secret'));
  assert.equal(result.data.account.id,'a');
});

test('Payments admin rejects non-admins and never returns OAuth credentials', async () => {
  setup({User:[{id:'admin',role:'admin'},{id:'driver',role:'user'}],PaymentAccount:[{id:'a',driver_id:'driver',access_token:'sensitive',verifier:'sensitive'}]},'driver');
  assert.equal((await call('adminPayments',{})).status,403);
  const result=await call('adminPayments',{},'admin');
  assert.equal(result.status,200);
  assert.ok(!JSON.stringify(result.data).includes('sensitive'));
  assert.equal((await call('adminPayments',{section:'User'},'admin')).status,400);
  assert.equal((await call('adminPayments',{page:-1},'admin')).status,400);
});

test('Callback rejects absent or malformed expiry before contacting Mercado Pago', async () => {
  setup({PaymentAccount:[{id:'a',state:'state',verifier:'verifier',state_expires_at:'invalid'}]});
  const handler=(await load('base44/functions/driverPaymentsCallback/entry.ts')).default;
  const response=await handler(new Request('https://example.test/callback?state=state&code=code'));
  assert.equal(response.status,400);
});
