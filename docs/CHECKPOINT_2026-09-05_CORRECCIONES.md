# Maddy — checkpoint de correcciones del 5 de septiembre de 2026

## Estado de salida

**Correcciones implementadas, publicadas y verificadas por pruebas automatizadas. El usuario instaló el Cerebro y completó pruebas manuales de ingreso, búsqueda de clientes y seguimiento vacío. El cierre de estabilidad de toda la etapa sigue pendiente.**

Este documento continúa `CHECKPOINT_2026-09-05_REVISION.md`. Los defectos reproducidos de identidad y seguimiento están corregidos en el repositorio. También se corrigieron la configuración del visor documental, la paginación de cotizaciones extensas y un salto de foco encontrado durante la revisión ampliada.

Continuación posterior: [cliente por cédula y lectura](CHECKPOINT_2026-09-05_CLIENTE_Y_LECTURA.md) registra la confirmación del número corregido en la app, la escritura normal en el teléfono reportada por el propietario y la simplificación del formulario y ampliación del inicio solicitadas después.

La aplicación conserva la versión declarada `0.2.0`, el modo de preparación y las escrituras comerciales deshabilitadas. El PR permanece abierto; este checkpoint no equivale a un merge ni a una certificación del backend remoto.

## Referencias verificadas

| Referencia | Valor |
| --- | --- |
| Repositorio | `alejoherrera05-del/Maderarte-App` |
| Rama | `etapa-4-paridad-homeeasy` |
| PR | [#7](https://github.com/alejoherrera05-del/Maderarte-App/pull/7) |
| Commit de código y pruebas de la revisión automatizada inicial | `b5c696e66af0ee47a4efea745a4e628cbb3d2a5b` |
| Calidad | [Run 33983907852 — success](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33983907852) |
| QA Seguimiento | [Run 33983907837 — success](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33983907837) |
| QA Cotización | [Run 33983907834 — success](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33983907834) |
| Cloudflare | El bot del PR informó despliegue correcto del mismo commit, 5 de septiembre, 18:23 UTC. |

El commit inicial de este documento solo registró la evidencia. El seguimiento manual y la corrección posterior del consecutivo se describen más abajo; los runs de esta tabla corresponden a la revisión automatizada inicial.

## Cambios y pruebas

### Identidad de Maddy

- Se evita asignar `textContent` cuando el nombre o detalle ya son correctos.
- El observador sigue atendiendo el render tardío del pie y el cambio de módulo, pero se estabiliza.
- La regresión ejecuta el módulo real en un DOM: un cambio ajeno al pie genera una sola notificación, sin ciclo continuo. Comprueba también título, nombre y cambio de sección.
- Prueba: `npm run test:identity`.

### Seguimiento de cotizaciones

- La interfaz envía búsqueda, fechas, sede, límite y desplazamiento al backend.
- Se muestran páginas de 50 registros, con Anterior/Siguiente y el rango de resultados.
- El backend aplica permisos y filtros antes de paginar y calcula los indicadores sobre el conjunto completo de propuestas abiertas.
- Fechas y antigüedad se interpretan con el día comercial de Bogotá. Se rechazan rangos invertidos, fechas inválidas y desplazamientos inválidos.
- Una respuesta anterior no puede sobrescribir una búsqueda más reciente. Los errores muestran indicadores pendientes, no ceros ni totales parciales.
- La prueba real del frontend en DOM recorre 101 cotizaciones en tres páginas, conserva 101 propuestas y un importe total de 10.100 unidades, y encuentra un registro situado fuera de la primera página.
- Se prueban además cotizaciones convertidas, separación por sede, permisos, límites de medianoche, respuestas fuera de orden y compatibilidad con el backend anterior.
- Prueba: `npm run test:tracking`.

### Visor de documentos

- Los enlaces compatibles de Drive se convierten a su ruta de visualización y conservan la clave de recurso cuando existe.
- CSP permite incrustar únicamente el propio origen y `https://drive.google.com`.
- Otros enlaces HTTPS se ofrecen para apertura externa; no se incrustan orígenes arbitrarios.
- El visor incluye una alternativa de apertura en otra pestaña, conserva los permisos originales y devuelve el foco al control que lo abrió. El fondo queda inerte mientras el diálogo está abierto.
- Se comprueban URLs inválidas, credenciales incrustadas, dominios parecidos, puertos ajenos y claves de recurso.
- La configuración y el comportamiento DOM están verificados. La apertura de un documento privado real bajo la política desplegada queda pendiente de la prueba integrada.

### Documento extenso y formulario

- La paginación se decide midiendo el diseño real a ancho A4, también cuando el usuario trabaja desde móvil.
- Los productos y textos extensos se distribuyen en páginas adicionales; las continuaciones conservan contenido sin repetir importes. Condiciones, total y firma aparecen una sola vez en el cierre.
- Se conservan el membrete, la identidad y los anexos del documento vigente. No se reduce la letra para forzar todos los productos en una hoja.
- El caso de 25 muebles, especificaciones y observaciones extensas produjo **7 páginas**, conservó todos los textos y un único total, y no presentó desbordamiento. El PDF físico también tuvo 7 páginas y contuvo los 25 muebles.
- El caso estándar de tres muebles conserva ahora el nombre completo del cliente y ocupa dos páginas principales más dos anexos. La prueba anterior podía perder ese nombre por un salto de foco; ya se exige explícitamente su presencia.
- Se evita que el foco salte al buscador después de que la persona haya comenzado a escribir en otro campo. Cada campo de producto tiene una etiqueta asociada y un identificador único.
- Se retiró el bloqueo de ampliación de las dos pantallas. En móvil, los campos de entrada usan al menos 16 px.
- El QA automatizado de Chrome, con ancho móvil de **390 px**, confirmó siete páginas, ausencia de desbordamiento horizontal y **cero errores de consola** en el caso extenso. Esto no es una prueba física de Safari/iPhone ni una inspección visual manual completa.
- Pruebas: `npm run test:documents` y el workflow de QA Cotización.

## Validación de instalación

Se ejecutaron satisfactoriamente `npm ci --no-audit --no-fund` y `npm test`. La suite incluye las regresiones anteriores junto con las comprobaciones existentes de estructura, contratos, autorización, clientes, reglas comerciales, API y Worker.

Se añadió JSDOM como dependencia de desarrollo para ejecutar los módulos y sus interacciones DOM en pruebas. No se añadió un framework ni una dependencia de interfaz al navegador.

Las capturas y PDFs de QA pertenecen a los artefactos de GitHub Actions y emplean datos sintéticos. No se guardan documentos comerciales ni credenciales en el repositorio.

## Procedimiento inicial para actualizar el Cerebro oficial

Este apartado conserva el procedimiento definido antes de la instalación manual. El avance posterior se registra a continuación en «Instalación y prueba manual con el propietario».

Cloudflare publica frontend y Worker; no actualiza por sí solo el proyecto separado de Apps Script. La implementación de `apps-script/Quotes.gs` requiere desplegarse allí para que el seguimiento disponga de paginación e indicadores completos.

En esta revisión no había una configuración de proyecto ni autenticación de clasp disponibles, ni una herramienta conectada para actualizar el contenido de Apps Script. La conexión del navegador de revisión también falló al intentar comprobar el recorrido autenticado. No se afirma que el código remoto esté actualizado.

Procedimiento para la cuenta que administra **Maderarte App — Cerebro**:

1. Abrir el proyecto existente y sincronizar los archivos de `apps-script/` desde la rama de este checkpoint. Verificar especialmente `Quotes.gs` y el enrutamiento de `COTIZACIONES_LISTAR`; no crear un proyecto paralelo ni reutilizar el de HomeEasy.
2. Conservar las propiedades privadas del proyecto, `COMMERCIAL_WRITES: false` y `MODO_OPERACION: PREPARACION`.
3. Ejecutar `verificarBaseCero()` y confirmar las 23 pestañas, las sedes, el propietario y cero filas comerciales.
4. En **Implementar → Gestionar implementaciones**, editar la implementación activa, elegir **Nueva versión** e implementar. Actualizar la implementación existente conserva su URL e ID, según la [documentación oficial de Apps Script](https://developers.google.com/apps-script/concepts/deployments).
5. Ingresar a la rama de Maddy con una cuenta autorizada y comprobar seguimiento, filtros, actualización y navegación. La respuesta de `COTIZACIONES_LISTAR` debe incluir `paginationVersion: 1`, `offset`, `limit`, `hasMore` y `summary`.
6. Comprobar el recorrido de sesión, consola, móvil y apertura de un documento autorizado de Drive en una prueba aislada. Mantener la base comercial en cero.

Compatibilidad durante la transición: las respuestas completas del backend anterior, incluida la base vacía, siguen siendo utilizables. Si el backend devuelve un conjunto incompleto sin el nuevo contrato, la interfaz muestra un error explícito y no inventa indicadores completos.

## Instalación y prueba manual con el propietario

Después del bloqueo del navegador de revisión, el propietario indicó que el editor del proyecto no contenía código y pidió un archivo completo para copiar y pegar. Se entregó la exportación de `e0d27053069a8071b07aaeac5382aba1b5f91638`: nueve módulos y 85 funciones, sin duplicados, junto con `appsscript.json` y `INSTALACION_CEREBRO_MANUAL.md`. Los módulos de negocio son los mismos que ya habían superado las pruebas del checkpoint.

El propietario confirmó que pegó y guardó el código y el manifiesto, configuró las propiedades de Sheet, Drive y Firebase, guardó un mismo token de conexión en Apps Script y Cloudflare, publicó la aplicación web y actualizó su dirección en el secreto del Worker. Los identificadores de destino y valores privados se mantienen fuera de GitHub.

La comprobación automática del enlace de la aplicación web no estuvo disponible. Por ello, la evidencia remota de este apartado procede del registro y las capturas aportados por el propietario; no se presenta como una inspección directa del navegador del agente ni como una comparación exacta del código instalado.

| Comprobación | Evidencia aportada | Alcance confirmado |
| --- | --- | --- |
| `verificarBaseCero()` | Registro finalizado sin error, `ok: true`, versión `0.2.0`, 23 pestañas, un propietario, sedes MP y TP, modo PREPARACION, escrituras comerciales deshabilitadas y raíz `02_DOCUMENTOS_CLIENTES`. | Estructura y estado inicial de la base y acceso a la carpeta documental. |
| Base comercial | Los diez recuentos del diagnóstico son cero. | No hay registros comerciales en ese momento. |
| Ingreso | El propietario indicó que ingresó correctamente y mostró el inicio con su sesión. | Prueba manual satisfactoria del ingreso. |
| Clientes | Captura de la búsqueda `prueba` con «No encontramos clientes con esa búsqueda». | Consulta con respuesta vacía y sin error visible. El frontend admite compatibilidad con base cero; esta captura no identifica por sí sola la versión exacta de la respuesta del backend. |
| Cotizaciones | Captura de seguimiento con cero cotizaciones, valor de cero, las tres categorías del radar en cero y «No hay cotizaciones en este rango». | Carga manual del seguimiento vacío sin error visible. No prueba todavía paginación con registros ni el contrato `paginationVersion: 1`. |
| Propiedades finales | El propietario confirmó que guardó `APP_BASE_URL` y `MODO_OPERACION=PREPARACION` siguiendo las instrucciones. | Configuración reportada por el propietario; no se ha probado la creación de invitaciones. |
| Formulario de cotización | Captura de escritorio con sede MP, número previsto, buscador sin coincidencias, importes en cero y emisión desactivada. | El formulario y los metadatos de sede cargan. El texto se escribió en Buscar cliente, no en Nombre completo. No acredita todavía la revisión móvil con teclado abierto. |

No se solicitaron ventas, clientes ni documentos comerciales de prueba. El registro de diagnóstico y las capturas permanecen en la conversación, fuera del repositorio público.

### Corrección del número previsto encontrada en la captura

La captura de escritorio mostró `MP-COT--0001`. Se reprodujo ejecutando `quoteMeta_` con un prefijo terminado en guion: el código añadía otro separador incondicionalmente. Se normalizan los guiones finales del prefijo antes de unirlo al consecutivo; con o sin guion configurado, el resultado previsto es `MP-COT-0001`.

La regresión de `npm run test:quotes` falló primero con el mismo resultado de la captura. Cubre prefijos con/sin separador final, espacios y minúsculas, prefijo vacío, números mayores de cuatro dígitos y consultas repetidas que no consumen el consecutivo. La corrección no altera los datos de Sedes ni habilita escrituras comerciales. La instalación del Cerebro actualizado y la confirmación del número correcto en la app siguen pendientes.

Después del cambio se completaron correctamente `npm ci --no-audit --no-fund` y toda la suite `npm test`, incluida la nueva regresión. No se modificaron archivos de interfaz en esta corrección.

### Pendientes concretos después de esta prueba

- El propietario ya aportó la captura del número `MP-COT-0001` después de actualizar el Cerebro. La siguiente revisión de interfaz corresponde a la versión descrita en el checkpoint de cliente y lectura.
- Comprobar el recorrido de cotización/documento y móvil en la versión corregida; no confundir la prueba automatizada anterior con una prueba física posterior a instalar Apps Script.
- Confirmar el contrato actualizado de cotizaciones y el visor de un documento autorizado de Drive sin cargar datos comerciales de prueba.
- Identificar la versión exacta que sirve el dominio de producción antes de dar por publicadas allí todas las correcciones. Al revisar GitHub después de estas capturas, `main` seguía en `d5ead3483841227cf38cf8f2c959c3cb0b0ce01c` y el PR #7 seguía abierto, sin fusionar. El bot de Cloudflare había publicado correctamente la rama en `e0d2705`; eso no acredita por sí solo qué versión sirve el dominio tras los cambios manuales de configuración.

## Criterio de cierre

El checkpoint técnico y el avance de integración manual están publicados. El ingreso y las consultas vacías tienen evidencia del propietario. Para declarar cerrada la estabilidad de toda esta etapa deben resolverse los pendientes concretos anteriores; el PR conserva el proceso de revisión del propietario. La nueva orden de pedido continúa como siguiente módulo después de ese cierre.

La identidad del manifiesto instalable y la discrepancia documental sobre la etiqueta del asesor se conservan como decisiones de coherencia pendientes, sin alterar el diseño vigente durante estas correcciones.
