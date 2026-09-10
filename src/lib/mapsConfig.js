import { base44 } from "@/api/base44Client";

let keyPromise = null;

export function getMapsApiKey() {
  if (!keyPromise) {
    console.log("[BearDrive Maps] Solicitando API key al backend...");
    keyPromise = base44.functions.invoke("getGoogleMapsKey")
      .then((res) => {
        const key = res.data?.apiKey;
        if (!key) {
          console.error("[BearDrive Maps] El backend no devolvió una API key. Response:", res);
          return null;
        }
        console.log("[BearDrive Maps] API key obtenida:", key.substring(0, 8) + "..." + key.substring(key.length - 4));
        return key;
      })
      .catch((err) => {
        console.error("[BearDrive Maps] Error al obtener la API key:", err);
        keyPromise = null;
        return null;
      });
  }
  return keyPromise;
}

let sdkPromise = null;
let authFailureMessage = null;

// Google Maps JS API llama a esta función global cuando la autenticación falla
// (API key inválida, billing deshabilitado, o API no habilitada)
window.gm_authFailure = () => {
  authFailureMessage = "Fallo de autenticación de Google Maps. Verificá que la API key sea válida, que Maps JavaScript API esté habilitada y que la facturación esté activa en Google Cloud Console.";
  console.error("[BearDrive Maps] gm_authFailure:", authFailureMessage);
};

export function getAuthFailure() {
  return authFailureMessage;
}

export function resetAuthFailure() {
  authFailureMessage = null;
}

// Loads the Google Maps JS API script directly with a JSONP callback.
// Resolves with window.google once the SDK is ready.
export function loadMapsSDK() {
  if (window.google && window.google.maps && window.google.maps.Map) {
    console.log("[BearDrive Maps] SDK ya estaba cargado");
    return Promise.resolve(window.google);
  }
  if (sdkPromise) return sdkPromise;

  console.log("[BearDrive Maps] Iniciando carga del SDK...");
  resetAuthFailure();

  sdkPromise = getMapsApiKey().then((apiKey) => {
    if (!apiKey) throw new Error("No se obtuvo la API key de Google Maps");

    return new Promise((resolve, reject) => {
      const callbackName = "__bearMapsInit_" + Date.now();
      const timeout = setTimeout(() => {
        delete window[callbackName];
        sdkPromise = null;
        console.error("[BearDrive Maps] Timeout: el callback no respondió en 15s");
        reject(new Error("Timeout: el callback de Google Maps no respondió. Posible bloqueo de red o CSP."));
      }, 15000);

      window[callbackName] = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        if (authFailureMessage) {
          console.error("[BearDrive Maps] SDK cargó pero con fallo de autenticación");
          reject(new Error(authFailureMessage));
          return;
        }
        console.log("[BearDrive Maps] SDK cargado correctamente, google.maps disponible");
        resolve(window.google);
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR&v=weekly&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => {
        clearTimeout(timeout);
        delete window[callbackName];
        sdkPromise = null;
        console.error("[BearDrive Maps] Error de red al cargar el script:", e);
        reject(new Error("No se pudo cargar el script de Google Maps (error de red o CSP)."));
      };
      console.log("[BearDrive Maps] Inyectando script de Google Maps...");
      document.head.appendChild(script);
    });
  }).catch((err) => {
    sdkPromise = null;
    throw err;
  });

  return sdkPromise;
}

// Backwards-compatible: loads the SDK if needed, then resolves with window.google
export function onMapsSDKReady() {
  return loadMapsSDK();
}