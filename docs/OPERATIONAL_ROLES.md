# Permisos operativos

La matriz aprobada se aplicó el 16 de septiembre de 2026 mediante la conexión existente a Google Sheets. Se agregaron permisos a ADMINISTRADOR, VENDEDOR y CONSULTA conservando los permisos anteriores, las personas y sus sedes. PROPIETARIO y BODEGA_LOGISTICA no cambiaron. Roles.Permisos_JSON sigue siendo la fuente efectiva de autorización.

La actualización de las tres filas y su auditoría se realizó en una sola operación batchUpdate, precedida y seguida por lecturas de comprobación. No se crearon usuarios ni movimientos comerciales.

El servicio publicado permanece en v28. No se necesita una publicación de Apps Script para actualizar las filas de Roles. Se descartó la migración por editor porque requería un alcance OAuth de identidad que el manifiesto no tiene; el editor se restauró al respaldo exacto. Este PR contiene la matriz de referencia de solo lectura y pruebas automatizadas con transporte Google sintético, sin conceder accesos al cargarlo.

Las pruebas cubren cotización, cliente, PDF, conversión a OP, abono, remisión de varios productos, recepción en bodega, recaudos, lectura y denegaciones por rol, sede y autor. Los PDF en pruebas son bytes sintéticos de transporte, no una comprobación de su diseño ni de operaciones reales.
