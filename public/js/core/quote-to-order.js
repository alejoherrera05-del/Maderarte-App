// HomeEasy parity: quote action -> existing order form with confirmed data.
export const conversionNumber = search => {
  const params = new URLSearchParams(search);
  if (!params.has('cotizacion')) return '';
  const value = params.get('cotizacion');
  if (!/^(MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(value || '')) throw new Error('El enlace de cotización no es válido.');
  return value;
};

export async function loadQuoteOrder(number, request) {
  const { data } = await request('COTIZACION_PREPARAR_PEDIDO', { number }, { timeoutMs: 90000 });
  if (data?.number !== number) throw new Error('No se confirmó la cotización de origen.');
  if (data.convertedOrder) {
    if (!/^(MP|TP)-[A-Z0-9-]+-[0-9]+$/.test(data.convertedOrder)) throw new Error('El pedido vinculado requiere revisión.');
    return { convertedOrder: data.convertedOrder };
  }
  if (!/^[a-f0-9]{64}$/.test(data.fingerprint || '') || !Array.isArray(data.source?.items) || !data.source.items.length) throw new Error('La propuesta no está completa.');
  const source = data.source, origin = { number, fingerprint: data.fingerprint };
  const fields = Object.entries(source.client).map(([key,value]) => ({ id: `quote-client-${key}`, value: String(value) }));
  fields.push({ id: 'quote-notes', value: source.notes }, { id: 'quote-discount', value: String(source.discount) });
  const photos = [];
  for (const [index,item] of source.items.entries()) {
    const id = index + 1;
    for (const key of ['description','category','quantity','unitValue','fabric','wood','specifications']) fields.push({ id: `quote-item-${id}-${key}`, value: String(item[key] ?? '') });
    const references = [];
    for (const photo of item.photos) {
      const response = await request('COTIZACION_FOTO_LEER', { number, id: photo.slotId }, { timeoutMs: 90000 });
      const value = response.data;
      if (value?.id !== photo.slotId || !/^data:image\/(png|jpeg|webp);base64,/.test(value?.dataUrl || '')) throw new Error('Falta recuperar una referencia. No se abrirá un pedido incompleto.');
      references.push({ name: photo.name, dataUrl: value.dataUrl });
    }
    photos.push([id,references]);
  }
  return { origin, draft: { quoteOrigin: origin, branch: source.branch, itemIds: source.items.map((_,i)=>i+1), paymentIds: [], fields, photos } };
}

export function lockQuoteSource(root = document) {
  // Commercial values remain those of the quote; order-specific choices stay editable.
  root.querySelectorAll('[id^="quote-client-"], .quote-item [data-field], #quote-discount').forEach(input => {
    if (input.matches('input,textarea')) input.readOnly = true;
    else if (input.matches('select')) input.disabled = true;
  });
  root.querySelectorAll('#quote-change-branch, #quote-add-item, [data-remove-item], [data-add-photos], [data-photo-input], [data-photo-list] button').forEach(button => { button.disabled = true; });
}
