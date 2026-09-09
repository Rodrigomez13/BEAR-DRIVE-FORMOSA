// Geo helpers using free OpenStreetMap Nominatim (no API key needed).
const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function searchPlaces(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(
      `${NOMINATIM}/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ar&accept-language=es`,
      { headers: { "Accept": "application/json" } }
    );
    const data = await res.json();
    return data.map((r) => ({
      label: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es`
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no disponible"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export const FORMOSA_CENTER = { lat: -26.1849, lng: -58.1731 };