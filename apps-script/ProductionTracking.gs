// Append-only quantity events in Produccion. Observaciones contains a versioned
// payload; existing legacy rows remain intact and block ambiguous reconciliation.
var PT_STAGES_ = ['SOLICITADO','CONFIRMADO','FABRICACION','LISTO','TRANSPORTE','BODEGA'];
function ptEnabled_() { return typeof osActive_==='function' && osActive_() || commercialWritesEnabled_() && getConfigValue_('MODO_OPERACION','')==='OPERACION' && optionalProperty_('PRODUCTION_SAVE_ENABLED','NO')==='SI'; }
function ptSession_(context,write) {var s=validateSessionToken_(context.sessionToken,false);requirePermission_(s,'ordenes.read');requirePermission_(s,'produccion.read');if(write)requirePermission_(s,'produccion.update');return s;}
function ptEvents_(number) {return listRows_('Produccion').filter(function(r){return r.Numero_OP===number;});}
function ptView_(item,rows) {
  var totals={},events=[],legacy=false;PT_STAGES_.forEach(function(k){totals[k]=0;});
  rows.filter(function(r){return !r.Item_ID||r.Item_ID===item.Item_ID;}).forEach(function(r){
    var p=parseJson_(r.Observaciones,null);if(!p||p.contract!==1||!PT_STAGES_.includes(r.Estado_Produccion)){legacy=true;return;}
    if(!Number.isSafeInteger(p.quantity)||p.quantity<1)throw appError_('PRODUCTION_INTEGRITY','Hay un movimiento de producción que requiere revisión.',409);
    totals[r.Estado_Produccion]+=p.quantity;
    events.push({id:r.Produccion_ID,stage:r.Estado_Produccion,quantity:p.quantity,date:p.date,recordedAt:valueDateIso_(r.Actualizado_En),by:r.Responsable,provider:r.Taller_Proveedor,notes:p.notes});
  });
  var limit=Number(item.Cantidad)-Number(item.Cantidad_Desistida||0),received=totals.BODEGA;
  if(PT_STAGES_.some(function(k){return totals[k]>limit;}))throw appError_('PRODUCTION_INTEGRITY','Los movimientos superan las unidades del mueble.',409);
  var available=item.Disponibilidad==='DISPONIBLE'?Number(item.Cantidad_Pendiente):Math.max(0,received-Number(item.Cantidad_Entregada||0));
  var stage=PT_STAGES_.filter(function(k){return totals[k]>0;}).pop()||'';
  return {contract:1,totals:totals,received:received,available:available,stage:stage,legacy:legacy,events:events};
}
function ptAccount_(payload,context) {
  var s=ptSession_(context,false),row=rcOrder_(String(payload.number||''),s),events=ptEvents_(row.Numero_OP);
  var source=listRows_('Orden_Items').filter(function(i){return i.Numero_OP===row.Numero_OP;});
  return {number:row.Numero_OP,enabled:ptEnabled_()&&hasPermission_(s.permissions,'produccion.update'),items:source.map(function(i){return {id:i.Item_ID,revision:Number(i.Version)||1,tracking:ptView_(i,events)};})};
}
function ptReplay_(id,s,hash) {
  var r=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!r)return null;
  if(r.Usuario!==s.profile.uid||r.Tipo_Operacion!=='PRODUCCION_REGISTRAR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var p=parseJson_(r.Resultado_JSON,null);if(!p||!p.result||r.Estado!=='CONFIRMADA')throw appError_('ORDER_RECOVERY_REQUIRED','El movimiento requiere revisión.',409);
  rcOrder_(p.result.number,s);if(hash&&hash!==p.fingerprint)throw appError_('REQUEST_CONTENT_CHANGED','Conserva los datos del intento original.',409);return p.result;
}
function ptStatus_(payload,context){var s=ptSession_(context,true),id=orderRequestId_(payload.requestId),result=ptReplay_(id,s,'');return result?{saved:true,result:result}:{saved:false,retrySameRequest:!readOrderFence_()};}
function ptRecord_(payload,context) {
  if(!ptEnabled_())throw appError_('COMMERCIAL_WRITES_DISABLED','El registro de producción está en preparación.',403);
  orderObject_(payload,['number','itemId','revision','stage','quantity','date','provider','notes','verified'],'production');
  var p={number:orderText_(payload.number,'number',120,true),itemId:orderText_(payload.itemId,'itemId',120,true),revision:orderInteger_(payload.revision,'revision',1),stage:String(payload.stage||''),quantity:orderInteger_(payload.quantity,'quantity',1),date:orderText_(payload.date,'date',10,true),provider:orderText_(payload.provider,'provider',120,false),notes:orderText_(payload.notes,'notes',1000,false),verified:payload.verified};
  if(!PT_STAGES_.includes(p.stage)||p.verified!==true||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date||p.date>now_().toISOString().slice(0,10))orderInputError_('stage','Revisa la fecha y confirma el movimiento realizado.');
  if(['SOLICITADO','CONFIRMADO','FABRICACION','LISTO','TRANSPORTE'].includes(p.stage)&&!p.provider)orderInputError_('provider','Indica el proveedor del movimiento.');
  var id=orderRequestId_(context.requestId),lock=osOperationLock_();if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro movimiento guardándose. Reintenta este mismo registro.',503);
  try {
    var s=ptSession_(context,true),hash=sha256_(JSON.stringify(p)),replay=ptReplay_(id,s,hash);if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var row=rcOrder_(p.number,s),item=mdUnique_(listRows_('Orden_Items'),'Item_ID',p.itemId);
    if(!item||item.Numero_OP!==p.number)throw appError_('ORDER_ITEM_NOT_FOUND','El mueble no pertenece a la orden.',404);
    if(!['CONFIRMADA','EN_PROCESO'].includes(row.Estado)||item.Estado_Item==='ANULADO'||(Number(item.Cantidad_Desistida||0)>0&&!(typeof ajCancellationVerified_==='function'&&ajCancellationVerified_(item,ajEvents_(p.number))))||Number(item.Cantidad_Pendiente)<=0)throw appError_('PRODUCTION_INACTIVE','El mueble no admite movimientos.',409);
    if(Number(item.Version)!==p.revision)throw appError_('PRODUCTION_CHANGED','El mueble cambió. Actualiza la OP antes de registrar.',409);
    var view=ptView_(item,ptEvents_(p.number));if(view.legacy)throw appError_('PRODUCTION_LEGACY','Hay registros anteriores que requieren conciliación.',409);
    if(item.Disponibilidad==='DISPONIBLE')throw appError_('PRODUCTION_ALREADY_AVAILABLE','El mueble ya estaba disponible en almacén.',409);
    if(view.totals[p.stage]+p.quantity>Number(item.Cantidad)-Number(item.Cantidad_Desistida||0))throw appError_('PRODUCTION_EXCEEDS_QUANTITY','La cantidad supera las unidades pendientes de este paso.',409);
    var stamp=now_().toISOString(),uid=s.profile.uid,result={requestId:id,number:p.number,itemId:p.itemId,stage:p.stage,quantity:p.quantity};
    var event={Produccion_ID:id,Numero_OP:p.number,Item_ID:p.itemId,Sede:row.Sede,Estado_Produccion:p.stage,Responsable:s.profile.name||uid,Taller_Proveedor:p.provider,Observaciones:JSON.stringify({contract:1,quantity:p.quantity,date:p.date,notes:p.notes}),Actualizado_Por:uid,Actualizado_En:stamp};
    var requests=[orderAppendRequest_('Produccion',[event])].concat(orderUpdateRequests_('Orden_Items',item._row,{Version:Number(item.Version)+1,Actualizado_En:stamp}),orderUpdateRequests_('Ordenes_Pedido',row._row,{Version:Number(row.Version)+1,Actualizado_Por:uid,Actualizado_En:stamp}));
    requests.push(orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'PRODUCCION',Accion:'PRODUCCION_REGISTRAR',Entidad:'ORDEN_ITEM',Entidad_ID:p.itemId,Resumen:p.stage+' · '+p.quantity+' unidades',Estado:'CONFIRMADA',Request_ID:id,Antes_JSON:JSON.stringify(view),Despues_JSON:JSON.stringify(result),Reversible:'NO',Motivo_No_Reversible:'El historial conserva el movimiento registrado.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'PRODUCCION_REGISTRAR',Entidad:'ORDEN_ITEM',Entidad_ID:p.itemId,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(id,uid,hash,'PRODUCCION_REGISTRAR');try{orderAtomicBatch_(requests);}catch(e){throw appError_('PRODUCTION_SAVE_UNCERTAIN','No se pudo confirmar el movimiento. Consulta el mismo intento antes de volver a registrar.',503);}clearConfirmedOrderFence_();return {saved:true,result:result};
  } finally{lock.releaseLock();}
}


