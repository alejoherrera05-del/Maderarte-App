# QA visual — escritorio y Maddy exacta

final result: passed

## Evidencia

Implementación comprobada: `7983072ac21fa5e6405020ef8dd93ec074038467`, PR #47. Capturas: [Remisiones QA 34377825202](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34377825202), artefacto remissions-qa.

Se comparó la captura del propietario de Clientes a 1916×950 con el render en ese mismo tamaño y estado vacío. La referencia exacta de Maddy adjunta por el propietario se comparó con el recorte sobre gris y grafito y con las capturas de la interfaz. Verificación adicional a 1440×1000, 1366×768 con densidad 2x, 1024×768, 390×800 y 320×800.

## Hallazgos resueltos

- P1, composición: el buscador quedaba aislado sobre una franja oscura que ocupaba casi media pantalla. Ahora título y búsqueda se relacionan en altura con el retrato; la base grafito ocupa aproximadamente 23% de la altura y conserva todo el ancho. Firma anclada a esa base. Columnas separadas, sin scroll inicial en los tamaños de escritorio verificados.
- P1, identidad y resolución: se retiraron las variantes generadas rechazadas y la copia pequeña de 420×560 de estas entradas. El recurso final es exactamente la imagen adjunta del propietario a 1086×1448, con recorte técnico autorizado; solo cambia el alfa. Igualdad de todos los píxeles RGB visibles comprobada después de exportar el WebP sin pérdida. Máximo de presentación 720 px para disponer de resolución a densidad 2x.
- P2, borde de tableta: la primera limpieza de contaminación neutra afectaba su opacidad. Se limitó la limpieza al contorno del cabello. El render final a 1916×950 confirma el borde sólido de la tableta, sin banda clara.

## Superficies revisadas

Tipografía: cadena de fuentes del sistema, título 650, búsqueda 16 px. SF nativa en Apple y fallback en Windows/Linux; no se acredita Safari físico mediante Chromium Linux.

Espaciado: alineación común del encabezado y contenido; base más baja; firma libre; personaje proporcional; búsqueda accesible en móvil. Sin colisiones ni desplazamiento horizontal en los tamaños revisados. La composición móvil se conserva.

Colores: gris #f5f5f4 del Inicio, grafito #282624 y cobre en controles. Maddy sin filtros de color, brillo o mezcla. Se mantienen los colores exactos del archivo adjunto.

Imagen: 1086×1448 con transparencia real, sin cuadriculado visible; los píxeles visibles conservan su color original. Sin interpolación ni cambios generativos del rostro. El WebP sin pérdida pesa aproximadamente 1,2 MB, compartido y cacheable entre las tres entradas; se prioriza la fidelidad solicitada.

Contenido e interacción: títulos y buscador operativos, sin explicaciones iniciales. Coincidencias y selección abren el flujo existente. No hay cambios en reglas comerciales.

No quedan hallazgos P0/P1/P2 pendientes en estas capturas. No se declara concluida toda la aplicación.

## Regresión y publicación

Las cinco suites de GitHub para 7983072 terminaron correctamente: Calidad (npm ci y npm test), Remisiones QA, Owner order sandbox QA, Order documents QA y Order progress and document family QA. Incluyen búsquedas, retorno, recuperación, cotización a OP, abonos y documentos mediante datos sintéticos del runner. El commit posterior únicamente registra este informe. La publicación se verifica en el dominio habitual después del merge.
