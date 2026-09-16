import { createOrderSave } from './order-save.js?v=progress-1';
export function createReceiptSave(options) {
  const request = options.request;
  const messages = { preparing:'Comprobando disponibilidad del abono…', saving:'Registrando el abono…', checking:'Consultando el resultado del abono…', confirmed:'Abono y PDF confirmados. Puedes abrir el recibo.', uncertain:'Falta confirmar el abono. Consulta este intento antes de registrar otro.' };
  return createOrderSave({ ...options, kind:'receipt',
    onState: state => options.onState({ ...state, message:messages[state.phase] || (state.phase==='documents' ? (state.working ? state.message.replace('Completando los archivos de la orden registrada…','Abono registrado. Generando y archivando el PDF…') : 'Abono registrado. El PDF está pendiente; puedes completarlo sin volver a cobrar.') : state.message.replaceAll('Pedido','Recibo').replaceAll('pedido','recibo').replaceAll('la orden','el recibo')) }),
    request: async (action,payload,settings) => {
      const names = { ORDEN_CAPACIDADES:'RECIBO_CAPACIDADES',ORDEN_CREAR:'RECIBO_CREAR',ORDEN_CREACION_ESTADO:'RECIBO_CREACION_ESTADO' };
      const reply = await request(names[action] || action,payload,settings);
      if (reply.data?.receipt) return {...reply,data:{...reply.data,order:{...reply.data.receipt,mediaWorkflow:1}}};
      return reply;
    },
    finishDocuments: async (number, media, request, status) => {
      const result=await request('RECIBO_DOCUMENTOS_FINALIZAR',{number},{timeoutMs:150000});
      if(result.data?.complete!==true || result.data.number!==number)throw Error('Falta confirmar el PDF del recibo.');
      status('PDF generado. Verificando el archivo del recibo…');
      const verified=await request('RECIBO_OBTENER',{number});
      if(verified.data?.complete!==true || verified.data.number!==number)throw Error('Falta verificar el archivo del recibo.');
    }
  });
}
