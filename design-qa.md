# Design QA — Inicio Maderarte App

## Evidencia

- Fuente visual: mockup aprobado durante la revisión de Etapa 4.1.
- Fuente visual: 1536 × 1024 px.
- Implementación local de validación: `/index.html?preview=1`.
- Captura escritorio final: `qa/implementation-desktop-final.png`.
- Captura pie de página: `qa/implementation-desktop-footer.png`.
- Captura móvil final: `qa/implementation-mobile-final.png`.
- Comparación conjunta: `qa/comparison-desktop-final.png`.
- Viewport CSS solicitado: escritorio 1280 × 720; móvil 390 × 844.
- Captura física del navegador: escritorio 1265 × 712; móvil 375 × 811. La comparación conjunta normalizó ambas vistas de escritorio a 1280 × 720, sin cambiar su composición.
- Estado: tema claro, sesión local de vista previa, banner nocturno por la hora local. El mockup muestra tarde/Alejandro; la implementación muestra noche/Vista porque saludo, nombre e imagen son dinámicos por hora y sesión.

## Comparación visual

### Vista completa

La comparación conjunta confirma la misma jerarquía del mockup: encabezado blanco elevado, marca a la izquierda, controles de perfil a la derecha, banner interiorista a todo lo ancho, saludo libre sobre la fotografía, columnas Comercial/Operación/Gestión y módulos con iconos blancos sobre naranja, grafito y dorado.

### Regiones enfocadas

- Marca: logo maestro optimizado sin redibujo y rótulo Algerian rasterizado, estable en iPhone y computador.
- Banner: sala contemporánea, sofá y mesa visibles, recorte bajo y texto con sombra sin caja.
- Módulos: iconos Phosphor reales, elevación contenida, colores planos y sin degradados.
- Ventana de opciones: diálogo modal probado en “Órdenes de pedido”, con enlace operativo y acción futura deshabilitada.
- Móvil: Comercial, Operación y Gestión funcionan como acordeón exclusivo y no producen desplazamiento horizontal.
- Pie: sello oficial monocromático, eslogan y versión centrados en composición vertical.

## Superficies de fidelidad

- Tipografía: jerarquía y pesos equivalentes al mockup. `MADERARTE` se entrega como rótulo Algerian rasterizado para evitar una sustitución de fuente en iOS. El resto usa la cadena del sistema.
- Espaciado y ritmo: proporciones del encabezado, banner, cuadrícula, tarjetas, separadores y cierre visual consistentes. El pie conserva aire previo y alineación centrada aprobada.
- Colores: naranja `#E66F17`, grafito `#282624` y dorado `#966F2A`; iconos blancos; no se introdujeron degradados en el inicio.
- Imágenes: tres WebP de 1920 × 400 para mañana, tarde y noche; logo oficial optimizado a 512 × 512; no hay placeholders ni identidad generada.
- Copy: saludo, fecha y nombre dinámicos; etiquetas y descripciones en español; pie exacto “Muebles con un estilo diferente para cada cliente.” y “Maderarte APP 1.0”.

## Historial de correcciones

1. Primera comparación: `[P2]` el recorte nocturno mostraba demasiado tapete y cortaba el respaldo del sofá.
   - Corrección: reprocesar los tres banners a 1920 × 400 desde las imágenes fuente y ajustar el foco vertical a 54%.
   - Evidencia posterior: `qa/implementation-desktop-top-final.png`; el sofá, la mesa y la sala recuperan la composición aprobada.
2. Segunda comparación: `[P2]` el texto Algerian dependía de que la fuente existiera en el dispositivo.
   - Corrección: crear `maderarte-wordmark-algerian.png` como recurso rasterizado aprobado, sin distribuir el archivo de fuente.
   - Evidencia posterior: `qa/implementation-desktop-final.png` y `qa/implementation-mobile-final.png`; el rótulo es idéntico en ambos tamaños.

## Interacciones y validación

- Ventana de opciones de Órdenes: aprobada.
- Menú de perfil: abre y cierra correctamente.
- Acordeones móviles: apertura exclusiva verificada.
- Desbordamiento horizontal móvil: no detectado.
- Consola del navegador: sin errores ni advertencias.
- `npm ci`: aprobado.
- `npm test`: aprobado; 117 archivos, contratos, Apps Script, frontera Edge y Worker verificados.

## Hallazgos residuales

- `[P3]` El sello del pie usa el logo oficial en tratamiento monocromático en lugar de redibujar un segundo emblema lineal. Es una decisión intencional de protección de marca; puede sustituirse en el futuro si Maderarte entrega un sello vectorial secundario aprobado.

## Lista de implementación

- [x] Marca oficial y rótulo Algerian estable.
- [x] Banner dinámico mañana/tarde/noche.
- [x] Menú principal por áreas y colores aprobados.
- [x] Ventanas de subopciones.
- [x] Acordeones móviles.
- [x] Pie centrado con eslogan y versión.
- [x] Pruebas, consola y revisión responsive.

final result: passed
