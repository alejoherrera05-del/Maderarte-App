# Documentos de órdenes — PR #21

Base original: c6f1b11d443041447ae483e5265c4123ad72ff9a. Rama: feat/order-media-documents. Se conserva la aprobación del formulario y del documento del PR #16.

## Implementado

`OrderMedia.gs` reserva identidades de fotos, PDF, carpetas y filas documentales dentro del mismo lote de la venta. Drive usa IDs pregenerados y lectura por identidad para resolver respuesta perdida. La finalización actualiza filas ya reservadas, no agrega otra OP ni cobra de nuevo. La estructura conserva 02_DOCUMENTOS_CLIENTES/año/mes/cliente/OP y sus subcarpetas aprobadas.

Las fotos viajan como manifiestos inmutables (identidad, nombre, tipo, tamaño y SHA-256). Los bytes se suben por separado después de confirmar la OP. Se comprueban tamaño, firma del tipo y huella; hasta seis referencias por mueble, 24 por pedido, 700 KB preparados por foto y 8 MB preparados en total. Las imágenes grandes se preparan antes del comando inmutable. Una referencia faltante no se omite: conserva pendiente la documentación y admite recuperar la misma foto desde el expediente.

El PDF utiliza exactamente el renderizador y paginador aprobados, con un modo emitido que elimina la leyenda Borrador sin cambiar la vista previa. La fuente es una copia pública de los datos confirmados por el Cerebro: no incluye notas internas. El Worker usa BROWSER.quickAction, URL fija de la aplicación, JSON inerte, recursos del mismo dominio y anexo solo con fotografías. El navegador de PDF no recibe cookies del asesor, secreto del proxy ni URLs elegidas por el cliente.

La reapertura consulta fotos y PDF a través de la API autenticada; no necesita publicar Drive para todo el mundo. Se aplica alcance de sede a lectura y finalización; la edición documental exige permiso y responsable/administrador. Las rutas internas del generador no se exponen como acciones de cliente.

## Integración y pruebas

- 222 comprobaciones previas del lote de órdenes y 64 del cliente.
- `test-order-media.mjs`: reservas, Drive por identidad, respuesta perdida, hash y MIME, aislamiento de notas, dos órdenes del mismo cliente, esquema idempotente y recuperación documental. Sus servicios Google son simulados.
- `test-order-document-flow.mjs`: orquestación del cliente y Worker, límites, PDF autorizado, mismo identificador y aislamiento de recursos.
- `order_document_render_qa.py`: Chrome y PDF reales, CSP, anexo, ausencia de anexo sin fotos y bloqueo de imagen inválida.
- `order_documents_browser_qa.py`: formulario original con dos referencias, servidor simulado, generación real del PDF aprobado y reapertura; respuestas perdidas en foto y PDF; 1440, 390 y 320 px.
- Regresiones previas del formulario, cotización y documentos continúan en CI.

Las pruebas anteriores no son escrituras reales a Google y no prueban por sí solas el binding BROWSER instalado. El workflow temporal que transportó el lote de código se retira antes de fusionar; el workflow permanente de QA tiene únicamente contents:read.

## Instalación pendiente de acceso del propietario

El Cerebro de Apps Script no se despliega al publicar Cloudflare. Seguir `INSTALACION_CEREBRO_MANUAL.md`: sustituir el archivo completo, verificar base vacía, ejecutar prepararDocumentosOrdenes, ejecutar diagnosticarDocumentosMaddy y publicar Nueva versión de la implementación existente.

El preparador amplía el esquema de guardado y agrega Carpetas_Documentales + Archivos_Orden (25 pestañas físicas, 23 contratos originales). No habilita operaciones ni crea datos comerciales. La página /diagnostico-documentos.html comprueba con config.read el Cerebro, Drive y la generación real de un PDF técnico sin vender ni almacenar documentos.

## Límite de aceptación

COMMERCIAL_WRITES continúa false y PREPARACION no cambia. La habilitación requiere además ORDER_SAVE_ENABLED, ORDER_DOCUMENTS_ENABLED y aceptación explícita ORDER_DOCUMENTS_ACCEPTED; no activarlas por el mero éxito de CI o diagnóstico. Hace falta el recorrido con sesión real y datos aislados: Guardar → fotos → carpetas → PDF automático → enlaces → reapertura → reintento sin duplicados.

No se importó la orden de la prueba asistida. No se modificó la base original ni se ampliaron permisos de Drive durante el desarrollo. Recibos individuales, remisiones, devoluciones y solicitudes de producción conservan su fase propia; guardar la OP no finge esos movimientos.

## Fuentes primarias

https://developers.cloudflare.com/browser-run/quick-actions/
https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/
https://developers.google.com/workspace/drive/api/guides/create-file
