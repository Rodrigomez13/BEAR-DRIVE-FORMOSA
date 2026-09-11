// Inicialización de plugins nativos de Capacitor.
// En web (navegador) los plugins no hacen nada (no-op), así que esto es seguro
// tanto en el preview web como dentro del APK Android.
import { Capacitor, registerPlugin } from "@capacitor/core";

const StatusBar = registerPlugin("StatusBar");
const SplashScreen = registerPlugin("SplashScreen");

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // El WebView queda debajo de las barras del sistema para evitar que contenido,
    // botones o mapas queden ocultos bajo la barra de estado en distintos equipos.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: "LIGHT" });
    await StatusBar.setBackgroundColor({ color: "#181E2F" });
  } catch (e) {
    console.warn("[nativeSetup] StatusBar no disponible:", e);
  }

  try {
    // Oculta la splash screen una vez que React terminó de montar.
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (e) {
    console.warn("[nativeSetup] SplashScreen no disponible:", e);
  }
}