// Reproducible receipt/visit note from the saved case, never browser-supplied content.
function wcDocument_(payload,context){
  var s=wcSession_(context,false),id=orderText_(payload.id,'id',160,true),row=mdUnique_(listRows_('Agenda'),'ID',id);
  if(!row||row.Categoria!=='GARANTIA_EXPEDIENTE')throw appError_('WARRANTY_NOT_FOUND','No se encontró el expediente.',404);
  var order=rcOrder_(row.Numero_OP,s);
  if(!orderBranchReadable_(s,row.Sede)||row.Sede!==order.Sede)throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a este expediente.',403);
  var data=wcData_(row),first=data.events[0];
  if(!first||!['receive','home'].includes(first.operation))throw appError_('WARRANTY_INTEGRITY','Falta el registro original de la atención.',409);
  return {documentKind:'warranty',issued:true,number:id,orderNumber:row.Numero_OP,branchCode:row.Sede,date:first.at,
    client:{name:row.Cliente,document:String(order.Cedula_NIT),phone:String(order.Telefono||''),address:String(order.Direccion_Entrega||'')},
    type:first.operation==='home'?'DOMICILIO':'RECEPCION',piece:data.piece,quantity:data.quantity,description:data.description,
    source:data.source,issue:data.issue,condition:data.condition,work:first.notes,assignee:first.assignee,registeredBy:first.by};
}

