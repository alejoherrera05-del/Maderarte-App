# Reglas comerciales

## Perfil comercial oficial

Los datos públicos de empresa usados por formularios y documentos viven en `public/js/core/company-profile.js`. Cotizaciones, pedidos, PDFs, recibos y demás documentos deben reutilizar esa fuente y no duplicar razón social, NIT, teléfonos, web, redes o direcciones de sedes en múltiples archivos.

## Base cero

- Clientes, cotizaciones, órdenes, abonos, remisiones y documentos comienzan vacíos.
- El primer cliente y la primera OP se crearán desde Maderarte App.
- Ninguna rutina importa información desde otra aplicación o archivo.

## Orden de pedido

- La OP es el expediente central de una venta.
- Puede nacer directamente o desde una cotización.
- Debe contener al menos un producto.
- `Valor_Total`, `Abonado_Total` y `Saldo_Pendiente` deben permanecer consistentes.
- Una OP anulada conserva registros, documentos y auditoría.
- Por aclaración del propietario del 5 de septiembre de 2026, **no existe un porcentaje obligatorio de abono**. El asesor indica el valor acordado; se admiten separados con $50.000, $100.000 u otro importe positivo.
- **Un pedido puede ser mixto**: sala disponible para entrega inmediata y comedor por solicitar a fábrica, dentro de una misma OP.
- Aclaración más reciente del 6 de septiembre: **una sola elección dentro de cada mueble**: `ENTREGA_INMEDIATA`, `PARA_SOLICITAR` o `SEPARADO`. Sin bloque de acuerdo común ni una segunda pregunta obligatoria de disponibilidad.
- La elección describe lo que se planea hacer. Entrega inmediata no confirma una remisión; Solicitar a fábrica no confirma una solicitud enviada; Separado no implica importe mínimo ni solicitud automática.
- La disponibilidad física actual y las cantidades entregadas se gestionarán en la operación correspondiente. No confundir la elección de venta con una entrega, producción o reserva ya confirmada.
- Recogida, envío, fechas y transporte se escriben en **Observaciones**, por indicación expresa del propietario; no añadir preguntas obligatorias de logística.
- La referencia de **25 a 30 días** aplica solo a los muebles por solicitar, desde la confirmación de su solicitud. No se impone un plazo de fabricación a los disponibles ni un umbral automático de pago.
- Marcar un mueble como disponible no crea una remisión ni confirma una entrega realizada. El borrador tampoco envía solicitudes a fábrica.
- Saldo, separado, solicitud a fábrica y cantidades entregadas son estados diferentes. Pagar el total no marca automáticamente ningún mueble como entregado.

## Contacto y observaciones

- Aclaración del propietario posterior al checkpoint del formulario: cédula/NIT, nombre, teléfono principal, correo, dirección y ciudad son obligatorios en Cotización y Pedido. Solo el segundo teléfono es opcional. Cuando el cliente no tiene correo, se escribe `N/A`; no aceptar el campo vacío ni inventar una dirección de correo.
- El cliente puede tener teléfono principal y segundo teléfono opcional; ambos se conservan como texto y se muestran en el documento si se diligencian.
- `Clientes.Telefono_Alterno` y `CLIENTE_OBTENER.alternatePhone` ya existen. Cotización y Pedido deben reutilizarlos.
- **Observaciones del pedido** contiene acuerdos que ve el cliente: recogida o envío, fechas, obsequios de cojines, transporte incluido a una ciudad, instalación u otras condiciones.
- **Nota interna del pago** identifica para el equipo la cuenta receptora, banco u otro detalle. No aparece en la OP/PDF/recibo del cliente ni se mezcla con observaciones públicas.

## Productos

- Cada producto vive en `Orden_Items`.
- Se guardan descripción, categoría, referencia, cantidad, unidad, valor, acabados, medidas y especificaciones.
- Las cantidades entregadas nunca pueden superar las cantidades vendidas.
- En la experiencia de captura de Maderarte, medidas y detalles técnicos se agrupan dentro de `Especificaciones` cuando no requieren un campo operativo independiente.
- Las fotografías de referencia pertenecen al item concreto y, cuando existan, deben aparecer en un anexo fotográfico separado del documento comercial principal.
- Si un campo opcional no fue diligenciado, no debe imprimirse como etiqueta vacía ni con guiones/placeholders en el PDF final.
- Si ningún item tiene fotografías, el PDF final no debe generar una hoja de anexo fotográfico vacía.

## Abonos

- Cada pago genera una fila independiente en `Abonos`. Se permiten efectivo, transferencia, tarjeta y Addi, y varios pagos/medios en la misma operación. Cada parte conserva su importe y nota interna; el abono total es la suma de esas partes.
- Todo abono pertenece a una OP existente y activa.
- El valor debe ser mayor que cero y no puede exceder el saldo sin una regla administrativa explícita.
- El comentario público, referencia, PDF y soporte se conservan con el recibo. La nota interna requiere un campo separado y acceso autorizado; no reutilizar `Comentario` para información privada.
- Al registrar el pago se actualizan total abonado, saldo, último abono, fecha y resumen de comentarios de la OP.
- La aplicación muestra el historial completo, no solo el último pago.

