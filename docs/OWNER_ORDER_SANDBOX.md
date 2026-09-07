# Ensayo aislado del propietario — PR #23

Continúa desde main 0c36e96053cf5d21eb709f73ff258ed16da91130 y el diseño aprobado. No reemplaza la aplicación ni usa la copia de prueba asistida. El código fuente incorpora un contexto de ensayo explícito, no una apertura global de operaciones.

## Instalación (después de CI y publicación)

1. Respaldar Código.gs en el computador. Reemplazarlo COMPLETO con Maddy_Cerebro_Completo.txt exportado de la revisión comprobada. No duplicar módulos. Conservar el archivo DiagnosticoInstalacion.gs si existe; no contiene otra copia del Cerebro.
2. Conservar el manifiesto y su dependencia de Sheets que ya resolvió SERVICE_DISABLED. No reemplazar appsscript.json por la referencia básica del paquete. No cambiar tokens, IDs, banderas ni GCP.
3. No repetir preparadores de esquema: la base original ya fue preparada. El ensayo construye su propia hoja vacía al iniciarlo, sin copiar identidad, sesiones, clientes ni secretos.
4. Ejecutar diagnosticarDocumentosMaddy: schema:true, drive:true, errors:[], commercialWrites:false, PREPARACION. No habilitar ninguna bandera por este diagnóstico.
5. Implementar -> Administrar implementaciones -> misma implementación -> Editar -> Nueva versión -> Implementar. Se conserva URL y opciones de acceso.
6. Entrar con el propietario a /prueba-pedido.html y pulsar Preparar espacio de prueba. La preparación crea recursos reales aislados en Google, pero aún no crea una orden.
7. Abrir formulario de prueba. El cliente ficticio está precargado y protegido. Completar hasta tres muebles, fotografías diferentes y hasta cuatro pagos ficticios. Guardar y revisar los enlaces, PDF y reapertura antes de limpiar.

No es necesario crear otro proyecto ni cambiar la base de producción por una copia.

## Aislamiento y autenticación

La sesión, usuario, rol y permisos se verifican contra las tablas ORIGINALES en cada solicitud. Solo PROPIETARIO activo con config.read. La variable de contexto es privada a una ejecución; el navegador solo puede presentar el identificador del ensayo vigente, nunca un Spreadsheet_ID o una carpeta arbitraria.

El estado guarda IDs reservados en MADDY_OWNER_SANDBOX_V1. SPREADSHEET_ID, DRIVE_DOCUMENTS_ROOT_ID y las banderas originales no se sustituyen. Usuarios, Roles, Sesiones e Invitaciones nunca se leen de la hoja aislada.

Una carpeta 99_PRUEBA_PEDIDO_QA-... dentro de MADERARTE APP contiene su propia hoja de 25 pestañas y su propio 02_DOCUMENTOS_CLIENTES. Prefijos MP/TP-QA-identificador-OP/RC conservan los consecutivos originales. Una sola orden por ensayo; reintentos del mismo identificador son permitidos, otra orden es rechazada.

Las identidades de carpetas se reservan antes de crear. Las hojas nativas no aceptan IDs pregenerados: se persiste intención antes del POST, y se busca el mismo marcador tras una respuesta perdida. Una búsqueda vacía inmediata NO autoriza a repetir la creación. Un intento incierto conserva su registro y exige consulta/revisión.

El formulario y expediente originales usan ?prueba=QA-.... La API propaga el contexto también a las dos llamadas internas del generador PDF. Sin ese contexto se mantienen las compuertas normales deshabilitadas. Borrador, journal e identificador de bloqueo del navegador se separan por ensayo; no cambian la identidad real del usuario. El servidor impone datos de contacto sintéticos. Los PDF y anexos incluyen SIN VALIDEZ COMERCIAL en cada página.

## Limpieza

No hay borrado al cerrar ni temporizadores. Desde el control, Finalizar y limpiar prueba exige escribir LIMPIAR seguido del identificador exacto. Cancelar no altera archivos. La aceptación visual del usuario precede esa confirmación.

La limpieza requiere ausencia de una transacción incierta y documentos COMPLETOS (o ensayo vacío sin intento admitido). Relee el árbol entero con paginación y contrasta cada archivo con IDs/parent/marcadores reservados. Un archivo ajeno o trasladado impide continuar. El plan se conserva y la fase pasa a LIMPIANDO antes de retirar recursos; nuevas escrituras quedan bloqueadas. Envía cada archivo a papelera y confirma su estado por ID; reanuda tras fallos sin DELETE definitivo. La hoja de pruebas completa se retira junto a los archivos, no se borran filas en producción. CERRADA solo tras confirmar todos. Permanece un registro técnico pequeño de cierre sin contenido de clientes/fotos.

Si una creación nativa quedó incierta o hay documentos incompletos sin originales para recuperar, no existe un botón que fuerce el borrado: requiere revisar el mismo ensayo. No limpiar propiedades ni restablecer números.

## Alcance de la validación

Los tests ejecutan módulos reales de Apps Script, autenticación, Worker y formularios con transporte Google sintético. El PDF se renderiza en Chromium con el HTML aprobado. El ensayo automático verifica una OP, fotos, abonos, exclusión de notas privadas, pérdida de respuesta y limpieza confirmada; conserva la base original del fixture sin cambios comerciales. Esto NO sustituye la aceptación en la cuenta real del propietario.

La sesión HTTP de QA es sintética; no equivale a demostrar la emisión de cookies, cuotas/tiempos reales Google ni Safari/iPhone físico. Ni CI ni el botón Preparar activan ventas normales. El siguiente cierre exige evidencia real aportada por el propietario y lectura de Sheets/Drive.
