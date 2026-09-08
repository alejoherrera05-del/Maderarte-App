import { browserReady, pdfOptions } from './order-documents.js';
// Fixed fictitious sample. Never accepts customer data or reserves a commercial number.
export function receiptSample(){return {documentKind:'receipt',issued:true,sandbox:true,number:'MUESTRA-001',orderNumber:'OP-MUESTRA',date:'2026-09-08T17:00:00Z',branchCode:'MP',advisor:'Asesor de muestra',client:{name:'Cliente de muestra',document:'00000000',phone:'0000000000',email:'muestra@example.invalid',address:'Dirección de muestra',city:'Popayán'},concept:'Abono a la orden de pedido.\nCompra de sala y comedor.',reference:'Transferencia de muestra',method:'TRANSFERENCIA',amount:500000,previousBalance:2500000,balance:2000000,total:3300000};}
export async function generateReceiptSample(env){
  if(!browserReady(env))throw Object.assign(Error('El generador de PDF no está disponible.'),{code:'PDF_ENGINE_NOT_READY',status:503});
  const response=await env.BROWSER.quickAction('pdf',pdfOptions(receiptSample()));
  if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Object.assign(Error('No se pudo generar la muestra. Vuelve a intentarlo.'),{code:'PDF_RENDER_FAILED',status:503});
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<5||bytes.length>12000000||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Object.assign(Error('El generador no entregó un PDF válido.'),{code:'PDF_RENDER_FAILED',status:503});
  let base64='';for(let i=0;i<bytes.length;i+=24576)base64+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));
  return {name:'Recibo-muestra-media-carta.pdf',mime:'application/pdf',base64,sample:true};
}
