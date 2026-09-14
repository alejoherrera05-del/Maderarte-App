"""Actual agenda, synthetic transport, no commercial writes."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/warranty-visits');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-warranty','name':'Equipo de muestra','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00Z'}
ORDER={'number':'MP-OP-0001','client':'Cliente de muestra','branch':'MP','phone':'000000001','address':'Dirección de muestra','city':'Popayán'}
ITEM={'id':'MP-OP-0001-I-1','description':'Comedor de cuatro puestos'}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(ORIGIN+'/agenda.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=2)
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   events=[];writes=[];errors=[]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='AGENDA_LISTAR':data={'items':events,'enabled':True}
    elif a=='ORDEN_OBTENER':assert v['number']==ORDER['number'];data={'order':ORDER,'items':[ITEM]}
    elif a=='AGENDA_GUARDADO_ESTADO':data={'saved':False}
    elif a=='AGENDA_GUARDAR':
     assert v['kind']=='GARANTIA' and v['number']==ORDER['number'] and v['branch']=='MP';assert v['amount'] is None and v['repeat']==1
     writes.append(v);e=dict(v,id='QA-VISIT',revision=len(writes),status='PROGRAMADA',client=ORDER['client'],items=[])
     events[:]=[e];data={'saved':True,'result':{'id':e['id'],'date':e['date'],'time':e['time'],'revision':e['revision']}}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/agenda.html?op='+ORDER['number']+'&tipo=garantia&item='+ITEM['id'])
   expect(page.locator('#ag-title')).to_have_text('Programar revisión');expect(page.locator('#ag-task-title')).to_have_value('Revisar '+ITEM['description'])
   expect(page.locator('#ag-contact')).to_have_value(ORDER['client']);expect(page.locator('#ag-branch')).to_be_disabled();expect(page.locator('#ag-search-area')).to_be_hidden()
   expect(page.locator('#ag-back')).to_have_attribute('href','/orden.html?op='+ORDER['number'])
   page.locator('#ag-task-title').fill('Revisar una silla del comedor');page.locator('#ag-assignee').fill('Operario de muestra');page.locator('#ag-task-time').fill('14:30');page.locator('#ag-task-notes').fill('Una silla: pata delantera floja. Reportado por WhatsApp.')
   page.locator('#ag-editor').evaluate('e=>e.getAnimations().forEach(a=>a.finish())')
   page.screenshot(path=str(OUT/f'review-{width}.png'),full_page=True);assert page.locator('#ag-editor').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.locator('#ag-task-save').click();expect(page.locator('#ag-editor')).not_to_be_visible();assert len(writes)==1
   expect(page.locator('[data-open]')).to_contain_text('Revisar una silla');page.locator('[data-open]').click();expect(page.locator('#ag-detail')).to_contain_text('no confirma la reparación')
   page.screenshot(path=str(OUT/f'appointment-{width}.png'),full_page=True)
   page.locator('#ag-edit-event').click();expect(page.locator('#ag-task-notes')).to_have_value('Una silla: pata delantera floja. Reportado por WhatsApp.');expect(page.locator('#ag-op')).to_have_value(ORDER['number']);page.locator('#ag-task-time').fill('15:00');page.locator('#ag-task-save').click();expect(page.locator('#ag-editor')).not_to_be_visible();assert len(writes)==2 and writes[-1]['time']=='15:00'
   page.goto(ORIGIN+'/agenda.html?op='+ORDER['number']+'&tipo=garantia&item=OTRO');expect(page.locator('#ag-error')).to_contain_text('no pertenece');expect(page.locator('#ag-task-save')).to_be_disabled();assert len(writes)==2
   assert not errors,errors;context.close()
  browser.close()
 print('Warranty visit: linked customer/item, partial component notes, explicit save, edit, invalid context and 1440/390/320 layout passed.')
finally:server.terminate();server.wait(timeout=10)
