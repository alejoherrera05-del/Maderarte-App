"""Quote/order family: actual form, measured preview and printed PDFs; no remote writes."""
import json
import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader

OUT = Path('artifacts/document-family')
OUT.mkdir(parents=True, exist_ok=True)
ORIGIN = 'http://127.0.0.1:4182'
CLIENT = {'document': '0000000001', 'name': 'Cliente de muestra', 'phone': '0000000011',
          'alternatePhone': '0000000022', 'email': 'qa@example.invalid',
          'address': 'Dirección de muestra', 'city': 'Popayán (prueba)'}
ITEMS = [
    ('Alcoba Victorino', 'ALCOBA', 'Rolly gris', 'Poro abierto',
     'Cama de 1,60 × 1,90 m, dos mesas de noche, tocador y colchón.', '6900000'),
    ('Comedor Herradura de seis puestos', 'COMEDOR', 'Rolly gris', 'Natural mate',
     'Tapa de 1,50 × 1,00 m. Seis sillas tapizadas.', '7500000')
]
COMMON = ['.quote-editorial-client-field strong', '.quote-editorial-item-title h3',
          '.quote-editorial-item-total', '.quote-editorial-item-quantity',
          '.quote-editorial-item-facts strong', '.quote-editorial-number strong',
          '.quote-editorial-section-kicker', '.quote-editorial-footer-copy strong']
server = subprocess.Popen(['node', 'scripts/serve.mjs'], env={**os.environ, 'PORT': '4182'}, stdout=subprocess.DEVNULL)
playwright = None
browser = None
page = None

def fill_document(page, kind, many=False):
    page.goto(ORIGIN + ('/cotizacion.html' if kind == 'quote' else '/pedido.html') + '?preview=1')
    page.locator('[data-quote-branch="MP"]').click()
    for key, value in CLIENT.items():
        page.locator('#quote-client-' + key).fill(value)
    page.locator('#quote-meta-number').evaluate('(e,n)=>e.textContent=n', 'MP-COT-MUESTRA' if kind == 'quote' else 'MP-QA-OP-0001')
    page.locator('#quote-meta-date').evaluate('e=>e.textContent="07 sept 2026"')
    page.locator('#quote-meta-advisor').evaluate('e=>e.textContent="Asesor de muestra"')
    for index in range(18 if many else 2):
        if index:
            page.locator('#quote-add-item').click()
        card = page.locator('.quote-item').nth(index)
        desc, category, fabric, wood, spec, price = ITEMS[index % 2]
        if many:
            desc = f'Mueble de control {index + 1:02d}'
            spec = (spec + ' Especificación de muestra, con medidas y acabados. ') * 3
        card.locator('[data-field="description"]').fill(desc)
        card.locator('[data-field="unitValue"]').fill(price)
        # Category, fabric, wood and specifications belong to this disclosure.
        details = card.locator('.quote-item-details')
        details.locator('summary').click()
        card.locator('[data-field="category"]').select_option(category)
        card.locator('[data-field="fabric"]').fill(fabric)
        card.locator('[data-field="wood"]').fill(wood)
        card.locator('[data-field="specifications"]').fill(spec)
        if kind == 'order':
            card.locator('.order-plan-option').filter(has=page.locator('[value="ENTREGA_INMEDIATA"]')).click()
        details.locator('summary').click()
    page.locator('#quote-notes').fill('Muestra de diseño · sin validez comercial. No cobrar, entregar ni fabricar.')
    if kind == 'order':
        page.locator('[data-payment-method]').first.select_option('TRANSFERENCIA')
        page.locator('[data-payment-amount]').first.fill('1700000')
    expect(page.locator('#quote-submit')).to_be_disabled()
    page.locator('#quote-preview-button').click()
    expect(page.locator('#quote-preview-content')).to_have_attribute('aria-busy', 'false', timeout=20000)
    expect(page.locator('.quote-editorial-document h1').first).to_have_text('COTIZACIÓN' if kind == 'quote' else 'ORDEN DE PEDIDO')

