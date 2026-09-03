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
| `cotizacion.html` | Formulario de cotización | `public/cotizacion.html` | Estructura fuente para el flujo; Maderarte especializa el formulario para mobiliario y mejora el documento cliente. Mientras `COMMERCIAL_WRITES=false`, no habilitar creación real. |
| `seguimiento.html` | Seguimiento/radar de cotizaciones | `public/cotizaciones.html` | Portar lectura y seguimiento; adaptar estados de Maderarte. |
| `pedido.html` | Formulario de Orden de Pedido y documento/PDF | `public/pedido.html` | Fuente de la futura creación de OP. Reutilizar el sistema especializado de Cotización. No habilitar escritura todavía. |
| `abono.html` | Registro de abono/recibo y relación con OP | `public/abono.html` | Fuente de UX para Abonos; escritura se habilita más adelante. |
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

El formulario conserva la esencia de operación simple y directa, pero no replica la antigua hoja PDF editable. Para Maderarte:

- la sede es el primer paso y bloquea el resto del formulario hasta seleccionarla;
- se muestran número previsto, fecha, asesor y sede antes de capturar información;
- cada mueble usa Descripción, Categoría, Cantidad, Valor unitario, Tela/acabado, Madera/acabado, Especificaciones y Fotografías;
- Referencia, Unidad y Medidas no vuelven a existir como campos independientes; medidas y detalles técnicos viven en Especificaciones;
- el documento omite etiquetas/campos opcionales vacíos;
- si no existen fotografías, no existe anexo fotográfico;
- si solo algunos muebles tienen fotos, solo esos aparecen en el anexo;
- el encabezado cliente debe ser compacto: marca + identificación documental + una sola franja corporativa; no repetir sede ni consumir media hoja;
- número y fecha tienen jerarquía clara pero nunca deben convertirse en un cartel sobredimensionado;
- Visual QA debe capturar el HTML real en Chrome y medir la geometría antes de aprobar cambios relevantes del documento.

Checkpoint visual aprobado de la cabecera compacta: en la segunda captura real, el detalle comienza a 272 px del borde superior del contenido, con tarjeta documental de 112 px, bloque de marca de 77 px, franja corporativa de 76 px y banda de contexto de 32 px. A ancho de documento 790 px, esa huella equivale aproximadamente al 24–25% de una página A4 proporcional.

## Desviaciones Maderarte permitidas

- Identidad naranja/grafito/dorado y logo oficial Maderarte.
- Sin Hommy ni assets de marca HomeEasy.
- Backend seguro e independiente ya aprobado.
- Campos adicionales propios de muebles y reglas comerciales reales de Maderarte.
- Acciones de escritura bloqueadas mientras `COMMERCIAL_WRITES=false`.
- Formularios y documentos pueden mejorar el equivalente de HomeEasy cuando la mejora responde al negocio de mobiliario, sin perder su esencia minimalista y operativa.

Cualquier otra desviación debe estar pedida explícitamente por el propietario o justificada por una diferencia real de negocio.
