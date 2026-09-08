# Cotización y pedido: misma familia visual

Continuación del PR #24, solicitada por el propietario al aprobar el acabado delicado del pedido.

## Alcance

`commercial-document-refined.css` contiene la tipografía común de cotización y pedido: cuerpo regular, encabezados de peso medio, datos del cliente, acabados, precios y pie sin exceso de negrilla. Se conserva el membrete, las fuentes de marca, los tamaños de tabla y la paginación. La firma comparte el acabado serif cursivo del pedido.

La cotización mantiene condiciones y desglose de precio, con `Total cotizado`. No incorpora abonos, pagos recibidos, estados de entrega ni saldo pendiente. `pedido-document-refined.css` queda reservado al resumen del pedido y su saldo general. No se altera la lógica ni los valores comerciales.

El iframe del paginador recibe el mismo tipo de documento que la página visible; mide con los mismos estilos en vez de volver silenciosamente a pesos anteriores. La prueba visual compara ambas plantillas a 1440, 390 y 320 px y comprueba una cotización larga con cierre único.

Se cierra además el detalle pendiente de recuperación del PR #24: reutilizar el mismo diálogo al reintentar completar documentos, sin duplicar IDs ni ventanas superpuestas. Prueba DOM con tres fallos consecutivos, sin red.

## Estado de datos

No se modifica Apps Script, configuración privada, banderas, datos de Google ni PDF ya archivado. No requiere reinstalar Cerebro. Los PDFs de muestra y las pruebas visuales utilizan datos ficticios locales. No equivalen a una venta ni a un nuevo ensayo real contra Google.
