# Cotización real — contrato de cierre

Issue: #30. Base: main 90e8dc464141a8171518f9901b40ae9ca18e5cba.

## Fuente funcional
HomeEasy `main` commit `aa21decbe809a91362a2cddfd272c7c5744dfddd`, `cotizacion.html`, flujo `finalizar()`: validar → procesar documento → persistir/sincronizar. Se conserva como referencia de comportamiento, no de datos ni identidad.

## Contrato Maderarte
1. La vista previa nunca crea registros ni consume consecutivos.
2. `Emitir cotización` usa un `requestId` estable y un payload congelado.
3. El servidor calcula subtotal/descuento/total y asigna un único consecutivo por sede.
4. Cliente, cotización y numeración se confirman en un batch idempotente.
5. Fotografías y PDF se completan después sobre identidades Drive reservadas; un fallo documental no vuelve a crear la cotización.
6. La cotización se reabre desde su número y conserva cliente, muebles, acabados, valores, observaciones y documento emitido.
7. Ensayo aislado antes de activar escrituras reales. No cambiar `COMMERCIAL_WRITES` por el merge.
8. Conversión a OP queda enlazada pero se cierra en #34.

## Separación de módulos
- Cotización: cuenta comercial sin pagos.
- OP: venta + pago inicial.
- Recibos de caja: módulo independiente (#31).

## Criterio de aceptación
Una cotización de prueba debe producir exactamente un número, una fila de cotización, su documento y sus referencias, sobrevivir recarga/reintento sin duplicarse y poder reabrirse con el mismo PDF.
