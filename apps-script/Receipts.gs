// Receipt transactions share the order lock, admission fence and numbering.
function rcEnabled_() {
  return typeof osActive_ === 'function' && osActive_() || MADERARTE_APP.COMMERCIAL_WRITES
    && getConfigValue_('MODO_OPERACION', '') === 'OPERACION' && optionalProperty_('RECEIPT_SAVE_ENABLED', 'NO') === 'SI'
    && optionalProperty_('ORDER_DOCUMENTS_ENABLED', 'NO') === 'SI';
}
function rcGate_() { if (!rcEnabled_()) throw appError_('COMMERCIAL_WRITES_DISABLED', 'Los recibos están en preparación. El registro de pagos aún no está habilitado.', 403); }
function rcSession_(context, write) {
  var session = validateSessionToken_(context.sessionToken, false);
  requirePermission_(session, 'abonos.read'); requirePermission_(session, 'ordenes.read');
  if (write) requirePermission_(session, 'abonos.create');
  return session;
}
function rcOrder_(number, session) {
  var row = mdUnique_(listRows_('Ordenes_Pedido'), 'Numero_OP', number);
  if (!row) throw appError_('ORDER_NOT_FOUND', 'No se encontró la orden de pedido.', 404);
  if (!orderBranchReadable_(session, row.Sede)) throw appError_('BRANCH_NOT_ALLOWED', 'No tienes acceso a esta sede.', 403);
  return row;
}
function rcPosition_(row) {
  var payments = listRows_('Abonos').filter(function(p) { return p.Numero_OP === row.Numero_OP; });
  var active = payments.filter(function(p) { return p.Estado_Registro === 'ACTIVO' && p.Afecta_Saldo === 'SI'; });
  var total = Number(row.Valor_Total), paid = active.reduce(function(sum,p) { return sum + Number(p.Valor_Abono); },0);
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(paid) || total < 0 || paid < 0 || paid > total
    || active.some(function(p) { return !Number.isSafeInteger(Number(p.Valor_Abono)) || Number(p.Valor_Abono) <= 0; })
    || paid !== Number(row.Abonado_Total) || total - paid !== Number(row.Saldo_Pendiente)) {
    throw appError_('RECEIPT_BALANCE_INTEGRITY', 'El historial y el saldo requieren conciliación. No se registrará otro pago.', 409);
  }
  return { total: total, paid: paid, balance: total-paid,
    fingerprint: sha256_(JSON.stringify([row.Numero_OP,row.Estado,total,paid,row.Version,payments.map(function(p) { return [p.Numero_Recibo,p.Valor_Abono,p.Estado_Registro,p.Afecta_Saldo]; })])) };
}
function rcAccount_(payload, context) {
  var session = rcSession_(context, false), row = rcOrder_(String(payload.number || ''),session);
  var position = rcPosition_(row);
  return { order: normalizeOrder_(row), payments: orderPayments_(row.Numero_OP), position: position,
    canReceive: row.Estado === 'CONFIRMADA' || row.Estado === 'EN_PROCESO' };
}
function rcCapabilities_(context) {
  var session = rcSession_(context,false), ready = false;
  try { orderCreationSchemaReady_(); mdSchema_(); ready = true; } catch (error) {}
  return { contractVersion:1,enabled:Boolean(ready && rcEnabled_() && (session.permissions.indexOf('*')!==-1 || session.permissions.indexOf('abonos.create')!==-1)), documentsReady:ready,photosReady:true };
}
function rcPayload_(p) {
  orderObject_(p,['number','fingerprint','amount','method','concept','reference','internalNote'],'receipt');
  if (!/^(MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(p.number || '') || !/^[a-f0-9]{64}$/.test(p.fingerprint || '')) orderInputError_('number','Selecciona y actualiza la orden antes de guardar.');
  return {number:p.number,fingerprint:p.fingerprint,amount:orderInteger_(p.amount,'amount',1),
    method:orderEnum_(p.method,['EFECTIVO','TRANSFERENCIA','TARJETA','ADDI'],'method'),
    concept:orderText_(p.concept,'concept',500,true),reference:orderText_(p.reference,'reference',160,false),internalNote:orderText_(p.internalNote,'internalNote',1000,false)};
}
function rcReplay_(id,session,fingerprint) {
  var row=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);
  if (!row) return null;
  if (row.Usuario!==session.profile.uid || row.Tipo_Operacion!=='RECIBO_CREAR') throw appError_('REQUEST_ID_CONFLICT','El identificador pertenece a otra operación.',409);
  var saved=parseJson_(row.Resultado_JSON,null);
  if (row.Estado!=='CONFIRMADA' || !saved || !saved.result || !saved.fingerprint) throw appError_('ORDER_RECOVERY_REQUIRED','Este pago requiere revisión.',409);
  rcOrder_(saved.result.orderNumber,session);
  if (fingerprint && saved.fingerprint!==fingerprint) throw appError_('REQUEST_CONTENT_CHANGED','El intento original tiene otros datos. Recupera su resultado.',409);
  return saved.result;
}
function rcPlan_(payment,row,advisor) {
  var parent=mdUnique_(listRows_('Carpetas_Documentales'),'Clave',mdScope_()+':OP:'+row.Numero_OP+':PAY');
  if (!parent) throw appError_('DOCUMENT_NOT_PLANNED','Completa primero la documentación de la orden.',409);
  var document={documentKind:'receipt',issued:true,number:payment.Numero_Recibo,orderNumber:row.Numero_OP,date:payment.Fecha_Pago,
    branchCode:row.Sede,advisor:advisor,client:{document:String(row.Cedula_NIT),name:row.Nombre_Cliente,phone:row.Telefono,alternatePhone:row.Telefono_Alterno,address:row.Direccion_Entrega,city:row.Ciudad,email:row.Email},
    amount:payment.Valor_Abono,method:payment.Medio_Pago,concept:payment.Comentario,reference:payment.Referencia,
    previousBalance:payment.Saldo_Anterior,balance:payment.Saldo_Nuevo,total:Number(row.Valor_Total)};
  if (typeof osActive_==='function' && osActive_()) document.sandbox=OWNER_SANDBOX_CONTEXT_.id;
  var slot={Archivo_ID:payment.Numero_Recibo+'-PDF-V1',Numero_OP:row.Numero_OP,Tipo:'RECIBO',Nombre:payment.Numero_Recibo+'.pdf',Mime_Type:'application/pdf',
    File_ID:mdIds_(1)[0],Parent_ID:parent.File_ID,Estado:'PENDIENTE',Version:1,Creado_Por:payment.Registrado_Por,Request_ID:payment.Request_ID,
    Fecha_Registro:payment.Fecha_Pago,Plan_JSON:JSON.stringify(document)};
  return {slot:slot,requests:[orderAppendRequest_('Archivos_Orden',[slot]),orderAppendRequest_('Documentos',[{
    ID_Documento:slot.Archivo_ID,Tipo_Documento:'RECIBO',Numero_Relacionado:row.Numero_OP,Cedula_NIT:row.Cedula_NIT,Nombre_Cliente:row.Nombre_Cliente,
    Nombre_Archivo:slot.Nombre,File_ID:slot.File_ID,Mime_Type:'application/pdf',Version:1,Activo:'NO',Fecha_Registro:payment.Fecha_Pago,Operador:payment.Registrado_Por,Request_ID:payment.Request_ID
  }]),orderAppendRequest_('Versiones_Documentos',[{Version_ID:slot.Archivo_ID,Tipo_Documento:'RECIBO',Numero_Relacionado:payment.Numero_Recibo,Version:1,Activo:'NO',File_ID:slot.File_ID,Nombre_Archivo:slot.Nombre,Generado_Por:payment.Registrado_Por,Request_ID:payment.Request_ID}])]};
}
function rcCreate_(payload,context) {
  rcGate_(); var draft=rcPayload_(payload),id=orderRequestId_(context.requestId);
  var lock=typeof osOperationLock_==='function'?osOperationLock_():LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw appError_('ORDER_SAVE_BUSY','Hay otro guardado en curso. Consulta este intento.',503);
  try {
    rcGate_(); var session=rcSession_(context,true); orderCreationSchemaReady_(); mdSchema_();
    var fingerprint=sha256_(JSON.stringify(draft)),replay=rcReplay_(id,session,fingerprint);
    if(replay){clearConfirmedOrderFence_();return {saved:true,receipt:replay};}
    assertNoUnresolvedOrderFence_();
    var row=rcOrder_(draft.number,session),position=rcPosition_(row);
    if (['CONFIRMADA','EN_PROCESO'].indexOf(row.Estado)===-1) throw appError_('RECEIPT_ORDER_INACTIVE','Esta orden no admite abonos.',409);
    if(position.fingerprint!==draft.fingerprint) throw appError_('RECEIPT_BALANCE_CHANGED','El saldo cambió. Actualiza la orden y revisa el importe.',409);
    if(draft.amount>position.balance) throw appError_('RECEIPT_EXCEEDS_BALANCE','El abono supera el saldo pendiente.',409);
    var branch=mdUnique_(listRows_('Sedes'),'Sede_ID',row.Sede);
    if(!branch || branch.Estado!=='ACTIVA')throw appError_('BRANCH_NOT_AVAILABLE','La sede no está disponible.',403);
    var number=orderNextNumbers_(branch,'RECIBO',1)[0],stamp=now_().toISOString(),uid=session.profile.uid;
    var payment={Numero_Recibo:number,Numero_OP:row.Numero_OP,Sede:row.Sede,Cedula_NIT:row.Cedula_NIT,Nombre_Cliente:row.Nombre_Cliente,
      Fecha_Pago:stamp,Valor_Abono:draft.amount,Medio_Pago:draft.method,Referencia:draft.reference,Comentario:draft.concept,Nota_Interna:draft.internalNote,
      Saldo_Anterior:position.balance,Saldo_Nuevo:position.balance-draft.amount,Registrado_Por:uid,Fecha_Registro:stamp,Estado_Registro:'ACTIVO',Afecta_Saldo:'SI',Request_ID:id};
    var result={number:number,orderNumber:row.Numero_OP,branch:row.Sede,requestId:id,amount:draft.amount,balance:payment.Saldo_Nuevo};
    var plan=rcPlan_(payment,row,session.profile.name||'');
    var requests=[orderAppendRequest_('Abonos',[payment])].concat(orderUpdateRequests_('Ordenes_Pedido',row._row,{
      Abonado_Total:position.paid+draft.amount,Saldo_Pendiente:payment.Saldo_Nuevo,Ultimo_Abono:draft.amount,Fecha_Ultimo_Abono:stamp,
      Comentarios_Abonos:[row.Comentarios_Abonos,draft.concept].filter(Boolean).join(' · ').slice(-40000),Actualizado_Por:uid,Actualizado_En:stamp
    }),orderUpdateRequests_('Sedes',branch._row,{Siguiente_Recibo:Number(branch.Siguiente_Recibo)+1,Actualizado_En:stamp}),plan.requests);
    requests.push(orderAppendRequest_('Registro_Numeros',[{Registro_ID:id+'-N',Sede:row.Sede,Tipo_Documento:'RECIBO',Numero:number,Estado:'CONFIRMADO',Entidad_ID:number,Reservado_En:stamp,Confirmado_En:stamp,Usuario:uid,Request_ID:id}]));
    requests.push(orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:uid,Rol:session.profile.role,Modulo:'ABONOS',Accion:'RECIBO_CREAR',Entidad:'RECIBO',Entidad_ID:number,Resumen:'Abono confirmado en la orden.',Estado:'CONFIRMADA',Request_ID:id,Antes_JSON:JSON.stringify(position),Despues_JSON:JSON.stringify(result),Reversible:'NO',Motivo_No_Reversible:'Corregir mediante movimiento posterior; nunca borrar un pago.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'RECIBO_CREAR',Entidad:'RECIBO',Entidad_ID:number,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:fingerprint,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(id,uid,fingerprint,'RECIBO_CREAR');
    try {orderAtomicBatch_(requests);} catch(error){throw appError_('RECEIPT_SAVE_UNCERTAIN','Falta confirmar el pago. Consulta el mismo intento antes de registrar otro.',503);}
    clearConfirmedOrderFence_();return {saved:true,receipt:result};
  } finally {lock.releaseLock();}
}
function rcStatus_(payload,context) {
  var id=orderRequestId_(payload.requestId),session=rcSession_(context,true);
  var result=rcReplay_(id,session,'');
  if(result)return {saved:true,receipt:result};
  return {saved:false,requestId:id,state:'NO_CONFIRMADO',retrySameRequest:!readOrderFence_()};
}
function rcAccess_(number,context,write) {
  var session=rcSession_(context,write),payment=mdUnique_(listRows_('Abonos'),'Numero_Recibo',number);
  if(!payment)throw appError_('RECEIPT_NOT_FOUND','No se encontró el recibo.',404);
  var row=rcOrder_(payment.Numero_OP,session);
  if(write){rcGate_();if(payment.Estado_Registro!=='ACTIVO')throw appError_('RECEIPT_INACTIVE','El recibo no está activo.',409);}
  return {session:session,payment:payment,row:row,slot:mdUnique_(mdRows_(row.Numero_OP),'Archivo_ID',number+'-PDF-V1')};
}
function rcGet_(payload,context) {
  var access=rcAccess_(payload.number,context,false),p=access.payment;
  return {number:p.Numero_Recibo,orderNumber:p.Numero_OP,amount:Number(p.Valor_Abono),method:p.Medio_Pago,date:valueDateIso_(p.Fecha_Pago),concept:p.Comentario,
    balance:Number(p.Saldo_Nuevo),client:p.Nombre_Cliente,complete:Boolean(access.slot && access.slot.Estado==='LISTO')};
}
function rcPreparePdf_(payload,context) {
  mdInternal_(context);
  return mdLocked_(function(){
    var a=rcAccess_(payload.number,context,true);mdSchema_();
    if(!a.slot){
      // Initial payments already exist. Reserve ONLY their missing document.
      var advisor=mdUnique_(listRows_('Usuarios'),'UID_Firebase',a.payment.Registrado_Por);
      var plan=rcPlan_(a.payment,a.row,advisor && advisor.Nombre_Completo || a.row.Responsable || '');
      var reserveId='RC-DOC-'+sha256_(payload.number).slice(0,40),fingerprint=sha256_(plan.slot.Plan_JSON),stamp=now_().toISOString(),uid=a.session.profile.uid;
      plan.requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:reserveId,Fecha:stamp,Tipo_Operacion:'RECIBO_DOCUMENTO_RESERVAR',Entidad:'RECIBO',Entidad_ID:payload.number,Estado:'CONFIRMADA',Usuario:uid,Resultado_JSON:JSON.stringify({fingerprint:fingerprint,result:{requestId:reserveId,number:payload.number}})}]));
      reserveOrderFence_(reserveId,uid,fingerprint,'RECIBO_DOCUMENTO_RESERVAR');
      try {orderAtomicBatch_(plan.requests);} catch(error){throw appError_('DOCUMENT_RESERVATION_UNCERTAIN','La reserva del documento requiere confirmación. No se registró otro pago.',503);}
      clearConfirmedOrderFence_();a.slot=mdUnique_(mdRows_(a.row.Numero_OP),'Archivo_ID',plan.slot.Archivo_ID);
    }
    if(a.slot.Estado==='LISTO'){mdDownload_(a.slot);return {number:payload.number,complete:true};}
    return {number:payload.number,complete:false,id:a.slot.Archivo_ID,planHash:sha256_(a.slot.Plan_JSON),document:parseJson_(a.slot.Plan_JSON,null)};
  });
}
function rcConfirmPdf_(payload,context) {
  mdInternal_(context);
  return mdLocked_(function(){
    var a=rcAccess_(payload.number,context,true),slot=a.slot;
    if(!slot || slot.Archivo_ID!==payload.id || sha256_(slot.Plan_JSON)!==payload.planHash)throw appError_('DOCUMENT_REVISION_CHANGED','El recibo no coincide con su versión.',409);
    var bytes=mdDecode_(payload.base64,ORDER_MEDIA_LIMITS_.pdfBytes);
    if(!mdMagic_(bytes,'application/pdf'))throw appError_('PDF_INVALID','El archivo no es un PDF.',400);
    var stored=mdStore_(slot,bytes),url=mdFileUrl_(slot.File_ID);
    var version=mdUnique_(listRows_('Versiones_Documentos'),'Version_ID',slot.Archivo_ID);
    if(!version)throw appError_('DOCUMENT_INTEGRITY_ERROR','Falta la versión del recibo.',409);
    orderAtomicBatch_(mdReadyRequests_(slot,stored).concat(orderUpdateRequests_('Abonos',a.payment._row,{URL_PDF_Recibo:url}),orderUpdateRequests_('Versiones_Documentos',version._row,{Activo:'SI',URL:url,Hash_SHA256:mdBytesHash_(stored),Fecha_Generacion:now_().toISOString()})));
    return {number:payload.number,complete:true};
  });
}
function rcReadPdf_(payload,context) {
  var a=rcAccess_(payload.number,context,false);
  if(!a.slot || a.slot.Estado!=='LISTO')throw appError_('PDF_PENDING','El PDF del recibo todavía está pendiente.',409);
  return {name:a.slot.Nombre,mime:'application/pdf',base64:Utilities.base64Encode(mdDownload_(a.slot))};
}
