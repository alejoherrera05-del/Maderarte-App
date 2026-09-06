# Acuerdos simples y ciclo futuro de la orden

Base: `f2d0c49a45dcee31104d1a1d124683091aff62f1`. Rama: `feat/order-lifecycle-agreements`. PR: [#13](https://github.com/alejoherrera05-del/Maderarte-App/pull/13).

## Recorrido implementado

Cliente completo → muebles y precios → acuerdo común con excepciones → abono y saldos → observaciones y revisión. La propuesta del checkpoint anterior queda implementada en esta rama por indicación del propietario.

- Se elige una vez el acuerdo y, cuando corresponde, la disponibilidad común. Los nuevos muebles heredan esos valores. `Cambiar` permite una excepción; modificar el acuerdo común conserva las excepciones. `Usar los valores de la compra` vuelve a vincular ese mueble.
- El modelo y PDF siguen leyendo acuerdos por mueble. Elegir entrega hoy no confirma remisión, fabricación ni cobro. Recogida, envío y fechas permanecen en observaciones.
- Se conserva el diseño de abono/total/saldo que aprobó el propietario. La distribución por mueble es opcional y explícita; no produce un segundo ingreso.
- Eliminar del borrador permite Deshacer, conservando identidad, posición, descripción, precio, personalización, fotografías y asignación del mueble. No sobrescribe pagos ni descuentos editados después. El aviso recibe foco y se muestra en pantalla.
- La recuperación de la pestaña conserva hasta 20 eliminaciones reversibles y evita reutilizar sus identificadores. Los borradores anteriores conservan sus acuerdos individuales al migrar.
- Si al quitar un mueble el abono indicado supera el nuevo total, se muestra el exceso, el saldo deja de mostrar un cero engañoso y la vista previa exige corregir el abono. En borrador no existe devolución ni saldo a favor registrado.
- Cédula/NIT, nombre, teléfono principal, correo o N/A, dirección y ciudad siguen obligatorios. Solo el segundo teléfono es opcional entre los datos del cliente.

HomeEasy vigente fue inspeccionado en `pedido.html`, commit `aa21decbe809a91362a2cddfd272c7c5744dfddd`. Se conserva su captura directa y jerarquía de cliente, productos y pagos. El acuerdo común, las excepciones y la eliminación reversible responden a las necesidades explícitas de Maderarte.

## Ciclo futuro analizado

`ORDER_LIFECYCLE.md` establece el contrato para las próximas escrituras. `order-lifecycle.js` contiene proyecciones puras de cantidades y dinero, no operaciones comerciales.

| Escenario | Regla |
|---|---|
| Sala hoy y comedor separado | Un solo expediente; acuerdos, abonos asignados y entregas distinguibles por mueble. |
| Varias remisiones | Cada nueva selección ofrece cantidades pendientes; no vuelve a entregar lo ya confirmado o desistido. |
| Cuatro sillas: salen dos y luego una | Queda una pendiente; el cálculo no altera el abono. |
| Desistimiento antes de entrega | Ajuste auditado, conserva línea e historial; fábrica y asignaciones requieren revisión cuando corresponda. |
| Producto ya entregado | Requiere devolución; no se elimina ni se devuelve dinero automáticamente. |
| El ajuste deja dinero a favor | Mostrarlo separado del saldo por pagar y registrar la aplicación/devolución autorizada. |
| Dos usuarios o reintento tras timeout | Versión, idempotencia, bloqueo y registro confirmado con recuperación; pendiente de implementar y probar en backend. |

Los precios netos emitidos se conservan al desistir de otras líneas. Las cantidades pendientes no prueban disponibilidad física actual; antes del despacho debe validarse producción/disponibilidad operativa. PDF y Drive deben poder reintentarse sin duplicar movimientos.

## Comprobaciones

- `npm ci`, `npm test` y `git diff --check`: completados. Pruebas de campos obligatorios, permisos, cálculos, acuerdos comunes/excepciones, borradores anteriores/nuevos, Deshacer y asignaciones.
- Pruebas del ciclo: remisiones parciales, cantidades inválidas o repetidas, ID ajeno, versión desactualizada, desistimiento de pendientes, revisión de fábrica/asignaciones, importes enteros y saldo a favor sin mutar entradas.
- Chrome automatizado: 1440, 390 y 320 px, captura nativa, eliminación/recuperación, pagos combinados, descuento y distribución. Se añadió un control de legibilidad de los nombres porque la primera inspección de capturas detectó un botón que estrechaba el texto en 390 px.
- Documento corto de dos muebles: una hoja en la prueba de escritorio. Documento largo con fotos: cuatro páginas A4. Cotización extensa de 25 muebles: siete páginas, texto completo. Sin notas internas en PDF ni errores de consola en la ejecución completada.
- La evidencia visual está en los artefactos del workflow del PR. Los ejemplos usan datos sintéticos; no se guardan documentos comerciales en Git.

## Límites de esta entrega

PREPARACION continúa activa. No cambia el código de Apps Script, el esquema instalado, los permisos ni la emisión de operaciones reales. No se crean OP, remisiones, recibos, ajustes ni devoluciones. Las pruebas de cálculo no acreditan concurrencia o recuperación de transacciones en Sheets/Drive; esas pruebas son requisito de la siguiente etapa antes de habilitar escrituras.

La revisión visual se apoya en Chrome y capturas reales. No se afirma una prueba en Safari de un iPhone físico. La publicación y su verificación en el dominio habitual se registran en el PR y en Workers Builds.
