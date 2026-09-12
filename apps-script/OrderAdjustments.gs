// Append-only OP adjustments. Transfers reference both orders in one atomic event.
// Anulaciones stores the versioned consequences; original receipts are immutable.
function ajEvents_(number) {
  return listRows_('Anulaciones').filter(function(r){return r.Tipo_Entidad==='AJUSTE_OP'&&r.Estado==='CONFIRMADA';}).map(function(r){
    var e=parseJson_(r.Consecuencias_JSON,null);
    if(!e||e.contract!==1||!['DESISTIR','TRANSFERIR','DEVOLVER'].includes(e.type)||!Number.isSafeInteger(e.amount)||e.amount<0)throw appError_('ADJUSTMENT_INTEGRITY','Hay un ajuste que requiere conciliación.',409);
    e.id=r.Anulacion_ID;e.source=r.Entidad_ID;e.date=valueDateIso_(r.Fecha);e.by=r.Aprobada_Por;e.reason=r.Motivo;
    return e;
  }).filter(function(e){return e.source===number||e.target===number;});
}
function ajSession_(context,write){var s=validateSessionToken_(context.sessionToken,false);requirePermission_(s,'ordenes.read');requirePermission_(s,'abonos.read');if(write)requirePermission_(s,'ajustes.create');return s;}
function ajEnabled_(){return typeof osActive_==='function'&&osActive_()||commercialWritesEnabled_()&&getConfigValue_('MODO_OPERACION','')==='OPERACION'&&optionalProperty_('ORDER_ADJUSTMENTS_ENABLED','NO')==='SI';}
function ajFail_(message){throw appError_('ADJUSTMENT_INTEGRITY',message||'Los movimientos de esta OP requieren conciliación.',409);}
function ajPosition_(row,events){
  events=events||ajEvents_(row.Numero_OP);
  var payments=listRows_('Abonos').filter(function(p){return p.Numero_OP===row.Numero_OP&&p.Estado_Registro==='ACTIVO'&&p.Afecta_Saldo==='SI';});
  var items=listRows_('Orden_Items').filter(function(i){return i.Numero_OP===row.Numero_OP;}),original=0,reduction=0,received=0,incoming=0,outgoing=0,cancelled={};
  payments.forEach(function(p){var v=Number(p.Valor_Abono);if(!Number.isSafeInteger(v)||v<=0)ajFail_();received+=v;});
  events.forEach(function(e){
    if(e.type==='DESISTIR'){if(e.source!==row.Numero_OP||!Array.isArray(e.items))ajFail_();reduction+=e.amount;e.items.forEach(function(i){cancelled[i.itemId]=(cancelled[i.itemId]||0)+i.quantity;});}
    else if(e.target===row.Numero_OP)incoming+=e.amount;
    else outgoing+=e.amount;
  });
  if(!items.length)ajFail_();
  items.forEach(function(i){var n=Number(i.Cantidad),net=Number(i.Valor_Neto),d=Number(i.Cantidad_Entregada||0),c=Number(i.Cantidad_Desistida||0),p=Number(i.Cantidad_Pendiente);
    if(![n,net,d,c,p].every(Number.isSafeInteger)||n<1||net<0||d<0||c<0||p<0||p!==n-d-c||c!==(cancelled[i.Item_ID]||0))ajFail_();original+=net;
  });
  var total=original-reduction,paid=received+incoming-outgoing,balance=Math.max(0,total-paid),credit=Math.max(0,paid-total);
  if(![original,reduction,received,incoming,outgoing,total,paid,balance,credit].every(Number.isSafeInteger)||total<0||paid<0||Number(row.Valor_Total)!==total||Number(row.Abonado_Total)!==paid||Number(row.Saldo_Pendiente)!==balance)ajFail_();
  return {total:total,paid:paid,balance:balance,credit:credit,received:received,incoming:incoming,outgoing:outgoing,original:original,
    fingerprint:sha256_(JSON.stringify([row.Numero_OP,row.Estado,row.Version,total,paid,items,payments,events]))};
}
function ajAccount_(payload,context){var s=ajSession_(context,false),row=rcOrder_(String(payload.number||''),s),events=ajEvents_(row.Numero_OP);return {order:normalizeOrder_(row),position:ajPosition_(row,events),items:orderItems_(row.Numero_OP),events:events,enabled:ajEnabled_()&&hasPermission_(s.permissions,'ajustes.create')};}
function ajPayload_(p){
  orderObject_(p,['number','fingerprint','type','items','amount','target','targetFingerprint','reason','reference'],'adjustment');
  var result={number:orderText_(p.number,'number',120,true),fingerprint:orderText_(p.fingerprint,'fingerprint',64,true),type:orderEnum_(p.type,['DESISTIR','TRANSFERIR','DEVOLVER'],'type'),reason:orderText_(p.reason,'reason',1000,true),reference:orderText_(p.reference,'reference',240,false),target:String(p.target||''),targetFingerprint:String(p.targetFingerprint||''),amount:p.amount===undefined?0:orderInteger_(p.amount,'amount',0),items:[]};
  if(result.type==='DESISTIR'){
    if(!Array.isArray(p.items)||!p.items.length||p.items.length>100)orderInputError_('items','Selecciona los muebles y sus cantidades.');
    var seen={};result.items=p.items.map(function(i){orderObject_(i,['itemId','quantity'],'item');var id=orderText_(i.itemId,'itemId',120,true);if(seen[id])orderInputError_('items','Hay un mueble repetido.');seen[id]=true;return {itemId:id,quantity:orderInteger_(i.quantity,'quantity',1)};});
    if(result.amount||result.target)orderInputError_('amount','El ajuste se calcula desde los muebles.');
  }else if(result.amount<1||(p.items&&p.items.length))orderInputError_('amount','Indica un importe positivo sin seleccionar muebles.');
  if(result.type==='TRANSFERIR'&&(!result.target||result.target===result.number||!result.targetFingerprint))orderInputError_('target','Selecciona una OP de destino diferente.');
  if(result.type==='DEVOLVER'&&(!result.reference||result.target))orderInputError_('reference','Indica el soporte o referencia de la devolución realizada.');
  return result;
}
function ajPlan_(p,s){
  var row=rcOrder_(p.number,s),before=ajPosition_(row),after={total:before.total,paid:before.paid},items=[],target=null,targetBefore=null,targetAfter=null,amount=p.amount;
  if(before.fingerprint!==p.fingerprint)throw appError_('ADJUSTMENT_CHANGED','La cuenta cambió. Actualiza antes de confirmar.',409);
  if(p.type==='DESISTIR'){
    if(!['CONFIRMADA','EN_PROCESO'].includes(row.Estado))throw appError_('ADJUSTMENT_INACTIVE','Esta OP no admite desistimientos.',409);
    var source=listRows_('Orden_Items').filter(function(i){return i.Numero_OP===p.number;}),production=ptEvents_(p.number);amount=0;
    p.items.forEach(function(selection){var i=mdUnique_(source,'Item_ID',selection.itemId);if(!i||selection.quantity>Number(i.Cantidad_Pendiente))throw appError_('ADJUSTMENT_QUANTITY','Solo puedes retirar cantidades pendientes de esta OP.',409);
      if(production.some(function(e){return !e.Item_ID||e.Item_ID===i.Item_ID;}))throw appError_('ADJUSTMENT_FACTORY_REVIEW','Este mueble tiene movimientos de fábrica. Primero requiere conciliación con el proveedor.',409);
      var n=Number(i.Cantidad),c=Number(i.Cantidad_Desistida||0),net=Number(i.Valor_Neto),value=Number(BigInt(net)*BigInt(c+selection.quantity)/BigInt(n)-BigInt(net)*BigInt(c)/BigInt(n));
      amount+=value;items.push({itemId:i.Item_ID,description:i.Descripcion,quantity:selection.quantity,reduction:value,row:i});
    });after.total-=amount;
  }else{
    if(amount>before.credit)throw appError_('ADJUSTMENT_EXCEEDS_CREDIT','El importe supera el saldo a favor disponible.',409);after.paid-=amount;
    if(p.type==='TRANSFERIR'){target=rcOrder_(p.target,s);if(!['CONFIRMADA','EN_PROCESO'].includes(target.Estado))throw appError_('ADJUSTMENT_TARGET_INACTIVE','La OP de destino no está activa.',409);
      targetBefore=ajPosition_(target);if(targetBefore.fingerprint!==p.targetFingerprint)throw appError_('ADJUSTMENT_CHANGED','La cuenta de destino cambió. Actualízala.',409);
      if(amount>targetBefore.balance)throw appError_('ADJUSTMENT_EXCEEDS_TARGET','El importe supera el saldo por pagar de la OP de destino.',409);
      targetAfter={total:targetBefore.total,paid:targetBefore.paid+amount,balance:targetBefore.balance-amount,credit:0};
    }
  }
  after.balance=Math.max(0,after.total-after.paid);after.credit=Math.max(0,after.paid-after.total);
  if(!Number.isSafeInteger(amount)||amount<0)ajFail_();
  return {row:row,before:before,after:after,items:items,amount:amount,target:target,targetBefore:targetBefore,targetAfter:targetAfter};
}
function ajPreview_(payload,context){var s=ajSession_(context,true),p=ajPayload_(payload),plan=ajPlan_(p,s);return {type:p.type,amount:plan.amount,before:plan.before,after:plan.after,target:plan.target?{number:plan.target.Numero_OP,client:plan.target.Nombre_Cliente}:null,targetBefore:plan.targetBefore,targetAfter:plan.targetAfter,items:plan.items.map(function(i){return {itemId:i.itemId,description:i.description,quantity:i.quantity,reduction:i.reduction};})};}
function ajReplay_(id,s,hash){var r=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!r)return null;if(r.Usuario!==s.profile.uid||r.Tipo_Operacion!=='AJUSTE_CONFIRMAR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);var saved=parseJson_(r.Resultado_JSON,null);if(!saved||!saved.result||r.Estado!=='CONFIRMADA')throw appError_('ORDER_RECOVERY_REQUIRED','Consulta el movimiento pendiente.',409);rcOrder_(saved.result.number,s);if(saved.result.target)rcOrder_(saved.result.target,s);if(hash&&saved.fingerprint!==hash)throw appError_('REQUEST_CONTENT_CHANGED','El intento original tiene otros datos.',409);return saved.result;}
function ajStatus_(payload,context){var s=ajSession_(context,true),result=ajReplay_(orderRequestId_(payload.requestId),s,'');return result?{saved:true,result:result}:{saved:false,retrySameRequest:!readOrderFence_()};}
function ajConfirm_(payload,context){
  if(!ajEnabled_())throw appError_('COMMERCIAL_WRITES_DISABLED','Los ajustes todavía no están habilitados.',403);
  var p=ajPayload_(payload),id=orderRequestId_(context.requestId),lock=osOperationLock_();if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro movimiento guardándose. Reintenta el mismo registro.',503);
  try{var s=ajSession_(context,true),hash=sha256_(JSON.stringify(p)),replay=ajReplay_(id,s,hash);if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var plan=ajPlan_(p,s),stamp=now_().toISOString(),uid=s.profile.uid,event={contract:1,type:p.type,amount:plan.amount,target:p.type==='TRANSFERIR'?p.target:'',reference:p.reference,items:plan.items.map(function(i){return {itemId:i.itemId,description:i.description,quantity:i.quantity,reduction:i.reduction};}),before:plan.before,after:plan.after,targetBefore:plan.targetBefore,targetAfter:plan.targetAfter};
    var result={id:id,number:p.number,target:event.target,type:p.type,amount:plan.amount,after:plan.after,requestId:id};
    var requests=[orderAppendRequest_('Anulaciones',[{Anulacion_ID:id,Fecha:stamp,Tipo_Entidad:'AJUSTE_OP',Entidad_ID:p.number,Motivo:p.reason,Solicitada_Por:uid,Aprobada_Por:uid,Estado:'CONFIRMADA',Antes_JSON:JSON.stringify(plan.before),Consecuencias_JSON:JSON.stringify(event),Reversible:'NO',Request_ID:id}])];
    // Freeze any missing initial receipt plans against the pre-adjustment account.
    [plan.row,plan.target].filter(Boolean).forEach(function(row){var slots=mdRows_(row.Numero_OP);listRows_('Abonos').filter(function(a){return a.Numero_OP===row.Numero_OP&&a.Estado_Registro==='ACTIVO';}).forEach(function(a){if(!slots.some(function(slot){return slot.Archivo_ID===a.Numero_Recibo+'-PDF-V1';}))requests=requests.concat(rcPlan_(a,row,row.Responsable||'').requests);});});
    function update(row,after){requests=requests.concat(orderUpdateRequests_('Ordenes_Pedido',row._row,{Valor_Total:after.total,Abonado_Total:after.paid,Saldo_Pendiente:after.balance,Version:Number(row.Version)+1,Actualizado_Por:uid,Actualizado_En:stamp}));}
    update(plan.row,plan.after);if(plan.target)update(plan.target,plan.targetAfter);
    plan.items.forEach(function(i){var row=i.row,c=Number(row.Cantidad_Desistida||0)+i.quantity,pending=Number(row.Cantidad_Pendiente)-i.quantity;requests=requests.concat(orderUpdateRequests_('Orden_Items',row._row,{Cantidad_Desistida:c,Cantidad_Pendiente:pending,Estado_Item:pending===0?'DESISTIDO':row.Estado_Item,Version:Number(row.Version)+1,Actualizado_En:stamp}));});
    requests.push(orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'AJUSTES',Accion:p.type,Entidad:'OP',Entidad_ID:p.number,Resumen:p.reason,Estado:'CONFIRMADA',Request_ID:id,Antes_JSON:JSON.stringify({source:plan.before,target:plan.targetBefore}),Despues_JSON:JSON.stringify(event),Reversible:'NO',Motivo_No_Reversible:'Conserva historial; una corrección exige otro movimiento.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'AJUSTE_CONFIRMAR',Entidad:'OP',Entidad_ID:p.number,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:hash,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(id,uid,hash,'AJUSTE_CONFIRMAR');try{orderAtomicBatch_(requests);}catch(e){throw appError_('ADJUSTMENT_UNCERTAIN','Falta confirmar el resultado. Consulta este mismo intento.',503);}clearConfirmedOrderFence_();return {saved:true,result:result};
  }finally{lock.releaseLock();}
}
function ajReceiptHistory_(payment,row){
  var date=valueDateIso_(payment.Fecha_Pago),history=listRows_('Abonos').filter(function(p){return p.Numero_OP===row.Numero_OP&&p.Estado_Registro==='ACTIVO'&&p.Afecta_Saldo==='SI'&&valueDateIso_(p.Fecha_Pago)<=date;}).map(function(p){return {number:p.Numero_Recibo,date:valueDateIso_(p.Fecha_Pago),method:p.Medio_Pago,amount:Number(p.Valor_Abono),balance:Number(p.Saldo_Nuevo)};});
  if(!history.some(function(p){return p.number===payment.Numero_Recibo;}))history.push({number:payment.Numero_Recibo,date:date,method:payment.Medio_Pago,amount:Number(payment.Valor_Abono),balance:Number(payment.Saldo_Nuevo)});
  ajEvents_(row.Numero_OP).filter(function(e){return e.date<=date;}).forEach(function(e){var incoming=e.target===row.Numero_OP;history.push({number:e.id,date:e.date,method:e.type==='DESISTIR'?'AJUSTE DE PEDIDO':e.type==='DEVOLVER'?'DEVOLUCIÓN':incoming?'SALDO RECIBIDO':'SALDO TRASLADADO',amount:e.type==='DESISTIR'?0:incoming?e.amount:-e.amount,balance:(incoming?e.targetAfter:e.after).balance});});
  history.sort(function(a,b){return a.date.localeCompare(b.date)||(a.number===payment.Numero_Recibo?1:b.number===payment.Numero_Recibo?-1:0);});
  var paid=history.reduce(function(n,h){return n+h.amount;},0);if(!Number.isSafeInteger(paid)||paid!==Number(row.Valor_Total)-Number(payment.Saldo_Nuevo))ajFail_('El historial del recibo requiere conciliación.');
  return history;
}

