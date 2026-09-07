import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fixture } from './test-order-creation.mjs';
const hash = bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI1cAAAAASUVORK5CYII=', 'base64');
let checks = 0;
const eq = (a,b) => { assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b))); checks++; };
const fails = (f,code) => { assert.throws(f,e=>e.appCode === code,code); checks++; };
function mediaFixture() {
  const f = fixture(), c = f.context;
  const files = new Map([['root', { id:'root',name:'02_DOCUMENTOS_CLIENTES',mimeType:'application/vnd.google-apps.folder', parents:[],bytes:Buffer.alloc(0) }]]);
  let next = 0;
  f.state.fileWrites = 0;
  Object.assign(f.state.props,{ORDER_DOCUMENTS_SCHEMA_VERSION:'1',ORDER_DOCUMENTS_ENABLED:'SI',DRIVE_DOCUMENTS_ROOT_ID:'root'});
  c.Utilities = {
    DigestAlgorithm:{SHA_256:'sha256'}, getUuid:randomUUID,
    computeDigest: (_alg,bytes)=>[...createHash('sha256').update(Buffer.from(bytes)).digest()],
    base64Decode: text=>[...Buffer.from(text,'base64')], base64Encode: bytes=>Buffer.from(bytes).toString('base64'),
    newBlob: data=>({getBytes:()=>[...Buffer.from(data)]}),
    formatDate: (date,_tz,pattern)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).formatToParts(date).find(x=>x.type === (pattern==='yyyy'?'year':'month')).value
  };
  vm.runInContext(readFileSync('apps-script/OrderMedia.gs','utf8'),c);
  for (const [name,headers] of Object.entries(c.ORDER_MEDIA_HEADERS_)) f.state.tables[name]={headers:[...headers],rows:[]};
  const original = c.UrlFetchApp.fetch;
  c.UrlFetchApp.fetch = (url,opts) => {
    if (url.startsWith('https://sheets.googleapis.com')) return original(url,opts);
    eq(opts.headers.Authorization,'Bearer synthetic-oauth');
    function response(value,status=200){return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(value),getBlob:()=>({getBytes:()=>[...(value.bytes||[])]})};}
    if(url.includes('/generateIds')) return response({ids:Array.from({length:Number(new URL(url).searchParams.get('count'))},()=>`reserved-${++next}`)});
    if(opts.method==='post') {
      let meta,bytes;
      if(opts.contentType==='application/json') {meta=JSON.parse(opts.payload);bytes=Buffer.alloc(0);}
      else {
        const body=Buffer.from(opts.payload), boundary=opts.contentType.split('boundary=')[1];
        const text=body.toString('latin1');
        const start=text.indexOf('\r\n\r\n')+4,end=text.indexOf('\r\n--'+boundary,start);
        meta=JSON.parse(Buffer.from(body.subarray(start,end)).toString('utf8'));
        const mediaStart=text.indexOf('\r\n\r\n',end+4)+4;
        bytes=body.subarray(mediaStart,text.lastIndexOf('\r\n--'+boundary));
      }
      if(files.has(meta.id)) return response({},409);
      files.set(meta.id,{...meta,bytes,size:String(bytes.length)}); f.state.fileWrites++;
      if(f.state.loseDriveResponse) {f.state.loseDriveResponse=false;throw new Error('Drive committed; transport lost');}
      return response({id:meta.id});
    }
    const id=new URL(url).pathname.split('/').pop(), file=files.get(id);
    return file?response(file):response({},404);
  };
  f.payload.items[0].photos=[{id:'p1',name:'referencia.png',mime:'image/png',size:photo.length,sha256:hash(photo)}];
  return {...f,files};
}
{
  const f=mediaFixture(),c=f.context;
  const saved=f.create(); eq(saved.order.mediaWorkflow,1); eq(f.state.fileWrites,0);
  eq(f.rows('Archivos_Orden').length,2); eq(f.rows('Documentos').every(x=>x.Activo==='NO'),true);
  eq(f.rows('Carpetas_Documentales').length,9);
  assert.doesNotMatch(JSON.stringify(f.rows('Archivos_Orden')),/NOTA-PRIVADA/);checks++;
  const number=saved.order.number;
  const ctx={...f.request,proxyMeta:{documentPipeline:true}};
  fails(()=>c.mdPreparePdf_({number},f.request),'DOCUMENT_PIPELINE_ONLY');
  fails(()=>c.mdPreparePdf_({number},ctx),'ORDER_PHOTOS_PENDING');
  const slot=f.rows('Archivos_Orden').find(x=>x.Tipo==='FOTO');
  fails(()=>c.mdUploadPhoto_({number,id:slot.Archivo_ID,base64:Buffer.from('wrong').toString('base64')},ctx),'MEDIA_HASH_MISMATCH');
  f.state.loseDriveResponse=true;
  eq(c.mdUploadPhoto_({number,id:slot.Archivo_ID,base64:photo.toString('base64')},ctx).ready,true);
  const writes=f.state.fileWrites;
  c.mdUploadPhoto_({number,id:slot.Archivo_ID,base64:photo.toString('base64')},ctx);
  eq(f.state.fileWrites,writes);
  const ready=c.mdPreparePdf_({number},ctx);
  eq(ready.complete,false);eq(ready.document.items[0].photos.length,1);eq(ready.document.items[1].photos.length,0);
  assert.doesNotMatch(JSON.stringify(ready),/NOTA-PRIVADA/);checks++;
  eq(c.mdReadPhoto_({number,id:slot.Archivo_ID},ctx).dataUrl,'data:image/png;base64,'+photo.toString('base64'));
  const pdf=Buffer.from('%PDF-1.4\nsynthetic PDF bytes for transport test only\n%%EOF');
  const input={number,id:ready.id,planHash:ready.planHash,base64:pdf.toString('base64')};
  f.state.loseResponse=true;
  assert.throws(()=>c.mdConfirmPdf_(input,ctx),/response lost AFTER commit/);checks++;
  eq(c.mdPreparePdf_({number},ctx).complete,true);
  eq(c.mdConfirmPdf_(input,ctx).complete,true);
  eq(f.rows('Ordenes_Pedido')[0].Estado_Documentos,'COMPLETO');
  eq(f.rows('Ordenes_Pedido').length,1);eq(f.rows('Abonos').length,2);eq(f.rows('Documentos').length,2);eq(f.rows('Versiones_Documentos').length,1);
  eq(f.rows('Documentos').every(x=>x.Activo==='SI'),true);
  eq(f.rows('Orden_Items')[0].Cantidad_Entregada,0);
  eq(f.rows('Remisiones').length,0);eq(f.rows('Produccion').length,0);
  const pdfSlot=f.rows('Archivos_Orden').find(x=>x.Tipo==='OP');
  const savedBytes=f.files.get(pdfSlot.File_ID).bytes;
  eq(hash(savedBytes),hash(pdf));
  // Re-rendered PDF may differ in metadata. The original committed file is retained.
  c.mdConfirmPdf_({...input,base64:Buffer.from('%PDF-1.4\nsecond render').toString('base64')},ctx);
  eq(hash(f.files.get(pdfSlot.File_ID).bytes),hash(pdf));
  // Authorization is rechecked before any file is read/written.
  f.session.permissions=['ordenes.read','ordenes.create'];f.session.profile.branches=['TP'];
  fails(()=>c.mdReadPhoto_({number,id:slot.Archivo_ID},ctx),'BRANCH_NOT_ALLOWED');
  f.session.profile.branches=['MP'];f.session.profile.uid='another-user';
  fails(()=>c.mdUploadPhoto_({number,id:slot.Archivo_ID,base64:photo.toString('base64')},ctx),'ORDER_DOCUMENT_FORBIDDEN');
}
{
  const f=mediaFixture();const first=f.create();const old=f.rows('Carpetas_Documentales').find(x=>x.Clave.includes(':C:')&&!x.Clave.endsWith(':QUOTES')).File_ID;
  f.request.requestId='QA-ORDER-CREATION-SECOND';f.context.now_=()=>new Date('2026-10-05T17:00:00Z');
  f.create();
  const clients=f.rows('Carpetas_Documentales').filter(x=>x.Clave.includes(':C:')&&!x.Clave.endsWith(':QUOTES'));
  eq(clients.length,1);eq(clients[0].File_ID,old);
  eq(f.rows('Ordenes_Pedido').length,2);eq(f.rows('Archivos_Orden').length,4);
  eq(f.files.size,1); // Reservations alone do not create Drive files.
}
{
  const f=mediaFixture();delete f.state.props.ORDER_DOCUMENTS_SCHEMA_VERSION;
  fails(f.create,'ORDER_PHOTOS_NOT_READY');eq(f.state.fileWrites,0);
  f.state.props.ORDER_DOCUMENTS_SCHEMA_VERSION='1';f.payload.items[0].photos[0].mime='image/svg+xml';
  fails(f.create,'ORDER_INPUT_INVALID');eq(f.state.fileWrites,0);
}
{
 const f=mediaFixture(),c=f.context;
 c.MADERARTE_APP={...c.MADERARTE_APP,COMMERCIAL_WRITES:false};
 f.state.tables.Configuracion.rows[0].Valor='PREPARACION';
 c.prepararEsquemaGuardadoOrdenes=()=>true;
 const sheets=new Map();let batchCount=0,lose=false;
 const wrap=(id,headers)=>({getSheetId:()=>id,getLastRow:()=>1,getLastColumn:()=>headers.length,getRange:()=>({getValues:()=>[headers],getDisplayValues:()=>[headers]})});
 for(const name of Object.keys(c.ORDER_MEDIA_HEADERS_)) delete f.state.tables[name];
 const originalSpreadsheet=c.getSpreadsheet_();
 c.getSpreadsheet_=()=>({getSheets:()=>[...sheets.values()],getSheetByName:n=>sheets.get(n)||originalSpreadsheet.getSheetByName(n)});
 const originalGetSheet=c.getSheet_; c.getSheet_=n=>sheets.get(n)||originalGetSheet(n);
 c.orderAtomicBatch_=requests=>{batchCount++;for(const req of requests){if(req.addSheet){const p=req.addSheet.properties;sheets.set(p.title,wrap(p.sheetId,[]));}else if(req.updateCells){const sheet=[...sheets.values()].find(s=>s.getSheetId()===req.updateCells.start.sheetId);const headers=req.updateCells.rows[0].values.map(x=>x.userEnteredValue.stringValue);for(const [name,s] of sheets)if(s===sheet)sheets.set(name,wrap(sheet.getSheetId(),headers));}}
  if(lose){lose=false;throw new Error('lost schema response');}
 };
 eq(c.prepararDocumentosOrdenes().ok,true);eq(sheets.size,2);eq(batchCount,1);
 eq(c.prepararDocumentosOrdenes().ok,true);eq(batchCount,1);
 sheets.clear();delete f.state.props.ORDER_DOCUMENTS_SCHEMA_VERSION;lose=true;
 assert.throws(()=>c.prepararDocumentosOrdenes(),/lost schema response/);checks++;
 eq(typeof f.state.props.ORDER_DOCUMENTS_SCHEMA_VERSION,'undefined');
 eq(c.prepararDocumentosOrdenes().ok,true);eq(sheets.size,2);eq(batchCount,2);
 const sheet=sheets.values().next().value;sheet.getLastRow=()=>2;
 fails(()=>c.prepararDocumentosOrdenes(),'SHEET_SCHEMA_MISMATCH');
}
export { mediaFixture };
console.log(`OK · ${checks} comprobaciones documentales con Drive/Sheets simulados: reservas, fotos, identidad, privacidad, carpetas, PDF y reintentos. Sin escrituras a Google.`);
