# Emisión real de cotizaciones — contrato v1

## Activación específica solicitada el 11 de septiembre de 2026

El propietario solicita emitir cotizaciones reales y su PDF desde el primer número 001. La base real fue comprobada vacía con verificarBaseCero. La nueva activación manual exige base cero, esquema documental y ambos consecutivos en 1; no resetea números ni elimina documentos. QUOTE_OPERATION_ACCEPTED=SI, QUOTE_WRITES_ENABLED=SI y QUOTE_DOCUMENTS_ENABLED=SI habilitan únicamente cotizaciones. COMMERCIAL_WRITES permanece false y las demás operaciones conservan sus puertas. Publicar código no ejecuta la activación.

Los números nuevos usan MP-COT-001 / TP-COT-001. La lectura y recuperación siguen aceptando números anteriores de cuatro o más dígitos; el sandbox conserva cuatro dígitos. Se debe verificar la emisión y reapertura del PDF en el dominio habitual antes de declarar resuelto el incidente. No consumir 001 con datos de prueba.

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

## Cierre técnico del PR #36 (8 de septiembre de 2026)

- QA de `quote/preview` y `quote/save` independientes; el número del loader solo se muestra con el evento `record/complete`.
- El resultado persistido declara el flujo documental antes de serializar idempotencia. El cliente siempre verifica documentos, también al recuperar respuestas anteriores sin esa señal.
- La emisión usa la misma protección duradera de batch incierto que OP. Un timeout con Google todavía procesando impide enviar otro batch, incluso de otra operación. No expirar ni borrar esa protección por ausencia momentánea de filas.
- Sandbox: acciones de cotización, tabla `Archivos_Cotizacion`, Sedes y prefijos QA. Una cotización por ensayo. `quoteReady=false` identifica ensayos anteriores; no se reinicializan, migran ni limpian automáticamente.
- El PDF emitido reutiliza el marcado y paginador aprobado de la vista previa. Firma solo con nombre. El detalle reabierto conserva el contacto de la versión emitida.
- Auditoría, consecutivo, cliente, cotización, reservas y Request_ID se confirman en el mismo batch. El nuevo cliente exige `clientes.create`.

Pruebas automatizadas: `test-quote-save-client.mjs`, `test-quote-progress.mjs`, `test-quote-emission.mjs`, `test-quote-document-edge.mjs`, `compact_loading_qa.py` y `quote_emission_browser_qa.py`. El navegador ejecuta formulario → Worker → módulos Apps Script → transporte Google simulado → PDF Chromium real. Esto NO sustituye la aceptación en Google real.

## Siguiente puerta: propietario y Google real

Actualización del 8 de septiembre de 2026: el propietario delegó expresamente en Codex la implementación y el despliegue. Codex actualizó el archivo único existente desde `a589a8f197bfa21f095ce59d8e5d89a6cf1c14d4`, conservó un respaldo local y verificó la igualdad íntegra del contenido guardado. Google confirmó la publicación de la versión 6 a las 14:58 (Bogotá), sobre la misma implementación, sin cambiar URL, manifiesto, propiedades ni permisos.

La comprobación real `verificarBaseCero` terminó correctamente a las 14:56:13: 23 contratos, un propietario, sedes MP/TP, todos los conteos comerciales en cero, `COMMERCIAL_WRITES=false` y `MODO_OPERACION=PREPARACION`. Esto valida el despliegue del backend y la base; no equivale a aceptación de emisión documental. El ensayo anterior de OP se conserva y su limpieza sigue requiriendo confirmación exacta. La prueba de cotización en Google y el merge continúan pendientes.

La instalación real usa un archivo único: generar con `node scripts/export-cerebro.mjs` y reemplazar su contenido completo. No añadir los seis módulos por separado junto al archivo único, porque duplicaría funciones. El paso 1 siguiente ya se completó mediante ese formato equivalente.

### Instrucción vigente del propietario: revisión en el dominio habitual

El 8 de septiembre el propietario sustituyó la puerta de ensayo aislado: solicita publicar los cambios en GitHub y verificarlos directamente en `https://app.maderartepopayan.com`, sin nuevas pruebas locales ni ensayos aislados. Autoriza publicar el PR con las verificaciones de GitHub correctas, conservando PREPARACION y las escrituras comerciales deshabilitadas. La publicación no constituye aceptación de emisión comercial ni autoriza activar ventas. También autorizó enviar a la papelera el ensayo anterior de OP; no implica borrado definitivo ni limpieza de recursos productivos.

Los pasos siguientes quedan como referencia histórica de la aceptación aislada propuesta, no como requisito para publicar en el dominio habitual. No cerrar #30 como aceptación comercial completada: ese recorrido real sigue pendiente.

1. El propietario actualiza en Apps Script los seis módulos de esta rama: `QuoteCreation.gs`, `QuoteMedia.gs`, `QuoteRead.gs`, `Router.gs`, `OrderSandbox.gs` y `OrderCreationRecovery.gs`. Publica una nueva versión de la implementación existente, conservando URL, propiedades privadas y permisos. No ejecutar rutinas de preparación del esquema productivo para este ensayo.
2. Mantener `COMMERCIAL_WRITES=false`, `MODO_OPERACION=PREPARACION` y banderas comerciales sin activar.
3. Antes de crear un ensayo, consultar `PRUEBA_ESTADO` con la sesión propietaria. Conservar identificación y estado del ensayo anterior. Si está activo y `quoteReady=false`, detenerse: el propietario debe decidir sobre esos recursos y confirmar cualquier limpieza exacta. Nunca llamar automáticamente a `PRUEBA_LIMPIAR`.
4. Para probar el PDF antes del merge, configurar **solo en la versión de ensayo de Cloudflare** `QUOTE_SANDBOX_RENDER_ORIGIN` con el origen HTTPS de la preview publicada del PR. Confirmar que `/cotizacion-render.html` corresponde al SHA probado. La variable solo se usa con un documento que Apps Script identifica como sandbox; documentos normales conservan el dominio habitual. No se acepta origen desde el payload del navegador.
5. Con el ensayo apto, abrir Probar cotización desde el control de pruebas. Cliente ficticio precargado, dos muebles ($2.000.000 y $1.500.000), foto solo en el primero, descuento $200.000 y observación. Total esperado $3.300.000.
6. Verificar en Google: un cliente, una cotización QA, dos items en Items_JSON, Request_ID en Idempotencia/Registro_Numeros/Auditoria/Documentos, una carpeta cliente con `00_COTIZACIONES`, una foto y un PDF. Sin OP, recibos ni consumo de numeración productiva.
7. Reabrir y recuperar el mismo intento; confirmar misma cotización, mismos File_ID y mismo PDF. Revisar PDF A4, anexo únicamente del mueble con foto, firma y valores. Registrar evidencia privada fuera del repositorio.
8. Solo con aceptación real y CI verde considerar merge, verificar Cloudflare y dominio habitual. Mantener producción cerrada. La limpieza requiere confirmación separada del identificador exacto.
