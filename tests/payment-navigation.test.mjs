import test from 'node:test';
import assert from 'node:assert/strict';
import { openPayment, validatePaymentUrl } from '../src/lib/payment-navigation.js';

const checkout = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test';
test('payment navigation rejects non-HTTPS, credentials and lookalike hosts', () => {
  assert.equal(validatePaymentUrl(checkout), checkout);
  for (const url of ['javascript:alert(1)', 'http://www.mercadopago.com.ar/', 'https://www.mercadopago.com.ar.evil.test/', 'https://user:pass@www.mercadopago.com.ar/']) assert.throws(() => validatePaymentUrl(url));
});
test('embedded checkout reserves an external window before awaiting the backend', async t => {
  const previous = globalThis.window; t.after(()=>{globalThis.window=previous;});
  let reserved=false, destination;
  const popup = {opener:{},closed:false,location:{replace:value=>{destination=value;}},close:()=>{}};
  globalThis.window={self:{},top:{},open:()=>{reserved=true;return popup;}};
  await openPayment(async()=>{assert.equal(reserved,true);return checkout;});
  assert.equal(destination,checkout);assert.equal(popup.opener,null);
});
test('blocked popup prevents creating a checkout',async t=>{
  const previous=globalThis.window;t.after(()=>{globalThis.window=previous;});
  globalThis.window={self:{},top:{},open:()=>null};
  let invoked=false;
  await assert.rejects(openPayment(async()=>{invoked=true;return checkout;}),/ventanas emergentes/);
  assert.equal(invoked,false);
});
test('backend error closes the reserved window',async t=>{
  const previous=globalThis.window;t.after(()=>{globalThis.window=previous;});
  let closed=false;
  globalThis.window={self:{},top:{},open:()=>({close:()=>{closed=true;}})};
  await assert.rejects(openPayment(async()=>{throw new Error('backend failed');}),/backend failed/);
  assert.equal(closed,true);
});
