// Dispatch quantity ledger. Loading goods does not certify receipt at destination.
function rmEnabled_() {
  return typeof osActive_ === 'function' && osActive_() || MADERARTE_APP.COMMERCIAL_WRITES
    && getConfigValue_('MODO_OPERACION','') === 'OPERACION' && optionalProperty_('REMISSION_SAVE_ENABLED','NO') === 'SI'
    && optionalProperty_('ORDER_DOCUMENTS_ENABLED','NO') === 'SI';
}
function rmGate_() { if(!rmEnabled_()) throw appError_('COMMERCIAL_WRITES_DISABLED','Las entregas están en preparación.',403); }
function rmSession_(context,write) {
  var s=validateSessionToken_(context.sessionToken,false);
  requirePermission_(s,'ordenes.read');requirePermission_(s,'remisiones.read');
  if(write)requirePermission_(s,'remisiones.create');return s;
}
function rmFail_(message) { throw appError_('DELIVERY_INTEGRITY',message || 'Las cantidades requieren conciliación antes de otra entrega.',409); }
function rmPersonKey_(name) { return String(name||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es'); }
function rmPeople_(branch,role) {
  var catalog='REMISION_'+role+'_'+branch,seen={};
  return listRows_('Catalogos').filter(function(r){return r.Catalogo===catalog&&r.Activo==='SI';}).map(function(r){
    var key=rmPersonKey_(r.Valor),meta=parseJson_(r.Descripcion,null);
    if(!key||seen[key]||!meta||typeof meta.favorite!=='boolean'||!Number.isFinite(Date.parse(meta.lastUsed)))rmFail_('El directorio de entregas requiere revisión.');
    seen[key]=true;return {name:r.Valor,favorite:meta.favorite,lastUsed:meta.lastUsed,mode:meta.mode||''};
  }).sort(function(a,b){return Number(b.favorite)-Number(a.favorite)||b.lastUsed.localeCompare(a.lastUsed)||a.name.localeCompare(b.name);});
}
function rmRemember_(branch,role,person,stamp) {
  if(!person.name)return [];
  var catalog='REMISION_'+role+'_'+branch,key=rmPersonKey_(person.name);
  var matches=listRows_('Catalogos').filter(function(r){return r.Catalogo===catalog&&rmPersonKey_(r.Valor)===key;});
  if(matches.length>1)rmFail_('El nombre está duplicado en el directorio de entregas.');
  var value={Catalogo:catalog,Valor:person.name,Orden:0,Activo:'SI',Descripcion:JSON.stringify({favorite:person.favorite,lastUsed:stamp,mode:person.mode||''})};
  return matches.length?orderUpdateRequests_('Catalogos',matches[0]._row,value):[orderAppendRequest_('Catalogos',[value])];
}
function rmHistory_(h,lines) {
  var slot=mdUnique_(mdRows_(h.Numero_OP),'Archivo_ID',h.Numero_Remision+'-PDF-V1'),doc=slot&&parseJson_(slot.Plan_JSON,null);
  if(!doc||doc.number!==h.Numero_Remision||doc.orderNumber!==h.Numero_OP||!doc.transporter?.name)rmFail_('Falta el detalle del despacho.');
  return {number:h.Numero_Remision,date:valueDateIso_(h.Fecha_Remision),dispatcher:doc.dispatcher,transporter:doc.transporter,assistant:doc.assistant,
    items:lines.filter(function(l){return l.Numero_Remision===h.Numero_Remision;}).map(function(l){return {itemId:l.Item_ID,description:l.Descripcion,quantity:Number(l.Cantidad_Entregada)};})};
}
function rmPosition_(row) {
  var number=row.Numero_OP,items=listRows_('Orden_Items').filter(function(i){return i.Numero_OP===number;});
  var heads=listRows_('Remisiones').filter(function(r){return r.Numero_OP===number;});
  var lines=listRows_('Remision_Items').filter(function(r){return r.Numero_OP===number;});
  var production=listRows_('Produccion').filter(function(p){return p.Numero_OP===number;});
  var ids={},numbers={},sums={};
  if(!items.length)rmFail_();
  items.forEach(function(i){if(!i.Item_ID || ids[i.Item_ID])rmFail_();ids[i.Item_ID]=true;sums[i.Item_ID]=0;});
  heads.forEach(function(h){
    if(!h.Numero_Remision || numbers[h.Numero_Remision] || h.Estado!=='CONFIRMADA')rmFail_();
    var commit=mdUnique_(listRows_('Idempotencia'),'Request_ID',h.Request_ID);
    if(!commit || commit.Estado!=='CONFIRMADA' || commit.Tipo_Operacion!=='REMISION_CREAR')rmFail_();
    numbers[h.Numero_Remision]={};
  });
  lines.forEach(function(l){
    var seen=numbers[l.Numero_Remision],q=Number(l.Cantidad_Entregada);
    if(!seen || !ids[l.Item_ID] || seen[l.Item_ID] || !Number.isSafeInteger(q) || q<=0)rmFail_();
    seen[l.Item_ID]=true;sums[l.Item_ID]+=q;
  });
  if(heads.some(function(h){return !Object.keys(numbers[h.Numero_Remision]).length;}))rmFail_();
  var view=items.map(function(i){
    var quantity=Number(i.Cantidad),cancelled=Number(i.Cantidad_Desistida||0),delivered=sums[i.Item_ID],pending=quantity-cancelled-delivered;
    if(!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(cancelled)||cancelled<0||!Number.isSafeInteger(pending)||pending<0
      ||Number(i.Cantidad_Entregada)!==delivered||Number(i.Cantidad_Pendiente)!==pending)rmFail_();
    var hasProduction=production.some(function(p){return !p.Item_ID || p.Item_ID===i.Item_ID;});
    var tracked=typeof ptView_==='function'?ptView_(i,production):null;
    var available=tracked&&!tracked.legacy?tracked.available:(hasProduction?0:i.Disponibilidad==='DISPONIBLE'?pending:0);
    var blocked=cancelled?'El mueble tiene un ajuste que requiere revisión.':tracked&&tracked.legacy?'Requiere revisión de producción antes de entregar.':available<1?'La disponibilidad requiere revisión operativa.':'';
    return {id:i.Item_ID,description:i.Descripcion,quantity:quantity,delivered:delivered,cancelled:cancelled,pending:pending,available:available,unit:i.Unidad||'UN',blocked:blocked};
  });
  return {items:view,history:heads.map(function(h){return rmHistory_(h,lines);}),
    fingerprint:sha256_(JSON.stringify([number,row.Estado,row.Version,items.map(function(i){return [i.Item_ID,i.Cantidad,i.Cantidad_Entregada,i.Cantidad_Pendiente,i.Cantidad_Desistida,i.Version,i.Disponibilidad];}),heads,lines,production]))};
}
function rmAccount_(payload,context) {
  var s=rmSession_(context,false),row=rcOrder_(String(payload.number||''),s),position=rmPosition_(row);
  return {order:normalizeOrder_(row),position:position,dispatcher:s.profile.name||'',people:{transporters:rmPeople_(row.Sede,'TRANSPORTADOR'),assistants:rmPeople_(row.Sede,'OPERARIO')},canDeliver:['CONFIRMADA','EN_PROCESO'].indexOf(row.Estado)!==-1};
}
function rmCapabilities_(context) {
  var s=rmSession_(context,false),ready=false;try {orderCreationSchemaReady_();mdSchema_();ready=true;}catch(e){}
  return {contractVersion:1,enabled:Boolean(ready && rmEnabled_() && hasPermission_(s.permissions,'remisiones.create')),photosReady:true,documentsReady:ready};
}
function rmPayload_(p) {
  orderObject_(p,['number','fingerprint','items','transporter','assistant','notes','physicalCheck'],'remission');
  if(!/^(MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(p.number||'') || !/^[a-f0-9]{64}$/.test(p.fingerprint||''))orderInputError_('number','Actualiza la orden antes de confirmar.');
  if(p.physicalCheck!==true)orderInputError_('physicalCheck','Confirma la verificación física de esta entrega.');
  if(!Array.isArray(p.items)||!p.items.length||p.items.length>100)orderInputError_('items','Selecciona al menos un mueble.');
  var seen={};var selected=p.items.map(function(i){
    orderObject_(i,['itemId','quantity'],'items');var id=orderText_(i.itemId,'itemId',120,true);
    if(seen[id])orderInputError_('items','No repitas un mueble.');seen[id]=true;
    return {itemId:id,quantity:orderInteger_(i.quantity,'quantity',1)};
  });
  orderObject_(p.transporter,['name','mode','favorite'],'transporter');orderObject_(p.assistant,['name','favorite'],'assistant');
  if(['PIALLERO','PROPIETARIO','OTRO'].indexOf(p.transporter.mode)===-1||typeof p.transporter.favorite!=='boolean'||typeof p.assistant.favorite!=='boolean')orderInputError_('transporter','Revisa quién transporta.');
  return {number:p.number,fingerprint:p.fingerprint,items:selected,
    transporter:{name:orderText_(p.transporter.name,'transporter',120,true).replace(/\s+/g,' '),mode:p.transporter.mode,favorite:p.transporter.favorite},
    assistant:{name:orderText_(p.assistant.name,'assistant',120,false).replace(/\s+/g,' '),favorite:p.assistant.favorite},
    notes:orderText_(p.notes,'notes',2000,false),physicalCheck:true};
}
function rmReplay_(id,s,fingerprint) {
  var row=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!row)return null;
  if(row.Usuario!==s.profile.uid||row.Tipo_Operacion!=='REMISION_CREAR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var saved=parseJson_(row.Resultado_JSON,null);
  if(row.Estado!=='CONFIRMADA'||!saved||!saved.result||!saved.fingerprint)throw appError_('ORDER_RECOVERY_REQUIRED','Consulta la entrega pendiente de confirmación.',409);
  rcOrder_(saved.result.orderNumber,s);
  if(fingerprint&&saved.fingerprint!==fingerprint)throw appError_('REQUEST_CONTENT_CHANGED','El intento original tiene otros datos.',409);return saved.result;
}
function rmPlan_(header,row,selected,s,draft) {
  var parent=mdUnique_(listRows_('Carpetas_Documentales'),'Clave',mdScope_()+':OP:'+row.Numero_OP+':DELIVERY');
  if(!parent)throw appError_('DOCUMENT_NOT_PLANNED','Completa primero el archivo de la OP.',409);
  var doc={documentKind:'remission',issued:true,number:header.Numero_Remision,orderNumber:row.Numero_OP,date:header.Fecha_Remision,branchCode:row.Sede,
    dispatcher:s.profile.name||'',transporter:{name:draft.transporter.name,mode:draft.transporter.mode},assistant:draft.assistant.name,notes:header.Observaciones,
    client:{document:String(row.Cedula_NIT),name:row.Nombre_Cliente,phone:row.Telefono,alternatePhone:row.Telefono_Alterno,address:row.Direccion_Entrega,city:row.Ciudad},items:selected};
  if(typeof osActive_==='function'&&osActive_())doc.sandbox=OWNER_SANDBOX_CONTEXT_.id;
  var slot={Archivo_ID:header.Numero_Remision+'-PDF-V1',Numero_OP:row.Numero_OP,Tipo:'REMISION',Nombre:header.Numero_Remision+'.pdf',Mime_Type:'application/pdf',
    File_ID:mdIds_(1)[0],Parent_ID:parent.File_ID,Estado:'PENDIENTE',Version:1,Creado_Por:s.profile.uid,Request_ID:header.Request_ID,Fecha_Registro:header.Fecha_Remision,Plan_JSON:JSON.stringify(doc)};
  if(slot.Plan_JSON.length>45000)orderInputError_('items','La remisión es demasiado extensa. Divide la entrega en documentos.');
  return {slot:slot,requests:[orderAppendRequest_('Archivos_Orden',[slot]),orderAppendRequest_('Documentos',[{
    ID_Documento:slot.Archivo_ID,Tipo_Documento:'REMISION',Numero_Relacionado:row.Numero_OP,Cedula_NIT:row.Cedula_NIT,Nombre_Cliente:row.Nombre_Cliente,Nombre_Archivo:slot.Nombre,
    File_ID:slot.File_ID,Mime_Type:slot.Mime_Type,Version:1,Activo:'NO',Fecha_Registro:header.Fecha_Remision,Operador:s.profile.uid,Request_ID:header.Request_ID}]),orderAppendRequest_('Versiones_Documentos',[{
    Version_ID:slot.Archivo_ID,Tipo_Documento:'REMISION',Numero_Relacionado:header.Numero_Remision,Version:1,Activo:'NO',File_ID:slot.File_ID,Nombre_Archivo:slot.Nombre,Generado_Por:s.profile.uid,Request_ID:header.Request_ID}])]};
}
function rmCreate_(payload,context) {
  rmGate_();var draft=rmPayload_(payload),id=orderRequestId_(context.requestId),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro guardado en curso. Consulta el mismo intento.',503);
  try {
    rmGate_();var s=rmSession_(context,true);orderCreationSchemaReady_();mdSchema_();
    var fingerprint=sha256_(JSON.stringify(draft)),replay=rmReplay_(id,s,fingerprint);
    if(replay){clearConfirmedOrderFence_();return {saved:true,remission:replay};}assertNoUnresolvedOrderFence_();
    var row=rcOrder_(draft.number,s),position=rmPosition_(row);
    if(['CONFIRMADA','EN_PROCESO'].indexOf(row.Estado)===-1)throw appError_('DELIVERY_ORDER_INACTIVE','La orden no admite entregas.',409);
    if(position.fingerprint!==draft.fingerprint)throw appError_('DELIVERY_CHANGED','La orden o sus entregas cambiaron. Actualiza y revisa la selección.',409);
    var selected=draft.items.map(function(x){
      var i=position.items.find(function(i){return i.id===x.itemId;});
      if(!i||x.quantity>i.pending)throw appError_('DELIVERY_EXCEEDS_PENDING','La cantidad supera lo pendiente o el mueble no pertenece a la OP.',409);
      if(x.quantity>i.available)throw appError_('DELIVERY_NOT_READY','La cantidad supera las unidades disponibles en bodega.',409);
      if(i.blocked)throw appError_('DELIVERY_NOT_READY',i.blocked,409);
      return {itemId:i.id,description:i.description,quantity:x.quantity,unit:i.unit,pendingAfter:i.pending-x.quantity};
    });
    var branch=mdUnique_(listRows_('Sedes'),'Sede_ID',row.Sede);
    if(!branch||branch.Estado!=='ACTIVA')throw appError_('BRANCH_NOT_AVAILABLE','La sede no está activa.',403);
    var next=Number(branch.Siguiente_Remision),prefix=String(branch.Prefijo_Remision||'');
    if(!Number.isSafeInteger(next)||!Number.isSafeInteger(next+1)||next<1||!new RegExp('^'+row.Sede+'(?:-[A-Z0-9]+)+$').test(prefix))throw appError_('NUMBERING_INVALID','Revisa la numeración de remisiones.',503);
    var number=prefix+'-'+String(next).padStart(4,'0');
    if(listRows_('Registro_Numeros').some(function(n){return n.Numero===number;})||listRows_('Remisiones').some(function(n){return n.Numero_Remision===number;}))rmFail_('El número de remisión ya existe.');
    var stamp=now_().toISOString(),uid=s.profile.uid;
    var header={Numero_Remision:number,Numero_OP:row.Numero_OP,Sede:row.Sede,Cedula_NIT:row.Cedula_NIT,Nombre_Cliente:row.Nombre_Cliente,Fecha_Remision:stamp,
      Persona_Recibe:'',Observaciones:draft.notes,Estado:'CONFIRMADA',URL_Carpeta_Cliente:row.URL_Carpeta_Cliente,Responsable:s.profile.name||'',Fecha_Registro:stamp,Request_ID:id};
    var result={number:number,orderNumber:row.Numero_OP,branch:row.Sede,requestId:id,quantity:selected.reduce(function(n,i){return n+i.quantity;},0)};
    var plan=rmPlan_(header,row,selected,s,draft);
    var requests=[orderAppendRequest_('Remisiones',[header]),orderAppendRequest_('Remision_Items',selected.map(function(i,index){return {Remision_Item_ID:number+'-I-'+(index+1),Numero_Remision:number,Numero_OP:row.Numero_OP,Item_ID:i.itemId,Descripcion:i.description,Cantidad_Entregada:i.quantity,Unidad:i.unit,Fecha_Registro:stamp};}))].concat(plan.requests);
    var source=listRows_('Orden_Items');selected.forEach(function(i){var stored=mdUnique_(source,'Item_ID',i.itemId);
      requests=requests.concat(orderUpdateRequests_('Orden_Items',stored._row,{Cantidad_Entregada:Number(stored.Cantidad_Entregada)+i.quantity,Cantidad_Pendiente:i.pendingAfter,Estado_Item:i.pendingAfter===0?'ENTREGADO':'ENTREGA_PARCIAL',Version:Number(stored.Version)+1,Actualizado_En:stamp}));
    });
    requests=requests.concat(orderUpdateRequests_('Ordenes_Pedido',row._row,{Version:Number(row.Version)+1,Actualizado_Por:uid,Actualizado_En:stamp}),orderUpdateRequests_('Sedes',branch._row,{Siguiente_Remision:next+1,Actualizado_En:stamp}),rmRemember_(row.Sede,'TRANSPORTADOR',draft.transporter,stamp),rmRemember_(row.Sede,'OPERARIO',draft.assistant,stamp));
    requests.push(orderAppendRequest_('Registro_Numeros',[{Registro_ID:id+'-N',Sede:row.Sede,Tipo_Documento:'REMISION',Numero:number,Estado:'CONFIRMADO',Entidad_ID:number,Reservado_En:stamp,Confirmado_En:stamp,Usuario:uid,Request_ID:id}]));
    requests.push(orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:uid,Rol:s.profile.role,Modulo:'REMISIONES',Accion:'REMISION_CREAR',Entidad:'REMISION',Entidad_ID:number,Resumen:'Salida del almacén con verificación física declarada por quien despacha.',Estado:'CONFIRMADA',Request_ID:id,Antes_JSON:JSON.stringify({fingerprint:position.fingerprint,items:position.items}),Despues_JSON:JSON.stringify({result:result,items:selected,dispatcher:header.Responsable,transporter:draft.transporter,assistant:draft.assistant,physicalCheck:true}),Reversible:'NO',Motivo_No_Reversible:'Una devolución física requiere su propio movimiento.'}]));
    requests.push(orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'REMISION_CREAR',Entidad:'REMISION',Entidad_ID:number,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:fingerprint,result:result}),Usuario:uid}]));
    SpreadsheetApp.flush();reserveOrderFence_(id,uid,fingerprint,'REMISION_CREAR');
    try{orderAtomicBatch_(requests);}catch(e){throw appError_('REMISSION_SAVE_UNCERTAIN','Falta confirmar esta entrega. Consulta el mismo intento; no crees otra remisión.',503);}
    clearConfirmedOrderFence_();return {saved:true,remission:result};
  }finally{lock.releaseLock();}
}
function rmStatus_(payload,context) {
  var id=orderRequestId_(payload.requestId),s=rmSession_(context,true),result=rmReplay_(id,s,'');
  return result?{saved:true,remission:result}:{saved:false,requestId:id,state:'NO_CONFIRMADO',retrySameRequest:!readOrderFence_()};
}
function rmAccess_(number,context,write) {
  var s=rmSession_(context,write),h=mdUnique_(listRows_('Remisiones'),'Numero_Remision',number);
  if(!h)throw appError_('REMISSION_NOT_FOUND','No se encontró la remisión.',404);
  var row=rcOrder_(h.Numero_OP,s);if(write){rmGate_();if(h.Estado!=='CONFIRMADA')throw appError_('REMISSION_INACTIVE','La remisión no está activa.',409);}
  var slot=mdUnique_(mdRows_(row.Numero_OP),'Archivo_ID',number+'-PDF-V1');
  if(!slot)rmFail_('Falta la versión de la remisión.');return {header:h,row:row,slot:slot,session:s};
}
function rmGet_(payload,context) {var a=rmAccess_(payload.number,context,false);return {number:payload.number,orderNumber:a.row.Numero_OP,document:parseJson_(a.slot.Plan_JSON,null),complete:a.slot.Estado==='LISTO'};}
function rmPreparePdf_(payload,context) {
  mdInternal_(context);return mdLocked_(function(){var a=rmAccess_(payload.number,context,true);mdSchema_();
    if(a.slot.Estado==='LISTO'){mdDownload_(a.slot);return {number:payload.number,complete:true};}
    return {number:payload.number,complete:false,id:a.slot.Archivo_ID,planHash:sha256_(a.slot.Plan_JSON),document:parseJson_(a.slot.Plan_JSON,null)};
  });
}
function rmConfirmPdf_(payload,context) {
  mdInternal_(context);return mdLocked_(function(){var a=rmAccess_(payload.number,context,true),slot=a.slot;
    if(slot.Archivo_ID!==payload.id||sha256_(slot.Plan_JSON)!==payload.planHash)throw appError_('DOCUMENT_REVISION_CHANGED','La remisión no coincide con su versión.',409);
    var bytes=mdDecode_(payload.base64,ORDER_MEDIA_LIMITS_.pdfBytes);if(!mdMagic_(bytes,'application/pdf'))throw appError_('PDF_INVALID','El archivo no es un PDF.',400);
    var stored=mdStore_(slot,bytes),url=mdFileUrl_(slot.File_ID),version=mdUnique_(listRows_('Versiones_Documentos'),'Version_ID',slot.Archivo_ID);
    if(!version)rmFail_();orderAtomicBatch_(mdReadyRequests_(slot,stored).concat(orderUpdateRequests_('Remisiones',a.header._row,{URL_PDF_Remision:url}),orderUpdateRequests_('Versiones_Documentos',version._row,{Activo:'SI',URL:url,Hash_SHA256:mdBytesHash_(stored),Fecha_Generacion:now_().toISOString()})));
    return {number:payload.number,complete:true};
  });
}
function rmReadPdf_(payload,context) {var a=rmAccess_(payload.number,context,false);if(a.slot.Estado!=='LISTO')throw appError_('PDF_PENDING','El PDF está pendiente.',409);return {name:a.slot.Nombre,mime:'application/pdf',base64:Utilities.base64Encode(mdDownload_(a.slot))};}
