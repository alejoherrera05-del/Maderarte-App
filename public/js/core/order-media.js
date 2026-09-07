// Private per-account binary recovery; no credentials or payment notes.
const DB = 'maddy-document-media-v1', TABLE = 'files', TTL = 48 * 60 * 60 * 1000, LIMIT = 8 * 1024 * 1024;
export async function fileHash(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function decodeDataUrl(url) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(url || '');
  if (!match) throw new Error('La fotografía no es compatible. No se ha descartado ninguna referencia.');
  const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
  if (!bytes.length || bytes.length > LIMIT) throw new Error('Cada fotografía debe ocupar como máximo 8 MB. El pedido aún no se ha enviado.');
  return { bytes, mime: match[1] };
}
export function encodeBytes(bytes) { let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(binary); }
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('No hay almacenamiento para recuperar las fotos. Usa otro navegador antes de guardar.'));
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(TABLE, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('No se pudo abrir la recuperación privada de archivos.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de Maddy para preparar la recuperación.'));
  });
}
async function transaction(mode, operation) {
  const database = await openDatabase();
  try { return await new Promise((resolve, reject) => {
    const tx = database.transaction(TABLE, mode), result = operation(tx.objectStore(TABLE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = tx.onabort = () => reject(new Error('No hay espacio para asegurar los archivos. El pedido no se enviará sin conservar sus fotos.'));
  }); } finally { database.close(); }
}
export function createMediaVault(uid, environment = '') {
  if (!uid) throw new Error('Inicia sesión para conservar tus archivos.');
  const prefix = encodeURIComponent(uid) + ':' + environment + ':';
  return {
    async put(id, value) {
      const key = prefix + id;
      await transaction('readwrite', store => store.put({ key, value, expires: Date.now() + TTL }));
      const saved = await transaction('readonly', store => store.get(key));
      if (!saved || !saved.value?.bytes || await fileHash(saved.value.bytes) !== await fileHash(value.bytes)) throw new Error('No se pudo verificar la copia de recuperación del archivo.');
    },
    async get(id) { const saved = await transaction('readonly', store => store.get(prefix + id)); if (!saved || saved.expires < Date.now()) { if (saved) await this.remove(id); return null; } return saved.value; },
    async remove(id) { await transaction('readwrite', store => store.delete(prefix + id)); }
  };
}
export async function clearDocumentMedia() { try { await transaction('readwrite', store => store.clear()); } catch { /* A blocked store cannot be read either. */ } }
export async function preparePhotoManifests(photos, vault) {
  const result = new Map();
  for (const [line, sources] of photos) {
    if (sources.length > 10) throw new Error('Admite hasta diez referencias por mueble; no se ha enviado el pedido.');
    const entries = [];
    for (const [index, source] of sources.entries()) {
      const file = decodeDataUrl(source.dataUrl), sha256 = await fileHash(file.bytes);
      await vault.put(sha256, file);
      entries.push({ id: 'r' + (index + 1), name: String(source.name || 'Referencia').slice(0, 160), mime: file.mime, bytes: file.bytes.length, sha256 });
    }
    result.set(String(line), entries);
  }
  return result;
}
