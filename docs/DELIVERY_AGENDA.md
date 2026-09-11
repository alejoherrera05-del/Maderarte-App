# Agenda de entregas

El propietario confirmó programación por fecha, sin hora ni franja.

Paridad revisada con HomeEasy `main/calendario.html`: calendario mensual, selección del día, lista de compromisos, pendientes vencidos, acceso contextual y editor sobre la agenda; en computador calendario a la izquierda, en celular encima de la lista. Se conserva la marca, autenticación y almacenamiento propios de Maderarte.

La agenda relaciona una OP y sus muebles. Programar, reprogramar o cancelar una programación no emite una remisión, no modifica cantidades entregadas, no cobra y no envía mensajes. La remisión sigue siendo la operación que registra la salida del almacén.

Primer alcance: entregas con fecha y muebles seleccionados, consulta diaria, cambios de fecha y cancelación auditable. Una selección ya programada no se ofrece en una segunda programación activa. Las cantidades y la disponibilidad se vuelven a comprobar antes del despacho.

Persistencia: pestaña Agenda existente, Hora vacía y Referencia_Notas con contrato JSON versionado. Permisos por sede, Request_ID, bloqueo e idempotencia de servidor. No se agregan bases de datos ni servicios.

