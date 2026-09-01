import assert from 'node:assert/strict';
import worker, { handleWorkerRequest } from '../worker/index.js';

async function readJson(response) {
  return JSON.parse(await response.text());
}

const assetRequests = [];
const envWithAssets = {
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      assetRequests.push(url.pathname);
      return new Response(`asset:${url.pathname}`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};

const assetResponse = await handleWorkerRequest(
  new Request('https://app.example.com/login.html'),
  envWithAssets
);
assert.equal(assetResponse.status, 200);
assert.equal(await assetResponse.text(), 'asset:/login.html');
assert.deepEqual(assetRequests, ['/login.html']);

const apiResponse = await worker.fetch(
  new Request('https://app.example.com/api/maderarte'),
  envWithAssets
);
assert.equal(apiResponse.status, 200);
assert.equal((await readJson(apiResponse)).code, 'EDGE_OK');
assert.deepEqual(assetRequests, ['/login.html'], 'La API no debe intentar servirse como archivo estático');

const noAssetsResponse = await handleWorkerRequest(
  new Request('https://app.example.com/login.html'),
  {}
);
assert.equal(noAssetsResponse.status, 503);
assert.equal((await readJson(noAssetsResponse)).code, 'ASSETS_NOT_CONFIGURED');

console.log('OK · Cloudflare Worker y Static Assets verificados');
