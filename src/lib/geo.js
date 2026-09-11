import { onMapsSDKReady, getMapsApiKey } from "./mapsConfig";

export const FORMOSA_CENTER = { lat: -26.1849, lng: -58.1731 };

// Parses Google address components into "Calle altura, Ciudad" format
function formatAddressFromResult(result) {
  const comps = result.address_components || [];
  let street = "", number = "", city = "", neighborhood = "";
  for (const c of comps) {
    if (c.types.includes("route")) street = c.short_name || c.long_name;
    if (c.types.includes("street_number")) number = c.long_name;
    if (c.types.includes("locality")) city = c.long_name;
    if (!city && c.types.includes("administrative_area_level_2")) city = c.long_name;
    if (!city && c.types.includes("administrative_area_level_3")) city = c.long_name;
    if (!city && c.types.includes("sublocality")) city = c.long_name;
    if (c.types.includes("neighborhood")) neighborhood = c.long_name;
  }
  const streetPart = street ? (number ? `${street} ${number}` : street) : (neighborhood || "");
  if (streetPart && city) return `${streetPart}, ${city}`;
  if (streetPart) return streetPart;
  if (city) return city;
  return result.formatted_address || "";
}

// Returns predictions instantly (no geocoding) for fast autocomplete display.
// Biased to Formosa area for relevant local results.
export async function searchPlaces(query) {
  if (!query || query.trim().length < 3) return [];
  try {
    const g = await onMapsSDKReady();
    const autoService = new g.maps.places.AutocompleteService();
    const predictions = await new Promise((resolve) => {
      autoService.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "ar" },
          language: "es",
          origin: FORMOSA_CENTER,
          location: new g.maps.LatLng(FORMOSA_CENTER.lat, FORMOSA_CENTER.lng),
          radius: 50000,
        },
        (res, status) => {
          if (status === g.maps.places.PlacesServiceStatus.OK && res) resolve(res);
          else resolve([]);
        }
      );
    });
    return predictions.slice(0, 5).map((p) => ({
      place_id: p.place_id,
      label: p.description,
      main_text: p.structured_formatting?.main_text || (p.description || "").split(",")[0],
      secondary_text: p.structured_formatting?.secondary_text || "",
    }));
  } catch {
    return [];
  }
}

// Resolves a selected place by place_id using Places Details API (same Places API
// that powers autocomplete predictions, so no extra Geocoding API enablement needed).
export async function geocodePlace(placeId) {
  try {
    const g = await onMapsSDKReady();
    const placesService = new g.maps.places.PlacesService(document.createElement("div"));
    const result = await new Promise((resolve) => {
      placesService.getDetails(
        { placeId, fields: ["geometry", "formatted_address", "address_components"] },
        (res, status) => {
          if (status === g.maps.places.PlacesServiceStatus.OK && res && res.geometry?.location) {
            resolve({
              lat: res.geometry.location.lat(),
              lng: res.geometry.location.lng(),
              label: formatAddressFromResult(res) || res.formatted_address,
            });
          } else resolve(null);
        }
      );
    });
    return result;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const apiKey = await getMapsApiKey();
    if (!apiKey) return "Ubicación seleccionada";
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}&language=es&region=AR`
    );
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      return formatAddressFromResult(data.results[0]) || data.results[0].formatted_address;
    }
    return "Ubicación seleccionada";
  } catch {
    return "Ubicación seleccionada";
  }
}

// Check if a string looks like raw coordinates (e.g. "-26.1849, -58.1731")
export function isCoordinateLike(str) {
  if (!str) return false;
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(str.trim());
}

// Format an address for display, with a fallback if it's empty or coordinate-like
export function displayAddress(address, fallback = "Ubicación seleccionada") {
  if (!address || address.trim() === "" || isCoordinateLike(address)) return fallback;
  return address;
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