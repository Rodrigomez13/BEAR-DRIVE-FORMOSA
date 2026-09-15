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
