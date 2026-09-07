// Real Apps Script modules; only Google's HTTP, spreadsheet and lock transports
// are in-memory. This fixture never calls Google or enables commercial writes.
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
export const testClient = { document: '0000000001', name: 'PRUEBA MADDY - NO ES UNA VENTA', phone: '0000000011', alternatePhone: '0000000022', email: 'qa@example.invalid', address: 'SIN ENTREGA - DATOS FICTICIOS', city: 'Popayán (prueba)' };
const clone = v => JSON.parse(JSON.stringify(v));
export const fixturePhoto = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI1cAAAAASUVORK5CYII=', 'base64');
const hash = v => createHash('sha256').update(typeof v === 'string' ? v : Buffer.from(v)).digest('hex');
export function sandboxRuntime() {
  const prod = 'synthetic-production';
  const state = { books: {}, files: new Map(), locked: false, calls: [], props: { SPREADSHEET_ID: prod, DRIVE_DOCUMENTS_ROOT_ID: 'production-docs', ORDER_SCHEMA_VERSION: '2', ORDER_DOCUMENTS_SCHEMA_VERSION: '1', MADERARTE_PROXY_TOKEN: 'qa-proxy' },
    loseBatch: false, delayBatch: false, delayed: null, loseFileCreate: false, rejectTrash: false, loseTrash: false, ids: 0 };
  const production = { name: 'Base de Datos Maderarte App', tables: {} }; state.books[prod] = production;
  function book(id) {
    const b = state.books[id]; if (!b) throw Error('Unknown spreadsheet ' + id);
    const sheet = name => {
      const t = b.tables[name]; if (!t) return null;
      return { getName: () => name, getSheetId: () => t.id, getMaxColumns: () => t.columns || t.headers.length, getLastColumn: () => t.headers.length,
        getLastRow: () => t.rows.length ? t.rows.length + 1 : t.headers.length ? 1 : 0,
        getRange: (r,col,nr=1,nc=1) => ({
          getDisplayValues: () => r === 1 ? [t.headers.slice(col-1,col-1+nc)] : t.rows.slice(r-2,r-2+nr).map(row=>t.headers.slice(col-1,col-1+nc).map(h=>String(row[h]??''))),
          getValues: () => r === 1 ? [t.headers.slice(col-1,col-1+nc)] : t.rows.slice(r-2,r-2+nr).map(row=>t.headers.slice(col-1,col-1+nc).map(h=>row[h]??'')),
          setValue: v => { t.rows[r-2][t.headers[col-1]]=v; }
        }), appendRow: values=>t.rows.push(Object.fromEntries(t.headers.map((h,i)=>[h,values[i]??'']))) };
    };
    return { getName:()=>b.name, getSheetByName:sheet, getSheets:()=>Object.keys(b.tables).map(sheet) };
  }
  function batch(id, data) {
    if (!state.locked) throw Error('Write without ScriptLock');
    const b=clone(state.books[id]); if(!b)throw Error('Unknown book');
    for (const r of data.requests) {
      if(Object.keys(r).length !== 1)throw Error('Bad Sheets request');
      if (r.addSheet) { const p=r.addSheet.properties; if(b.tables[p.title])throw Error('Duplicate tab'); b.tables[p.title]={id:p.sheetId,columns:p.gridProperties.columnCount,headers:[],rows:[]};continue; }
      if (r.deleteSheet) { const pair=Object.entries(b.tables).find(([,t])=>t.id===r.deleteSheet.sheetId);delete b.tables[pair[0]];continue; }
      if (r.repeatCell || r.updateSheetProperties || r.updateDimensionProperties) continue;
      const body=r.appendCells||r.updateCells||r.appendDimension;
      const table=Object.values(b.tables).find(t=>t.id===(r.appendCells?body.sheetId:r.updateCells?body.start.sheetId:body.sheetId));
      if(!table)throw Error('Unknown table');
      if(r.appendDimension){table.columns+=body.length;continue;}
      for(let j=0;j<body.rows.length;j++) {
        const values=body.rows[j].values.map(cell=>{ if(cell.userEnteredValue?.formulaValue)throw Error('Unexpected formula');return cell.userEnteredValue?.stringValue??cell.userEnteredValue?.numberValue??''; });
        if(r.appendCells){table.rows.push(Object.fromEntries(table.headers.map((h,i)=>[h,values[i]??''])));continue;}
        const index=body.start.rowIndex+j,col=body.start.columnIndex;
        if(index===0){values.forEach((v,i)=>{table.headers[col+i]=v;});continue;}
        while(table.rows.length<index)table.rows.push({});
        values.forEach((v,i)=>{table.rows[index-1][table.headers[col+i]]=v;});
      }
    }
    if(state.delayBatch){state.delayBatch=false;state.delayed={id,book:b};throw Error('Google still processing');}
    state.books[id]=b;
    if(state.loseBatch){state.loseBatch=false;throw Error('Lost response AFTER commit');}
    return response({});
  }
  function response(value,status=200) { return { getResponseCode:()=>status, getContentText:()=>JSON.stringify(value),getBlob:()=>({getBytes:()=>[...(value.bytes||[])]}) }; }
  function fetch(url,opts={}) {
    if(opts.headers?.Authorization!=='Bearer qa-oauth')throw Error('Missing OAuth');
    state.calls.push({url,method:opts.method||'get'});
    const u=new URL(url);
    if(u.hostname==='sheets.googleapis.com')return batch(decodeURIComponent(u.pathname.split('/').pop().replace(':batchUpdate','')),JSON.parse(opts.payload));
    if(u.hostname!=='www.googleapis.com')throw Error('External network forbidden');
    if(u.pathname.endsWith('generateIds'))return response({ids:Array.from({length:Number(u.searchParams.get('count'))},()=>`reserved-${++state.ids}`)});
    const id=decodeURIComponent(u.pathname.split('/').pop());
    if(opts.method==='post') {
      let meta,bytes=Buffer.alloc(0);
      if(opts.contentType==='application/json')meta=JSON.parse(opts.payload);
      else {
        const data=Buffer.from(opts.payload),text=data.toString('latin1'),bound=opts.contentType.split('boundary=')[1];
        const start=text.indexOf('\r\n\r\n')+4,end=text.indexOf('\r\n--'+bound,start);
        meta=JSON.parse(data.subarray(start,end).toString());
        bytes=data.subarray(text.indexOf('\r\n\r\n',end+4)+4,text.lastIndexOf('\r\n--'+bound));
      }
      if(meta.mimeType==='application/vnd.google-apps.spreadsheet') {
        if(meta.id)throw Error('Pregenerated IDs forbidden for Google Workspace creation');
        meta.id='qa-sheet-'+(++state.ids);
        state.books[meta.id]={name:meta.name,tables:{Sheet1:{id:0,headers:[],rows:[],columns:26}}};
      }
      if(!meta.id)throw Error('Missing file id');
      if(state.files.has(meta.id))return response({},409);
      state.files.set(meta.id,{...meta,bytes,size:String(bytes.length),trashed:false});
      if(state.loseNativeCreate && meta.mimeType==='application/vnd.google-apps.spreadsheet'){state.loseNativeCreate=false;throw Error('Lost native spreadsheet reply');}
      if(state.loseFileCreate){state.loseFileCreate=false;throw Error('Lost Drive response');}
      return response({id:meta.id});
    }
    if(id==='files') {
      const q=u.searchParams.get('q')||'',parent=q.match(/^'([^']+)' in parents/)?.[1],marker=q.match(/key='maddySandbox' and value='([^']+)'/)?.[1];
      let files=[...state.files.values()].filter(f=>!f.trashed&&(!parent||f.parents?.includes(parent))&&(!marker||f.appProperties?.maddySandbox===marker));
      if(q.includes("mimeType='application/vnd.google-apps.spreadsheet'"))files=files.filter(f=>f.mimeType==='application/vnd.google-apps.spreadsheet');
      if(state.hideSearch)files=[];
      const offset=Number(u.searchParams.get('pageToken')||0),size=state.pageSize||100;
      return response({files:files.slice(offset,offset+size),...(files.length>offset+size?{nextPageToken:String(offset+size)}:{})});
    }
    const f=state.files.get(id);if(!f)return response({},404);
    if(opts.method==='patch') {
      if(!state.locked)throw Error('Trash without ScriptLock');
      if(id==='production-docs'||id===prod||id==='main-root')throw Error('Attempted production change');
      if(state.rejectTrash)return response({},503);
      Object.assign(f,JSON.parse(opts.payload));
      if(state.loseTrash){state.loseTrash=false;throw Error('Lost trash reply');}
    }
    return response(f);
  }
  const c=vm.createContext({console,Set,Map,Date,Buffer,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>state.props[k]||'',setProperty:(k,v)=>{state.props[k]=v;},deleteProperty:k=>{delete state.props[k];}})},
    SpreadsheetApp:{openById:book,flush(){}},
    LockService:{getScriptLock:()=>({tryLock:()=>{if(state.locked||state.busy)return false;state.locked=true;return true;},releaseLock:()=>{state.locked=false;}})},
    ScriptApp:{getOAuthToken:()=> 'qa-oauth'},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>s})},
    Logger:{log(){}},
    UrlFetchApp:{fetch},
    Utilities:{getUuid:randomUUID,DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_alg,v)=>[...Buffer.from(hash(v),'hex')],base64Decode:s=>[...Buffer.from(s,'base64')],base64Encode:v=>Buffer.from(v).toString('base64'),
      newBlob:v=>({getBytes:()=>[...Buffer.from(v)]}),
      formatDate:(d,_tz,p)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).formatToParts(d).find(x=>x.type===(p==='yyyy'?'year':'month')).value}
  });
  const first=['Config.gs','SheetHelpers.gs','Schema.gs'];
  for(const file of [...first,...readdirSync('apps-script').filter(x=>x.endsWith('.gs')&&!first.includes(x))])vm.runInContext(readFileSync('apps-script/'+file,'utf8'),c,{filename:file});
  for(const [name,h] of Object.entries(c.osSchemas_()))production.tables[name]={id:Object.keys(production.tables).length+1,headers:[...h],rows:[]};
  production.tables.Configuracion.rows.push({Clave:'MODO_OPERACION',Valor:'PREPARACION'});
  for(const s of ['MP','TP'])production.tables.Sedes.rows.push({Sede_ID:s,Nombre:s==='MP'?'Sede principal':'Sede norte',Estado:'ACTIVA',Prefijo_OP:s+'-OP',Prefijo_Cotizacion:s+'-COT',Prefijo_Recibo:s+'-RC',Prefijo_Remision:s+'-REM',Siguiente_OP:1,Siguiente_Cotizacion:1,Siguiente_Recibo:1,Siguiente_Remision:1});
  production.tables.Usuarios.rows.push({UID_Firebase:'qa-owner',Email:'owner@example.invalid',Nombre_Completo:'Propietario QA',Rol:'PROPIETARIO',Estado:'ACTIVO',Sedes_Permitidas:'MP,TP',Sede_Principal:'MP'});
  production.tables.Roles.rows.push({Rol:'PROPIETARIO',Activo:'SI',Protegido:'SI',Permisos_JSON:'["*"]'});
  production.tables.Sesiones.rows.push({Token_Hash:hash('qa-session'),UID_Firebase:'qa-owner',Estado:'ACTIVA',Expira_En:'2099-01-01T00:00:00Z',Ultima_Actividad:new Date().toISOString()});
  state.files.set(prod,{id:prod,name:production.name,mimeType:'application/vnd.google-apps.spreadsheet',parents:['system-root']});
  state.files.set('main-root',{id:'main-root',name:'MADERARTE APP',mimeType:'application/vnd.google-apps.folder',parents:[]});
  state.files.set('production-docs',{id:'production-docs',name:'02_DOCUMENTOS_CLIENTES',mimeType:'application/vnd.google-apps.folder',parents:['main-root']});
  const ctx={sessionToken:'qa-session',requestId:'TEST-OWNER-ORDER-0001',proxyMeta:{documentPipeline:true}};
  const command={schemaVersion:1,branch:'MP',client:clone(testClient),items:[{clientLineId:'1',description:'Mueble de prueba 1',category:'SALA',quantity:1,unitValue:2000000,fabric:'Tela sintética',wood:'Nogal',specifications:'2,10 x 0,88 m',agreement:'ENTREGA_HOY',fulfillment:'DISPONIBLE',photos:[{id:'foto1',name:'referencia.png',mime:'image/png',size:fixturePhoto.length,sha256:hash(fixturePhoto)}]},
    {clientLineId:'2',description:'Mueble de prueba 2',category:'COMEDOR',quantity:1,unitValue:1500000,fabric:'Lino de prueba',wood:'Champaña',specifications:'1,50 x 0,90 m',agreement:'ENTREGA_POSTERIOR',fulfillment:'PARA_SOLICITAR',photos:[]}],payments:[{clientPaymentId:'1',method:'TRANSFERENCIA',amount:500000,internalNote:'NOTA INTERNA NO IMPRIMIR'},{clientPaymentId:'2',method:'EFECTIVO',amount:200000,internalNote:'OTRA NOTA PRIVADA'}],discount:200000,noPayment:false,notes:'Ensayo sin cobro ni entrega.'};
  const start=()=>c.osStart_({confirm:'CREAR PRUEBA AISLADA'},ctx);
  const run=(action,payload={},requestId=ctx.requestId)=>c.osAdmit_(c.osState_().id,action,{...ctx,requestId},()=>c.routeAction_(action,payload,{...ctx,requestId,session:c.validateSessionToken_('qa-session',false)}));
  const rows=name=>state.books[c.osState_().sheetId].tables[name].rows;
  const clean=()=>c.osClean_({id:c.osState_().id,confirm:'LIMPIAR '+c.osState_().id},ctx);
  return {state,c,ctx,command,start,run,rows,clean,prod,production:()=>state.books[prod],photo:fixturePhoto,
    complete() {const saved=run('ORDEN_CREAR',command),number=saved.order.number; const slot=rows('Archivos_Orden').find(x=>x.Tipo==='FOTO');run('ORDEN_FOTO_GUARDAR',{number,id:slot.Archivo_ID,base64:fixturePhoto.toString('base64')});const plan=run('INTERNO_DOCUMENTO_PREPARAR',{number});run('INTERNO_DOCUMENTO_CONFIRMAR',{number,id:plan.id,planHash:plan.planHash,base64:Buffer.from('%PDF-1.4\nsynthetic transport only\n%%EOF').toString('base64')});return {number,plan};}
  };
}
