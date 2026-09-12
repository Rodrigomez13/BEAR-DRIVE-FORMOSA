import test from 'node:test';
import assert from 'node:assert/strict';
import { animateMarker } from '../src/lib/animateMarker.js';

test('marker interpolates, cancels superseded frames and stops at the observed point', () => {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let queued;
  globalThis.requestAnimationFrame = callback => { queued = callback; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  let point = { lat: 0, lng: 0 };
  const marker = { getPosition: () => ({ lat: () => point.lat, lng: () => point.lng }), getVisible: () => true, setPosition: p => { point = p; } };
  try {
    const before = performance.now();
    const stop = animateMarker(marker, { lat: 10, lng: 20 }, 1000);
    queued(before + 500);
    assert.ok(point.lat > 4 && point.lat < 6);
    stop();
    const stopped = { ...point };
    queued(before + 2000);
    assert.deepEqual(point, stopped);
    animateMarker(marker, { lat: 12, lng: 24 }, 1000);
    queued(performance.now() + 2000);
    assert.deepEqual(point, { lat: 12, lng: 24 });
    animateMarker(marker, { lat: NaN, lng: 0 });
    assert.deepEqual(point, { lat: 12, lng: 24 });
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
