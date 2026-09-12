// Read-only overview. Read each sheet once per page, never one request per OP.
function productionOverview_(payload, context) {
  var session=ptSession_(context,false), after=String(payload.after||''), limit=Math.min(200,Math.max(1,Number(payload.limit)||200));
  var orders={}, grouped={}, events={};
  listRows_('Ordenes_Pedido').forEach(function(row){
    if(orderBranchReadable_(session,row.Sede)&&['CONFIRMADA','EN_PROCESO'].includes(row.Estado)) orders[row.Numero_OP]=row;
  });
  listRows_('Produccion').forEach(function(row){if(orders[row.Numero_OP]) (events[row.Numero_OP]||(events[row.Numero_OP]=[])).push(row);});
  listRows_('Orden_Items').forEach(function(row){
    if(orders[row.Numero_OP]&&row.Estado_Item!=='ANULADO'&&Number(row.Cantidad_Pendiente)>0) (grouped[row.Numero_OP]||(grouped[row.Numero_OP]=[])).push(row);
  });
  var adjustments=typeof ajEvents_==='function'?ajEvents_(''):[];
  var entries=[];
  Object.keys(grouped).forEach(function(number){grouped[number].forEach(function(row){entries.push({key:number+'|'+row.Item_ID,row:row});});});
  entries.sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;});
  var remaining=entries.filter(function(e){return e.key>after;}), page=remaining.slice(0,limit);
  var items=page.map(function(entry){
    var row=entry.row,order=orders[row.Numero_OP],tracking=null,issue='';
    try{tracking=ptView_(row,events[row.Numero_OP]||[]);}catch(e){if(e.appCode!=='PRODUCTION_INTEGRITY')throw e;issue='Revisar cantidades en la OP';}
    return {key:entry.key,order:{number:row.Numero_OP,client:String(order.Nombre_Cliente||''),document:String(order.Cedula_NIT||''),branch:normalizeCode_(order.Sede),status:order.Estado},item:{id:row.Item_ID,description:String(row.Descripcion||''),category:String(row.Categoria||''),quantity:Number(row.Cantidad),pending:Number(row.Cantidad_Pendiente),delivered:Number(row.Cantidad_Entregada||0),cancelled:Number(row.Cantidad_Desistida||0),adjustmentVerified:typeof ajCancellationVerified_==='function'&&ajCancellationVerified_(row,adjustments),fulfillment:row.Disponibilidad,agreement:row.Acuerdo,status:row.Estado_Item,fabricColor:String(row.Color_Tela||''),woodColor:String(row.Color_Madera||''),tracking:tracking?{totals:tracking.totals,received:tracking.received,available:tracking.available,stage:tracking.stage,legacy:tracking.legacy,events:tracking.events.map(function(e){return {stage:e.stage,quantity:e.quantity,date:e.date,recordedAt:e.recordedAt,provider:e.provider};})}:null,issue:issue}};
  });
  return {items:items,total:entries.length,next:remaining.length>limit?page[page.length-1].key:null,productionTrackingEnabled:ptEnabled_()&&hasPermission_(session.permissions,'produccion.update')};
}


