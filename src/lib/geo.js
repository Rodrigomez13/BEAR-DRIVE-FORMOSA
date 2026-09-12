import { Capacitor, registerPlugin } from "@capacitor/core";
import { onMapsSDKReady, getMapsApiKey } from "./mapsConfig";

const Geolocation = registerPlugin("Geolocation");

export const FORMOSA_CENTER = { lat: -26.1849, lng: -58.1731 };

const DEFAULT_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 2000,
};

// Posiciones con exactitud peor a este umbral (metros) se descartan para navegación.
export const NAVIGATION_ACCURACY_THRESHOLD = 50;

function formatAddressFromResult(result) {
  const comps = result.address_components || [];
  let street = "", number = "", city = "", neighborhood = "";
  for (const c of comps) {
    if (c.types.includes("route")) street = c.short_name || c.long_name;
    if (c.types.includes("street_number")) number = c.long_name;
    if (c.types.includes("locality")) {
      if (!/^[A-Z]\d{4}/.test(c.long_name)) city = c.long_name;
    }
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

export const FORMOSA_POIS = [
  { name: "Plaza San Martín", address: "Av. 25 de Mayo y Fontana", lat: -26.1849, lng: -58.1731, category: "Plaza Central" },
  { name: "Costanera Vuelta Fermosa", address: "Av. Costanera y San Martín", lat: -26.1772, lng: -58.1635, category: "Paseo Costero" },
  { name: "Terminal de Ómnibus", address: "Av. Gutnisky 4200", lat: -26.1965, lng: -58.1990, category: "Transporte" },
  { name: "Aeropuerto El Pucú (FMA)", address: "Ruta Nacional 11 Km 1167", lat: -26.2132, lng: -58.2284, category: "Aeropuerto" },
  { name: "UNaF (Universidad Nacional)", address: "Av. Gutnisky 3200", lat: -26.1910, lng: -58.2050, category: "Educación" },
  { name: "Hospital Central de Formosa", address: "Mitre y Salta", lat: -26.1812, lng: -58.1802, category: "Salud" },
  { name: "Peatonal Rivadavia", address: "Rivadavia 450", lat: -26.1833, lng: -58.1710, category: "Centro Comercial" },
  { name: "Estadio Cincuentenario", address: "Av. Néstor Kirchner y Colombia", lat: -26.1730, lng: -58.1890, category: "Deportes y Eventos" },
  { name: "La Cruz del Norte", address: "Acceso Sur y Ruta 11", lat: -26.2215, lng: -58.2130, category: "Monumento / Acceso" },
];

export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];
  const qNorm = query.trim().toLowerCase();

  // Local POIs match first for instant Formosa reference
  const matchingPois = FORMOSA_POIS.filter(
    (p) =>
      p.name.toLowerCase().includes(qNorm) ||
      p.address.toLowerCase().includes(qNorm) ||
      p.category.toLowerCase().includes(qNorm)
  ).map((p) => ({
    place_id: `poi_${p.name.replace(/\s+/g, "_")}`,
    label: `${p.name} (${p.address})`,
    main_text: p.name,
    secondary_text: `${p.category} · ${p.address}, Formosa`,
    location: { lat: p.lat, lng: p.lng, label: `${p.name}, ${p.address}` },
    is_poi: true,
  }));

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
    const googleResults = predictions.slice(0, 5).map((p) => ({
      place_id: p.place_id,
      label: p.description,
      main_text: p.structured_formatting?.main_text || (p.description || "").split(",")[0],
      secondary_text: p.structured_formatting?.secondary_text || "",
    }));

    return [...matchingPois, ...googleResults];
  } catch {
    return matchingPois;
  }
}

