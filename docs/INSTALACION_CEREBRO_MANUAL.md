# Actualizar el Cerebro de Maddy — documentos de órdenes

Paquete del PR #21, sobre Maddy original. El archivo `Maddy_Cerebro_Completo.txt` identifica el commit exacto y reúne los módulos vigentes. No mezclar con los ZIP de etapas anteriores.

## Qué cambia y qué no

Implementa fotografías por mueble, identidades reservadas en Drive, carpetas automáticas, registro documental y finalización recuperable. El PDF lo genera el Worker con la plantilla aprobada y datos confirmados del Cerebro.

La aplicación continúa en PREPARACION. Instalar este código y preparar el esquema NO activa ventas, no emite pedidos de prueba ni cambia consecutivos. La aceptación real del recorrido completo sigue pendiente de la comprobación en Google y Cloudflare.

## 1. Respaldar y reemplazar el código existente

Abre el mismo proyecto de Apps Script que ya utiliza Maddy. No crees otro ni modifiques HomeEasy. Guarda en tu computador una copia del código y del manifiesto actuales; no dejes un segundo archivo .gs de respaldo dentro del proyecto, porque duplicaría funciones.

Si lo tienes reunido en un único `Código.gs` / `Code.gs`, reemplaza TODO su contenido con `Maddy_Cerebro_Completo.txt` y guarda. No agregues el código nuevo debajo del anterior. La última línea debe ser `// FIN DEL CEREBRO COMPLETO`.

Si existen módulos separados u otro código propio, revisar su organización antes de reemplazar o eliminar archivos; no pegar el paquete completo junto a los módulos.

## 2. Conservar configuración y permisos

No cambies tokens, IDs de Sheets/Drive, URL de Apps Script, configuración de Firebase ni secretos de Cloudflare. No actives `ORDER_SAVE_ENABLED`, `ORDER_DOCUMENTS_ENABLED`, `ORDER_DOCUMENTS_ACCEPTED` ni `COMMERCIAL_WRITES`. El modo debe seguir en PREPARACION.

Conserva el manifiesto existente. El JSON incluido es una referencia: esta versión requiere runtime V8 y los alcances `spreadsheets`, `drive` y `script.external_request` indicados allí. Si ya están, no hay que modificarlo. No borres otras propiedades del manifiesto o dependencias del proyecto para copiar la referencia.

## 3. Comprobar y preparar la estructura

Ejecuta primero `verificarBaseCero`. Debe conservar `ok:true`, 23 contratos originales, base comercial vacía y escrituras deshabilitadas. Si falla, detente; no borres registros para forzar el resultado.

Después ejecuta UNA VEZ `prepararDocumentosOrdenes`. Esta es la preparación explícita del nuevo hito; sustituye la indicación anterior de no ejecutar preparadores durante la etapa inicial.

La función amplía los encabezados previstos de Ordenes_Pedido, Orden_Items y Abonos, y añade las pestañas técnicas `Carpetas_Documentales` y `Archivos_Orden`. Conserva las 23 pestañas originales: el total físico esperado pasa a 25. No crea clientes, ventas, abonos, fotografías ni PDFs. Rechaza una base con registros comerciales o una estructura inesperada. Si Google informa un error de API o permisos, copia el mensaje sin compartir secretos y no continúes con la implementación.

No ejecutes además `prepararEsquemaGuardadoOrdenes`: ya lo llama el preparador nuevo cuando corresponde.

Luego ejecuta `diagnosticarDocumentosMaddy`. Este sí escribe un resumen legible en el registro. Lo esperado es `schema:true`, `drive:true`, `commercialWrites:false`, `mode:PREPARACION`, `ok:true` y `productionReady:false`. Este último false es intencional: un diagnóstico no certifica una venta completa.

## 4. Actualizar la implementación existente

Implementar → Administrar implementaciones → seleccionar la aplicación web activa de Maddy → lápiz/Editar → Versión: Nueva versión → Implementar.

Conserva la misma implementación, URL y opciones actuales de ejecución/acceso. No uses Nueva implementación ni configures nuevamente Cloudflare. Descripción sugerida: `Maddy — documentos de órdenes — 07-09-2026`.

## 5. Comprobar la conexión real desde Maddy

Entra con la cuenta propietaria y abre `https://app.maderartepopayan.com/diagnostico-documentos.html`. Pulsa **Verificar instalación**.

La comprobación requiere `config.read`. Consulta el Cerebro e intenta generar un PDF técnico sin datos del cliente y sin escribir registros comerciales. Debe mostrar esquema preparado, acceso a Drive API, PDF técnico generado correctamente y escritura comercial deshabilitada.

Comparte una captura del resultado o el registro de `diagnosticarDocumentosMaddy`, sin mostrar Propiedades del script, tokens ni cookies. Si el motor PDF informa falta de binding o servicio, no cambies a un plan pagado: revisar primero el despliegue de Workers Builds y el binding BROWSER incluido en wrangler.toml.

## Qué queda después de instalar

Instalación y diagnóstico no equivalen a una orden guardada de extremo a extremo. La siguiente aceptación debe usar una sesión real y el mismo código sobre datos aislados para comprobar fotografías, carpetas, PDF, enlaces, reapertura y reintentos. No se habilita producción cambiando banderas a ciegas.

Este hito finaliza el documento OP y sus referencias. Los recibos individuales de caja, las remisiones y solicitudes de producción no se generan por marcar acuerdos ni por registrar el pedido; conservan sus fases y reglas propias.

## Fuentes técnicas

- https://developers.google.com/apps-script/concepts/deployments
- https://developers.google.com/apps-script/concepts/manifests
- https://developers.google.com/workspace/drive/api/guides/create-file
- https://developers.cloudflare.com/browser-run/quick-actions/

No se requieren claves de un generador PDF externo. Los archivos de Drive no se publican mediante permisos para cualquier persona.
