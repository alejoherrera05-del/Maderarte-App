# Checkpoint — Orden de pedido en preparación

Fecha: 5 de septiembre de 2026. Base real: `b1ea994b3a479e84f6bab48804e95eb21f144e85`. Rama: `pedido-formulario-documento`. [PR #8](https://github.com/alejoherrera05-del/Maderarte-App/pull/8). Código y pruebas funcionales: `6a63b56b76dd12d2450b6fb0bff78f6153bde544`.

## Entrega

- Inicio → Orden de pedido → Formulario abre `public/pedido.html`.
- Sede MP/TP, cédula con coincidencias en el mismo campo, datos del cliente y dirección editable de entrega.
- Muebles con cantidades, precios, acabados, especificaciones y fotografías. Mínimo un mueble; subtotal, descuento, total y cálculo orientativo del mínimo del 30%.
- Documento específico «ORDEN DE PEDIDO», paginación A4, observaciones de fabricación/entrega y anexo solo si hay fotografías.
- Firma del asesor al cierre, únicamente su nombre. Pie «Borrador · sin validez comercial» en todas las páginas.
- El formulario y la vista previa comparten implementación con Cotización; se elimina la vista previa antigua sin paginación. El diálogo devuelve el foco al botón de apertura al cerrarse y bloquea el formulario de fondo mientras permanece abierto.

Referencia inspeccionada: `Homeeasy/main/pedido.html` en `aa21decbe809a91362a2cddfd272c7c5744dfddd`. Paridad y diferencias de negocio documentadas en `HOMEEASY_PARITY_MAP.md`.

## Validación

`npm ci` y `npm test` completados. Las pruebas DOM ejecutan el módulo real con una sesión sintética de solo sede TP: niegan la sede MP, verifican foco, totales y mínimo, preservación del cliente al elegir sede, al menos un mueble y ausencia de llamadas para consumir consecutivos o guardar. Una cuenta con permiso de cotizaciones, pero sin permiso de OP, no accede al formulario.

[Calidad, ejecución 33992932210](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33992932210): satisfactoria sobre `6a63b56`.

[QA Chrome y PDF, ejecución 33992932073](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33992932073), trabajo `101378267159`:

| Caso automatizado | Resultado |
| --- | --- |
| Pedido: 1440, 390 y 320 px | Campos de 17 px; sin desbordamiento; guardado deshabilitado. |
| Navegación | Inicio → opciones de Pedido → Formulario → sede TP. |
| Dos unidades de $1.000.000 y descuento de $100.000 | Total $1.900.000; mínimo orientativo $570.000; restante si se paga ese mínimo $1.330.000. |
| Pedido breve sin fotografías | Una página; sin anexo; dirección de entrega y un único total. |
| Pedido con observaciones extensas y una fotografía cargada mediante el campo de archivo | PDF real de cuatro páginas, igual a la vista previa; texto completo y un anexo. |
| Identidad del documento | Título de OP, marca Maderarte, firma sin cargo y borrador en todas las páginas. |
| Cotización e Inicio | Regresión responsive a 1440, 768, 390 y 320 px satisfactoria. |
| Cotización con 25 muebles y texto extenso | Siete páginas de vista previa y PDF; todo el contenido; un único total; sin desbordamiento. |
| Consola de Chrome | Cero errores en los recorridos comprobados. |

Las capturas y PDFs usan datos sintéticos y quedan como artefactos de GitHub Actions. Estos resultados son QA automatizado de Chrome; no constituyen inspección visual directa del agente ni una prueba física de Safari/iPhone.

## Publicación y límites

Por la instrucción vigente del propietario, tras superar las comprobaciones se fusiona el PR y se verifica el despliegue de Cloudflare. La revisión visual se hace directamente en `https://app.maderartepopayan.com/pedido.html`. El resultado del despliegue se confirma en el cierre de esta entrega; no se presenta el despliegue de rama como prueba de producción.

Esta entrega no requiere cambiar el Cerebro instalado. No habilita escrituras: los datos del formulario son temporales, no se crea un cliente ni una OP, no se registra un pago y no se emite un documento oficial. La numeración muestra «Borrador», sin reutilizar ni consumir el consecutivo de Cotización. No se habilita todavía la conversión de cotización a OP.

Quedan la revisión del propietario en su celular y las etapas de guardado comercial con permisos, numeración, idempotencia, Drive y auditoría. No se declara estable toda la aplicación por completar este formulario.