export async function geocodePlace(placeId, directLocation = null) {
  if (directLocation && directLocation.lat && directLocation.lng) {
    return directLocation;
  }
  if (placeId && placeId.startsWith("poi_")) {
    const poi = FORMOSA_POIS.find((p) => `poi_${p.name.replace(/\s+/g, "_")}` === placeId);
    if (poi) {
      return { lat: poi.lat, lng: poi.lng, label: `${poi.name} (${poi.address})` };
    }
  }
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

export function isCoordinateLike(str) {
  if (!str) return false;
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(str.trim());
}

export function displayAddress(address, fallback = "Ubicación seleccionada") {
  if (!address || address.trim() === "" || isCoordinateLike(address)) return fallback;
  return address;
}

function geoError(message, cause) {
  const error = new Error(message);
  if (cause) error.cause = cause;
  return error;
}

function permissionGranted(status, requirePrecise = false) {
  if (!status) return false;
  if (requirePrecise) return status.location === "granted";
  return status.location === "granted" || status.coarseLocation === "granted";
}

export async function getLocationPermissionStatus() {
  if (!Capacitor.isNativePlatform()) {
    if (!navigator.geolocation) return { location: "denied", coarseLocation: "denied" };
    if (!navigator.permissions?.query) return { location: "prompt", coarseLocation: "prompt" };
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      return { location: status.state, coarseLocation: status.state };
    } catch {
      return { location: "prompt", coarseLocation: "prompt" };
    }
  }

  try {
    return await Geolocation.checkPermissions();
  } catch (err) {
    throw geoError("Los servicios de ubicación del dispositivo están desactivados.", err);
  }
}

export async function requestLocationPermission({ requirePrecise = false } = {}) {
  if (!Capacitor.isNativePlatform()) {
    await getCurrentPosition({ enableHighAccuracy: requirePrecise });
    return true;
  }

  let status;
  try {
    status = await Geolocation.checkPermissions();
  } catch (err) {
    throw geoError("Activá la ubicación del dispositivo para continuar.", err);
  }

  if (!permissionGranted(status, requirePrecise)) {
    try {
      status = await Geolocation.requestPermissions({ permissions: ["location"] });
    } catch (err) {
      throw geoError("No se pudo solicitar el permiso de ubicación.", err);
    }
  }

  if (!permissionGranted(status, requirePrecise)) {
    throw geoError(
      requirePrecise
        ? "BearDrive necesita ubicación precisa para el modo conductor. Habilitala desde los permisos de la aplicación."
        : "El permiso de ubicación fue denegado. Podés habilitarlo desde los permisos de BearDrive."
    );
  }

  return true;
}

export async function getCurrentPosition(options = {}) {
  const positionOptions = { ...DEFAULT_POSITION_OPTIONS, ...options };

  if (Capacitor.isNativePlatform()) {
    await requestLocationPermission({ requirePrecise: Boolean(positionOptions.enableHighAccuracy) });
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: positionOptions.enableHighAccuracy,
        timeout: positionOptions.timeout,
        maximumAge: positionOptions.maximumAge,
        enableLocationFallback: true,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      };
    } catch (err) {
      throw geoError("No pudimos obtener tu ubicación actual.", err);
    }
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(geoError("Geolocalización no disponible en este dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      }),
      (err) => reject(geoError("No pudimos obtener tu ubicación actual.", err)),
      positionOptions
    );
  });
}

export async function watchCurrentPosition(callback, options = {}) {
  const positionOptions = { ...DEFAULT_POSITION_OPTIONS, maximumAge: 2000, ...options };

  if (Capacitor.isNativePlatform()) {
    await requestLocationPermission({ requirePrecise: Boolean(positionOptions.enableHighAccuracy) });
    const id = await Geolocation.watchPosition(
      {
        enableHighAccuracy: positionOptions.enableHighAccuracy,
        timeout: positionOptions.timeout,
        maximumAge: positionOptions.maximumAge,
        minimumUpdateInterval: options.minimumUpdateInterval ?? 3000,
        enableLocationFallback: true,
      },
      (pos, err) => {
        if (err) {
          callback(null, geoError("Se perdió temporalmente la ubicación del dispositivo.", err));
          return;
        }
        if (!pos) return;
        callback({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        }, null);
      }
    );
    return { platform: "native", id };
  }

  if (!navigator.geolocation) {
    throw geoError("Geolocalización no disponible en este dispositivo.");
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => callback({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    }, null),
    (err) => callback(null, geoError("Se perdió temporalmente la ubicación del dispositivo.", err)),
    positionOptions
  );
  return { platform: "web", id };
}

export async function clearPositionWatch(handle) {
  if (!handle) return;
  if (handle.platform === "native") {
    await Geolocation.clearWatch({ id: handle.id });
    return;
  }
  navigator.geolocation?.clearWatch(handle.id);
}