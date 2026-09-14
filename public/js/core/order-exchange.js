import {apiRequest} from './api.js?v=returns-1';
import {money} from './format.js';
export function exchangeNumber(search=location.search){
  const value=new URLSearchParams(search).get('cambio')||'';
  return /^[A-Z0-9-]{1,120}$/.test(value)?value:'';
}
export function exchangeOrderPath(number,origin){
  return '/orden.html?op='+encodeURIComponent(number)+(origin?'&saldoDesde='+encodeURIComponent(origin):'');
}
export async function prepareExchange(origin,{request=apiRequest,root=document}={}){
  if(!origin)return;
  const response=await request('AJUSTE_CUENTA',{number:origin}),account=response.data;
  if(!account?.order||account.order.number!==origin)throw Error('No se pudo recuperar la compra de origen.');
  const form=root.getElementById('quote-form');
  const notice=root.createElement('section');notice.className='quote-draft-status';notice.id='exchange-origin-notice';
  const heading=root.createElement('strong');heading.textContent='Cambio desde '+origin;
  const detail=root.createElement('p');detail.textContent='Saldo de origen: '+money(account.position.credit)+'. Guarda el producto nuevo; después podrás aplicar el saldo y cobrar la diferencia.';
  const back=root.createElement('a');back.href='/orden.html?op='+encodeURIComponent(origin);back.textContent='Volver a la compra anterior';
  notice.append(heading,detail,back);form.prepend(notice);
  // A separate per-origin draft preserves any existing ordinary order draft.
  const documentInput=root.getElementById('quote-client-document');
  if(documentInput&&!documentInput.value){
    const values={document:account.order.document,name:account.order.client,phone:account.order.phone,alternatePhone:account.order.alternatePhone,email:account.order.email,address:account.order.address,city:account.order.city};
    for(const [key,value] of Object.entries(values)){const input=root.getElementById('quote-client-'+key);if(input&&!input.value)input.value=value||'';}
  }
  const notes=root.getElementById('quote-notes');if(notes&&!notes.value)notes.value='Cambio relacionado con '+origin+'.';
}

