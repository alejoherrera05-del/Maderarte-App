import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const clientsSource = readFileSync(resolve('apps-script/Clients.gs'), 'utf8');

const rows = {
  Clientes: [
    {
      Cedula_NIT: '1001', Tipo_Documento: 'CC', Nombre_Completo: 'María López', Telefono: '3001112233',
      Telefono_Alterno: '', Email: 'MARIA@EXAMPLE.COM', Direccion: 'Calle 1', Ciudad: 'Popayán',
      Sede_Origen: 'MP', Notas: '', Fecha_Registro: '2026-09-01', Ultima_Compra: '2026-09-01', Estado: 'ACTIVO'
    },
    {
      Cedula_NIT: '1002', Tipo_Documento: 'CC', Nombre_Completo: 'Carlos Pérez', Telefono: '3009998877',
      Telefono_Alterno: '', Email: '', Direccion: '', Ciudad: 'Popayán', Sede_Origen: 'TP', Notas: '',
      Fecha_Registro: '2026-09-01', Ultima_Compra: '', Estado: 'ACTIVO'
    }
  ],
  Ordenes_Pedido: [
    { Cedula_NIT: '1001', Numero_OP: 'MP-0001', Fecha: '2026-09-02', Valor_Total: 4800000, Saldo_Pendiente: 1200000, Estado: 'CONFIRMADA' }
  ],
  Cotizaciones: [],
  Abonos: []
};

const context = vm.createContext({
  MADERARTE_APP: Object.freeze({ MAX_PAGE_SIZE: 200 }),
  listRows_: name => rows[name] || [],
  findRow_: (sheetName, header, expected) => (rows[sheetName] || []).find(row => String(row[header] || '') === String(expected || '')) || null,
  normalizeCode_: value => String(value || '').trim().toUpperCase(),
  normalizeEmail_: value => String(value || '').trim().toLowerCase(),
  valueDateIso_: value => String(value || ''),
  valueNumber_: value => Number(value || 0),
  normalizeOrder_: row => ({
    number: String(row.Numero_OP || ''),
    date: String(row.Fecha || ''),
    total: Number(row.Valor_Total || 0),
    balance: Number(row.Saldo_Pendiente || 0),
    status: String(row.Estado || '')
  }),
  requirePermission_: (session, permission) => {
    if (!(session.permissions || []).includes(permission) && !(session.permissions || []).includes('*')) {
      throw Object.assign(new Error('Sin permiso'), { appCode: 'PERMISSION_DENIED' });
    }
  },
  appError_: (code, message, httpStatus) => Object.assign(new Error(message), { appCode: code, httpStatus })
});

vm.runInContext(clientsSource, context, { filename: 'Clients.gs' });

const session = { permissions: ['clientes.read'] };

{
  const result = context.listClients_({ query: 'maria', limit: 100 }, session);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].document, '1001');
  assert.equal(result.items[0].email, 'maria@example.com');
  assert.equal(result.items[0].orderCount, 1);
  assert.equal(result.items[0].totalSold, 4800000);
  assert.equal(result.items[0].balance, 1200000);
}

{
  const result = context.listClients_({ branch: 'TP', limit: 100 }, session);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, 'Carlos Pérez');
}

{
  const result = context.getClient_({ document: '1001' }, session);
  assert.equal(result.client.name, 'María López');
  assert.equal(result.summary.orderCount, 1);
  assert.equal(result.summary.totalSold, 4800000);
  assert.equal(result.summary.balance, 1200000);
  assert.equal(result.orders[0].number, 'MP-0001');
}

{
  assert.equal(context.getClient_({ document: '9999' }, session), null);
}

{
  assert.throws(() => context.listClients_({}, { permissions: [] }), error => error.appCode === 'PERMISSION_DENIED');
}

console.log('OK · listado y ficha de clientes en lectura verificados');
console.log('OK · filtros, consolidado comercial y permisos de clientes verificados');
