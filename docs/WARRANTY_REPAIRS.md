# Recepción y reparación de garantías

La visita programada sigue en Agenda task-1/GARANTIA. Su cumplimiento no recibe ni repara el mueble. El expediente físico se abre desde el mueble de una OP entregada o desde el enlace de una visita a sus reparaciones; también admite ingreso directo por el cliente, sin cita previa.

Se identifica la pieza y su cantidad (por ejemplo una silla de un comedor), el problema, estado de ingreso y accesorios, origen (cliente/recogida) y responsable. Cantidad significa piezas recibidas, nunca unidades comerciales descontadas. La persona que registra y la hora quedan en el evento y la auditoría. No se confirma cobertura legal ni se deducen plazos de garantía.

Recibida → En reparación → Lista → Entregada. Lista puede volver a reparación. Las notas permiten reasignar responsable mientras está abierto. Iniciar requiere diagnóstico/trabajo previsto; marcar lista requiere detalle de reparación; entregar exige nombre del receptor y confirmación física. No basta con marcar realizada la visita. El expediente entregado conserva su historial; una nueva incidencia requiere un nuevo expediente.

Persistencia: hoja existente Agenda, categoría exclusiva GARANTIA_EXPEDIENTE y JSON warranty-1 en Referencia_Notas. No se añade una cita ficticia al calendario: AGENDA_LISTAR excluye estos registros y GARANTIA_LISTAR los recupera por sede/OP. Fecha es fecha de apertura, Hora vacía. No cambia el esquema instalado. No se escriben Orden_Items, saldos, abonos, producción ni remisiones.

API: GARANTIA_LISTAR, GARANTIA_GUARDAR, GARANTIA_ESTADO. Lectura requiere agenda.read y ordenes.read; guardar también agenda.update, operación activa y sede autorizada. Se valida pertenencia del mueble y existencia de cantidades entregadas no devueltas. Cada cambio exige revisión vigente, ScriptLock, fence duradero, lote atómico de expediente/auditoría/idempotencia y Request_ID. El historial admite hasta 40.000 caracteres para respetar la celda de Sheets, falla sin escritura si se supera.

El navegador protege el intento pendiente por usuario en localStorage y reconsulta/reintenta con el mismo Request_ID tras una interrupción. No se confunde ese intento con un expediente ya confirmado. Las pruebas usan datos sintéticos y no generan recepciones reales.

Reutiliza cabecera y hoja modal de la agenda Maddy, cuyo patrón se contrastó con HomeEasy calendario.html (0555553db81ec7567200262e083cef38b9c78557). No se encontró allí un expediente equivalente de reparación; se incorpora este recorrido propio en la misma familia visual.

Límites de esta entrega: no hay fotografías nuevas, firma digital, comprobante comercial PDF de custodia, notificaciones WhatsApp ni aceptación automática de cobertura. La evidencia visual se obtiene del navegador de pruebas y se entrega fuera del repositorio. La recepción no hace una recogida ni una devolución de venta por sí sola.

