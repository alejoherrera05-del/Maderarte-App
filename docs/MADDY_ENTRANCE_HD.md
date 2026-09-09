# Maddy — recorte exacto de la referencia del propietario

El propietario fijó como referencia exacta la imagen adjunta el 9 de septiembre de 2026 y autorizó expresamente: «Sí, recorta esa imagen sin regenerarla». Las variantes generadas posteriores se rechazaron antes de publicar.

Recurso final: `public/assets/brand/maddy-entrance-hd.webp`, 1086×1448 RGBA, WebP sin pérdida. Se deriva directamente del archivo adjunto, modificando únicamente el canal alfa para retirar el fondo cuadriculado. Rostro, cabello, manos, pose, prendas y colores conservan los píxeles RGB originales. La comprobación tras volver a abrir el WebP confirma igualdad de todos los píxeles RGB visibles.

Procesamiento autorizado con Python: segmentación de fondo con rembg/isnet, limpieza de contaminación neutra junto al contorno y ajuste mínimo del borde alfa. Ningún cambio generativo, de color, redibujo, interpolación o reencuadre. El resultado se examinó sobre gris #f5f5f4 y grafito #282624. El tamaño de presentación se limita a720px de alto en escritorio, suficiente para densidad2x.

Las herramientas de recorte y los archivos de revisión se conservaron fuera del repositorio. Solo se publica el recurso final y su documentación. El archivo pequeño anterior sigue disponible para las pantallas de carga que lo usaban.
