"""Client account QA uses synthetic API data; no Google requests or writes."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/client-balances');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-client','name':'Equipo de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z'}
CLIENT={'document':'000000001','name':'Cliente de muestra','phone':'0000000000','city':'Popayán','address':'Dirección de muestra','documentType':'CC','alternatePhone':'0000000001','branch':'MP'}
ORDERS=[{'number':'MP-OP-0001','status':'CONFIRMADA','description':'Sofá de tres puestos','date':'2026-09-14T12:00:00Z','total':1500000,'paid':2100000,'balance':0,'credit':600000},{'number':'MP-OP-0002','status':'CONFIRMADA','description':'Comedor de cuatro puestos','total':2000000,'paid':800000,'balance':1200000,'credit':0},{'number':'MP-OP-0003','status':'ANULADA','description':'Orden anulada','total':0,'paid':9000000,'balance':7000000,'credit':9000000}]
PAYMENTS=[{'number':f'MP-RC-{i:04}','orderNumber':'MP-OP-0001','value':100000,'date':'2026-09-14'} for i in range(1,36)]
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen(ORIGIN+'/clientes.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,1024,768,390,320]:
   context=browser.new_context(viewport={'width':width,'height':960},device_scale_factor=2,reduced_motion='reduce' if width==320 else 'no-preference')
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   calls=[];errors=[]
   def route(r):
    b=r.request.post_data_json;a=b['action'];calls.append(a)
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='CLIENTES_LISTAR':data={'items':[CLIENT],'total':1}
    elif a=='CLIENTE_OBTENER':data={'client':CLIENT,'orders':ORDERS,'payments':PAYMENTS,'quotes':[],'summary':{'orders':3,'balance':1200000}}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/clientes.html?search=000000001');expect(page.locator('[data-total-credit]')).to_contain_text('600.000');expect(page.locator('[data-total-due]')).to_contain_text('1.200.000')
   expect(page.get_by_role('link',name='Ver saldo a favor')).to_have_attribute('href','/orden.html?op=MP-OP-0001')
   expect(page.locator('.client-account')).to_contain_text('2 OP vigentes')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('.client-account-values strong').evaluate_all("es=>es.every(e=>getComputedStyle(e).whiteSpace==='nowrap'&&e.scrollWidth<=e.clientWidth+1)")
   page.screenshot(path=str(OUT/f'account-{width}.png'),full_page=True)
   extra=page.locator('.client-extra');summary=extra.locator('summary');summary.click();expect(extra).to_have_attribute('open','');expect(extra).to_contain_text('0000000001');page.screenshot(path=str(OUT/f'details-{width}.png'));summary.press('Escape');expect(extra).not_to_have_attribute('open','')
   if width==1440:assert page.locator('.client-contact-card').bounding_box()['height']<300
   toggle=page.locator('[data-history-target]').first;toggle.click();expect(toggle).to_have_attribute('aria-expanded','true');panel=page.locator('#client-order-history-0');expect(panel).to_contain_text('MP-RC-0035');expect(panel).to_contain_text('3.500.000')
   page.wait_for_timeout(400)
   assert panel.evaluate('e=>e.clientHeight>=e.firstElementChild.scrollHeight-2')
   page.screenshot(path=str(OUT/f'history-{width}.png'))
   toggle.click();expect(toggle).to_have_attribute('aria-expanded','false')
   page.get_by_role('tab',name='Cotizaciones').click();expect(page.locator('[data-client-panel=quotes]')).to_be_visible();expect(page.locator('[data-client-panel=orders]')).not_to_be_visible();page.get_by_role('tab',name='Órdenes').click();expect(page.locator('[data-client-panel=orders]')).to_be_visible()
   assert not errors,errors;assert set(calls)<=set(['AUTH_SESSION_VALIDATE','CLIENTES_LISTAR','CLIENTE_OBTENER'])
   context.close()
  browser.close()
 print('Client balances: separate credit/debt, excluded cancelled OP, linked source, 35 uncut receipts, mobile and reduced motion passed.')
finally:server.terminate();server.wait(timeout=10)


