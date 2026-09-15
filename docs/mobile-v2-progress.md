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


## Etapa 3 — Navegación inmediata y Viajes (2026-09-15)

- Eliminado el fundido secuencial de 220 ms de salida + 220 ms de entrada entre rutas. Outlet ahora cambia directamente sin retener la pantalla anterior; la barra permanece montada.
- Historial compartido para ambos modos, con consulta por passenger_id o driver_id según la ruta. Filtros Todos / En curso / Completados / Cancelados sobre los últimos 50 registros.
- Detalle desplegable de pago, participante, distancia y duración; importes finales usan nullish coalescing para conservar cero. Acceso al módulo principal para retomar un viaje activo.
- Errores de consulta visibles y reintento, diferenciados del historial vacío. Respuestas antiguas o posteriores al desmontaje no reemplazan la información actual.
- Build, lint de archivos modificados y 30 pruebas existentes correctos. Fixture local ampliado con viajes de varios estados, importe final cero y fallo de carga simulado. No prueba de dispositivo ni publicación.


## Etapa 4 — Panel de solicitud del pasajero (2026-09-15)

- Panel de mapa reutilizable con altura máxima, scroll contenido, cabecera y control para mostrar más mapa. Integrado en selección y cotización del pasajero.
- Selección explícita Origen / Destino con foco en búsqueda, objetivos táctiles de 48 px y avance a destino después de elegir el origen.
- Búsqueda con descarte de respuestas antiguas, indicador coherente al borrar el texto y mensaje de resultados vacíos. Cotización continúa siendo explícita; no se agregan llamadas de rutas al escribir.
- Resumen de origen/destino en confirmación y guía cuando falta un punto. Conserva categoría, preferencias de pago y campos existentes.
- Validación: build, lint enfocado y 30 pruebas existentes pasan; panel expandido/contraído revisado en fixture móvil con contenido largo. Falta validar Google Maps, teclado nativo, solicitud real y conductor en dispositivo. Esta etapa no cambia el backend ni publica.


## Etapa 5 — Operación del conductor

- Panel acotado y desplazable para PIN, llegada y cobro; estados legibles, control de chat de 48 px y PIN con etiqueta accesible.
- Solicitudes con detalles desplazables y acciones separadas al pie. Temporizador por ID y tiempo transcurrido, independiente de la identidad de callbacks del padre. Aceptación bloqueada mientras está en curso o tras vencer.
- Silenciar ahora apaga el sonido sin descartar la solicitud. Rechazar sigue siendo una acción independiente.
- No se inventan calificaciones o duración faltantes. Distancia al origen identificada como línea recta. Importe final cero preservado.
- Solicitud entrante tiene prioridad sobre aviso de notificaciones. Se elimina el safe-area inferior duplicado de la espera y se simplifica su mensaje.
- Pendiente validación del conductor en dispositivo con solicitudes reales, PIN y cobro; no se publica ni modifica el backend en esta etapa.


## Etapa 6 — Ayuda y soporte

- Accesos contextuales a Viajes y Billetera/Ganancias. Preguntas frecuentes alineadas con la navegación actual.
- Eliminado el simulador de tarifas de Ayuda; soporte se concentra en orientación y registro de consultas.
- Confirmación con referencia del caso creado, protección contra doble envío, límite de 3000 caracteres y controles accesibles.
- Altura adaptada al shell, sin un segundo viewport vertical. Validación local de build y lint enfocado; pendiente probar registro real con sesión y permisos del backend.


## Etapa 7 — Administración integrada y entrega a GitHub

- Conectadas /admin/operations y /admin/payments, que tenían enlaces en el menú pero no rutas en App.
- Soporte: indicadores, búsqueda por usuario/viaje/texto, filtro de categoría, seguridad primero, resolución obligatoria, bloqueo de doble envío y estados de carga/error/vacío. Las escrituras siguen usando supportOperations y su control administrativo.
- Pagos: contenido operativo prioritario, diagnóstico con error independiente de la tabla y conservación de importes/puntos con valor cero.
- Lint general correcto tras eliminar imports sin usar. Build y 30 pruebas correctos. Typecheck continúa fallando por tipos de componentes UI, ImportMeta y otros errores del proyecto; no es un gate aprobado.
- Navegador: revisión del soporte con datos locales simulados y búsqueda sin coincidencias. No se usaron casos reales.

### Estado del roadmap original

| Fase | Estado actual |
| --- | --- |
| Baseline | Parcial: build/lint/pruebas disponibles; typecheck pendiente |
| Shell móvil | Implementado; falta validación completa en dispositivos |
| Navegación | Implementada, incluyendo rutas administrativas |
| Cuenta/Finanzas | UI integrada; pagos reales y conciliación pendientes |
| Operación | Paneles e historial implementados; falta recorrido completo pasajero/conductor |
| Engagement | Ayuda implementada; onboarding/notificaciones/BearBot pendientes de revisión integral |
| Seguridad | Funciones y pruebas existentes; falta auditoría integral del frontend contra backend |
| Release | Código preparado para GitHub; publicación y prueba de dispositivo pendientes |

Las etapas numeradas describen entregas de código, no fases del roadmap cerradas. No se considera terminada la aplicación por pasar el build.
