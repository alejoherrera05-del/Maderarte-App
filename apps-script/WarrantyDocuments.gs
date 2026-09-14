// Reproducible receipt/visit note from the saved case, never browser-supplied content.
function wcDocument_(payload,context){
  var s=wcSession_(context,false),id=orderText_(payload.id,'id',160,true),row=mdUnique_(listRows_('Agenda'),'ID',id);
  if(!row||row.Categoria!=='GARANTIA_EXPEDIENTE')throw appError_('WARRANTY_NOT_FOUND','No se encontró el expediente.',404);
  var order=rcOrder_(row.Numero_OP,s);
  if(!orderBranchReadable_(s,row.Sede)||row.Sede!==order.Sede)throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a este expediente.',403);
  var data=wcData_(row),first=data.events.find(function(e){return ['receive','home'].includes(e.operation);});
  if(!first||!['receive','home'].includes(first.operation))throw appError_('WARRANTY_INTEGRITY','Falta el registro original de la atención.',409);
  var kind=orderText_(payload.kind,'kind',20,false);
  if(kind&&kind!=='ENTREGA')throw appError_('WARRANTY_DOCUMENT_KIND','Selecciona un comprobante válido.',400);
  var delivery=null,ready=null;
  if(kind==='ENTREGA'){
    data.events.forEach(function(e){if(e.operation==='ready')ready=e;if(e.operation==='repair')ready=null;if(e.operation==='deliver')delivery=e;});
    if(row.Estado!=='ENTREGADA'||!delivery||!delivery.recipient||!delivery.notes||!ready||!ready.notes)throw appError_('WARRANTY_DELIVERY_PENDING','Primero registra la entrega de la pieza reparada.',409);
  }
  return {documentKind:'warranty',issued:true,number:id,orderNumber:row.Numero_OP,branchCode:row.Sede,date:delivery?delivery.at:first.at,
    client:{name:row.Cliente,document:String(order.Cedula_NIT),phone:String(order.Telefono||''),address:String(order.Direccion_Entrega||'')},
    type:delivery?'ENTREGA':first.operation==='home'?'DOMICILIO':'RECEPCION',piece:data.piece,quantity:data.quantity,description:data.description,
    source:data.source,issue:data.issue,condition:data.condition,work:delivery?ready.notes:first.notes,assignee:delivery?delivery.assignee:first.assignee,registeredBy:delivery?delivery.by:first.by,
    ...(delivery?{recipient:delivery.recipient,deliveryNotes:delivery.notes,receivedAt:first.at}: {})};
}


