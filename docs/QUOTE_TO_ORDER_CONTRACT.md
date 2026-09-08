# Cotización → Orden de pedido

Implementación de #34 en preparación. Referencia inspeccionada: HomeEasy
`aa21decbe809a91362a2cddfd272c7c5744dfddd`, acción «A OP» en `clientes.html`
y precarga por `cotizacion` en `pedido.html`. Se conserva la navegación al
formulario existente; datos, permisos, numeración y persistencia son propios.

## Comportamiento

- El expediente ofrece «Preparar orden de pedido» cuando la propuesta está
  activa, sus documentos completos y la cuenta puede crear órdenes.
- La precarga consulta el origen y todas sus fotografías sin reservar número.
  Un fallo deja una salida a cotizaciones y permite volver a intentar.
- Cliente, sede, muebles, acabados, fotografías, descuento y valores se conservan.
  Se editan acuerdos, disponibilidad, pagos y observaciones. No se supone un abono.
- Guardar utiliza el motor de OP existente. Bajo su bloqueo se revalida el origen.
  La OP y el vínculo inverso de la cotización se escriben en el mismo batch,
  junto con auditoría e idempotencia. No se crean remisiones ni producción.
- Reabrir una cotización convertida conduce a su OP. Ambas pantallas permiten
  navegar al documento relacionado. Los reintentos conservan el mismo requestId.
- El diario pendiente sigue siendo único por cuenta/navegador. No se crea otro
  diario por cotización que permita eludir una operación incierta. Un recibo
  anterior confirmado no elimina el borrador de una cotización diferente.

## Evidencia y publicación

La validación automatizada corre en los workflows existentes de GitHub: contrato
del servidor, pérdida de respuestas y recorrido de navegador a 1440, 390 y 320 px.
El transporte Google de esos workflows es simulado. No constituye aceptación
comercial real y no crea otro ensayo en Drive.

Por instrucción del propietario, se publica y revisa en
`https://app.maderartepopayan.com`, sin QA local ni nueva base aislada real.
`COMMERCIAL_WRITES=false` y `MODO_OPERACION=PREPARACION` se mantienen. Con la base
comercial vacía no se declara demostrada una conversión real; esa aceptación
queda pendiente de la habilitación comercial expresa y del recorrido completo.
