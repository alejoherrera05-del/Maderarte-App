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
| `cotizacion.html` | Formulario, cliente, items, cálculos, observaciones, condiciones y documento | `public/cotizacion.html` | **Paridad mejorada**: conservar lógica y minimalismo, pero no copiar la hoja editable literalmente. Maderarte usa formulario operativo por secciones, items ricos de muebles, fotografías por item, resumen financiero y vista previa/anexo. |
| `seguimiento.html` | Seguimiento/radar de cotizaciones | `public/seguimiento.html` | Portar lectura y seguimiento; adaptar estados, textos y métricas de Maderarte. |
| `pedido.html` | Formulario de Orden de Pedido y documento/PDF | `public/pedido.html` | Fuente de lógica de creación/edición/conversión, con el mismo lenguaje mejorado de formularios Maderarte. No habilitar escritura todavía. |
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

## Formularios comerciales: patrón mejorado Maderarte

Los formularios de HomeEasy son la fuente de lógica y simplicidad, pero **no son una plantilla visual literal**. Para Maderarte se conserva su esencia minimalista y se mejora la experiencia para mobiliario:

- pantalla standalone con cabecera sticky y retorno contextual;
- formulario dividido en bloques claros, no una simulación permanente de hoja PDF;
- información del cliente en una superficie simple;
- cada producto es un item rico e independiente con descripción, categoría, referencia, cantidad, unidad, medidas, acabados, especificaciones y valor;
- cada item permite adjuntar fotografías de referencia en la experiencia de composición;
- las fotografías no saturan la hoja comercial principal: se destinan a un **anexo fotográfico separado**, ordenado por item y con sus especificaciones;
- resumen financiero visible y fácil de leer, sin reducir tipografía;
- condiciones comerciales explícitas y provenientes de reglas de Maderarte;
- la futura OP debe calcular el abono mínimo del **30%** y comunicar fabricación estimada de **25 a 30 días** desde confirmación + abono mínimo;
- responsive real: en móvil los items se apilan como tarjetas y los inputs se mantienen en 16px o más;
- mientras `COMMERCIAL_WRITES=false`, las acciones de guardar/emitir permanecen bloqueadas, pero cálculos, fotos locales y vista previa pueden funcionar para revisión de UX.

## Desviaciones Maderarte permitidas

- Identidad naranja/grafito/dorado y logo oficial Maderarte.
- Sin Hommy ni assets de marca HomeEasy.
- Backend seguro e independiente ya aprobado.
- Campos adicionales propios de muebles: sede, dirección de entrega, descripción detallada, estado de producción, materiales/medidas y demás campos del schema Maderarte.
- Formularios comerciales mejorados para items de mobiliario y anexo fotográfico, manteniendo la esencia minimalista y la lógica probada.
- Acciones de escritura bloqueadas mientras `COMMERCIAL_WRITES=false`.

Cualquier otra desviación debe estar pedida explícitamente por el propietario o justificada por una diferencia real de negocio.
