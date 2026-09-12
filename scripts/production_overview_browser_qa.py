"""Production overview uses synthetic read responses; never sends commercial writes."""
import json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
OUT=Path('artifacts/production-overview');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-production','name':'Equipo de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z'}
def entry(i,name,totals,agreement='ENTREGA_POSTERIOR'):
 return {'key':str(i),'order':{'number':'MP-OP-00'+str(i),'client':'Cliente de muestra','branch':'MP','document':'000000001','status':'CONFIRMADA'},'item':{'id':'item-'+str(i),'description':name,'category':['SOFA','COMEDOR','MESA'][i%3],'quantity':3,'pending':3,'delivered':0,'cancelled':0,'fulfillment':'PARA_SOLICITAR','agreement':agreement,'fabricColor':'Lino gris perla','woodColor':'Roble natural','tracking':{'totals':totals,'available':totals.get('BODEGA',0),'received':totals.get('BODEGA',0),'events':[{'provider':'Taller de muestra','date':'2026-09-10'}] if totals else []}}}
ITEMS=[entry(1,'Sofá de tres puestos',{}),entry(2,'Comedor de seis puestos',{},'SEPARADO'),entry(3,'Mesa de centro',{'SOLICITADO':3,'FABRICACION':3,'BODEGA':1})]
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen(ORIGIN+'/produccion.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,768,390,320]:
   context=browser.new_context(viewport={'width':width,'height':960},device_scale_factor=2)
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   mode={'value':'ready'};errors=[];actions=[]
   def route(r):
    body=r.request.post_data_json;a=body['action'];actions.append(a)
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='PRODUCCION_LISTAR':
     if mode['value']=='error':r.fulfill(status=500,json={'status':'error','msg':'Error de consulta de prueba'});return
     data={'items':[] if mode['value']=='empty' else ITEMS,'total':0 if mode['value']=='empty' else 3,'next':None,'productionTrackingEnabled':True}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/produccion.html');expect(page.locator('.po-item')).to_have_count(3)
   page.wait_for_function("[...document.querySelectorAll('.po-page img')].every(i=>i.complete)")
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=str(OUT/f'overview-{width}.png'),full_page=True)
   if width>760:page.locator('[data-filter="BODEGA"]').click()
   else:page.locator('[data-stage]').select_option('BODEGA')
   expect(page.locator('.po-item')).to_have_count(1);expect(page.locator('.po-item')).to_contain_text('En fabricación');expect(page.locator('.po-item')).to_contain_text('1 unidad')
   href=page.get_by_role('link',name='Actualizar estado').get_attribute('href');assert 'item=item-3' in href and 'track=1' in href
   page.get_by_role('searchbox').fill('inexistente');expect(page.locator('.po-empty')).to_contain_text('Sin coincidencias')
   page.get_by_role('button',name='Limpiar filtros').click();expect(page.locator('.po-item')).to_have_count(3)
   page.locator('[data-provider]').select_option('Taller de muestra');expect(page.locator('.po-item')).to_have_count(1)
   mode['value']='error';page.get_by_role('button',name='Actualizar producción').click();expect(page.locator('[data-status]')).to_contain_text('última consulta');expect(page.locator('.po-item')).to_have_count(1)
   mode['value']='empty';page.get_by_role('button',name='Actualizar producción').click();expect(page.locator('.po-empty')).to_contain_text('No hay muebles pendientes');page.screenshot(path=str(OUT/f'empty-{width}.png'),full_page=True)
   assert not errors,errors;assert set(actions)<=set(['PRODUCCION_LISTAR','AUTH_SESSION_VALIDATE'])
   context.close()
  browser.close()
 print('Production overview: four widths, filters, partial receipt, contextual links, refresh failure, empty state and read-only transport passed.')
finally:
 server.terminate();server.wait(timeout=10)