## Drive

- Cada cliente tiene una carpeta dentro del mes de su primera operación del año.
- Cada OP tiene su propia carpeta dentro del cliente.
- Orden, recibos, remisiones y soportes se separan en subcarpetas.
- El Sheet conserva enlaces directos para acceder desde la OP.

## Escrituras

- Toda operación usa `Request_ID`.
- Las escrituras sensibles usan `LockService`.
- Los permisos se comprueban en Apps Script, no solo en la interfaz.
- Toda modificación relevante registra usuario, fecha, valor anterior y valor posterior.

## Preparación actual y siguiente contrato de escritura

El formulario de preparación permite indicar el destino de cada mueble, pagos y notas internas, pero todavía no guarda una operación comercial ni confirma cobros. El documento los identifica como «Abono indicado» y conserva la marca de borrador. Sin pagos, el abono indicado es cero y el saldo corresponde al total; no se emite un recibo ficticio. Valores negativos, medios faltantes y sumas superiores al total deben corregirse antes de generar la vista previa.

Antes de activar escrituras: persistir la elección por mueble en cada `Orden_Items` y distinguirla de producción/entrega ejecutadas; persistir el teléfono alterno y cada pago por separado; agregar un campo dedicado `Nota_Interna` a Abonos, con pruebas de privacidad en OP/recibos. El esquema instalado no se modifica desde esta entrega. Ningún dato de pago se envía a Apps Script en modo preparación.

## Pagos generales y validaciones de captura

- El abono y el saldo pertenecen a la OP completa. El propietario eliminó la captura y visualización de abonos/saldos por mueble.
- No repartir pagos, exigir asignaciones ni mostrar saldos individuales en el formulario o PDF. Las asignaciones de borradores antiguos se ignoran al recuperar; sus pagos reales escritos se conservan.
- Un descuento general modifica el total del pedido. La preparación del neto por línea para futuros ajustes es interna, no un reparto de abonos que deba diligenciar el vendedor.
- Se admite explícitamente una orden sin abono inicial. No se imponen mínimos ni pago completo para acordar entrega. El saldo no controla automáticamente la entrega.
- Vista previa requiere identificación, nombre, teléfono, correo (o `N/A`), dirección, ciudad, descripción, cantidad entera positiva, precio positivo, elección por mueble. Únicamente el segundo teléfono es opcional entre los datos del cliente.
- Los valores inválidos permanecen escritos y se señalan para corregirlos. El formulario y el documento comparten lectura y cálculo; no cambiar negativos a positivos ni recortar descuentos excesivos.

## Recuperación temporal

- Copia temporal de la captura en `sessionStorage`, por usuario y tipo de documento, en la misma pestaña. Caduca a las ocho horas; se descarta al cerrar sesión o desde el propio formulario.
- Recupera cliente, líneas, acuerdos, pagos, notas y fotografías compatibles. No constituye escritura comercial, respaldo oficial ni sincronización entre dispositivos.
- Si el almacenamiento falla, se informa y se advierte al salir. No mostrar un borrador antiguo como si fuera el actual después de un fallo.


## Remisiones y desistimientos: contrato para la siguiente etapa

Consultar `ORDER_LIFECYCLE.md` antes de implementar escrituras. Los movimientos de entrega, cantidad desistida y dinero deben conservar identidad, versión e historial. Un acuerdo de entrega hoy nunca confirma una entrega. Las remisiones nuevas seleccionan cantidades pendientes por mueble y OP; no vuelven a ofrecer cantidades ya entregadas o desistidas.

En borradores, Eliminar permite Deshacer las últimas 20 eliminaciones, incluso tras recargar la misma pestaña dentro de la vigencia del borrador. Se recuperan los datos del mueble, su identidad, elección y fotos. Los pagos y las ediciones posteriores se conservan. Si el nuevo total es menor que el abono indicado, mostrar el exceso y exigir revisión; no mostrar saldo cero ni inventar una devolución.

En una OP emitida no se borrará la línea: se registrará un desistimiento con su motivo y efectos. Cantidades ya entregadas requieren devolución; una solicitud a fábrica exige revisión. Precios netos emitidos no se redistribuyen entre los muebles que quedan. Un eventual saldo a favor se muestra separado y su aplicación/devolución requiere un movimiento explícito. Estas transacciones aún no están implementadas ni habilitadas.


Al adaptar borradores anteriores, conservar datos del cliente, productos, fotos, pagos, notas y Deshacer. Las elecciones anteriores con equivalencia clara se recuperan; los detalles adicionales de disponibilidad/entrega se conservan en observaciones. Una elección anterior ambigua queda vacía y exige seleccionar; no convertirla automáticamente en separado ni fábrica. Los borradores nuevos conservan su elección sin herencia común.
