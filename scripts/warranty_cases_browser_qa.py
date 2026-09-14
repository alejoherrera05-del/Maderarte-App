"""Real UI with synthetic transport; no requests to live commercial records."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/warranty-cases');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-custody','name':'Equipo de muestra','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00Z'}
ORDER={'number':'MP-OP-0001','client':'Cliente de muestra','branch':'MP'}
ITEM={'id':'MP-OP-0001-I-1','description':'Comedor de cuatro puestos','delivered':1,'returned':0}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(ORIGIN+'/garantias.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=2)
   ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   cases=[];writes=[];results={};errors=[];lost=[True]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='GARANTIA_LISTAR':data={'items':cases,'enabled':True}
    elif a=='ORDEN_OBTENER':data={'order':ORDER,'items':[ITEM]}
    elif a=='GARANTIA_ESTADO':data={'saved':v['requestId'] in results,'result':results.get(v['requestId'])}
    elif a=='GARANTIA_GUARDAR':
     rid=b['requestId'];assert rid not in results;writes.append(v)
     if v['operation']=='receive':
      assert v['number']==ORDER['number'] and v['itemId']==ITEM['id'] and v['quantity']==1 and v['physicalCheck'] is True
      c=dict(v,id='QA-CASE',client=ORDER['client'],description=ITEM['description'],branch='MP',revision=1,events=[]);cases.append(c)
     else:c=cases[0];assert v['revision']==c['revision'];c['revision']+=1
     c['status']={'receive':'RECIBIDA','repair':'EN_REPARACION','ready':'LISTA','deliver':'ENTREGADA'}.get(v['operation'],c.get('status'))
     c['assignee']=v['assignee'];c['updated']='2026-09-14T19:00:00Z'
     c['events'].append({'operation':v['operation'],'at':c['updated'],'by':'Equipo de muestra','notes':v['notes'],'assignee':v['assignee'],'recipient':v.get('recipient','')})
     data={'saved':True,'result':{'id':c['id'],'revision':c['revision'],'number':ORDER['number']}};results[rid]=data['result']
     if lost[0]:lost[0]=False;r.fulfill(status=503,json={'status':'error','code':'WARRANTY_SAVE_UNCERTAIN','message':'Respuesta de prueba interrumpida'});return
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   ctx.route('**/api/maderarte',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/garantias.html?op='+ORDER['number']+'&item='+ITEM['id']+'&recibir=1')
   expect(page.locator('#wc-title')).to_have_text('Recibir en garantía');expect(page.locator('#wc-piece')).to_be_visible()
   page.locator('#wc-piece').fill('Silla del comedor');page.locator('#wc-issue').fill('La pata delantera tiene movimiento al sentarse.');page.locator('#wc-condition').fill('Una silla. Sin accesorios. Marca leve en la pata trasera.');page.locator('#wc-assignee').fill('Operario de muestra')
   page.reload();expect(page.locator('#wc-piece')).to_have_value('Silla del comedor');expect(page.locator('#wc-assignee')).to_have_value('Operario de muestra')
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}')
   page.screenshot(path=str(OUT/f'reception-{width}.png'),full_page=True)
   assert page.locator('#wc-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.locator('[name=physicalCheck]').check();page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-recover')).to_be_visible();assert len(writes)==1
   page.reload();expect(page.locator('#wc-recover')).to_be_visible();page.locator('#wc-recover').click();expect(page.locator('#wc-title')).to_have_text('Reparación');assert len(writes)==1
   page.locator('[data-operation=repair]').click();page.locator('#wc-notes').fill('Unión de la pata con holgura. Ajustar ensamble y comprobar estabilidad.');page.locator('#wc-form [type=submit]').click();expect(page.locator('.wc-status').last).to_have_text('En reparación')
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'repair-{width}.png'),full_page=True)
   page.locator('[data-operation=ready]').click();page.locator('#wc-notes').fill('Ensamble ajustado. Estabilidad comprobada.');page.locator('#wc-form [type=submit]').click();expect(page.locator('[data-operation=deliver]')).to_be_visible()
   page.locator('[data-operation=deliver]').click();page.locator('#wc-notes').fill('Entrega de la silla reparada en el almacén.');page.locator('#wc-recipient').fill('Persona de muestra');page.locator('[name=physicalCheck]').check();page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Expediente de reparación');expect(page.locator('.wc-timeline')).to_contain_text('Persona de muestra')
   page.locator('.wc-subheading').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'history-{width}.png'),full_page=True)
   assert len(writes)==4;assert not errors,errors;assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth')
   page.locator('#wc-close').click();page.locator('#wc-closed').click();expect(page.locator('[data-case]')).to_have_count(1);ctx.close()
  browser.close()
 print('Warranty UI: receive component, lost response/reload without duplicate, repair, ready, delivery and 1440/390/320 layouts passed.')
finally:server.terminate();server.wait(timeout=10)

