# Agenda general

La agenda amplía las entregas a compromisos de proveedores, impuestos, servicios y garantías. Conserva Google Sheets, permisos por sede, auditoría e idempotencia. No registra automáticamente pagos ni despachos.

Fuente de experiencia: Homeeasy/main/calendario.html, inspeccionado el 11 de septiembre de 2026: calendario y lista, edición precargada, gesto de borrado, restauración, tipos y repetición mensual. Adaptación aprobada: marca Maderarte y semana compacta expandible en móvil.

Implementación: reutilizar Agenda, preservar registros delivery-1; agregar contrato task-1 para compromisos. Repetición explícita y finita, fechas mensuales ajustadas al último día cuando corresponda. Cada ocurrencia se edita individualmente. Cancelación auditable y restauración con revisión de conflictos.

Validación: permisos, aislamiento de sede, respuestas perdidas, repetición sin duplicados, fechas, cambios concurrentes, restauración y ausencia de escrituras en caja/OP/remisiones; revisión publicada en escritorio y móvil.

