# Android: instalar y distribuir BearDrive

## APK local

`npm run android:apk` genera `artifacts/BearDrive-prueba.apk` y su SHA-256.
Requiere JDK 21 y Android SDK. El paquete debug es
`com.beardrive.formosa.debug`; puede convivir con el release.
Este APK usa el backend alojado configurado en el proyecto: debug NO significa
Mercado Pago sandbox. Las funciones modificadas requieren publicación en Base44.

Para instalar, activar depuración USB, autorizar el equipo y comprobar
`adb devices`. Usar `adb -s SERIAL install -r artifacts/BearDrive-prueba.apk`.
Comprobar login, permisos GPS, mapa, teclado, botón atrás, rotación y retorno de
Mercado Pago. Ningún cobro se considera aprobado solo por volver del navegador.

## Google Play

Las pantallas de Google Admin / SAML administran identidad y apps corporativas;
no sustituyen una ficha de distribución en https://play.google.com/console.

1. Abrir la app en Play Console y comprobar su package name. El release actual
   usa `com.beardrive.formosa`; no cambiarlo si ya fue registrado con ese ID.
2. Crear o recuperar la clave de carga en Android Studio: Generate Signed Bundle
   / APK > Android App Bundle. Guardar la clave y su copia de seguridad fuera de Git.
3. Para compilaciones repetibles, crear `android/keystore.properties` (ignorado):

```properties
storeFile=C:/ruta/privada/upload.jks
storePassword=SU_PASSWORD
keyAlias=upload
keyPassword=SU_PASSWORD
```

4. Ejecutar `npm run android:bundle`. El resultado firmado va a
   `artifacts/BearDrive-release.aab`. Nunca subir un APK debug como release.
5. En Play Console: Prueba y lanzamiento > Pruebas > Prueba interna, crear
   versión, cargar AAB, agregar testers y compartir el enlace de participación.
6. Antes de producción completar ficha, política de privacidad, seguridad de
   datos, clasificación, acceso para revisión y requisitos que muestre la consola.

Versionado: `android/app/build.gradle` permite propiedades `appVersionCode` y
`appVersionName`. El código debe superar el máximo ya cargado en Play Console.
No se creó una clave nueva ni se publicó una versión en la tienda en esta etapa.

Fuentes oficiales:
https://support.google.com/googleplay/android-developer/answer/9859348
https://support.google.com/googleplay/android-developer/answer/9845334

## Política de deuda implementada

Una deuda no bloquea cotizar, pedir, aceptar ni recibir nuevos viajes. Un viaje
PAYMENT_PENDING conserva su deuda y no ocupa el cupo operativo. Los controles de
identidad, documentación, PIN y cobro confirmado siguen vigentes.

Mora de cargos diarios: interés simple, por días completos tras vencimiento y
`grace_days`, redondeado a centavos. `DailyChargeConfig.late_fee_enabled` debe
activarse explícitamente; `late_fee_coefficient` expresa la fracción diaria.
La tasa se copia al crear cada cargo, sin aplicar una nueva tasa retroactivamente.
Un checkout emitido conserva su total hasta conciliación; no se generan enlaces
con importes cambiantes para la misma deuda. Se visualiza el saldo en Ganancias.
Falta definir tasa y alcance con el dueño: por ahora no se habilitaron recargos
ni se añadieron recargos a tarifas pendientes del pasajero.
