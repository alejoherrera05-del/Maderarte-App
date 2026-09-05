# HomeEasy → Maderarte: mapa de paridad

## Principio rector

HomeEasy `main` es el molde funcional y de experiencia. Maderarte conserva su infraestructura, datos, autenticación y marca propias, pero no inventa una UX distinta cuando HomeEasy ya resolvió el mismo flujo.

Antes de implementar un módulo se inspecciona su pantalla fuente vigente de HomeEasy y se portan: composición, navegación, flujo entre estados, responsive, bottom sheets/popovers, microinteracciones, estados de carga/vacío/error y retorno contextual.

No se copian datos, URLs privadas, IDs, credenciales, PDFs, cachés, mascota Hommy ni identidad HomeEasy.

## Equivalencias

| HomeEasy vigente | Función fuente | Maderarte | Estado / regla |
|---|---|---|---|
| `index.html` | Inicio editorial, acciones superiores, hero, navegación agrupada, bottom sheets, campana, footer | `public/index.html` | Mantener estructura HomeEasy; adaptar banner, logo, colores y controles explícitamente aprobados para Maderarte. |
| `clientes.html` | Buscar cliente → transición → expediente → Órdenes/Cotizaciones → pagos/PDF/acciones | `public/clientes.html` | Debe portar el flujo real de HomeEasy. No convertir en tabla CRUD genérica. |
| `ventas.html` | Historial de ventas, OP, pagos, saldos, filtros y acceso al expediente | `public/ordenes.html` | Equivalente de historial comercial de OP. |
| `cotizacion.html` | Formulario de cotización y documento/PDF | `public/cotizacion.html` | **APROBADO.** Formulario especializado para mobiliario + documento híbrido Maderarte/HomeEasy + paginación adaptativa. Mientras `COMMERCIAL_WRITES=false`, no habilitar creación real. |
| `seguimiento.html` | Seguimiento/radar de cotizaciones | `public/cotizaciones.html` | **IMPLEMENTADO EN LECTURA.** Radar por antigüedad, valor, filtros, PDF y vínculo a OP convertida. Sin notas/archivo/escrituras todavía. |
| `pedido.html` | Formulario de Orden de Pedido y documento/PDF | `public/pedido.html` | **FORMULARIO Y DOCUMENTO EN PREPARACIÓN.** Reutiliza el sistema aprobado de Cotización. Sin guardado ni numeración oficial. |
| `abono.html` | Registro de abono/recibo y relación con OP | `public/abono.html` | Fuente de UX para Abonos y Recibo de caja; escritura se habilita más adelante. |
| `documentos.html` | Centro documental | `public/documentos.html` | Portar patrón cuando llegue el módulo de documentos. |
| `calendario.html` | Agenda, eventos, recordatorios y navegación desde campana | `public/agenda.html` | Fuente para Agenda y notificaciones reales. |
| `configuracion.html` | Configuración, integraciones, usuarios y parámetros | `public/configuracion.html` | Portar estructura por secciones; adaptar permisos/config Maderarte. |
| `caja.html` | Flujo de caja | — | NO APLICA por ahora: no existe storage/contrato equivalente en el schema Maderarte actual. No inventar. |
| `ar-homeeasy-v3.html` | Vista AR | — | NO APLICA por ahora. Requiere decisión explícita de producto para Maderarte. |

## Contrato de implementación por módulo

1. Identificar la pantalla HomeEasy fuente en esta tabla.
2. Inspeccionar la versión actual en `alejoherrera05-del/Homeeasy/main`, incluidos overrides CSS/JS que afecten la experiencia final.
3. Escribir una lista corta de paridad: qué debe sentirse/funcionar igual y cuáles son las únicas desviaciones Maderarte.
4. Portar el flujo visual/funcional sobre la infraestructura Maderarte ya aprobada (`/api/maderarte`, Firebase, sesión propia, Apps Script modular, Sheet/Drive separados).
5. No introducir un shell, tabla, modal o patrón alternativo solo por preferencia del implementador.
6. Validar desktop + móvil comparando contra HomeEasy antes de pedir merge.

## Inicio: patrón actual confirmado

