# Control de facturación electrónica

## Propósito

Maddy ayuda a que la administración mantenga un ritmo constante de facturación. La primera versión muestra:

- meta **mínima** mensual, inicialmente `COP 20.000.000`;
- ritmo mínimo de `2` facturas firmadas por semana;
- aviso preventivo a los `5` días sin factura y alerta a los `8` días;
- última factura firmada y avance del mes;
- facturas registradas recientemente;
- órdenes de pedido disponibles para vincular, de forma opcional, al registro.

La meta es un indicador operativo. Nunca es un tope, una instrucción para omitir ventas ni una determinación de las obligaciones tributarias. La responsabilidad de facturar cada operación se conserva y debe revisarse con la contabilidad y las reglas aplicables.

## Alcance de la primera versión

FacturaTech continúa siendo el sistema que emite, firma y transmite la factura electrónica. Maddy no suplanta a FacturaTech ni reporta un documento a la DIAN.

El flujo es:

1. Emitir y confirmar la factura en FacturaTech.
2. Abrir Facturación en Maddy.
3. Seleccionar las OP relacionadas, si existen.
4. Registrar fecha, sede, prefijo, número, CUFE y valor total.
5. Confirmar expresamente que el documento ya está firmado en FacturaTech.

No existe una acción “no facturar” ni una clasificación automática de órdenes como exentas. Una factura puede registrarse sin OP, y varias OP del mismo cliente y sede pueden vincularse a una sola factura.

## Integridad y seguridad

- `facturacion.read` permite consultar el ritmo y el registro.
- `facturacion.manage` permite registrar comprobantes ya emitidos.
- El propietario conserva acceso total; los demás accesos deben autorizarse de forma explícita.
- El CUFE y la combinación prefijo/número no pueden repetirse.
- Una OP no puede quedar vinculada a dos facturas activas.
- El registro usa `ScriptLock`, idempotencia, lote atómico y recuperación de respuesta perdida.
- Registrar una factura no modifica la OP, sus abonos, su saldo ni su estado.
- La lectura y las listas respetan las sedes de la sesión.

## Datos y configuración

La pestaña `Facturacion_Electronica` se crea de forma perezosa en el primer registro confirmado. Una consulta nunca crea hojas.

Las reglas admiten estas claves opcionales en `Configuracion`:

| Clave | Valor predeterminado |
|---|---:|
| `FACTURACION_META_MINIMA_MENSUAL` | `20000000` |
| `FACTURACION_MINIMO_SEMANAL` | `2` |
| `FACTURACION_AVISO_DIAS` | `5` |
| `FACTURACION_ALERTA_DIAS` | `8` |

Los valores predeterminados funcionan sin escribir configuración nueva.

## Activación y siguientes fases

El menú permanece marcado `En preparación` hasta publicar la versión correspondiente del Apps Script y validar una lectura real en el dominio oficial. Esto evita exponer una pantalla cuyo backend todavía no reconozca sus acciones.

Después de validar esta primera fase se puede evaluar una integración oficial con el Web Service de FacturaTech o una importación CSV. Esa fase debe usar credenciales privadas del proveedor, conciliación por CUFE y controles de reintento; no se automatiza mediante navegación del portal.
