// Trial data is selected only AFTER authentication against the ORIGINAL base.
// This execution-local scope never changes the production spreadsheet IDs.
var ORDER_DATA_CONTEXT_ = null;
function orderIsTrial_() { return Boolean(ORDER_DATA_CONTEXT_ && ORDER_DATA_CONTEXT_.trial); }
function orderScopedProperties_() {
  var base = PropertiesService.getScriptProperties();
  if (!orderIsTrial_()) return base;
  function key(name) { return name.indexOf('ORDER_') === 0 && name.indexOf('ORDER_QA_') !== 0 ? 'QA_' + name : name; }
  return {
    getProperty: function(name) {
      if (name === 'SPREADSHEET_ID') return ORDER_DATA_CONTEXT_.spreadsheet;
      if (name === 'DRIVE_DOCUMENTS_ROOT_ID') return ORDER_DATA_CONTEXT_.root;
      return base.getProperty(key(name));
    },
    setProperty: function(name, value) {
      if (name === 'SPREADSHEET_ID' || name === 'DRIVE_DOCUMENTS_ROOT_ID') throw appError_('TRIAL_SCOPE_IMMUTABLE', 'No se cambian las fuentes de producción desde un ensayo.', 403);
      base.setProperty(key(name), value); return this;
    },
    deleteProperty: function(name) { if (!name.startsWith('ORDER_')) throw appError_('TRIAL_SCOPE_IMMUTABLE', 'Operación no permitida.', 403); base.deleteProperty(key(name)); return this; }
  };
}
function validateOrderSession_(token, touch) {
  var scope = ORDER_DATA_CONTEXT_;
  ORDER_DATA_CONTEXT_ = null;
  try { return validateSessionToken_(token, touch); }
  finally { ORDER_DATA_CONTEXT_ = scope; }
}
function orderExpectedSpreadsheetName_() { return orderIsTrial_() ? ORDER_DATA_CONTEXT_.name : MADERARTE_APP.SPREADSHEET_NAME; }
function orderOperationsAllowed_() {
  if (orderIsTrial_()) return PropertiesService.getScriptProperties().getProperty('ORDER_QA_ENABLED') === 'SI' && getConfigValue_('MODO_OPERACION', '') === 'ENSAYO';
  return MADERARTE_APP.COMMERCIAL_WRITES === true && getConfigValue_('MODO_OPERACION', 'PREPARACION') === 'OPERACION' && optionalProperty_('ORDER_SAVE_ENABLED', 'NO') === 'SI';
}
function withOrderDataContext_(environment, action, context, work) {
  if (!environment) return work();
  var allowed = ['ORDEN_CAPACIDADES', 'ORDEN_CREAR', 'ORDEN_CREACION_ESTADO', 'ORDEN_OBTENER', 'ORDENES_LISTAR', 'CLIENTES_LISTAR', 'CLIENTE_OBTENER', 'ORDEN_DOCUMENTOS_PREPARAR', 'ORDEN_DOCUMENTOS_ESTADO', 'ORDEN_ARCHIVO_INICIAR', 'ORDEN_ARCHIVO_PARTE', 'ORDEN_ARCHIVO_LEER', 'ORDEN_DOCUMENTOS_FINALIZAR'];
  if (environment !== 'QA' || allowed.indexOf(action) < 0 || !context.session || context.session.profile.role !== 'PROPIETARIO' || context.session.permissions.indexOf('*') < 0) throw appError_('TRIAL_NOT_ALLOWED', 'El ensayo documental requiere la cuenta propietaria.', 403);
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ORDER_QA_SPREADSHEET_ID');
  var root = props.getProperty('ORDER_QA_ROOT_ID');
  if (props.getProperty('ORDER_QA_ENABLED') !== 'SI' || !id || !root || id === props.getProperty('SPREADSHEET_ID') || root === props.getProperty('DRIVE_DOCUMENTS_ROOT_ID')) throw appError_('TRIAL_NOT_READY', 'Prepara primero el ensayo aislado en el Cerebro. La base original no se modificará.', 403);
  var name = SpreadsheetApp.openById(id).getName();
  if (!name.startsWith('Maddy · Ensayo documental ·')) throw appError_('TRIAL_NOT_READY', 'La base de ensayo no tiene la identidad esperada.', 403);
  var previous = ORDER_DATA_CONTEXT_;
  ORDER_DATA_CONTEXT_ = { trial: true, spreadsheet: id, root: root, name: name };
  try { return work(); } finally { ORDER_DATA_CONTEXT_ = previous; }
}
function prepararEsquemaDocumentalMaddy() {
  if (MADERARTE_APP.COMMERCIAL_WRITES || getConfigValue_('MODO_OPERACION', 'PREPARACION') !== 'PREPARACION') throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'Solo se prepara la base vacía, sin escrituras comerciales.', 403);
  if (optionalProperty_('ORDER_SCHEMA_VERSION', '1') !== '3') prepararEsquemaGuardadoOrdenes();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('DOCUMENT_BUSY', 'Hay otra operación en curso.', 409);
  try {
    verifyCommercialBaseZero_();
    var sheet = getSpreadsheet_().getSheetByName(ORDER_ARCHIVE_SHEET_);
    if (!sheet) sheet = getSpreadsheet_().insertSheet(ORDER_ARCHIVE_SHEET_);
    var headers = getHeaders_(sheet);
    if (headers.length && JSON.stringify(headers) !== JSON.stringify(ORDER_ARCHIVE_HEADERS_)) throw appError_('SHEET_SCHEMA_MISMATCH', 'La tabla documental requiere revisión.', 503);
    if (!headers.length) sheet.getRange(1, 1, 1, ORDER_ARCHIVE_HEADERS_.length).setValues([ORDER_ARCHIVE_HEADERS_]);
    sheet.setFrozenRows(1);
    getScriptProperties_().setProperty('ORDER_SCHEMA_VERSION', '3');
    verifySchema_();
    var result = { ok: true, schemaVersion: 3, commercialWrites: false, mode: 'PREPARACION', controlSheet: ORDER_ARCHIVE_SHEET_ };
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
// Run manually from the existing project's editor. Creates an empty, separate
// test environment, not a copy of sessions, users, secrets or commercial data.
function prepararEnsayoDocumentalMaddy() {
  if (MADERARTE_APP.COMMERCIAL_WRITES) throw appError_('SCHEMA_SETUP_NOT_ALLOWED', 'El ensayo se prepara antes de activar operaciones reales.', 403);
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('DOCUMENT_BUSY', 'Hay otra operación en curso.', 409);
  try {
    var id = props.getProperty('ORDER_QA_SPREADSHEET_ID');
    var rootId = props.getProperty('ORDER_QA_ROOT_ID');
    if ((id && id === props.getProperty('SPREADSHEET_ID')) || (rootId && rootId === props.getProperty('DRIVE_DOCUMENTS_ROOT_ID'))) throw appError_('TRIAL_NOT_READY', 'La prueba nunca puede apuntar a producción.', 403);
    var folderId = props.getProperty('ORDER_QA_FOLDER_ID');
    if (!folderId) {
      var roots = getDocumentsRoot_().getParents();
      if (!roots.hasNext()) throw appError_('TRIAL_NOT_READY', 'No se pudo identificar la raíz del sistema.', 403);
      var container = roots.next().createFolder('99_ENSAYO_DOCUMENTAL_MADDY');
      folderId = container.getId(); props.setProperty('ORDER_QA_FOLDER_ID', folderId);
    }
    if (!rootId) { rootId = DriveApp.getFolderById(folderId).createFolder('02_DOCUMENTOS_CLIENTES').getId(); props.setProperty('ORDER_QA_ROOT_ID', rootId); }
    if (!id) {
      var book = SpreadsheetApp.create('Maddy · Ensayo documental · ' + Utilities.formatDate(now_(), MADERARTE_APP.TIMEZONE, 'yyyy-MM-dd HH:mm'));
      id = book.getId(); props.setProperty('ORDER_QA_SPREADSHEET_ID', id);
      DriveApp.getFileById(id).moveTo(DriveApp.getFolderById(folderId));
    }
    var ss = SpreadsheetApp.openById(id);
    if (!ss.getName().startsWith('Maddy · Ensayo documental ·')) throw appError_('TRIAL_NOT_READY', 'Base de ensayo incorrecta.', 403);
    ss.setSpreadsheetTimeZone(MADERARTE_APP.TIMEZONE); ss.setSpreadsheetLocale('es_CO');
    Object.keys(REQUIRED_HEADERS).forEach(function(name, index) {
      var sheet = ss.getSheetByName(name);
      if (!sheet && index === 0 && ss.getSheets().length === 1 && ss.getSheets()[0].getLastRow() === 0) { sheet = ss.getSheets()[0]; sheet.setName(name); }
      if (!sheet) sheet = ss.insertSheet(name);
      var expected = REQUIRED_HEADERS[name].concat(ORDER_CREATION_EXTRA_HEADERS_[name] || []);
      var current = getHeaders_(sheet);
      if (current.length && JSON.stringify(current) !== JSON.stringify(expected)) throw appError_('SHEET_SCHEMA_MISMATCH', 'No se sobreescriben encabezados distintos en el ensayo.', 503);
      if (!current.length) {
        if (sheet.getMaxColumns() < expected.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), expected.length - sheet.getMaxColumns());
        sheet.getRange(1, 1, 1, expected.length).setValues([expected]); sheet.setFrozenRows(1);
      }
    });
    var archive = ss.getSheetByName(ORDER_ARCHIVE_SHEET_) || ss.insertSheet(ORDER_ARCHIVE_SHEET_);
    var ah = getHeaders_(archive);
    if (ah.length && JSON.stringify(ah) !== JSON.stringify(ORDER_ARCHIVE_HEADERS_)) throw appError_('SHEET_SCHEMA_MISMATCH', 'Archivo de ensayo incorrecto.', 503);
    if (!ah.length) { archive.getRange(1, 1, 1, ORDER_ARCHIVE_HEADERS_.length).setValues([ORDER_ARCHIVE_HEADERS_]); archive.setFrozenRows(1); }
    var config = ss.getSheetByName('Configuracion');
    if (config.getLastRow() === 1) config.getRange(2, 1, 1, 2).setValues([['MODO_OPERACION', 'ENSAYO']]);
    var branches = ss.getSheetByName('Sedes');
    if (branches.getLastRow() === 1) branches.getRange(2, 1, 2, 14).setValues(['MP', 'TP'].map(function(code) { return [code, 'Sede ' + code + ' · ENSAYO', code + '-QA-OP-', code + '-QA-COT-', code + '-QA-REC-', code + '-QA-REM-', '', '', 'ACTIVA', 1, 1, 1, 1, now_().toISOString()]; }));
    props.setProperty('QA_ORDER_SCHEMA_VERSION', '3');
    props.setProperty('QA_ORDER_SAVE_ENABLED', 'SI');
    props.setProperty('ORDER_QA_ENABLED', 'SI');
    SpreadsheetApp.flush();
    var result = { ok: true, code: ORDER_DOCUMENT_REVISION_, environment: 'ENSAYO', commercialWrites: false,
      form: 'https://app.maderartepopayan.com/pedido.html?ensayo=1', spreadsheet: ss.getUrl(), folder: DriveApp.getFolderById(folderId).getUrl(), note: 'Entorno vacío preparado. Todavía no certifica una orden ni sus documentos.' };
    Logger.log(JSON.stringify(result)); return result;
  } finally { lock.releaseLock(); }
}
