# Guardado de órdenes — primer hito técnico, 7 de septiembre de 2026

Base verificada: `b6c3b3dbfb729e27364e585c9536d9b906655681`, PR #16 publicado y aprobado. Rama: `feat/order-save-foundation`. PR #17.

## Aprobación y alcance

El propietario aprobó expresamente el formulario y el documento publicados y solicitó continuar con su funcionamiento. Esta entrega conserva íntegros HTML, CSS, formularios, vista previa y recursos aprobados. No recupera el acuerdo común ni la distribución visible de saldos por mueble.

Se implementa el núcleo de persistencia en Apps Script, no la activación de un guardado comercial completo desde la interfaz.

## Implementado

- `OrderCreation.gs`: contrato estricto de cliente, muebles, acuerdos, disponibilidad, descuento, pagos y observaciones. El servidor calcula los importes; no confía en totales enviados por el navegador. Identificaciones y teléfonos se conservan como texto.
- Una solicitud Sheets `spreadsheets.batchUpdate` agrupa cliente, cabecera de OP, productos, abonos, consecutivos, registro de números, auditoría e idempotencia. No hay una secuencia de `appendRow` que deje medio pedido escrito.
- El consecutivo se valida por sede contra números existentes, incluso anulados. Cada mueble recibe una identidad estable y conserva su precio neto. Cada pago conserva su propio importe, medio y nota interna.
- `OrderCreationRecovery.gs`: bloqueo persistente antes de enviar el lote. Un timeout puede dejar a Google procesando después de liberar `ScriptLock`; por eso la ausencia momentánea del resultado no autoriza reenviar. Hasta confirmar el resultado, se bloquean nuevos lotes, también con otro identificador.
- Repetir un identificador confirmado devuelve la misma OP. Cambiar su contenido produce conflicto, no otra venta. Consultar el identificador requiere la sesión y los permisos apropiados y no expone datos de otro usuario.
- La consulta de una orden recupera el contacto usado en esa venta, los acuerdos y cantidades por mueble y los valores netos. Las notas internas no aparecen en la proyección pública de abonos ni en la respuesta de guardado.
- Crear una orden no crea remisiones ni solicitudes a fábrica. Las cantidades entregadas arrancan en cero. No se inventan PDFs ni carpetas: `Estado_Documentos` permanece `PENDIENTE`.

La garantía atómica elegida se refiere a las pestañas del mismo spreadsheet dentro del lote, no a Drive ni a modificaciones manuales de colaboradores. Documentación técnica: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate . Todos los escritores futuros deben respetar este mismo control; no introducir otro proceso que ignore el bloqueo.

## Esquema y compatibilidad

El contrato original de 23 pestañas sigue activo por defecto. Se preparó una extensión explícita mediante `prepararEsquemaGuardadoOrdenes()`, que no está expuesta al navegador. Solo puede ejecutarse en PREPARACION, con escrituras deshabilitadas y la base comercial vacía. Rechaza esquemas inesperados; no importa ni elimina registros.

Campos añadidos al contrato versión 2:

- `Ordenes_Pedido`: Subtotal, Descuento, Telefono_Alterno, Email, Ciudad, Version, Estado_Documentos.
- `Orden_Items`: Acuerdo, Disponibilidad, Descuento, Valor_Neto, Cantidad_Desistida, Version.
- `Abonos`: Nota_Interna.

La función actualiza encabezados de forma conjunta y solo después confirma `ORDER_SCHEMA_VERSION=2`. Se prueba también la recuperación si Google aplicó encabezados pero se perdió la respuesta. No se ejecutó esta función en la base real durante esta entrega.

## Comprobaciones

`scripts/test-order-creation.mjs` contiene **222 comprobaciones explícitas** con un adaptador en memoria que aplica los pedidos REST generados por el código real. Incluye rechazo en cada posición del lote, respuesta perdida después del commit, commit tardío después del timeout, bloqueo persistente, reintentos, permisos, sesión revocada, duplicados, lectura posterior, importes inválidos, descuento de un peso, privacidad y ampliación de esquema. Los datos son sintéticos y nunca se enviaron a Google.

El test forma parte de `npm test`. El workflow `Order save QA` ejecuta la suite completa y `scripts/export-cerebro.mjs`: verifica carga y sintaxis del Cerebro reunido, ausencia de funciones duplicadas, 23 contratos y escrituras deshabilitadas. El artefacto identifica el commit exacto. El resultado definitivo de cada ejecución está en GitHub Actions; no confundir pruebas simuladas con certificación de transacciones reales.

## Lo que NO se habilita

`COMMERCIAL_WRITES` permanece `false`, el modo de operación no se modifica y `ORDER_SAVE_ENABLED` tiene valor seguro por defecto. `ORDEN_CAPACIDADES` devuelve `enabled:false` deliberadamente. No se cambia el botón de guardar ni se registran clientes, pedidos o abonos reales.

No se desplegó Apps Script ni se modificaron las propiedades privadas, permisos de Google, estructura instalada de Sheets o contenido de Drive. Fusionar el PR y publicar Cloudflare no actualiza por sí solo el proyecto de Apps Script.

## Condiciones pendientes antes de una activación real

1. Actualizar y verificar el Cerebro en el proyecto oficial mediante el mecanismo autorizado de despliegue. Las herramientas conectadas de esta sesión no proporcionaron una acción compatible para desplegar Apps Script.
2. Verificar el acceso a Sheets API, el esquema, numeración, permisos efectivos, bloqueo entre sesiones y recuperación contra Google, en un entorno de prueba separado sin crear ventas ficticias en producción. Revisar además los alcances existentes de lectura de órdenes y abonos antes de ampliar usuarios.
3. Integrar el formulario con el contrato: identidad de solicitud persistente, recuperación tras recarga, botón durante el envío y apertura de la OP confirmada. No resolver un timeout generando otro identificador.
4. Completar fotografías, carpetas y PDFs oficiales con reintentos documentales independientes. Actualmente se rechazan fotografías no vacías antes de escribir; no se eliminan referencias silenciosamente para permitir el guardado.
5. Revisar la evidencia de extremo a extremo y habilitar únicamente la operación comprobada. No activar las banderas para probar a ciegas.

Un bloqueo pendiente no caduca ni se borra automáticamente por tiempo transcurrido. Si Google no confirma el lote, la resolución exige diagnóstico autorizado; no basta con borrar `ORDER_CREATION_PENDING`. La aprobación visual del PR #16 sigue vigente y no certifica este despliegue operativo.