La versión actual de HomeEasy usa:
- barra de acciones separada por encima del hero;
- controles circulares;
- hero editorial con marca/fecha/saludo;
- navegación tipo Settings en grupos y filas grandes;
- bottom sheets que emergen desde abajo para subacciones;
- campana vinculada a tareas reales del calendario;
- footer de sistema con versión real.

Maderarte puede sustituir identidad, banner y los controles que el propietario haya aprobado explícitamente, pero debe conservar esta arquitectura de experiencia.

## Clientes: patrón actual confirmado

La versión actual de HomeEasy usa dos momentos claros:

1. **Búsqueda**: pantalla enfocada en encontrar al cliente por identificación/nombre y transición explícita al expediente.
2. **Expediente**: encabezado de cliente, identidad/contacto, acciones, resumen comercial, pestañas de Órdenes/Cotizaciones, tarjetas de documentos, saldo/progreso, historial de abonos, PDF y retorno contextual.

Maderarte debe partir de ese flujo. En modo lectura, las acciones de edición/creación se ocultan o deshabilitan de forma honesta, pero la estructura de consulta se conserva.

## Cotización: especialización aprobada

El formulario conserva la esencia de operación simple y directa, pero se especializa para mobiliario:

- la sede es el primer paso y bloquea el resto del formulario hasta seleccionarla;
- se muestran número previsto, fecha, asesor y sede antes de capturar información;
- cada mueble usa Descripción, Categoría, Cantidad, Valor unitario, Tela/acabado, Madera/acabado, Especificaciones y Fotografías;
- Referencia, Unidad y Medidas no vuelven a existir como campos independientes; medidas y detalles técnicos viven en Especificaciones;
- el documento omite etiquetas/campos opcionales vacíos;
- si no existen fotografías, no existe anexo fotográfico;
- si solo algunos muebles tienen fotos, solo esos aparecen en el anexo.

### Documento de cliente aprobado

La versión aprobada ya no intenta copiar literalmente el PDF de HomeEasy. Usa una solución híbrida acordada:

- **encabezado propio Maderarte** con logo, wordmark, eslogan, `COTIZACIÓN`, número, fecha, sede y datos corporativos;
- debajo del encabezado, **cuerpo calmado tipo HomeEasy**, con información del cliente, detalle comercial de productos, subtotal/descuento/total y condiciones legibles;
- el documento no impone un porcentaje obligatorio de abono; las condiciones de pago se acuerdan con el cliente;
- la cantidad, valor unitario y valor total tienen columnas alineadas;
- el cierre usa la altura disponible de la hoja en vez de comprimir todo hacia arriba;
- el asesor aparece al cierre como bloque legible `Asesor comercial` + nombre;
- Maddy + información del sistema forman un pie centrado en todas las hojas;
- todas las páginas llevan `Página X de Y`;
- los anexos de fotografías se paginan como hojas A4 reales con el mismo pie documental.

Visual QA captura el HTML real en Chrome y genera PDF real para evitar aprobar maquetas que no coincidan con la exportación.

## Seguimiento de cotizaciones: paridad implementada en lectura

La fuente es `Homeeasy/main/seguimiento.html`. Se conserva su concepto de **radar comercial**, pero sobre la infraestructura y datos propios de Maderarte.

### Paridad conservada

- cabecera compacta con volver + identidad + actualizar;
- hero de seguimiento;
- dos indicadores principales: cantidad de propuestas abiertas y valor en seguimiento;
- lectura visual de antigüedad mediante tres bandas: `0–7 días`, `8–15 días`, `más de 15 días`;
- filtros por rango de fechas;
- tarjetas comerciales con número, cliente, valor, antigüedad y observaciones;
- grid de tres columnas en desktop y una columna en móvil;
- visor de PDF cuando existe una URL HTTPS válida;
- estados de carga, vacío y error.

### Desviaciones Maderarte deliberadas

