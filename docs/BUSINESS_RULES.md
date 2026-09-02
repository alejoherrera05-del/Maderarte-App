# Reglas comerciales

## Base cero

- Clientes, cotizaciones, órdenes, abonos, remisiones y documentos comienzan vacíos.
- El primer cliente y la primera OP se crearán desde Maderarte App.
- Ninguna rutina importa información desde otra aplicación o archivo.

## Cotización

- La cotización puede contener uno o varios productos y debe conservar cada item con sus especificaciones propias.
- Cada item puede incorporar fotografías de referencia. Las fotografías pertenecen al item, no a la cotización en general.
- La primera hoja del documento comercial prioriza cliente, productos, valores, observaciones y condiciones.
- Cuando existan fotografías, el documento debe generar un **anexo fotográfico en hoja(s) aparte**. Cada bloque del anexo identifica como mínimo: número/posición del item, descripción, referencia, medidas/acabados relevantes y sus fotografías.
- Mientras `COMMERCIAL_WRITES=false`, el formulario puede operar como experiencia de composición y vista previa, pero no debe crear registros comerciales reales.

## Orden de pedido

- La OP es el expediente central de una venta.
- Puede nacer directamente o desde una cotización.
- Debe contener al menos un producto.
- `Valor_Total`, `Abonado_Total` y `Saldo_Pendiente` deben permanecer consistentes.
- Una OP anulada conserva registros, documentos y auditoría.
- Para solicitar e iniciar un pedido se requiere un **abono mínimo equivalente al 30% del valor total**.
- El proceso estimado de fabricación es de **25 a 30 días**, contados desde la confirmación del pedido y el cumplimiento del abono mínimo requerido.
- La interfaz debe calcular y mostrar el valor mínimo correspondiente al 30% antes de confirmar la futura creación de la OP.

## Productos

- Cada producto vive en `Orden_Items` cuando la venta se convierte en OP.
- Se guardan descripción, categoría, referencia, cantidad, unidad, valor, acabados, medidas y especificaciones.
- Las fotografías de referencia forman parte de la especificación visual del item. La arquitectura documental debe permitir más de una imagen por item aunque `Orden_Items.URL_Foto` conserve una referencia principal.
- Las cantidades entregadas nunca pueden superar las cantidades vendidas.

## Abonos

- Cada pago genera una fila independiente en `Abonos`.
- Todo abono pertenece a una OP existente y activa.
- El valor debe ser mayor que cero y no puede exceder el saldo sin una regla administrativa explícita.
- Comentario, referencia, PDF y soporte se conservan con el recibo.
- Al registrar el pago se actualizan total abonado, saldo, último abono, fecha y resumen de comentarios de la OP.
- La aplicación muestra el historial completo, no solo el último pago.

## Drive

- Cada cliente tiene una carpeta dentro del mes de su primera operación del año.
- Cada OP tiene su propia carpeta dentro del cliente.
- Orden, recibos, remisiones y soportes se separan en subcarpetas.
- Las fotografías de referencia de items se guardarán dentro del expediente documental correspondiente y no en Git.
- El Sheet conserva enlaces directos para acceder desde la OP.

## Escrituras

- Toda operación usa `Request_ID`.
- Las escrituras sensibles usan `LockService`.
- Los permisos se comprueban en Apps Script, no solo en la interfaz.
- Toda modificación relevante registra usuario, fecha, valor anterior y valor posterior.
