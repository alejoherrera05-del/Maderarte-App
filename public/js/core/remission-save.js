import { createOrderSave } from './order-save.js?v=remission-1';
export function createRemissionSave(options) {
  const request=options.request;
  const messages={confirmed:'Despacho registrado. Puedes abrir su remisión.',documents:'Despacho registrado. Falta completar su PDF; las cantidades ya están registradas.',saving:'Confirmando el despacho…',checking:'Consultando el resultado del despacho…',uncertain:'Falta confirmar el resultado. Consulta el mismo intento antes de otro despacho.'};
  return createOrderSave({...options,kind:'remission',onState:state=>options.onState({...state,message:messages[state.phase]||state.message.replaceAll('Pedido','Despacho').replaceAll('pedido','despacho').replaceAll('la orden','la remisión')}),
    request:async(action,payload,settings)=>{
      const names={ORDEN_CAPACIDADES:'REMISION_CAPACIDADES',ORDEN_CREAR:'REMISION_CREAR',ORDEN_CREACION_ESTADO:'REMISION_CREACION_ESTADO'};
      const reply=await request(names[action]||action,payload,settings);
      return reply.data?.remission?{...reply,data:{...reply.data,order:{...reply.data.remission,mediaWorkflow:1}}}:reply;
    },
    finishDocuments:async number=>{
      const result=await request('REMISION_DOCUMENTOS_FINALIZAR',{number},{timeoutMs:150000});
      if(result.data?.complete!==true||result.data.number!==number)throw Error('Falta confirmar el PDF de la remisión.');
      const verified=await request('REMISION_OBTENER',{number});
      if(verified.data?.complete!==true||verified.data.number!==number)throw Error('Falta verificar el archivo de la remisión.');
    }
  });
}
