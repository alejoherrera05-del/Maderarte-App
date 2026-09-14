# Solución en domicilio y comprobantes

Desde la OP, Recepción y reparación permite registrar una solución ya realizada en casa. Identifica pieza, cantidad, problema, trabajo y responsable; exige confirmación explícita. Genera un expediente RESUELTA_DOMICILIO, origen DOMICILIO, con evento home. No registra recepción, despacho, cobro ni cumplimiento automático de una cita. Una nueva incidencia abre otro caso. Los expedientes terminados están en Ver cerrados.

El contrato warranty-1 admite el evento inicial home. Conserva los permisos, sede, revisión, fence, auditoría, lote atómico e idempotencia de recepción. Borrador de domicilio separado de recepción, por usuario/OP/pieza.

GARANTIA_PDF solicita a Apps Script GARANTIA_COMPROBANTE_DATOS con solo el ID. Se valida expediente y acceso a la OP/sede. El Worker usa exclusivamente ese snapshot autorizado: no acepta HTML, direcciones de renderizado ni datos del documento aportados por el navegador. El motor habitual produce media carta horizontal con la marca aprobada y paginación para textos largos.

Recepción emite la constancia del ingreso original y su responsable inicial, aunque el expediente ya haya avanzado. Domicilio emite la constancia del trabajo registrado. El PDF se regenera desde el expediente guardado y se ofrece para abrir/guardar; esta entrega no archiva una copia binaria adicional en Drive ni crea un nuevo consecutivo comercial. No afirma firma digital, cobertura de garantía, devolución de dinero ni aceptación del cliente.

Pruebas sintéticas: permisos, respuesta perdida, repetición exacta, saldos intactos, datos del comprobante desde backend; interfaz 1440/390/320; PDF real de recepción, domicilio y texto largo. Ninguna recepción o atención comercial real se genera en estas pruebas.

