# Checkpoint — Operación comercial aclarada por el propietario

Fecha: 5 de septiembre de 2026. Base `0bc9706b18c7f07a4d2f96303622ede59f5eddf8`. Rama `pedido-modalidades-pagos-contacto`. [PR #9](https://github.com/alejoherrera05-del/Maderarte-App/pull/9).

## Regla vigente

La aclaración del propietario sustituye la regla anterior del 30% obligatorio. Se contemplan separado, pedido para solicitar y entrega inmediata. El importe del abono se acuerda y lo escribe el asesor: $50.000, $100.000 u otro valor positivo. El saldo depende de la suma indicada, no de un porcentaje ni de la modalidad.

`docs/BUSINESS_RULES.md` y `AGENTS.md` registran esta decisión. Los checkpoints anteriores describen evidencia histórica; no deben usarse para restablecer el mínimo fijo.

## Cambios

- Pedido: elección explícita de modalidad mediante tres opciones amplias. La selección no fabrica, entrega ni confirma pagos automáticamente.
- Captura de pagos repetible: importe, medio (efectivo, transferencia, tarjeta, Addi) y nota interna opcional por cada parte.
- Abono indicado = suma de importes; saldo = total menos abono. No se impone mínimo porcentual. Se rechazan importes negativos/malformados, medios faltantes y suma superior al total antes de abrir el documento.
- La modalidad de entrega inmediata no imprime plazos de fabricación. La referencia de 25–30 días queda vinculada a solicitud/fabricación.
- El recuadro de cierre se llama **Observaciones del pedido** y sirve para acuerdos visibles al cliente: obsequios, transporte incluido, instalación, etc.
- Las notas de pago se identifican como internas. La proyección de datos del documento selecciona exclusivamente medio e importe; no incluye la nota interna.
- Cotización y Pedido incorporan segundo teléfono opcional, autocompletado desde `CLIENTE_OBTENER.alternatePhone`, respaldado por la columna existente `Clientes.Telefono_Alterno`. Se imprime solo cuando se diligencia.
- Se elimina también el abono obligatorio del formulario de Cotización.
- Los avisos de validación quedan junto a modalidad y pagos, con foco en el campo que debe corregirse.

Referencia funcional inspeccionada: `Homeeasy/main/pedido.html` y `abono.html`, commit `aa21decbe809a91362a2cddfd272c7c5744dfddd`. Las ampliaciones a tres modalidades, Addi, pagos combinados, segundo teléfono y notas internas responden a la instrucción explícita del propietario.

## Evidencia

`npm ci` y `npm test`: satisfactorios. Las pruebas DOM verifican permisos, sedes, importes libres, varios pagos, eliminación de una parte, saldo, cambio de modalidad sin alterar pagos, bloqueo de sobrepago y autocompletado/limpieza del segundo teléfono al cambiar de cliente. Las pruebas unitarias cubren los cuatro medios, pago total, importes inválidos y exclusión de la nota interna en los datos públicos.

Sobre `d2cddd081e824c28278f02d30fcf3f660df58d0e`:

- [Calidad 33994043359](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33994043359): satisfactoria.
- [Chrome/PDF 33994043366](https://github.com/alejoherrera05-del/Maderarte-App/actions/runs/33994043366), trabajo `101381220353`: satisfactorio.
- Tres modalidades probadas a 1440, 390 y 320 px. Campos de 17 px y ausencia de desbordamiento horizontal.
- Total $1.900.000; transferencia $50.000 más efectivo $100.000; abono indicado $150.000 y saldo $1.750.000.
- Pago completo con Addi; sobrepago rechazado.
- Segundo teléfono y acuerdos visibles en el documento; sentinelas de nota interna ausentes del HTML de vista previa y del PDF real.
- Pedido extenso con fotografía: cuatro páginas de PDF coincidentes con la vista previa; cero errores de consola.
- Regresión de Cotización con 25 muebles: siete páginas, contenido completo y un único total.

El cierre añade el ajuste de ubicación/foco de avisos y su prueba DOM. Las comprobaciones del commit final deben pasar antes del merge. No se presenta el despliegue de rama como publicación de producción.

## Alcance de preparación

Los valores y notas permanecen temporales en el formulario. No se guardan clientes, pedidos, pagos ni notas internas, no se cobran tarjetas/Addi ni se escriben datos comerciales en Sheets/Drive. El documento sigue marcado como borrador. No hace falta actualizar el Cerebro para probar esta interfaz.

Antes de habilitar guardado debe implementarse el contrato de pagos por partes con idempotencia y auditoría. La nota interna necesita un campo separado (`Nota_Interna` o equivalente explícito) y permisos; nunca debe reutilizarse `Comentario`, que participa en vistas y documentos públicos. El teléfono alterno ya tiene contrato de lectura. Esta entrega no modifica el schema remoto.

La revisión visual del propietario se realiza en `https://app.maderartepopayan.com/pedido.html` tras verificar el despliegue de `main`. El QA automatizado de Chrome no equivale a una prueba física de Safari/iPhone ni a una declaración de estabilidad de toda la aplicación.
