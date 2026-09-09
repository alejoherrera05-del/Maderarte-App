# Verificación — solicitudes a fábrica

Implementación: 1b54ef83d60a57cbeecc77aa87238f79fcbcb2c1, PR #50.

Las seis suites de GitHub finalizaron correctamente, incluidas npm ci/npm test y production_browser_qa.py. Capturas en el artefacto remissions-qa del run 34393702184, carpeta artifacts/production/. Revisión de entrada, formulario y mensaje a 1366, 390 y 320 px.

Comprobado: búsqueda por cliente y OP directa, consulta sin coincidencias, recuperación de error, selección inicialmente vacía, disponibles/por definir bloqueados, cantidades válidas, aviso explícito para separados, mensaje con especificaciones, exclusión de importes y contacto del cliente, URL de WhatsApp sin envío automático, copia al portapapeles, invalidación del mensaje al editar, reinicio con otra OP y aislamiento del ensayo. Las pruebas no envían mensajes ni registran movimientos comerciales.

Revisión visual: formulario en dos columnas en escritorio y una en móvil, controles legibles de 16 px, sin overflow horizontal. Se corrigió la posición de revisión con scroll-margin para que el encabezado fijo no tape el título del mensaje; comprobación incluida en el runner. Fotografías/OP abren en otra pestaña y conservan el formulario preparado.

Alcance: preparación de texto al proveedor. Las fotos se adjuntan manualmente en WhatsApp. No persiste ni confirma la solicitud; no habilita recepción en bodega ni cambia disponibilidad. El seguimiento transaccional se implementará en el siguiente incremento del contrato PRODUCTION_REQUESTS.md. No se ha certificado una entrega/fabricación real.
