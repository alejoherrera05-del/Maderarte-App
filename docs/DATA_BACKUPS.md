# Copias privadas y recuperación aislada

El respaldo pertenece al Drive de Maderarte, dentro de `MADERARTE APP/04_BACKUPS`. No se exporta información comercial a GitHub ni a otro proveedor. No se borran copias anteriores.

## Contrato

- Copia fechada del Sheet completo, incluidos permisos individuales y consecutivos.
- Copia del árbol documental propio con inventario de identidades originales y copias. Rechazar accesos directos y archivos no verificables, sin omitirlos silenciosamente.
- Comprobar contenido de las hojas y huellas de archivos antes de marcar el respaldo como verificado. Una ejecución interrumpida queda pendiente y puede continuar; nunca aparenta estar completa.
- No copiar Script Properties: credenciales, sesiones del servicio y secretos de infraestructura requieren su procedimiento privado separado.
- El ensayo crea una segunda copia desde el respaldo y verifica su contenido. Nunca cambia el Sheet operativo, la raíz documental, los números, usuarios ni permisos originales.
- La recuperación aislada no cambia el servicio a la copia. Un cambio operativo posterior necesita revisión del mapa de IDs/enlaces, anulación de sesiones e invitaciones antiguas y diagnóstico comercial antes de activarse.

## Automatización

La función administrativa `respaldarMaddy` no se expone en Router. Un disparador horario del proyecto puede continuar el trabajo en lotes; comienza una copia por fecha de Colombia y no crea otra si esa fecha ya está verificada. El código no instala disparadores ni amplía los permisos OAuth de la aplicación.

La instalación se completa solamente después de verificar la primera copia, el ensayo aislado y el disparador. Las capturas y los IDs privados se conservan fuera del repositorio.

Referencias técnicas: [límites de Apps Script](https://developers.google.com/apps-script/guides/services/quotas), [copias en Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy). Procesar por lotes permite retomar sin depender de completar todo el árbol en una única ejecución.
