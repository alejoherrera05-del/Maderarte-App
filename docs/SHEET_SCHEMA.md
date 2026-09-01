# Esquema del Sheet

## Fuente oficial

Nombre exacto: `Base de Datos Maderarte App`.

## Pestañas comerciales

| Pestaña | Propósito |
|---|---|
| `Clientes` | Datos principales y enlace a la carpeta del cliente |
| `Cotizaciones` | Cabecera, totales, estado, PDF y relación con OP |
| `Ordenes_Pedido` | Una fila resumen por cada OP |
| `Orden_Items` | Una fila por producto de cada OP |
| `Produccion` | Seguimiento por OP o producto |
| `Abonos` | Una fila por pago, con comentario y enlaces |
| `Remisiones` | Cabecera de cada entrega |
| `Remision_Items` | Cantidades entregadas por producto |
| `Agenda` | Entregas, visitas y tareas asociadas |
| `Documentos` | Índice de PDFs y soportes |

## Pestañas de control

| Pestaña | Propósito |
|---|---|
| `Usuarios` | Autorización, rol y sedes de cada persona |
| `Roles` | Permisos por rol en JSON |
| `Configuracion` | Claves operativas y referencias de Drive |
| `Sedes` | Principal y Terraplaza, prefijos y consecutivos |
| `Invitaciones` | Invitaciones controladas de usuarios |
| `Sesiones` | Sesiones opacas emitidas por Maderarte |
| `Auditoria` | Registro de acciones y cambios |
| `Anulaciones` | Motivos y efectos de anulaciones |
| `Versiones_Documentos` | Versiones de PDFs oficiales |
| `Lotes_Numeracion` | Rangos y control de consecutivos |
| `Registro_Numeros` | Reserva y confirmación de cada número |
| `Idempotencia` | Prevención de operaciones duplicadas |
| `Catalogos` | Estados, medios de pago y listas auxiliares |

## Orden de pedido

`Ordenes_Pedido` permite ver rápidamente fecha, OP, sede, cliente, descripción, total, abonado, saldo, estado, producción, entrega, responsable, PDF, carpeta y resumen de abonos.

## Abonos

Cada fila de `Abonos` conserva recibo, OP, fecha, valor, medio de pago, referencia, comentario, saldo anterior, saldo nuevo, PDF, soporte, usuario, estado y `Request_ID`.

No existen columnas `Abono_1`, `Abono_2`, etc. Una OP puede tener tantos registros de abono como necesite.

## Contrato técnico exacto

Los encabezados de `Invitaciones` y `Sesiones` se mantienen exactamente iguales a los definidos en `apps-script/Schema.gs`. Cualquier cambio de nombre debe actualizar primero el contrato, las pruebas y el código que escribe esas hojas.
