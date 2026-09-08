# Maddy — progreso de marca y recibos independientes

## Aclaración del propietario — 8 de septiembre de 2026

Registrar abono debe conservar el recorrido de HomeEasy: módulo independiente de recibo de caja, selección de la OP y sincronización con su cuenta. El expediente puede enlazar a ese mismo módulo con la OP preseleccionada; no debe contener un segundo motor de cobro ni ser la única entrada.

La pantalla de progreso publicada en #25 fue rechazada visualmente por plana y genérica. La corrección debe recuperar una ventana protagonista sobre una cubierta de toda la aplicación, identidad Maddy/Maderarte y pasos legibles. No basta con agrandar la lista.

## Referencia inspeccionada

Repositorio funcional: `alejoherrera05-del/Homeeasy`, main `aa21decbe809a91362a2cddfd272c7c5744dfddd`.

- `index.html`: entrada propia a `abono.html` (Registrar abono / Recibo de ingreso); cubierta de marca, jerarquía y panel de estado.
- `abono.html`: localizar OP o nombre, cargar cliente e historial, importe y medio de pago, concepto del recibo, saldo anterior y nuevo; acción Confirmar y Sincronizar; validación remota del saldo y presentación de estados. Referencias: `buscarOrden`, `calcularSaldo`, `finalizarAbono`, `setStep`.
- `abono.html`: `.loading-overlay` cubre la aplicación; `.glass-loader` es la ventana; filas `.step-item` reflejan las etapas. `index.html` aporta presencia del personaje y marca.

La inspección de código no sustituye una prueba de cobro real ni certifica todos sus escenarios. Las pruebas anteriores de HomeEasy no se heredan automáticamente al cambiar backend, permisos, numeración y estructura.

## Adaptación funcional acordada (pendiente de implementación)

1. Módulo independiente **Recibos de caja**, accesible desde Inicio; buscar OP o cliente, elegir la cuenta exacta y mostrar historial y saldo confirmado.
2. Capturar importe y medio; separar concepto visible para el cliente de nota interna. Conservar reglas de Maderarte, sedes y permisos, no copiar identificadores ni datos de HomeEasy.
3. Confirmar una sola operación con identidad persistente y validación de saldo en el servidor, incluso ante concurrencia. No habilitar una escritura usando únicamente el saldo en caché.
4. Registrar el abono una sola vez, asignar recibo, actualizar la cuenta de esa OP, generar PDF con la familia documental aprobada y archivarlo en `02_RECIBOS_Y_ABONOS`.
5. Si el PDF falla después del abono, conservar el movimiento y recuperar su documento sin cobrar de nuevo. Comprobar enlaces y lectura final antes de declarar documentación completa.
6. El enlace desde el expediente abre este mismo módulo. No duplicar el pago inicial ya registrado al crear la OP. Pagar no cambia producción ni acredita una entrega.
7. Sincronizar la cuenta de Maderarte, nunca cuentas/datos de HomeEasy. Esto no incorpora un módulo general de tesorería, integración bancaria ni contabilidad completa.

## Alcance del ajuste visual actual

Solo presentación/observación del guardado existente. Conservar `createOrderProgress`, sus cinco etapas y eventos, recuperación, accesibilidad del diálogo, bloqueo de doble acción, mensajes de espera y respeto a movimiento reducido. Ningún timer confirma operaciones. No cambiar Apps Script, banderas comerciales, documentos archivados ni la lógica del pedido.

Usar el personaje gris/naranja aprobado, como recurso optimizado, sin regenerar rostro, ropa o marca. La interfaz mantiene fondo gris claro y tipografía 400–600; paneles con profundidad discreta, acento naranja, estado activo claro y buen contraste.

## Aceptación

Capturas reales de navegador en escritorio y móvil; revisar inicio, espera, fotos, PDF, confirmación y recuperación. Verificar ausencia de recortes, control por teclado, reduced motion, imagen ausente y reintentos. Informar por separado implementación visual, ensayos automatizados con Google simulado y aceptación comercial real.