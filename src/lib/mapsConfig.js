import { base44 } from "@/api/base44Client";

let keyPromise = null;

export function getMapsApiKey() {
  if (!keyPromise) {
    keyPromise = base44.functions.invoke("getGoogleMapsKey")
      .then((res) => res.data?.apiKey)
      .catch(() => {
        keyPromise = null;
        return null;
      });
  }
  return keyPromise;
}

let sdkPromise = null;

// Loads the Google Maps JS API script directly with a JSONP callback.
// Resolves with window.google once the SDK is ready.
export function loadMapsSDK() {
  if (window.google && window.google.maps && window.google.maps.Map) {
    return Promise.resolve(window.google);
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = getMapsApiKey().then((apiKey) => {
    if (!apiKey) throw new Error("No se obtuvo la API key de Google Maps");

    return new Promise((resolve, reject) => {
      const callbackName = "__bearMapsInit_" + Date.now();
      const timeout = setTimeout(() => {
        delete window[callbackName];
        sdkPromise = null;
        reject(new Error("Timeout: el callback de Google Maps no respondió"));
      }, 15000);

      window[callbackName] = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        resolve(window.google);
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR&v=weekly&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        clearTimeout(timeout);
        delete window[callbackName];
        sdkPromise = null;
        reject(new Error("No se pudo cargar el script de Google Maps"));
      };
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