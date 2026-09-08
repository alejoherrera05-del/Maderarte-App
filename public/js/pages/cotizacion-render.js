import { openDocumentPreview } from './cotizacion-document-polish.js?v=quote-1';

let started=false;
const numberPattern=/^[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{4,}$/;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function fail(){throw new Error('Documento no válido');}
function setValue(id,value){const node=document.getElementById(id);if(node)node.value=String(value??'');}
function setText(id,value){const node=document.getElementById(id);if(node)node.textContent=String(value??'');}
function addItem(item,index){
  if(!item||typeof item!=='object'||!Number.isSafeInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(item.unitValue)||item.unitValue<1||item.subtotal!==item.quantity*item.unitValue||!Array.isArray(item.photos)||item.photos.length>6)fail();
  for(const photo of item.photos)if(typeof photo!=='string'||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))fail();
  const card=document.createElement('article');card.className='quote-item';card.dataset.itemId=String(index+1);
  const fields={description:item.description||'',category:item.category||'',quantity:item.quantity,unitValue:item.unitValue,fabric:item.fabric||'',wood:item.wood||'',specifications:item.specifications||''};
  for(const [name,value] of Object.entries(fields)){const input=document.createElement(name==='specifications'?'textarea':name==='category'?'select':'input');input.dataset.field=name;input.value=String(value);if(name==='category'&&value){const option=document.createElement('option');option.value=String(value);option.textContent=String(value);input.append(option);input.value=String(value);}card.append(input);}
  const photos=document.createElement('div');photos.className='quote-photo-list';
  item.photos.forEach((src,photoIndex)=>{const thumb=document.createElement('div');thumb.className='quote-photo-thumb';const image=document.createElement('img');image.src=src;image.alt=`Referencia ${photoIndex+1}`;thumb.append(image);photos.append(thumb);});
  card.append(photos);document.getElementById('quote-items').append(card);
}
async function consume(){
  const node=document.getElementById('maddy-document-data');if(started||!node||node.type!=='application/json')return;started=true;
  const target=document.getElementById('quote-preview-content');
  try{
    const snapshot=JSON.parse(node.textContent);node.remove();
    if(!snapshot||snapshot.kind!=='quote'||snapshot.issued!==true||!numberPattern.test(snapshot.number||'')||!['MP','TP'].includes(snapshot.branchCode)||!integer(snapshot.subtotal)||!integer(snapshot.discount)||!integer(snapshot.total)||snapshot.total!==snapshot.subtotal-snapshot.discount||!Array.isArray(snapshot.items)||!snapshot.items.length||snapshot.items.length>100)fail();
    if(!snapshot.client||typeof snapshot.client!=='object')fail();
    let subtotal=0;snapshot.items.forEach((item,index)=>{subtotal+=item.subtotal;addItem(item,index);});if(subtotal!==snapshot.subtotal)fail();
    setText('quote-meta-number',snapshot.number);setText('quote-meta-date',snapshot.date);setText('quote-meta-advisor',snapshot.advisor||'');setText('quote-meta-branch',snapshot.branchCode);setText('quote-meta-branch-name',snapshot.branchCode);
    for(const key of ['document','name','phone','alternatePhone','email','address','city'])setValue('quote-client-'+key,snapshot.client[key]||'');
    setValue('quote-discount',snapshot.discount);setValue('quote-notes',snapshot.notes||'');
    openDocumentPreview();
    const startedAt=Date.now();
    while(target.getAttribute('aria-busy')!=='false'||!target.querySelector('.quote-preview-page')){if(Date.now()-startedAt>20000)throw new Error('Render incompleto');await new Promise(resolve=>setTimeout(resolve,40));}
    await document.fonts?.ready;
    await Promise.all([...target.querySelectorAll('img')].map(async image=>{await image.decode();if(!image.naturalWidth)throw new Error('Imagen incompleta');}));
    target.dataset.documentReady='true';
  }catch{target.replaceChildren();target.dataset.documentError='true';}
}
new MutationObserver(()=>{void consume();}).observe(document.documentElement,{childList:true,subtree:true});
void consume();
