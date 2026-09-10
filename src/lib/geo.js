import { onMapsSDKReady } from "./mapsConfig";

export const FORMOSA_CENTER = { lat: -26.1849, lng: -58.1731 };

// Returns predictions instantly (no geocoding) for fast autocomplete display
export async function searchPlaces(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const g = await onMapsSDKReady();
    const autoService = new g.maps.places.AutocompleteService();
    const predictions = await new Promise((resolve) => {
      autoService.getPlacePredictions(
        { input: query, componentRestrictions: { country: "ar" }, language: "es" },
        (res, status) => {
          if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
          else resolve([]);
        }
      );
    });
    return predictions.slice(0, 5).map((p) => ({
      place_id: p.place_id,
      label: p.description,
    }));
  } catch {
    return [];
  }
}

// Geocodes a single selected place by place_id — called only on selection
export async function geocodePlace(placeId) {
  try {
    const g = await onMapsSDKReady();
    const geocoder = new g.maps.Geocoder();
    const result = await new Promise((resolve) => {
      geocoder.geocode({ placeId }, (res, status) => {
        if (status === g.maps.GeocoderStatus.OK && res && res[0]) {
          resolve({
            lat: res[0].geometry.location.lat(),
            lng: res[0].geometry.location.lng(),
            label: res[0].formatted_address,
          });
        } else resolve(null);
      });
    });
    return result;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const g = await onMapsSDKReady();
    const geocoder = new g.maps.Geocoder();
    const result = await new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (res, status) => {
        if (status === g.maps.GeocoderStatus.OK && res && res[0]) resolve(res[0].formatted_address);
        else resolve(null);
      });
    });
    return result || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
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