import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const source = readFileSync(resolve('apps-script/Clients.gs'), 'utf8');

const rows = {
  Clientes: [
    { Cedula_NIT: '1001', Tipo_Documento: 'CC', Nombre_Completo: 'Ana Pérez', Telefono: '3001112233', Email: 'ana@example.test', Ciudad: 'Popayán', Sede_Origen: 'MP', Estado: 'ACTIVO' },
    { Cedula_NIT: '2002', Tipo_Documento: 'NIT', Nombre_Completo: 'Empresa Demo', Telefono: '3009990000', Email: 'empresa@example.test', Ciudad: 'Cali', Sede_Origen: 'TP', Estado: 'ACTIVO' }
  ],
  Ordenes_Pedido: [
    { Numero_OP: 'MP-001', Cedula_NIT: '1001', Nombre_Cliente: 'Ana Pérez', Valor_Total: 3000000, Abonado_Total: 1000000, Saldo_Pendiente: 2000000, Estado: 'CONFIRMADA', Fecha: '2026-08-20' },
    { Numero_OP: 'MP-002', Cedula_NIT: '1001', Nombre_Cliente: 'Ana Pérez', Valor_Total: 1500000, Abonado_Total: 1500000, Saldo_Pendiente: 0, Estado: 'COMPLETADA', Fecha: '2026-07-10' },
    { Numero_OP: 'TP-001', Cedula_NIT: '2002', Nombre_Cliente: 'Empresa Demo', Valor_Total: 5000000, Abonado_Total: 0, Saldo_Pendiente: 5000000, Estado: 'ANULADA', Fecha: '2026-08-01' }
  ],
  Cotizaciones: [
    { Numero_Cotizacion: 'COT-001', Cedula_NIT: '1001', Total_Cotizado: 3200000, Estado: 'ENVIADA', Fecha: '2026-08-15' }
  ],
  Abonos: [
    { Numero_Recibo: 'REC-001', Numero_OP: 'MP-001', Cedula_NIT: '1001', Fecha_Pago: '2026-08-21', Valor_Abono: 1000000, Estado_Registro: 'ACTIVO' }
  ]
};

const context = vm.createContext({
  MADERARTE_APP: Object.freeze({ MAX_PAGE_SIZE: 100 }),
  listRows_: name => rows[name] || [],
  findRow_: (sheet, header, expected) => (rows[sheet] || []).find(row => String(row[header] || '') === String(expected || '')) || null,
  normalizeCode_: value => String(value || '').trim().toUpperCase(),
  valueNumber_: value => Number(value) || 0,
  valueDateIso_: value => String(value || ''),
  requirePermission_: (session, permission) => {
    const permissions = session?.permissions || [];
    if (!permissions.includes('*') && !permissions.includes(permission)) throw Object.assign(new Error('Denied'), { appCode: 'PERMISSION_DENIED' });
  },
  appError_: (code, message, status) => Object.assign(new Error(message), { appCode: code, httpStatus: status }),
  normalizeOrder_: row => ({
    number: String(row.Numero_OP || ''),
    date: String(row.Fecha || ''),
    client: String(row.Nombre_Cliente || ''),
    total: Number(row.Valor_Total) || 0,
    paid: Number(row.Abonado_Total) || 0,
    balance: Number(row.Saldo_Pendiente) || 0,
    status: String(row.Estado || '').toUpperCase()
  })
});

vm.runInContext(source, context, { filename: 'Clients.gs' });

const owner = { permissions: ['*'] };
const reader = { permissions: ['clientes.read'] };

{
  const result = context.listClients_({ query: 'ana', limit: 10 }, reader);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].document, '1001');
  assert.equal(result.items[0].orderCount, 2);
  assert.equal(result.items[0].balance, 2000000);
}

{
  const result = context.listClients_({ branch: 'TP', limit: 10 }, reader);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].document, '2002');
  assert.equal(result.items[0].balance, 0, 'Las OP anuladas no deben sumar saldo del cliente');
}

{
  const result = context.getClient_({ document: '1001' }, owner);
  assert.equal(result.client.name, 'Ana Pérez');
  assert.equal(result.orders.length, 2);
  assert.equal(result.quotes.length, 1);
  assert.equal(result.payments.length, 1);
  assert.equal(result.summary.balance, 2000000);
  assert.equal(result.summary.paid, 1000000);
}

{
  assert.equal(context.getClient_({ document: '9999' }, reader), null);
  assert.throws(() => context.listClients_({}, { permissions: [] }), error => error.appCode === 'PERMISSION_DENIED');
  assert.throws(() => context.getClient_({}, reader), error => error.appCode === 'CLIENT_DOCUMENT_REQUIRED');
}

console.log('OK · lectura de Clientes, expediente, saldos y permisos verificados');
