// Only the dedicated renderer permits embedding, restricted to this origin.
export const DOCUMENT_PATH = '/documento.html';
export function secureDocumentResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'");
  headers.set('X-Frame-Options', 'SAMEORIGIN'); headers.set('Cache-Control', 'no-store'); headers.set('X-Content-Type-Options', 'nosniff'); headers.set('Referrer-Policy', 'no-referrer'); headers.set('Cross-Origin-Resource-Policy', 'same-origin'); headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
