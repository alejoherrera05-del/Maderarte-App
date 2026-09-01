var MADERARTE_APP = Object.freeze({
  VERSION: '0.2.0',
  NAME: 'Maderarte App',
  TIMEZONE: 'America/Bogota',
  SPREADSHEET_NAME: 'Base de Datos Maderarte App',
  SESSION_HOURS: 12,
  PERSISTENT_SESSION_DAYS: 30,
  INVITATION_DAYS: 7,
  MAX_PAGE_SIZE: 100,
  COMMERCIAL_WRITES: false
});

function getScriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function requiredProperty_(name) {
  var value = String(getScriptProperties_().getProperty(name) || '').trim();
  if (!value) throw appError_('CONFIG_MISSING', 'Falta la propiedad privada ' + name + '.', 503);
  return value;
}

function optionalProperty_(name, fallback) {
  var value = String(getScriptProperties_().getProperty(name) || '').trim();
  return value || fallback || '';
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID'));
}

function getDocumentsRoot_() {
  return DriveApp.getFolderById(requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID'));
}

function appError_(code, message, httpStatus, details) {
  var error = new Error(message);
  error.appCode = code;
  error.httpStatus = httpStatus || 400;
  error.details = details || null;
  return error;
}

function success_(code, message, data, requestId, httpStatus) {
  return {
    status: 'success',
    code: code || 'OK',
    msg: message || 'Operación completada.',
    data: data || {},
    requestId: requestId || '',
    httpStatus: httpStatus || 200
  };
}

function failure_(error, requestId) {
  return {
    status: 'error',
    code: error && error.appCode ? error.appCode : 'INTERNAL_ERROR',
    msg: error && error.message ? error.message : 'Ocurrió un error interno.',
    details: error && error.details ? error.details : null,
    requestId: requestId || '',
    httpStatus: error && error.httpStatus ? error.httpStatus : 500
  };
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function now_() {
  return new Date();
}

function iso_(value) {
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCode_(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_\-.*]/g, '');
}

function randomToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function sha256_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8);
  return digest.map(function(byte) { var normalized = byte < 0 ? byte + 256 : byte; return ('0' + normalized.toString(16)).slice(-2); }).join('');
}

function secureEquals_(left, right) {
  var a = String(left || '');
  var b = String(right || '');
  var mismatch = a.length ^ b.length;
  var length = Math.max(a.length, b.length);
  for (var index = 0; index < length; index += 1) mismatch |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  return mismatch === 0;
}

function parseJson_(value, fallback) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch (error) { return fallback; }
}
