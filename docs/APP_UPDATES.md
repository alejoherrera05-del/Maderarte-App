# Actualizaciones de pestañas abiertas

Una publicación no sustituye el JavaScript que ya ejecuta una pestaña. El guard compartido inicia una consulta del marcador público al entrar, cada cinco minutos y al volver a una pestaña visible, respetando el mismo límite de frecuencia. Solo opera en el dominio oficial.

El aviso permite «Después» o «Actualizar». No recarga por tiempo, no roba foco y no hace escrituras. La actualización explícita se rechaza mientras hay una solicitud API, un formulario o diálogo abierto, una captura comercial restaurada, o una edición detectada. La protección de una edición se conserva hasta navegar; no supone que un submit haya guardado correctamente. La navegación normal carga la nueva versión.

Fallos de red, 404 o marcadores inválidos no afectan la pantalla. Solo existe una consulta simultánea, con timeout de ocho segundos; la detección detiene el observador para no repetir avisos. No hay service worker ni limpieza de almacenamiento/borradores.

## Publicación

Después de cambiar frontend, recursos o Worker:

1. Ejecutar `npm run release:stamp`.
2. Incluir `public/release.json` y `public/js/core/release.js` en el mismo commit.
3. Ejecutar `npm ci` y `npm test`, publicar y verificar el marcador en el dominio oficial.

La suite rechaza un marcador desactualizado. El hash de contenido es determinista entre Windows/Linux y excluye los dos archivos generados; no incluye datos operativos, IDs privados ni credenciales. Un cambio exclusivamente documental no necesita un aviso nuevo. El despliegue conserva los comandos actuales de Cloudflare: no depende de un hook adicional de build.

## Referencia visual y límites

Se revisó HomeEasy/main/index.html, blob `17e094ab0f5fc2d1b0c361a379a4541d4f2a4733`: notificaciones compactas, jerarquía breve, superficie elevada y aparición de 200 ms. Se adapta a los tokens, tipografía y marca de Maddy, con movimiento de 180 ms, controles de 44 px y respeto a movimiento reducido. No se trasladan identidad ni datos.

Una pestaña abierta antes de instalar este observador necesita una recarga manual inicial. Las publicaciones posteriores ya pueden anunciarse. Este aviso no garantiza recuperación de cualquier formulario ante un cierre del navegador; los borradores comerciales existentes siguen teniendo su propio mecanismo.
