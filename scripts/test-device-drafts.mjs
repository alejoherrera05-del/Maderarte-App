import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindFormDraft } from '../public/js/core/form-draft.js';
const key = 'maderarte.form-draft.v1.owner.quote';
const values = new Map();
let quota = false;
const storage = { getItem:k=>values.get(k)??null, setItem(k,v){ if(quota)throw Error('quota');values.set(k,v); }, removeItem:k=>values.delete(k) };
const legacyStorage = { getItem:()=>null, removeItem(){} };
const session = {profile:{uid:'owner'}};
let data = {client:'Cliente sintético',items:[{name:'Sofá',quantity:2}],photos:[['1',[{dataUrl:'data:image/png;base64,aGVsbG8='}]]]}, restored;
function page(restore = value=>{restored=value;}) {
 const dom = new JSDOM('<form id="quote-form"></form><div id="quote-draft-status"></div>',{url:'https://app.example.test'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 return {dom, draft:bindFormDraft({session,type:'quote',capture:()=>data,restore,storage,legacyStorage})};
}
let p=page();await p.draft.ready;p.draft.changed();
const confirmed=values.get(key);assert.ok(confirmed);assert.match(document.body.textContent,/Guardado en este dispositivo/);
p.dom.window.close();
// New page with no sessionStorage recovers values and photo bytes, even days later.
const entry=JSON.parse(confirmed);entry.savedAt-=7*24*60*60*1000;values.set(key,JSON.stringify(entry));
p=page();await p.draft.ready;assert.deepEqual(restored,data);
const last=values.get(key);quota=true;data={client:'Cambio no confirmado'};p.draft.changed();
assert.equal(values.get(key),last);assert.match(document.body.textContent,/últimos cambios/);quota=false;p.dom.window.close();
// A restore failure preserves the bytes and blocks subsequent blank overwrites.
p=page(()=>{throw Error('network during branch metadata');});await p.draft.ready;p.draft.changed();
assert.equal(values.get(key),last);assert.match(document.body.textContent,/no será sobrescrita/);p.dom.window.close();
// Another tab's newer draft cannot be overwritten or removed by this one.
p=page();await p.draft.ready;values.set(key,'other-tab-copy');p.draft.changed();p.draft.complete();
assert.equal(values.get(key),'other-tab-copy');p.dom.window.close();
// Completion removes only this draft and cannot resurrect it on pagehide.
values.clear();p=page();await p.draft.ready;p.draft.changed();p.draft.complete();
window.dispatchEvent(new window.Event('pagehide'));assert.equal(values.get(key),undefined);
p.dom.window.close();delete globalThis.window;delete globalThis.document;
console.log('OK · device drafts: tab closure, age, photos, quota, recovery failure, competing tab and completion');
