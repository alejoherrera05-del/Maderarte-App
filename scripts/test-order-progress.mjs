import assert from 'node:assert/strict';
import { finishOrderDocuments } from '../public/js/core/order-media.js';
const number = 'MP-QA-OP-0001';
let checks = 0;
const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
for (const photosCount of [0, 1, 2]) {
  let reads = 0, finalized = false;
  const uploaded = new Set(), events = [];
  const media = Array.from({length:photosCount},(_,i)=>({clientLineId:String(i+1),photoId:'p'+i,sha256:'a'.repeat(64),base64:'AQID'}));
  const files = () => [...media.map((p,i)=>({id:'slot'+i,type:'FOTO',...p,ready:uploaded.has('slot'+i),url:uploaded.has('slot'+i)?'https://drive.google.com/file/d/photo'+i+'/view':''})),{id:'pdf',type:'OP',ready:finalized,url:finalized?'https://drive.google.com/file/d/pdf/view':''}];
  const request = async(action,payload) => {
    if(action==='ORDEN_DOCUMENTOS_ESTADO'){reads++;return {data:{number,complete:finalized,files:files()}};}
    if(action==='ORDEN_FOTO_GUARDAR'){
      eq(events.at(-1).status, 'running');
      eq(events.filter(e=>e.step==='photos'&&e.status==='complete').length,0);
      uploaded.add(payload.id);return {data:{number,id:payload.id,ready:true}};
    }
    if(action==='ORDEN_DOCUMENTOS_FINALIZAR'){
      eq(events.at(-1).step,'document');eq(events.at(-1).status,'running');
      eq(events.filter(e=>e.step==='verify'&&e.status==='complete').length,0);
      finalized=true;return {data:{number,complete:true}};
    }
    throw Error(action);
  };
  const result=await finishOrderDocuments(number,media,request,()=>{},e=>events.push(e));
  eq(result.complete,true);eq(reads,2);eq(uploaded.size,photosCount);
  eq(events.at(-1).step,'verify');eq(events.at(-1).status,'complete');
  eq(events.some(e=>e.step==='photos'&&e.status==='skipped'),photosCount===0);
  const resumed=[];await finishOrderDocuments(number,[],request,()=>{},e=>resumed.push(e));
  eq(uploaded.size,photosCount);eq(resumed.at(-1).status,'complete');
}
for (const fault of ['upload','finalize','readback','wrong-photo']) {
  const events=[];let reads=0,finalized=false;
  const request=async(action,payload)=>{
    if(action==='ORDEN_DOCUMENTOS_ESTADO'){
      reads++;if(fault==='readback'&&reads===2)throw Error('lost status');
      return {data:{number,complete:finalized,files:[{id:'photo',clientLineId:'1',type:'FOTO',photoId:'p',sha256:'a',ready:false,url:''},{id:'pdf',type:'OP',ready:finalized,url:finalized?'url':''}]}};
    }
    if(action==='ORDEN_FOTO_GUARDAR'){
      if(fault==='upload')throw Error('lost upload');
      return {data:{number,id:fault==='wrong-photo'?'wrong':'photo',ready:true}};
    }
    if(action==='ORDEN_DOCUMENTOS_FINALIZAR'){
      if(fault==='finalize')throw Error('lost PDF');finalized=true;return {data:{number,complete:true}};
    }
  };
  await assert.rejects(()=>finishOrderDocuments(number,[{clientLineId:'1',photoId:'p',sha256:'a',base64:'x'}],request,()=>{},e=>events.push(e)));checks++;
  eq(events.some(e=>e.step==='verify'&&e.status==='complete'),false);
  if(fault==='upload'||fault==='wrong-photo')eq(events.some(e=>e.step==='photos'&&e.status==='complete'),false);
}
console.log(`OK · ${checks} comprobaciones de etapas reales, fotos omitidas, validación, relectura y respuestas perdidas. Sin escrituras reales.`);
