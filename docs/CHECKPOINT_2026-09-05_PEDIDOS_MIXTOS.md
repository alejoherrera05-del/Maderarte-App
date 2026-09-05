# Pedidos mixtos y cierre económico — preparación

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

## Implementación y validación

PR de la entrega: [#10](https://github.com/alejoherrera05-del/Maderarte-App/pull/10). Los checks de cada commit y el despliegue final quedan asociados al PR y a `main`.

- `npm ci` y `npm test` completos: correctos. El DOM prueba sala disponible + comedor para fábrica, separado independiente, cambio y eliminación de líneas sin alterar pagos, importe libre y validación del mueble incompleto.
- La disponibilidad se conserva cuando un texto extenso se divide entre páginas. Cambiar de sede mantiene el formulario. El borrador no consume consecutivos ni escribe datos.
- La prueba real de Chrome exige un pedido mixto corto en una hoja A4, con dos teléfonos, correo, observaciones y pagos combinados. Comprueba la vista móvil a 390 y 320 px, importes de 22–23 px sin recortes, saldo correcto y ausencia de notas internas en HTML/PDF.
- El cierre económico usa todo el ancho de la hoja: tres importes alineados en A4 y filas apiladas en la vista móvil; los medios se presentan debajo. Los contactos ocupan tres columnas en A4 sin reducir la letra. El encabezado y la firma aprobados se conservan.
- Documentos extensos siguen paginándose completos, con anexos solo si existen fotografías. La prueba imprime un PDF real y compara el contenido y las páginas con la vista previa.
- La publicación requiere que esos checks pasen y que Cloudflare despliegue el commit de `main`. El PR registra los resultados finales y el commit publicado; un build de rama no demuestra publicación del dominio habitual.

## Límite operativo

Esta entrega prepara captura y documento. No registra ventas, abonos, solicitudes ni entregas. Antes de habilitar escrituras se deberá persistir la disponibilidad por línea y el separado independiente, además de validar remisiones parciales, idempotencia, permisos, auditoría y privacidad de notas. No se modifica el esquema instalado desde esta entrega.
