# Revisión para el estreno de Maddy

Fecha: 16 de septiembre de 2026. Base revisada: `2edaea7c337917f32c9bf14ebbd86dc3deb1ee10`.

Esta revisión no registra trabajadores, clientes ni operaciones comerciales. No certifica un «100 %»: distingue implementación, pruebas automatizadas y comprobación del servicio publicado.

## Comprobado en el dominio

- Configuración responde en modo OPERACION, escrituras habilitadas, cero clientes y cero órdenes. Equipo conserva una persona y ninguna invitación pendiente.
- Inicio termina de cargar la agenda y muestra el estado vacío.
- Nueva cotización permite seleccionar sede y abre el formulario. Principal muestra `MP-COT-001` como consecutivo previsto; no se emitió ni consumió el número.
- La preparación del formulario y la consulta inicial de agenda muestran espera apreciable. No se midió una distribución de tiempos; no confundir esta observación con un fallo permanente.

## Cobertura disponible

La suite del repositorio cubre cotizaciones y conversión, OP, abonos, remisiones, seguimiento de producción, devoluciones y cambios, garantías, agenda, recaudos, aislamiento por sede, permisos individuales, revocación de sesiones y recuperación de borradores. Son pruebas con dobles/simulaciones; no sustituyen una emisión completa contra Google y la inspección de los PDFs resultantes.

## Condiciones pendientes para el estreno

1. **Recuperación de datos demostrada.** La estructura documental reserva `04_BACKUPS`, pero no se encontró una rutina de copia/restauración ni disparadores en el código de Apps Script versionado. Esto no descarta copias externas. Falta verificar una copia reciente de Sheets y documentos y ensayar su restauración aislada. Un respaldo de código no demuestra recuperación comercial.
2. **Ensayo integral de la versión vigente.** Repetir en el entorno de ensayo existente cotización → OP → abonos → remisión parcial y final; inspeccionar PDFs, saldos y consecutivos, incluyendo reintento tras respuesta perdida. Los ensayos históricos y la suite aportan evidencia parcial, no una certificación actual de extremo a extremo.
3. **Comprobación en Safari real.** La vista estrecha del navegador de desarrollo no acredita comportamiento en un iPhone. Validar recuperación tras recarga y regreso desde segundo plano, apertura de PDFs y controles táctiles en el dispositivo antes de incorporar al equipo.

## Alcance acordado

No son pendientes del estreno: fotografías de garantías, contabilidad completa/egresos, WhatsApp automático ni incorporación de empleados. El control de recaudos cuenta ingresos por sede y medio y recepción de efectivo; no pretende ser caja contable completa.

## Orden de cierre

Primero recuperación de datos; después ensayo comercial completo y Safari; corregir los hallazgos reproducibles; finalmente autorización del propietario para incorporar personas con casillas de acceso mínimas. Mantener evidencias privadas fuera de Git.
