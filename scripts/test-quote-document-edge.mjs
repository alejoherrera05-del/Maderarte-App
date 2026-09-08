import assert from 'node:assert/strict';
import {finalizeQuoteDocuments} from '../functions/api/quote-documents.js';
const number='MP-QA-COT-0001',hash='a'.repeat(64);let checks=0;
for(const sandbox of [false,true]){
 let options;const env={QUOTE_SANDBOX_RENDER_ORIGIN:'https://qa-render.example.invalid',BROWSER:{quickAction:async(type,config)=>{options=config;return new Response('%PDF-1.4\nqa',{headers:{'content-type':'application/pdf'}});}}};
 await finalizeQuoteDocuments(number,env,async action=>action.endsWith('PREPARAR')?{number,complete:false,id:'pdf',planHash:hash,document:{number,issued:true,documentKind:'quote',...(sandbox?{sandbox:'QA-'+ 'a'.repeat(32)}:{})}}:{number,complete:true});
 const origin=sandbox?env.QUOTE_SANDBOX_RENDER_ORIGIN:'https://app.maderartepopayan.com';
 assert.equal(options.url,origin+'/cotizacion-render.html');checks++;
 const pattern=new RegExp(options.allowRequestPattern[0]);assert.ok(pattern.test(origin+'/js/pages/cotizacion-render.js'));checks++;
 assert.equal(pattern.test(origin.replace('.','X')+'/js/a.js'),false);checks++;
 assert.equal(pattern.test(origin+'/api/maderarte'),false);checks++;
}
for(const origin of ['http://example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://example.invalid/?x=1']){
 await assert.rejects(()=>finalizeQuoteDocuments(number,{QUOTE_SANDBOX_RENDER_ORIGIN:origin,BROWSER:{quickAction:async()=>{throw Error('must not render')}}},async()=>({number,complete:false,id:'pdf',planHash:hash,document:{number,issued:true,documentKind:'quote',sandbox:'QA-test'}})),e=>e.code==='QUOTE_RENDER_ORIGIN_INVALID');checks++;
}
console.log(`OK · ${checks} quote renderer origin and outbound-request boundary assertions.`);
