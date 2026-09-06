# Pedido directo: elección por mueble y pagos generales

Base: `233a22c280ceb6405b74d1e135d5de4c06948ca9`. Rama: `fix/simple-item-purpose`. PR [#14](https://github.com/alejoherrera05-del/Maderarte-App/pull/14).

El propietario revisó el formulario y retiró el acuerdo común y la distribución opcional de abonos por considerarlos confusos. Esta instrucción sustituye la propuesta publicada en PR13.

## Cambios

- Cliente → muebles → pago → observaciones. Cada ficha contiene descripción, cantidad, precio y una sola elección: Entrega inmediata, Solicitar a fábrica o Separado. Personalización y fotos siguen desplegables.
- Eliminados el bloque «Cómo queda la compra», su herencia/excepciones y la pregunta de disponibilidad adicional. Cada nuevo mueble comienza sin elección para no asignarle automáticamente la del anterior.
- Eliminada la opción «Llevar saldos por mueble», sus entradas, validaciones y desglose en PDF. Se conservan total, abono, saldo general, varios medios y notas internas.
- El PDF muestra una indicación por mueble. El plazo de fabricación solo se muestra si se eligió Solicitar a fábrica. Separado no genera una promesa de fabricación.
- Se mantienen cliente obligatorio excepto teléfono alterno, correo N/A, validación de importes, eliminación reversible y alerta de abono superior al nuevo total.

## Compatibilidad

Los borradores con acuerdos individuales o comunes se adaptan por mueble. Entrega hoy pasa a Entrega inmediata; Separado sigue Separado. Solicitud a fábrica y disponibilidad clara se reconocen; los detalles anteriores adicionales se conservan en observaciones. Una combinación ambigua no se transforma arbitrariamente: queda pendiente de selección. No se pierden pagos ni se reactivan asignaciones eliminadas. Los borradores nuevos conservan la elección y el texto exacto de observaciones; Deshacer conserva el ID y la elección del mueble.

## Verificación

Pruebas de formulario: campos obligatorios, tres opciones por línea, pedido mixto, todo separado, importes, medios combinados, descuentos, Deshacer y recuperación de tres formatos de borrador. Chrome verifica la ubicación/legibilidad del selector, móvil 390/320 y escritorio 1440, ausencia de controles de reparto, documento y PDF sin notas internas. Los resultados y artefactos quedan asociados al commit del PR.

## Alcance

PREPARACION sigue activa. No cambia Apps Script ni el esquema instalado; no se registran ventas, cobros, reservas, solicitudes ni entregas. Se conservan IDs y separación entre dinero y entregas para desarrollar remisiones parciales y ajustes auditados posteriormente. La revisión del propietario continúa en app.maderartepopayan.com después de las pruebas y la publicación.
