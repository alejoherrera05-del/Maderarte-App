# Nómina — alcance aprobado

Pantalla nomina.html y acceso desde Inicio, independiente de cuentas de acceso. Fichas con contratos, cumpleaños y documentos privados; nómina quincenal, comisiones, prima y liquidación por terminación. PILA sigue con el contador y no bloquea este módulo.

Comisión: 1% sobre el valor completo vigente de la OP. Sin mínimo de abono. Autorización humana explícita; todas las pendientes, incluso de años anteriores. Una OP no puede estar en dos comprobantes activos. Borrador no reserva; emisión reserva; anulación anterior al pago libera; pago conserva historial. Cambios posteriores de venta requieren revisión, nunca borrado de una comisión pagada.

Emitir no significa pagar ni transferir dinero. Confirmaciones conservan revisión, Request_ID y auditoría. Documentos laborales requieren permisos propios y nunca se incluyen en expedientes públicos de clientes.

Fuentes verificadas: Decreto 159/2026 (salario 1.750.905), Decreto 1470/2025 (auxilio 249.095); MinJusticia, cálculo de liquidación y auxilio de transporte; MinSalud y Colpensiones, aportes ordinarios 4% trabajador. Comisión es salarial (art.127 CST). Parámetros por año; días/base por concepto y descuentos previos explícitos. No confundir pago anual de prestaciones con terminación real del contrato. No asumir continuidad o reinicio de antigüedad.

HomeEasy main 0555553db81ec7567200262e083cef38b9c78557 no contiene módulo de nómina. Se reutiliza el patrón de Configuración/expediente existente de Maddy: navegación por secciones, lista legible y panel/modal responsive; datos e identidad independientes.


## Configuración y quincenas — 16 de septiembre de 2026
Por indicación del propietario, las fichas laborales, documentos y salario fijo se administran en Configuración → Nómina. Nómina conserva únicamente comprobantes y comisiones. La administración anual de salario mínimo y auxilio utiliza el permiso nomina.workers, dependiente de nomina.read y config.read; no se conceden accesos automáticamente.

La referencia Excel facilitada por el propietario fue leída: asignación mensual, auxilio, días laborados, primera/segunda quincena, ausencias, anticipos y comisiones. Se adopta ese recorrido sin copiar registros ni fórmulas inconsistentes a producción. Ninguna persona del archivo se incorpora automáticamente.

Los parámetros anuales se guardan como eventos PARAMETROS en Nomina_Eventos, con revisión, auditoría y Request_ID. No cambian documentos emitidos. Una modificación posterior a la revisión invalida el fingerprint antes de emitir.

Quincena: elegir tipo, trabajador, mes y primera/segunda mitad; se admiten fechas personalizadas. La base mensual es de 30 días, incluyendo la segunda quincena de febrero. Días remunerados y no remunerados deben sumar el período. Solo se registra expresamente una ausencia no remunerada, con motivo: no convertir descansos, incapacidades o licencias remuneradas en descuentos. El comprobante conserva el conteo y separa el descuento de salario y auxilio, sin descontar dos veces ni calcular salud/pensión sobre el salario no devengado. Se mantiene el redondeo de pesos y el ajuste entre mitades del mes completo.

Referencias consultadas: Decreto 159 de 2026 (salario); Decreto 1470 de 2025 (auxilio), https://dapre.presidencia.gov.co/normativa/normativa/DECRETO%201470%20DEL%2029%20DE%20DICIEMBRE%20DE%202025.pdf ; Código Sustantivo del Trabajo, https://www.secretariasenado.gov.co/senado/basedoc/codigo_sustantivo_trabajo_pr001.html . Esta captura no modela incapacidades ni novedades de seguridad social.
