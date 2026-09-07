import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { documentFixture } from './fixtures/order-document-runtime.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a,b,message) => assert.deepEqual(JSON.parse(JSON.stringify(a)),b,message);
const fails = (fn, code) => assert.throws(fn, e => e.appCode === code, code);
function order(f) { return f.create().order.number; }
function prepare(f, number) { let data; for(let i=0;i<12;i++){ data=f.call('ORDEN_DOCUMENTOS_PREPARAR',{number}); if(data.ready) return data; } throw new Error('Folders not ready'); }
function upload(f, number, spec, bytes) {
  let status=f.call('ORDEN_ARCHIVO_INICIAR',{number,...spec});
  while(!status.done) status={...status,...f.call('ORDEN_ARCHIVO_PARTE',{number,key:status.file.key,sha256:status.file.sha256,offset:status.offset,data:bytes.subarray(status.offset,status.offset+262144).toString('base64')})};
  return status.file;
}
function complete(f, number) {
  let state=prepare(f,number);
  for(const photo of state.snapshot.items.flatMap(item=>item.photos)) upload(f,number,{photoKey:photo.key},f.photo);
  state=f.call('ORDEN_DOCUMENTOS_ESTADO',{number});
  const pdf=Buffer.from('%PDF-1.4\n'+'Synthetic PDF bytes; raster validation is a separate Chrome test.\n'.repeat(10));
  for(const receipt of ['',...state.snapshot.payments.map(p=>p.number)]) upload(f,number,{receipt,snapshotHash:state.snapshotHash,template:state.snapshot.template,sha256:hash(pdf),bytes:pdf.length},pdf);
  return f.call('ORDEN_DOCUMENTOS_FINALIZAR',{number,snapshotHash:state.snapshotHash});
}
{
  const f=documentFixture(); f.context.MADERARTE_APP.COMMERCIAL_WRITES=false;
  assert.equal(f.call('ORDEN_CAPACIDADES').enabled,false);
  fails(f.create,'COMMERCIAL_WRITES_DISABLED');assert.equal(f.state.calls,0);
}
{
  const f=documentFixture(),number=order(f),before=JSON.stringify(f.rows('Abonos'));
  const state=complete(f,number);assert.equal(state.complete,true);
  assert.equal(f.rows('Ordenes_Pedido').length,1);assert.equal(f.rows('Documentos').length,4);assert.equal(f.rows('Versiones_Documentos').length,3);
  assert.equal(f.rows('Archivos_Orden').filter(x=>x.Tipo==='CARPETA').length,9);
  assert.ok(f.rows('Ordenes_Pedido')[0].URL_PDF_OP);assert.ok(f.rows('Orden_Items')[0].URL_Foto);
  assert.equal(f.rows('Orden_Items')[1].URL_Foto,''); assert.ok(f.rows('Abonos').every(x=>x.URL_PDF_Recibo));
  assert.equal(f.rows('Abonos').length,2);assert.equal(f.rows('Sedes')[0].Siguiente_OP,2);
  const values=JSON.stringify(f.rows('Abonos').map(({URL_PDF_Recibo,URL_Carpeta_Cliente,...rest})=>rest));
  assert.equal(values,JSON.stringify(JSON.parse(before).map(({URL_PDF_Recibo,URL_Carpeta_Cliente,...rest})=>rest)));
  assert.doesNotMatch(JSON.stringify(state),/NOTA-PRIVADA|upload_id/);
  const count=f.state.calls;complete(f,number);assert.equal(f.state.calls,count); assert.equal(f.create().replayed,true);
  const file=state.files.find(x=>x.type==='FOTO');let all=Buffer.alloc(0);
  while(all.length<file.bytes){const part=f.call('ORDEN_ARCHIVO_LEER',{number,key:file.key,offset:all.length});all=Buffer.concat([all,Buffer.from(part.data,'base64')]);}
  assert.equal(hash(all),hash(f.photo));
  f.session.permissions=['ordenes.read'];f.session.profile.branches=['TP'];
  fails(()=>f.call('ORDEN_DOCUMENTOS_ESTADO',{number}),'ORDER_NOT_AVAILABLE');
  fails(()=>f.context.getOrder_({number},f.session),'BRANCH_NOT_ALLOWED');
  assert.equal(f.context.listOrders_({},f.session).items.length,0);
}
{
  const f=documentFixture(),number=order(f);
  f.state.loseDrive=(url,method)=>url.pathname==='/drive/v3/files'&&method==='post';
  fails(()=>prepare(f,number),'DRIVE_RETRY');prepare(f,number);
  assert.equal(f.state.drive.size,10,'Lost folder response must not create another folder');
  const data=f.call('ORDEN_DOCUMENTOS_ESTADO',{number}),photo=data.snapshot.items[0].photos[0];
  let status=f.call('ORDEN_ARCHIVO_INICIAR',{number,photoKey:photo.key});
  f.state.loseDrive=(url,method,opts)=>method==='put'&&!opts.headers['Content-Range'].startsWith('bytes */');
  const args={number,key:status.file.key,sha256:photo.sha256,offset:0,data:f.photo.subarray(0,262144).toString('base64')};
  fails(()=>f.call('ORDEN_ARCHIVO_PARTE',args),'DRIVE_RETRY');
  const replay=f.call('ORDEN_ARCHIVO_PARTE',args);assert.equal(replay.offset,262144);
  const end=f.call('ORDEN_ARCHIVO_PARTE',{...args,offset:262144,data:f.photo.subarray(262144).toString('base64')});assert.equal(end.done,true);
  assert.equal(f.rows('Abonos').length,2);
}
{
  const f=documentFixture(),number=order(f);f.state.loseResponse=true;
  fails(()=>prepare(f,number),'DOCUMENT_RESULT_PENDING');
  assert.ok(f.state.props.ORDER_DOCUMENT_PENDING);
  const count=f.rows('Archivos_Orden').length;prepare(f,number);assert.equal(count,1);assert.equal(f.rows('Archivos_Orden').filter(x=>x.Tipo==='CARPETA').length,9);
  assert.equal(f.state.props.ORDER_DOCUMENT_PENDING,undefined);
}
{
  const f=documentFixture(),number=order(f);f.state.delayedCommit=true;
  fails(()=>prepare(f,number),'DOCUMENT_RESULT_PENDING');const calls=f.state.calls;
  fails(()=>prepare(f,number),'DOCUMENT_RESULT_PENDING');assert.equal(f.state.calls,calls);
  fails(()=>f.context.createOrder_(f.payload,{...f.request,requestId:'OTHER-ORDER-0000001'}),'DOCUMENT_RESULT_PENDING');
  f.state.tables=f.state.pendingTables;f.state.delayedCommit=false;prepare(f,number);
}
{
  const f=documentFixture(),number=order(f),data=prepare(f,number);
  fails(()=>f.call('ORDEN_DOCUMENTOS_FINALIZAR',{number,snapshotHash:data.snapshotHash}),'DOCUMENTS_PENDING');
  fails(()=>f.call('ORDEN_ARCHIVO_INICIAR',{number,photoKey:'other'}),'DOCUMENT_NOT_AVAILABLE');
  const photo=data.snapshot.items[0].photos[0];
  const start=f.call('ORDEN_ARCHIVO_INICIAR',{number,photoKey:photo.key});
  fails(()=>f.call('ORDEN_ARCHIVO_PARTE',{number,key:start.file.key,sha256:photo.sha256,offset:0,data:Buffer.alloc(262144).toString('base64')}),'DOCUMENT_INPUT_INVALID');
  complete(f,number);const slot=f.rows('Archivos_Orden').find(x=>x.Tipo==='FOTO');
  f.rows('Ordenes_Pedido')[0].Estado_Documentos='PENDIENTE'; f.state.drive.get(slot.File_ID).sha256Checksum='0'.repeat(64);
  fails(()=>f.call('ORDEN_DOCUMENTOS_FINALIZAR',{number,snapshotHash:data.snapshotHash}),'DOCUMENT_HASH_MISMATCH');
}
{
  const f=documentFixture(),c=f.context;
  const ctx={session:f.session};
  fails(()=>c.withOrderDataContext_('QA','ORDEN_CREAR',ctx,()=>true),'TRIAL_NOT_READY');
  f.state.props.ORDER_QA_ENABLED='SI';f.state.props.ORDER_QA_SPREADSHEET_ID='synthetic-sheet';f.state.props.ORDER_QA_ROOT_ID='another-root';
  fails(()=>c.withOrderDataContext_('QA','ORDEN_CREAR',ctx,()=>true),'TRIAL_NOT_READY');
  f.session.profile.role='VENDEDOR';fails(()=>c.withOrderDataContext_('QA','ORDEN_CREAR',ctx,()=>true),'TRIAL_NOT_ALLOWED');
  f.session.profile.role='PROPIETARIO';fails(()=>c.withOrderDataContext_('QA','AUTH_LOGIN',ctx,()=>true),'TRIAL_NOT_ALLOWED');
  f.state.props.ORDER_QA_SPREADSHEET_ID='qa-sheet';
  const original=c.SpreadsheetApp.openById;c.SpreadsheetApp.openById=id=>id==='qa-sheet'?{getName:()=> 'Maddy · Ensayo documental · Fixture'}:original(id);
  c.withOrderDataContext_('QA','ORDEN_CREAR',ctx,()=>{
    assert.equal(c.requiredProperty_('SPREADSHEET_ID'),'qa-sheet');
    c.getScriptProperties_().setProperty('ORDER_DOCUMENT_PENDING','qa-only');
    assert.equal(f.state.props.QA_ORDER_DOCUMENT_PENDING,'qa-only');assert.equal(f.state.props.ORDER_DOCUMENT_PENDING,undefined);
    c.validateSessionToken_=()=>{assert.equal(c.ORDER_DATA_CONTEXT_,null);return f.session;};c.validateOrderSession_('qa-session',false);
  });
  assert.equal(c.ORDER_DATA_CONTEXT_,null);assert.equal(c.requiredProperty_('SPREADSHEET_ID'),'synthetic-sheet');
}
console.log('OK · ciclo documental real del código con adaptadores simulados: carpetas, fotos, OP, recibos, enlaces, privacidad, pérdida de respuesta, commit tardío y aislamiento. No se escribió en Google.');
