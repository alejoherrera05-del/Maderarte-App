# Reglas comerciales

## Perfil comercial oficial

Los datos públicos de empresa usados por formularios y documentos viven en `public/js/core/company-profile.js`. Cotizaciones, pedidos, PDFs, recibos y demás documentos deben reutilizar esa fuente y no duplicar razón social, NIT, teléfonos, web, redes o direcciones de sedes en múltiples archivos.

## Base cero

- Clientes, cotizaciones, órdenes, abonos, remisiones y documentos comienzan vacíos.
- El primer cliente y la primera OP se crearán desde Maderarte App.
- Ninguna rutina importa información desde otra aplicación o archivo.

## Orden de pedido

- La OP es el expediente central de una venta.
- Puede nacer directamente o desde una cotización.
- Debe contener al menos un producto.
- `Valor_Total`, `Abonado_Total` y `Saldo_Pendiente` deben permanecer consistentes.
- Una OP anulada conserva registros, documentos y auditoría.
- Para solicitar e iniciar un pedido se exige un abono mínimo equivalente al **30% del valor total**.
- El proceso de fabricación se comunica como un tiempo estimado de **25 a 30 días**, contado desde la confirmación del pedido y el cumplimiento del abono mínimo.

## Productos

- Cada producto vive en `Orden_Items`.
- Se guardan descripción, categoría, referencia, cantidad, unidad, valor, acabados, medidas y especificaciones.
- Las cantidades entregadas nunca pueden superar las cantidades vendidas.
- En la experiencia de captura de Maderarte, medidas y detalles técnicos se agrupan dentro de `Especificaciones` cuando no requieren un campo operativo independiente.
- Las fotografías de referencia pertenecen al item concreto y, cuando existan, deben aparecer en un anexo fotográfico separado del documento comercial principal.
- Si un campo opcional no fue diligenciado, no debe imprimirse como etiqueta vacía ni con guiones/placeholders en el PDF final.
- Si ningún item tiene fotografías, el PDF final no debe generar una hoja de anexo fotográfico vacía.

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
- El Sheet conserva enlaces directos para acceder desde la OP.

## Escrituras

- Toda operación usa `Request_ID`.
- Las escrituras sensibles usan `LockService`.
- Los permisos se comprueban en Apps Script, no solo en la interfaz.
- Toda modificación relevante registra usuario, fecha, valor anterior y valor posterior.
