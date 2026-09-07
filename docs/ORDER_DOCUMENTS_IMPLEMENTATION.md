# Implementación documental de órdenes

Base: c6f1b11d443041447ae483e5265c4123ad72ff9a. Rama: feat/order-media-documents.

Trabajo solicitado por el propietario: completar fotos, carpetas, PDF aprobado y reapertura en Maddy original. No sustituir el diseño ni importar la prueba asistida.

Decisiones de implementación:
- Reservar identidades de archivos antes de subirlos. Reintentar el mismo archivo no crea otro.
- Una orden confirmada puede tener documentación pendiente; terminarla no crea otra venta ni otros pagos.
- Generar el PDF con el HTML y la paginación aprobados y datos confirmados del servidor. Las notas internas no se envían al motor de PDF.
- Browser Run de Cloudflare con binding BROWSER y quickAction; sin clave adicional de navegador ni cambio a un plan pagado.
- Mantener desactivada la operación comercial hasta instalar y comprobar el Cerebro y la integración real.

Fuentes técnicas consultadas el 7 de septiembre de 2026:
https://developers.cloudflare.com/browser-run/quick-actions/
https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/
https://developers.google.com/workspace/drive/api/guides/create-file

Estado inicial: implementación en curso; todavía no constituye aceptación de extremo a extremo.
