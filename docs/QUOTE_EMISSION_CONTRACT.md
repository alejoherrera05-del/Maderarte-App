# Emisión real de cotizaciones — contrato v1

## Objetivo
Cerrar la cotización como operación comercial real sin cambiar el formulario ni el documento ya aprobados. La vista previa nunca consume consecutivo ni escribe en Sheets/Drive.

## Flujo
1. Validar cliente, sede, muebles, cantidades, valores, descuento, observaciones y referencias.
2. Crear un `requestId` estable antes de la primera escritura.
3. Reservar el consecutivo real de la sede y escribir cliente + cotización + idempotencia en una sola operación atómica.
4. Reservar identidades documentales y carpetas sin crear duplicados.
5. Subir las fotografías de la cotización a sus identidades reservadas.
6. Renderizar el PDF con el mismo motor Cloudflare Browser usado por la OP.
7. Confirmar PDF y enlaces en Sheets/Drive.
8. Si se pierde una respuesta, consultar/reanudar el mismo `requestId`; nunca crear una segunda cotización.

## Contrato del payload
`schemaVersion: 1`, `branch`, `client`, `items`, `discount`, `notes`.
Cada item conserva `clientLineId`, descripción, categoría, cantidad, valor unitario, tela/acabado, madera/acabado, especificaciones y manifiestos de fotos.

## Acciones
- `COTIZACION_CAPACIDADES`
- `COTIZACION_CREAR`
- `COTIZACION_CREACION_ESTADO`
- `COTIZACION_OBTENER`
- `COTIZACION_DOCUMENTOS_ESTADO`
- `COTIZACION_FOTO_GUARDAR`
- `COTIZACION_FOTO_LEER`
- `COTIZACION_PDF_LEER`
- `COTIZACION_DOCUMENTOS_FINALIZAR`
- internas: `INTERNO_COTIZACION_DOCUMENTO_PREPARAR`, `INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR`

## Seguridad
- Escritura real exige `cotizaciones.create`, sede permitida, `COMMERCIAL_WRITES`, `MODO_OPERACION=OPERACION`, `QUOTE_WRITES_ENABLED=SI` y esquema documental preparado.
- El sandbox del propietario puede probar el mismo contrato sin abrir escrituras de producción.
- Las notas y datos comerciales no se envían a repositorios ni logs.
- Google Sheets/Drive siguen siendo la fuente operativa.

## Criterio de aceptación
Una única cotización de prueba debe quedar con un único consecutivo, cliente, items, fotos, PDF y URLs recuperables; reintentos y respuestas perdidas deben devolver la misma cotización. Después se habilita la conversión Cotización → OP como fase separada.
