# BearDrive · Realtime Navigation & Tracking

## Objetivo

Esta rama implementa una experiencia de viaje equivalente al patrón operativo de apps de ride-hailing modernas: navegación turn-by-turn real para Driver, tracking en tiempo real para Passenger, tarjetas compactas durante la navegación y transiciones automáticas basadas en eventos de navegación.

## Alcance funcional

### Driver

1. Al aceptar una solicitud, el viaje pasa a `DRIVER_APPROACHING`.
2. La tarjeta de pasajero deja de ocupar la pantalla y se reduce a una tarjeta compacta expandible.
3. Se inicia navegación nativa hacia el punto de recogida.
4. La navegación debe incluir:
   - cámara que sigue al vehículo;
   - ruta con tráfico;
   - maniobras giro-a-giro;
   - ETA y distancia restante;
   - rerouting automático;
   - road snapping;
   - guía de voz;
   - botón de recentrado;
   - detección de llegada del SDK.
5. Al llegar al pickup, BearDrive pasa a `DRIVER_ARRIVED` y muestra el flujo de PIN.
6. Tras validar el PIN, el estado pasa a `IN_PROGRESS` y se inicia navegación nativa hacia el destino.
7. La llegada al destino pasa a `ARRIVED`; el viaje no se completa financieramente hasta resolver el pago.

### Passenger

1. Cuando un Driver acepta el viaje, la pantalla deja de ser una pantalla de espera.
2. El mapa muestra:
   - posición viva del conductor;
   - pickup del pasajero;
   - ruta actual del conductor hacia el pickup;
   - ETA y distancia restante;
   - estado del viaje.
3. El marcador del conductor se interpola entre actualizaciones para evitar saltos visuales.
4. La tarjeta de Driver es compacta por defecto y puede expandirse.
5. Al comenzar `IN_PROGRESS`, el pasajero ve el avance del viaje hacia destino.

## Arquitectura elegida

### Driver Android

La navegación exacta no se implementará imitando Google Maps con JavaScript. Se utilizará **Google Navigation SDK for Android** mediante una capa nativa integrada con Capacitor.

Versión objetivo inicial: `com.google.android.libraries.navigation:navigation:7.9.0`.

La Navigation SDK aporta la funcionalidad que BearDrive necesita: `NavigationView`, turn-by-turn, traffic-aware routing, rerouting, `ArrivalListener`, ETA, guía de voz, road-snapped location y seguimiento de cámara.

### Bridge Capacitor

Se implementará un plugin local `BearDriveNavigation` que expondrá al frontend operaciones como:

- `startNavigation()`
- `stopNavigation()`
- `recenter()`
- eventos de ubicación road-snapped;
- evento de llegada;
- evento de ruta recalculada;
- ETA/distancia restante.

La navegación se renderizará como overlay nativo sobre el `BridgeActivity`, no como una segunda app externa. Esto permite que el WebView y el bridge sigan vivos mientras el Driver navega.

### Tracking Driver -> Passenger

Durante un viaje activo:

- GPS/Nav SDK: alta frecuencia local para la experiencia del Driver.
- Publicación remota: sólo si el vehículo se desplazó significativamente o pasó un intervalo máximo.
- Passenger: recibe cambios mediante Realtime, no mediante polling.
- Persistencia histórica: se mantiene mucho menos frecuente que la actualización visual.

Mientras Base44 siga activo, se utilizará `DriverLocation.update()` como transporte/persistencia temporal y `DriverLocation.subscribe()` para recibir cambios. Se evitarán consultas repetitivas.

Arquitectura definitiva prevista:

```text
Navigation SDK / Driver GPS
        |
        +--> UI Driver (alta frecuencia local)
        |
        +--> realtime location event (throttled)
                    |
                    +--> Passenger marker
                    +--> ETA / route state
        |
        +--> DB snapshot (menos frecuente)
```

Cuando el backend de movilidad pase a Supabase, el canal efímero de ubicación debe migrar a Realtime Broadcast/Presence, dejando PostgreSQL para snapshots y estado autoritativo.

## Frecuencias objetivo

Estas frecuencias son criterios iniciales y deben validarse en prueba real:

- ubicación local Driver: 1-2 s o según callback del Navigation SDK;
- publicación remota mientras se mueve: ~2-4 s o >= 15-25 m de desplazamiento;
- snapshot persistente: ~10-15 s;
- route/ETA update al pasajero: por evento de Navigation SDK o cambio significativo;
- consultas periódicas de Ride: ninguna en operación normal; usar `Ride.subscribe()`.

## Máquina de estados

```text
SEARCHING
   -> DRIVER_APPROACHING
   -> DRIVER_ARRIVED
   -> PIN_VALIDATION / IN_PROGRESS
   -> ARRIVED
   -> PAYMENT_PENDING
   -> COMPLETED
```

`ASSIGNED` queda como compatibilidad con datos existentes, no como estado visual obligatorio.

## Seguridad

- La API key nativa de Navigation SDK no se guardará en JavaScript ni en Git.
- Android usará Secrets Gradle Plugin y una key restringida por package name + SHA-1/SHA-256.
- El cliente Passenger sólo puede recibir ubicación del Driver asignado a su Ride.
- El Driver sólo puede publicar tracking para su Ride activo.

## Definition of Done de esta rama

- [ ] Driver acepta viaje y entra automáticamente a navegación real hacia pickup.
- [ ] Tarjeta de pasajero se minimiza al iniciar navegación.
- [ ] Driver puede expandir/minimizar la información sin salir de la navegación.
- [ ] Guía turn-by-turn, voz, ETA y rerouting funcionando en Android físico.
- [ ] ArrivalListener cambia el viaje a `DRIVER_ARRIVED`.
- [ ] PIN correcto inicia navegación al destino.
- [ ] ArrivalListener cambia el viaje a `ARRIVED` al llegar al destino.
- [ ] Passenger ve al Driver moverse en tiempo real sin polling cada 3 s.
- [ ] Passenger ve ruta Driver -> pickup mientras el Driver se aproxima.
- [ ] Passenger ve estado y ETA actualizados.
- [ ] No se escriben posiciones a DB en cada fix GPS.
- [ ] No hay secretos de Google en el bundle Vite.
- [ ] Funciona en dos teléfonos físicos durante un viaje E2E.
