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
- La disponibilidad pertenece a cada línea de `Orden_Items`: `DISPONIBLE`, `PARA_SOLICITAR` o `POR_DEFINIR`. No se deduce de los pagos y no se preselecciona en el formulario. Si unidades del mismo mueble tienen disponibilidades distintas, se capturan en líneas separadas.
- **Separado** es una condición opcional del pedido, independiente de la disponibilidad por mueble. Permite pagos sucesivos y no autoriza automáticamente fabricación.
- La referencia de **25 a 30 días** aplica solo a los muebles por solicitar, desde la confirmación de su solicitud. No se impone un plazo de fabricación a los disponibles ni un umbral automático de pago.
- Marcar un mueble como disponible no crea una remisión ni confirma una entrega realizada. El borrador tampoco envía solicitudes a fábrica.
- Saldo, separado, solicitud a fábrica y cantidades entregadas son estados diferentes. Pagar el total no marca automáticamente ningún mueble como entregado.

## Contacto y observaciones

- El cliente puede tener teléfono principal y segundo teléfono opcional; ambos se conservan como texto y se muestran en el documento si se diligencian.
- `Clientes.Telefono_Alterno` y `CLIENTE_OBTENER.alternatePhone` ya existen. Cotización y Pedido deben reutilizarlos.
- **Observaciones del pedido** contiene acuerdos que ve el cliente: obsequios de cojines, transporte incluido a una ciudad, instalación u otras condiciones.
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

El formulario de preparación permite indicar disponibilidad por mueble, separado, pagos y notas internas, pero todavía no guarda ni confirma cobros. El documento los identifica como «Abono indicado» y conserva la marca de borrador. Sin pagos, el abono indicado es cero y el saldo corresponde al total; no se emite un recibo ficticio. Valores negativos, medios faltantes y sumas superiores al total deben corregirse antes de generar la vista previa.

Antes de activar escrituras: acordar un campo independiente de separado en la cabecera y uno de disponibilidad en `Orden_Items`, sin reutilizar la antigua modalidad global para ocultar pedidos mixtos; persistir el teléfono alterno del cliente y cada pago por separado; agregar un campo dedicado `Nota_Interna` (o contrato equivalente explícito) a Abonos, con pruebas de privacidad en OP/recibos. El schema instalado no se modifica desde esta entrega de interfaz. Ningún dato de pago se envía a Apps Script en modo preparación.
