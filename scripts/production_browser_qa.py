"""GitHub runner: read-only supplier request preparation with synthetic orders."""
import json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path('artifacts/production');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173';QA='QA-'+'a'*32;OP='MP-QA-OP-0001'
SESSION={'profile':{'uid':'qa-production','email':'qa@example.invalid','name':'Equipo de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z','persistence':'session'}
ORDER={'number':OP,'client':'Cliente de muestra','description':'Sofá y comedor','status':'CONFIRMADA','document':'DATO PRIVADO','phone':'TEL PRIVADO','notes':'NOTA PRIVADA','total':7654321}
BASE={'quantity':2,'delivered':0,'cancelled':0,'pending':2,'fulfillment':'PARA_SOLICITAR','agreement':'SEPARADO','unit':'UN','fabricColor':'Lino gris','woodColor':'Roble natural','measures':'200 × 90 cm','specifications':'Brazo recto'}
ITEMS=[dict(BASE,id='i1',description='Sofá de muestra'),dict(BASE,id='i2',description='Comedor disponible',fulfillment='DISPONIBLE'),dict(BASE,id='i3',description='Mueble por definir',fulfillment='POR_DEFINIR')]
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen(ORIGIN+'/produccion.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1366,390,320]:
   context=browser.new_context(viewport={'width':width,'height':850},permissions=['clipboard-read','clipboard-write'])
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));" % json.dumps(SESSION))
   actions=[];errors=[]
   def route(r):
    req=r.request.post_data_json;a=req['action'];actions.append(a)
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='ORDENES_LISTAR':
     assert req.get('sandboxId')==QA
     if req['payload']['query']=='fallo':r.fulfill(status=500,json={'status':'error','msg':'Error de prueba'});return
     data={'items':[] if req['payload']['query']=='nadie' else [ORDER],'total':1}
    elif a=='ORDEN_OBTENER':
     assert req.get('sandboxId')==QA;data={'order':ORDER,'items':ITEMS}
    else:raise AssertionError('Unexpected action '+a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/produccion.html?prueba='+QA)
   expect(page.locator('#production-query')).to_be_visible()
   page.screenshot(path=str(OUT/f'entrada-{width}.png'),full_page=True)
   query=page.locator('#production-query');query.fill('nadie');query.press('Enter');expect(page.locator('#production-search-status')).to_contain_text('No encontramos')
   query.fill('fallo');query.press('Enter');expect(page.locator('#production-search-status')).to_contain_text('Vuelve a pulsar Buscar')
   query.fill('muestra');query.press('Enter');page.locator('#production-results button').click()
   expect(page.locator('#production-workspace')).to_be_visible()
   expect(page.locator('#production-select-0')).not_to_be_checked()
   expect(page.locator('#production-select-1')).to_be_disabled();expect(page.locator('#production-select-2')).to_be_disabled()
   page.locator('#production-select-0').check();expect(page.locator('#production-notice-wrap')).to_be_visible()
   page.locator('#production-reviewed').check();page.locator('#production-prepare').click();expect(page.locator('#production-preview')).to_be_hidden()
   page.locator('#production-notice').check();page.locator('#production-supplier').fill('Taller de muestra');page.locator('#production-notes').fill('Confirmar tono antes de tapizar')
   page.screenshot(path=str(OUT/f'solicitud-{width}.png'),full_page=True)
   page.locator('#production-prepare').click();expect(page.locator('#production-preview')).to_be_visible()
   message=page.locator('#production-message').input_value()
   assert 'Lino gris' in message and 'Cantidad: 1 UN' in message and 'Comedor disponible' not in message
   assert all(secret not in message for secret in ['DATO PRIVADO','TEL PRIVADO','NOTA PRIVADA','7654321'])
   assert page.locator('#production-whatsapp').get_attribute('href').startswith('https://wa.me/?text=')
   page.locator('#production-copy').click();expect(page.locator('#production-copy-status')).to_have_text('Mensaje copiado.')
   page.screenshot(path=str(OUT/f'mensaje-{width}.png'),full_page=True)
   page.locator('#production-notes').fill('Cambio');expect(page.locator('#production-preview')).to_be_hidden()
   page.locator('#production-new-search').click();query.fill(OP);query.press('Enter');expect(page.locator('#production-workspace')).to_be_visible()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert not errors,errors
   context.close()
  browser.close()
finally:
 server.terminate();server.wait(timeout=10)
