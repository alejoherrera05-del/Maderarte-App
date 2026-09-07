import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const clone = x => JSON.parse(JSON.stringify(x));
const sources = ['Config', 'SheetHelpers', 'Schema', 'Orders', 'OrderCreation', 'OrderCreationRecovery', 'Router'];
export function baseFixture() {
  const state = { tables: {}, calls: 0, gets: 0, failAt: -1, loseResponse: false, delayedCommit: false, pendingTables: null, locked: false, busy: false, releases: 0, authReads: 0,
    props: { ORDER_SCHEMA_VERSION: '2', ORDER_SAVE_ENABLED: 'SI', SPREADSHEET_ID: 'synthetic-sheet' } };
  const session = { profile: { uid: 'qa-owner', name: 'Operador QA', role: 'PROPIETARIO', branches: ['MP'] }, permissions: ['*'], sessionRow: { Dispositivo_ID: 'test-device' } };
  function getSheet(name) {
    const table = state.tables[name];
    return table && {
      getName: () => name, getSheetId: () => Object.keys(state.tables).indexOf(name) + 1,
      getMaxColumns: () => table.headers.length, getLastColumn: () => table.headers.length, getLastRow: () => table.rows.length + 1,
      getRange: (r, c, nr = 1, nc = 1) => ({
        getDisplayValues: () => [table.headers.slice(c - 1, c - 1 + nc)],
        getValues: () => table.rows.slice(r - 2, r - 2 + nr).map(row => table.headers.slice(c - 1, c - 1 + nc).map(header => row[header] ?? ''))
      })
    };
  }
  const context = vm.createContext({ console, __state: state,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => state.props[key] || '', setProperty: (key, value) => { state.props[key] = value; }, deleteProperty: key => { delete state.props[key]; } }) },
    SpreadsheetApp: { openById: () => { state.gets++; return { getName: () => 'Base de Datos Maderarte App', getSheetByName: getSheet }; }, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => { if(state.busy || state.locked) return false; state.locked = true; return true; }, releaseLock: () => { state.locked = false; state.releases++; } }) },
    ScriptApp: { getOAuthToken: () => 'synthetic-oauth' },
    UrlFetchApp: { fetch: (url, options) => {
      assert.equal(state.locked, true, 'All REST writes hold the script lock');
      assert.equal(options.headers.Authorization, 'Bearer synthetic-oauth');
      assert.match(url, /^https:\/\/sheets.googleapis.com\/v4\/spreadsheets\/synthetic-sheet:batchUpdate$/);
      state.calls++;
      const batch = JSON.parse(options.payload);
      const tables = clone(state.tables);
      batch.requests.forEach((request, index) => {
        if(index === state.failAt) throw new Error('synthetic batch rejection');
        if (request.appendDimension) return;
        const requestBody = request.appendCells || request.updateCells;
        const id = request.appendCells ? requestBody.sheetId : requestBody.start.sheetId;
        const table = tables[Object.keys(tables)[id - 1]];
        const read = cell => {
          const value = cell.userEnteredValue || {};
          assert.equal(value.formulaValue, undefined, 'Never execute user input as a formula');
          return value.stringValue ?? value.numberValue ?? '';
        };
        if(request.appendCells) {
          for(const row of requestBody.rows) table.rows.push(Object.fromEntries(table.headers.map((header, i) => [header, read(row.values[i])])));
        } else {
          if (requestBody.start.rowIndex === 0) {
            requestBody.rows[0].values.forEach((cell, i) => { table.headers[requestBody.start.columnIndex + i] = read(cell); });
            return;
          }
          const rowIndex = requestBody.start.rowIndex - 1;
          const col = requestBody.start.columnIndex;
          requestBody.rows[0].values.forEach((cell, i) => { table.rows[rowIndex][table.headers[col + i]] = read(cell); });
        }
      });
      if (state.delayedCommit) { state.pendingTables=tables; throw new Error('Google still processing after transport timeout'); }
      state.tables = tables;
      if(state.loseResponse) { state.loseResponse = false; throw new Error('response lost AFTER commit'); }
      return { getResponseCode: () => 200 };
    } }
  });
  for(const name of sources) vm.runInContext(readFileSync(`apps-script/${name}.gs`, 'utf8'), context, { filename: `${name}.gs` });
  context.MADERARTE_APP = { ...context.MADERARTE_APP, COMMERCIAL_WRITES: true };
  context.sha256_ = text => createHash('sha256').update(text).digest('hex');
  context.now_ = () => new Date('2026-09-07T17:00:00Z');
  context.validateSessionToken_ = token => { state.authReads++; assert.equal(token, 'qa-session'); return session; };
  for(const [name, headers] of Object.entries(context.REQUIRED_HEADERS)) state.tables[name] = { headers: [...headers, ...(context.ORDER_CREATION_EXTRA_HEADERS_[name] || [])], rows: [] };
  state.tables.Configuracion.rows.push({ Clave: 'MODO_OPERACION', Valor: 'OPERACION' });
  state.tables.Sedes.rows.push({ Sede_ID: 'MP', Estado: 'ACTIVA', Prefijo_OP: 'MP-OP', Prefijo_Recibo: 'MP-RC', Siguiente_OP: 1, Siguiente_Recibo: 1 });
  const request = { requestId: 'QA-ORDER-CREATION-0001', sessionToken: 'qa-session' };
  const item = (id, price, agreement = 'ENTREGA_POSTERIOR', fulfillment = 'PARA_SOLICITAR') => ({
    clientLineId: id, description: `Mueble sintético ${id}`, quantity: 1, unitValue: price,
    fabric: 'Acabado de prueba', specifications: 'Medidas de prueba', agreement, fulfillment
  });
  const payload = { schemaVersion: 1, branch: 'MP', client: { document: '000001', name: 'Cliente sintético', phone: '000002', email: 'N/A', address: 'Dirección de prueba', city: 'Ciudad de prueba' },
    items: [item('1', 2000000, 'ENTREGA_HOY', 'DISPONIBLE'), item('2', 1500000)], discount: 350000, notes: 'Acuerdo público', noPayment: false,
    payments: [{ clientPaymentId: '1', amount: 400000, method: 'TRANSFERENCIA', internalNote: 'NOTA-PRIVADA' }, { clientPaymentId: '2', amount: 100000, method: 'EFECTIVO' }] };
  return { context, state, session, request, payload, create: () => context.createOrder_(payload, request), rows: name => state.tables[name].rows };
}

