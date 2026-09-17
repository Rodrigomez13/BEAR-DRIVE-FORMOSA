import test from 'node:test';
import assert from 'node:assert/strict';
import { observeRide } from '../src/services/observe-ride.js';
const tick = () => new Promise(resolve => setImmediate(resolve));

test('ride events invalidate snapshots; reconnect reconciles and dispose stops delivery', async () => {
  const events = new EventTarget();
  let receive;
  let reads = 0;
  let removed = false;
  const updates = [];
  const stop = observeRide({ id: 'ride', events, documentEvents: events,
    get: async () => ({ id: 'ride', status: ++reads === 1 ? 'SEARCHING' : 'DRIVER_APPROACHING' }),
    subscribe: callback => { receive = callback; return () => { removed = true; }; },
    onUpdate: ride => updates.push(ride),
  });
  await tick();
  receive({ data: { id: 'other', status: 'COMPLETED' } });
  assert.equal(reads, 1);
  receive({ data: { id: 'ride', status: 'COMPLETED' } });
  await tick();
  assert.equal(updates.at(-1).status, 'DRIVER_APPROACHING');
  events.dispatchEvent(new Event('online'));
  await tick();
  assert.equal(reads, 3);
  stop();
  events.dispatchEvent(new Event('online'));
  assert.equal(reads, 3);
  assert.equal(removed, true);
});

test('invalidation during an in-flight read discards the obsolete snapshot', async () => {
  const events = new EventTarget();
  let resolve;
  let receive;
  let reads = 0;
  const updates = [];
  const stop = observeRide({ id: 'ride', events, documentEvents: events,
    get: () => ++reads === 1 ? new Promise(r => { resolve = r; }) : Promise.resolve({ id: 'ride', version: 2 }),
    subscribe: callback => { receive = callback; return () => {}; },
    onUpdate: ride => updates.push(ride),
  });
  receive({ data: { id: 'ride' } });
  resolve({ id: 'ride', version: 1 });
  await tick();
  assert.deepEqual(updates.map(r => r.version), [2]);
  stop();
});
