/// <reference types="vite/client" />
/// <reference types="google.maps" />
interface Window {
  gm_authFailure?: () => void;
  webkitAudioContext?: typeof AudioContext;
}
