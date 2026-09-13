// Diagnostico temporal de instalacion. Solo hace dos consultas GET a Google.
// No prepara columnas, no crea archivos ni ventas y no cambia propiedades.
// Agregar como archivo DiagnosticoInstalacion.gs; NO reemplaza Codigo.gs.
// No imprime tokens, IDs privados, URLs ni el cuerpo de errores de Google.
function diagnosticarAccesoGoogleMaddy() {
  var informe = {
    diagnostico: 'MADDY-ACCESO-GOOGLE-1',
    soloLectura: true,
    guardadoComercialVerificado: false,
    pruebas: []
  };
  var propiedades = PropertiesService.getScriptProperties();
  var token;
  try { token = ScriptApp.getOAuthToken(); }
  catch (error) {
    informe.error = 'NO_SE_PUDO_OBTENER_AUTORIZACION';
    Logger.log(JSON.stringify(informe));
    return informe;
  }
  var estados = ['PERMISSION_DENIED', 'UNAUTHENTICATED', 'INVALID_ARGUMENT',
    'NOT_FOUND', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'UNAVAILABLE'];
  var motivosPermitidos = ['SERVICE_DISABLED', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT',
    'ACCESS_TOKEN_EXPIRED', 'accessNotConfigured', 'insufficientPermissions',
    'forbidden', 'notFound', 'authError', 'rateLimitExceeded',
    'userRateLimitExceeded', 'dailyLimitExceeded', 'backendError'];
  [
    { servicio: 'Google Sheets API', propiedad: 'SPREADSHEET_ID',
      prefijo: 'https://sheets.googleapis.com/v4/spreadsheets/',
      campos: 'spreadsheetId,properties(title),sheets(properties(title,gridProperties(columnCount)))' },
    { servicio: 'Google Drive API', propiedad: 'DRIVE_DOCUMENTS_ROOT_ID',
      prefijo: 'https://www.googleapis.com/drive/v3/files/',
      campos: 'id,name,mimeType,trashed,capabilities(canAddChildren)' }
  ].forEach(function(prueba) {
    var salida = { servicio: prueba.servicio };
    informe.pruebas.push(salida);
    var id = String(propiedades.getProperty(prueba.propiedad) || '').trim();
    if (!id) { salida.error = 'FALTA_' + prueba.propiedad; return; }
    try {
      var respuesta = UrlFetchApp.fetch(prueba.prefijo + encodeURIComponent(id) +
        '?fields=' + encodeURIComponent(prueba.campos), {
        method: 'get',
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
        followRedirects: false
      });
      salida.http = respuesta.getResponseCode();
      var datos = null;
      try { datos = JSON.parse(respuesta.getContentText()); } catch (error) {}
      if (salida.http === 200 && datos) {
        salida.lecturaOk = prueba.propiedad === 'SPREADSHEET_ID'
          ? datos.spreadsheetId === id : datos.id === id;
        if (!salida.lecturaOk) { salida.error = 'RESPUESTA_NO_VALIDADA'; return; }
        if (prueba.propiedad === 'SPREADSHEET_ID') {
          salida.baseEsperada = Boolean(datos.properties &&
            datos.properties.title === 'Base de Datos Maderarte App');
          salida.pestanas = Array.isArray(datos.sheets) ? datos.sheets.length : null;
          salida.columnasPedido = null;
          (Array.isArray(datos.sheets) ? datos.sheets : []).forEach(function(hoja) {
            if (hoja.properties && hoja.properties.title === 'Ordenes_Pedido') {
              salida.columnasPedido = hoja.properties.gridProperties
                ? hoja.properties.gridProperties.columnCount : null;
            }
          });
        } else {
          salida.carpetaEsperada = datos.mimeType === 'application/vnd.google-apps.folder' &&
            datos.name === '02_DOCUMENTOS_CLIENTES' && datos.trashed === false;
          salida.puedeAgregarArchivos = Boolean(datos.capabilities && datos.capabilities.canAddChildren);
        }
        return;
      }
      salida.lecturaOk = false;
      var fallo = datos && datos.error || {};
      salida.estadoGoogle = estados.indexOf(fallo.status) !== -1 ? fallo.status : 'NO_IDENTIFICADO';
      salida.motivos = [];
      var detalles = (Array.isArray(fallo.details) ? fallo.details : [])
        .concat(Array.isArray(fallo.errors) ? fallo.errors : []);
      detalles.forEach(function(detalle) {
        var motivo = detalle && detalle.reason;
        if (motivosPermitidos.indexOf(motivo) !== -1 && salida.motivos.indexOf(motivo) === -1) {
          salida.motivos.push(motivo);
        }
      });
    } catch (error) {
      salida.lecturaOk = false;
      salida.error = 'CONSULTA_NO_COMPLETADA';
    }
  });
  informe.accesoLecturaOk = informe.pruebas.every(function(prueba) { return prueba.lecturaOk === true; });
  Logger.log(JSON.stringify(informe));
  return informe;
}
