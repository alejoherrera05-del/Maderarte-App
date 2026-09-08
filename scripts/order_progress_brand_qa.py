"""Offline browser assertions for the real Maddy dialog. No Google or API calls."""
import base64
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path('public')
OUT = Path('artifacts/order-progress-brand')
OUT.mkdir(parents=True, exist_ok=True)
source = (ROOT / 'js/core/order-progress.js').read_text()
source = source.replace('export const ', 'const ').replace('export function ', 'function ')
for path in (ROOT / 'assets/brand').iterdir():
    mime = {'.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png'}.get(path.suffix)
    if mime:
        data = base64.b64encode(path.read_bytes()).decode()
        source = source.replace('/assets/brand/' + path.name, f'data:{mime};base64,{data}')
css = (ROOT / 'css/order-progress.css').read_text()
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'), args=['--no-sandbox'])
    for width, height in [(1440, 900), (768, 1024), (390, 844), (320, 568)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<!doctype html><html lang="es"><body><button id="start">Guardar</button></body></html>')
        page.add_style_tag(content=css)
        page.add_script_tag(content=source + '\nwindow.progress=createOrderProgress(document);')
        page.evaluate("() => { document.querySelector('#start').focus(); progress.begin(); }")
        dialog = page.locator('.order-progress-dialog')
        expect(dialog).to_be_visible()
        assert dialog.evaluate('e => e.scrollWidth <= e.clientWidth + 1')
        assert page.locator('.order-progress-shell').evaluate('e => e.getBoundingClientRect().width <= innerWidth')
        page.locator('.order-progress-portrait').evaluate('e => e.decode()')
        assert page.locator('.order-progress-portrait').evaluate('e => e.naturalWidth === 420')
        expect(page.locator('[data-progress-number]')).to_be_hidden()
        page.evaluate("() => progress.update({step:'record',status:'running',message:'Esperando confirmación.'})")
        page.keyboard.press('Escape')
        expect(dialog).to_be_visible()
        expect(page.locator('[data-progress-step="record"]')).to_have_attribute('aria-current', 'step')
        page.evaluate("() => { const real = Date.now; window.timeOffset = 16000; Date.now = () => real() + window.timeOffset; }")
        page.wait_for_timeout(1100)
        expect(page.locator('[data-progress-wait]')).to_contain_text('aún no confirma')
        expect(page.locator('[data-progress-step="record"]')).to_have_attribute('data-state', 'running')
        expect(page.locator('[data-progress-step="photos"]')).to_have_attribute('data-state', 'pending')
        page.evaluate("""() => {
            progress.update({step:'record',status:'complete',number:'MP-QA-OP-0001'});
            progress.update({step:'photos',status:'running',message:'Guardando las referencias.'});
        }""")
        expect(page.locator('[data-progress-wait]')).not_to_contain_text('aún no confirma')
        assert page.locator('[aria-current="step"]').count() == 1
        expect(page.locator('[data-progress-number]')).to_have_text('Pedido MP-QA-OP-0001')
        page.evaluate("() => progress.update({step:'photos',status:'skipped',detail:'No hay referencias para este pedido.'})")
        expect(page.locator('[data-progress-step="photos"] .order-progress-state')).to_have_text('No aplica')
        page.evaluate("() => progress.update({step:'document',status:'running'})")
        assert page.locator('[data-state="running"] .order-progress-icon').evaluate('e => getComputedStyle(e).animationName') == 'none'
        page.evaluate("() => progress.pause('No se confirmó el PDF. Conservamos la misma orden para recuperar su documentación.')")
        expect(page.locator('[data-progress-live]')).to_have_text('Por confirmar')
        expect(page.locator('[data-progress-step="record"]')).to_have_attribute('data-state', 'complete')
        expect(page.locator('[data-progress-segment="document"]')).to_have_attribute('data-state', 'unconfirmed')
        page.locator('.order-progress-return').scroll_into_view_if_needed()
        expect(page.locator('.order-progress-return')).to_be_in_viewport()
        page.screenshot(path=str(OUT / f'recuperacion-{width}.png'))
        page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        assert page.evaluate("document.activeElement.id") == 'start'
        page.evaluate("() => { progress.begin(); document.querySelector('.order-progress-portrait').dispatchEvent(new Event('error')); }")
        expect(page.locator('[data-progress-number]')).to_be_hidden()
        expect(page.locator('.order-progress-portrait')).to_be_hidden()
        expect(page.locator('.order-progress-signature')).to_be_visible()
        expect(page.locator('#order-progress-message')).to_have_text('Comprobando los datos…')
        assert page.locator('.order-progress-dialog').count() == 1
        page.evaluate("() => progress.sync({phase:'confirmed'})")
        expect(dialog).not_to_be_visible()
        page.evaluate('() => progress.destroy()')
        assert page.locator('.order-progress-dialog').count() == 0
        assert not errors, errors
        results.append({'viewport': [width, height], 'focusAndEscape': True, 'waitDoesNotConfirm': True, 'stageWaitResets': True, 'imageFallback': True, 'resetAndRecovery': True, 'reducedMotion': True, 'apiCalls': 0})
        page.close()
    browser.close()
(OUT / 'resultado.json').write_text(json.dumps(results, indent=2, ensure_ascii=False))
print(json.dumps(results, ensure_ascii=False))
