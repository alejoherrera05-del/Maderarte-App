# Recaudos

Control de ingresos registrados y recepción del efectivo. No es caja contable, saldo bancario ni control de egresos.

- Día, semana (desde lunes), mes y rango personalizado, según fecha de pago en Colombia.
- Sede de origen y medio de pago: efectivo, datáfono, Addi y transferencia.
- Cada abono activo que afecta saldo, incluido el inicial de la OP, se cuenta una vez. Trasladar saldo no genera ingreso. Se muestra recaudo bruto sin descontar reintegros ni gastos.
- Propietario o administrador selecciona uno o varios recibos y confirma que recibió el efectivo físicamente. Se conserva recibo, OP, sede, importe, receptor y fecha.
- Recoger Terraplaza no genera un segundo ingreso ni modifica el abono o saldo del cliente.
- Acceso desde Inicio → Recaudos. Cada movimiento vuelve a su OP. Se requieren permisos de órdenes/abonos y se respetan sedes autorizadas.

## Persistencia y recuperación

Recepciones_Efectivo se crea en la primera recepción autorizada. Leer no la crea. Encabezados: ID, Numero_Recibo, Numero_OP, Sede, Valor, Fecha_Pago, Registrado_Por, Recibido_Por, Nombre_Receptor, Fecha_Recepcion, Request_ID.

Recepción, auditoría e idempotencia se guardan en un solo batch bajo ScriptLock y la barrera compartida de recuperación. Un recibo ya recibido no se admite otra vez. El navegador conserva el intento antes de enviarlo y consulta o reintenta con el mismo identificador ante una respuesta incierta. No se permite desmarcar una recepción sin trazabilidad.

## Referencia y validación

Se inspeccionaron Homeeasy/caja.html y homeeasy-caja-correcciones.css. Se adaptan resumen, filtros, movimientos y controles táctiles a Maddy. El propietario excluyó PIN, caja contable y egresos.

scripts/test-collections.mjs verifica totales, sedes, fecha colombiana, creación de tabla, respuesta perdida y ausencia de cambios en los registros comerciales. scripts/collections_browser_qa.py verifica interfaz en 1440, 390 y 320 px con transporte sintético. Las evidencias no representan cobros reales.

Fotografías de garantías descartadas por indicación expresa del propietario.
