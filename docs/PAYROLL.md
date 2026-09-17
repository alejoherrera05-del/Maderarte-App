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

## Quincena como centro de trabajo
La sección abre una quincena con trabajadores dentro de sus fechas de vinculación. El propietario pidió este circuito y una experiencia clara para una persona poco habituada a aplicaciones: nombre, importe, estado y una acción visible por persona; los ajustes se despliegan solo cuando se necesitan. Inicio a mitad de período se prorratea; un comprobante previo se abre en lugar de crear otro. Cobertura parcial se señala explícitamente.

Los borradores BORRADOR viven en Nomina_Eventos con control de revisión, auditoría e idempotencia. Guardar o revisar no crea comprobantes ni reserva comisiones. REVISADO se recalcula contra las bases actuales: cambios de ficha, salario o venta invalidan la revisión. Emitir conserva el snapshot y pasa a pendiente de pago. PAGADO solo nace de la confirmación expresa de dinero ya entregado, nunca de imprimir el PDF. No se ejecutan transferencias bancarias. Historial de eventos y comprobantes no se borra.

Novedades: ausencias no remuneradas separadas; permisos remunerados conservan salario y permiten indicar días con auxilio. Vacaciones, incapacidades o varias novedades requieren días, fechas/detalle, valor y base de aportes revisados por la persona responsable/contador. No se aplica una tasa genérica de incapacidad ni se presume una liquidación de vacaciones correcta sin sus antecedentes. Se reemplaza el salario ordinario de esos días, no se suma dos veces; el detalle se conserva en el comprobante. Este circuito no calcula la PILA ni determina origen/prórroga de incapacidades. Referencia: Ministerio de Salud, Concepto Jurídico 2024424001742752 de 2024, https://www.minsalud.gov.co/Normatividad_Nuevo/Concepto%20Jur%C3%ADdico%202024424001742752%20de%202024.pdf .

Pruebas sintéticas: quincena seleccionable, revisión legible en 320/390/1440px, borrador y reintento, edición concurrente, revisión sin emisión, pago único, períodos superpuestos, entrada parcial, ausencia frente a permiso e incapacidad, y permisos del servidor.