- el rango inicial es **últimos 30 días**, no únicamente el mes calendario, para no ocultar una oportunidad envejecida por haber cambiado de mes;
- se puede buscar por cotización, cliente, documento o teléfono;
- se puede filtrar por sede MP / TP;
- una cotización convertida muestra su OP relacionada y deja de sumar en el potencial abierto;
- no se copian las acciones HomeEasy de `Nota` ni `Archivar`, porque implican escritura y `COMMERCIAL_WRITES=false`;
- la primera implementación es estrictamente de lectura: `COTIZACIONES_LISTAR` requiere `cotizaciones.read` y respeta las sedes permitidas de la sesión;
- el modo `?preview=1` usa datos demostrativos locales únicamente para QA visual; la base comercial real permanece en cero.

Visual QA de Seguimiento valida Chrome desktop y móvil, protege el grid de tres columnas, la ausencia de overflow horizontal, los tres niveles de antigüedad y la cotización convertida.

## Desviaciones Maderarte permitidas

- Identidad naranja/grafito/dorado y logo oficial Maderarte.
- Sin Hommy ni assets de marca HomeEasy.
- Backend seguro e independiente ya aprobado.
- Campos adicionales propios de muebles y reglas comerciales reales de Maderarte.
- Acciones de escritura bloqueadas mientras `COMMERCIAL_WRITES=false`.
- Formularios y documentos pueden mejorar el equivalente de HomeEasy cuando la mejora responde al negocio de mobiliario, sin perder su esencia minimalista y operativa.

Cualquier otra desviación debe estar pedida explícitamente por el propietario o justificada por una diferencia real de negocio.

## Orden de pedido: formulario y documento de preparación

Fuente inspeccionada: `Homeeasy/main/pedido.html`, commit `aa21decbe809a91362a2cddfd272c7c5744dfddd` (5 de septiembre de 2026).

Paridad: volver a Inicio, identificación con coincidencias en el mismo campo, datos del cliente y dirección de entrega, productos editables, subtotal/descuento/total, observaciones de fabricación y documento con marca/número/fecha/cierre. En móvil se conserva captura vertical y controles amplios.

Adaptaciones Maderarte: selección de sede MP/TP, muebles y fotografías del sistema aprobado de Cotización, modalidades y pagos acordados, y plazo de fabricación solo cuando corresponde, documento paginado y anexos solo cuando hay fotos. El asesor firma al final solo con su nombre.

Límite de esta entrega: formulario de borrador, sin crear OP, cobrar abonos, convertir cotizaciones ni escribir en Sheets/Drive. No se reutiliza el consecutivo de cotizaciones: la OP muestra «Borrador» y el número se asignará al guardar. La dirección autocompletada puede editarse para la entrega, sin modificar el cliente. El abono indicado en el borrador no confirma un pago recibido.

Cotización y Pedido comparten búsqueda, edición de muebles y un único renderizador paginado. Los IDs internos `quote-*` se conservan en ambos HTML para evitar duplicar lógica; los textos, permiso y tipo documental dependen de la pantalla.

## Corrección operativa del propietario — 5 de septiembre de 2026

La aclaración posterior al primer formulario de OP sustituye cualquier regla histórica de abono obligatorio del 30%. Maderarte maneja separado, solicitud/fabricación y entrega inmediata. Se portan de `Homeeasy/main/pedido.html` y `abono.html` (commit `aa21decbe809a91362a2cddfd272c7c5744dfddd`) la captura directa del importe, medio y saldo; se amplían por petición expresa a pagos combinados, Addi, notas internas y segundo teléfono. Las observaciones del pedido son acuerdos visibles para el cliente. La nota del pago es interna y se excluye del documento.

Las cifras de mínimos en checkpoints anteriores son evidencia histórica de una regla corregida, no una instrucción vigente. La fuente actual es `BUSINESS_RULES.md`.

## Pedidos mixtos y valores del documento

La aclaración posterior del propietario permite sala disponible y comedor por solicitar en la misma OP. Se conserva el recorrido de productos → pagos → observaciones, con disponibilidad dentro de cada mueble y separado independiente. El cierre económico ocupa el ancho del documento con total, abono y saldo alineados; los medios van debajo. La referencia vigente sigue siendo `pedido.html` en `aa21decbe809a91362a2cddfd272c7c5744dfddd`; la adaptación por mueble y el cambio de proporciones fueron solicitados expresamente. No se cambia la identidad ni el encabezado aprobado de Maderarte.
