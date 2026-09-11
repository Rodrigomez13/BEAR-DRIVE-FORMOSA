// Inicialización de plugins nativos de Capacitor.
// Usa imports dinámicos con @vite-ignore para que el build web no falle
// cuando los paquetes nativos no están instalados. En el APK (donde sí lo están)
// los imports se resuelven en runtime y los plugins se aplican normalmente.
export async function initNative() {
  let Capacitor;
  try {
    Capacitor = await import(/* @vite-ignore */ "@capacitor/core");
  } catch {
    return; // Capacitor no disponible (web) — no-op
  }

  if (!Capacitor?.isNativePlatform?.()) return;

  try {
    const { StatusBar, Style } = await import(/* @vite-ignore */ "@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#181E2F" });
  } catch (e) {
    console.warn("[nativeSetup] StatusBar no disponible:", e);
  }

  try {
    const { SplashScreen } = await import(/* @vite-ignore */ "@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn("[nativeSetup] SplashScreen no disponible:", e);
  }
}