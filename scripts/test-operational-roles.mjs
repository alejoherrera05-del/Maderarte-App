import assert from 'node:assert/strict';
import {sandboxRuntime} from './fixtures/owner-sandbox-runtime.mjs';
const f=sandboxRuntime(),c=f.c;
Object.assign(f.state.props,{ORDER_ADJUSTMENTS_ENABLED:'SI',QUOTE_DOCUMENTS_SCHEMA_VERSION:'1',COMMERCIAL_OPERATION_ENABLED:'SI',ORDER_SAVE_ENABLED:'SI',ORDER_DOCUMENTS_ENABLED:'SI',ORDER_DOCUMENTS_ACCEPTED:'SI',QUOTE_WRITES_ENABLED:'SI',QUOTE_DOCUMENTS_ENABLED:'SI',RECEIPT_SAVE_ENABLED:'SI',REMISSION_SAVE_ENABLED:'SI',PRODUCTION_SAVE_ENABLED:'SI'});
f.production().tables.Configuracion.rows[0].Valor='OPERACION';
for(const [role,perms] of Object.entries(c.OPERATIONAL_ROLE_PROPOSAL_))if(role!=='PROPIETARIO')f.production().tables.Roles.rows.push({Rol:role,Activo:'SI',Permisos_JSON:JSON.stringify(perms)});
const as=role=>{f.production().tables.Usuarios.rows[0].Rol=role;f.production().tables.Usuarios.rows[0].Sedes_Permitidas='MP';};
let seq=0;const run=(action,payload={})=>c.routeAction_(action,payload,{...f.ctx,requestId:'ROLE-FLOW-REQUEST-'+String(++seq).padStart(4,'0'),session:c.validateSessionToken_('qa-session',false)});
const deny=(action,p)=>{
 const common={number,fingerprint:'0'.repeat(64)};
 const samples={COTIZACION_CREAR:quote,ORDEN_CREAR:command,
 RECIBO_CREAR:{...common,amount:100000,method:'EFECTIVO',concept:'Prueba',reference:'',internalNote:''},
 AJUSTE_CONFIRMAR:{...common,type:'DEVOLVER',amount:100000,reason:'Prueba',reference:'Prueba'},
 PRODUCCION_REGISTRAR:{number,itemId:number+'-I-2',revision:1,stage:'BODEGA',quantity:1,date:'2026-09-16',provider:'Taller',notes:'',verified:true},
 REMISION_CREAR:{...common,items:[{itemId:number+'-I-1',quantity:1}],transporter:{name:'Prueba',mode:'PIALLERO',favorite:false},assistant:{name:'',favorite:false},physicalCheck:true,notes:''},
 AGENDA_GUARDAR:{id:'',number,date:'2026-09-20',time:'10:00',items:[{itemId:number+'-I-1',quantity:1}],notes:'',revision:0}};
 assert.throws(()=>run(action,p||samples[action]||{}),e=>e.appCode==='PERMISSION_DENIED',action);
};
const before=JSON.stringify(f.production());const plan=c.operationalRoleProposal_(c.validateSessionToken_('qa-session',false));assert.equal(plan.length,5);assert.equal(JSON.stringify(f.production()),before,'proposal is read-only');
as('VENDEDOR');
const command=structuredClone(f.command);command.items.forEach(i=>i.photos=[]);
const {payments,noPayment,...quote}=structuredClone(command);quote.items=quote.items.map(({agreement,fulfillment,...item})=>item);
const q=run('COTIZACION_CREAR',quote).quote.number;
function pdf(prepare,confirm,number){const p=run(prepare,{number});if(!p.complete)run(confirm,{number,id:p.id,planHash:p.planHash,base64:Buffer.from('%PDF-1.4\nsynthetic transport only\n%%EOF').toString('base64')});}
pdf('INTERNO_COTIZACION_DOCUMENTO_PREPARAR','INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR',q);
assert(run('COTIZACION_PDF_LEER',{number:q}).base64);
const prepared=run('COTIZACION_PREPARAR_PEDIDO',{number:q});command.quoteOrigin={number:q,fingerprint:prepared.fingerprint};
const number=run('ORDEN_CREAR',command).order.number;
pdf('INTERNO_DOCUMENTO_PREPARAR','INTERNO_DOCUMENTO_CONFIRMAR',number);
assert(run('ORDEN_PDF_LEER',{number}).base64);
const account=run('RECIBO_CUENTA',{number});const receipt=run('RECIBO_CREAR',{number,fingerprint:account.position.fingerprint,amount:100000,method:'EFECTIVO',concept:'Prueba por rol',reference:'',internalNote:''}).receipt;
pdf('INTERNO_RECIBO_DOCUMENTO_PREPARAR','INTERNO_RECIBO_DOCUMENTO_CONFIRMAR',receipt.number);
assert(run('RECIBO_PDF_LEER',{number:receipt.number}).base64);
for(const action of ['USUARIOS_LISTAR','INVITACION_CREAR','AJUSTE_CONFIRMAR','RECAUDO_RECIBIR','PRODUCCION_REGISTRAR','REMISION_CREAR'])deny(action);
assert.throws(()=>run('ORDEN_CREAR',{...command,branch:'TP'}),e=>e.appCode==='BRANCH_NOT_ALLOWED');
const totals=()=>JSON.stringify(f.production().tables.Ordenes_Pedido.rows.map(r=>[r.Valor_Total,r.Abonado_Total,r.Saldo_Pendiente]));const money=totals();
as('BODEGA_LOGISTICA');
for(const action of ['COTIZACION_CREAR','ORDEN_CREAR','RECIBO_CREAR','AJUSTE_CONFIRMAR','RECAUDO_RECIBIR','USUARIOS_LISTAR'])deny(action);
const prod=run('PRODUCCION_CUENTA',{number}),item=prod.items[1];run('PRODUCCION_REGISTRAR',{number,itemId:item.id,revision:item.revision,stage:'BODEGA',quantity:1,date:'2026-09-16',provider:'Taller de muestra',notes:'Prueba',verified:true});
const delivery=run('REMISION_CUENTA',{number});const remission=run('REMISION_CREAR',{number,fingerprint:delivery.position.fingerprint,items:[{itemId:number+'-I-1',quantity:1},{itemId:number+'-I-2',quantity:1}],transporter:{name:'Transportador de muestra',mode:'PIALLERO',favorite:false},assistant:{name:'',favorite:false},physicalCheck:true,notes:'Sin entrega real'}).remission;
pdf('INTERNO_REMISION_DOCUMENTO_PREPARAR','INTERNO_REMISION_DOCUMENTO_CONFIRMAR',remission.number);assert(run('REMISION_PDF_LEER',{number:remission.number}).base64);assert.equal(totals(),money);
as('CONSULTA');assert(run('ORDEN_OBTENER',{number}));assert(run('COTIZACION_OBTENER',{number:q}));for(const action of ['COTIZACION_CREAR','ORDEN_CREAR','RECIBO_CREAR','REMISION_CREAR','PRODUCCION_REGISTRAR','AGENDA_GUARDAR','AJUSTE_CONFIRMAR','INVITACION_CREAR','RECAUDO_RECIBIR'])deny(action);
as('ADMINISTRADOR');assert(run('RECAUDOS_LISTAR',{from:'2026-09-16',to:'2026-09-16'}));
console.log('Role flow passed: seller quote/new client/PDF/conversion/order/PDF/receipt/PDF; logistics production and two-item dispatch/PDF; read-only and forbidden actions; branch isolation. Synthetic Google transport; no real grants.');



