"""Read-only local activity preview, responsive and interaction checks."""
import shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
out=Path('artifacts/activity');out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen('http://127.0.0.1:4173/configuracion.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':950},device_scale_factor=2)
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:4173/configuracion.html?preview=1#actividad')
   expect(page.locator('[data-activity]')).to_have_count(2)
   assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth')
   page.screenshot(path=str(out/f'actividad-{width}.png'),full_page=True)
   page.locator('[data-activity]').first.click();expect(page.locator('#cfg-detail')).to_be_visible()
   expect(page.locator('#cfg-detail-body')).to_contain_text('Antes');expect(page.locator('#cfg-detail-body')).to_contain_text('Después')
   assert page.locator('#cfg-detail').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.screenshot(path=str(out/f'detalle-{width}.png'))
   page.locator('#cfg-detail-close').click();expect(page.locator('#cfg-detail')).not_to_be_visible()
   page.locator('[name=module]').select_option('PRODUCCION');page.get_by_role('button',name='Filtrar',exact=True).click()
   expect(page.locator('[data-activity]')).to_have_count(1)
   page.locator('[name=query]').fill('sin-coincidencias');page.get_by_role('button',name='Filtrar',exact=True).click()
   expect(page.locator('#activity-list')).to_contain_text('No hay cambios')
   assert not errors,errors
   ctx.close()
  browser.close()
 print('Activity: 1440/390/320 layouts, detail, close, module/search filters, empty state and no overflow passed.')
finally:
 server.terminate();server.wait(timeout=10)
