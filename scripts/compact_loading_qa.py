"""Approved cutout + compact UI contracts; real quotation preview with a gated CSS response.
No remote Google writes. --offline-only runs component checks, not form acceptance.
"""
import base64
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path('public')
OUT = Path('artifacts/compact-loading')
OUT.mkdir(parents=True, exist_ok=True)
asset = ROOT / 'assets/brand/maddy-working-approved.webp'
assert hashlib.sha256(asset.read_bytes()).hexdigest() == '271610ae27d9a5db11224f9fedeb711f0b34ede09285847a3b11db18d74b9539'
im = Image.open(asset)
assert im.size == (420, 560) and im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0, 255)
assert asset.stat().st_size < 25000
source = (ROOT / 'js/core/order-progress.js').read_text().replace('export const ', 'const ').replace('export function ', 'function ')
for name, mime in [('maddy-working-approved.webp', 'image/webp'), ('maddy-by-maderarte.svg', 'image/svg+xml')]:
    source = source.replace('/assets/brand/' + name, 'data:' + mime + ';base64,' + base64.b64encode((ROOT / 'assets/brand' / name).read_bytes()).decode())
css = (ROOT / 'css/order-progress.css').read_text()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(1440,900), (768,1024), (390,844), (320,568), (844,390)]:
        for kind in ('quote', 'order'):
            page = browser.new_page(viewport={'width':width,'height':height}, reduced_motion='reduce')
            page.set_content('<!doctype html><html lang="es"><body><button id="start">Documento</button></body></html>')
            page.add_style_tag(content=css)
            page.add_script_tag(content=source)
            page.evaluate("kind => { document.querySelector('#start').focus(); window.qa=createDocumentProgress({kind, mode:kind==='quote'?'preview':'save'}); qa.begin(); }", kind)
            dialog = page.locator('.order-progress-dialog')
            page.locator('.order-progress-portrait').evaluate('e=>e.decode()')
            expected_steps = 4 if kind == 'quote' else 5
            assert page.locator('[data-progress-step]').count() == expected_steps
            expect(page.locator('[data-progress-number]')).to_be_hidden()
            page.evaluate("() => { qa.update({step:'prepare',status:'complete'}); qa.update({step:'document',status:'running',message:'Componiendo el documento con el diseño de Maderarte.',number:'NO-CONFIRMADO'}); }")
            expect(page.locator('[data-progress-number]')).to_be_hidden()
            assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            box = page.locator('.order-progress-shell').bounding_box()
            assert box['height'] <= height - 20, (width,height,kind,box)
            assert page.locator('.order-progress-steps').bounding_box()['height'] <= 26
            expect(page.locator('[data-progress-step="document"]')).to_have_attribute('data-state','running')
            # Passive dots are labelled for assistive technology, not a visible shopping list.
            assert page.locator('[data-progress-step] .order-progress-sr').evaluate_all('nodes=>nodes.every(e=>getComputedStyle(e).clipPath==="inset(50%)")')
            page.screenshot(path=str(OUT / f'{kind}-component-{width}.png'))
            page.evaluate("() => qa.pause('No se confirmó la respuesta. Tu formulario se conserva.')")
            expect(page.locator('.order-progress-return')).to_be_visible()
            page.locator('.order-progress-return').click()
            assert page.evaluate('document.activeElement.id') == 'start'
            page.evaluate("() => {qa.destroy();qa.update({step:'verify',status:'complete'});}")
            assert page.locator('.order-progress-dialog').count() == 0
            # Both components may coexist on the OP page; IDs and text must stay independent.
            ids = page.evaluate("() => {const a=createOrderProgress();const b=createDocumentProgress({kind:'quote',mode:'preview'});const ids=[...document.querySelectorAll('.order-progress-dialog h2')].map(e=>e.id);a.destroy();b.destroy();return ids;}")
            assert len(set(ids)) == 2
            assert page.evaluate("() => {try {createDocumentProgress({kind:'quote',mode:'save'});return false;}catch{return true;}}")
            results.append({'kind':kind,'viewport':[width,height],'compact':True,'confirmedNumbersOnly':True,'uniqueIds':True})
            page.close()
    if '--offline-only' not in sys.argv:
        origin = 'http://127.0.0.1:4184'
        server = subprocess.Popen(['node','scripts/serve.mjs'], env={**os.environ,'PORT':'4184'}, stdout=subprocess.DEVNULL)
        try:
            for _ in range(50):
                try: urllib.request.urlopen(origin+'/cotizacion.html',timeout=1).close(); break
                except Exception: time.sleep(.1)
            for width, height in [(1440,900),(390,844),(320,568)]:
                context=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
                page=context.new_page(); errors=[]; external=[]; held=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('request',lambda req:external.append(req.url) if not req.url.startswith(origin) and not req.url.startswith('data:') else None)
                page.goto(origin+'/cotizacion.html?preview=1')
                page.locator('[data-quote-branch="MP"]').click()
                for key,value in {'document':'0000000001','name':'Cliente de muestra','phone':'0000000011','email':'qa@example.invalid','address':'Dirección de prueba','city':'Popayán'}.items():
                    page.locator('#quote-client-'+key).fill(value)
                page.locator('[data-field="description"]').fill('Sofá Oslo de muestra')
                page.locator('[data-field="unitValue"]').fill('2000000')
                expect(page.locator('#quote-submit')).to_be_disabled()
                def gate(route):
                    if route.request.frame.parent_frame and not held:
                        held.append(route)
                    else: route.continue_()
                page.route('**/css/cotizacion-document-editorial.css*',gate)
                page.locator('#quote-preview-button').click()
                dialog=page.locator('.order-progress-dialog[open]')
                expect(dialog).to_have_attribute('data-document-kind','quote')
                expect(dialog.locator('[data-progress-step="document"]')).to_have_attribute('data-state','running')
                expect(dialog.locator('h2')).to_have_text('Tu propuesta va tomando forma…')
                # No timer completes pagination before the held stylesheet actually loads.
                page.wait_for_timeout(300)
                assert held, 'Pagination did not request the controlled stylesheet'
                page.keyboard.press('Escape')
                expect(dialog).to_be_visible()
                expect(page.locator('#quote-preview-overlay')).to_have_class('quote-preview-overlay is-open')
                page.locator('#quote-preview-button').evaluate('e=>{e.click();e.click();}')
                assert page.locator('.order-progress-dialog[open]').count()==1
                assert page.locator('.quote-pagination-measure').count()==1
                assert page.locator('[data-progress-step="record"]').count()==0
                expect(dialog.locator('[data-progress-number]')).to_be_hidden()
                page.locator('.order-progress-portrait').evaluate('e=>e.decode()')
                page.screenshot(path=str(OUT/f'cotizacion-cargando-{width}.png'))
                held[0].continue_()
                expect(page.locator('#quote-preview-content')).to_have_attribute('aria-busy','false',timeout=20000)
                expect(dialog).to_have_count(0)
                expect(page.locator('.quote-editorial-document h1')).to_have_text('COTIZACIÓN')
                assert '2.000.000' in page.locator('#quote-preview-content').inner_text()
                expect(page.locator('#quote-submit')).to_be_disabled()
                page.locator('#quote-preview-close').click()
                assert page.locator('.order-progress-dialog').count()==0
                assert not errors,errors
                assert not external,external
                results.append({'realQuotePreview':True,'viewport':[width,height],'heldStylesheetBlocksConfirmation':True,'emitRemainsDisabled':True,'externalRequests':0})
                context.close()
        finally: server.terminate();server.wait(timeout=10)
    browser.close()
(OUT/'resultado.json').write_text(json.dumps({'imageBytes':asset.stat().st_size,'transparent':True,'offlineOnly':'--offline-only' in sys.argv,'tests':results},ensure_ascii=False,indent=2))
print(json.dumps({'ok':True,'cases':len(results),'imageBytes':asset.stat().st_size,'offlineOnly':'--offline-only' in sys.argv}))
