import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
function fixture(){const f=sandboxRuntime();f.start();const order=f.run('ORDEN_CREAR',f.command).order;const account=f.run('RECIBO_CUENTA',{number:order.number});return {...f,order,command:{number:order.number,fingerprint:account.position.fingerprint,amount:100000,method:'EFECTIVO',concept:'Abono QA',reference:'REF QA',internalNote:'PRIVADO NO PDF'}};}
{
 const f=fixture(),before=JSON.stringify(f.production());
 assert.equal(f.rows('Abonos').length,2);
 const saved=f.run('RECIBO_CREAR',f.command,'RECEIPT-CREATE-TEST-01').receipt;
 assert.equal(saved.balance,2500000);assert.equal(f.rows('Abonos').length,3);
 assert.equal(f.rows('Ordenes_Pedido')[0].Abonado_Total,800000);
 assert.equal(f.run('RECIBO_CREAR',f.command,'RECEIPT-CREATE-TEST-01').receipt.number,saved.number);
 assert.equal(f.rows('Abonos').length,3);assert.equal(f.rows('Ordenes_Pedido').length,1);
 const plan=f.run('INTERNO_RECIBO_DOCUMENTO_PREPARAR',{number:saved.number});
 assert.equal(plan.document.amount,100000);assert.equal(plan.document.documentKind,'receipt');
 assert.ok(!JSON.stringify(plan).includes('PRIVADO'));assert.ok(!JSON.stringify(plan).includes('Nota_Interna'));
 f.run('INTERNO_RECIBO_DOCUMENTO_CONFIRMAR',{number:saved.number,id:plan.id,planHash:plan.planHash,base64:Buffer.from('%PDF-1.4\nreceipt\n%%EOF').toString('base64')});
 assert.equal(f.run('RECIBO_OBTENER',{number:saved.number}).complete,true);
 assert.equal(f.run('INTERNO_RECIBO_DOCUMENTO_PREPARAR',{number:saved.number}).complete,true);
 assert.ok(f.run('RECIBO_PDF_LEER',{number:saved.number}).base64);
 const initial=f.rows('Abonos')[0].Numero_Recibo;
 const originalPlan=f.run('INTERNO_RECIBO_DOCUMENTO_PREPARAR',{number:initial});
 assert.equal(originalPlan.document.amount,500000);assert.equal(originalPlan.document.balance,2800000);
 assert.equal(f.rows('Abonos').length,3,'initial receipt PDF never charges again');
 assert.equal(f.run('ORDEN_DOCUMENTOS_ESTADO',{number:f.order.number}).files.filter(x=>x.type==='RECIBO').length,0,'receipt slots do not change order completion');
 assert.equal(JSON.stringify(f.production()),before);
 assert.equal(f.rows('Produccion').length,0);assert.equal(f.rows('Remisiones').length,0);
}
for(const [mutate,code] of [[p=>p.amount=0,'ORDER_INPUT_INVALID'],[p=>p.amount=3000000,'RECEIPT_EXCEEDS_BALANCE'],[p=>p.fingerprint='0'.repeat(64),'RECEIPT_BALANCE_CHANGED']]){
 const f=fixture();mutate(f.command);assert.throws(()=>f.run('RECIBO_CREAR',f.command,'RECEIPT-REJECT-TEST-01'),e=>e.appCode===code);assert.equal(f.rows('Abonos').length,2);
}
{
 const f=fixture();f.state.loseBatch=true;
 assert.throws(()=>f.run('RECIBO_CREAR',f.command,'RECEIPT-LOST-TEST-01'),e=>e.appCode==='RECEIPT_SAVE_UNCERTAIN');
 const found=f.run('RECIBO_CREACION_ESTADO',{requestId:'RECEIPT-LOST-TEST-01'});assert.equal(found.saved,true);
 assert.equal(f.run('RECIBO_CREAR',f.command,'RECEIPT-LOST-TEST-01').receipt.number,found.receipt.number);assert.equal(f.rows('Abonos').length,3);
 assert.throws(()=>f.run('RECIBO_CREAR',f.command,'RECEIPT-OTHER-TEST-01'),e=>e.appCode==='RECEIPT_BALANCE_CHANGED');
}
{
 const f=fixture();f.state.delayBatch=true;
 assert.throws(()=>f.run('RECIBO_CREAR',f.command,'RECEIPT-DELAY-TEST-01'),e=>e.appCode==='RECEIPT_SAVE_UNCERTAIN');
 assert.equal(f.run('RECIBO_CREACION_ESTADO',{requestId:'RECEIPT-DELAY-TEST-01'}).retrySameRequest,false);
 assert.throws(()=>f.run('RECIBO_CREAR',f.command,'RECEIPT-DELAY-TEST-02'),e=>e.appCode==='ORDER_RECOVERY_REQUIRED');assert.equal(f.rows('Abonos').length,2);
}
console.log('OK · recibos: saldo conciliado, pago inicial único, PDF privado, vínculo OP, numeración y recuperación.');
{
 const f=fixture();
 assert.throws(()=>f.c.rcOrder_(f.order.number,{permissions:['ordenes.read'],profile:{branches:['TP']}}),e=>e.appCode==='BRANCH_NOT_ALLOWED');
 assert.throws(()=>f.c.rcCreate_(f.command,f.ctx),e=>e.appCode==='COMMERCIAL_WRITES_DISABLED');
 const validate=f.c.validateSessionToken_;
 f.c.validateSessionToken_=()=>({permissions:['ordenes.read','abonos.read'],profile:{uid:'reader',branches:['MP']}});
 assert.throws(()=>f.c.rcSession_(f.ctx,true),e=>e.appCode==='PERMISSION_DENIED');
 f.c.validateSessionToken_=validate;
 f.rows('Ordenes_Pedido')[0].Saldo_Pendiente=1;
 assert.throws(()=>f.run('RECIBO_CUENTA',{number:f.order.number}),e=>e.appCode==='RECEIPT_BALANCE_INTEGRITY');
}
