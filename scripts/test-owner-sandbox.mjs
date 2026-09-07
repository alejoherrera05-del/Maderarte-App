import assert from 'node:assert/strict';
import { sandboxRuntime, testClient } from './fixtures/owner-sandbox-runtime.mjs';
let checks=0;
const equal=(a,b,label)=>{assert.deepEqual(a === undefined ? undefined : JSON.parse(JSON.stringify(a)),b === undefined ? undefined : JSON.parse(JSON.stringify(b)),label);checks++;};
const rejects=(f,code)=>{assert.throws(f,e=>e.appCode===code,code);checks++;};
{
 const f=sandboxRuntime(), before=JSON.stringify(f.production()), props={...f.state.props};
 rejects(()=>f.c.createOrder_(f.command,f.ctx),'COMMERCIAL_WRITES_DISABLED');
 const status=f.start();equal(status.state,'ACTIVA');equal(Object.keys(f.state.books[f.c.osState_().sheetId].tables).length,25);
 equal(f.start().id,status.id);equal(f.run('ORDEN_CAPACIDADES').enabled,true);
 const {number,plan}=f.complete();assert.match(number,/^MP-QA-[A-F0-9]{8}-OP-0001$/);checks++;
 equal(f.rows('Ordenes_Pedido').length,1);equal(f.rows('Abonos').length,2);equal(f.rows('Ordenes_Pedido')[0].Estado_Documentos,'COMPLETO');
 equal(f.rows('Orden_Items').map(x=>x.Acuerdo),['ENTREGA_HOY','ENTREGA_POSTERIOR']);
 equal(f.rows('Orden_Items').map(x=>x.Cantidad_Entregada),[0,0]);
 assert.doesNotMatch(JSON.stringify(plan),/NOTA INTERNA|OTRA NOTA/);checks++;
 equal(plan.document.sandbox,status.id);equal(f.run('ORDEN_CREAR',f.command).replayed,true);
 rejects(()=>f.run('ORDEN_CREAR',f.command,'ANOTHER-REQUEST-0002'),'SANDBOX_ONE_ORDER');
 equal(f.run('ORDEN_CAPACIDADES').enabled,false);
 const read=f.run('ORDEN_OBTENER',{number});equal(read.order.number,number);equal(read.items.length,2);
 equal(JSON.stringify(f.production()),before,'Production cells unchanged');equal(Object.keys(props).every(k=>props[k]===f.state.props[k]),true);
 rejects(()=>f.c.osClean_({id:status.id,confirm:'LIMPIAR OTRO'},f.ctx),'SANDBOX_CONFIRM_REQUIRED');
 f.state.pageSize=1;
 f.state.loseTrash=true;equal(f.clean().cleanupConfirmed,true);
 equal(f.clean().state,'CERRADA');equal(f.state.files.get(f.prod).trashed,undefined);equal(f.state.files.get('production-docs').trashed,undefined);
 rejects(()=>f.run('ORDEN_OBTENER',{number}),'SANDBOX_CLOSED');equal(JSON.stringify(f.production()),before);
 equal(f.state.locked,false);equal(f.c.OWNER_SANDBOX_CONTEXT_,null);
}
{
 const f=sandboxRuntime();f.start();const s=f.c.osState_();
 for(const action of ['PRUEBA_LIMPIAR','AUTH_LOGIN','INVITACION_CREAR','SISTEMA_ESTADO',''])rejects(()=>f.c.osAdmit_(s.id,action,f.ctx,()=>{}),'SANDBOX_ACTION_FORBIDDEN');
 rejects(()=>f.c.osAdmit_('production','ORDEN_CREAR',f.ctx,()=>{}),'SANDBOX_ACTION_FORBIDDEN');
 f.production().tables.Usuarios.rows[0].Rol='ADMINISTRADOR';
 for(const op of [f.start,()=>f.c.osStatus_(f.ctx),()=>f.run('ORDEN_CAPACIDADES'),f.clean])rejects(op,'SANDBOX_OWNER_ONLY');
 equal(f.rows('Ordenes_Pedido').length,0);equal(f.state.locked,false);
}
{
 const f=sandboxRuntime();f.start();f.production().tables.Usuarios.rows[0].Estado='INACTIVO';rejects(()=>f.run('ORDEN_CAPACIDADES'),'USER_INACTIVE');equal(f.c.OWNER_SANDBOX_CONTEXT_,null);
}
{
 const f=sandboxRuntime();f.start();const p=structuredClone(f.command);p.client.name='Cliente real';rejects(()=>f.run('ORDEN_CREAR',p),'SANDBOX_SYNTHETIC_CLIENT_REQUIRED');
 equal(f.rows('Ordenes_Pedido').length,0);equal(f.c.osState_().requestId,undefined);
 p.client={...testClient};p.items=Array.from({length:4},(_,i)=>({...p.items[0],clientLineId:String(i)}));rejects(()=>f.run('ORDEN_CREAR',p),'SANDBOX_LIMIT');
 equal(f.clean().state,'CERRADA');
}
{
 const f=sandboxRuntime();f.start();f.state.loseBatch=true;rejects(()=>f.run('ORDEN_CREAR',f.command),'ORDER_SAVE_UNCERTAIN');
 const saved=f.run('ORDEN_CREACION_ESTADO',{requestId:f.ctx.requestId});equal(saved.saved,true);
 equal(f.rows('Ordenes_Pedido').length,1);rejects(f.clean,'SANDBOX_DOCUMENTS_PENDING');
 f.complete();equal(f.clean().state,'CERRADA');
}
{
 const f=sandboxRuntime();f.start();f.state.delayBatch=true;rejects(()=>f.run('ORDEN_CREAR',f.command),'ORDER_SAVE_UNCERTAIN');
 rejects(f.clean,'ORDER_RECOVERY_REQUIRED');equal(f.run('ORDEN_CREACION_ESTADO',{requestId:f.ctx.requestId}).retrySameRequest,false);
 equal(f.rows('Ordenes_Pedido').length,0);f.state.books[f.state.delayed.id]=f.state.delayed.book;
 equal(f.run('ORDEN_CREACION_ESTADO',{requestId:f.ctx.requestId}).saved,true);f.complete();equal(f.clean().state,'CERRADA');
}
{
 const f=sandboxRuntime();f.start();f.complete();const s=f.c.osState_();
 f.state.files.set('foreign',{id:'foreign',name:'Archivo ajeno',mimeType:'text/plain',parents:[s.rootId]});
 rejects(f.clean,'SANDBOX_FOREIGN_FILE');equal([...f.state.files.values()].some(x=>x.trashed),false);
 f.state.files.delete('foreign');f.state.rejectTrash=true;rejects(f.clean,'SANDBOX_CLEANUP_PENDING');equal(f.c.osState_().stage,'LIMPIANDO');
 rejects(()=>f.run('ORDEN_CAPACIDADES'),'SANDBOX_CLOSED');f.state.rejectTrash=false;equal(f.clean().state,'CERRADA');
}
{
 const f=sandboxRuntime();f.state.loseFileCreate=true;equal(f.start().state,'ACTIVA','folder lost reply recovered by ID');
 equal(f.state.files.size,6);
}
{
 const f=sandboxRuntime();f.start();const s=f.c.osState_();s.sheetId=f.prod;f.c.osStore_(s);
 rejects(()=>f.run('ORDEN_CAPACIDADES'),'SANDBOX_IDENTITY_MISMATCH');equal(f.c.OWNER_SANDBOX_CONTEXT_,null);
}
{
 const f=sandboxRuntime();f.state.loseNativeCreate=true;rejects(f.start,'SANDBOX_PROVISION_UNCERTAIN');
 const id=f.c.osState_().id;equal(f.c.osState_().sheetCreationSent,true);equal(f.c.osState_().stage,'PREPARANDO');
 f.state.hideSearch=true;rejects(f.start,'SANDBOX_PROVISION_UNCERTAIN');
 equal([...f.state.files.values()].filter(x=>x.mimeType==='application/vnd.google-apps.spreadsheet').length,2);
 f.state.hideSearch=false;equal(f.start().id,id);equal(f.start().state,'ACTIVA');equal(f.clean().state,'CERRADA');
}
{
 const f=sandboxRuntime();f.start();f.complete();const photo=f.rows('Archivos_Orden').find(x=>x.Tipo==='FOTO');
 f.state.files.get(photo.File_ID).parents=['main-root'];rejects(f.clean,'SANDBOX_IDENTITY_MISMATCH');
 equal([...f.state.files.values()].some(x=>x.trashed),false);
}
{
 const f=sandboxRuntime();const body={proxyToken:'qa-proxy',sessionToken:'qa-session',action:'ORDEN_CAPACIDADES',requestId:'test',payload:{}};
 for(const sandboxId of ['',null,'bad',42,{}]){const res=JSON.parse(f.c.doPost({postData:{contents:JSON.stringify({...body,sandboxId})}}));equal(res.code,'SANDBOX_ACTION_FORBIDDEN');}
 equal(JSON.parse(f.c.doPost({postData:{contents:JSON.stringify(body)}})).data.enabled,false);
}
console.log(`OK · ${checks} comprobaciones del ensayo: aislamiento, propietario real, una OP, reintentos, fotos, PDF, limpieza confirmada y producción intacta. Google simulado.`);
