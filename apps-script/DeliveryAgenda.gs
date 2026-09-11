// Agenda is planning only. It never writes the dispatch or payment ledgers.
function agSession_(context, write) {
  var s = validateSessionToken_(context.sessionToken, false);
  requirePermission_(s, 'agenda.read');
  if (write) requirePermission_(s, 'agenda.update');
  return s;
}
function agDate_(value) {
  var date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)
    throw appError_('AGENDA_DATE', 'Selecciona una fecha válida.', 400);
  return date;
}
function agData_(row) {
  var data = parseJson_(row.Referencia_Notas, null);
  if (!data || data.contract !== 'delivery-1' || !Array.isArray(data.items) || !Number.isSafeInteger(data.revision))
    throw appError_('AGENDA_INTEGRITY', 'Esta programación requiere revisión.', 409);
  return data;
}
function agView_(row, lines) {
  var data = agData_(row);
  var items = data.items.map(function(p) {
    var line = lines.find(function(i) { return i.Item_ID === p.id && i.Numero_OP === row.Numero_OP; });
    var remaining = line ? Math.max(0, p.delivered + p.quantity - Number(line.Cantidad_Entregada || 0)) : p.quantity;
    return {id:p.id, description:p.description, quantity:p.quantity, remaining:remaining};
  });
  return {kind:'ENTREGA', title:'Entrega', id:row.ID, number:row.Numero_OP, client:row.Cliente, branch:row.Sede, date:String(row.Fecha).slice(0,10),time:String(row.Hora||''),
    status:row.Estado === 'CANCELADA' ? 'CANCELADA' : items.every(function(i){return i.remaining === 0;}) ? 'DESPACHADA' : 'PROGRAMADA',
    revision:data.revision, notes:data.notes, items:items, by:row.Responsable};
}
function agList_(payload, context) {
  var s = agSession_(context, false), lines = listRows_('Orden_Items');
  return {enabled:commercialWritesEnabled_() && hasPermission_(s.permissions,'agenda.update'), items:listRows_('Agenda').filter(function(r) {
    return ['ENTREGA_MADDY','COMPROMISO_MADDY'].includes(r.Categoria) && orderBranchReadable_(s,r.Sede) && (!payload.number || r.Numero_OP === payload.number);
  }).map(function(r) {return r.Categoria==='ENTREGA_MADDY'?agView_(r,lines):agTaskView_(r);}).sort(function(a,b) {return a.date.localeCompare(b.date)||a.time.localeCompare(b.time);})};
}
function agReplay_(id, s, hash) {
  var row = mdUnique_(listRows_('Idempotencia'),'Request_ID',id); if (!row) return null;
  if (row.Usuario !== s.profile.uid || row.Tipo_Operacion !== 'AGENDA_GUARDAR') throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var saved = parseJson_(row.Resultado_JSON,null);
  if (!saved || !saved.result || row.Estado !== 'CONFIRMADA') throw appError_('AGENDA_RECOVERY','El intento requiere revisión.',409);
  if(saved.result.branch){if(!orderBranchReadable_(s,saved.result.branch))throw appError_('PERMISSION_DENIED','No tienes acceso a esta sede.',403);}else rcOrder_(saved.result.number,s);
  if (hash && hash !== saved.fingerprint) throw appError_('REQUEST_CONTENT_CHANGED','Conserva los datos del intento original.',409);
  return saved.result;
}
function agStatus_(payload, context) {
  var result = agReplay_(orderRequestId_(payload.requestId),agSession_(context,true),'');
  return {saved:!!result,result:result};
}
function agSave_(payload, context) {
  if(payload.kind && payload.kind !== 'ENTREGA')return agTaskSave_(payload,context);
  if (!commercialWritesEnabled_() || getConfigValue_('MODO_OPERACION','') !== 'OPERACION') throw appError_('COMMERCIAL_WRITES_DISABLED','La agenda aún no admite cambios.',403);
  orderObject_(payload,['id','number','date','time','items','notes','revision','cancel','restore'],'agenda');
  var p = {id:orderText_(payload.id,'id',160,false),number:orderText_(payload.number,'number',120,true),date:agDate_(payload.date),time:String(payload.time||''),
    notes:orderText_(payload.notes,'notes',1000,false),revision:orderInteger_(payload.revision,'revision',0),cancel:payload.cancel === true,items:payload.items};
  if ((!p.cancel || p.time) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) throw appError_('AGENDA_TIME','Selecciona una hora válida.',400);
  if (!Array.isArray(p.items) || !p.items.length || p.items.length > 100) throw appError_('AGENDA_ITEMS','Selecciona los muebles de la entrega.',400);
  var seen = {};
  p.items = p.items.map(function(i) {
    orderObject_(i,['id','quantity','revision'],'item');
    var id=orderText_(i.id,'id',120,true);if(seen[id])throw appError_('AGENDA_ITEMS','El mueble está repetido.',400);seen[id]=true;
    return {id:id,quantity:orderInteger_(i.quantity,'quantity',1),revision:orderInteger_(i.revision,'revision',1)};
  });
  if(payload.restore===true)p.restore=true;
  var requestId=orderRequestId_(context.requestId),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro cambio guardándose. Reintenta este mismo registro.',503);
  try {
    var s=agSession_(context,true),hash=sha256_(JSON.stringify(p)),replay=agReplay_(requestId,s,hash);
    if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    requirePermission_(s,'ordenes.read');
    var order=rcOrder_(p.number,s),rows=listRows_('Agenda'),lines=listRows_('Orden_Items'),old=p.id?mdUnique_(rows,'ID',p.id):null;
    if(p.id && (!old || old.Numero_OP!==p.number || old.Categoria!=='ENTREGA_MADDY'))throw appError_('AGENDA_NOT_FOUND','No se encontró esta programación.',404);
    if(old && (agData_(old).revision!==p.revision || agView_(old,lines).status!==(p.restore?'CANCELADA':'PROGRAMADA')))throw appError_('AGENDA_CHANGED','La programación cambió. Actualiza antes de continuar.',409);
    if(!old && (p.revision!==0 || p.cancel || p.restore))throw appError_('AGENDA_CHANGED','La programación no existe.',409);
    if(!p.cancel && (!['CONFIRMADA','EN_PROCESO'].includes(order.Estado) || (!p.restore && p.date<Utilities.formatDate(now_(),MADERARTE_APP.TIMEZONE,'yyyy-MM-dd'))))throw appError_('AGENDA_DATE','Revisa la fecha y el estado de la OP.',409);
    if(p.restore && (p.cancel || p.date!==String(old.Fecha).slice(0,10) || p.time!==String(old.Hora||'')))throw appError_('AGENDA_CHANGED','Restaura la fecha original antes de reprogramar.',409);
    var planned = p.cancel ? agData_(old).items : p.items.map(function(i) {
      var line=mdUnique_(lines,'Item_ID',i.id);
      if(!line || line.Numero_OP!==p.number || line.Estado_Item==='ANULADO' || Number(line.Version)!==i.revision || i.quantity>Number(line.Cantidad_Pendiente))throw appError_('AGENDA_ITEM_CHANGED','Un mueble cambió. Actualiza sus cantidades.',409);
      var busy=rows.some(function(r){return r.ID!==p.id && r.Numero_OP===p.number && r.Categoria==='ENTREGA_MADDY' && r.Estado!=='CANCELADA' && agView_(r,lines).items.some(function(a){return a.id===i.id && a.remaining>0;});});
      if(busy)throw appError_('AGENDA_ALREADY_PLANNED','Este mueble ya tiene una entrega programada. Reprograma la existente.',409);
      return {id:i.id,description:String(line.Descripcion),quantity:i.quantity,delivered:Number(line.Cantidad_Entregada||0)};
    });
    var stamp=now_().toISOString(),id=p.id||requestId,revision=p.revision+1,uid=s.profile.uid;
    if(p.restore){var previous=agData_(old).items;if(planned.length!==previous.length || planned.some(function(i){var a=previous.find(function(x){return x.id===i.id;});return !a || a.quantity!==i.quantity || a.delivered!==i.delivered;}))throw appError_('AGENDA_ITEM_CHANGED','Los muebles cambiaron después de cancelar. Crea una nueva programación.',409);}
    var data={contract:'delivery-1',revision:revision,notes:p.notes,items:planned};
    var row={ID:id,Fecha:p.date,Hora:p.time,Categoria:'ENTREGA_MADDY',Titulo:'Entrega',Cliente:order.Nombre_Cliente,Numero_OP:p.number,Sede:order.Sede,Referencia_Notas:JSON.stringify(data),Estado:p.cancel?'CANCELADA':'PROGRAMADA',Responsable:s.profile.name||uid,Fecha_Registro:old?old.Fecha_Registro:stamp};
    var result={requestId:requestId,id:id,number:p.number,date:p.date,time:p.time,revision:revision,status:row.Estado};
    var requests=old?orderUpdateRequests_('Agenda',old._row,row):[orderAppendRequest_('Agenda',[row])];
    requests.push(orderAppendRequest_('Auditoria',[{ID:requestId+'-AUD',Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'AGENDA',Accion:p.cancel?'CANCELAR':p.restore?'RESTAURAR':old?'REPROGRAMAR':'PROGRAMAR',Entidad:'AGENDA',Entidad_ID:id,Resumen:'Programación de entrega',Estado:'CONFIRMADA',Request_ID:requestId,Antes_JSON:JSON.stringify(old||{}),Despues_JSON:JSON.stringify(row),Reversible:'NO',Motivo_No_Reversible:'Los cambios conservan auditoría.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:requestId,Fecha:stamp,Tipo_Operacion:'AGENDA_GUARDAR',Entidad:'AGENDA',Entidad_ID:id,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(requestId,uid,hash,'AGENDA_GUARDAR');
    try{orderAtomicBatch_(requests);}catch(e){throw appError_('AGENDA_SAVE_UNCERTAIN','No se pudo confirmar el guardado. Consulta este mismo intento antes de repetirlo.',503);}
    clearConfirmedOrderFence_();return {saved:true,result:result};
  } finally {lock.releaseLock();}
}


// Independent operational reminders: no cash movements or delivery quantities.
function agTaskData_(row) {
  var d=parseJson_(row.Referencia_Notas,null);
  if(!d || d.contract!=='task-1' || !Number.isSafeInteger(d.revision))throw appError_('AGENDA_INTEGRITY','Este compromiso requiere revisión.',409);
  return d;
}
function agTaskView_(row) {
  var d=agTaskData_(row);
  return {id:row.ID,kind:d.kind,title:row.Titulo,client:row.Cliente,number:row.Numero_OP,branch:row.Sede,date:String(row.Fecha).slice(0,10),time:String(row.Hora||''),status:row.Estado,revision:d.revision,notes:d.notes,amount:d.amount,contact:d.contact,assignee:d.assignee,series:d.series||'',items:[],by:row.Responsable};
}
function agMonthDate_(date,offset) {
  var parts=date.split('-').map(Number),last=new Date(Date.UTC(parts[0],parts[1]+offset,0)).getUTCDate();
  return new Date(Date.UTC(parts[0],parts[1]-1+offset,Math.min(parts[2],last))).toISOString().slice(0,10);
}
function agTaskSave_(payload,context) {
  if(!commercialWritesEnabled_() || getConfigValue_('MODO_OPERACION','')!=='OPERACION')throw appError_('COMMERCIAL_WRITES_DISABLED','La agenda aún no admite cambios.',403);
  orderObject_(payload,['kind','id','revision','operation','title','contact','assignee','branch','number','date','time','notes','amount','repeat'],'compromiso');
  var p={kind:orderText_(payload.kind,'kind',24,true),id:orderText_(payload.id,'id',160,false),revision:orderInteger_(payload.revision,'revision',0),operation:orderText_(payload.operation||'save','operation',20,true)};
  if(!['PROVEEDOR','IMPUESTO','SERVICIO','GARANTIA'].includes(p.kind) || !['save','cancel','restore','complete','reopen'].includes(p.operation))throw appError_('AGENDA_TYPE','Revisa el tipo de compromiso y la acción.',400);
  if(p.operation==='save') {
    p.title=orderText_(payload.title,'title',160,true);p.contact=orderText_(payload.contact,'contact',160,false);p.assignee=orderText_(payload.assignee,'assignee',120,false);
    p.branch=orderText_(payload.branch,'branch',16,true);p.number=orderText_(payload.number,'number',120,false);p.date=agDate_(payload.date);p.time=String(payload.time||'');p.notes=orderText_(payload.notes,'notes',1000,false);
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))throw appError_('AGENDA_TIME','Selecciona una hora válida.',400);
    p.amount=payload.amount===null || payload.amount==='' || payload.amount===undefined?null:orderInteger_(payload.amount,'amount',1);
    p.repeat=orderInteger_(payload.repeat||1,'repeat',1);
    if(p.repeat>12 || (p.id && p.repeat!==1) || (p.kind==='GARANTIA' && p.repeat!==1))throw appError_('AGENDA_REPEAT','La repetición admite hasta 12 fechas para obligaciones nuevas.',400);
  } else if(!p.id)throw appError_('AGENDA_NOT_FOUND','Selecciona un compromiso existente.',404);
  var requestId=orderRequestId_(context.requestId),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro cambio guardándose. Reintenta este mismo registro.',503);
  try {
    var s=agSession_(context,true),hash=sha256_(JSON.stringify(p)),replay=agReplay_(requestId,s,hash);
    if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var old=p.id?mdUnique_(listRows_('Agenda'),'ID',p.id):null;
    if(p.id && (!old || old.Categoria!=='COMPROMISO_MADDY'))throw appError_('AGENDA_NOT_FOUND','No se encontró este compromiso.',404);
    if(old && !orderBranchReadable_(s,old.Sede))throw appError_('PERMISSION_DENIED','No tienes acceso a esta sede.',403);
    var previous=old?agTaskData_(old):null;
    if(old && (previous.revision!==p.revision || previous.kind!==p.kind))throw appError_('AGENDA_CHANGED','El compromiso cambió. Actualiza antes de continuar.',409);
    if(!old && p.revision!==0)throw appError_('AGENDA_CHANGED','El compromiso no existe.',409);
    var expected={save:'PROGRAMADA',cancel:'PROGRAMADA',complete:'PROGRAMADA',restore:'CANCELADA',reopen:'COMPLETADA'};
    if(old && old.Estado!==expected[p.operation])throw appError_('AGENDA_CHANGED','El estado cambió. Actualiza la agenda.',409);
    var today=Utilities.formatDate(now_(),MADERARTE_APP.TIMEZONE,'yyyy-MM-dd');
    if(p.operation==='save') {
      if(!['MP','TP'].includes(p.branch) || !orderBranchReadable_(s,p.branch))throw appError_('PERMISSION_DENIED','No tienes acceso a esta sede.',403);
      if(old && old.Sede!==p.branch)throw appError_('AGENDA_BRANCH','No cambies la sede de un compromiso existente.',409);
      if(p.date<today && (!old || p.date!==String(old.Fecha).slice(0,10)))throw appError_('AGENDA_DATE','Selecciona una fecha de hoy en adelante.',400);
      if(p.number){requirePermission_(s,'ordenes.read');var order=rcOrder_(p.number,s);if(order.Sede!==p.branch)throw appError_('AGENDA_BRANCH','La OP pertenece a otra sede.',409);}
    }
    var uid=s.profile.uid,stamp=now_().toISOString(),requests=[],dates=[],id=p.id||requestId,revision=p.revision+1;
    var count=p.operation==='save'?p.repeat:1;
    for(var n=0;n<count;n++) {
      var row;
      if(p.operation==='save') {
        var data={contract:'task-1',kind:p.kind,revision:revision,contact:p.contact,assignee:p.assignee,amount:p.amount,notes:p.notes,series:previous?previous.series:(count>1?requestId:'')};
        row={ID:n?id+'-'+n:id,Fecha:agMonthDate_(p.date,n),Hora:p.time,Categoria:'COMPROMISO_MADDY',Titulo:p.title,Cliente:p.contact,Numero_OP:p.number,Sede:p.branch,Referencia_Notas:JSON.stringify(data),Estado:'PROGRAMADA',Responsable:s.profile.name||uid,Fecha_Registro:old?old.Fecha_Registro:stamp};
      } else {
        row={};Object.keys(old).forEach(function(k){if(k!=='_row')row[k]=old[k];});previous.revision=revision;row.Referencia_Notas=JSON.stringify(previous);
        row.Estado=p.operation==='cancel'?'CANCELADA':p.operation==='complete'?'COMPLETADA':'PROGRAMADA';
      }
      requests=requests.concat(old?orderUpdateRequests_('Agenda',old._row,row):[orderAppendRequest_('Agenda',[row])]);dates.push(row.Fecha);
      requests.push(orderAppendRequest_('Auditoria',[{ID:requestId+'-AUD-'+n,Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'AGENDA',Accion:p.operation.toUpperCase(),Entidad:'AGENDA',Entidad_ID:row.ID,Resumen:'Compromiso de agenda',Estado:'CONFIRMADA',Request_ID:requestId,Antes_JSON:JSON.stringify(old||{}),Despues_JSON:JSON.stringify(row),Reversible:'SI',Motivo_No_Reversible:''}]));
    }
    var result={requestId:requestId,id:id,number:row.Numero_OP,branch:row.Sede,date:dates[0],time:row.Hora,revision:revision,status:row.Estado,count:count};
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:requestId,Fecha:stamp,Tipo_Operacion:'AGENDA_GUARDAR',Entidad:'AGENDA',Entidad_ID:id,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(requestId,uid,hash,'AGENDA_GUARDAR');
    try{orderAtomicBatch_(requests);}catch(e){throw appError_('AGENDA_SAVE_UNCERTAIN','No se pudo confirmar el guardado. Consulta este intento antes de repetirlo.',503);}
    clearConfirmedOrderFence_();return {saved:true,result:result};
  } finally {lock.releaseLock();}
}

