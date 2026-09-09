# QA visual — telones Maddy

final result: passed

## Alcance y evidencia

Clientes, Remisiones y Abonos. Código verificado: `50d32424bf5f09bb35ed9f3b1ea3ddd7adcb08f9`, PR #46. La última indicación del propietario sustituye las placas generadas por Maddy original transparente sin filtros y extiende el grafito de lado a lado en escritorio.

Capturas del HTML ejecutado en GitHub: [Remisiones QA, ejecución 34371640704](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34371640704), artefacto `remissions-qa`. Entradas y búsqueda de las tres secciones a 320, 390 y 1440 px. Comparación conjunta de referencia normalizada y render a 390×800; revisión adicional a 320×800 y 1440×1000, sesión autorizada, tema claro y entrada vacía.

## Resultado visual

- Fondo del Inicio rgb(245,245,244), búsqueda blanca, cobre y grafito plano #282624.
- Personaje original con transparencia real, sin filtros ni mezclas CSS. Se descartan las placas con fondos pintados. Misma pose original en las tres entradas; decisión comunicada al propietario para conservar identidad y evitar manchas.
- Grafito a todo el ancho en escritorio, sin contenedor central ni costuras. La cabeza emerge por encima de su borde y la firma conserva espacio propio.
- Buscadores horizontales, controles de 44 px, sin desbordamiento horizontal. Al buscar en móvil se retira la ilustración y se priorizan las coincidencias.
- Logo, wordmark y firma originales. Títulos móviles más compactos que la maqueta para conservar una escala común en Remisiones. No hay párrafos de explicación iniciales.
- San Francisco mediante la cadena tipográfica del sistema Apple; fallback en Windows y Linux. Las capturas de Chromium Linux no acreditan Safari físico. No se distribuyen fuentes.

No se identificaron problemas P0/P1/P2 pendientes en estas capturas. El recurso original de Maddy tiene resolución limitada (420×560); puede verse más suave en pantallas densas, pero no incorpora el tratamiento de color rechazado.

## Interacción y regresión

Las cinco ejecuciones de GitHub para el código indicado finalizaron correctamente: Calidad (incluye npm ci y npm test), Remisiones QA, Owner order sandbox QA, Order documents QA y Order progress and document family QA. Se comprueban consultas, selección, retorno a búsqueda, recuperación sin duplicados, cantidades, cotización a OP, cuatro abonos y PDFs con datos sintéticos del runner. Las nuevas comprobaciones exigen ausencia de filtros en Maddy y grafito de ancho completo en escritorio.

La verificación del dominio habitual se realiza después del merge. Este informe certifica las entradas y regresiones indicadas; no declara concluida toda la aplicación.
