import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'public');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/login.html' : decoded;
  const full = resolve(join(root, normalize(requested)));
  return full === root || full.startsWith(root + sep) ? full : null;
}

const server = createServer(async (request, response) => {
  const path = safePath(request.url || '/');
  if (!path) {
    response.writeHead(400).end('Solicitud inválida');
    return;
  }
  try {
    const info = await stat(path);
    const filePath = info.isDirectory() ? join(path, 'index.html') : path;
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': types[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(content);
  } catch {
    try {
      const content = await readFile(join(root, '404.html'));
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(content);
    } catch {
      response.writeHead(404).end('No encontrado');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Maderarte App disponible en http://127.0.0.1:${port}`);
});
