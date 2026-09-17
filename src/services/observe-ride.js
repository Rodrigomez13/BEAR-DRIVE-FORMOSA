/** Realtime is an invalidation signal. Only fetched snapshots reach the UI. */
export function observeRide({ id, get, subscribe, onUpdate, onError = () => {}, events = window, documentEvents = document, schedule = setTimeout, cancel = clearTimeout }) {
  let disposed = false;
  let running = false;
  let dirty = false;
  let retry;
  let attempts = 0;
  let unsubscribe = () => {};
  let subscribed = false;
  const refresh = async () => {
    if (disposed) return;
    if (running) { dirty = true; return; }
    running = true;
    try {
      if (!subscribed) {
        unsubscribe = subscribe(event => {
          if ((event.data?.id || event.id) === id) void refresh();
        });
        subscribed = true;
      }
      const ride = await get(id);
      if (!disposed && !dirty && ride) onUpdate(ride);
      attempts = 0;
    } catch (error) {
      if (!disposed) {
        onError(error);
        if (attempts < 4) {
          cancel(retry);
          retry = schedule(() => { void refresh(); }, 1000 * 2 ** attempts++);
        }
      }
    } finally {
      running = false;
      if (dirty && !disposed) { dirty = false; void refresh(); }
    }
  };
  const resume = () => { attempts = 0; void refresh(); };
  const visibility = () => { if (documentEvents.visibilityState === 'visible') resume(); };
  for (const name of ['online', 'focus', 'bear-app-resume', 'bear-payment-return']) events.addEventListener(name, resume);
  documentEvents.addEventListener('visibilitychange', visibility);
  void refresh();
  return () => {
    disposed = true;
    cancel(retry);
    unsubscribe();
    for (const name of ['online', 'focus', 'bear-app-resume', 'bear-payment-return']) events.removeEventListener(name, resume);
    documentEvents.removeEventListener('visibilitychange', visibility);
  };
}
