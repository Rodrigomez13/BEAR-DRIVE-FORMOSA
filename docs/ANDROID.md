# BearDrive Android

Esta aplicación usa Capacitor 8: interfaz React empaquetada localmente en un
contenedor Android con plugins nativos. No es una reescritura en Kotlin/Compose.
El APK usa el backend publicado de Base44; requiere Internet.

## Compilar un APK de prueba

Requisitos: Node 22+, JDK 21, Android SDK 36 y Build Tools 36.0.0.

```sh
npm ci
npm run android:apk
```

El resultado queda en `android/app/build/outputs/apk/debug/app-debug.apk`.
En Windows también funciona el script (usa `gradlew.bat`). Configurá
`ANDROID_HOME` o abrí `android/` en Android Studio para configurar el SDK.
Para sincronizar sin compilar: `npm run android:sync`.

La app mantiene `com.beardrive.formosa`. Es un APK firmado con clave debug,
solo para pruebas. Una instalación previa con el mismo ID y otra firma
requiere desinstalar la anterior, perdiendo sus datos locales. Para Play Store
se necesita un AAB release firmado con la clave de publicación correspondiente.
Nunca versionar esa clave.

## Configuración pública

El script incorpora el ID de esta app Base44 si no se especifica otro.
No incorpora tokens de usuarios ni secretos. No permite functionsVersion=preview.
Para Google Maps configurá `VITE_GOOGLE_MAPS_CLIENT_KEY` en `.env.local`,
o como variable del repositorio en Actions. La clave es pública y debe tener
restricciones adecuadas para la WebView/origen utilizado; no basta con las
restricciones de una clave del SDK nativo de Maps.

## Cambios y comprobación en dispositivo

- Zoom de la página bloqueado desde WebSettings y viewport nativo; mapa conserva su zoom.
- Botón Atrás vuelve en el historial y minimiza desde la raíz.
- Plugin App instalado para los eventos de regreso desde otras aplicaciones.
- Íconos legacy/adaptativos y splash usan el oso-pin adjunto con márgenes seguros.
- Nuevos recursos optimizados para login, formularios y carga, sin deformación.
- El zoom del navegador web se conserva por accesibilidad.

Antes de distribución: comprobar en un Android real login por email, reinicio,
ubicación/permisos, mapas, teclado, Atrás, carga de documentos y regreso desde
pagos. Compilar no demuestra que esos flujos funcionen. Google OAuth y tracking
en segundo plano requieren trabajo adicional y no se validan con esta entrega.

GitHub Actions genera el mismo APK y lo conserva como artefacto descargable.
