import assert from 'node:assert/strict';
import { handleRequest } from '../functions/api/maderarte.js';

async function readJson(response) {
  return JSON.parse(await response.text());
}

const getResponse = await handleRequest(new Request('https://app.example.com/api/maderarte'));
assert.equal(getResponse.status, 200);
assert.equal((await readJson(getResponse)).code, 'EDGE_OK');

const noConfig = await handleRequest(new Request('https://app.example.com/api/maderarte', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
  body: JSON.stringify({ action: 'PING' })
}), {});
assert.equal(noConfig.status, 503);
assert.equal((await readJson(noConfig)).code, 'API_NOT_CONFIGURED');

const crossOrigin = await handleRequest(new Request('https://app.example.com/api/maderarte', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
  body: JSON.stringify({ action: 'PING' })
}), { MADERARTE_APPS_SCRIPT_URL: 'https://script.example/exec', MADERARTE_PROXY_TOKEN: 'secret' });
assert.equal(crossOrigin.status, 403);
assert.equal((await readJson(crossOrigin)).code, 'ORIGIN_REJECTED');

const missingSession = await handleRequest(new Request('https://app.example.com/api/maderarte', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com' },
  body: JSON.stringify({ action: 'ORDENES_LISTAR' })
}), { MADERARTE_APPS_SCRIPT_URL: 'https://script.example/exec', MADERARTE_PROXY_TOKEN: 'secret' });
assert.equal(missingSession.status, 401);
assert.match(missingSession.headers.get('Set-Cookie') || '', /Max-Age=0/);

const nativeFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, options) => {
    const forwarded = JSON.parse(options.body);
    assert.equal(forwarded.proxyToken, 'secret');
    assert.equal(forwarded.action, 'AUTH_LOGIN');
    assert.equal(forwarded.sessionToken, '');
    return new Response(JSON.stringify({
      status: 'success',
      code: 'OK',
      msg: 'Sesión creada.',
      httpStatus: 200,
      data: {
        sessionToken: 'opaque-token',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        persistent: true,
        profile: { uid: 'u1', email: 'test@example.com', name: 'Prueba', role: 'PROPIETARIO', status: 'ACTIVO' },
        permissions: ['*']
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const loginResponse = await handleRequest(new Request('https://app.example.com/api/maderarte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.example.com', 'CF-Connecting-IP': '203.0.113.10' },
    body: JSON.stringify({ action: 'AUTH_LOGIN', payload: { firebaseIdToken: 'token' } })
  }), { MADERARTE_APPS_SCRIPT_URL: 'https://script.example/exec', MADERARTE_PROXY_TOKEN: 'secret' });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('Set-Cookie') || '';
  assert.match(cookie, /^__Host-maderarte_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=/);
  const loginBody = await readJson(loginResponse);
  assert.equal(loginBody.data.sessionToken, undefined);
  assert.equal(loginBody.data.profile.name, 'Prueba');
} finally {
  globalThis.fetch = nativeFetch;
}

console.log('OK · Cloudflare Function verificada');
