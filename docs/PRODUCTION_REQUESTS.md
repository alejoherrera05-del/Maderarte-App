# Producción — solicitud al proveedor

## Proceso confirmado por el propietario

La OP y sus especificaciones se comunican por WhatsApp al proveedor, con fotografías cuando corresponde. El proveedor confirma el pedido, fabrica, comunica que está listo y coordina el transporte hasta la bodega de Popayán. Tras recibirlo se contacta al cliente y se programa la entrega. Un separado espera el aviso del cliente, solicitado con 30 días de anticipación; los abonos no disparan fabricación.

## Primer incremento

Preparar un mensaje al proveedor desde una OP existente: buscar OP/cliente, seleccionar muebles y cantidades, revisar tela, madera, medidas y especificaciones, indicar proveedor y observaciones de fabricación y generar un texto revisable para copiar o abrir en WhatsApp. Separados requieren marcar que el cliente ya avisó. La acción de abrir WhatsApp no equivale a envío ni confirmación. No cambia disponibilidad, estados ni cantidades.

La OP comercial permanece accesible para consulta interna. No incluir automáticamente su enlace, importes, abonos, identificación ni contacto del cliente en el texto al proveedor. Referencias fotográficas se consultan desde el expediente y se adjuntan manualmente por el operador. Sin enviar mensajes desde el agente ni compartir permisos de Drive.

## Referencia de arquitectura

HomeEasy origin/main aa21decbe809a91362a2cddfd272c7c5744dfddd verificado el 9 de septiembre de 2026: ventas.html tiene búsqueda/listado y pedido.html captura fabricación. No hay módulo de seguimiento productivo en las pantallas inspeccionadas; seguimiento.html corresponde a cotizaciones. Se reutilizan la búsqueda de OP, componentes de selección de Remisiones y formularios existentes de Maderarte.

## Incrementos posteriores

Registrar solicitud y confirmación del proveedor con historial por Item_ID; fabricación; coordinación de transporte; recepción parcial en bodega; enlace explícito a remisiones. Requieren contrato transaccional, idempotencia, cantidades recibidas y revisión de permisos antes de habilitar movimientos. La hoja Produccion existente no tiene ledger de recepción ni Request_ID; no se sustituye con estados guardados solo en el navegador.
