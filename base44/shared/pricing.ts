// Shared pricing + geo utilities for BearDrive backend functions.
// Distance uses Haversine with a road-network factor (1.3x) to approximate
// real road distance without an external routing API key. The structure
// allows swapping in Google Routes / Mapbox Directions later by replacing
// computeRoadDistance only.

const ROAD_FACTOR = 1.3;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function estimateRoadDistanceKm(lat1, lng1, lat2, lng2) {
  return haversineKm(lat1, lng1, lat2, lng2) * ROAD_FACTOR;
}

export function estimateDurationMin(distanceKm) {
  // Assume ~35 km/h average urban speed in Formosa
  return Math.max(3, Math.round((distanceKm / 35) * 60));
}

export function computeFare(distanceKm, durationMin, category, pricing) {
  let fare = pricing.base_fare + distanceKm * pricing.per_km + durationMin * pricing.per_min;
  if (category === "flash") {
    fare = fare + (pricing.flash_supplement || 0);
  } else if (category === "premium") {
    fare = fare * (pricing.premium_multiplier || 1.5);
  }
  fare = Math.max(fare, pricing.min_fare || 0);
  return Math.round(fare);
}

export function todayBusinessDay(date) {
  const d = date ? new Date(date) : new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}