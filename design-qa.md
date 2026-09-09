# QA visual — revisión de escritorio y recurso HD

final result: blocked

## Evidencia y corrección de composición

Solicitud: captura del propietario a 1916×950, entrada Clientes en tema claro. Comparada en el mismo bloque visual con el HTML renderizado por GitHub a 1916×950; revisión adicional de Remisiones a 1366×768. Fuente del render: [Remisiones QA 34374183698](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/34374183698), commit `80d05fb3de0a4c7dba0204b3e0fcf688ee0165b4`, PR #47.

P1 corregido en código: la composición anterior separaba el buscador y el personaje mediante una franja que ocupaba casi media pantalla. El buscador pasa a la altura del retrato; la base grafito ocupa aproximadamente23% de la altura y conserva todo el ancho. Firma anclada a esa base. Revisión en1916,1440,1366,1024,390 y320px; sin desplazamiento horizontal ni vertical en la entrada de escritorio, sin colisión entre columnas. Se conserva la estructura móvil.

Tipografía: fuente del sistema, títulos650, búsqueda16px. Colores: gris del Inicio y grafito originales, sin filtros sobre Maddy. Contenido: títulos y búsqueda operativos, sin nuevos párrafos. La sustitución de fuentes de Chromium/Linux difiere del sistema Windows y de SF nativa Apple.

## Bloqueo de calidad de imagen

P1 pendiente: Maddy usa el archivo de carga de420×560px. La nueva composición requiere más detalle; ampliarlo no recupera resolución. El original documentado1086×1448 llamado Maddy_Carga_Aprobada_2026-09-08.png no está disponible en los archivos locales consultados ni en la búsqueda de Drive. La Biblioteca de ChatGPT exige inicio de sesión en el navegador disponible.

Dos intentos de restauración con Image Gen devolvieron1086×1448RGB con damero pintado y variaciones del rostro. Rechazados; no se incorporaron al repositorio ni al dominio. Se necesita el PNG original para completar la sustitución y repetir la revisión visual de nitidez. La composición revisada queda en la rama remota, sin publicar al dominio mientras conserve este bloqueo.

## Verificación funcional

Las cinco suites de GitHub pasaron para80d05fb: Calidad (npm ci y npm test), Remisiones QA, Owner order sandbox QA, Order documents QA y Order progress and document family QA. Las comprobaciones añaden los tamaños1916×950,1366×768 y1024×768, base menor al31% de la altura, separación entre buscador y personaje, y ausencia de scroll inicial. Las pruebas funcionales existentes y documentos también pasaron.

Siguiente paso: incorporar el original HD, comprobar transparencia/resolución y comparación visual; luego merge y verificación del dominio habitual. No afirmar que el problema de nitidez está resuelto.
