// Inicialización de plugins nativos de Capacitor.
// Los nombres de módulo se construyen con concatenación para que Vite
// no pueda resolverlos estáticamente (los paquetes no están instalados
// en el entorno web). En el APK, donde sí lo están, los imports dinámicos
// se resuelven en runtime y los plugins se aplican normalmente.
export async function initNative() {
  let Capacitor;
  try {
    const coreMod = String("@capacitor" + "/core");
    const core = await import(/* @vite-ignore */ coreMod);
    Capacitor = core.default || core;
  } catch {
    return; // Capacitor no disponible (web) — no-op
  }

  if (!Capacitor?.isNativePlatform?.()) return;

  try {
    const sbMod = String("@capacitor" + "/status-bar");
    const { StatusBar, Style } = await import(/* @vite-ignore */ sbMod);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#181E2F" });
  } catch (e) {
    console.warn("[nativeSetup] StatusBar no disponible:", e);
  }

  try {
    const spMod = String("@capacitor" + "/splash-screen");
    const { SplashScreen } = await import(/* @vite-ignore */ spMod);
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn("[nativeSetup] SplashScreen no disponible:", e);
  }
}