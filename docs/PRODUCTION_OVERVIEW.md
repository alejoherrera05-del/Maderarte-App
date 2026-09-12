# Vista general de Producción

Consulta por mueble y cantidades pendientes, con datos autorizados por sede. La OP sigue siendo el expediente central; la vista no guarda movimientos ni envía WhatsApp.

Se incorpora una lectura agregada de Ordenes_Pedido, Orden_Items y Produccion. No se hace una petición por OP ni se limita silenciosamente a las primeras cien órdenes. Se consultan órdenes activas, se excluyen muebles entregados/anulados, y se distinguen separado, por solicitar, solicitud registrada, confirmado, fabricación, listo, transporte, bodega y datos por revisar. Los totales por etapa son acumulados: las etapas no se suman como muebles distintos. En movimientos parciales se muestran cantidades, sin inventar qué unidad recorrió cada etapa.

La interfaz reutiliza las imágenes de categoría aprobadas, marca, tipografía y navegación de Maddy. El patrón de listado, filtros y regreso al contexto se contrastó con Homeeasy/main/ventas.html. La composición por mueble responde al flujo propio de Maderarte aprobado por el propietario.

Validación prevista: permisos y sede, cantidades parciales, recepción directa, proveedores múltiples, fallo de consulta, filtros, navegación y revisión responsive publicada.
