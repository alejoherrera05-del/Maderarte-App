# QA visual — telones Maddy

final result: passed

## Alcance y evidencia

Diseño aprobado: Clientes, Remisiones y Abonos de la propuesta editorial del propietario, con cambio explícito a gris del Inicio y tipografía San Francisco del sistema. Implementación comprobada: código `5a1ff93531e03ba267e6cedaa90aea5bb0179697`, PR #46.

Capturas del HTML ejecutado en GitHub: [Remisiones QA, ejecución 34370594858](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34370594858), artefacto `remissions-qa`. Incluye entradas y búsqueda de las tres secciones a 320, 390 y 1440 px. Las referencias originales de 875×1797 se normalizaron a 390×800 para compararlas junto con las capturas móviles de 390×800, densidad 1. Comparación adicional a 320×800 y 1440×1000. Estado: entrada vacía, tema claro y sesión autorizada; foco revisado por separado.

## Hallazgos corregidos

- P2: el buscador de Remisiones heredaba dirección vertical en móvil. Se fija dirección horizontal y se verifica que entrada y botón compartan altura.
- P2: la imagen crecía con toda la altura libre y ocupaba el espacio de la firma. Se limita la altura de la composición, se conserva el encuadre y se usa la misma familia de placas en las tres pantallas. Las capturas finales muestran la firma libre a la izquierda.
- P2: Remisiones reutilizaba inicialmente un recorte con escala distinta. La placa final conserva tamaño, borde y encuadre de Clientes y Abonos.

## Superficies revisadas

- Tipografía: `--font-sans`, peso 650 en títulos, cuerpo de búsqueda de 16 px y etiquetas legibles. SF nativa en Apple con sustitución del sistema en otras plataformas; no se distribuyen fuentes. Las capturas de Chromium en Linux usan su fallback, no acreditan un render de Safari físico.
- Espaciado: jerarquía marca → título → búsqueda → Maddy; controles de 44 px; sin superposición entre firma y personaje ni desplazamiento horizontal. En pantallas estrechas se prioriza el campo sobre el icono de lupa.
- Colores: fondo verificado como rgb(245,245,244), cobre en acción/foco y grafito en el folio. El placeholder tiene más contraste que la maqueta. Las placas incorporan integración tonal en CSS.
- Imágenes: WebP optimizadas, recursos cargados y proporciones conservadas. Logo, wordmark y firma originales. Imágenes decorativas sin controles incrustados.
- Contenido: títulos operativos y búsqueda, sin párrafos de explicación ni resultados iniciales. Los formularios aparecen tras seleccionar la coincidencia.

Las firmas usan el recurso vectorial original en vez de la interpretación generada de la maqueta. El título móvil es más compacto para conservar la escala común y la lectura de Remisiones; diferencias deliberadas de implementación, sin hallazgos P0/P1/P2 pendientes. La cabecera y el buscador fueron legibles en las comparaciones completas, por lo que no requirieron recortes adicionales.

## Interacción y regresión

GitHub ejecutó npm ci y npm test. Pasaron Calidad, Remisiones QA, Owner order sandbox QA, Order documents QA y Order progress and document family QA. Se conservan consultas, recuperación sin duplicados, selección de cantidades, cotización a OP, cuatro abonos y PDFs. La portada no enfoca automáticamente el campo y oculta el personaje al buscar en móvil. El dominio habitual se verifica después del merge conforme a la instrucción del propietario.
