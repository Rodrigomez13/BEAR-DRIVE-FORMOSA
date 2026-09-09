import { onMapsSDKReady } from "./mapsConfig";

export const FORMOSA_CENTER = { lat: -26.1849, lng: -58.1731 };

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
    if (!predictions.length) return [];
    const geocoder = new g.maps.Geocoder();
    const results = await Promise.all(
      predictions.slice(0, 5).map((p) =>
        new Promise((resolve) => {
          geocoder.geocode({ placeId: p.place_id }, (res, status) => {
            if (status === g.maps.GeocoderStatus.OK && res && res[0]) {
              resolve({
                label: p.description,
                lat: res[0].geometry.location.lat(),
                lng: res[0].geometry.location.lng(),
              });
            } else {
              resolve(null);
            }
          });
        })
      )
    );
    return results.filter(Boolean);
  } catch {
    return [];
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