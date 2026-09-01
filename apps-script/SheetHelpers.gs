function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw appError_('SHEET_MISSING', 'No existe la pestaña ' + name + '.', 503);
  return sheet;
}

function getHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];
  var headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || '').trim(); });
  var duplicates = duplicateHeaders_(headers);
  if (duplicates.length) {
    throw appError_('SHEET_SCHEMA_DUPLICATE_HEADER', 'La pestaña ' + sheet.getName() + ' contiene encabezados repetidos.', 503, { duplicates: duplicates });
  }
  return headers;
}

function headerMap_(headers) {
  var map = {};
  headers.forEach(function(header, index) { if (header) map[header] = index; });
  return map;
}

function duplicateHeaders_(headers) {
  var seen = {};
  var duplicates = [];
  headers.forEach(function(header) {
    if (!header) return;
    if (seen[header] && duplicates.indexOf(header) === -1) duplicates.push(header);
    seen[header] = true;
  });
  return duplicates;
}

function assertHeaders_(sheetName, requiredHeaders) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var missing = requiredHeaders.filter(function(header) { return headers.indexOf(header) === -1; });
  if (missing.length) throw appError_('SHEET_SCHEMA_MISMATCH', 'La pestaña ' + sheetName + ' no coincide con el contrato.', 503, { missing: missing });
  return headers;
}

function rowToObject_(headers, values, rowNumber) {
  var object = { _row: rowNumber };
  headers.forEach(function(header, index) { if (header) object[header] = values[index]; });
  return object;
}

function listRows_(sheetName) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, headers.length).getValues().map(function(values, index) {
    return rowToObject_(headers, values, index + 2);
  }).filter(function(row) {
    return headers.some(function(header) { return String(row[header] === null || row[header] === undefined ? '' : row[header]).trim() !== ''; });
  });
}

function findRow_(sheetName, header, expected) {
  var normalized = String(expected || '').trim().toLowerCase();
  return listRows_(sheetName).filter(function(row) {
    return String(row[header] || '').trim().toLowerCase() === normalized;
  })[0] || null;
}

function appendObject_(sheetName, object) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var row = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : ''; });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateObject_(sheetName, rowNumber, patch) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var map = headerMap_(headers);
  Object.keys(patch).forEach(function(header) {
    if (map[header] === undefined) throw appError_('SHEET_SCHEMA_MISMATCH', 'Falta la columna ' + header + ' en ' + sheetName + '.', 503);
    sheet.getRange(rowNumber, map[header] + 1).setValue(patch[header]);
  });
}

function countRows_(sheetName) {
  return Math.max(0, getSheet_(sheetName).getLastRow() - 1);
}

function valueNumber_(value) {
  var number = Number(value);
  return isFinite(number) ? number : 0;
}

function valueDateIso_(value) {
  return value instanceof Date ? value.toISOString() : iso_(value);
}