try:
    for _ in range(50):
        try:
            urllib.request.urlopen(ORIGIN + '/cotizacion.html', timeout=1).close()
            break
        except Exception:
            time.sleep(.1)
    results = []
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
    for width in (1440, 390, 320):
        family = {}
        for kind in ('quote', 'order'):
            context = browser.new_context(viewport={'width': width, 'height': 1050}, reduced_motion='reduce')
            page = context.new_page()
            errors, remote = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: remote.append(request.url) if not request.url.startswith(ORIGIN) and not request.url.startswith('data:') else None)
            fill_document(page, kind)
            doc = page.locator('#quote-preview-content')
            weights = {sel: page.locator(sel).first.evaluate('e=>getComputedStyle(e).fontWeight') for sel in COMMON}
            assert all(int(w) <= (600 if sel == '.quote-editorial-section-kicker' else 500) for sel,w in weights.items()), weights
            family[kind] = weights
            text = doc.inner_text()
            folded = text.casefold()
            assert '14.400.000' in text and all(t[0].casefold() in folded for t in ITEMS), text
            if kind == 'quote':
                assert 'total cotizado' in folded and 'condiciones comerciales' in folded, text
                assert all(label not in folded for label in ['pagado hoy', 'saldo pendiente', 'abono indicado']), text
                assert page.locator('.order-finance').count() == 0
                assert 'fabricación' in folded
            else:
                assert 'saldo pendiente' in folded and '12.700.000' in text, text
                assert page.locator('.order-document-allocation:visible').count() == 0
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT / f'{kind}-preview-{width}.png'), full_page=True)
            if width == 1440:
                html = doc.inner_html()
                page.evaluate('html=>{document.body.innerHTML=`<main id="quote-preview-content">${html}</main>`;document.body.className="quote-page quote-print-export";}', html)
                page.add_style_tag(url=ORIGIN + '/css/documento-render.css')
                page.emulate_media(media='print')
                page.screenshot(path=str(OUT / f'{kind}-document.png'), full_page=True)
                pdf = OUT / f'{kind}-document.pdf'
                page.pdf(path=str(pdf), format='A4', print_background=True, prefer_css_page_size=True, display_header_footer=False, margin={'top':'0','bottom':'0','left':'0','right':'0'})
                reader = PdfReader(pdf)
                assert len(reader.pages) == 1, (kind, len(reader.pages))
                printed = '\n'.join(pg.extract_text() or '' for pg in reader.pages)
                assert '14.400.000' in printed and 'sin validez comercial' in printed.casefold(), printed
                if kind == 'quote': assert 'saldo pendiente' not in printed.casefold() and 'total cotizado' in printed.casefold()
            assert not errors, errors
            assert not remote, remote
            results.append({'kind': kind, 'width': width, 'weights': weights, 'externalRequests': 0})
            context.close()
        assert family['quote'] == family['order'], family
    context = browser.new_context(viewport={'width': 1440, 'height': 1050})
    page = context.new_page()
    fill_document(page, 'quote', many=True)
    long_text = page.locator('#quote-preview-content').inner_text().casefold()
    for i in range(18): assert f'mueble de control {i+1:02d}' in long_text
    assert page.locator('.quote-editorial-investment').count() == 1
    pages = page.locator('.quote-preview-page').count()
    assert pages > 1
    assert page.locator('.order-finance').count() == 0
    assert page.locator('.quote-preview-page').evaluate_all('nodes=>nodes.every(e=>e.scrollHeight<=e.clientHeight+2)')
    results.append({'longQuoteItems': 18, 'pages': pages, 'singleClosing': True})
    (OUT / 'resultado.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps({'familyParity': True, 'viewports': [1440,390,320], 'quotesHaveNoPayments': True, 'ordersKeepBalance': True, 'longQuotePages': pages, 'externalWrites': 0}))
except Exception:
    if page and not page.is_closed():
        page.screenshot(path=str(OUT / 'failure.png'), full_page=True)
        (OUT / 'failure.txt').write_text(page.locator('body').inner_text())
    raise
finally:
    if browser: browser.close()
    if playwright: playwright.stop()
    server.terminate()
    server.wait(timeout=10)
