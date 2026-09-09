# Remisiones y entregas

## Recorrido

OP → entregas pendientes → seleccionar cantidades (inicialmente vacías) → persona que recibe y observaciones → confirmar entrega → remisión y PDF dentro del expediente.

Una remisión confirma una entrega realizada. No es una autorización de salida ni una solicitud a fábrica. El dinero y la OP original se conservan; no se vuelve a emitir la venta.

## Paridad de experiencia

HomeEasy main revisado: `aa21decbe809a91362a2cddfd272c7c5744dfddd`. No contiene módulo de remisiones. Se reutilizan el retorno contextual de `clientes.html`, la búsqueda de OP y el resultado confirmado de `abono.html`, y las tarjetas por producto de Pedido Maderarte. Se adapta la selección a cantidades pendientes y el documento a una constancia A4 sin importes.

## Control de entrega

- Permisos `ordenes.read`, `remisiones.read` y, para confirmar, `remisiones.create`; sede de la OP validada en servidor.
- El operador confirma la verificación física actual de las cantidades seleccionadas. Esa declaración queda en auditoría, ligada al contenido y al usuario del intento.
- La disponibilidad registrada al vender es solo una condición adicional. Cualquier línea no disponible, con movimientos de producción o desistimientos pendientes de integrar queda bloqueada para revisión operativa. Esta entrega no certifica fabricación ni modifica producción.
- Pendientes calculados desde el ledger confirmado; se rechaza toda diferencia frente a las proyecciones de la OP.
- Concurrencia, número, cabecera, detalle, proyecciones, auditoría e idempotencia comparten el cierre transaccional usado por OP y recibos. Una respuesta incierta conserva el mismo intento.
- PDF independiente del movimiento: un fallo de archivo no vuelve a entregar cantidades.

## Publicación

La operación comercial global sigue en preparación. La aceptación se realiza en la app oficial con el ensayo del propietario y documentos ficticios. No se guardan datos ni PDF del ensayo en Git.
