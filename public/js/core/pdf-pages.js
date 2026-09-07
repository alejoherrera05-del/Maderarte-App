// A small image-only A4 PDF writer. The approved HTML is rasterized page by page;
// there is no document redesign, external PDF service, font distribution or CDN.
const encoder = new TextEncoder();
const bytes = text => encoder.encode(text);
const join = parts => {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
};
export function pdfFromJpegPages(pages) {
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 60) throw new Error('Cantidad de páginas no admitida.');
  const objects = [];
  const add = value => { objects.push(typeof value === 'string' ? bytes(value) : value); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>`);
  pages.forEach((page, i) => {
    if (!(page.jpeg instanceof Uint8Array) || page.jpeg[0] !== 255 || page.jpeg[1] !== 216 || !Number.isInteger(page.width) || !Number.isInteger(page.height)) throw new Error('Página rasterizada inválida.');
    const id = 3 + 3 * i;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Image ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    add(join([bytes(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`), page.jpeg, bytes('\nendstream')]));
    const draw = 'q\n595.2756 0 0 841.8898 0 0 cm\n/Image Do\nQ\n';
    add(`<< /Length ${bytes(draw).length} >>\nstream\n${draw}endstream`);
  });
  const parts = [bytes('%PDF-1.4\n%Maddy\n')], offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, i) => { offsets.push(length); const part = join([bytes(`${i + 1} 0 obj\n`), object, bytes('\nendobj\n')]); parts.push(part); length += part.length; });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  parts.push(bytes(xref)); return join(parts);
}
async function image(source) {
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('No se pudo preparar una imagen del documento.')); img.src = source; });
  return img;
}
async function embed(url, base) {
  if (url.startsWith('data:')) return url;
  const target = new URL(url, base);
  if (target.origin !== window.location.origin || !target.pathname.startsWith('/assets/')) throw new Error('El documento contiene un recurso externo no permitido.');
  const response = await fetch(target, { credentials: 'same-origin' });
  if (!response.ok) throw new Error('No se cargó un recurso de marca.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}
async function embeddedCss() {
  let result = '';
  for (const sheet of document.styleSheets) {
    let css = [...sheet.cssRules].map(rule => rule.cssText).join('\n');
    const matches = [...css.matchAll(/url\((['"]?)(.*?)\1\)/g)];
    for (const match of matches) css = css.replace(match[0], `url("${await embed(match[2], sheet.href || document.baseURI)}")`);
    result += css + '\n';
  }
  return result;
}
export async function rasterizedDocumentPdf(root) {
  await document.fonts.ready;
  const pages = [...root.querySelectorAll(':scope > .quote-preview-page')];
  if (!pages.length || pages.length > 60) throw new Error('El documento no tiene una paginación válida.');
  const css = await embeddedCss();
  const rendered = [];
  for (const page of pages) {
    const clone = page.cloneNode(true);
    for (const img of clone.querySelectorAll('img')) { img.src = await embed(img.getAttribute('src'), document.baseURI); img.removeAttribute('srcset'); }
    const width = Math.round(page.getBoundingClientRect().width), height = Math.round(page.getBoundingClientRect().height);
    if (width < 700 || height < 1000 || page.scrollHeight > height + 2) throw new Error('Una página se desborda; no se generará un PDF recortado.');
    const wrapper = document.createElement('div'); wrapper.className = 'quote-page'; wrapper.dataset.commercialDocument = 'order';
    const style = document.createElement('style');
    style.textContent = css + '\nhtml,body,.quote-page{margin:0!important;padding:0!important;background:#fff!important;} .quote-preview-page{margin:0!important;box-shadow:none!important;border-radius:0!important;}';
    wrapper.append(style, clone);
    const content = new XMLSerializer().serializeToString(wrapper);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${content}</foreignObject></svg>`;
    const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = await image(svgData);
    const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Fail closed for browsers which return an empty foreignObject image.
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let marks = 0; for (let i = 0; i < pixels.length; i += 40) if (pixels[i] < 210 || pixels[i + 1] < 210 || pixels[i + 2] < 210) marks++;
    if (marks < 500) throw new Error('Este navegador no pudo dibujar el documento. Conserva el pedido y completa los documentos desde Chrome actualizado.');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
    if (!blob) throw new Error('No se pudo exportar una página.');
    rendered.push({ width: canvas.width, height: canvas.height, jpeg: new Uint8Array(await blob.arrayBuffer()) });
    canvas.width = canvas.height = 1;
  }
  const pdf = pdfFromJpegPages(rendered);
  if (pdf.length > 16777216) throw new Error('El PDF supera 16 MB. No se ha eliminado ninguna referencia.');
  return { bytes: pdf, pages: pages.length };
}
