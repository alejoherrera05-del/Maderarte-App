import { createDocumentProgress } from '../core/order-progress.js?v=quote-1';
import { currentSandboxId, sandboxLink } from '../core/order-sandbox-context.js?v=quote-1';
import { prepareQuoteMedia } from '../core/quote-media.js?v=quote-1';
import { APP_CONFIG } from '../core/config.js';
import { apiRequest } from '../core/api.js?v=sandbox-1';
import { hasPermission } from '../core/permissions.js';
import { readSessionSnapshot } from '../core/session.js';
import { createQuoteSave } from '../core/quote-save.js?v=quote-1';
import { collectQuotePayload } from '../core/quote-payload.js?v=quote-1';

export function bindQuoteSave({ session, validate, branch, photos, draft, mediaBusy = () => false,
  request = apiRequest, navigate = path => window.location.assign(path) }) {
  if (APP_CONFIG.preview.enabled || !hasPermission(session, 'cotizaciones.create')) return null;
  const form = document.getElementById('quote-form'), button = document.getElementById('quote-submit'), note = document.querySelector('.quote-write-note');
  if (!form || !button || !note) return null;
  const progress = createDocumentProgress({ kind: 'quote', mode: 'save' });
  const defaultNote = note.textContent, error = document.getElementById('quote-form-error');
  const status = document.createElement('div'); status.className = 'quote-draft-status'; status.id = 'quote-save-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); status.hidden = true; note.insertAdjacentElement('afterend', status);
  const disabled = new Map(); let locked = false, lastPhase = '', confirmedRequest = '', manager;
  const disable = (node, value) => {
    if (!node) return;
    if (value) { if (!disabled.has(node)) disabled.set(node, node.disabled); node.disabled = true; }
    else if (disabled.has(node)) { node.disabled = disabled.get(node); disabled.delete(node); }
  };
  function freeze(value) {
    locked = value;
    document.querySelectorAll('#quote-form input, #quote-form select, #quote-form textarea, #quote-form button, #quote-change-branch, [data-quote-branch], #quote-draft-status button')
      .forEach(node => { if (node !== button && !status.contains(node)) disable(node, value); });
    disable(document.getElementById('quote-preview-button'), value); draft()?.setLocked(value);
  }
  function action(text, handler) {
    const node = document.createElement('button'); node.type='button'; node.className='quote-secondary-action'; node.textContent=text; node.addEventListener('click',()=>{void handler();}); status.append(node);
  }
  const quotePath = number => sandboxLink(`/cotizacion-detalle.html?cot=${encodeURIComponent(number)}`);
  function render(state) {
    freeze(state.locked); progress.sync(state);
    button.disabled = !state.canSave;
    button.textContent = state.phase === 'saving' ? 'Emitiendo cotización…' : state.phase === 'documents' ? 'Documento pendiente' : state.phase === 'confirmed' ? 'Cotización emitida' : 'Emitir cotización';
    button.setAttribute('aria-busy', String(['saving','checking'].includes(state.phase)));
    note.textContent = ['disabled','ready'].includes(state.phase) ? defaultNote : state.message;
    status.replaceChildren();
    status.hidden = state.working === true || !['uncertain','retry','confirmed','documents','other-tab','blocked','rejected'].includes(state.phase);
    if (!status.hidden) {
      if (state.phase === 'confirmed') {
        action('Abrir cotización emitida', () => navigate(quotePath(state.number)));
        if (!currentSandboxId()) action('Nueva cotización', async () => { const result=await manager.startNew(()=>draft()?.complete()); if(result.phase==='new') window.location.reload(); });
        if (state.ownsDraft && confirmedRequest !== state.requestId) { confirmedRequest=state.requestId; draft()?.complete(); }
      } else if (state.phase === 'documents') {
        action('Completar documento', () => manager.refresh());
        action('Abrir cotización registrada', () => navigate(quotePath(state.number)));
      } else {
        action(state.locked ? 'Consultar resultado' : 'Comprobar disponibilidad', () => manager.refresh());
        if (state.phase === 'retry') action('Reenviar el mismo intento', () => manager.retry());
      }
    }
    if (state.phase !== lastPhase && status.firstElementChild && state.phase !== 'confirmed') status.firstElementChild.focus({preventScroll:true});
    lastPhase=state.phase;
  }
  try {
    manager=createQuoteSave({ uid:session.profile.uid, scope:currentSandboxId(), request, durable:window.localStorage, temporary:window.sessionStorage,
      locks:window.navigator.locks, crypto:window.crypto, activeUid:()=>readSessionSnapshot()?.profile.uid||'', onState:render, onProgress:progress.update });
  } catch {
    button.disabled=true; note.textContent='No se pudo comprobar la recuperación. Puedes conservar y revisar el borrador, sin emitirlo todavía.'; return null;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if(locked || !manager.getState().canSave) return; if(!validate()) return;
    if(mediaBusy() || [...document.querySelectorAll('[data-photo-input]')].some(input=>input.files?.length)) {
      error.textContent='Termina de cargar las fotografías antes de emitir. No se descartará ninguna referencia.'; return;
    }
    let payload; const selectedPhotos=new Map([...photos()].map(([id,values])=>[id,values.map(value=>({...value}))]));
    try {
      payload=collectQuotePayload({branch:branch()}); freeze(true); button.disabled=true; button.setAttribute('aria-busy','true');
      progress.begin(); progress.update({step:'prepare',status:'running',message:'Reviso cliente, muebles, cantidades, acabados y valores antes de emitir nada.'});
      payload=await prepareQuoteMedia(payload,selectedPhotos,progress.update);
      progress.update({step:'prepare',status:'complete',message:'La propuesta quedó validada y sus referencias están listas para el mismo intento.'});
    } catch(failure) {
      freeze(false);button.disabled=!manager.getState().canSave;button.setAttribute('aria-busy','false');progress.pause(failure.message);error.textContent=failure.message;return;
    }
    draft()?.save(); error.textContent=''; render({phase:'saving',locked:true,canSave:false,message:'Voy a reservar el número oficial y registrar esta misma propuesta.'});
    const result=await manager.save(payload); if(result.phase==='confirmed') navigate(quotePath(result.number));
  });
  window.addEventListener('storage',event=>{if(event.key===manager.key){freeze(true);button.disabled=true;void manager.refresh();}});
  window.addEventListener('pageshow',event=>{if(event.persisted)void manager.refresh();});
  window.addEventListener('beforeunload',event=>{if(locked&&manager.getState().phase!=='confirmed'){event.preventDefault();event.returnValue='';}});
  void manager.refresh(); return manager;
}
