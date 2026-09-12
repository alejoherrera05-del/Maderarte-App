# Agenda: acciones directas

Referencias inspeccionadas: Homeeasy/main/calendario.html y Apple Support, Use Reminders (https://support.apple.com/en-au/102484).

Se conserva calendario lateral / semana móvil, detalle y edición en sheet, jerarquía por hora, categoría y asunto. Se adaptan identidad Maderarte, permisos y persistencia independiente.

| Before | After | Why |
| --- | --- | --- |
| Completar exige abrir detalle | Círculo accesible junto al asunto | Una acción frecuente merece acceso directo |
| Deslizar abre otro diálogo | Deslizamiento continuo descubre Eliminar; recorrido largo lo ejecuta | Mantener la relación entre gesto y resultado |
| Tarjetas con hora comprimida | Filas limpias, asunto primero y hora sin cortes | Mejorar lectura móvil |
| Resultado incierto bloquea un formulario | Recuperación desde la lista para sus acciones | Mantener el contexto sin repetir escrituras |

Eliminar es cancelación recuperable, no purga. Deshacer usa la revisión recibida y la misma API. Completar un pago es marcar el recordatorio, no registrar un egreso. Las entregas no tienen check de realización: se confirman por remisión. No se cambia el backend ni se envía WhatsApp.

El gesto separa desplazamiento vertical y horizontal, captura un solo puntero, omite el borde de navegación del navegador, permite volver atrás y respeta movimiento reducido. La confirmación comercial sigue siendo del servidor; el estado pendiente de guardado no se presenta como éxito.
