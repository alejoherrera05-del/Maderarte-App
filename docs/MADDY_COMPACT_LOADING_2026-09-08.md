# Carga compacta con Maddy — alcance solicitado el 8 de septiembre de 2026

## Base y referencia
Base verificada: main 722742e11bf6a0b11744ec751e6e6eaf461e6119, árbol 05640f29320a36388bee4311fcb6b8c8c0e87e9b.
La propietaria del diseño es Maderarte; no se modifica HomeEasy ni se copian sus datos.
Referencia funcional: Homeeasy/main, pedido.html y cotizacion.html, loadingTexts: Hommy prepara lápiz/regla o calculadora, procesa el PDF y prepara el documento. Se adapta ese tono cercano a Maddy, sin copiar mensajes que indiquen borrar documentos o enviar a producción cuando Maderarte no lo hace.

## Decisión del propietario
Usar exclusivamente la imagen Maddy_Carga_Aprobada_2026-09-08.png: cintura para arriba, fondo transparente, tableta y agarre de lapicero corregido. No regenerarla.
Sustituir la lista pesada del PR #27 por una composición móvil ligera: personaje recortado, un mensaje protagonista a la vez, marcas discretas de pasos confirmados. La cobertura sigue bloqueando la aplicación mientras se confirma la operación, con recuperación ante fallo.

## Implementación y límites
- Componente visual compartido de cotización y orden, con mensajes específicos por documento.
- Conservar eventos y confirmaciones existentes: ningún éxito, porcentaje o check depende del tiempo.
- Distinguir vista previa, preparación del PDF, apertura de impresión y archivo confirmado en Drive. No anunciar un guardado inexistente en cotizaciones.
- Imagen optimizada con transparencia real y sin redes externas durante la carga.
- No tocar Apps Script, permisos, banderas, datos comerciales ni documentos archivados.
- Recibos de caja siguen siendo un módulo independiente; esta tarea no cambia su contrato.

## Verificación pendiente
Revisar navegador real a 1440, 768, 390 y 320 px; pantalla baja/horizontal, teclado, movimiento reducido, imágenes fallidas, respuestas demoradas/inciertas, reapertura y mensajes específicos. Pruebas del guardado y PDF existentes deben continuar pasando.
