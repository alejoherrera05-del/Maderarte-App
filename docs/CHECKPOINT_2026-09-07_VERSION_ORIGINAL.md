# Checkpoint — Maddy original, 7 de septiembre de 2026

Identificador: `MADDY-CP-2026-09-07-ORIGINAL`.

Estado: **diseño aprobado y avance preparatorio registrado; guardado comercial completo pendiente**.

## 1. Fuente de continuidad

Por solicitud del propietario, el desarrollo continúa sobre la aplicación original y se marca este punto de continuidad. No se sustituye la aplicación por la copia de ensayo, no se importa la orden ficticia y no se vuelve a una versión anterior del formulario.

- Repositorio: `alejoherrera05-del/Maderarte-App`.
- Rama de integración: `main`.
- Dominio habitual de revisión: `https://app.maderartepopayan.com`.
- Versión del código: `0.2.0`. Este checkpoint no inventa una versión nueva.
- Base de código verificada al abrir este checkpoint: `fe5941d3fe8df00b3a1b621193af5e217088e1de`, merge del PR #18.
- Diseño aprobado y publicado: PR #16.
- Núcleo preparatorio del servidor: PR #17.
- Conexión preparatoria del formulario y recuperación: PR #18.
- Rama documental de este checkpoint: `docs/checkpoint-original-2026-09-07`.

La fuente operativa sigue siendo `Base de Datos Maderarte App` y la raíz `MADERARTE APP`. La aplicación pública/catálogo del repositorio `Maderarte` y HomeEasy permanecen separados.

Este cambio es documental: no altera HTML, CSS, JavaScript, Apps Script, permisos, propiedades privadas, base de datos, numeración ni archivos de Drive. No requiere reinstalar el Cerebro ni descargar otro paquete.

## 2. Aprobación que se conserva

El formulario `public/pedido.html` y su documento mantienen la experiencia aprobada:

- Acuerdo dentro de cada mueble: **Entrega inmediata**, **Separado / entregar después**, **Solicitar a fábrica**.
- Personalización y referencias dentro del producto, sin un bloque general de acuerdos de compra.
- Total del pedido, descuento y pago indicado en una captura sencilla; no reintroducir saldos por mueble ni distribución visible de abonos.
- Medios de pago separados, con notas internas excluidas del documento del cliente.
- Segundo teléfono opcional; los demás datos de contacto exigidos por el formulario se conservan. El correo admite `N/A`.
- Encabezado, marca, firma y presentación documental ya aprobados; sin rediseñarlos como parte de la persistencia.

La lógica interna mantiene importes consistentes aunque no todos se expongan en el formulario. Entrega inmediata es un acuerdo, no una entrega confirmada. Solicitar a fábrica no significa que la solicitud ya se realizó. Los abonos no generan automáticamente ninguno de esos movimientos.

Los apartados históricos que describen un selector común o saldos distribuidos no autorizan a volver a mostrarlos. Sus controles de compatibilidad no forman parte de la experiencia aprobada.

## 3. Evidencia disponible y alcance exacto

| Evidencia | Qué respalda | Qué no respalda |
|---|---|---|
| Verificación del Cerebro compartida por el propietario | Base identificada, 23 pestañas, un propietario, sedes MP/TP, conteos comerciales en cero y PREPARACION en esa ejecución | Guardado de una OP completa, almacenamiento de fotos o PDF automático |
| PR #17: 222 comprobaciones del servidor con adaptador simulado | Validación, composición del lote, numeración, idempotencia y recuperación en los escenarios ensayados | Ejecución completa con una sesión real en Google |
| PR #18: 64 comprobaciones del cliente y Chrome a 1440/390/320 px con API sintética | Captura, doble clic, recuperación de respuesta incierta y recarga en los escenarios ensayados | Concurrencia real entre dispositivos, Safari físico o creación documental en Drive |
| Prueba asistida en una copia aislada de Google Sheets | Se informó la comparación de 304 celdas: 248 con contenido y 56 vacías, sin diferencias frente al lote enviado | Que los 304 campos estén completos ni que se haya pulsado Guardar en la aplicación original |
| PDF de muestra generado y subido de forma asistida | Presentación revisada y archivo recuperado de Drive sin cambios, según el informe del ensayo | Generación, archivo, registro y vinculación automáticos al guardar una OP |

