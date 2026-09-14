import {browserReady,pdfOptions} from './order-documents.js';
export async function generateWarrantyPdf(env,document){
  if(document?.documentKind!=='warranty'||document.issued!==true||!document.number||!['RECEPCION','DOMICILIO'].includes(document.type))throw Object.assign(Error('No se confirmó el comprobante del expediente.'),{code:'DOCUMENT_PLAN_INVALID',status:503});
  if(!browserReady(env))throw Object.assign(Error('El generador de PDF no está disponible. El expediente se conserva.'),{code:'PDF_ENGINE_NOT_READY',status:503});
  const response=await env.BROWSER.quickAction('pdf',pdfOptions(document));
  if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Object.assign(Error('No se pudo generar el comprobante. Puedes reintentarlo desde el expediente.'),{code:'PDF_RENDER_FAILED',status:503});
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length<5||bytes.length>12000000||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Object.assign(Error('No se recibió un PDF válido.'),{code:'PDF_RENDER_FAILED',status:503});
  let base64='';for(let i=0;i<bytes.length;i+=24576)base64+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));
  return {name:(document.type==='RECEPCION'?'Recepcion-':'Atencion-domicilio-')+document.number+'.pdf',mime:'application/pdf',base64};
}

