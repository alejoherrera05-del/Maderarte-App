const TEXT_FIELDS = ['description', 'category', 'fabric', 'wood', 'specifications'];

function prefixThatFits(text, accepts) {
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (accepts(text.slice(0, middle))) low = middle;
    else high = middle - 1;
  }
  if (low < text.length) {
    const boundary = text.slice(0, low).search(/\s+\S*$/);
    if (boundary > 0) low = boundary;
  }
  return low;
}

// `fits` measures the real approved layout in an A4-width document. It is also
// injectable to test ordering, splitting and conservation without a browser.
export function paginateQuoteDocument(data, fits) {
  const page = (client = false) => ({ client, items: [], closing: false, notes: '' });
  const original = { client: true, items: data.items, closing: true, notes: data.notes };
  if (fits(original)) return [original];
  const pages = [page(true)];
  let current = pages[0];
  if (!fits(current)) throw new Error('La información del cliente no cabe en una página. Revisa los campos antes de preparar el documento.');
  const nextPage = () => {
    current = page();
    pages.push(current);
  };
  const fitsItem = item => fits({ ...current, items: [...current.items, item] });

  for (const item of data.items) {
    if (!fitsItem(item) && (current.items.length || current.client)) nextPage();
    if (fitsItem(item)) { current.items.push(item); continue; }

    const remaining = Object.fromEntries(TEXT_FIELDS.map(field => [field, String(item[field] || '')]));
    if (!TEXT_FIELDS.some(field => remaining[field])) throw new Error('No se pudo preparar un producto. Revisa sus datos e inténtalo de nuevo.');
    let continuation = false;
    while (TEXT_FIELDS.some(field => remaining[field])) {
      const fragment = { ...item, continuation, ...Object.fromEntries(TEXT_FIELDS.map(field => [field, ''])) };
      let consumed = 0;
      for (const field of TEXT_FIELDS) {
        const text = remaining[field];
        if (!text) continue;
        const take = prefixThatFits(text, value => fitsItem({ ...fragment, [field]: value }));
        fragment[field] = text.slice(0, take).trimEnd();
        remaining[field] = text.slice(take).trimStart();
        consumed += take;
        if (remaining[field]) break;
      }
      if (!consumed) throw new Error('No se pudo distribuir un producto entre las páginas. Revisa sus datos e inténtalo de nuevo.');
      current.items.push(fragment);
      continuation = true;
      if (TEXT_FIELDS.some(field => remaining[field])) nextPage();
    }
  }

  const closing = { ...current, closing: true, notes: data.notes };
  if (fits(closing)) { pages[pages.length - 1] = closing; return pages; }
  const closingAlone = { ...page(), closing: true, notes: data.notes };
  if (fits(closingAlone)) {
    // Keep the closing with the last product when there is room, instead of
    // leaving totals alone on a mostly empty sheet.
    if (current.items.length > 1) {
      const lastItem = current.items.at(-1);
      const withLastItem = { ...closingAlone, items: [lastItem] };
      if (fits(withLastItem)) {
        current.items.pop();
        pages.push(withLastItem);
        return pages;
      }
    }
    pages.push(closingAlone);
    return pages;
  }

  // Long notes receive their own pages. Commercial terms and totals appear
  // exactly once, at the end; no content is cropped to force a one-page quote.
  let notes = String(data.notes || '').trim();
  while (notes) {
    const notesPage = page();
    const take = prefixThatFits(notes, value => fits({ ...notesPage, notes: value }));
    if (!take) throw new Error('No se pudieron distribuir las observaciones. Intenta preparar nuevamente el documento.');
    notesPage.notes = notes.slice(0, take).trimEnd();
    notes = notes.slice(take).trimStart();
    pages.push(notesPage);
  }
  const final = { ...page(), closing: true };
  if (!fits(final)) throw new Error('No se pudo preparar el cierre de la cotización. Inténtalo nuevamente.');
  pages.push(final);
  return pages;
}