Esta tabla registra resultados de los hitos y del ensayo anteriores; no declara una repetición nueva de esas pruebas. Los documentos y datos del ensayo permanecen fuera del repositorio público.

En la prueba asistida, `Estado_Documentos` quedó `PENDIENTE`; los enlaces automáticos de PDF, carpetas y fotografías no se completaron. No se rellenaron a mano para simular integración. Los archivos asistidos y la copia de ensayo no son la base operativa.

## 4. Límite de activación

- `MADERARTE_APP.COMMERCIAL_WRITES` continúa en `false` en el código verificado.
- Se conserva `PREPARACION`; no se activa `ORDER_SAVE_ENABLED` con este checkpoint.
- El formulario exige la confirmación explícita del servidor sobre habilitación, fotografías y documentos. No falsear `enabled`, `photosReady` ni `documentsReady` para desbloquearlo.
- Las fotografías aún no soportadas bloquean el envío; no se eliminan silenciosamente.
- No se ejecuta `prepararEsquemaGuardadoOrdenes` ni se cambia el esquema instalado en este hito.
- No se borran intentos pendientes ni se reinician consecutivos para resolver incertidumbre.
- No se elimina la evidencia aislada sin una instrucción de limpieza específica. No se migra a la base original.

**La aprobación del diseño y de este punto preparatorio no equivale a aprobar el sistema para ventas reales.** El botón Guardar deshabilitado sigue siendo lo esperado.

## 5. Próximo incremento en la misma aplicación

Continuar desde `origin/main` y este checkpoint, mediante una rama y PR del mismo repositorio, sin crear una aplicación sustituta. El próximo bloque es el guardado documental completo:

1. Definir e implementar el contrato y almacenamiento de referencias fotográficas por `Item_ID`, conservando identidad, orden y contenido.
2. Crear o recuperar las carpetas del cliente y de la OP en la organización existente; gestionar fallos y reintentos sin duplicarlas.
3. Generar el PDF con la plantilla aprobada y los datos confirmados, incluido el anexo solo cuando existan fotos. Excluir notas internas.
4. Registrar el archivo y sus enlaces en las hojas correspondientes; distinguir una orden guardada con documentos pendientes de una operación documental terminada.
5. Preparar y verificar la extensión de esquema y el despliegue de Apps Script mediante el mecanismo autorizado, sin activar escrituras a ciegas.
6. Probar el recorrido real completo en datos aislados antes de habilitar operaciones en la base original. Las pruebas aisladas validan el mismo código, no se convierten en una versión operativa alternativa.

## 6. Criterio para aprobar el siguiente hito

El recorrido exigido es:

**Formulario original con fotos → Guardar → número único confirmado → datos completos en Sheets → carpetas y PDF automático en Drive → salir → volver a abrir la misma OP con sus referencias.**

La evidencia deberá demostrar que no fue necesario completar columnas ni subir archivos manualmente, que cada pago y mueble conserva sus datos, que las notas privadas no se imprimen y que un reintento no duplica la OP, el abono ni el documento. Solo entonces podrá proponerse la activación de la operación comprobada.

## Referencias del proyecto

- [Guardado del servidor](CHECKPOINT_2026-09-07_ORDER_SAVE.md).
- [Formulario y recuperación](CHECKPOINT_2026-09-07_FORM_SAVE_RECOVERY.md).
- [Reglas comerciales](BUSINESS_RULES.md).
- [Ciclo de órdenes, remisiones y desistimientos](ORDER_LIFECYCLE.md).
- [Estructura de Drive](DRIVE_STRUCTURE.md).
- [Publicación en el dominio habitual](CLOUDFLARE_DEPLOYMENT.md).

Los checkpoints anteriores conservan valor histórico. Para el alcance de aprobación y la continuidad posterior al ensayo asistido, usar este checkpoint.
