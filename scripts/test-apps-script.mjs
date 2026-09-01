import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const schemaSource = readFileSync(resolve('apps-script/Schema.gs'), 'utf8');

function createDiagnosticContext() {
  const state = {
    spreadsheetName: 'Base de Datos Maderarte App',
    documentsRootName: '02_DOCUMENTOS_CLIENTES',
    headers: {},
    counts: {},
    rows: {
      Configuracion: [{ Clave: 'MODO_OPERACION', Valor: 'PREPARACION' }],
      Roles: [
        { Rol: 'PROPIETARIO', Permisos_JSON: '["*"]', Activo: 'SI', Protegido: 'SI' },
        { Rol: 'ADMINISTRADOR', Permisos_JSON: '["app.access"]', Activo: 'SI', Protegido: 'NO' },
        { Rol: 'VENDEDOR', Permisos_JSON: '["app.access"]', Activo: 'SI', Protegido: 'NO' },
        { Rol: 'BODEGA_LOGISTICA', Permisos_JSON: '["app.access"]', Activo: 'SI', Protegido: 'NO' },
        { Rol: 'CONSULTA', Permisos_JSON: '["app.access"]', Activo: 'SI', Protegido: 'NO' }
      ],
      Sedes: [
        { Sede_ID: 'MP', Nombre: 'Maderarte Principal', Estado: 'ACTIVA' },
        { Sede_ID: 'TP', Nombre: 'Maderarte Terraplaza', Estado: 'ACTIVA' }
      ],
      Usuarios: [{ UID_Firebase: 'firebase-owner', Email: 'owner@example.com', Rol: 'PROPIETARIO', Estado: 'ACTIVO' }]
    }
  };

  const context = vm.createContext({
    MADERARTE_APP: Object.freeze({
      VERSION: '0.2.0',
      SPREADSHEET_NAME: 'Base de Datos Maderarte App',
      COMMERCIAL_WRITES: false
    }),
    Logger: { log() {} },
    __state: state,
    getSpreadsheet_: () => ({ getName: () => state.spreadsheetName }),
    getDocumentsRoot_: () => ({ getName: () => state.documentsRootName }),
    getSheet_: name => ({ getName: () => name, name }),
    getHeaders_: sheet => state.headers[sheet.name] || [],
    listRows_: name => state.rows[name] || [],
    countRows_: name => state.counts[name] || 0,
    findRow_: (sheetName, header, expected) => (state.rows[sheetName] || []).find(row => String(row[header] || '').trim().toLowerCase() === String(expected || '').trim().toLowerCase()) || null,
    normalizeCode_: value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_\-.*]/g, ''),
    normalizeEmail_: value => String(value || '').trim().toLowerCase(),
    parseJson_: (value, fallback) => {
      try { return JSON.parse(String(value || '')); } catch { return fallback; }
    },
    appError_: (code, message, httpStatus, details) => Object.assign(new Error(message), { appCode: code, httpStatus, details })
  });

  vm.runInContext(schemaSource, context, { filename: 'Schema.gs' });
  for (const [name, headers] of Object.entries(context.REQUIRED_HEADERS)) {
    state.headers[name] = Array.from(headers);
    state.counts[name] = 0;
  }
  return { context, state };
}

{
  const { context } = createDiagnosticContext();
  const result = context.verificarBaseCero();
  assert.equal(result.ok, true);
  assert.equal(result.sheetsVerified, 23);
  assert.equal(result.commercialWrites, false);
  assert.equal(result.mode, 'PREPARACION');
  assert.deepEqual(Array.from(result.branches), ['MP', 'TP']);
  assert.ok(Object.values(result.commercialCounts).every(count => count === 0));
}

{
  const { context, state } = createDiagnosticContext();
  state.counts.Clientes = 1;
  assert.throws(() => context.verificarBaseCero(), error => error.appCode === 'COMMERCIAL_BASE_NOT_ZERO');
}

{
  const { context, state } = createDiagnosticContext();
  state.spreadsheetName = 'Otra base';
  assert.throws(() => context.verificarBaseCero(), error => error.appCode === 'SPREADSHEET_NAME_MISMATCH');
}

{
  const { context, state } = createDiagnosticContext();
  state.documentsRootName = 'MADERARTE APP';
  assert.throws(() => context.verificarBaseCero(), error => error.appCode === 'DRIVE_ROOT_MISMATCH');
}

{
  const { context, state } = createDiagnosticContext();
  state.rows.Usuarios[0].UID_Firebase = '';
  assert.throws(() => context.verificarBaseCero(), error => error.appCode === 'OWNER_NOT_READY');
}

{
  const { context, state } = createDiagnosticContext();
  state.headers.Ordenes_Pedido = state.headers.Ordenes_Pedido.slice(0, -1);
  assert.throws(() => context.verificarBaseCero(), error => error.appCode === 'SHEET_SCHEMA_MISMATCH');
}

console.log('OK · diagnóstico base cero de Apps Script verificado');
