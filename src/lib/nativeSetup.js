// Inicialización de plugins nativos de Capacitor.
// En web (navegador) los plugins no hacen nada (no-op), así que esto es seguro
// tanto en el preview web como dentro del APK Android.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";

const StatusBar = registerPlugin("StatusBar");
const SplashScreen = registerPlugin("SplashScreen");

let initialized = false;

function resolveInitialTheme() {
  const stored = localStorage.getItem("bear_theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Updates the native status bar style to match the active theme.
// Called by ThemeContext on every theme change; safe to call on web (no-op).
export async function updateStatusBarStyle(theme) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const isDark = theme === "dark";
    await StatusBar.setStyle({ style: isDark ? "DARK" : "LIGHT" });
    await StatusBar.setBackgroundColor({ color: isDark ? "#0A0D14" : "#181E2F" });
  } catch (e) {
    console.warn("[nativeSetup] StatusBar no disponible:", e);
  }
}

export async function initNative() {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  document.documentElement.classList.add("native-app");
  document.querySelector('meta[name="viewport"]')?.setAttribute(
    "content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
  );

  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.minimizeApp();
  });

  try {
    await App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        window.dispatchEvent(new Event("bear-app-resume"));
        window.dispatchEvent(new Event("bear-payment-return"));
      }
    });
  } catch (error) {
    console.warn("[nativeSetup] No se pudo registrar el regreso a la app", error);
  }

  try {
    // El WebView queda debajo de las barras del sistema para evitar que contenido,
    // botones o mapas queden ocultos bajo la barra de estado en distintos equipos.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await updateStatusBarStyle(resolveInitialTheme());
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
