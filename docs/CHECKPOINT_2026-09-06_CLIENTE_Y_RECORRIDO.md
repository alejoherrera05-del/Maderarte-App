# Cliente obligatorio y propuesta de recorrido

Base: `36fd2c9f0147787ba2666ccab2698543217756c4`. Rama: `fix/required-customer-details`. PR: [#12](https://github.com/alejoherrera05-del/Maderarte-App/pull/12).

## Corrección solicitada e implementada

El propietario confirmó que cédula/NIT, nombre, teléfono principal, correo, dirección y ciudad son obligatorios en Cotización y Pedido. Solo el segundo teléfono es opcional. El correo permite `N/A` cuando la persona no tiene correo; se normaliza al salir del campo y no se sustituye por un correo ficticio. Vacíos, espacios y formatos de correo inválidos señalan el campo y bloquean la vista previa.

Se conserva la composición aprobada de abonos, total y saldo, así como los datos de borrador existentes. Un borrador o cliente recuperado incompleto requiere completar sus datos. No cambia Apps Script, Sheets, autorizaciones ni el bloqueo de escrituras comerciales.

HomeEasy vigente fue consultado en `origin/main/pedido.html`: captura directa del cliente, teléfono, correo y dirección. La obligatoriedad y `N/A` responden a la instrucción explícita de Maderarte.

## Propuesta funcional para discutir, aún no implementada

El propietario valora la distribución de abonos y saldos, pero encuentra confuso repetir decisiones por cada mueble. La alternativa conserva las secciones existentes y reduce repetición:

1. Cliente completo: identificación con coincidencias, sin una búsqueda separada.
2. Muebles: capturar primero descripción, cantidad, precio y personalización necesaria.
3. Acuerdo común: elegir una vez entrega hoy, separado o entrega posterior. Mostrar el acuerdo junto a cada mueble y permitir `Cambiar` solo para las excepciones. Los muebles añadidos heredan el acuerdo común; cambiarlo debe preservar las excepciones explícitas y mostrar el alcance del cambio. Mantener el acuerdo efectivo por línea en el modelo y PDF, sin reemplazarlo por un estado global de la OP.
4. Pago: conservar total, abono y saldo. Un medio visible y `Añadir otro medio` cuando haga falta. La distribución por mueble se abre únicamente si el asesor necesita saldos individuales; mostrar cuánto queda por asignar. No deducirla de disponibilidad o de entrega.
5. Revisión legible: resumir qué se entrega, qué queda separado o pendiente, cuánto se abona y cuánto se debe. Logística en observaciones.

Ejemplo: sala que sale hoy y comedor separado. Elegir separado para el conjunto y cambiar solo la sala. Si todo queda separado, una sola elección. Si el cliente paga la sala y abona al comedor, distribuir explícitamente el abono; no asignarlo automáticamente por el acuerdo.

Una elección común es un atajo de captura, no un reemplazo de los estados por mueble. Disponibilidad, solicitud a fábrica, acuerdo y cobro siguen siendo conceptos independientes. El cambio de recorrido requiere revisar también borradores anteriores, productos añadidos/eliminados, excepciones y vista previa antes de publicarlo.

## Verificación y límites

Las pruebas comprueban campos vacíos, espacios, correo inválido, correo válido y `N/A` en ambos formularios; el segundo teléfono puede quedar vacío. El workflow de Chrome verifica los formularios y documentos usando datos sintéticos completos. Los resultados finales y el despliegue quedan ligados al commit del PR.

El navegador interactivo de esta sesión no respondió. No se realizó una auditoría visual directa bajo la guía Product Design ni se afirma haber probado Safari físico. La propuesta anterior se basa en el código actual y los escenarios relatados por el propietario; no es una reorganización publicada.
