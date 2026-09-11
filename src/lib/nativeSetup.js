// Inicialización de plugins nativos de Capacitor.
// En web (navegador) los plugins no hacen nada (no-op), así que esto es seguro
// tanto en el preview web como dentro del APK Android.
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#181E2F" });
  } catch (e) {
    console.warn("[nativeSetup] StatusBar no disponible:", e);
  }

  try {
    // Oculta la splash screen una vez que React terminó de montar
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn("[nativeSetup] SplashScreen no disponible:", e);
  }
}