// Deterministic transport adapter for the actual Apps Script functions. It
// simulates Google HTTP semantics, not the business layer. No Google requests.
export function documentFixture() {
  const f = baseFixture(), { context: c, state: s } = f;
  for (const name of ['DriveFolders', 'OrderDocumentStorage', 'OrderPhotoContract', 'OrderDocumentSetup', 'OrderDocuments']) vm.runInContext(readFileSync(`apps-script/${name}.gs`, 'utf8'), c, { filename: name });
  s.props.ORDER_SCHEMA_VERSION = '3'; s.props.DRIVE_DOCUMENTS_ROOT_ID = 'synthetic-root';
  s.tables.Archivos_Orden = { headers: [...c.ORDER_ARCHIVE_HEADERS_], rows: [] };
  let uid = 0;
  c.Utilities = { getUuid: () => `fixture-${++uid}`, formatDate: (date, zone, format) => format === 'yyyy' ? '2026' : format === 'MM' ? '09' : '2026-09-07', base64Decode: text => [...Buffer.from(text, 'base64')].map(x => x > 127 ? x - 256 : x), base64Encode: bytes => Buffer.from(bytes).toString('base64') };
  s.drive = new Map([['synthetic-root', { id: 'synthetic-root', name: '02_DOCUMENTOS_CLIENTES', mimeType: 'application/vnd.google-apps.folder', parents: ['synthetic-parent'] }]]);
  s.binary = new Map(); s.uploads = new Map(); s.requests = [];
  const hash = data => createHash('sha256').update(data).digest('hex');
  const response = (code, body = {}, headers = {}, binary = null) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body), getAllHeaders: () => headers, getBlob: () => ({ getBytes: () => [...(binary || [])].map(x => x > 127 ? x - 256 : x) }) });
  const sheetsFetch = c.UrlFetchApp.fetch;
  c.UrlFetchApp.fetch = (rawUrl, options = {}) => {
    if (rawUrl.startsWith('https://sheets.googleapis.com/')) return sheetsFetch(rawUrl, options);
    assert.equal(s.locked, true); assert.equal(options.headers.Authorization, 'Bearer synthetic-oauth');
    const url = new URL(rawUrl), method = (options.method || 'get').toLowerCase();
    s.requests.push({ path: url.pathname, method });
    let result;
    if (url.pathname.endsWith('/generateIds')) result = response(200, { ids: Array.from({ length: Number(url.searchParams.get('count')) }, () => 'synthetic-file-' + ++uid) });
    else if (url.pathname === '/drive/v3/files' && method === 'post') {
      const meta = JSON.parse(options.payload);
      if (s.drive.has(meta.id)) return response(409);
      s.drive.set(meta.id, { ...meta, size: '0' }); result = response(200, { id: meta.id });
    } else if (url.pathname.startsWith('/upload/drive/v3/files/')) {
      const id = url.pathname.split('/').pop();
      if (method === 'patch') {
        const upload = 'synthetic-session-' + ++uid;
        s.uploads.set(upload, { id, total: Number(options.headers['X-Upload-Content-Length']), data: Buffer.alloc(0), mime: options.headers['X-Upload-Content-Type'] });
        result = response(200, {}, { Location: `https://www.googleapis.com/upload/drive/v3/files/${id}?upload_id=${upload}` });
      } else {
        const upload = s.uploads.get(url.searchParams.get('upload_id'));
        if (!upload) return response(404);
        const range = options.headers['Content-Range'];
        if (!range.startsWith('bytes */')) {
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
          assert.ok(match); assert.equal(Number(match[1]), upload.data.length);
          upload.data = Buffer.concat([upload.data, Buffer.from(options.payload)]);
          assert.equal(upload.data.length, Number(match[2]) + 1);
        }
        if (upload.data.length === upload.total) {
          s.binary.set(id, upload.data);
          Object.assign(s.drive.get(id), { size: String(upload.total), mimeType: upload.mime, sha256Checksum: hash(upload.data) });
          result = response(200, { id });
        } else result = response(308, {}, upload.data.length ? { Range: 'bytes=0-' + (upload.data.length - 1) } : {});
      }
    } else if (url.pathname.startsWith('/drive/v3/files/')) {
      const id = url.pathname.split('/').pop(), meta = s.drive.get(id);
      if (!meta) return response(404);
      if (url.searchParams.get('alt') === 'media') {
        const match = /bytes=(\d+)-(\d+)/.exec(options.headers.Range);
        result = response(206, {}, {}, s.binary.get(id).subarray(Number(match[1]), Number(match[2]) + 1));
      } else result = response(200, meta);
    } else throw new Error('Unexpected synthetic endpoint: ' + rawUrl);
    if (s.loseDrive && s.loseDrive(url, method, options)) { s.loseDrive = null; throw new Error('Synthetic response lost after Drive commit'); }
    return result;
  };
  f.payload.schemaVersion = 2;
  const photo = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(320000, 17)]);
  f.photo = photo;
  f.payload.items[0].photos = [{ id: 'r1', name: 'Referencia sintética.png', mime: 'image/png', bytes: photo.length, sha256: hash(photo) }];
  f.call = (action, payload = {}) => c.routeAction_(action, payload, { ...f.request, session: f.session });
  return f;
}
