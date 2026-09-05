# Checkpoint de revisión de Maddy — 5 de septiembre de 2026

Estado posterior: las correcciones implementadas y sus pruebas se registran en [CHECKPOINT_2026-09-05_CORRECCIONES.md](CHECKPOINT_2026-09-05_CORRECCIONES.md). Este documento conserva los hallazgos originales de la revisión.

## Dictamen

**Checkpoint documentado con incidencias abiertas. La etapa visual y funcional no se declara estable ni lista para merge.** Las pruebas automatizadas existentes pasan, pero se reprodujeron dos defectos que no cubren esas pruebas. La revisión autenticada y en móvil no pudo completarse.

Este checkpoint registra el estado y el trabajo pendiente. No modifica el comportamiento de la aplicación, no habilita escrituras comerciales y no implica aprobación visual del propietario.

## Versión revisada

| Referencia | Estado al iniciar la revisión |
| --- | --- |
| Repositorio | `alejoherrera05-del/Maderarte-App` |
| Rama de trabajo | `etapa-4-paridad-homeeasy` |
| Commit de aplicación examinado | `45f30d67bea84ca6e1e7b4fe9a521da7b730d032` |
| Último cambio de aplicación | `Apply Maddy identity to tracking shell`, 4 de septiembre de 2026 |
| Base remota `main` | `d5ead3483841227cf38cf8f2c959c3cb0b0ce01c` |
| PR | [#7, abierto](https://github.com/alejoherrera05-del/Maderarte-App/pull/7) |
| Versión declarada | `0.2.0` |

Se actualizó la referencia remota de `main` antes de preparar este documento. Se continúa en la rama remota y el PR existentes. El commit que incorpora este archivo es documental; el SHA de aplicación anterior identifica el código probado.

La portada de acceso del dominio principal y la de la rama en revisión corresponden a versiones diferentes. No deben confundirse la experiencia actualmente publicada en `main` y los últimos cambios de Maddy en el PR.

## Qué se comprobó

| Área | Evidencia obtenida | Alcance y resultado |
| --- | --- | --- |
| Instalación y pruebas | `npm ci --no-audit --no-fund` y `npm test` ejecutados sobre el código revisado | Instalación y suite completa aprobadas: estructura, núcleo Apps Script, clientes, reglas comerciales, cotizaciones, API y Worker. |
| Automatización remota | CI de calidad y QA visual de cotización y seguimiento aprobados para el SHA revisado | Evidencia histórica del repositorio; no sustituye una revisión interactiva actual. |
| Acceso de producción | Página de login abierta y captura inspeccionada en escritorio | La composición de esa pantalla se visualiza. No demuestra el funcionamiento de los módulos internos. |
| Protección de la rama | Abrir cotizaciones sin sesión redirige a login conservando `next` | Redirección observada en el preview del commit revisado. |
| Acceso autenticado | Se envió el formulario mediante el flujo seguro de credenciales del navegador | La herramienta dejó de responder al comprobar el resultado. No se verificó si el acceso finalizó correctamente. |
| Base operativa | Metadatos de la hoja oficial: 23 pestañas; lectura de toda la cuadrícula actual de las 10 pestañas comerciales, excluyendo encabezados | Cero filas con valores en Clientes, Cotizaciones, Ordenes_Pedido, Orden_Items, Produccion, Abonos, Remisiones, Remision_Items, Agenda y Documentos. No se escribieron datos. |
| Integración remota | Código local de proxy, autorización, permisos y contratos revisado; pruebas unitarias aprobadas | No se certifica qué versión de Apps Script está desplegada ni un recorrido autenticado completo entre navegador, Worker, Sheets y Drive. |
| Estado de escritura | `apps-script/Config.gs` declara `COMMERCIAL_WRITES: false` | Preparación de lectura conforme al plan. Es una comprobación del repositorio, no de las propiedades de ejecución remotas. |

La revisión no realizó altas, pagos, anulaciones, envíos ni migraciones. Los casos de reproducción utilizaron datos sintéticos aislados.

## Defectos y correcciones necesarias

### 1. Prioridad alta: ciclo de actualizaciones en la identidad de Maddy

**Estado: reproducido con el código actual en un DOM aislado.**

Archivo: `public/js/core/module-identity.js`.

`applyModuleIdentity()` asigna `textContent` al nombre y detalle del pie incluso si el texto ya es correcto. El `MutationObserver` observa cambios de hijos en todo el documento y vuelve a llamar esa función. Las escrituras generan nuevas notificaciones del mismo observador.

Reproducción: cargar el módulo con su pie de página presente y añadir un solo elemento ajeno al pie. Se registraron **25 entregas consecutivas del observador**; la prueba desconectó el observador en ese límite de seguridad. El nombre visible ya era Maddy y el ciclo continuaba.

Impacto: consumo continuo del hilo de la página y riesgo de bloqueo cuando cambia el DOM. No se atribuye a este defecto el fallo del navegador de revisión, porque no se obtuvo un diagnóstico de la sesión real.

Corrección propuesta: convertir las actualizaciones en idempotentes y limitar la observación a lo necesario, o aplicar la identidad explícitamente al renderizar. Añadir una regresión que compruebe que una modificación ajena al pie no desencadena notificaciones indefinidas.

### 2. Prioridad media: seguimiento incompleto al superar 100 cotizaciones

**Estado: reproducido ejecutando la función de listado del backend y el código del seguimiento con datos sintéticos.**

Archivos: `apps-script/Quotes.gs` y `public/js/pages/cotizaciones.js`.

El backend limita los elementos devueltos a 100 y proporciona los totales de la consulta. La interfaz pide únicamente `limit: 100`, calcula indicadores sobre esos elementos y filtra localmente; no ofrece paginación ni incorpora todos los resultados a las búsquedas.

| Caso sintético | Valor completo | Valor mostrado |
| --- | ---: | ---: |
| Cotizaciones activas | 101 | 100 |
| Importe, con 100 unidades por cotización | 10.100 | 10.000 |

Impacto: indicadores parciales y registros antiguos que pueden quedar fuera de los filtros. La base comercial vacía hace que aún no haya un efecto sobre datos reales.

Corrección propuesta: filtros y paginación coherentes entre frontend y backend, con indicadores calculados sobre el conjunto completo que corresponda. Probar más de 100 registros y búsquedas que solo coincidan con registros fuera de la primera página.

### 3. Prioridad media: política de seguridad incompatible con documentos externos incrustados

**Estado: incompatibilidad encontrada en la configuración del repositorio; no validada contra los encabezados efectivos del despliegue ni un documento privado real.**

Archivos: `public/_headers` y `public/js/pages/cotizaciones.js`.

El visor asigna una URL HTTPS a un `iframe`. La política CSP configurada contiene `default-src 'self'` y no define `frame-src` ni `child-src`. Si el despliegue aplica esa política, el navegador no permitirá incrustar un PDF o visor alojado en otro origen, como Drive.

La herencia de `frame-src` hacia `child-src` y posteriormente hacia `default-src` está documentada en [MDN: CSP frame-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src).

Corrección propuesta: definir los orígenes documentales permitidos, usar una URL de visualización compatible y conservar una alternativa de apertura externa. Verificar permisos de Drive y encabezados reales con un documento de prueba autorizado; no ampliar la política a cualquier origen.

## Pendientes de validación y coherencia

- **Cotizaciones extensas y PDF:** `cotizacion-document-polish.js` cuenta una página principal más los anexos. Cuando el contenido principal no cabe, marca desbordamiento, pero no crea páginas principales adicionales. Debe revisarse impresión y numeración con muchos productos, descripciones largas e imágenes. Es un riesgo identificado en código, no un recorte observado en un PDF real.
- **Móvil y accesibilidad:** cotización y seguimiento declaran `maximum-scale=1` y `user-scalable=no`. Revisar esa restricción para permitir ampliar el texto. No se completó la inspección interactiva en móvil, ni el control de consola de los módulos autenticados.
- **Identidad instalable:** la interfaz incorpora Maddy, mientras que el manifiesto mantiene `Maderarte App` y `Maderarte`. Confirmar el nombre deseado para la app instalada y ajustar sus pruebas si corresponde.
- **Firma del asesor:** `AGENTS.md` indica solo el nombre; el mapa de paridad y el estilo vigente incluyen la etiqueta «Asesor comercial». Conciliar la documentación con la última decisión del propietario antes de cambiar el diseño aprobado.
- **Cobertura:** la suite actual no detectó los dos defectos reproducidos. Sus comprobaciones de código y sus muestras pequeñas no bastan para aprobar interacción, crecimiento de datos o documentos largos.

## Estado por módulo y punto de continuación

| Módulo o capa | Estado utilizable para continuar |
| --- | --- |
| Fundación, autorización y proxy | Implementados y con pruebas aprobadas; validación integrada del despliegue pendiente. |
| Cotización | Diseño avanzado y pruebas existentes aprobadas; conservar el trabajo visual y revisar documentos extensos y móvil. |
| Seguimiento de cotizaciones | Implementado en lectura; resolver ciclo de identidad, límite de resultados y compatibilidad del visor antes de cerrar la etapa. |
| Clientes y expediente de OP | Contratos y lecturas cubiertos por pruebas; falta el recorrido real autenticado. |
| Nueva orden de pedido | Siguiente módulo previsto; `public/pedido.html` todavía no existe. `orden.html` corresponde al expediente, no al formulario de nueva OP. |
| Escritura comercial | Intencionalmente deshabilitada en el código actual. |

## Orden recomendado de continuación

1. Corregir el ciclo de identidad y añadir su prueba de regresión.
2. Completar el listado de cotizaciones con filtros, paginación e indicadores coherentes.
3. Validar y ajustar el visor de documentos con una política CSP específica.
4. Repetir el recorrido de acceso, navegación, seguimiento y cotización en escritorio y móvil; comprobar consola, sesión y documentos de varias páginas.
5. Cerrar la etapa de cotización y seguimiento cuando las comprobaciones anteriores pasen y el propietario apruebe el resultado visual.
6. Continuar con nueva orden de pedido usando HomeEasy vigente como referencia concreta, conservando los datos y servicios propios de Maderarte.

**Criterio de cierre:** las incidencias deben tener corrección y evidencia de prueba; el acceso integrado y móvil deben verificarse. Hasta entonces el PR permanece abierto y este documento constituye el checkpoint, no una certificación de estabilidad.
