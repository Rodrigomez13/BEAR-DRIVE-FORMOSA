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

// Loads the Google Maps JS API script directly (no wrapper library).
// Resolves with window.google once the SDK is ready.
export function loadMapsSDK() {
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (sdkPromise) return sdkPromise;

  sdkPromise = getMapsApiKey().then((apiKey) => {
    if (!apiKey) throw new Error("No API key");
    return new Promise((resolve, reject) => {
      const callbackName = "bear_maps_init_cb_" + Date.now();
      window[callbackName] = () => {
        delete window[callbackName];
        resolve(window.google);
      };
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR&v=weekly&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window[callbackName];
        sdkPromise = null;
        reject(new Error("Failed to load Google Maps SDK"));
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