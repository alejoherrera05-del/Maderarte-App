// Recorded customer receipts and cash handover. Never a second income entry.
var COLLECTION_HEADERS_=['ID','Numero_Recibo','Numero_OP','Sede','Valor','Fecha_Pago','Registrado_Por','Recibido_Por','Nombre_Receptor','Fecha_Recepcion','Request_ID'];
function colSession_(context){
  var s=validateSessionToken_(context.sessionToken,false);
  requirePermission_(s,'ordenes.read');requirePermission_(s,'abonos.read');
  if(!['PROPIETARIO','ADMINISTRADOR'].includes(s.profile.role))throw appError_('PERMISSION_DENIED','El control de recaudos corresponde a administración.',403);
  return s;
}
function colSheet_(create){
  var book=getSpreadsheet_(),sheet=book.getSheetByName('Recepciones_Efectivo');
  if(!sheet&&create){sheet=book.insertSheet('Recepciones_Efectivo');sheet.getRange(1,1,1,COLLECTION_HEADERS_.length).setValues([COLLECTION_HEADERS_]);SpreadsheetApp.flush();}
  if(sheet){var h=getHeaders_(sheet);if(h.join('|')!==COLLECTION_HEADERS_.join('|'))throw appError_('COLLECTION_SCHEMA','El registro de recepción de efectivo requiere revisión.',503);}
  return sheet;
}
function colRows_(){return colSheet_(false)?listRows_('Recepciones_Efectivo'):[];}
function colAmount_(v){var n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw appError_('COLLECTION_INTEGRITY','Hay un recibo cuyo importe requiere revisión.',409);return n;}
function colPayments_(s){
  var seen={},orders={};listRows_('Ordenes_Pedido').forEach(function(o){orders[o.Numero_OP]=o;});
  return listRows_('Abonos').filter(function(p){return p.Estado_Registro==='ACTIVO'&&p.Afecta_Saldo==='SI'&&orderBranchReadable_(s,p.Sede);}).map(function(p){
    if(!p.Numero_Recibo||seen[p.Numero_Recibo]||!orders[p.Numero_OP]||orders[p.Numero_OP].Sede!==p.Sede)throw appError_('COLLECTION_INTEGRITY','Hay un recibo que requiere revisión de su OP o sede.',409);
    seen[p.Numero_Recibo]=true;colAmount_(p.Valor_Abono);return p;
  });
}
function colList_(payload,context){
  var s=colSession_(context),from=agDate_(payload.from),to=agDate_(payload.to),branch=String(payload.branch||'');
  if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw appError_('COLLECTION_RANGE','Selecciona un periodo de hasta un año.',400);
  if(branch&&!orderBranchReadable_(s,branch))throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a esta sede.',403);
  var lock=osOperationLock_();if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay un movimiento guardándose. Actualiza en un momento.',503);
  try{
    assertNoUnresolvedOrderFence_();var handed={},people={},total=0,cash=0,received=0,methods={},branches={};
    colRows_().forEach(function(r){if(!orderBranchReadable_(s,r.Sede))return;if(handed[r.Numero_Recibo])throw appError_('COLLECTION_INTEGRITY','Hay una recepción duplicada que requiere revisión.',409);handed[r.Numero_Recibo]=r;});
    listRows_('Usuarios').forEach(function(u){people[u.UID_Firebase]=u.Nombre_Completo;});
    var items=colPayments_(s).filter(function(p){if(branch&&p.Sede!==branch)return false;var date=Utilities.formatDate(new Date(p.Fecha_Pago),MADERARTE_APP.TIMEZONE,'yyyy-MM-dd');return date>=from&&date<=to;}).map(function(p){
      var amount=colAmount_(p.Valor_Abono),method=normalizeCode_(p.Medio_Pago)||'SIN_MEDIO',h=handed[p.Numero_Recibo];
      if(h&&(Number(h.Valor)!==amount||h.Sede!==p.Sede||h.Numero_OP!==p.Numero_OP||method!=='EFECTIVO'))throw appError_('COLLECTION_INTEGRITY','El recibo cambió después de su recepción. Revisa el registro.',409);
      total+=amount;methods[method]=(methods[method]||0)+amount;branches[p.Sede]=(branches[p.Sede]||0)+amount;
      if(method==='EFECTIVO'){cash+=amount;if(h)received+=amount;}
      return {number:p.Numero_Recibo,orderNumber:p.Numero_OP,branch:p.Sede,client:p.Nombre_Cliente,date:valueDateIso_(p.Fecha_Pago),amount:amount,method:method,registeredBy:people[p.Registrado_Por]||'Usuario registrado',handover:h?{by:h.Nombre_Receptor,date:valueDateIso_(h.Fecha_Recepcion)}:null};
    }).sort(function(a,b){return b.date.localeCompare(a.date)||a.number.localeCompare(b.number);});
    if(![total,cash,received].every(Number.isSafeInteger))throw appError_('COLLECTION_INTEGRITY','El total excede el rango permitido.',409);
    return {from:from,to:to,branch:branch,total:total,cash:cash,received:received,pending:cash-received,methods:methods,branches:branches,items:items,asOf:now_().toISOString(),enabled:commercialWritesEnabled_()&&getConfigValue_('MODO_OPERACION','')==='OPERACION'};
  }finally{lock.releaseLock();}
}
function colReplay_(id,s,hash){
  var r=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!r)return null;
  if(r.Usuario!==s.profile.uid||r.Tipo_Operacion!=='RECAUDO_RECIBIR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var d=parseJson_(r.Resultado_JSON,null);if(r.Estado!=='CONFIRMADA'||!d||!d.result)throw appError_('COLLECTION_RECOVERY','El intento requiere revisión.',409);
  if(hash&&hash!==d.fingerprint)throw appError_('REQUEST_CONTENT_CHANGED','Conserva la selección del intento original.',409);
  d.result.branches.forEach(function(b){if(!orderBranchReadable_(s,b))throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a la sede.',403);});return d.result;
}
function colStatus_(p,context){var s=colSession_(context),r=colReplay_(orderRequestId_(p.requestId),s,'');return {saved:!!r,result:r};}
function colReceive_(p,context){
  var s=colSession_(context);if(!commercialWritesEnabled_()||getConfigValue_('MODO_OPERACION','')!=='OPERACION')throw appError_('COMMERCIAL_WRITES_DISABLED','La recepción no está habilitada.',403);
  orderObject_(p,['receipts','expectedTotal','physicalCheck'],'recaudo');
  if(p.physicalCheck!==true||!Array.isArray(p.receipts)||!p.receipts.length||p.receipts.length>100)throw appError_('COLLECTION_SELECTION','Confirma de 1 a 100 recibos de efectivo.',400);
  var ids=p.receipts.map(function(n){return orderText_(n,'receipt',120,true);}).sort();if(new Set(ids).size!==ids.length)throw appError_('COLLECTION_SELECTION','Hay recibos repetidos.',400);
  var total=colAmount_(p.expectedTotal),hash=sha256_(JSON.stringify([ids,total])),id=orderRequestId_(context.requestId),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otra recepción guardándose. Reintenta el mismo registro.',503);
  try{
    var replay=colReplay_(id,s,hash);if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var ledger=colPayments_(s),received=colRows_(),sum=0,stamp=now_().toISOString();
    var rows=ids.map(function(n,index){var a=mdUnique_(ledger,'Numero_Recibo',n);if(!a||normalizeCode_(a.Medio_Pago)!=='EFECTIVO')throw appError_('COLLECTION_SELECTION','Selecciona recibos de efectivo de tus sedes.',409);
      if(received.some(function(r){return r.Numero_Recibo===n;}))throw appError_('COLLECTION_ALREADY_RECEIVED','Otro responsable ya recibió uno de los recibos. Actualiza la lista.',409);
      sum+=colAmount_(a.Valor_Abono);return {ID:id+'-'+index,Numero_Recibo:n,Numero_OP:a.Numero_OP,Sede:a.Sede,Valor:Number(a.Valor_Abono),Fecha_Pago:valueDateIso_(a.Fecha_Pago),Registrado_Por:a.Registrado_Por,Recibido_Por:s.profile.uid,Nombre_Receptor:s.profile.name,Fecha_Recepcion:stamp,Request_ID:id};});
    if(sum!==total)throw appError_('COLLECTION_CHANGED','El importe cambió. Actualiza antes de recibir.',409);
    colSheet_(true);var result={id:id,total:sum,count:rows.length,date:stamp,by:s.profile.name,branches:Array.from(new Set(rows.map(function(r){return r.Sede;})))};
    var requests=[orderAppendRequest_('Recepciones_Efectivo',rows),orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:s.profile.uid,Rol:s.profile.role,Modulo:'RECAUDOS',Accion:'RECIBIR_EFECTIVO',Entidad:'RECEPCION_EFECTIVO',Entidad_ID:id,Resumen:'Efectivo recibido: '+rows.length+' recibos',Estado:'CONFIRMADA',Request_ID:id,Despues_JSON:JSON.stringify(rows),Reversible:'NO',Motivo_No_Reversible:'Conserva constancia de recepción.'}]),orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'RECAUDO_RECIBIR',Entidad:'RECEPCION_EFECTIVO',Entidad_ID:id,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:s.profile.uid}])];
    SpreadsheetApp.flush();reserveOrderFence_(id,s.profile.uid,hash,'RECAUDO_RECIBIR');try{orderAtomicBatch_(requests);}catch(e){throw appError_('COLLECTION_SAVE_UNCERTAIN','Falta confirmar la recepción. Consulta el mismo intento.',503);}clearConfirmedOrderFence_();return {saved:true,result:result};
  }finally{lock.releaseLock();}
}
