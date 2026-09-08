# Progreso de guardado y acabado del PDF — 2026-09-07

Base: PR #23. Ajuste solicitado después del ensayo real del propietario: retroalimentación de guardado, saldo general y tipografía menos pesada. Se conserva el formulario y la composición del documento aprobados.

## Progreso basado en respuestas

`order-progress.js` presenta un diálogo modal accesible con cinco etapas: preparar datos/referencias, registrar pedido/pagos, guardar fotografías, crear/archivar PDF y comprobar archivos. No utiliza porcentajes, éxitos cronometrados ni pasos decorativos. El tiempo transcurrido es únicamente informativo.

El cliente publica eventos tras las respuestas correspondientes. Una foto requiere identidad/orden correctas y `ready:true`. La etapa de archivo agrupa la creación de carpetas y PDF porque el servidor las realiza en una misma solicitud; no simula confirmaciones separadas. Después de finalizar se consulta otra vez el estado documental y se exige PDF, referencias y enlaces listos.

Un error conserva los pasos confirmados y muestra la etapa sin confirmar; permite regresar a los controles existentes para recuperar el mismo intento. No aborta la operación, no cambia el identificador y no reenvía pagos. El bloqueo empieza antes de la preparación de imágenes. Se respeta reducción de movimiento; el resto de la pantalla no se puede editar durante la operación.

## Documento

Se muestra solo el saldo general del pedido: total menos pago inicial confirmado. El reparto de abonos y los saldos por mueble permanecen ocultos. Los datos confirmados con saldo incoherente se rechazan antes de emitir el PDF.

`commercial-document-refined.css` comparte el acabado entre cotización y pedido. `pedido-document-refined.css` conserva solo el resumen y el saldo propios de la OP. Véase DOCUMENT_FAMILY_REFINEMENT.md para la extensión solicitada por el propietario.

## Comprobación y alcance

Se añadieron 49 comprobaciones de eventos, referencias, ausencia de fotos, fallos de subida/PDF/relectura y recuperación. La prueba de navegador bloquea deliberadamente cada respuesta para comprobar que los checks no se adelanten. Escritorio y móvil: 1440, 390 y 320 px, con CSP y reducción de movimiento. La prueba del renderizador verifica saldo visible, pesos <=500, PDF con/sin anexo e imagen inválida.

La integración inicial pasó npm test, prueba de progreso y renderizado en GitHub Actions. El PR ejecuta de nuevo las regresiones completas sobre la revisión final. Los servicios de Google son SIMULADOS en estas pruebas; no se escriben órdenes reales ni se cambia la aceptación comercial.

No cambia Apps Script, sus propiedades, el esquema o las banderas. No requiere reinstalar el Cerebro. No modifica los PDFs que ya están archivados en Drive: la plantilla nueva aplica a documentos nuevos. Una muestra visual regenerada localmente no sustituye el original archivado.

Los archivos temporales de aplicación se retiran antes de fusionar. El workflow permanente de QA tiene exclusivamente contents:read.
