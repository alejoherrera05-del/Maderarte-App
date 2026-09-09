# QA visual — expresiones y postura natural

final result: passed

## Referencia y capturas

Identidad aprobada: outputs/maddy-exact-reference/maddy-reference.png. Poses anteriores aprobadas: outputs/maddy-category-poses/. Nuevas fuentes y prompts: outputs/maddy-natural-gestures/{clientes,abonos,remisiones}-source.png y *-prompt.txt. Todas a 1086×1448. Se compararon las imágenes completas y los contornos sobre gris y grafito.

Implementación cf050290fb7a867581b0f47436c8e7fe1be841b0, PR #49. [GitHub Actions](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34390761879), artefacto remissions-qa, artifacts/remissions/entrada-*.png. Copia de revisión work/natural-qa/artifacts/remissions/.

Viewports: 1916×950, 1440×1000, 1366×768 con densidad 2x (2732×1536), 1024×768, 390×800 y 320×800; los demás a 1x. Estado inicial autenticado y vacío. Fuente y render abiertos en el mismo conjunto de comparación; fuente de ilustración sin interfaz, por lo que se compara identidad y gesto con su tamaño CSS proporcional, no una pantalla fuente 1:1.

## Hallazgos y resolución

- P1 resuelto: se repetían cabeza, mirada y sonrisa. Clientes ahora dirige ojos/cabeza a la ficha; Abonos mira hacia quien paga y sonríe con gesto abierto; Remisiones mira la comprobación y sostiene la caja desde abajo. Se conserva el estilo animado y vestuario. La revisión es visual, no certificación biomecánica.
- P2 de preparación resuelto: el recorte automático retiraba el papel del datáfono y dejaba cuadriculado junto al brazo. Se preservó el recibo mediante su contorno y se recortó el hueco de Clientes. Los píxeles visibles mantienen RGB de cada fuente generada. Se revisaron completos y en detalle antes de integrar.
- La firma móvil baja de 67% a 78% para dejar libres carpeta y paquete; entrada-remision-320.png y entrada-clientes-390.png confirman separación de los objetos y firma dentro de pantalla.
- entrada-clientes-1916.png confirma columnas, fondo gris y base grafito de ancho completo. Las capturas móviles confirman objetos reconocibles y rostros diferenciados. Tipografía del sistema y controles existentes conservados.

Sin hallazgos P0/P1/P2 pendientes en comparación final. Las tres nuevas imágenes son ediciones con referencia mediante la herramienta integrada de generación; recorte posterior con Python autorizado. No se afirma identidad píxel a píxel de los nuevos rostros. WebP sin pérdida, resolución 1086×1448, aproximadamente 1,1 MB por sección.

## Verificación

Suites de GitHub con npm ci y npm test y flujos sintéticos existentes: Calidad, Remisiones QA, Owner order sandbox QA, Order documents QA y Order progress and document family QA. Comprobaciones de resolución, carga, ausencia de overflow y búsqueda. No hay cambios en reglas comerciales. Runner Chromium, no Safari físico. Verificación del dominio habitual tras merge.
