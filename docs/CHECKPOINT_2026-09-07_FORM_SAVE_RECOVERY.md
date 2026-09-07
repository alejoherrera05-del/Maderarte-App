# Conexión del formulario con el guardado y recuperación

Base verificada: db1d88359a614e10f6d67a37604cacc0b238ac29 (PR #17).
Rama: feat/order-form-save-recovery.

El propietario confirmó la actualización de Apps Script y compartió una ejecución correcta de verificarBaseCero: 23 pestañas, PREPARACION, commercialWrites:false y base comercial vacía. Ese resultado no certifica todavía una transacción real en Google.

## Alcance de este siguiente hito

- Conservar formulario y documento aprobados.
- Conectar la captura al contrato del servidor sin descartar notas internas, pagos o fotografías.
- Preparar envío único y consulta de resultado tras respuesta incierta/recarga.
- Mantener el guardado cerrado mientras capacidades del servidor, documentos/fotos y aceptación operativa no estén completos.
- Probar escenarios de fallo con datos sintéticos; no crear ventas en producción.

Checkpoint de inicio; resultados de implementación y pruebas pendientes. No modifica Apps Script, esquema instalado, secretos ni banderas de operación.
