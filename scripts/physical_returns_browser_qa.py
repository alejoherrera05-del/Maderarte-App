"""Render real UI and document snapshots from the tested synthetic return ledger."""
import json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path('artifacts/order-adjustments/returns'); OUT.mkdir(parents=True,exist_ok=True)
S=json.loads((OUT/'scenarios.json').read_text())
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-return','name':'Equipo de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z'}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try: urllib.request.urlopen(ORIGIN+'/orden.html',timeout=1).close(); break
  except Exception: time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':960},device_scale_factor=2,reduced_motion='reduce' if width==320 else 'no-preference')
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   received=[False]; writes=[]; previews=[]; errors=[]
   def route(r):
    b=r.request.post_data_json; a=b['action']; payload=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE': data=SESSION
    elif a=='ORDEN_OBTENER': data=S['sofaOrder']
    elif a=='AJUSTE_CUENTA': data=S['sofaAfterReturn'] if received[0] else S['sofaBefore']
    elif a=='AJUSTE_PREVISUALIZAR':
     assert payload['type']=='RETORNAR' and payload['physicalCheck'] is True and payload['destination']=='EXHIBICION'
     assert payload['items']==[{'itemId':S['sofaBefore']['items'][0]['id'],'quantity':1}]
     previews.append(b); data=S['returnPreview']
    elif a=='AJUSTE_CONFIRMAR':
     assert payload['type']=='RETORNAR'; writes.append(b); received[0]=True; data={'saved':True,'result':{'id':S['returnDocument']['number']}}
    else: raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route); page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/orden.html?op='+S['sofaBefore']['order']['number'])
   page.locator('.aj-entry').click(); dialog=page.locator('.aj-dialog')
   dialog.get_by_role('button',name='Recibir mueble devuelto',exact=True).click()
   dialog.get_by_role('spinbutton').fill('1'); dialog.locator('[name=reason]').fill('El sofá regresó al almacén y queda para exhibición.')
   dialog.get_by_role('button',name='Revisar ajuste').click(); assert not previews, 'Physical receipt must be confirmed first'
   dialog.locator('[name=physicalCheck]').check()
   assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.screenshot(path=str(OUT/f'reception-{width}.png'),full_page=True)
   dialog.get_by_role('button',name='Revisar ajuste').click()
   expect(dialog).to_contain_text('1.500.000'); expect(dialog.get_by_role('button',name='Confirmar recepción y ajuste')).to_be_visible()
   page.screenshot(path=str(OUT/f'review-{width}.png'),full_page=True)
   dialog.get_by_role('button',name='Confirmar recepción y ajuste').click(); expect(dialog).to_contain_text('Movimiento registrado'); assert len(writes)==1
   dialog.get_by_role('button',name='Resolver saldo o cambio').click()
   expect(dialog.get_by_role('button',name='Recibir mueble devuelto',exact=True)).to_be_disabled()
   expect(dialog.get_by_role('button',name='Registrar reintegro de dinero',exact=True)).to_be_enabled()
   expect(dialog.get_by_role('link',name='Crear pedido de cambio')).to_have_attribute('href','/pedido.html?cambio='+S['sofaBefore']['order']['number'])
   page.screenshot(path=str(OUT/f'credit-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'); assert not errors,errors
   context.close()
  # Real document renderer, with snapshots produced by the backend lifecycle tests.
  for key,name in [('returnDocument','01-recepcion-sofa'),('refundDocument','02-reintegro-sofa'),('exchangeDocument','03-saldo-para-sofa-cama'),('differenceDocument','04-abono-diferencia'),('newRemission','05-entrega-sofa-cama')]:
   context=browser.new_context(viewport={'width':1200,'height':1000},device_scale_factor=2); page=context.new_page()
   page.goto(ORIGIN+'/documento-render.html')
   page.evaluate("d=>{const n=document.createElement('script');n.type='application/json';n.id='maddy-document-data';n.textContent=JSON.stringify(d);document.body.append(n);}",S[key])
   page.wait_for_selector('[data-document-ready=true]'); assert page.locator('[data-document-error]').count()==0
   page.pdf(path=str(OUT/(name+'.pdf')),print_background=True,prefer_css_page_size=True)
   page.screenshot(path=str(OUT/(name+'.png')),full_page=True); context.close()
  browser.close()
 print('Physical return UI: required receipt, desktop/mobile review, credit/refund/exchange actions and five real-renderer PDFs passed.')
finally: server.terminate(); server.wait(timeout=10)
