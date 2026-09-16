import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

// Synthetic in-memory Drive/Sheets, including lost replies and pagination.
const source = readFileSync(new URL('../apps-script/DataBackups.gs', import.meta.url), 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const folder = 'application/vnd.google-apps.folder', sheet = 'application/vnd.google-apps.spreadsheet';
  const files = new Map(), props = new Map(), calls = [], locks = {script:false,user:false};
  let serial = 0;
  const state = {day:'2030-01-02',hour:3,failCopy:false,corruptCopy:false,free:1e10,documentPending:false,fence:false};
  const add = (id,name,mimeType,parents=[],extra={}) => files.set(id,{id,name,mimeType,parents,trashed:false,shared:false,permissions:[{type:'user',role:'owner'}],...extra});
  add('root','MADERARTE APP',folder); add('system','00_SISTEMA',folder,['root']);
  add('documents','02_DOCUMENTOS_CLIENTES',folder,['root']); add('backups','04_BACKUPS',folder,['root']);
  add('year','2030',folder,['documents']); add('client','Cliente sintético',folder,['year']);
  add('pdf','OP-sintetica.pdf','application/pdf',['client'],{size:'123',md5Checksum:'synthetic-pdf-hash'});
  add('photo','referencia.png','image/png',['client'],{size:'321',md5Checksum:'synthetic-image-hash'});
  add('base','Base de Datos Maderarte App',sheet,['system'],{sheetData:{
    properties:{locale:'es_CO',timeZone:'America/Bogota'},
    sheets:[{properties:{sheetId:0,title:'Documentos',index:0,gridProperties:{rowCount:100,columnCount:3}}},{properties:{sheetId:1,title:'Sedes',index:1,gridProperties:{rowCount:100,columnCount:3}}}],
    values:[[['File_ID','URL','Parent_ID'],['pdf','https://drive.google.com/file/d/pdf/view','client'],['photo','','client']],[['Sede','Siguiente_OP'],['MP',1]]]
  }});
  const original = JSON.stringify([...files.values()]);
  function api(path,options={}) {
    const url = new URL('https://www.googleapis.com/'+path),method = options.method||'get';
    const body = options.payload ? JSON.parse(options.payload) : null;
    calls.push({path:url.pathname,method,body});
    let result;
    if (url.pathname === '/drive/v3/about') result = {storageQuota:{limit:String(state.free+100),usage:'100'}};
    else if (url.pathname.startsWith('/sheets/v4/spreadsheets/')) {
      assert.equal(method,'get','Backup must never write a spreadsheet');
      const id=url.pathname.split('/')[4], data=files.get(id).sheetData;
      result=url.pathname.endsWith('/values:batchGet') ? {valueRanges:data.values.map(values=>({values}))} : {properties:data.properties,sheets:data.sheets};
    } else if (url.pathname.startsWith('/upload/drive/v3/files/')) {
      const f=files.get(url.pathname.split('/').at(-1)); assert.notEqual(f.id,'base'); f.media=clone(body); result={};
    } else if (url.pathname === '/drive/v3/files' && method === 'get') {
      const q=url.searchParams.get('q'), parent=q.match(/^'([^']+)' in parents/)[1], key=q.match(/value='([^']+)'/);
      let matches=[...files.values()].filter(f=>!f.trashed&&f.parents.includes(parent)&&(!key||f.appProperties?.maddyBackupKey===key[1]));
      // One entry per page exercises the cursor and directory queues.
      const index=Number(url.searchParams.get('pageToken')||0), page=key ? 100 : 1;
      result={files:matches.slice(index,index+page)}; if(index+page<matches.length) result.nextPageToken=String(index+page);
    } else if (url.pathname === '/drive/v3/files' && method === 'post') {
      const id='copy-'+(++serial); add(id,body.name,body.mimeType,body.parents,{appProperties:body.appProperties}); result=files.get(id);
    } else if (/\/drive\/v3\/files\/[^/]+\/copy$/.test(url.pathname)) {
      const id=url.pathname.split('/').at(-2), origin=files.get(id), copyId='copy-'+(++serial);
      assert(origin,'Copy source must exist'); assert(body.parents.every(p=>p!=='root'&&p!=='documents'&&p!=='system'&&p!=='client'),'No writes to original folders');
      files.set(copyId,{...clone(origin),...body,id:copyId}); result=files.get(copyId);
      if(state.corruptCopy&&origin.sheetData) result.sheetData.values[1][1][1]=999;
      if(state.failCopy){state.failCopy=false;throw new Error('Synthetic lost copy reply');}
    } else if (/\/drive\/v3\/files\/[^/]+$/.test(url.pathname) && method==='get') {
      const f=files.get(url.pathname.split('/').at(-1)); assert(f,'File must exist');
      result=url.searchParams.get('alt')==='media'?f.media:f;
    } else throw new Error('Unexpected request: '+method+' '+path);
    return {getContentText:()=>JSON.stringify(clone(result))};
  }
  const c=vm.createContext({console,Date,Logger:{log(){}},MADERARTE_APP:{TIMEZONE:'America/Bogota',SPREADSHEET_NAME:'Base de Datos Maderarte App'},
    appError_:(code,message)=>Object.assign(new Error(message),{appCode:code}),
    sha256_:v=>createHash('sha256').update(v).digest('hex'),mdDrive_:api,
    ScriptApp:{getOAuthToken:()=> 'synthetic-token'},UrlFetchApp:{fetch:(url,options)=>{
      assert(url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/'));
      assert.equal(options.method,'get');assert.equal(options.headers.Authorization,'Bearer synthetic-token');
      return {...api('sheets/'+url.slice('https://sheets.googleapis.com/'.length),options),getResponseCode:()=>200};
    }},
    getScriptProperties_:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)}),
    requiredProperty_:k=>({SPREADSHEET_ID:'base',DRIVE_DOCUMENTS_ROOT_ID:'documents'})[k],
    osActive_:()=>false,readOrderFence_:()=>state.fence,listRows_:()=>state.documentPending?[{Estado:'PENDIENTE'}]:[],
    Utilities:{formatDate:(_d,_tz,pattern)=>pattern==='H'?String(state.hour):state.day},
    LockService:Object.fromEntries(['script','user'].map(name=>['get'+name[0].toUpperCase()+name.slice(1)+'Lock',()=>({tryLock:()=>{if(locks[name])return false;locks[name]=true;return true;},releaseLock:()=>{locks[name]=false;}})]))
  });
  vm.runInContext(source,c);
  return {c,state,files,props,calls,locks,original,unchanged:()=>assert.equal(JSON.stringify([...files.values()].filter(f=>!f.id.startsWith('copy-'))),original)};
}
let checks=0;
function test(label,fn){fn();checks++;console.log('PASS '+label);}
const throws=(fn,code)=>assert.throws(fn,e=>e.appCode===code);
test('Full copy, all pages, hashes, sheet content, idempotence and isolated recovery',()=>{
  const f=fixture(), result=f.c.respaldarMaddy(); assert.equal(result.stage,'VERIFICADO'); assert.equal(result.documents,2); assert.equal(result.sheets,2);
  const count=f.files.size;f.c.respaldarMaddy();assert.equal(f.files.size,count);
  const restored=f.c.ensayarRecuperacionMaddy(); assert.equal(restored.stage,'VERIFICADO');assert.equal(restored.documents,2);
  const count2=f.files.size;f.c.ensayarRecuperacionMaddy();assert.equal(f.files.size,count2);
  f.unchanged();assert.equal(f.locks.script,false);assert.equal(f.locks.user,false);
});
test('New date reuses unchanged PDF/image versions and takes another sheet snapshot',()=>{
  const f=fixture();f.c.respaldarMaddy();const pool=f.files.size;
  f.state.day='2030-01-03';f.c.respaldarMaddy();assert.equal(f.files.size,pool+3);
  assert.equal(f.calls.filter(x=>x.path==='/drive/v3/files/pdf/copy').length,1);f.unchanged();
});
test('Changed binary content creates a new immutable version',()=>{
  const f=fixture();f.c.respaldarMaddy();f.files.get('pdf').md5Checksum='revised-content';f.state.day='2030-01-03';f.c.respaldarMaddy();
  assert.equal(f.calls.filter(x=>x.path==='/drive/v3/files/pdf/copy').length,2);
});
test('A lost sheet-copy reply resumes using the existing copy',()=>{
  const f=fixture();f.state.failCopy=true;assert.throws(()=>f.c.respaldarMaddy(),/lost copy reply/);
  assert(!f.props.has(f.c.BK_LAST_));assert.equal(f.c.respaldarMaddy().stage,'VERIFICADO');
  assert.equal(f.calls.filter(x=>x.path==='/drive/v3/files/base/copy').length,1);f.unchanged();
});
test('Corrupt sheet never verified; next day can begin a new attempt',()=>{
  const f=fixture();f.state.corruptCopy=true;throws(()=>f.c.respaldarMaddy(),'BACKUP_SHEET_CHANGED');assert(!f.props.has(f.c.BK_LAST_));
  assert.equal(f.c.bkLoad_(f.c.BK_CURRENT_,false).phase,'FALLIDO');f.state.corruptCopy=false;f.state.day='2030-01-03';assert.equal(f.c.respaldarMaddy().stage,'VERIFICADO');
});
test('Public destination fails before making any copy',()=>{
  const f=fixture();f.files.get('backups').shared=true;throws(()=>f.c.respaldarMaddy(),'BACKUP_DESTINATION_NOT_PRIVATE');assert.equal(f.files.size,9);
});
test('Pending transaction and unfinished document do not produce a snapshot',()=>{
  for(const key of ['fence','documentPending']){const f=fixture();f.state[key]=true;assert.throws(()=>f.c.respaldarMaddy());assert(!f.props.has(f.c.BK_LAST_));assert(!f.calls.some(x=>x.path.endsWith('/base/copy')));f.unchanged();}
});
test('Low Drive space leaves copy pending and resumes after space is available',()=>{
  const f=fixture();f.state.free=10;throws(()=>f.c.respaldarMaddy(),'BACKUP_LOW_STORAGE');assert(!f.props.has(f.c.BK_LAST_));f.state.free=1e10;assert.equal(f.c.respaldarMaddy().stage,'VERIFICADO');
});
test('Unsupported native document is not silently omitted',()=>{
  const f=fixture();delete f.files.get('photo').md5Checksum;throws(()=>f.c.respaldarMaddy(),'BACKUP_UNSUPPORTED_DOCUMENT');assert(!f.props.has(f.c.BK_LAST_));
});
test('Missing file referenced in sheet prevents verified status',()=>{
  const f=fixture();f.files.get('base').sheetData.values[0].push(['missing-file','','']);throws(()=>f.c.respaldarMaddy(),'BACKUP_REFERENCE_NOT_BACKED_UP');assert(!f.props.has(f.c.BK_LAST_));
});
test('Stored manifest modification cannot replace trusted verified pointer',()=>{
  const f=fixture();f.c.respaldarMaddy();const p=JSON.parse(f.props.get(f.c.BK_LAST_));f.files.get(p.manifestId).media.entries=[];
  throws(()=>f.c.respaldarMaddy(),'BACKUP_VERIFIED_MANIFEST_CHANGED');throws(()=>f.c.ensayarRecuperacionMaddy(),'BACKUP_VERIFIED_MANIFEST_CHANGED');
});
test('Recovery uses backed up versions even if originals are gone',()=>{
  const f=fixture();f.c.respaldarMaddy();f.files.delete('pdf');f.files.delete('photo');assert.equal(f.c.ensayarRecuperacionMaddy().stage,'VERIFICADO');
});
test('Corrupt stored PDF rejects recovery',()=>{
  const f=fixture();f.c.respaldarMaddy();const s=f.c.bkLoad_(f.c.BK_LAST_,true),e=s.entries.find(e=>e.sourceId==='pdf');f.files.get(e.copyId).md5Checksum='corrupted';throws(()=>f.c.ensayarRecuperacionMaddy(),'BACKUP_RESTORE_DOCUMENT_MISMATCH');
});
test('Document batches do not hold commercial lock and preserve interrupted progress',()=>{
  const f=fixture(),original=f.c.bkDocuments_;let interrupted=false;
  f.c.bkDocuments_=(s,deadline)=>{assert.equal(f.locks.script,false);original(s,0);interrupted=true;};
  assert.equal(f.c.respaldarMaddy().stage,'DOCUMENTOS');assert(interrupted);assert(!f.props.has(f.c.BK_LAST_));
  f.c.bkDocuments_=original;assert.equal(f.c.respaldarMaddy().stage,'VERIFICADO');f.unchanged();
});
test('Hourly invocation waits until 02:00 Colombia to start',()=>{
  const f=fixture();f.state.hour=1;assert.equal(f.c.respaldarMaddy({triggerUid:'synthetic'}).stage,'ESPERANDO_HORA');assert.equal(f.files.size,9);
});
assert(!/ScriptApp\.newTrigger|DriveApp|deleteFile|removeFile|setTrashed|batchUpdate/.test(source));
assert(!readFileSync(new URL('../apps-script/Router.gs',import.meta.url),'utf8').includes('respaldarMaddy'));
console.log(`${checks} backup/recovery scenarios passed; synthetic data only.`);
