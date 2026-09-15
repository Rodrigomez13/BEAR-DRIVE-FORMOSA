# Mobile V2 — avance por etapas

Fuente de alcance: `deep-research-reportRESUMEN.md` proporcionado por el usuario.
Baseline inspeccionado: `bd97771`. Se conserva React/Vite, Base44, Capacitor,
Google Maps y la identidad visual existente.

## Etapa 1: base móvil

- Viewport a escala 1, conservando `viewport-fit=cover`.
- `MobileAppShell` compartido por Passenger y Driver: viewport dinámico,
  safe areas superiores/laterales, contenido flexible y navegación fija.
- Safe area inferior conservada en BottomNav; retirado el segundo inset superior
  en los controles de los mapas para evitar duplicación.
- Navegación con targets de 48 px, foco visible, `aria-current` y selección
  activa en subrutas.
- Movimiento reducido respetado por la transición de rutas y el indicador de nav.
- Se mantienen rutas, etiquetas y scrolls internos existentes en esta etapa.
  La migración al scroll compartido requiere revisar cada pantalla; no está
  completada por introducir el shell.

## Siguientes entregas

1. Navegación: Viajar/Viajes/Billetera/Cuenta y Conducir/Viajes/Ganancias/Cuenta;
   rutas anidadas y redirects que conserven búsqueda y hash, incluidos retornos MP.
2. Cuenta/finanzas: separar identidad, documentos, vehículos y preferencias;
   concentrar vinculación MP del conductor en Ganancias.
3. Seguridad: retirar el simulador y PricingConfig de la experiencia de usuarios;
   mantener cotizaciones server-side y verificar RLS por rol.
4. Pantallas operativas, BearBot, onboarding y notificaciones por entregas separadas.
5. QA en 320–430 px, landscape, teclado, movimiento reducido, PWA y Android.

## Verificación de esta etapa

La compilación y ESLint enfocado de los componentes de shell/nav pasan.
Lint global tiene 33 errores de imports sin uso en el baseline actual.
Las verificaciones de navegador/dispositivo, notch real, teclado y regresión de
pagos siguen pendientes. No se publica este cambio como una Mobile V2 completa.

Los cambios recientes de pagos se conservan. Su publicación, inicialización de
locks y prueba OAuth/webhook no quedan certificadas por este refactor visual.


## Etapa 2 — Cuenta y Billetera (2026-09-15)

- Navegación: pasajero Viajar / Viajes / Billetera / Cuenta; conductor Conducir / Viajes / Ganancias / Cuenta.
- Cuenta tiene identidad, datos personales, preferencias, seguridad, soporte y cambio de modo. Documentación y vehículos del conductor quedan en una pantalla secundaria.
- Datos personales conserva carga de foto, edición y eliminación de cuenta. Los cobros se gestionan en Ganancias, sin consultar PaymentAccount desde Documentación.
- Billetera del pasajero muestra BearPoints, preferencia de pago y los últimos 20 viajes finalizados con su estado de pago informado. No representa saldo monetario. Incluye estados vacíos y reintento de carga.
- Rutas anteriores activity/profile/benefits redirigen conservando consulta y fragmento. Los accesos compartidos antiguos usan el último modo abierto. El retorno de vinculación del perfil del conductor llega a Ganancias.
- Las pantallas compartidas quedan dentro de la barra de navegación cuando se accede por las nuevas rutas.

Validación: build correcto, lint enfocado sin errores y 30 pruebas de dominio/animación correctas. Revisión de Cuenta pasajero/conductor y navegación a Billetera mediante fixture local a 390 × 844. Datos simulados; no prueba de OAuth ni cobros reales. Lint global conserva 26 errores de imports sin usar; typecheck sigue fallando en componentes y tipos SDK preexistentes.

Pendiente: mapa y solicitud de viaje del informe, detalle visual de viajes/Ganancias, separación adicional de documentos y vehículos, revisión integral del asistente y validación en dispositivo con backend y pagos de prueba. Esta etapa no publica la aplicación ni genera un APK.
