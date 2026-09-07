# Conexión del formulario con el guardado y recuperación

Base verificada: db1d88359a614e10f6d67a37604cacc0b238ac29 (PR #17).
Rama: feat/order-form-save-recovery. PR #18.

El propietario confirmó la actualización de Apps Script y compartió una ejecución correcta de verificarBaseCero: 23 pestañas, PREPARACION, commercialWrites:false y base comercial vacía. Ese resultado no certifica todavía una transacción real en Google.

## Implementación de este hito

- El formulario aprobado usa el contrato de `ORDEN_CREAR`: conserva identificación y teléfonos como texto, identidad de cada mueble/pago, acuerdos, importes, observaciones y notas internas. No envía totales calculados como autoridad del servidor.
- `ORDEN_CAPACIDADES` es una consulta de lectura. El cliente solo permite guardar con contractVersion:1 y enabled, photosReady y documentsReady explícitamente true. El Cerebro instalado mantiene enabled:false. No se modifican banderas de escritura.
- El mismo botón aprobado maneja envío, consulta del resultado y apertura de la OP confirmada. No se agrega un formulario ni un bloque de contabilidad nuevo.
- El primer envío congela una copia del comando y conserva un identificador único. Doble clic y pestañas concurrentes del mismo navegador utilizan un bloqueo exclusivo.
- Una respuesta incierta no limpia el intento ni genera otro identificador. Después de recargar se consulta `ORDEN_CREACION_ESTADO`, incluso si posteriormente se deshabilitaron las escrituras. Solo un permiso explícito del estado permite ofrecer el reenvío manual del cuerpo original con el mismo ID.
- El identificador, su huella y el número confirmado se conservan en un registro local sin datos del cliente ni notas de pagos. La copia con contenido comercial es temporal en la pestaña y se elimina al confirmar o cerrar sesión. El registro opaco pendiente no se elimina al cerrar sesión ni caduca por tiempo.
- Si falla el almacenamiento antes del envío, falta soporte del navegador o cambia la cuenta local, no se crea una orden. Un registro ilegible se conserva y bloquea nuevos intentos; no se aconseja borrar datos para resolverlo.
- Un guardado pendiente bloquea edición, cambio de sede, vista previa y Descartar borrador. Al confirmar, el evento pagehide no reconstruye un pedido guardado como borrador nuevo. Otra pestaña no elimina una captura ajena automáticamente.
- La recuperación sigue accesible si ya no está el borrador de la pestaña. La selección de sede no debe ocultar un intento pendiente/confirmado.
- Las fotografías cargadas o en curso y las distribuciones antiguas no soportadas bloquean el envío con una explicación. No se descarta información para hacer que v1 acepte el pedido.

## Pruebas

`scripts/test-order-save-client.mjs` contiene 64 comprobaciones de capacidades, doble clic, pestañas, contenido inmutable, respuesta perdida antes/después de commit, commit tardío, repetición exacta, cambio de usuario local, privacidad, almacenamiento y recuperación. Pasaron localmente y en GitHub Actions junto con la suite completa y las 222 comprobaciones existentes del servidor.

`scripts/order_save_browser_qa.py` carga el formulario real en Chrome y sustituye exclusivamente las respuestas API por datos sintéticos. El escenario inicial de conexión perdida, recarga y apertura se completó a 1440, 390 y 320 px en run 34149230069. La revisión final amplía la cobertura a fotos cargadas mediante input, pérdida del borrador y capacidades deshabilitadas. Los resultados finales y capturas se adjuntan en el workflow `Order form save QA` del PR.

La suite visual anterior sigue verificando cotización, pedido y PDF de preparación. Las pruebas no escriben en Sheets ni Drive. No equivalen a un ensayo de concurrencia real en Google, a pruebas entre distintos dispositivos ni a Safari en iPhone físico.

## Estado publicado y límites

Este hito no requiere reemplazar otra vez el Cerebro, ejecutar preparadores de esquema, cambiar propiedades privadas ni descargar un nuevo ZIP. No modifica archivos de Apps Script, CSS, renderizador del PDF, permisos de servidor ni esquema instalado. El HTML de pedido solo cambia la revisión de su módulo JavaScript.

Al publicarlo, el guardado comercial continúa deshabilitado. Ningún resultado de la prueba sintética habilita producción. El diseño aprobado se conserva.

Pendiente: contrato y almacenamiento de fotos, carpetas y PDF oficial; ampliación explícita del esquema en el momento previsto; revisión de permisos efectivos e identidad entre sesiones; aceptación de las operaciones y recuperación contra Google en un entorno aislado; activación solo después de ese recorrido completo. La protección del navegador complementa, no sustituye, la autorización e idempotencia del Cerebro.
