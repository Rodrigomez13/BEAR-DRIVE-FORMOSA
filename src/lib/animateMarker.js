// Interpolate only between observed positions; stop at the last known point.
export function animateMarker(marker, target, duration = 900) {
  if (!Number.isFinite(target?.lat) || !Number.isFinite(target?.lng)) return () => {};
  const start = marker.getPosition();
  if (!start || !marker.getVisible() || duration <= 0) {
    marker.setPosition(target);
    marker.setVisible(true);
    return () => {};
  }
  const lat = start.lat();
  const lng = start.lng();
  const started = performance.now();
  let frame;
  let cancelled = false;
  const tick = (now) => {
    if (cancelled) return;
    const t = Math.min(Math.max((now - started) / duration, 0), 1);
    marker.setPosition({ lat: lat + (target.lat - lat) * t, lng: lng + (target.lng - lng) * t });
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
}
