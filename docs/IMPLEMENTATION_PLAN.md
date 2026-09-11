# Plan de implementación

## Fase 1 — Fundación

- Repositorio público independiente.
- HTML multipágina y sistema visual.
- Firebase compartido y sesión propia preparados.
- Base de Apps Script.
- Ledger de órdenes y expediente en modo lectura.
- Base comercial nueva y vacía.

## Fase 2 — Publicación visual segura

- Adaptar el repositorio a Cloudflare Workers con Static Assets.
- Publicar `public/` y `/api/maderarte` en una unidad de despliegue.
- Obtener una URL temporal `workers.dev`.
- Verificar login, navegación, recursos, 404, cabeceras y respuesta controlada de la API.
- Revisar computador y móvil.
- No configurar todavía secretos ni habilitar escrituras comerciales.
- Auditar los DNS existentes antes de conectar `app.maderartepopayan.com`.

## Fase 3 — Conexión privada

- Crear el proyecto Apps Script oficial.
- Configurar Script Properties.
- Ejecutar `verificarBaseCero()`.
- Desplegar el Web App.
- Configurar secretos de Cloudflare.
- Probar el propietario ya autorizado.

## Fase 4 — Lectura completa

- Centro de operaciones.
- Filtros y búsqueda de OP.
- Expediente con productos, abonos, comentarios, recibos, soportes y remisiones.
- Validación en computador y móvil.

## Fase 5 — Escrituras comerciales

- Clientes.
- Cotizaciones.
- Creación directa de OP.
- Conversión de cotización a OP.
- Abonos y recibos.
- Producción.
- Remisiones.
- Anulaciones y versiones.

## Fase 6 — Documentos e integraciones

- Plantillas PDF aprobadas.
- Envío manual por WhatsApp.
- WAHA y Bridge propios de Maderarte en el VPS actual.
- Reportes y controles administrativos.

## Avance del 9 de septiembre de 2026 — Producción
Primer incremento: preparación de solicitudes al proveedor desde una OP, publicado mediante PR #50. Reglas confirmadas por el propietario y alcance en PRODUCTION_REQUESTS.md. El seguimiento de confirmación, fabricación, transporte y recepción permanece pendiente; preparar o abrir WhatsApp no registra esos movimientos.

## Actualización del 11 de septiembre de 2026

El registro de movimientos por mueble y la recepción parcial ya están implementados y fueron verificados en el ensayo del propietario (PR #57). La OP muestra historial y permite confirmar movimientos explícitos; abrir WhatsApp sigue sin registrar un envío.

Siguiente incremento: continuidad según el estado real. Un mueble pendiente abre la solicitud con su selección; uno en seguimiento abre la actualización de producción; las unidades disponibles llevan a remisión. La solicitud limita cantidades usando los totales registrados por etapa, sin sumar etapas que corresponden a las mismas unidades.

La escritura comercial general sigue en preparación. Quedan pendientes la agenda de entregas, el seguimiento global de pendientes y la validación de activación comercial. No se declara cerrada esa fase por publicar mejoras de interfaz.
