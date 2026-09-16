# Copias privadas y recuperación aislada

El respaldo pertenece al Drive de Maderarte, dentro de `MADERARTE APP/04_BACKUPS`. No se exporta información comercial a GitHub ni a otro proveedor. No se borran copias anteriores.

## Contrato

- Copia fechada del Sheet completo, incluidos permisos individuales y consecutivos.
- Inventario del árbol documental propio con identidades originales, rutas y copias. Los PDF e imágenes se conservan en `VERSIONES_DOCUMENTOS`: una copia por identidad y contenido. Los respaldos posteriores reutilizan esa versión si no cambió; no se borra ni sobrescribe. Se rechazan accesos directos y archivos no verificables, sin omitirlos silenciosamente.
- Comprobar contenido de las hojas y huellas de archivos antes de marcar el respaldo como verificado. Una ejecución interrumpida queda pendiente y puede continuar; nunca aparenta estar completa.
- No copiar Script Properties: credenciales, sesiones del servicio y secretos de infraestructura requieren su procedimiento privado separado.
- El ensayo crea una segunda copia desde el respaldo y verifica su contenido. Nunca cambia el Sheet operativo, la raíz documental, los números, usuarios ni permisos originales.
- La recuperación aislada no cambia el servicio a la copia. Un cambio operativo posterior necesita revisión del mapa de IDs/enlaces, anulación de sesiones e invitaciones antiguas y diagnóstico comercial antes de activarse.

## Automatización

La función administrativa `respaldarMaddy` no se expone en Router. Un disparador horario del proyecto puede continuar el trabajo en lotes; comienza una copia por fecha de Colombia y no crea otra si esa fecha ya está verificada. El código no instala disparadores ni amplía los permisos OAuth de la aplicación.

La instalación se completa solamente después de verificar la primera copia, el ensayo aislado y el disparador. Las capturas y los IDs privados se conservan fuera del repositorio.

## Instalación y comprobación

1. Incorporar `DataBackups.gs` del commit revisado al proyecto existente, como archivo independiente. Mantener el servicio, el manifiesto OAuth y las propiedades originales. Las funciones son administrativas de editor, no rutas de API.
2. Ejecutar `respaldarMaddy`. Repetir si devuelve `DOCUMENTOS` o `VERIFICANDO`; los lotes tienen un presupuesto de 80 segundos. Solo `VERIFICADO` constituye una copia comprobada.
3. Ejecutar `ensayarRecuperacionMaddy` hasta `VERIFICADO`. Reconstruye carpetas y archivos desde las versiones guardadas y copia el Sheet. Su inventario conserva el mapa de IDs; los enlaces internos del Sheet todavía apuntan a los originales. No es una base lista para sustituir la operativa.
4. Desde Activadores de Apps Script, crear un único activador de `respaldarMaddy`, implementación principal, basado en tiempo, cada hora. Arranca la copia diaria en la primera ejecución desde las 02:00 de Colombia; las siguientes completan lotes o terminan sin duplicarla.
5. Ejecutar `diagnosticarRespaldosMaddy` y revisar fecha, etapas y conteos. Inspeccionar también Activadores/Ejecuciones: una instalación no demuestra todavía que haya corrido un disparo futuro.

Los resúmenes no imprimen clientes, identidades Drive ni credenciales. Los inventarios con IDs quedan privados en Drive. La copia nativa preserva el libro; la verificación automatizada compara valores, fórmulas, estructura y combinaciones, no certifica cada propiedad de formato visual.

No se instala limpieza automática ni se compran cuotas. La copia se detiene si no quedan 100 MB de reserva, si hay documentos pendientes de guardar o si un documento referenciado no está cubierto. Un error de integridad conserva la última copia verificada y marca el intento como `FALLIDO`; el día siguiente puede comenzar otro. Los errores transitorios mantienen el lote pendiente. Una carpeta o inventario alterado requiere revisión administrativa.

Prueba reproducible: `node scripts/test-data-backups.mjs` (también incluida en `npm test`). Cubre copia/recuperación, reintentos, paginación, versiones, pérdida de respuesta, privacidad, corrupción, espacio, referencias faltantes y aislamiento de la base original con datos sintéticos.

Referencias técnicas: [límites de Apps Script](https://developers.google.com/apps-script/guides/services/quotas), [copias en Drive](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy). Procesar por lotes permite retomar sin depender de completar todo el árbol en una única ejecución.
