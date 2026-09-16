// Editor/trigger only. Never expose these functions through Router.
var BK_FOLDER_ = 'application/vnd.google-apps.folder';
var BK_SHEET_ = 'application/vnd.google-apps.spreadsheet';
var BK_FIELDS_ = 'id,name,mimeType,parents,trashed,shared,permissions(type,role),md5Checksum,size,version,appProperties';
var BK_CURRENT_ = 'MADDY_BACKUP_CURRENT_V1';
var BK_LAST_ = 'MADDY_BACKUP_VERIFIED_V1';
var BK_RESTORE_ = 'MADDY_BACKUP_RESTORE_V1';

function bkFail_(code) { throw appError_('BACKUP_' + code, 'El respaldo requiere revisión: ' + code + '.', 503); }
function bkApi_(path, method, body) {
  var o = { method: method || 'get' };
  if (body !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  return JSON.parse(mdDrive_(path, o).getContentText());
}
function bkMeta_(id) { return bkApi_('drive/v3/files/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent(BK_FIELDS_)); }
function bkPrivate_(m) {
  if (!m || m.trashed || m.shared !== false || !Array.isArray(m.permissions) || m.permissions.length !== 1 || m.permissions[0].type !== 'user' || m.permissions[0].role !== 'owner') bkFail_('DESTINATION_NOT_PRIVATE');
  return m;
}
function bkList_(parent, token) {
  return bkApi_('drive/v3/files?q=' + encodeURIComponent("'" + parent + "' in parents and trashed=false") + '&pageSize=100&fields=' + encodeURIComponent('nextPageToken,files(' + BK_FIELDS_ + ')') + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
}
function bkFind_(parent, key) {
  var q = "'" + parent + "' in parents and trashed=false and appProperties has { key='maddyBackupKey' and value='" + key + "' }";
  var d = bkApi_('drive/v3/files?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('nextPageToken,files(' + BK_FIELDS_ + ')'));
  if (d.nextPageToken || d.files.length > 1) bkFail_('DUPLICATE_IDENTITY');
  return d.files[0] || null;
}
function bkObject_(parent, key, name, source) {
  bkPrivate_(bkMeta_(parent));
  var found = bkFind_(parent, key);
  if (found) return bkPrivate_(found);
  var body = { name: name, parents: [parent], appProperties: { maddyBackupKey: key } };
  if (!source) body.mimeType = BK_FOLDER_;
  var path = source ? 'drive/v3/files/' + encodeURIComponent(source) + '/copy' : 'drive/v3/files';
  var m = bkApi_(path + '?fields=' + encodeURIComponent(BK_FIELDS_), 'post', body);
  return bkPrivate_(bkMeta_(m.id));
}
function bkRead_(id) { return JSON.parse(mdDrive_('drive/v3/files/' + encodeURIComponent(id) + '?alt=media').getContentText()); }
function bkWrite_(s) {
  var text = JSON.stringify(s);
  if (text.length > 4000000) bkFail_('MANIFEST_LIMIT');
  mdDrive_('upload/drive/v3/files/' + encodeURIComponent(s.manifestId) + '?uploadType=media', { method: 'patch', contentType: 'application/json', payload: text });
  if (JSON.stringify(bkRead_(s.manifestId)) !== text) bkFail_('CHECKPOINT_UNCONFIRMED');
}
function bkPointer_(key, s) {
  var v = JSON.stringify({ manifestId: s.manifestId, folderId: s.folderId, date: s.date, phase: s.phase, digest: sha256_(JSON.stringify(s)) });
  getScriptProperties_().setProperty(key, v);
  if (getScriptProperties_().getProperty(key) !== v) bkFail_('POINTER_UNCONFIRMED');
}
function bkLoad_(key, verified) {
  var p = getScriptProperties_().getProperty(key);
  if (!p) return null;
  p = JSON.parse(p); var s = bkRead_(p.manifestId);
  if (!s || s.format !== 1 || s.manifestId !== p.manifestId || s.folderId !== p.folderId) bkFail_('MANIFEST_INVALID');
  if (verified && (s.phase !== 'VERIFICADO' || sha256_(JSON.stringify(s)) !== p.digest)) bkFail_('VERIFIED_MANIFEST_CHANGED');
  bkPrivate_(bkMeta_(s.folderId)); bkPrivate_(bkMeta_(s.manifestId));
  return s;
}
function bkDestination_() {
  if (typeof osActive_ === 'function' && osActive_()) bkFail_('SANDBOX_CONTEXT');
  var doc = bkMeta_(requiredProperty_('DRIVE_DOCUMENTS_ROOT_ID'));
  if (doc.trashed || doc.name !== '02_DOCUMENTOS_CLIENTES' || doc.mimeType !== BK_FOLDER_ || !doc.parents || doc.parents.length !== 1) bkFail_('DOCUMENT_ROOT');
  var root = bkPrivate_(bkMeta_(doc.parents[0]));
  if (root.name !== 'MADERARTE APP' || root.mimeType !== BK_FOLDER_) bkFail_('APP_ROOT');
  var sheet = bkMeta_(requiredProperty_('SPREADSHEET_ID'));
  if (sheet.trashed || sheet.name !== MADERARTE_APP.SPREADSHEET_NAME || sheet.mimeType !== BK_SHEET_ || !sheet.parents || sheet.parents.length !== 1) bkFail_('DATABASE');
  var system = bkMeta_(sheet.parents[0]);
  if (system.name !== '00_SISTEMA' || system.parents.length !== 1 || system.parents[0] !== root.id) bkFail_('DATABASE_SCOPE');
  var all = [], token;
  do { var d = bkList_(root.id, token); all = all.concat(d.files); token = d.nextPageToken; } while (token);
  var dirs = all.filter(function(f) { return f.name === '04_BACKUPS' && f.mimeType === BK_FOLDER_; });
  if (dirs.length !== 1) bkFail_('BACKUP_ROOT');
  return { base: bkPrivate_(dirs[0]).id, documents: doc.id, spreadsheet: sheet.id };
}
function bkSheetDigest_(id) {
  var m = bkApi_('sheets/v4/spreadsheets/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent('properties(locale,timeZone),sheets(properties,merges)'));
  var props = m.sheets.map(function(s) { return { properties: s.properties, merges: s.merges || [] }; });
  var ranges = m.sheets.map(function(s) { return 'ranges=' + encodeURIComponent("'" + s.properties.title.replace(/'/g, "''") + "'"); }).join('&');
  var data = bkApi_('sheets/v4/spreadsheets/' + encodeURIComponent(id) + '/values:batchGet?valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER&' + ranges);
  if (!data.valueRanges || data.valueRanges.length !== props.length) bkFail_('SHEET_READ_INCOMPLETE');
  return { count: props.length, hash: sha256_(JSON.stringify([m.properties, props, data.valueRanges.map(function(r) { return r.values || []; })])) };
}
function bkManifest_(base, key, name) {
  var folder = bkObject_(base, key, name), found = bkFind_(folder.id, key + '-manifest');
  if (found) return bkRead_(found.id);
  var m = bkApi_('drive/v3/files?fields=id', 'post', { name: 'inventario.json', mimeType: 'application/json', parents: [folder.id], appProperties: { maddyBackupKey: key + '-manifest' } });
  var s = { format: 1, key: key, folderId: folder.id, manifestId: m.id, phase: 'INICIO', startedAt: new Date().toISOString(), entries: [] };
  bkWrite_(s); return s;
}
function bkBinary_(m) {
  if (m.trashed || !m.md5Checksum || !Number.isFinite(Number(m.size))) bkFail_('UNSUPPORTED_DOCUMENT');
  return { md5: m.md5Checksum, size: String(m.size), mime: m.mimeType };
}
function bkSameBinary_(a, b) { return a.md5 === b.md5 && a.size === b.size && a.mime === b.mime; }
function bkSpace_(bytes) {
  var q = bkApi_('drive/v3/about?fields=storageQuota').storageQuota;
  if (!q || q.usage === undefined) bkFail_('QUOTA_UNKNOWN');
  if (q.limit && Number(q.limit) - Number(q.usage) < Number(bytes || 0) + 100000000) bkFail_('LOW_STORAGE');
}
function bkCapture_(s, source) {
  if (typeof readOrderFence_ === 'function' && readOrderFence_()) bkFail_('TRANSACTION_PENDING');
  ['Archivos_Orden', 'Archivos_Cotizacion'].forEach(function(name) {
    if (listRows_(name).some(function(r) { return r.Estado !== 'LISTO'; })) bkFail_('DOCUMENT_PENDING');
  });
  s.sheetDigest = bkSheetDigest_(source.spreadsheet); s.sourceSheet = source.spreadsheet; s.documentRoot = source.documents;
  s.phase = 'COPIANDO_BASE'; bkWrite_(s);
  bkSpace_(0);
  var copy = bkObject_(s.folderId, s.key + '-sheet', 'Base Maddy — ' + s.date, source.spreadsheet);
  if (copy.id === source.spreadsheet || bkSheetDigest_(copy.id).hash !== s.sheetDigest.hash || bkSheetDigest_(source.spreadsheet).hash !== s.sheetDigest.hash) bkFail_('SHEET_CHANGED');
  s.sheetId = copy.id; s.queue = [{ id: source.documents, path: [], token: '' }]; s.phase = 'DOCUMENTOS'; bkWrite_(s);
}
function bkDocuments_(s, deadline) {
  while (s.queue.length && Date.now() < deadline) {
    var q = s.queue[0], d = bkList_(q.id, q.token);
    for (var i = 0; i < d.files.length; i++) {
      var f = d.files[i];
      if (s.entries.some(function(e) { return e.sourceId === f.id; })) continue;
      if (s.entries.length >= 20000) bkFail_('INVENTORY_LIMIT');
      var e = { sourceId: f.id, name: f.name, path: q.path.concat(f.name), parentSource: q.id, mime: f.mimeType };
      if (f.mimeType === BK_FOLDER_) {
        s.queue.push({ id: f.id, path: e.path, token: '' });
      } else {
        var expected = bkBinary_(f); bkSpace_(expected.size);
        var pool = bkObject_(s.base, 'maddy-document-versions-v1', 'VERSIONES_DOCUMENTOS');
        var fileKey = sha256_(f.id + ':' + expected.md5 + ':' + expected.size);
        var stored = bkObject_(pool.id, fileKey, fileKey + '-' + f.name.slice(-80), f.id);
        if (!bkSameBinary_(expected, bkBinary_(stored))) bkFail_('DOCUMENT_MISMATCH');
        e.copyId = stored.id; e.fingerprint = expected;
      }
      s.entries.push(e); bkWrite_(s);
      if (Date.now() >= deadline) return;
    }
    if (d.nextPageToken) q.token = d.nextPageToken; else s.queue.shift();
    bkWrite_(s);
  }
  if (!s.queue.length) { s.phase = 'VERIFICANDO'; s.verifyIndex = 0; bkWrite_(s); }
}
function bkReferences_(s) {
  // Assert every recorded Drive identity in the snapshot is covered by the inventory.
  var m = bkApi_('sheets/v4/spreadsheets/' + encodeURIComponent(s.sheetId) + '?fields=sheets(properties(title))');
  var ranges = m.sheets.map(function(x) { return 'ranges=' + encodeURIComponent("'" + x.properties.title.replace(/'/g, "''") + "'"); }).join('&');
  var d = bkApi_('sheets/v4/spreadsheets/' + encodeURIComponent(s.sheetId) + '/values:batchGet?valueRenderOption=FORMULA&' + ranges);
  var known = {}; known[s.documentRoot] = true; s.entries.forEach(function(e) { known[e.sourceId] = true; });
  d.valueRanges.forEach(function(r, n) {
    var title = m.sheets[n].properties.title;
    if (['Configuracion', 'Auditoria', 'Idempotencia', 'Sesiones', 'Invitaciones'].indexOf(title) !== -1) return;
    var rows = r.values || [], headers = rows[0] || [];
    rows.slice(1).forEach(function(row) { row.forEach(function(v, i) {
      var h = headers[i] || '', ids = [];
      if (/^(File_ID|Parent_ID|Carpeta_ID|Archivo_Drive_ID)$/.test(h) && v) ids.push(String(v));
      if (/URL|Enlace|Link/i.test(h)) {
        var re = /https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|drive\/folders\/|document\/d\/|spreadsheets\/d\/|open\?id=)([A-Za-z0-9_-]+)/g, match;
        while ((match = re.exec(String(v)))) ids.push(match[1]);
      }
      if (ids.some(function(id) { return !known[id]; })) bkFail_('REFERENCE_NOT_BACKED_UP');
    }); });
  });
}
function bkVerify_(s, deadline) {
  while (s.verifyIndex < s.entries.length && Date.now() < deadline) {
    var e = s.entries[s.verifyIndex];
    if (e.copyId && !bkSameBinary_(e.fingerprint, bkBinary_(bkPrivate_(bkMeta_(e.copyId))))) bkFail_('STORED_DOCUMENT_CHANGED');
    s.verifyIndex++; bkWrite_(s);
  }
  if (s.verifyIndex === s.entries.length) {
    if (bkSheetDigest_(s.sheetId).hash !== s.sheetDigest.hash) bkFail_('STORED_SHEET_CHANGED');
    bkReferences_(s); s.phase = 'VERIFICADO'; s.completedAt = new Date().toISOString(); bkWrite_(s); bkPointer_(BK_LAST_, s);
  }
}
function bkSummary_(s) { return { stage: s.phase, date: s.date, sheets: s.sheetDigest ? s.sheetDigest.count : 0, documents: s.entries.filter(function(e) { return !!e.copyId; }).length, completedAt: s.completedAt || null }; }
function respaldarMaddy(event) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) bkFail_('BUSY');
  var s;
  try {
    var dest = bkDestination_(), date = Utilities.formatDate(new Date(), MADERARTE_APP.TIMEZONE, 'yyyy-MM-dd');
    s = bkLoad_(BK_CURRENT_, false);
    if (s && s.phase === 'VERIFICADO' && s.date === date) { bkPointer_(BK_LAST_, s); Logger.log(JSON.stringify(bkSummary_(s))); return bkSummary_(s); }
    if (!s || s.phase === 'VERIFICADO' || s.phase === 'FALLIDO') {
      if (event && Number(Utilities.formatDate(new Date(), MADERARTE_APP.TIMEZONE, 'H')) < 2) return { stage: 'ESPERANDO_HORA' };
      if (s && s.phase === 'FALLIDO' && s.date === date) bkFail_('REVIEW_FAILED_COPY');
      s = bkManifest_(dest.base, 'backup-' + date, 'RESPALDO_' + date); s.date = date; s.base = dest.base; bkWrite_(s); bkPointer_(BK_CURRENT_, s);
    }
    if (s.base !== dest.base || s.sourceSheet && s.sourceSheet !== dest.spreadsheet || s.documentRoot && s.documentRoot !== dest.documents) bkFail_('SOURCE_CHANGED');
    var deadline = Date.now() + 80000;
    if (s.phase === 'INICIO') bkCapture_(s, dest);
    else if (s.phase === 'COPIANDO_BASE') bkFail_('INTERRUPTED_SHEET_COPY');
    if (s.phase === 'DOCUMENTOS') bkDocuments_(s, deadline);
    if (s.phase === 'VERIFICANDO') bkVerify_(s, deadline);
    bkPointer_(BK_CURRENT_, s); Logger.log(JSON.stringify(bkSummary_(s))); return bkSummary_(s);
  } catch (e) {
    // Keep failed manifests and the last verified snapshot. No deletes or source writes.
    if (s) { s.lastError = e.appCode || 'BACKUP_ERROR'; try { bkWrite_(s); } catch (ignored) {} }
    throw e;
  } finally { lock.releaseLock(); }
}
function ensayarRecuperacionMaddy() {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) bkFail_('BUSY');
  try {
    var dest = bkDestination_(), source = bkLoad_(BK_LAST_, true); if (!source) bkFail_('NO_VERIFIED_COPY');
    if (source.base !== dest.base) bkFail_('DESTINATION_CHANGED');
    var s = bkLoad_(BK_RESTORE_, false);
    if (!s || s.backupManifest !== source.manifestId) {
      s = bkManifest_(dest.base, 'restore-' + source.key, 'ENSAYO_RECUPERACION_' + source.date);
      s.date = source.date; s.backupManifest = source.manifestId; s.sheetDigest = source.sheetDigest; s.index = 0; s.map = {}; s.phase = 'RESTAURANDO';
      var sheet = bkObject_(s.folderId, s.key + '-sheet', 'ENSAYO — NO OPERATIVA — ' + source.date, source.sheetId);
      if (sheet.id === source.sheetId || bkSheetDigest_(sheet.id).hash !== source.sheetDigest.hash) bkFail_('RESTORE_SHEET_MISMATCH');
      s.sheetId = sheet.id;
      s.map[source.documentRoot] = bkObject_(s.folderId, s.key + '-documents', '02_DOCUMENTOS_CLIENTES').id;
      bkWrite_(s); bkPointer_(BK_RESTORE_, s);
    }
    var deadline = Date.now() + 80000;
    while (s.index < source.entries.length && Date.now() < deadline) {
      var e = source.entries[s.index], parent = s.map[e.parentSource]; if (!parent) bkFail_('RESTORE_PARENT');
      var c = bkObject_(parent, sha256_(s.key + ':' + e.sourceId), e.name, e.copyId);
      if (e.copyId && !bkSameBinary_(e.fingerprint, bkBinary_(c))) bkFail_('RESTORE_DOCUMENT_MISMATCH');
      s.map[e.sourceId] = c.id; s.entries.push({ sourceId: e.sourceId, restoredId: c.id, path: e.path, copyId: e.copyId || null });
      s.index++; bkWrite_(s);
    }
    if (s.index === source.entries.length) {
      if (bkSheetDigest_(s.sheetId).hash !== s.sheetDigest.hash) bkFail_('RESTORE_SHEET_MISMATCH');
      s.phase = 'VERIFICADO'; s.completedAt = new Date().toISOString(); bkWrite_(s);
    }
    bkPointer_(BK_RESTORE_, s); Logger.log(JSON.stringify(bkSummary_(s))); return bkSummary_(s);
  } finally { lock.releaseLock(); }
}
function diagnosticarRespaldosMaddy() {
  bkDestination_(); var s = bkLoad_(BK_LAST_, true), pending = bkLoad_(BK_CURRENT_, false), r = bkLoad_(BK_RESTORE_, false);
  var result = { lastVerified: s ? bkSummary_(s) : null, current: pending ? bkSummary_(pending) : null, recovery: r ? bkSummary_(r) : null };
  Logger.log(JSON.stringify(result)); return result;
}
