# BearDrive Formosa — Android con Capacitor 8

El proyecto android/ está versionado. No lo regeneres con cap add android.
Trabajá en feat/mobile-functional-mvp y conservá las personalizaciones nativas.

## Entorno

- Node.js 22 o superior compatible con Vite instalado.
- Android Studio actualizado, SDK Android 36 y JDK 21.
- JAVA_HOME apuntando al JDK; android/local.properties apuntando al SDK.
- Instalá dependencias con npm ci.

Comprobá node --version y java -version desde la terminal que usará Gradle.

## Configuración del APK

Copiá .env.example a .env.local solamente si este último no existe. Completá:

- VITE_BASE44_APP_ID: identificador de la aplicación Base44.
- VITE_BASE44_APP_BASE_URL: URL real de la aplicación publicada.
- VITE_GOOGLE_MAPS_CLIENT_KEY: clave pública restringida de Maps JavaScript/Places.

Todo VITE_* es público y se empaqueta en el APK. Las claves privadas de pagos,
webhooks y servicios permanecen en backend. No uses una URL de Vite local como
backend del APK. Verificá autenticación y acceso desde el dispositivo.
Para desarrollo local con backend seguí README.md y base44 dev.
Un build que advierte que falta configuración Base44 no es un APK funcional.

## Verificar y generar APK de prueba

Desde la raíz, en PowerShell:

```powershell
npm run lint
npm run typecheck
npm run cap:sync
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location android
.\gradlew.bat assembleDebug
```

cap:sync construye el frontend y copia assets/configuración al proyecto nativo.
Repetilo después de cambiar frontend, plugins o capacitor.config.json.
APK: android/app/build/outputs/apk/debug/app-debug.apk.

La ruta de JDK anterior corresponde al equipo validado; ajustala en otros equipos.
En Android, el cliente Base44 usa VITE_BASE44_APP_BASE_URL como servidor de API,
porque el origen local del WebView no incluye el proxy de desarrollo de Vite.

## Ubicación y pruebas físicas

Los permisos coarse/fine están declarados en el Manifest. Usá src/lib/geo.js,
que solicita permisos mediante Capacitor en Android. La primera validación cubre
GPS en primer plano; no garantiza seguimiento en segundo plano.

Probá en dos dispositivos: login, permiso denegado/aproximado/preciso, búsqueda,
solicitud, aceptación, PIN, finalización, pago y recuperación al reconectar.
Verificá teclado, barras del sistema, botón Atrás y retorno desde el checkout.
Los pagos y la unicidad del cargo diario todavía requieren las correcciones
de dominio identificadas en la auditoría; compilar no valida esos comportamientos.

## Release

webContentsDebuggingEnabled está desactivado en la configuración fuente.
Sincronizá antes del build para aplicar este cambio al APK.
La firma release aún debe configurarse: guardá keystore y contraseñas fuera del
código y proporcioná secretos mediante entorno o propiedades locales ignoradas.
No escribas contraseñas en build.gradle. Conservá una copia segura de la clave.

Incrementá versionCode y actualizá versionName para cada distribución.
Con firma configurada, assembleRelease genera APK y bundleRelease genera AAB.
Antes de distribuir, verificá el artefacto firmado y el flujo en dispositivos.
