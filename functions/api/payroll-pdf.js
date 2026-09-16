import {browserReady,pdfOptions} from './order-documents.js';
export async function generatePayrollPdf(env,document){
 if(document?.documentKind!=='payroll'||!/^NOM-\d+$/.test(document.number||'')||!['EMITIDO','PAGADO','ANULADO'].includes(document.status))throw Object.assign(Error('No se confirmó el comprobante.'),{status:503,code:'PAYROLL_DOCUMENT_INVALID'});
 if(!browserReady(env))throw Object.assign(Error('El generador de PDF no está disponible. El comprobante se conserva.'),{status:503,code:'PDF_ENGINE_NOT_READY'});
 const response=await env.BROWSER.quickAction('pdf',pdfOptions(document));if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw Object.assign(Error('No se pudo generar el PDF. Puedes reintentarlo sin emitir otro comprobante.'),{status:503,code:'PDF_RENDER_FAILED'});
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<5||bytes.length>12000000||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('PDF inválido');let base64='';for(let i=0;i<bytes.length;i+=24576)base64+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));return {name:document.number+'-v'+document.revision+'.pdf',base64,mime:'application/pdf'};
}
