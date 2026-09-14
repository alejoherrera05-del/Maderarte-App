# Resumen administrativo

Primer incremento de lectura. No equivale a cierre de caja ni a saldo bancario. El conteo de efectivo, bases y gastos depende de la operación que confirme el propietario.

- Recaudos del periodo: abonos activos que afectan saldo, según fecha de pago en Colombia. Los pagos iniciales forman parte del mismo ledger y se cuentan una sola vez.
- Reintegros del periodo: ajustes DEVOLVER confirmados. DESISTIR/RETORNAR no son salidas de dinero y TRANSFERIR no es un ingreso nuevo.
- Neto de cobros: recaudos menos reintegros; no se rotula saldo disponible. Los reintegros actuales no tienen medio de pago estructurado, por lo que no se descuentan automáticamente del efectivo.
- OP del periodo: órdenes emitidas en el rango, con su valor vigente. El valor vigente puede incorporar ajustes posteriores y no se presenta como una venta histórica inmutable.
- Saldos actuales: deuda y saldo a favor por separado, para todas las OP vigentes de las sedes permitidas. No depende del rango de movimientos ni realiza compensación automática.

Cada detalle vuelve a la OP. La consulta necesita reportes.read, ordenes.read y abonos.read; el propietario ya tiene *. No amplía roles automáticamente. Se lee bajo el mismo bloqueo de operaciones para evitar combinar datos de una escritura a medias; falla si existe un intento pendiente de conciliación. No devuelve notas internas, credenciales ni datos de otras sedes.

Referencia inspeccionada: Homeeasy/caja.html y homeeasy-caja-correcciones.css vigentes. Conservar resumen jerárquico, filtros legibles, feed de movimientos, controles táctiles y regreso directo. Adaptar a gris/cobre/grafito Maddy. No copiar PIN, saldo de caja ni captura de gastos antes de definir sus reglas.

Fotografías de garantías descartadas por indicación expresa del propietario.
