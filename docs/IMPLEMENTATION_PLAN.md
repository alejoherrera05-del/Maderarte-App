# Plan de implementación

## Estado vigente — 16 de septiembre de 2026

Esta sección prevalece sobre los pendientes históricos de abajo. La revisión del propietario y la entrega se hacen en el dominio oficial, sin una segunda app de revisión.

- Publicados: cotizaciones y PDF, OP, abonos y recibos, producción por mueble, remisiones con varios ítems, agenda con fecha/hora y recurrencias, estado de cuenta, desistimientos, saldos a favor, traslados, devoluciones y cambios.
- Garantías: circuito de reporte, visita, recepción, reparación, solución en domicilio y comprobantes. Las fotos no forman parte del alcance solicitado.
- Recaudos: ingresos por sede y medio, con recepción de efectivo. Egresos y caja contable se difieren por decisión del propietario.
- Equipo: permisos individuales por casillas y revalidación de acceso. No incorporar empleados hasta la autorización de estreno.
- Respaldo privado y recuperación aislada: implementación publicada; evidencia operativa guardada fuera del repositorio. La primera ejecución programada aún debe observarse.
- Continuidad de pestañas abiertas: aviso de versión nueva, actualización explícita y protección de formularios/solicitudes. Véase APP_UPDATES.md.

El siguiente cierre es de verificación, no de añadir módulos: completar la matriz del circuito comercial aislado sobre el servicio publicado, comprobar recuperación tras fallos de conexión, observar el respaldo programado y confirmar el uso en Safari físico. Una suite simulada o una vista móvil de escritorio no sustituye estas comprobaciones.

WhatsApp automatizado y contabilidad completa quedan para una etapa posterior. No reiniciar consecutivos, crear operaciones comerciales ficticias ni declarar el sistema al 100% por aprobar solamente pruebas sintéticas.

## Fase 1 — Fundación

- Repositorio público independiente.
- HTML multipágina y sistema visual.
- Firebase compartido y sesión propia preparados.
- Base de Apps Script.
- Ledger de órdenes y expediente en modo lectura.
- Base comercial nueva y vacía.

## Fase 2 — Publicación visual segura

- Adaptar el repositorio a Cloudflare Workers con Static Assets.
- Publicar `public/` y `/api/maderarte` en una unidad de despliegue.
- Obtener una URL temporal `workers.dev`.
- Verificar login, navegación, recursos, 404, cabeceras y respuesta controlada de la API.
- Revisar computador y móvil.
- No configurar todavía secretos ni habilitar escrituras comerciales.
- Auditar los DNS existentes antes de conectar `app.maderartepopayan.com`.

## Fase 3 — Conexión privada

- Crear el proyecto Apps Script oficial.
- Configurar Script Properties.
- Ejecutar `verificarBaseCero()`.
- Desplegar el Web App.
- Configurar secretos de Cloudflare.
- Probar el propietario ya autorizado.

## Fase 4 — Lectura completa

- Centro de operaciones.
- Filtros y búsqueda de OP.
- Expediente con productos, abonos, comentarios, recibos, soportes y remisiones.
- Validación en computador y móvil.

## Fase 5 — Escrituras comerciales

- Clientes.
- Cotizaciones.
- Creación directa de OP.
- Conversión de cotización a OP.
- Abonos y recibos.
- Producción.
- Remisiones.
- Anulaciones y versiones.

## Fase 6 — Documentos e integraciones

- Plantillas PDF aprobadas.
- Envío manual por WhatsApp.
- WAHA y Bridge propios de Maderarte en el VPS actual.
- Reportes y controles administrativos.

## Avance del 9 de septiembre de 2026 — Producción
Primer incremento: preparación de solicitudes al proveedor desde una OP, publicado mediante PR #50. Reglas confirmadas por el propietario y alcance en PRODUCTION_REQUESTS.md. El seguimiento de confirmación, fabricación, transporte y recepción permanece pendiente; preparar o abrir WhatsApp no registra esos movimientos.

## Actualización del 11 de septiembre de 2026

