# Formulario comercial: acuerdos por mueble y captura simple

Base: `5bccdebf89806ba89d2a19a6df0e1c4650c875dc`. Rama: `feat/order-agreements-easy-entry`. PR: [#11](https://github.com/alejoherrera05-del/Maderarte-App/pull/11).

El propietario autorizó aplicar la revisión funcional, aclarando que recogida, envío, transporte y fechas se escriben en observaciones. La revisión sigue realizándose en `app.maderartepopayan.com` después de las pruebas y publicación del cambio solicitado.

## Comportamiento

- Cliente por cédula, con coincidencias integradas. Nombre y teléfono principal son esenciales; segundo teléfono, correo y dirección son opcionales.
- Cada mueble tiene descripción, cantidad y precio; el acuerdo distingue entrega hoy, separado y entrega posterior. Para separado/entrega posterior se indica disponibilidad o necesidad de fábrica. Ninguno registra por sí mismo una entrega o solicitud.
- Acabados, categoría, medidas y fotografías se abren en personalización. Si unidades tienen acuerdos distintos se capturan en líneas separadas.
- Pago libre con varios medios, Addi y notas privadas. La opción sin abono inicial es explícita. Un abono no dispara fabricación ni entrega.
- Distribución opcional del abono para saldos individuales. La suma debe coincidir con el pago, sin exceder el valor neto de cada mueble. El descuento proporcional en pesos completos se explica junto al control.
- Observaciones conserva los acuerdos visibles para el cliente, incluyendo logística. No se añaden preguntas obligatorias de recogida/envío.
- Formulario y documento leen la misma estructura y cálculos. Negativos, cantidades no enteras, descuento excesivo, cliente o mueble incompletos bloquean la vista previa y señalan el campo.
- Total, abono y saldo acompañan la captura del pago. El resumen final también muestra el acuerdo de cada mueble. En el documento, la distribución ocupa el ancho de cada línea; las notas internas se excluyen.
- Recuperación temporal por usuario y tipo de documento en la misma pestaña, durante hasta ocho horas. Se elimina al cerrar sesión o descartar. Al recuperar no se vuelve a buscar automáticamente al cliente ni se sobrescriben sus datos editados. Un fallo de almacenamiento se informa y activa el aviso al salir.

## Verificación

`npm ci` y `npm test` comprueban contratos, permisos, API, cálculos, documentos, captura y recuperación. Las nuevas pruebas incluyen sala que sale hoy + comedor separado, abonos por mueble, cambio de precio/descuento, eliminación de líneas, pagos combinados, privacidad, valores inválidos y aislamiento de borradores.

El workflow existente de Chrome genera capturas de formulario, pagos, distribución y documento a 1440, 390 y 320 px, verifica tamaños, ausencia de desbordamiento, pedido corto A4 y PDF extenso con anexo. Los checks y artefactos del commit final en el PR constituyen la evidencia de publicación; este documento no anticipa su resultado.

La conexión interactiva del navegador de la sesión no respondió. Las capturas inspeccionadas proceden del Chrome del workflow, con datos sintéticos; no prueban interacción física con el teclado de Safari/iPhone.

## Límite

Continúa PREPARACION. No se registran clientes, OP, abonos, entregas ni solicitudes. No se modifica el esquema instalado de Sheets/Apps Script. La próxima etapa de escritura debe persistir estos acuerdos y distribuciones con idempotencia, permisos, auditoría y reglas de remisiones parciales; el borrador temporal no sustituye ese trabajo.
