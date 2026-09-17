import { base44 } from "@/api/base44Client";

let keyPromise = null;

/**
 * Google Maps JavaScript/Places uses a client-visible key by design.
 * VITE_GOOGLE_MAPS_CLIENT_KEY must therefore be treated as PUBLIC and restricted
 * in Google Cloud to the allowed web origins / APIs.
 *
 * During the Base44 -> Supabase migration we keep getGoogleMapsKey as a fallback
 * so existing deployments continue to work. Server-only Google credentials must
 * never be exposed through VITE_* variables.
 */
export function getMapsApiKey() {
  if (keyPromise) return keyPromise;

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_CLIENT_KEY?.trim();
  if (envKey) {
    keyPromise = Promise.resolve(envKey);
    return keyPromise;
  }

  console.warn("[BearDrive Maps] VITE_GOOGLE_MAPS_CLIENT_KEY no está configurada; usando fallback temporal de Base44.");
  keyPromise = base44.functions.invoke("getGoogleMapsKey")
    .then((res) => {
      const key = res.data?.apiKey?.trim();
      if (!key) {
        throw new Error("El backend no devolvió una API key de Google Maps");
      }
      return key;
    })
    .catch((err) => {
      console.error("[BearDrive Maps] No se pudo obtener la API key:", err);
      keyPromise = null;
      throw err;
    });

  return keyPromise;
}

let sdkPromise = null;
let authFailureMessage = null;

export function resetSdkPromise() {
  sdkPromise = null;
  authFailureMessage = null;
}

window.gm_authFailure = () => {
  authFailureMessage = "Fallo de autenticación de Google Maps. Verificá la API key, las APIs habilitadas, sus restricciones y la facturación del proyecto de Google Cloud.";
  console.error("[BearDrive Maps] gm_authFailure:", authFailureMessage);
};

export function getAuthFailure() {
  return authFailureMessage;
}

export function resetAuthFailure() {
  authFailureMessage = null;
}

export function loadMapsSDK() {
  if (window.google?.maps?.Map) {
    return Promise.resolve(window.google);
  }
  if (sdkPromise) return sdkPromise;

  resetAuthFailure();

  sdkPromise = getMapsApiKey().then((apiKey) => {
    if (!apiKey) throw new Error("No se obtuvo la API key de Google Maps");

    return new Promise((resolve, reject) => {
      const callbackName = "__bearMapsInit_" + Date.now();
      const timeout = setTimeout(() => {
        delete window[callbackName];
        sdkPromise = null;
        reject(new Error("Google Maps no respondió en 8 segundos. Revisá red, CSP y restricciones de la API key."));
      }, 8000);

      window[callbackName] = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (authFailureMessage) {
          sdkPromise = null;
          reject(new Error(authFailureMessage));
          return;
        }
        resolve(window.google);
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&language=es&region=AR&v=weekly&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        sdkPromise = null;
        reject(new Error("No se pudo cargar Google Maps. Revisá la conexión y la política CSP."));
      };
      document.head.appendChild(script);
    });
  }).catch((err) => {
    sdkPromise = null;
    throw err;
  });

  return sdkPromise;
}

export function onMapsSDKReady() {
  return loadMapsSDK();
}