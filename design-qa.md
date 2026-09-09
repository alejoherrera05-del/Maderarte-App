# QA visual — Maddy por categoría

final result: passed

## Referencia y evidencia

Referencia de identidad: outputs/maddy-exact-reference/maddy-reference.png (1086×1448). Poses derivadas: outputs/maddy-category-poses/{clientes,abonos,remisiones}-source.png, mismo tamaño. Recortes alfa comprobados sobre gris y grafito; colores visibles idénticos a cada fuente tras la exportación WebP sin pérdida.

Implementación: f80410d52f6f7e80a6fbf391bd82118210545ccc, PR #48. [Capturas de GitHub Actions](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34389366548), artefacto remissions-qa, carpeta artifacts/remissions/entrada-*.png. Copia de revisión: work/maddy-poses-traced/artifacts/remissions/.

Estados: entradas vacías autenticadas de Clientes, Abonos y Remisiones, misma composición existente. Viewports 1916×950, 1440×1000, 1366×768 (2x, captura 2732×1536), 1024×768, 390×800 y 320×800. Capturas restantes a densidad 1x. Referencia y render abiertos juntos para comparar identidad, escala y objetos; la fuente es el recurso sin interfaz y no se interpreta como pantalla a escala 1:1.

## Comparación e iteraciones

- P1 resuelto: las tres entradas repetían el mismo gesto. Ahora hay una ficha de cliente en carpeta, un datáfono con recibo y un paquete con comprobación de despacho. Rostro, estilo animado, traje y colores coherentes con la referencia aprobada.
- P2 resuelto: restos de cuadriculado en rizos y entre brazo y torso. La primera limpieza del hueco dejó cortes rectangulares en la manga (534d4aa). Se sustituyó por un contorno específico de cada pose. La comparación final de entrada-clientes-1916.png y entrada-abono-1366.png confirma mangas opacas y huecos limpios sobre gris. También se revisaron recursos completos sobre grafito y ampliaciones de los huecos.
- Composición conservada: título/buscador y retrato en columnas de escritorio, base grafito de lado a lado, fondo #f5f5f4, controles cobre y tipografía del sistema. Sin filtros cromáticos sobre Maddy. No cambian CSS ni lógica comercial.
- Móvil: los objetos quedan a la izquierda/centro de la ilustración y se reconocen en 390 y 320 px. Se mantiene el recorte lateral del personaje. A 320 px la caja queda cerca de la firma decorativa; posible refinamiento P3, no afecta búsqueda ni reconocimiento de la actividad.

No quedan hallazgos P0/P1/P2 en las capturas finales. Recursos 1086×1448, aproximadamente 1,2 MB por sección, disponibles para presentación de hasta 720 px de alto a densidad 2x. Las nuevas poses son ediciones generativas guiadas por referencia; no se afirma igualdad píxel a píxel del rostro generado con el original. El procesamiento posterior sí conserva todos los RGB visibles.

## Verificación funcional y límites

GitHub ejecuta npm ci y npm test, además de las suites de búsqueda, remisiones, pedidos, abonos y documentos con datos sintéticos. Se verifican carga de imágenes, resolución, ausencia de overflow, estado inicial y flujo de búsqueda. Chromium en el runner; no equivale a prueba física de Safari. La publicación se comprueba después en app.maderartepopayan.com. Este informe no declara finalizada toda la aplicación.
