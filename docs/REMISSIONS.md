# Remisiones y entregas

## Recorrido

OP → cantidades pendientes → seleccionar muebles y cantidades (inicialmente vacías) → transportador y acompañante opcional → verificar físicamente → confirmar despacho → remisión horizontal y PDF dentro del expediente.

La remisión registra la salida del almacén al cargar los productos. Identifica al usuario que despacha, al piallero o propietario que transporta y al operario acompañante, si lo hay. No exige recepción del cliente ni prueba la entrega en destino. El dinero y la OP original se conservan; no se vuelve a emitir la venta. El chulito azul indica cantidades completamente despachadas, con ese significado explícito en pantalla.

## Paridad de experiencia

HomeEasy main revisado: `aa21decbe809a91362a2cddfd272c7c5744dfddd`. No contiene módulo de remisiones; el propietario confirma que es nuevo para Maderarte. Se reutilizan el retorno contextual de `clientes.html`, la búsqueda de OP y el resultado confirmado de `abono.html`, y las tarjetas por producto de Pedido Maderarte. El PDF usa media carta horizontal, con continuación cuando sea necesaria, sin importes y con énfasis sutil en productos y responsables.

## Personal de despacho

El transportador se escribe libremente o se reutiliza desde botones con silueta y nombre. Se distingue piallero, propietario u otro transportador. El operario acompañante es opcional; vacío significa que va solo el transportador. Los nombres se recuerdan al confirmar un despacho, incluyendo la preferencia explícita de favorito. Se guardan en `Catalogos`: `Catalogo=REMISION_TRANSPORTADOR_<SEDE>` o `REMISION_OPERARIO_<SEDE>`, `Valor=nombre`, `Activo=SI`, `Orden=0`, `Descripcion=JSON {favorite,lastUsed,mode}`. La coincidencia ignora mayúsculas y espacios repetidos; nombres de sedes distintas no se mezclan. El entorno del ensayo tiene su propio catálogo.

La fotografía inmutable de cada documento en `Archivos_Orden.Plan_JSON` conserva `dispatcher`, `transporter {name,mode}` y `assistant`. `Remisiones.Responsable` identifica a quien despacha; `Persona_Recibe` permanece vacía porque no se registra recepción en destino. No se cambian encabezados de hojas existentes.

## Control de entrega

- Permisos `ordenes.read`, `remisiones.read` y, para confirmar, `remisiones.create`; sede de la OP validada en servidor.
- El operador confirma la verificación física actual de las cantidades seleccionadas. Esa declaración queda en auditoría, ligada al contenido y al usuario del intento.
- La disponibilidad registrada al vender es solo una condición adicional. Cualquier línea no disponible, con movimientos de producción o desistimientos pendientes de integrar queda bloqueada para revisión operativa. Esta entrega no certifica fabricación ni modifica producción.
- Pendientes calculados desde el ledger confirmado; se rechaza toda diferencia frente a las proyecciones de la OP.
- Concurrencia, número, cabecera, detalle, proyecciones, auditoría e idempotencia comparten el cierre transaccional usado por OP y recibos. Una respuesta incierta conserva el mismo intento.
- PDF independiente del movimiento: un fallo de archivo no vuelve a entregar cantidades.

## Publicación

La operación comercial global sigue en preparación. La aceptación se realiza en la app oficial con el ensayo del propietario y documentos ficticios. No se guardan datos ni PDF del ensayo en Git.
