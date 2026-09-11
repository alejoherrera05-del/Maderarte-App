import assert from 'node:assert/strict';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
import { pdfOptions } from '../functions/api/order-documents.js';
function fixture(){const f=sandboxRuntime();f.start();f.command.items[0].quantity=4;f.command.items[0].photos=[];const order=f.run('ORDEN_CREAR',f.command).order;const account=f.run('REMISION_CUENTA',{number:order.number});return {...f,order,command:{number:order.number,fingerprint:account.position.fingerprint,items:[{itemId:order.number+'-I-1',quantity:2}],transporter:{name:'Piallero de prueba',mode:'PIALLERO',favorite:true},assistant:{name:'Operario de prueba',favorite:false},physicalCheck:true,notes:'SIN ENTREGA REAL'}};}
const reject=(f,code,id='REMISSION-REJECT-01')=>assert.throws(()=>f.run('REMISION_CREAR',f.command,id),e=>e.appCode===code);
{
 const f=fixture(),branch=f.rows('Sedes').find(r=>r.Sede_ID==='MP');
 branch.Prefijo_Remision += '-';
 const result=f.run('REMISION_CREAR',f.command,'REMISSION-PREFIX-01').remission;
 assert.equal(result.number,branch.Prefijo_Remision+'0001','installed trailing hyphen is normalized without changing the stored prefix');
 assert.equal(result.number.includes('--'),false);
}
{
 const f=fixture(),prod=JSON.stringify(f.production()),op=f.rows('Ordenes_Pedido')[0],money=JSON.stringify([op.Valor_Total,op.Abonado_Total,op.Saldo_Pendiente,f.rows('Abonos')]),original=f.rows('Archivos_Orden').find(x=>x.Tipo==='OP').Plan_JSON;
 const saved=f.run('REMISION_CREAR',f.command,'REMISSION-CREATE-01').remission;
 assert.equal(saved.quantity,2);assert.equal(f.rows('Remisiones').length,1);assert.equal(f.rows('Orden_Items')[0].Cantidad_Pendiente,2);
 assert.equal(f.run('REMISION_CREAR',f.command,'REMISSION-CREATE-01').remission.number,saved.number);
 assert.equal(f.run('REMISION_CREACION_ESTADO',{requestId:'REMISSION-CREATE-01'}).remission.number,saved.number);
 const first=f.run('INTERNO_REMISION_DOCUMENTO_PREPARAR',{number:saved.number});assert.equal(first.document.items[0].pendingAfter,2);assert.equal(first.document.transporter.name,'Piallero de prueba');assert.equal(first.document.assistant,'Operario de prueba');assert.ok(first.document.dispatcher);assert.equal(f.rows('Remisiones')[0].Persona_Recibe,'');
 let account=f.run('REMISION_CUENTA',{number:f.order.number});assert.equal(account.people.transporters.length,1);assert.equal(account.people.transporters[0].favorite,true);assert.equal(account.people.assistants.length,1);assert.equal(account.position.history.length,1);
 reject(f,'DELIVERY_CHANGED','REMISSION-STALE-01');
 f.command.transporter.name='Otro';reject(f,'REQUEST_CONTENT_CHANGED','REMISSION-CREATE-01');f.command.transporter.name='  piallero   de prueba ';
 f.command.items[0].quantity=1;f.command.fingerprint=account.position.fingerprint;f.command.transporter.mode='PROPIETARIO';f.command.assistant={name:'',favorite:false};
 f.run('REMISION_CREAR',f.command,'REMISSION-CREATE-02');account=f.run('REMISION_CUENTA',{number:f.order.number});assert.equal(account.people.transporters.length,1,'same normalized name is reused');assert.equal(account.people.transporters[0].mode,'PROPIETARIO');assert.equal(account.position.items[0].pending,1);
 f.command.fingerprint=account.position.fingerprint;f.run('REMISION_CREAR',f.command,'REMISSION-CREATE-03');assert.equal(f.rows('Orden_Items')[0].Estado_Item,'ENTREGADO');assert.equal(f.rows('Orden_Items')[0].Cantidad_Entregada,4);assert.equal(f.rows('Orden_Items')[0].Cantidad_Pendiente,0);
 assert.equal(JSON.stringify(f.run('INTERNO_REMISION_DOCUMENTO_PREPARAR',{number:saved.number}).document),JSON.stringify(first.document),'first PDF remains immutable');
 assert.equal(f.run('REMISION_OBTENER',{number:saved.number}).complete,false,'pending PDF does not block a different actual dispatch');
 assert.throws(()=>f.run('INTERNO_REMISION_DOCUMENTO_CONFIRMAR',{number:saved.number,id:first.id,planHash:'0'.repeat(64),base64:'JVBERi0='}),e=>e.appCode==='DOCUMENT_REVISION_CHANGED');
 f.run('INTERNO_REMISION_DOCUMENTO_CONFIRMAR',{number:saved.number,id:first.id,planHash:first.planHash,base64:Buffer.from('%PDF-1.4\nsynthetic dispatch transport\n%%EOF').toString('base64')});
 assert.equal(f.run('REMISION_OBTENER',{number:saved.number}).complete,true);assert.ok(f.run('REMISION_PDF_LEER',{number:saved.number}).base64);
 assert.equal(f.run('ORDEN_DOCUMENTOS_ESTADO',{number:f.order.number}).files.some(x=>x.type==='REMISION'),false);
 const after=f.rows('Ordenes_Pedido')[0];assert.equal(JSON.stringify([after.Valor_Total,after.Abonado_Total,after.Saldo_Pendiente,f.rows('Abonos')]),money);assert.equal(f.rows('Archivos_Orden').find(x=>x.Tipo==='OP').Plan_JSON,original);assert.equal(JSON.stringify(f.production()),prod);assert.equal(f.rows('Produccion').length,0);
 assert.deepEqual(pdfOptions(first.document).pdfOptions.width,'8.5in');assert.equal(pdfOptions(first.document).pdfOptions.height,'5.5in');
}
for(const [mutate,code] of [
 [p=>p.items=[],'ORDER_INPUT_INVALID'],[p=>p.items[0].quantity=0,'ORDER_INPUT_INVALID'],[p=>p.items[0].quantity=1.5,'ORDER_INPUT_INVALID'],[p=>p.items[0].quantity=5,'DELIVERY_EXCEEDS_PENDING'],[p=>p.items.push({...p.items[0]}),'ORDER_INPUT_INVALID'],[p=>p.items[0].itemId='MP-OP-OTHER-I-1','DELIVERY_EXCEEDS_PENDING'],[p=>p.items[0].itemId=p.number+'-I-2','DELIVERY_EXCEEDS_PENDING'],[p=>{p.items[0].itemId=p.number+'-I-2';p.items[0].quantity=1;},'DELIVERY_NOT_READY'],[p=>p.physicalCheck=false,'ORDER_INPUT_INVALID'],[p=>p.transporter.name='','ORDER_INPUT_INVALID'],[p=>p.transporter.mode='UNKNOWN','ORDER_INPUT_INVALID'],[p=>p.receiver='fake','ORDER_INPUT_INVALID']]){
 const f=fixture();mutate(f.command);reject(f,code);assert.equal(f.rows('Remisiones').length,0);assert.equal(f.rows('Catalogos').filter(x=>x.Catalogo.startsWith('REMISION_')).length,0);
}
{
 const f=fixture();f.state.loseBatch=true;reject(f,'REMISSION_SAVE_UNCERTAIN','REMISSION-LOST-01');assert.equal(f.run('REMISION_CREACION_ESTADO',{requestId:'REMISSION-LOST-01'}).saved,true);f.run('REMISION_CREAR',f.command,'REMISSION-LOST-01');assert.equal(f.rows('Remisiones').length,1);assert.equal(f.rows('Orden_Items')[0].Cantidad_Entregada,2);
}
{
 const f=fixture();f.state.delayBatch=true;reject(f,'REMISSION_SAVE_UNCERTAIN','REMISSION-DELAY-01');assert.equal(f.run('REMISION_CREACION_ESTADO',{requestId:'REMISSION-DELAY-01'}).retrySameRequest,false);reject(f,'ORDER_RECOVERY_REQUIRED','REMISSION-DELAY-02');assert.equal(f.rows('Remisiones').length,0);
}
{
 const f=fixture();f.rows('Orden_Items')[0].Cantidad_Entregada=1;assert.throws(()=>f.run('REMISION_CUENTA',{number:f.order.number}),e=>e.appCode==='DELIVERY_INTEGRITY');
}
{
 const f=fixture();assert.throws(()=>f.c.rmCreate_(f.command,f.ctx),e=>e.appCode==='COMMERCIAL_WRITES_DISABLED');
 assert.throws(()=>f.c.osAdmit_(f.c.osState_().id,'REMISION_CUENTA',f.ctx,()=>f.c.rcOrder_(f.order.number,{permissions:['ordenes.read'],profile:{branches:['TP']}})),e=>e.appCode==='BRANCH_NOT_ALLOWED');
 f.c.validateSessionToken_=()=>({permissions:['ordenes.read','remisiones.read'],profile:{uid:'reader',branches:['MP']}});assert.throws(()=>f.c.rmSession_(f.ctx,true),e=>e.appCode==='PERMISSION_DENIED');
}
{
 const f=fixture();f.rows('Produccion').push({Numero_OP:f.order.number,Item_ID:f.order.number+'-I-1'});f.command.fingerprint=f.run('REMISION_CUENTA',{number:f.order.number}).position.fingerprint;reject(f,'DELIVERY_NOT_READY');
}
console.log('OK · remisiones: despacho parcial 2+1+1, responsables, favoritos persistentes, PDF inmutable, dinero intacto, permisos, concurrencia y recuperación.');

