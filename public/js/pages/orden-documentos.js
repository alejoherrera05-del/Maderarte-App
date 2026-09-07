import { apiRequest } from '../core/api.js';
import { photoReference, finishOrderDocuments } from '../core/order-media.js?v=documents-1';
// Photos and PDFs are read through the authenticated app. Drive files stay private.
export async function bindOrderDocuments(root, number, request = apiRequest) {
  const container = document.createElement('section'); container.className = 'od-card od-document-progress';
  const heading = document.createElement('h2'); heading.textContent = 'Archivo del pedido';
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  container.append(heading, message); root.querySelector('aside.od-stack')?.prepend(container);
  const button = (text, action) => {
    const node = document.createElement('button'); node.type = 'button'; node.className = 'od-document-button'; node.textContent = text;
    node.addEventListener('click', async () => {
      if (node.disabled) return;
      node.disabled = true;
      try { await action(); } catch (error) { message.textContent = error.message || 'No se pudo comprobar el archivo.'; }
      finally { node.disabled = false; }
    });
    return node;
  };
  try {
    const response = await request('ORDEN_DOCUMENTOS_ESTADO', { number });
    const state = response?.data;
    if (state?.number !== number || !Array.isArray(state.files)) throw new Error('No se pudieron consultar las referencias.');
    message.textContent = state.complete ? 'PDF y referencias confirmados.' : 'La venta ya está registrada. Su documentación todavía está pendiente.';
    for (const item of root.querySelectorAll('[data-order-item]')) {
      const files = state.files.filter(file => file.type === 'FOTO' && file.itemId === item.dataset.orderItem).sort((a,b) => a.position - b.position);
      if (!files.length) continue;
      const details = document.createElement('details'), summary = document.createElement('summary'), grid = document.createElement('div');
      details.className = 'od-photo-details'; summary.textContent = `Referencias (${files.length})`; grid.className = 'od-photo-grid';
      details.append(summary, grid); item.querySelector('.od-item-copy').append(details);
      let loaded = false;
      details.addEventListener('toggle', async () => {
        if (!details.open || loaded) return; loaded = true;
        for (const file of files) {
          const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = `${file.position}. ${file.name}`;
          figure.append(caption); grid.append(figure);
          if (file.ready) {
            try {
              const photo = await request('ORDEN_FOTO_LEER', { number, id: file.id }, { timeoutMs: 90000 });
              if (!/^data:image\/(png|jpeg|webp);base64,/.test(photo?.data?.dataUrl || '')) throw new Error();
              const image = document.createElement('img'); image.alt = file.name; image.src = photo.data.dataUrl; figure.prepend(image);
            } catch { caption.textContent += ' — No se pudo cargar. Cierra y vuelve a abrir el pedido para reintentar.'; }
          } else {
            const label = document.createElement('label'); label.textContent = 'Referencia pendiente: selecciona la misma imagen';
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
            label.append(input); figure.append(label);
            input.addEventListener('change', async () => {
              const selected = input.files?.[0]; if (!selected) return; input.disabled = true;
              try {
                const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(selected); });
                const photo = await photoReference({ name: selected.name, dataUrl }, file.position - 1);
                if (photo.manifest.sha256 !== file.sha256) throw new Error('La imagen elegida no coincide con la referencia guardada. No se reemplazó ninguna foto.');
                await request('ORDEN_FOTO_GUARDAR', { number, id: file.id, base64: photo.base64 }, { timeoutMs: 90000 });
                label.textContent = 'Referencia recuperada. Ya puedes completar los documentos.';
              } catch (error) { message.textContent = error.message; input.disabled = false; }
            });
          }
        }
      });
    }
    if (state.complete) {
      container.append(button('Abrir PDF', async () => {
        const popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
          const response = await request('ORDEN_PDF_LEER', { number }, { timeoutMs: 90000 });
          if (response.data?.mime !== 'application/pdf') throw new Error('No se recibió un PDF válido.');
          const bytes = Uint8Array.from(atob(response.data.base64), c => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          if (popup) popup.location.replace(url);
          else { const a = document.createElement('a'); a.href = url; a.download = response.data.name; a.click(); }
          window.setTimeout(() => URL.revokeObjectURL(url), 120000);
        } catch (error) { popup?.close(); throw error; }
      }));
    } else {
      container.append(button('Completar documentos de esta orden', async () => {
        await finishOrderDocuments(number, [], request, value => { message.textContent = value; });
        window.location.reload();
      }));
    }
  } catch (error) { message.textContent = error.message || 'No se pudo comprobar la documentación. No se modificó la orden.'; }
}
