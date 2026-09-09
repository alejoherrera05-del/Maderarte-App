# Telones Maddy — diseño aprobado

El propietario aprobó el 9 de septiembre de 2026 la familia editorial para Clientes, Remisiones y Abonos, con dos ajustes: gris del Inicio (`--bg`, #f5f5f4) y San Francisco del sistema. Esta aprobación sustituye la composición anterior de las portadas; se conserva el recorrido de búsqueda a expediente de HomeEasy, verificado contra `aa21dec`.

Las tres entradas comparten `maddy-entrance.css` y el controlador de presentación `maddy-entrance.js`. La API, los permisos, el guardado y los PDFs permanecen en sus controladores existentes. Una selección muestra el expediente o formulario; Nueva búsqueda vuelve al telón. La recuperación de una operación pendiente abre el área de trabajo y conserva el bloqueo de guardado.

La tipografía usa `--font-sans`: San Francisco nativa en Apple, Segoe UI en Windows y la fuente del sistema en otros equipos. No se distribuyen archivos de fuentes. Logos y firma provienen de los recursos originales.

Por la corrección posterior del propietario, las tres entradas usan el recorte transparente original de Maddy, sin filtros de brillo, mezcla ni saturación. Se prioriza la identidad limpia frente a las poses regeneradas. El folio oscuro se construye como una superficie de color uniforme que ocupa todo el ancho en computador. Las ilustraciones son decorativas, no contienen controles y se ocultan al buscar en móvil.

La revisión operativa se realiza en el dominio habitual. GitHub Actions comprueba regresiones, recursos, ausencia de desbordamiento, portada sin foco automático y entrada de búsqueda en 320, 390 y 1440 píxeles; exporta capturas del HTML ejecutado. La base comercial no se utiliza como fuente de pruebas en CI.
