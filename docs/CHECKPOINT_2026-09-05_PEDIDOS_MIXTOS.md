# Pedidos mixtos y cierre económico — en desarrollo

Solicitud del propietario: una misma OP puede incluir una sala disponible y un comedor que debe solicitarse a fábrica. La disponibilidad se decide por mueble; el separado y los pagos son independientes.

## Alcance acordado

- Sustituir las tres modalidades globales excluyentes por disponibilidad en cada línea: disponible para entrega inmediata, solicitar a fábrica o por definir con el cliente. No marcar entregas realizadas ni solicitudes enviadas desde el borrador.
- Conservar el separado como condición opcional del pedido, compatible con cualquiera de esas disponibilidades y con pedidos mixtos.
- Si unidades del mismo mueble tienen disponibilidades distintas, capturarlas en líneas separadas. Las futuras remisiones conservarán las cantidades entregadas por línea.
- Conservar abonos de importe libre, pagos combinados, notas internas excluidas del documento y segundo teléfono.
- Reorganizar el cierre económico de la OP con total, abono y saldo visibles sobre todo el ancho disponible, y desglose de medios de pago. Mantener identidad, encabezado y firma Maderarte.
- Publicar en el dominio habitual después de las pruebas. Mantener PREPARACION, sin escrituras comerciales ni cambios del esquema instalado.

## Base y referencia

Base Maderarte: `8305d8e5df5fd5b4620f57d89769273d08460ff8`. Rama: `feat/mixed-orders-document-summary`.

Referencia vigente inspeccionada: HomeEasy `aa21decbe809a91362a2cddfd272c7c5744dfddd`, `pedido.html`: productos, observaciones y cierre con importes explícitos. La entrega por mueble y las proporciones del bloque económico adaptan ese recorrido a la operación de Maderarte, por solicitud expresa del propietario.

## Validación pendiente

Probar sala disponible + comedor para fábrica, separado compatible con ambos, cambios y eliminación de líneas sin alterar pagos, privacidad del PDF, lectura móvil y paginación real de Chrome. Registrar aquí los resultados antes de cerrar la entrega.
