// Local LRU cache for Google Maps Directions API results.
// Avoids redundant route requests for frequent trips within Formosa by
// reusing previously computed routes (polyline + steps + distance/duration).

const CACHE_PREFIX = "beardrive_route_";
const CACHE_INDEX_KEY = "beardrive_route_index";
const TTL_MS = 30 * 60 * 1000; // 30 minutes — routes rarely change in that window
const MAX_ENTRIES = 50;

// ~11m precision (4 decimal places). Enough to match frequent OD pairs in a
// single city without missing cache hits due to tiny coordinate drift.
function roundCoord(value) {
  return Math.round(value * 10000) / 10000;
}

function makeKey(origin, destination) {
  const o = `${roundCoord(origin.lat)},${roundCoord(origin.lng)}`;
  const d = `${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
  return `${o}|${d}`;
}

function readIndex() {
  try {
    const raw = localStorage.getItem(CACHE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIndex(keys) {
  try {
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keys));
  } catch {
    // storage full or unavailable — non-fatal
  }
}

/**
 * Returns cached route data ({ fullPath, steps, routePolyline, routeInfo })
 * for the given origin/destination pair, or null on miss / expiry.
 */
export function getCachedRoute(origin, destination) {
  if (!origin || !destination) return null;
  const key = makeKey(origin, destination);
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      writeIndex(readIndex().filter((k) => k !== key));
      return null;
    }
    // LRU: move key to the back (most-recently-used).
    const keys = readIndex().filter((k) => k !== key);
    keys.push(key);
    writeIndex(keys);
    return entry.data;
  } catch {
    return null;
  }
}

/**
 * Stores route data for the given origin/destination pair.
 * Evicts the oldest entries when the cache exceeds MAX_ENTRIES.
 */
export function setCachedRoute(origin, destination, data) {
  if (!origin || !destination || !data) return;
  const key = makeKey(origin, destination);
  const payload = JSON.stringify({ data, timestamp: Date.now() });
  try {
    localStorage.setItem(CACHE_PREFIX + key, payload);
  } catch {
    // Storage full — evict the oldest quarter and retry once.
    try {
      let keys = readIndex();
      const evictCount = Math.max(1, Math.ceil(keys.length / 4));
      for (let i = 0; i < evictCount && keys.length > 0; i++) {
        const oldest = keys.shift();
        localStorage.removeItem(CACHE_PREFIX + oldest);
      }
      writeIndex(keys);
      localStorage.setItem(CACHE_PREFIX + key, payload);
    } catch {
      return; // give up silently — caching is best-effort
    }
  }

  let keys = readIndex().filter((k) => k !== key);
  keys.push(key);
  while (keys.length > MAX_ENTRIES) {
    const oldest = keys.shift();
    try {
      localStorage.removeItem(CACHE_PREFIX + oldest);
    } catch {
      // ignore
    }
  }
  writeIndex(keys);
}

/** Clears all cached routes (useful for debugging or manual reset). */
export function clearRouteCache() {
  try {
    const keys = readIndex();
    keys.forEach((k) => localStorage.removeItem(CACHE_PREFIX + k));
    localStorage.removeItem(CACHE_INDEX_KEY);
  } catch {
    // ignore
  }
}