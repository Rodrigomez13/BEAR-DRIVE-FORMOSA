# Pagos y preparación nativa — 2026-09-15

## Diagnóstico verificado

- En Ganancias, el checkout se abría dentro del iframe de Base44 mediante location.assign. La captura muestra CSP y esquemas externos bloqueados en ese contexto; esos mensajes no prueban por sí solos un rechazo bancario.
- /users/me confirmó que las credenciales locales del cargo diario pertenecen a una cuenta real. getPaymentReadiness confirmó también en el backend que el receptor coincide con la credencial pero NO es un vendedor de prueba. No se realizó un cargo real.
- El backend no tenía USER_OPERATION_LOCK_IDS. Se provisionaron/reutilizaron los 32 slots con scripts/provision-user-locks.js y se configuró únicamente ese secreto. El diagnóstico posterior confirma 32/32 registros y sin bloqueos en curso.
- La UI de tarjetas guardaba metadatos tras fallar setupPassengerCard y afirmaba que estaban vinculadas. Se reemplazó por preferencias: la tarjeta se elige dentro de Mercado Pago.
- La solicitud directa de Ride se reemplazó por createRide usando quote_id. Nuevos viajes digitales se guardan como qr (Checkout Pro admite elegir tarjeta en su checkout); PIN, tarifa y creación quedan del lado del servidor. Se retiró el descuento local de puntos que no aplicaba el backend.

## Cambios del checkout

payment-navigation reserva una ventana desde el clic en preview, antes de esperar al backend. En nativo usa @capacitor/browser. Solo acepta HTTPS y hosts explícitos de Mercado Pago; cierra la ventana reservada si falla la API. El regreso no marca el pago aprobado: se consulta el backend, que debe recibir y validar el webhook.

No cambiar init_point por sandbox_init_point como supuesto arreglo. La guía de Checkout Pro usa cuentas vendedor/comprador de prueba y las credenciales de ese vendedor:
https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/test-accounts
https://www.mercadopago.com.ar/developers/es/news/2023/11/16/Questions-on-how-to-test-your-integration--

## Falta para cerrar el pago E2E

1. Configurar un receptor de PRUEBA separado para el cargo diario en un entorno de ensayo; no reemplazar la cuenta operativa en producción sin definir el entorno.
2. Comprador de prueba distinto del vendedor, ambos de Argentina. No compartir secretos en chat ni versionarlos.
3. Abrir checkout fuera del iframe, aprobar con medios de prueba y comprobar evento firmado, estado paid persistido y actualización de deuda. Probar también rechazo, cancelación y reintento sin doble cobro.
4. Probar un viaje digital con vendedor conductor vinculado. Los viajes antiguos de tipo card requieren revisión si hubo intentos de pago anteriores; no se convierten masivamente.
5. Publicar el frontend actualizado desde el dashboard de Base44 después del push. Sin publicación, el sitio continúa usando su versión anterior.

## Android e iOS: base creada, no aprobación de tienda

- Android existente e iOS agregado con el mismo appId: com.beardrive.formosa.
- Plugins Browser, App y Keyboard agregados y sincronizados en ambas plataformas; permiso explicativo de ubicación iOS incluido.
- npm run cap:sync compila y sincroniza ambos proyectos. npm run ios:open abre Xcode desde un Mac.
- Reanudar la app o cerrar el navegador refresca Ganancias. Los Universal Links/App Links para el regreso automático aún requieren asociación de dominio y certificados reales. No se fabricaron Team IDs ni huellas de firma.
- Pendiente: Mac/Xcode y signing iOS, build/instalación Android y AAB de release, certificados y cuentas de tienda, iconos definitivos, revisión de permisos/privacidad, notificaciones y recuperación de sesión, typecheck, prueba en dos dispositivos y pantallas pequeñas/teclado.
- Matriz E2E mínima: registro → roles → ubicación → cotización → asignación → PIN → viaje → checkout → webhook → cierre/deuda; pérdida de red, segundo plano y retorno externo en Android e iOS.

Referencias oficiales:
https://capacitorjs.com/docs/apis/browser
https://capacitorjs.com/docs/guides/deep-links
https://capacitorjs.com/docs/ios/deploying-to-app-store
https://capacitorjs.com/docs/android/deploying-to-google-play

Validado: build, 34 pruebas locales (incluyen navegación segura de pagos), cap sync Android/iOS. No se afirma cobro real ni binarios de tienda validados.

### Pruebas aisladas de Mercado Pago

El backend admite el secreto `MP_PAYMENT_MODE=test`: antes de generar o reutilizar
un checkout verifica que el receptor sea un usuario de prueba argentino y que una
preferencia existente pertenezca a ese mismo receptor. Sin el secreto se mantiene
el comportamiento de producción; un build frontend no activa un sandbox.

Para habilitar pruebas falta guardar el token del vendedor de prueba en
`.private/mercadopago-test.env` (`MP_DAILY_CHARGE_ACCESS_TOKEN=...`). No subir ese
archivo a Git. Luego validar `/users/me`, configurar el receptor correspondiente
y `MP_PAYMENT_MODE=test` en el backend destinado a pruebas, publicar desde Base44
y pagar con un comprador de prueba distinto. Para viajes, el conductor también
debe vincular un vendedor de prueba. No reutilizar deudas o viajes reales.

Pendiente de evidencia: publicación de esta revisión, conexión OAuth de prueba,
pago aprobado y webhook conciliado, cancelación/rechazo, Android e iOS reales.
Los ajustes responsive conservan el diseño, amplían las pantallas de cuenta en
tablet y eliminan alturas de viewport anidadas en ajustes y seguridad.

### Diagnóstico de token y checkout de prueba

Ejecutar `node scripts/check-mp-test.mjs` antes de sincronizar credenciales.
Consulta `/users/me` y rechaza vendedores reales, aunque el archivo se llame
mercadopago-test.env. No alcanza con cambiar el nombre ni con mirar el prefijo
del token. Si pasa, `node scripts/check-mp-test.mjs --prepare` escribe un archivo
privado con token, collector derivado y MP_PAYMENT_MODE=test, sin modificar el
backend. Usar ese archivo solo en el entorno destinado a pruebas.

Un checkout existente conserva su vendedor original. No reutilizar un enlace
anterior al cambio de receptor. Antes de reemplazarlo hay que conciliar su estado
con Mercado Pago; nunca borrar deudas o marcar pagos aprobados para destrabarlo.
El mensaje "Una de las partes ... es de prueba" indica mezcla de participantes;
los avisos CSP del checkout no demuestran un fallo de nuestra política de scripts.
Usar vendedor y comprador de prueba distintos; abrir el comprador en incógnito.

Guía oficial: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases
