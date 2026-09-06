# Ciclo de vida de la orden: contrato de preparación

## Alcance actual

Este documento y `order-lifecycle.js` definen y prueban cálculos de preparación. No implementan guardado, autorización, cobros, devoluciones ni emisión de remisiones. PREPARACION sigue activa. Una prueba de cálculo no demuestra una transacción segura de Apps Script.

La OP es el expediente. Sus muebles conservan `Item_ID`; la posición visible y la descripción no son identificadores. Crear otra remisión no crea otra OP. Los abonos y las entregas son movimientos independientes.

## Lo comprobado en la base actual

`Orden_Items` ya incluye `Item_ID`, cantidades vendidas/entregadas/pendientes y estado. `Remision_Items` enlaza cada entrega con `Numero_OP`, `Item_ID` y cantidad. `Remisiones` tiene número propio, estado y `Request_ID`. Hay hojas de auditoría, anulaciones, versiones e idempotencia.

Todavía faltan persistencia de la elección de venta por mueble y de su evolución operativa, desglose neto de descuentos, cantidad desistida y movimientos de devolución. El propietario retiró las asignaciones de abonos de la captura; el abono corresponde a la OP completa. `Orders.gs` devuelve cabeceras de remisión y totales almacenados; no es aún un servicio transaccional para emitirlas. El formulario no debe asumir que esos servicios ya funcionan.

## Recorrido y fuentes de verdad

| Operación | Efecto correcto |
|---|---|
| Elegir dentro del mueble | Entrega inmediata, Solicitar a fábrica o Separado; conservar el `Item_ID`. |
| Marcar entrega hoy | Intención de venta, no una entrega registrada. |
| Indicar abono | Borrador; al habilitar escritura habrá un movimiento confirmado y un recibo. |
| Nueva remisión | Seleccionar exclusivamente muebles y cantidades pendientes de esa OP. |
| Confirmar remisión | Registrar cabecera y detalle una vez; actualizar proyecciones de cantidad desde el movimiento confirmado. |
| Quitar mueble de un borrador | Reversible mediante Deshacer; conservar los pagos escritos y revisar el nuevo total. |
| Desistir de un mueble de una OP emitida | Registrar ajuste con motivo, responsable, versión y efectos; conservar línea original e historial. |
| Cambiar un mueble | Desistimiento/ajuste de la línea anterior y nueva línea con otro ID; no reutilizar IDs. |

## Entregas parciales

`pendiente = cantidad original - cantidad desistida - cantidad entregada confirmada`.

Una selección empieza vacía. No preseleccionar todo lo pendiente. Mostrar por mueble lo vendido, entregado y disponible para seleccionar en la próxima remisión. Rechazar cantidades cero, negativas, fraccionarias, superiores a lo pendiente, IDs repetidos o ajenos a la OP. No deducir entrega a partir de pago, saldo, acuerdo o fecha. La selección de pendientes solo calcula cantidades: antes de confirmar, el servidor debe comprobar disponibilidad física actual, producción y revisiones operativas. La disponibilidad indicada al vender puede haber cambiado; no sirve como autorización de despacho.

Ejemplo: cuatro sillas, primera remisión de dos, segunda de una; queda una. Un comedor entregado deja de ofrecerse para una nueva entrega, aunque otros muebles sigan pendientes.

Una devolución física requiere su propio movimiento y una decisión posterior (reposición, desistimiento u otra solución). No reabrir cantidades pendientes automáticamente. Anular un documento erróneo y recibir físicamente un producto son hechos diferentes.

## Desistimientos y dinero

Solo se puede desistir de cantidades no entregadas. Si ya se entregaron, abrir el proceso de devolución. Si existe solicitud confirmada a fábrica, exigir revisión operativa antes de confirmar el desistimiento; no cancelar una fabricación silenciosamente.

Los precios netos por línea se fijan al emitir la OP. No volver a repartir el descuento original sobre los muebles restantes después de un desistimiento. Para cantidades parciales, el contrato de cálculo utiliza reparto acumulado en pesos enteros y conserva el residuo en la última unidad. El backend debe versionar esa política y comprobar que coincide con el documento antes de activarla.

`abono neto = cobros confirmados - devoluciones de dinero confirmadas`.

`saldo por pagar = máximo(total vigente - abono neto, 0)`.

`saldo a favor = máximo(abono neto - total vigente, 0)`.

Ejemplo: sala de $2.000.000 y comedor de $1.500.000; $2.100.000 abonados. Si desiste de la sala sin haberla recibido, quedan $1.500.000 de venta y $600.000 a favor. No borrar el abono, mostrar simplemente saldo cero, devolver dinero ni aplicarlo a otra OP automáticamente. Registrar la decisión autorizada y su movimiento. Comisiones, penalizaciones o retenciones no se inventan; requieren política del propietario.

Los abonos pertenecen a la OP completa. No pedir al vendedor repartirlos entre muebles. La función de proyección conserva una revisión defensiva si recibe una asignación histórica; no es un requisito de la captura ni autoriza trasladar dinero.

## Puerta de entrada a escrituras futuras

Antes de activar crear OP, remisión, desistimiento o devolución:

1. Versionar el esquema sin reutilizar columnas con otra semántica. Persistir elección/netos por línea y movimientos auditables de cantidades y dinero.
2. Revalidar usuario, permisos, sede de la OP y versión esperada dentro del servidor. Una versión desactualizada obliga a recargar.
3. Usar `Request_ID` ligado al contenido: repetir lo mismo devuelve el resultado original; el mismo ID con otro contenido se rechaza.
4. Dentro de `LockService`, volver a calcular pendientes y saldos desde movimientos confirmados. No confiar en totales o permisos del navegador.
5. Sheets no ofrece una transacción entre varias hojas: usar un registro de operación pendiente/confirmada y recuperación verificable. Los lectores ignoran movimientos no confirmados. Una caída entre cabecera, detalle y proyecciones no puede habilitar entrega doble ni dinero perdido.
6. Reservar numeración sin reutilizar documentos anulados. PDF/Drive se reintentan sobre el mismo documento confirmado; un fallo de PDF no repite el cobro o entrega. Versiones anteriores permanecen consultables.
7. Probar doble clic, concurrencia de dos usuarios, timeout tras confirmar, reintento, fallo parcial de Sheets/Drive, anulación y recuperación. Estos casos no quedan cubiertos solo por las funciones de cálculo.

## Supervisión y aceptación

`test-order-lifecycle.mjs` prueba selección parcial, sobreentrega, desistimiento de pendientes, saldo a favor, importes enteros, identidad y versión sin mutar entradas. Las pruebas del formulario verifican elección por mueble, pagos generales, recuperación de borradores anteriores, alta/eliminación/Deshacer y revisión del abono tras quitar un mueble.

Las pruebas transaccionales anteriores son una condición para habilitar operación real. La presente entrega solo puede publicar las mejoras del formulario y los cálculos de preparación que pasen sus comprobaciones.