El registro de movimientos por mueble y la recepción parcial ya están implementados y fueron verificados en el ensayo del propietario (PR #57). La OP muestra historial y permite confirmar movimientos explícitos; abrir WhatsApp sigue sin registrar un envío.

Siguiente incremento: continuidad según el estado real. Un mueble pendiente abre la solicitud con su selección; uno en seguimiento abre la actualización de producción; las unidades disponibles llevan a remisión. La solicitud limita cantidades usando los totales registrados por etapa, sin sumar etapas que corresponden a las mismas unidades.

La escritura comercial general sigue en preparación. Quedan pendientes la agenda de entregas, el seguimiento global de pendientes y la validación de activación comercial. No se declara cerrada esa fase por publicar mejoras de interfaz.

## Estado operativo — 14 de septiembre de 2026

Esta sección actualiza el estado histórico anterior: cotizaciones, OP, abonos, remisiones, seguimiento de producción y agenda ya están publicados y habilitados. La agenda admite fecha/hora, obligaciones y recurrencias. Producción tiene consulta global (PR #85). Los desistimientos, saldos a favor, traslados entre OP y registro de devoluciones están publicados (PR #86, Apps Script v20).

El 12 de septiembre se verificaron las lecturas del dominio con cero OP comerciales. Las pruebas de ajustes usaron datos sintéticos; no equivalen a una transacción comercial real verificada. No reiniciar números ni crear ventas ficticias para suplir esa limitación.

Incremento actual: completar el estado de cuenta en Clientes. Mostrar por separado el dinero por pagar y el saldo a favor, conservar el vínculo a la OP de origen y distinguir los recibos históricos del abono neto tras ajustes. Mantener el expediente y sus pestañas; no incorporar compensaciones automáticas.

Pendientes posteriores: conciliación de desistimientos con fábrica, devoluciones de muebles ya entregados, gestión de garantías, reportes administrativos y cierre de caja; WhatsApp propio se mantiene como integración posterior. Priorizar operación y trazabilidad antes de nuevas integraciones.


## Desistimientos con fábrica — 14 de septiembre de 2026

El propietario confirmó que retirar un mueble también lo retira de los pendientes de fábrica y entrega, sin una conciliación adicional ni evidencia de WhatsApp. PR #89 aplica la reducción por etapa junto al ajuste monetario, conserva el historial y las cantidades entregadas y cubre retiro parcial y completo. El estado de cuenta de Clientes y su pulido ya fueron publicados mediante PR #87 y #88.

## Devoluciones y garantías — 14 de septiembre de 2026

PR #90 publicó recepción física de muebles devueltos, reintegro separado y continuidad del cambio mediante nueva OP y traslado explícito de saldo. Servicio v22. Once verificaciones y cinco PDF de muestra; las pruebas no crearon operaciones comerciales reales.

Siguiente incremento: programar la revisión de garantía desde el mueble de la OP utilizando Agenda. Recupera cliente y contexto; admite describir una parte del conjunto, como una silla. Marcar realizada la visita no declara solucionada la garantía. Véase WARRANTY_VISITS.md.

Después: recepción y seguimiento de reparaciones, incluidos productos que trae el cliente; reportes administrativos/caja; integración propia de WhatsApp. No se imponen plazos ni cobertura automática de garantía.

## Recepción y reparación — 14 de septiembre de 2026

PR #91 publicó la programación contextual de revisiones. PR #92 incorpora recepción de mueble o pieza, ingreso por cliente/recogida, responsable, diagnóstico, reparación, listo y entrega nominal con historial. No altera la venta ni convierte el cumplimiento de una cita en reparación. Véase WARRANTY_REPAIRS.md. Pendientes: resolución registrada en domicilio, comprobante de custodia/fotos, reportes administrativos y caja, WhatsApp propio.


## Garantías unificadas — 14 de septiembre de 2026

PR #93 publicó resolución en domicilio y comprobantes. PR #94 conecta Inicio, reporte inicial, OP, visita y recepción bajo el mismo expediente. Agenda dirige nuevas garantías al hub y conserva las citas históricas. No se migra ni se vincula automáticamente un registro antiguo ambiguo. Pendientes: fotos, comprobante final de entrega reparada, caja e informes.



## Comprobante final de garantía

Se incorpora PDF de entrega desde el expediente cerrado. Conserva por separado la recepción original, usa el último trabajo terminado y la entrega nominal guardada, y no crea una remisión de venta ni un movimiento monetario. Fotos y reportes/caja siguen pendientes.
