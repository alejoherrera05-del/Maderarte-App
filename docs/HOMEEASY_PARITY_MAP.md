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
| `cotizacion.html` | Flujo, cliente, items, cálculos, documento y emisión de cotización | `public/cotizacion.html` | Paridad mejorada: conservar esencia/flujo, pero usar composición específica para mobiliario Maderarte. |
| `seguimiento.html` | Seguimiento/radar de cotizaciones | `public/cotizaciones.html` | Portar lectura y seguimiento; adaptar estados de Maderarte. |
| `pedido.html` | Formulario de Orden de Pedido y documento/PDF | `public/pedido.html` | Fuente de la futura creación de OP. Debe reutilizar el sistema especializado de Cotización. |
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

## Cotizaciones: desviación Maderarte aprobada

El formulario de cotización toma de HomeEasy la lógica de documento comercial, búsqueda de cliente, items, cálculos, vista previa y futura emisión, pero **no** reutiliza la hoja PDF como interfaz de edición.

Reglas específicas de Maderarte:

- La sede es el primer paso obligatorio y bloquea el resto del formulario hasta ser seleccionada.
- La sede define consecutivo previsto, datos públicos de emisión y asociación operativa.
- Fecha, número previsto, sede y asesor deben ser visibles antes de capturar el cliente.
- El formulario usa una composición editorial/operativa propia de Maderarte, no un hero genérico ni una plantilla SaaS.
- Cada item de mobiliario usa solo: descripción, categoría, cantidad, valor unitario, tela/acabado, madera/acabado, especificaciones y fotografías.
- `Referencia`, `Unidad` y `Medidas` no son campos separados del formulario. Las medidas y cualquier detalle técnico viven dentro de `Especificaciones`.
- Las fotografías se asocian al item y se presentan en un anexo fotográfico separado de la hoja comercial principal.
- La vista previa debe tener membrete de empresa, sede emisora, fecha, consecutivo, asesor, cliente, detalle, resumen financiero y condiciones comerciales.
- El backend puede exponer metadata de lectura para el consecutivo previsto, pero no consume/reserva números mientras `COMMERCIAL_WRITES=false`.

## Desviaciones Maderarte permitidas

- Identidad naranja/grafito/dorado y logo oficial Maderarte.
- Sin Hommy ni assets de marca HomeEasy.
- Backend seguro e independiente ya aprobado.
- Campos adicionales propios de muebles y producción cuando tengan sentido real de negocio.
- Acciones de escritura bloqueadas mientras `COMMERCIAL_WRITES=false`.

Cualquier otra desviación debe estar pedida explícitamente por el propietario o justificada por una diferencia real de negocio.
