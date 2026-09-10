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

export function onMapsSDKReady() {
  if (window.google && window.google.maps) return Promise.resolve(window.google);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve) => {
      const check = () => {
        if (window.google && window.google.maps) resolve(window.google);
        else setTimeout(check, 150);
      };
      check();
    });
  }
  return sdkPromise;
}