# Historial acumulado en recibos

Solicitud del propietario: cotización guardada → conversión a OP → cuatro abonos → revisión de todos los PDFs y del historial en el último recibo.

Base main: 2be69d6e6298d2d7ed5f57fb999e20164b633c45. Rama feat/receipt-payment-history.

El historial visible en la cuenta se incorpora al plan documental del recibo. Cada PDF conserva una fotografía de los pagos hasta su emisión, con número, fecha, medio y valor; no incorpora notas internas ni pagos posteriores. Se incluyen los pagos iniciales una sola vez. Conserva media carta horizontal y agrega páginas de historial cuando sea necesario, sin cortar ni ocultar registros.

La elección entre ensayo con datos ficticios en Google real y venta auténtica está pendiente de aclaración del propietario. Esta corrección no activa escrituras comerciales globales.
