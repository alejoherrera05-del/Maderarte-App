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

Se añadieron pruebas DOM de coincidencias, selección, completado de dirección, ceros iniciales, captura manual, errores y respuestas atrasadas. Las verificaciones visuales automatizadas y la vista de rama deben revisarse antes de cerrar esta corrección o fusionar el PR. La captura física previa corresponde al formulario anterior a esta simplificación.
