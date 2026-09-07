# Cierre documental de órdenes

Base: c6f1b11d443041447ae483e5265c4123ad72ff9a, checkpoint original del PR #19.

Solicitud: completar los pendientes de fotografías, carpetas, PDF, enlaces y reapertura sin rediseñar el formulario aprobado. La prueba asistida anterior no se usa como aprobación de extremo a extremo.

## Alcance en desarrollo

- Persistencia privada e idempotente de fotos por mueble.
- Carpeta documental por cliente y orden con reintentos independientes del dinero.
- Exportación de la plantilla aprobada con los datos confirmados.
- Registro y consulta de documentos y referencias al reabrir la orden.
- Pruebas de interrupción, identidad, privacidad y aceptación aislada.

El código original y los datos de producción siguen separados de los ensayos. No se habilitan ventas por la mera existencia de este documento. La evidencia final y las instrucciones de actualización se agregarán después de implementar y verificar el flujo.
