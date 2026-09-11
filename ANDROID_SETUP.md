# BearDrive - Formosa · Guía de build Android (APK) con Capacitor

Este proyecto está preparado para compilarse como app nativa Android usando **Capacitor 6**.
El frontend se construye con Vite y se empaqueta dentro de un proyecto Android que generás con Android Studio.

---

## 1. Requisitos previos

- **Node.js 18+** y npm.
- **Android Studio** (descargar de https://developer.android.com/studio).
- **JDK 17** (Android Studio lo incluye; si lo instalás aparte, configurá `JAVA_HOME`).
- Un dispositivo físico o un emulador AVD (API 24+ recomendado).

Verificá que Android Studio tenga instalado el **Android SDK Platform** y **SDK Build-Tools** desde *Tools → SDK Manager*.

---

## 2. Paquetes ya instalados en este proyecto

```
@capacitor/core
@capacitor/cli
@capacitor/android
@capacitor/geolocation   (GPS / permisos de ubicación)
@capacitor/status-bar     (barra de estado oscura)
@capacitor/splash-screen  (pantalla de inicio)
@capacitor/app            (ciclo de vida nativo)
@capacitor/keyboard       (teclado nativo)
@capacitor/preferences    (almacenamiento nativo)
```

La configuración vive en `capacitor.config.json`:
- `appId`: `com.beardrive.formosa` (identificador único del paquete Android).
- `appName`: `BearDrive - Formosa`.
- `webDir`: `dist` (salida de `vite build`).
- `androidScheme: https` → origen `https://localhost` (contexto seguro, necesario para Geolocation y Google Maps).
- StatusBar y SplashScreen con el color Navy de la marca (`#181E2F`).

`vite.config.js` ya tiene `base: './'` para que los assets carguen con rutas relativas dentro del WebView.

---

## 3. Generar el proyecto Android (una sola vez)

Desde la raíz del proyecto:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
```

Esto crea la carpeta `android/` con el proyecto nativo. **No la borres**; es la que abrírs en Android Studio.

> Si modificás `capacitor.config.json` después de crear `android/`, ejecutá `npx cap sync android` para aplicar los cambios.

---

## 4. Compilar el APK

### Opción A — Desde Android Studio (recomendado para probar)

```bash
npx cap open android
```

Se abre Android Studio. Luego:
1. Esperá a que termine *Gradle Sync*.
2. Menú **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Cuando termine, hacé clic en *locate* para encontrar el archivo:
   `android/app/build/outputs/apk/debug/app-debug.apk`

Instalá ese APK en un dispositivo (copiándolo o con `adb install app-debug.apk`).

### Opción B — Por línea de comandos

```bash
# APK de debug (para pruebas, firmado con clave de debug)
npx cap sync android
cd android
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# APK de release (requiere configurar firma, ver sección 6)
./gradlew assembleRelease
```

---

## 5. Permisos Android

El plugin `@capacitor/geolocation` ya agrega automáticamente al `AndroidManifest.xml`:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

La app usa Google Maps y GPS, por lo que esos permisos son obligatorios. No hace falta editarlos a mano.

Si en el futuro necesitás más permisos (cámara, notificaciones push, etc.), agregalos en `android/app/src/main/AndroidManifest.xml`.

---

## 6. Firmar el APK de release (para distribución)

Para distribuir el APK fuera de Google Play necesitás firmarlo con una keystore propia:

1. Generá una keystore (una sola vez):
   ```bash
   keytool -genkey -v -keystore beardrive.keystore -alias beardrive -keyalg RSA -keysize 2048 -validity 10000
   ```
   Guardá este archivo y las contraseñas en un lugar seguro.

2. En `android/app/build.gradle`, dentro de `android { ... }`, agregá:
   ```gradle
   signingConfigs {
     release {
       storeFile file('../../beardrive.keystore')
       storePassword 'TU_STORE_PASSWORD'
       keyAlias 'beardrive'
       keyPassword 'TU_KEY_PASSWORD'
     }
   }
   buildTypes {
     release {
       signingConfig signingConfigs.release
       minifyEnabled false
       proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
     }
   }
   ```
   Colocá el archivo `beardrive.keystore` en la raíz del proyecto (o ajustá la ruta).

3. Compilá:
   ```bash
   cd android && ./gradlew assembleRelease
   ```
   → `android/app/build/outputs/apk/release/app-release.apk`

---

## 7. Flujo de trabajo tras cambios en el código

Cada vez que cambies el frontend:

```bash
npm run build
npx cap sync android
npx cap open android   # o ./gradlew assembleDebug desde android/
```

El script helper `npm run android` hace build + sync + abre Android Studio:

```bash
npm run android
```

---

## 8. Notas importantes

- **Google Maps**: la API key configurada en Base44 (`GOOGLE_MAPS_API_KEY`) se obtiene desde el backend (`getGoogleMapsKey`). La app la pide en runtime, así que el APK necesita conexión a internet para mostrar el mapa. Asegurate de que la key tenga habilitada *Maps JavaScript API*, *Places API* y *Geocoding API* y que no tenga restricciones que bloqueen el origen `https://localhost`.
- **Geolocalización**: el WebView usa el esquema `https://localhost` (contexto seguro), por lo que `navigator.geolocation` funciona y dispara el diálogo nativo de permiso de Android.
- **Stripe / pagos**: Stripe Checkout abre una página externa. Si los pagos con tarjeta fallan dentro del WebView, integrá `@capacitor/browser` para abrir el checkout en el navegador del sistema. Hoy el checkout ya bloquea ejecución dentro de un iframe; en Capacitor no es iframe, pero conviene probarlo.
- **Backend**: las funciones, entidades y autenticación siguen alojadas en Base44. El APK solo empaqueta el frontend; las llamadas a la API de Base44 funcionan igual que en la web (requieren internet).
- **No subas la carpeta `android/` al repo** salvo que quieras versionarla; suele ignorarse con `.gitignore` y regenerarse con `npx cap add android`.

---

## 9. Generar un AAB para Google Play (opcional)

Si querés publicar en Google Play Store, generá un Android App Bundle:

```bash
cd android && ./gradlew bundleRelease
```
→ `android/app/build/outputs/bundle/release/app-release.aab`

> Base44 también ofrece build nativo AAB desde *Publish → Mobile app* (plan Builder+). Esta guía de Capacitor es para generar el APK vos mismo.