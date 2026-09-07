// Manual, owner-editor preflight. Does not create a commercial row or alter a
// production ID, counter or flag. Fail before provisioning/uploading on API errors.
function verificarServiciosDocumentalesMaddy() {
  if (MADERARTE_APP.COMMERCIAL_WRITES !== false || getConfigValue_('MODO_OPERACION', '') !== 'PREPARACION') throw appError_('DOCUMENT_PREFLIGHT_NOT_ALLOWED', 'Esta comprobación se usa antes de activar ventas reales.', 403);
  var token = ScriptApp.getOAuthToken();
  var checks = [
    { service: 'Google Sheets API', url: 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(requiredProperty_('SPREADSHEET_ID')) + '?fields=spreadsheetId' },
    { service: 'Google Drive API', url: 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID')) + '?fields=id,name,mimeType' }
  ];
  checks.forEach(function(check) {
    var response;
    try { response = UrlFetchApp.fetch(check.url, { method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true, followRedirects: false }); }
    catch (error) { throw appError_('DOCUMENT_API_UNREACHABLE', 'No se pudo consultar ' + check.service + '. No actives ventas ni crees un pedido de prueba todavía.', 503); }
    if (response.getResponseCode() !== 200) throw appError_('DOCUMENT_API_NOT_READY', check.service + ' no autorizó la comprobación (HTTP ' + response.getResponseCode() + '). Revisa su habilitación en el proyecto de Google y los permisos del Cerebro. No cambies IDs ni borres registros.', 503);
    var metadata = parseJson_(response.getContentText(), null);
    if (!metadata || (check.service === 'Google Sheets API' && metadata.spreadsheetId !== requiredProperty_('SPREADSHEET_ID')) || (check.service === 'Google Drive API' && (metadata.id !== requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID') || metadata.name !== '02_DOCUMENTOS_CLIENTES' || metadata.mimeType !== 'application/vnd.google-apps.folder'))) throw appError_('DOCUMENT_PREFLIGHT_IDENTITY', 'La comprobación documental no devolvió la base y raíz esperadas.', 503);
  });
  var result = { ok: true, revision: ORDER_DOCUMENT_REVISION_, sheetsApi: 'LECTURA_OK', driveApi: 'LECTURA_OK', commercialWrites: false, note: 'Acceso comprobado. No certifica aún una escritura ni un PDF real.' };
  Logger.log(JSON.stringify(result)); return result;
}
function prepararYVerificarEnsayoDocumentalMaddy() {
  verificarBaseCero();
  verificarServiciosDocumentalesMaddy();
  return prepararEnsayoDocumentalMaddy();
}
