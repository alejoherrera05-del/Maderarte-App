// Explicit URL context only. Never carry test mode into a normal tab implicitly.
export const SANDBOX_ID = /^QA-[a-f0-9]{32}$/;
const scopedActions = new Set([
  'COTIZACION_META','CLIENTES_LISTAR','CLIENTE_OBTENER',
  'COTIZACION_OBTENER','COTIZACION_CAPACIDADES','COTIZACION_CREAR','COTIZACION_CREACION_ESTADO',
  'COTIZACION_DOCUMENTOS_ESTADO','COTIZACION_FOTO_GUARDAR','COTIZACION_FOTO_LEER','COTIZACION_PDF_LEER','COTIZACION_DOCUMENTOS_FINALIZAR',
  'ORDEN_CAPACIDADES','ORDEN_CREAR','ORDEN_CREACION_ESTADO','ORDEN_OBTENER','ORDEN_DOCUMENTOS_ESTADO','ORDEN_FOTO_GUARDAR','ORDEN_FOTO_LEER','ORDEN_PDF_LEER','ORDEN_DOCUMENTOS_FINALIZAR'
]);
export function currentSandboxId() {
  if (typeof window === 'undefined' || !window.location) return '';
  const url = new URL(window.location.href);
  if (!url.searchParams.has('prueba')) return '';
  const id = url.searchParams.get('prueba');
  if (!SANDBOX_ID.test(id || '')) throw new Error('El enlace de prueba no es válido. Vuelve al control de pruebas.');
  return id;
}
export function sandboxRequestContext(action) {
  if (!scopedActions.has(action)) return {};
  const id = currentSandboxId();
  return id ? { sandboxId: id } : {};
}
export function sandboxLink(path, id = currentSandboxId()) {
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error('El enlace debe permanecer dentro de Maddy.');
  if (id) {
    if (!SANDBOX_ID.test(id)) throw new Error('Ensayo no válido.');
    url.searchParams.set('prueba', id);
  }
  return url.pathname + url.search + url.hash;
}
export function sandboxDraftType(type) {
  const id = currentSandboxId(); return id ? `${type}:${id}` : type;
}
export const syntheticClient = Object.freeze({ document:'0000000001',name:'PRUEBA MADDY - NO ES UNA VENTA',phone:'0000000011',alternatePhone:'0000000022',email:'qa@example.invalid',address:'SIN ENTREGA - DATOS FICTICIOS',city:'Popayán (prueba)' });
export function bindSandboxBanner(root, { prefill = false } = {}) {
  const id = currentSandboxId(); if (!id || !root) return;
  const banner = document.createElement('aside'); banner.className='os-banner'; banner.setAttribute('aria-label','Modo de prueba');
  const strong=document.createElement('strong'),copy=document.createElement('span'),back=document.createElement('a');
  strong.textContent='MODO DE PRUEBA · SIN VALIDEZ COMERCIAL';
  copy.textContent='Una operación comercial aislada. No cobra, no entrega y no consume consecutivos de producción.';
  back.href='/prueba-pedido.html';back.textContent='Control y limpieza de la prueba';banner.append(strong,copy,back);
  const anchor=root.querySelector('.quote-document-head, .od-hero');
  if(anchor)anchor.before(banner);else root.prepend(banner);
  root.querySelectorAll('.quote-header a, .od-header a').forEach(a=>{ a.href='/prueba-pedido.html'; });
  if (prefill) {
    for(const [field,value] of Object.entries(syntheticClient)) {
      const input=root.querySelector(`#quote-client-${field}`);if(!input)continue;
      input.value=value;input.readOnly=true;input.setAttribute('aria-readonly','true');
    }
    const writeNote=root.querySelector('.quote-write-note');if(writeNote)writeNote.textContent='Solo registra una prueba en la hoja y carpeta aisladas. Revisa el PDF y sus referencias antes de autorizar la limpieza.';
  }
}
