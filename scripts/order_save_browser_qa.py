"""Browser integration tests. All API responses are synthetic; never contact Google."""
import base64
import json
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

out = Path('artifacts/order-save-browser')
out.mkdir(parents=True, exist_ok=True)
session = {'profile': {'uid': 'qa-browser', 'email': 'qa@example.com', 'name': 'Asesor QA', 'role': 'PROPIETARIO', 'status': 'ACTIVO', 'mainBranch': 'MP', 'branches': ['MP', 'TP']}, 'permissions': ['*'], 'expiresAt': '2099-01-01T00:00:00.000Z', 'persistence': 'session'}
init = "if(!sessionStorage.getItem('MADERARTE_APP_SESSION_SNAPSHOT_V1')) { const s=%s;s.validatedAt=Date.now(); sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s)); }" % json.dumps(session)
server = subprocess.Popen(['node', 'scripts/serve.mjs'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for attempt in range(50):
        try:
            urllib.request.urlopen('http://127.0.0.1:4173/pedido.html', timeout=1).close()
            break
        except Exception:
            time.sleep(.1)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
        for width in (1440, 390, 320):
            context = browser.new_context(viewport={'width': width, 'height': 1000})
            context.add_init_script(init)
            posts, saved, errors = [], {}, []
            state = {'enabled': True, 'lost': True}
            def route(r):
                req = r.request.post_data_json
                action = req['action']
                data = {}
                if action == 'ORDEN_CAPACIDADES':
                    data = {'contractVersion': 1, 'enabled': state['enabled'], 'photosReady': True, 'documentsReady': True}
                elif action == 'AUTH_SESSION_VALIDATE':
                    data = session
                elif action == 'CLIENTES_LISTAR':
                    data = {'items': [], 'total': 0}
                elif action == 'ORDEN_CREAR':
                    posts.append(req)
                    data = {'saved': True, 'order': {'number': 'MP-OP-0001', 'branch': 'MP', 'requestId': req['requestId']}}
                    saved[req['requestId']] = data
                    if state['lost']:
                        r.fulfill(status=503, json={'status': 'error', 'code': 'UPSTREAM_TIMEOUT', 'requestId': req['requestId'], 'msg': 'Timeout simulado'})
                        return
                elif action == 'ORDEN_CREACION_ESTADO':
                    data = saved.get(req['payload']['requestId'], {'saved': False, 'state': 'REVISION_REQUERIDA', 'requestId': req['payload']['requestId'], 'retrySameRequest': False})
                elif action == 'ORDEN_OBTENER':
                    data = {'order': {'number': 'MP-OP-0001', 'client': 'Cliente QA', 'total': 3500000, 'paid': 500000, 'balance': 3000000}, 'items': [], 'payments': []}
                else:
                    raise AssertionError(action)
                r.fulfill(status=200, json={'status': 'success', 'code': 'OK', 'requestId': req['requestId'], 'data': data})
            context.route('**/api/maderarte', route)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('dialog', lambda dialog: dialog.accept())
            page.goto('http://127.0.0.1:4173/pedido.html')
            page.locator('[data-quote-branch="MP"]').click()
            for field, value in {'document': '000000001', 'name': 'Cliente QA', 'phone': '000000002', 'email': 'N/A', 'address': 'Dirección sintética', 'city': 'Ciudad QA'}.items():
                page.locator('#quote-client-' + field).fill(value)
            page.locator('[data-field=description]').fill('Sala de prueba')
            page.locator('[data-field=unitValue]').fill('2000000')
            page.locator('.order-plan-option').filter(has=page.locator('[value=ENTREGA_INMEDIATA]')).click()
            page.locator('#quote-add-item').click()
            page.locator('[data-item-id="2"] [data-field=description]').fill('Comedor de prueba')
            page.locator('[data-item-id="2"] [data-field=unitValue]').fill('1500000')
            page.locator('[data-item-id="2"] .order-plan-option').filter(has=page.locator('[value=SOLICITAR_FABRICA]')).click()
            page.locator('[data-payment-method]').select_option('TRANSFERENCIA')
            page.locator('[data-payment-amount]').fill('500000')
            page.locator('[data-payment-note]').fill('PRIVADO-NO-PDF-QA')
            assert page.locator('#quote-submit').is_enabled(), page.locator('.quote-write-note').inner_text()

            # Real file input: photo references must block v1, not vanish from a save.
            first = page.locator('[data-item-id="1"]')
            first.locator('summary').click()
            first.locator('[data-photo-input]').set_input_files({'name': 'referencia-qa.png', 'mimeType': 'image/png', 'buffer': base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')})
            first.locator('.quote-photo-thumb img').wait_for(state='attached')
            page.locator('#quote-submit').click()
            assert 'fotograf' in page.locator('#quote-form-error').inner_text().lower()
            assert len(posts) == 0
            assert first.locator('.quote-photo-thumb img').count() == 1
            first.locator('[data-remove-photo]').click()
            first.locator('summary').click()

            page.locator('#quote-submit').click()
            page.get_by_role('button', name='Consultar resultado', exact=True).wait_for()
            assert len(posts) == 1
            assert page.locator('[data-field=description]').first.is_disabled()
            assert page.locator('#quote-preview-button').is_disabled()
            assert not page.get_by_role('button', name='Descartar borrador', exact=True).is_enabled()
            cmd = posts[0]['payload']
            assert cmd['payments'][0]['internalNote'] == 'PRIVADO-NO-PDF-QA'
            assert cmd['client']['document'] == '000000001'
            assert cmd['items'][1]['fulfillment'] == 'PARA_SOLICITAR'
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            page.screenshot(path=str(out / f'guardado-pendiente-{width}.png'))
            state['enabled'] = False
            page.reload()
            page.get_by_role('button', name='Abrir pedido', exact=True).wait_for()
            assert len(posts) == 1

            # A closed/expired tab may lose both the editable draft and snapshot.
            # The opaque durable receipt must still surface, without a branch gate.
            page.evaluate("for(const k of Object.keys(sessionStorage)) if(k.startsWith('maderarte.form-draft.')||k.startsWith('maderarte.order-save.')) sessionStorage.removeItem(k)")
            page.reload()
            page.get_by_role('button', name='Abrir pedido', exact=True).wait_for()
            assert page.locator('#quote-workspace').is_visible()
            assert page.locator('#quote-client-name').is_disabled()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            page.get_by_role('button', name='Abrir pedido', exact=True).scroll_into_view_if_needed()
            page.screenshot(path=str(out / f'guardado-recuperado-{width}.png'))
            page.get_by_role('button', name='Abrir pedido', exact=True).click()
            page.wait_for_url('**/orden.html?op=MP-OP-0001')
            assert len(posts) == 1

            # Only synthetic state is reset. The disabled production-like contract
            # must leave the ordinary approved form editable, with no create POST.
            page.evaluate("for(const k of Object.keys(localStorage)) if(k.startsWith('maderarte.order-save.')) localStorage.removeItem(k)")
            page.goto('http://127.0.0.1:4173/pedido.html')
            page.locator('[data-quote-branch="MP"]').click()
            page.locator('#quote-client-name').fill('Borrador sin activar')
            assert page.locator('#quote-submit').is_disabled()
            assert page.locator('#quote-preview-button').is_enabled()
            assert page.locator('#quote-client-name').is_enabled()
            assert len(posts) == 1
            assert not errors, errors
            context.close()
            print('PASS', width, 'fotos preservadas, recarga, pérdida del borrador, bloqueo, un solo envío, captura privada y apertura del pedido confirmado; preparación sin escrituras')
        browser.close()
finally:
    server.terminate()
