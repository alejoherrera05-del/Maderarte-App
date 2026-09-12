# Ajustes de una OP emitida

## Revisión del 12 de septiembre de 2026

Base examinada: `7003c76674204b16194d8cd6aa3ff4d3c4723990`.

El siguiente incremento mantiene la OP como expediente. Las líneas emitidas, cobros, remisiones y documentos anteriores no se borran. La vista global de Producción ya está publicada mediante PR #85; su consulta en operación devuelve cero pendientes actualmente. El ensayo anterior no puede usarse mientras exige PREPARACION en la base original.

## Dependencias comprobadas en el código

- `Receipts.gs:rcPosition_` rechaza abonado mayor que total. Reducir una OP sin adaptar esta lectura bloquearía sus recibos. `rcHistory_` también usa el total de la OP para conciliar el PDF: debe conservar el contexto histórico de cada recibo.
- `OrderMedia.gs:mdAccess_` y el flujo de medios tienen restricciones de versión inicial. Una corrección necesita un documento nuevo ligado al anterior, sin sustituir el PDF emitido.
- `Remissions.gs` bloquea líneas con cantidad desistida. Después de un ajuste válido debe permitir solo cantidades todavía pendientes y disponibles, conciliadas desde los movimientos.
- `ProductionOverview.gs` lleva cualquier línea desistida a revisión. Debe distinguir un ajuste confirmado de un dato inconsistente, sin dar por cancelada una solicitud al proveedor.
- `order-lifecycle.js` calcula reducción parcial y saldo a favor, pero no implementa una transacción ni autoriza escritura. No se puede presentar ese cálculo como un ajuste guardado.
- `Anulaciones`, `Auditoria`, `Versiones_Documentos` e `Idempotencia` existen. No hay todavía movimientos persistidos de devolución de dinero ni aplicación de crédito a otra OP.

## Decisión comercial pendiente

El propietario debe definir qué ocurre con el dinero cuando un cliente desiste: saldo a favor, devolución o resolución caso por caso, y si existe una penalidad. No asumir porcentajes, retenciones, devolución automática ni transferencia a otra OP. Mientras esta decisión esté pendiente no activar escrituras de desistimiento o devolución.

## Implementación conjunta

1. Presentar selección de cantidades pendientes, motivo y resumen antes/después dentro del expediente; conservar contexto de OP e ítem.
2. Resolver revisiones de fábrica, entrega física y asignación de abonos. Una devolución física no equivale a anular un documento.
3. Registrar ajuste, cantidades y proyecciones mediante el lote atómico existente, con permiso, sede, versión y Request_ID ligado al contenido; conservar auditoría.
4. Mostrar total vigente, cobros netos, saldo por pagar y saldo a favor por separado, según la política confirmada. No redistribuir descuentos emitidos.
5. Emitir una nueva versión documental recuperable sin repetir el ajuste si falla Drive. Conservar los recibos históricos.
6. Adaptar Producción, Remisiones y la cuenta de la OP al mismo movimiento confirmado.

## Verificación requerida antes de activar

Doble clic; reintento tras timeout; contenido diferente con igual Request_ID; revisión desactualizada; permisos y sede; cantidades entregadas; pedido a fábrica; descuentos con residuos en pesos; saldo a favor; asignaciones previas; fallo de PDF y recuperación; documentos históricos; navegación y revisión móvil.

La referencia vigente `Homeeasy/main/ventas.html` se revisó para el listado y drawer de expediente. Ese archivo no aporta un flujo de desistimiento que pueda trasladarse directamente. Para la interacción nueva se conserva el expediente Maddy aprobado y sus controles compartidos.
