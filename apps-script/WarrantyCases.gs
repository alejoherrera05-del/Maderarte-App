// Physical custody and repair cases. Calendar appointments remain independent.
// Agenda stores associated operational tasks under a separate, versioned contract.
function wcSession_(context, write) {
  var s=agSession_(context,write);requirePermission_(s,'ordenes.read');return s;
}
function wcData_(row) {
  var d=parseJson_(row.Referencia_Notas,null);
  if(!d || d.contract!=='warranty-1' || !Number.isSafeInteger(d.revision) || !Array.isArray(d.events))throw appError_('WARRANTY_INTEGRITY','Este expediente requiere revisión.',409);
  return d;
}
function wcView_(r) {
  var d=wcData_(r);return Object.assign({},d,{id:r.ID,number:r.Numero_OP,client:r.Cliente,branch:r.Sede,status:r.Estado,created:r.Fecha_Registro});
}
function wcList_(payload,context) {
  var s=wcSession_(context,false),number=orderText_(payload.number,'number',120,false);
  if(number)rcOrder_(number,s);
  return {enabled:commercialWritesEnabled_()&&getConfigValue_('MODO_OPERACION','')==='OPERACION'&&hasPermission_(s.permissions,'agenda.update'),items:listRows_('Agenda').filter(function(r){return r.Categoria==='GARANTIA_EXPEDIENTE'&&orderBranchReadable_(s,r.Sede)&&(!number||r.Numero_OP===number);}).map(wcView_).sort(function(a,b){return b.updated.localeCompare(a.updated);})};
}
function wcReplay_(id,s,hash) {
  var row=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!row)return null;
  if(row.Usuario!==s.profile.uid||row.Tipo_Operacion!=='GARANTIA_GUARDAR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var saved=parseJson_(row.Resultado_JSON,null);
  if(row.Estado!=='CONFIRMADA'||!saved||!saved.result)throw appError_('WARRANTY_RECOVERY','El intento requiere revisión.',409);
  rcOrder_(saved.result.number,s);
  if(hash&&hash!==saved.fingerprint)throw appError_('REQUEST_CONTENT_CHANGED','Conserva los datos del intento original.',409);
  return saved.result;
}
function wcStatus_(payload,context) {
  var result=wcReplay_(orderRequestId_(payload.requestId),wcSession_(context,true),'');return {saved:!!result,result:result};
}
function wcSave_(payload,context) {
  if(!commercialWritesEnabled_()||getConfigValue_('MODO_OPERACION','')!=='OPERACION')throw appError_('COMMERCIAL_WRITES_DISABLED','No se admiten cambios por ahora.',403);
  orderObject_(payload,['id','revision','operation','number','itemId','piece','quantity','source','condition','issue','assignee','notes','recipient','physicalCheck'],'garantia');
  var p={id:orderText_(payload.id,'id',160,false),revision:orderInteger_(payload.revision,'revision',0),operation:orderText_(payload.operation,'operation',24,true),notes:orderText_(payload.notes,'notes',1000,false)};
  if(!['report','receive','home','repair','ready','deliver','note'].includes(p.operation))throw appError_('WARRANTY_ACTION','Selecciona una acción válida.',400);
  if(['report','receive','home'].includes(p.operation)) {
    p.number=orderText_(payload.number,'number',120,true);p.itemId=orderText_(payload.itemId,'itemId',120,true);
    p.piece=orderText_(payload.piece,'piece',160,true);p.quantity=orderInteger_(payload.quantity,'quantity',1);
    p.source=p.operation==='report'?'REPORTE':p.operation==='home'?'DOMICILIO':orderText_(payload.source,'source',20,true);p.condition=p.operation==='report'?'':p.operation==='home'?'Sin ingreso al almacén':orderText_(payload.condition,'condition',1000,true);p.issue=orderText_(payload.issue,'issue',1000,true);p.assignee=orderText_(payload.assignee,'assignee',120,true);
    if((!p.id&&p.revision!==0)||(p.operation==='report'&&p.id)||p.quantity>100||!(p.operation==='report'?['REPORTE']:p.operation==='home'?['DOMICILIO']:['CLIENTE','RECOGIDA']).includes(p.source)||(p.operation!=='report'&&payload.physicalCheck!==true))throw appError_('WARRANTY_RECEIPT','Confirma la recepción o la atención realizada antes de guardar.',400);
    if(p.operation==='home'&&!p.notes)throw appError_('WARRANTY_NOTE','Describe el trabajo realizado en el domicilio.',400);
  } else {
    if(!p.id||!p.notes)throw appError_('WARRANTY_NOTE','Describe lo realizado antes de guardar.',400);
    p.assignee=orderText_(payload.assignee,'assignee',120,true);
    if(p.operation==='deliver'){
      p.recipient=orderText_(payload.recipient,'recipient',160,true);
      if(payload.physicalCheck!==true)throw appError_('WARRANTY_DELIVERY','Confirma la entrega física de las piezas.',400);
    }
  }
  var requestId=orderRequestId_(context.requestId),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro cambio guardándose. Reintenta este registro.',503);
  try {
    var s=wcSession_(context,true),hash=sha256_(JSON.stringify(p)),replay=wcReplay_(requestId,s,hash);
    if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var old=p.id?mdUnique_(listRows_('Agenda'),'ID',p.id):null;
    if(p.id&&(!old||old.Categoria!=='GARANTIA_EXPEDIENTE'))throw appError_('WARRANTY_NOT_FOUND','No se encontró el expediente.',404);
    var order=rcOrder_(old?old.Numero_OP:p.number,s),data=old?wcData_(old):null;
    if(old&&(!orderBranchReadable_(s,old.Sede)||old.Sede!==order.Sede))throw appError_('PERMISSION_DENIED','No tienes acceso a esta sede.',403);
    if(old&&data.revision!==p.revision)throw appError_('WARRANTY_CHANGED','Otra persona actualizó el expediente. Ábrelo de nuevo.',409);
    var allowed={receive:['REPORTADA'],home:['REPORTADA'],repair:['RECIBIDA','LISTA'],ready:['EN_REPARACION'],deliver:['LISTA'],note:['REPORTADA','RECIBIDA','EN_REPARACION','LISTA']};
    if(old&&!(allowed[p.operation]||[]).includes(old.Estado))throw appError_('WARRANTY_CHANGED','La acción no corresponde al estado actual.',409);
    if(old&&['receive','home'].includes(p.operation)&&(old.Numero_OP!==p.number||data.itemId!==p.itemId||data.piece!==p.piece||data.quantity!==p.quantity||data.issue!==p.issue))throw appError_('WARRANTY_CHANGED','Conserva el mueble y reporte del expediente.',409);
    var stamp=now_().toISOString(),uid=s.profile.uid,id=p.id||requestId;
    if(!old){
      var item=mdUnique_(listRows_('Orden_Items'),'Item_ID',p.itemId);
      if(!item||item.Numero_OP!==p.number||ajItemAdjustment_(item,ajEvents_(p.number)).returnable<=0)throw appError_('WARRANTY_ITEM','Selecciona un mueble entregado de esta OP.',409);
      data={contract:'warranty-1',revision:0,itemId:p.itemId,description:String(item.Descripcion),piece:p.piece,quantity:p.quantity,source:p.source,condition:p.condition,issue:p.issue,events:[]};
    }
    if(old&&['receive','home'].includes(p.operation)){data.source=p.source;data.condition=p.condition;}
    var status={report:'REPORTADA',receive:'RECIBIDA',home:'RESUELTA_DOMICILIO',repair:'EN_REPARACION',ready:'LISTA',deliver:'ENTREGADA',note:old?old.Estado:''}[p.operation];
    data.revision++;data.updated=stamp;data.assignee=p.assignee;
    data.events.push({at:stamp,by:s.profile.name||uid,uid:uid,operation:p.operation,status:status,notes:p.notes,assignee:p.assignee,recipient:p.recipient||''});
    if(JSON.stringify(data).length>40000)throw appError_('WARRANTY_CAPACITY','El expediente alcanzó su capacidad de notas. Requiere revisión.',409);
    var row={ID:id,Fecha:old?old.Fecha:stamp.slice(0,10),Hora:'',Categoria:'GARANTIA_EXPEDIENTE',Titulo:data.piece,Cliente:order.Nombre_Cliente,Numero_OP:order.Numero_OP||p.number||old.Numero_OP,Sede:order.Sede,Referencia_Notas:JSON.stringify(data),Estado:status,Responsable:p.assignee,Fecha_Registro:old?old.Fecha_Registro:stamp};
    var result={requestId:requestId,id:id,number:row.Numero_OP,revision:data.revision,status:status};
    var requests=old?orderUpdateRequests_('Agenda',old._row,row):[orderAppendRequest_('Agenda',[row])];
    requests.push(orderAppendRequest_('Auditoria',[{ID:requestId+'-AUD',Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'GARANTIAS',Accion:p.operation.toUpperCase(),Entidad:'GARANTIA',Entidad_ID:id,Resumen:'Recepción y seguimiento de reparación',Estado:'CONFIRMADA',Request_ID:requestId,Antes_JSON:JSON.stringify(old||{}),Despues_JSON:JSON.stringify(row),Reversible:'NO',Motivo_No_Reversible:'Se conserva la recepción y su recorrido.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:requestId,Fecha:stamp,Tipo_Operacion:'GARANTIA_GUARDAR',Entidad:'GARANTIA',Entidad_ID:id,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(requestId,uid,hash,'GARANTIA_GUARDAR');
    try{orderAtomicBatch_(requests);}catch(e){throw appError_('WARRANTY_SAVE_UNCERTAIN','No se pudo confirmar el guardado. Consulta este mismo intento.',503);}
    clearConfirmedOrderFence_();return {saved:true,result:result};
  } finally {lock.releaseLock();}
}



