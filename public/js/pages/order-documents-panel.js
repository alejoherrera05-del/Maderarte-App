import { APP_CONFIG, withPreview } from '../core/config.js';
import { apiRequest } from '../core/api.js';
import { createMediaVault, fileHash } from '../core/order-media.js';
import { createDocumentFlow, renderOrderPdf } from '../core/order-document-flow.js';
import { readSessionSnapshot } from '../core/session.js';
export function mountOrderDocuments({ number, uid, host, request = apiRequest, onComplete = () => {}, auto = false, vault = createMediaVault(uid, APP_CONFIG.trial ? 'QA' : '') }) {
  host.classList.add('order-document-progress'); host.setAttribute('aria-live', 'polite'); host.replaceChildren();
  const message = document.createElement('p'), controls = document.createElement('div'); host.append(message, controls);
  let running = false;
  const active = () => readSessionSnapshot()?.profile.uid === uid;
  const flow = createDocumentFlow({ number, request, vault, renderPdf: renderOrderPdf, active, progress: text => { message.textContent = text; } });
  const button = (text, click) => { const node = document.createElement('button'); node.type = 'button'; node.className = 'quote-secondary-action'; node.textContent = text; node.addEventListener('click', () => { void click(); }); controls.append(node); return node; };
  async function completed(state) {
    message.textContent = `Pedido ${number}: fotografías, orden y recibos archivados y enlazados.`; controls.replaceChildren();
    button('Abrir pedido', () => window.location.assign(withPreview(`/orden.html?op=${encodeURIComponent(number)}`)));
    const files = document.createElement('div'); files.className = 'order-file-list'; controls.append(files);
    for (const file of state.files.filter(file => file.ready)) {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = file.name;
      node.addEventListener('click', async () => {
        node.disabled = true;
        try { const content = await flow.readFile(file); const url = URL.createObjectURL(new Blob([content.bytes], { type: content.mime })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
        catch (error) { message.textContent = error.message; } finally { node.disabled = false; }
      }); files.append(node);
    }
    onComplete(state);
  }
  async function run(options) {
    if (running) return; running = true; controls.replaceChildren(); host.setAttribute('aria-busy', 'true');
    try {
      if (!navigator.locks?.request) throw new Error('Este navegador no permite bloquear cargas simultáneas. Usa Chrome actualizado.');
      await navigator.locks.request(`maddy-docs:${APP_CONFIG.trial ? 'QA' : 'OP'}:${number}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Los documentos se están completando en otra pestaña. Consulta el pedido antes de continuar.');
        await completed(await flow.complete(options));
      });
    } catch (error) {
      message.textContent = `El pedido ${number} ya está guardado. ${error.message || 'Falta completar sus archivos.'}`;
      button('Continuar archivos de este pedido', () => run());
      if (error.code === 'PDF_REGENERATION_REQUIRED') button('Regenerar solo PDF pendiente', () => run({ regeneratePendingPdf: true }));
      if (error.code === 'PHOTO_ORIGINAL_REQUIRED') {
        const label = document.createElement('label'); label.textContent = 'Adjuntar los originales pendientes';
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif'; input.multiple = true; label.append(input); controls.append(label);
        input.addEventListener('change', async () => {
          input.disabled = true;
          try {
            const state = await flow.state(), expected = state.snapshot.items.flatMap(item => item.photos);
            for (const file of input.files) {
              const bytes = new Uint8Array(await file.arrayBuffer()), hash = await fileHash(bytes);
              const photo = expected.find(photo => photo.sha256 === hash && photo.bytes === bytes.length);
              if (!photo) throw new Error(`«${file.name}» no coincide con un original del pedido. No se reemplazó ninguna foto.`);
              await vault.put(hash, { bytes, mime: photo.mime });
            }
            message.textContent = 'Originales comprobados. Continúa los archivos del mismo pedido.';
          } catch (failure) { message.textContent = failure.message; } finally { input.disabled = false; input.value = ''; }
        });
      }
    } finally { running = false; host.setAttribute('aria-busy', 'false'); }
  }
  message.textContent = `Los datos del pedido ${number} están guardados; los documentos se verifican por separado.`;
  button('Completar fotos y documentos', () => run()); if (auto) void run(); return { run, flow };
}
