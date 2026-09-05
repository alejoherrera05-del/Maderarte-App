# Maddy — cliente por cédula y lectura del inicio y formulario

## Solicitud y referencia

El propietario confirmó que pudo escribir en Nombre completo desde su teléfono sin saltos de foco. Pidió eliminar el buscador separado: comenzar por Cédula/NIT, ver coincidencias mientras escribe, completar una persona existente o continuar con los datos nuevos. También pidió mayor tamaño y separación en Cotización e Inicio.

Antes de editar se actualizó la referencia de `origin/main` de Maderarte (`d5ead3483841227cf38cf8f2c959c3cb0b0ce01c`). Se continúa la rama remota `etapa-4-paridad-homeeasy`, PR #7, desde `e9fa5d33f267ee62a975bea3c8506c9dcabbf882`.

Se inspeccionó HomeEasy `main` en `aa21decbe809a91362a2cddfd272c7c5744dfddd`: `cotizacion.html` usa Cédula/NIT como búsqueda y dato del formulario, con coincidencias y completado exacto; `index.html` eleva sus filas de navegación a 88 px. Maddy usaba 72–74 px y numerosas etiquetas de formulario cercanas a 11–12 px.

Paridad conservada: identificación como primer campo, lista contextual, completado del cliente, captura manual continua, menú agrupado, tarjetas y ventanas de acciones existentes. La adaptación autorizada aumenta la lectura y conserva la marca y las reglas propias. No se copian datos, cachés, credenciales ni recursos de HomeEasy.

## Cambios

- Se elimina Buscar cliente como campo separado. Cédula/NIT es un campo de texto que conserva ceros iniciales y ofrece teclado numérico en móvil.
- Desde dos caracteres se consultan coincidencias mediante la API existente. Se pueden elegir con toque o flechas + Enter; Escape y salir del campo cierran la lista.
- Una identificación exacta o una selección consulta `CLIENTE_OBTENER`, que incluye la dirección omitida por la respuesta resumida de `CLIENTES_LISTAR`.
- Las respuestas atrasadas no pueden completar otro documento ni reabrir la lista después de continuar con otros datos. Los errores se distinguen de una búsqueda sin coincidencias.
- Cambiar de cédula retira los datos autocompletados anteriores; los campos que la persona editó manualmente se conservan.
- El formulario amplía etiquetas, campos, ayudas, resúmenes, bloques y separaciones. El ajuste se limita al editor; no cambia la composición A4 aprobada.
- El inicio conserva sus grupos y aumenta filas a 94–96 px, iconos a 54 px y títulos a 18 px. Las descripciones permiten varias líneas y En preparación deja de competir por el ancho con el nombre del módulo.
- Se mantiene la fundación de lectura. Escribir datos nuevos en el formulario todavía no crea un cliente ni emite una cotización.

## Evidencia y límites

El propietario aportó una captura posterior al despliegue del Cerebro con `MP-COT-0001`: la corrección del guion duplicado ya tiene confirmación visual en la aplicación.

La conexión del navegador del agente volvió a fallar al listar pestañas, antes de interactuar con las páginas. La referencia HomeEasy se inspeccionó en su código vigente; no se presenta como una captura remota nueva.

Se añadieron pruebas DOM de coincidencias, selección, completado de dirección, ceros iniciales, captura manual, errores y respuestas atrasadas. `npm ci --no-audit --no-fund` y `npm test` finalizaron correctamente.

## Validación publicada

Código de interfaz: `31ef7c317312e98a59594ea4476ae95aed72bb72`. Commit que añade las comprobaciones de escala de esta entrega: `8e1e1bb444b5b74a46f69237c581d07986b97838`.

| Comprobación del commit 8e1e1bb | Resultado |
| --- | --- |
| [Calidad 33991494943](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33991494943) | Correcta: suite Node y empaquetado del Worker. |
| [Cotización 33991494840](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33991494840) | Correcta: formulario, inicio, documento estándar y documento extenso. |
| [Seguimiento 33991494845](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33991494845) | Correcta. |
| Anchos reales de Chrome | 320, 390, 768 y 1440 px; sin desplazamiento horizontal en formulario e inicio. |
| Formulario | Primer campo Cédula/NIT; buscador separado ausente; entradas 17 px; etiquetas 15 px; conserva el nombre escrito; emisión deshabilitada. |
| Inicio | Títulos 18 px, descripciones 15 px, filas de al menos 96 px en los casos ejecutados. Ventana de Cotización comprobada a 390 px. |
| Documento extenso | Siete páginas, 25 muebles completos, un total, sin desbordamiento, cero errores de consola. PDF físico también de siete páginas. |
| Cloudflare | El bot informó despliegue correcto de 8e1e1bb a las 20:55 UTC del 5 de septiembre de 2026. |

La vista del commit publicada por Cloudflare es [9ce12db8](https://9ce12db8-maderarte-app.alejoherrera05.workers.dev). El PR continúa en revisión; no se presenta esta URL como el dominio de producción ya actualizado.

Las capturas y los PDFs quedaron en el artefacto `cotizacion-visual-qa` del run indicado. La descarga materializada devolvió HTTP 403 / código 1010 al intentar abrirla en el entorno, por lo que el agente no inspeccionó visualmente esos PNG; los resultados anteriores proceden de las mediciones y aserciones automatizadas. No se atribuye esa limitación a la app del usuario.

En el momento de esa entrega quedó pendiente la revisión visual del propietario en la vista corregida, especialmente en su teléfono. La captura física previa corresponde al formulario anterior a esta simplificación. Esta entrega modifica frontend y pruebas; no requiere volver a instalar el Cerebro.

## Indicación posterior: publicar para revisar en el dominio habitual

El propietario pidió que los cambios se publiquen directamente en `app.maderartepopayan.com` y que la revisión desde su celular ocurra allí, sin un paso duplicado en el enlace de rama. Esta instrucción autoriza fusionar y desplegar las correcciones comprobadas antes de esa revisión visual. Se actualizan `AGENTS.md` y `CLOUDFLARE_DEPLOYMENT.md` para conservar la decisión. La publicación no supone declarar cerrada la estabilidad global.
