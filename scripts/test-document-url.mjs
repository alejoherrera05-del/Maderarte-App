import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { documentSources } from '../public/js/core/document-url.js';

const origin = 'https://app.example.com';
const sources = value => documentSources(value, origin);
assert.deepEqual(sources('javascript:alert(1)'), { external: '', preview: '' });
assert.deepEqual(sources('https://user:password@drive.google.com/file/d/test/view'), { external: '', preview: '' });
assert.equal(sources('https://drive.google.com/file/d/TEST_document-01/view?usp=drivesdk&resourcekey=TEST_key').preview, 'https://drive.google.com/file/d/TEST_document-01/preview?resourcekey=TEST_key');
assert.equal(sources('https://drive.google.com/open?id=TEST_document-01').preview, 'https://drive.google.com/file/d/TEST_document-01/preview');
assert.equal(sources('https://drive.google.com/uc?export=download&id=TEST_document-01').preview, 'https://drive.google.com/file/d/TEST_document-01/preview');
assert.equal(sources('https://drive.google.com.evil.test/file/d/test/view').preview, '');
assert.equal(sources('https://drive.google.com:8443/file/d/test/view').preview, '');
assert.equal(sources('https://drive.google.com/open?id=../test').preview, '');
assert.equal(sources('https://drive.google.com/drive/folders/test').preview, '');
assert.equal(sources('https://other.example.test/proposal.pdf').external, 'https://other.example.test/proposal.pdf');
assert.equal(sources('https://other.example.test/proposal.pdf').preview, '');
assert.equal(sources(`${origin}/documents/test.pdf`).preview, `${origin}/documents/test.pdf`);
const headers = readFileSync('public/_headers', 'utf8');
assert.match(headers, /frame-src 'self' https:\/\/drive\.google\.com;/);
assert.doesNotMatch(headers, /frame-src[^;]*(?:\*|https:;)/);
for (const file of ['public/cotizacion.html', 'public/cotizaciones.html']) {
  assert.doesNotMatch(readFileSync(file, 'utf8'), /user-scalable=no|maximum-scale=1/);
}
console.log('OK · visor Drive, claves de recurso, orígenes permitidos y alternativa externa');
