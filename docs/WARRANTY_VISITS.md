# Revisiones de garantía desde la OP

Proceso confirmado el 14 de septiembre de 2026: reporte por WhatsApp o tienda; visita de un trabajador; resolución en domicilio o recogida para reparación. El cliente también puede traer el producto o una pieza, como una silla de un comedor.

Primer incremento: desde el mueble de la OP se abre directamente la revisión en la agenda existente, con OP, cliente, teléfono, dirección, sede y título precargados. El trabajador, fecha, hora, descripción del problema y pieza afectada se completan allí. El título y notas conservan el detalle de la pieza sin inventar una nueva línea comercial.

Se conserva el contrato Agenda task-1/GARANTIA, sus permisos, historial, reintentos y acciones de editar/cancelar/restaurar. Marcar realizada significa que se hizo la atención programada; no significa que el producto esté reparado, recogido o entregado. No modifica dinero, cantidades, producción ni remisiones.

Fuente revisada: Homeeasy/main/calendario.html, commit0555553db81ec7567200262e083cef38b9c78557. Reutilizamos el patrón ya adaptado de calendario/lista y editor en hoja modal con retorno contextual. No se copian marca ni datos.

Pendiente posterior: expediente de reparación sin fecha obligatoria, recepción física de piezas aportadas por cliente o recogidas, diagnóstico, seguimiento y cierre. Este incremento no se presenta como un módulo completo de garantías.
