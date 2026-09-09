import { escapeHtml as esc } from './format.js';
import { currentSandboxId } from './order-sandbox-context.js';
export function supplierDirectory(storage,scope) {
 const key='maddy.supplier-contacts.v1.'+encodeURIComponent(scope);
 function list(){try{const rows=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(rows)?rows.filter(p=>p&&typeof p.name==='string'&&typeof p.phone==='string'&&typeof p.favorite==='boolean'&&Number.isFinite(p.lastUsed)).slice(0,30):[];}catch{return [];}}
 function save(person){const name=person.name.trim().replace(/\s+/g,' '),phone=person.phone.trim();if(!name||name.length>120)throw Error('Escribe el nombre del proveedor.');if(phone&&!/^\+?[\d\s()-]{10,24}$/.test(phone))throw Error('Revisa el WhatsApp del proveedor.');const rows=list().filter(p=>p.name.toLocaleLowerCase('es')!==name.toLocaleLowerCase('es'));rows.unshift({name,phone,favorite:!!person.favorite,lastUsed:Date.now()});storage.setItem(key,JSON.stringify(rows.slice(0,30)));return rows[0];}
 return {list,save};
}
export function bindSupplierDirectory({uid,root,name,phone,onSelect}) {
 const status=root.querySelector('[role=status]'),list=root.querySelector('[data-supplier-list]'),favorite=root.querySelector('[data-supplier-favorite]');
 let storage;try{storage=window.localStorage;}catch{status.textContent='Este navegador no permite guardar contactos.';return;}
 const directory=supplierDirectory(storage,uid+':'+currentSandboxId());
 function render(){const query=name.value.trim().toLocaleLowerCase('es');const rows=directory.list().filter(p=>!query||p.name.toLocaleLowerCase('es').includes(query)).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||b.lastUsed-a.lastUsed);
 list.innerHTML=rows.length?rows.map((p,i)=>`<button type="button" class="supplier-person" data-person="${i}"><span class="supplier-avatar">${esc(p.name.split(/\s+/).slice(0,2).map(v=>v[0]).join(''))}</span><span><strong>${esc(p.name)}</strong><small>${p.favorite?'Favorito':'Reciente'}${p.phone?' · '+esc(p.phone):''}</small></span><img src="/assets/icons/caret-right.svg" alt=""></button>`).join(''):'<p class="supplier-empty">'+(query?'Puedes guardar este proveedor.':'Tus proveedores aparecerán aquí al guardarlos.')+'</p>';
 list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const p=rows[Number(b.dataset.person)];name.value=p.name;phone.value=p.phone;favorite.checked=p.favorite;directory.save(p);status.textContent='Contacto seleccionado.';onSelect();render();}));}
 root.querySelector('[data-supplier-save]').addEventListener('click',()=>{try{directory.save({name:name.value,phone:phone.value,favorite:favorite.checked});status.textContent='Contacto guardado en este navegador.';render();}catch(e){status.textContent=e.message;}});
 name.addEventListener('input',()=>{const p=directory.list().find(p=>p.name.toLocaleLowerCase('es')===name.value.trim().toLocaleLowerCase('es'));favorite.checked=p?.favorite===true;render();});render();return directory;
}
