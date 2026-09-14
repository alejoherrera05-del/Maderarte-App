// Physical return and sale adjustment. Original dispatches and cash receipts are immutable.
function ajItemAdjustment_(item,events){
  var cancelled=0,returned=0,reduction=0;
  events.filter(function(e){return e.source===item.Numero_OP&&['DESISTIR','RETORNAR'].includes(e.type);}).forEach(function(e){
    if(!Array.isArray(e.items))ajFail_();
    if(e.type==='RETORNAR'&&(!e.returnReceipt||e.returnReceipt.physicalCheck!==true||e.returnReceipt.destination!=='EXHIBICION'))ajFail_('La recepción del mueble requiere revisión.');
    e.items.filter(function(i){return i.itemId===item.Item_ID;}).forEach(function(i){
      if(!Number.isSafeInteger(i.quantity)||i.quantity<1||!Number.isSafeInteger(i.reduction)||i.reduction<0)ajFail_();
      if(e.type==='DESISTIR')cancelled+=i.quantity;else returned+=i.quantity;reduction+=i.reduction;
    });
  });
  var n=Number(item.Cantidad),net=Number(item.Valor_Neto),d=Number(item.Cantidad_Entregada||0),c=Number(item.Cantidad_Desistida||0);
  if(![n,net,d,c,cancelled,returned,reduction].every(Number.isSafeInteger)||n<1||net<0||d<0||c<0||cancelled!==c||returned>d||cancelled+returned>n||reduction!==Number(BigInt(net)*BigInt(cancelled+returned)/BigInt(n)))ajFail_('Las cantidades devueltas o retiradas requieren revisión.');
  return {cancelled:cancelled,returned:returned,returnable:d-returned,reduction:reduction};
}
function ajReturnPlan_(p,row,before){
  if(!['CONFIRMADA','EN_PROCESO','COMPLETADA'].includes(row.Estado))throw appError_('ADJUSTMENT_INACTIVE','Esta OP no admite devoluciones físicas.',409);
  var dispatch=rmPosition_(row),events=ajEvents_(p.number),source=listRows_('Orden_Items').filter(function(i){return i.Numero_OP===p.number;}),amount=0;
  var items=p.items.map(function(selection){
    var i=mdUnique_(source,'Item_ID',selection.itemId),sent=dispatch.items.find(function(d){return d.id===selection.itemId;});
    if(!i||!sent)throw appError_('RETURN_QUANTITY','El mueble no pertenece a esta OP.',409);
    var a=ajItemAdjustment_(i,events);
    if(selection.quantity>a.returnable)throw appError_('RETURN_QUANTITY','Solo puedes recibir cantidades despachadas que aún no hayan regresado.',409);
    var retired=a.cancelled+a.returned,net=BigInt(Number(i.Valor_Neto)),n=BigInt(Number(i.Cantidad));
    var value=Number(net*BigInt(retired+selection.quantity)/n-net*BigInt(retired)/n);amount+=value;
    return {itemId:i.Item_ID,description:i.Descripcion,quantity:selection.quantity,reduction:value,row:i};
  });
  return {row:row,before:before,after:{total:before.total-amount,paid:before.paid,balance:Math.max(0,before.total-amount-before.paid),credit:Math.max(0,before.paid-before.total+amount)},items:items,amount:amount,target:null,targetBefore:null,targetAfter:null};
}

