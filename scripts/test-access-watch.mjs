import assert from 'node:assert/strict';
import {watchAccess,accessFingerprint} from '../public/js/core/access-watch.js';
const session={profile:{uid:'staff',role:'VENDEDOR',status:'ACTIVO',branches:['MP']},permissions:['app.access','ordenes.read'],validatedAt:1000};
const flush=()=>new Promise(r=>setImmediate(r));
function harness(validate){const target=new EventTarget(),doc=new EventTarget();let tick,clock=1000,changed=0,denied=0;doc.visibilityState='visible';target.setInterval=cb=>(tick=cb,1);target.clearInterval=()=>{};const stop=watchAccess({session,validate,onChanged:()=>changed++,onDenied:()=>denied++,target,doc,now:()=>clock});return {target,doc,stop,run:async()=>{clock+=60000;tick();await flush();},get changed(){return changed;},get denied(){return denied;}};}
assert.equal(accessFingerprint(session),accessFingerprint({...session,permissions:[...session.permissions].reverse()}));
let calls=0;const a=harness(async()=>{calls++;return {...session,permissions:['app.access']};});
await a.run();assert.equal(a.changed,1);await a.run();assert.equal(calls,1);
const b=harness(async()=>{throw {transient:true};});await b.run();assert.equal(b.denied,0);b.stop();
const d=harness(async()=>{throw {code:'USER_INACTIVE'};});await d.run();assert.equal(d.denied,1);
let resolve,requests=0;const e=harness(()=>{requests++;return new Promise(r=>resolve=r);});
e.target.dispatchEvent(new Event('maddy:access-recheck'));e.target.dispatchEvent(new Event('maddy:access-recheck'));assert.equal(requests,1);resolve(session);await flush();e.stop();
const h=harness(async()=>{calls++;return session;});h.doc.visibilityState='hidden';const count=calls;await h.run();assert.equal(calls,count);h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,count+1);h.stop();
console.log('Live access: revocation, permission changes, offline preservation, hidden tabs, visibility resume and single in-flight validation passed.');
