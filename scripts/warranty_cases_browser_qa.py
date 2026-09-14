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
   cases=[];writes=[];results={};errors=[];lost=[True];visits=[];visit_writes=[];pdf_requests=[]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='GARANTIA_LISTAR':data={'items':cases,'enabled':True}
    elif a=='ORDEN_OBTENER':data={'order':ORDER,'items':[ITEM,dict(ITEM,id='OTHER-ITEM',description='Mesa sin entregar',delivered=0)]}
    elif a=='AGENDA_LISTAR':data={'items':visits,'enabled':True}
    elif a=='ORDENES_LISTAR':data={'items':[dict(ORDER,number='OTHER-OP',client='Otro cliente'),dict(ORDER,document='1234')]}
    elif a=='AGENDA_GUARDADO_ESTADO':data={'saved':False}
    elif a=='AGENDA_GUARDAR':
     assert v['caseId']=='QA-REPORT';visit_writes.append(v);visits[:]=[dict(v,id='QA-VISIT',kind='GARANTIA',status='PROGRAMADA',items=[],revision=1,by='Muestra')];data={'result':visits[0]}
    elif a=='GARANTIA_PDF':pdf_requests.append(v);data={'mime':'application/pdf','base64':'JVBERi1xYQ==','name':'muestra.pdf'}
    elif a=='GARANTIA_ESTADO':data={'saved':v['requestId'] in results,'result':results.get(v['requestId'])}
    elif a=='GARANTIA_GUARDAR':
     rid=b['requestId'];assert rid not in results;writes.append(v)
     if v['operation'] in ['receive','home','report'] and not v['id']:
      assert v['number']==ORDER['number'] and v['itemId']==ITEM['id'] and v['quantity']==1 and (v['operation']=='report' or v['physicalCheck'] is True)
      c=dict(v,id=('QA-HOME-REPORT' if len(cases)==1 else 'QA-REPORT') if v['operation']=='report' else 'QA-HOME' if v['operation']=='home' else 'QA-CASE',client=ORDER['client'],description=ITEM['description'],branch='MP',revision=1,events=[]);cases.append(c)
     else:c=next(c for c in cases if c['id']==v['id']);assert v['revision']==c['revision'];c['revision']+=1
     c['status']={'report':'REPORTADA','receive':'RECIBIDA','home':'RESUELTA_DOMICILIO','repair':'EN_REPARACION','ready':'LISTA','deliver':'ENTREGADA'}.get(v['operation'],c.get('status'))
     if v['operation']=='receive':c['source']=v['source'];c['condition']=v['condition']
     c['source']='REPORTE' if v['operation']=='report' else 'DOMICILIO' if v['operation']=='home' else c.get('source','CLIENTE');c['assignee']=v['assignee'];c['updated']='2026-09-14T19:00:00Z'
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
   page.reload();expect(page.locator('#wc-recover')).to_be_visible();page.locator('#wc-recover').click();expect(page.locator('#wc-title')).to_have_text('Garantía');assert len(writes)==1
   page.locator('[data-operation=repair]').click();page.locator('#wc-notes').fill('Unión de la pata con holgura. Ajustar ensamble y comprobar estabilidad.');page.locator('#wc-form [type=submit]').click();expect(page.locator('.wc-status').last).to_have_text('En reparación')
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'repair-{width}.png'),full_page=True)
   page.locator('[data-operation=ready]').click();page.locator('#wc-notes').fill('Ensamble ajustado. Estabilidad comprobada.');page.locator('#wc-form [type=submit]').click();expect(page.locator('[data-operation=deliver]')).to_be_visible()
   expect(page.locator('#wc-delivery-pdf')).to_have_count(0)
   page.locator('[data-operation=deliver]').click();page.locator('#wc-notes').fill('Entrega de la silla reparada en el almacén.');page.locator('#wc-recipient').fill('Persona de muestra');page.locator('[name=physicalCheck]').check();page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');expect(page.locator('.wc-timeline')).to_contain_text('Persona de muestra')
   page.locator('#wc-delivery-pdf').click();expect(page.locator('#wc-pdf-link a')).to_be_visible();assert pdf_requests[-1]=={'id':'QA-CASE','kind':'ENTREGA'}
   page.locator('#wc-pdf').click();expect(page.locator('#wc-progress')).to_contain_text('Comprobante listo');assert pdf_requests[-1]=={'id':'QA-CASE'}
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'delivery-{width}.png'),full_page=True)
   page.locator('.wc-subheading').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'history-{width}.png'),full_page=True)
   assert len(writes)==4;assert not errors,errors;assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth')
   page.locator('#wc-close').click();page.locator('#wc-closed').click();expect(page.locator('[data-case]')).to_have_count(1)
   page.locator('#wc-start').click();page.locator('#wc-piece').fill('Silla del comedor');page.locator('#wc-issue').fill('Unión floja en la pata delantera.');page.locator('#wc-assignee').fill('Operario de muestra');page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');page.locator('#wc-home-case').click();expect(page.locator('#wc-title')).to_have_text('Solución en domicilio');expect(page.locator('#wc-piece')).to_have_value('Silla del comedor');page.locator('#wc-notes').fill('Se ajustó el ensamble y se comprobó estabilidad.');page.locator('#wc-assignee').fill('Operario de muestra');page.locator('[name=physicalCheck]').check();page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');expect(page.locator('#wc-body')).to_contain_text('Solucionado en domicilio');expect(page.locator('[data-operation]')).to_have_count(0)
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'home-{width}.png'),full_page=True)
   page.locator('#wc-pdf').click();expect(page.locator('#wc-pdf-link a')).to_have_attribute('href',__import__('re').compile('^blob:'));assert len(writes)==6;assert not errors,errors
   page.locator('#wc-close').click();page.goto(ORIGIN+'/garantias.html');page.locator('#wc-start').click();page.locator('#wc-order-query').fill('1234');page.locator('#wc-search-form [type=submit]').click();page.locator('[data-order="MP-OP-0001"]').click();expect(page.locator('#wc-body')).to_contain_text('Mesa sin entregar');page.locator('#wc-body a.wc-pick').click()
   expect(page.locator('#wc-owner')).to_contain_text(ORDER['number']);page.locator('#wc-start').click();expect(page.locator('#wc-title')).to_have_text('Registrar reporte');page.locator('#wc-piece').fill('Silla del comedor');page.locator('#wc-issue').fill('Respaldo suelto');page.locator('#wc-assignee').fill('Operario de muestra');page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');expect(page.locator('#wc-body')).to_contain_text('Por atender');expect(page.locator('#wc-pdf')).to_have_count(0)
   page.locator('#wc-visits a').click();expect(page.locator('#ag-title')).to_have_text('Programar revisión');expect(page.locator('#ag-task-notes')).to_have_value('Respaldo suelto');page.locator('#ag-task-date').fill('2099-12-20');page.locator('#ag-task-time').fill('10:00');page.locator('#ag-task-save').click();expect(page.locator('#ag-toast')).to_be_visible();assert len(visit_writes)==1
   page.locator('#ag-back').click();expect(page.locator('#wc-title')).to_have_text('Garantía');expect(page.locator('#wc-visits')).to_contain_text('2099');page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'connected-case-{width}.png'),full_page=True)
   page.locator('#wc-visits a.wc-pick').click();expect(page.locator('#ag-detail')).to_be_visible();page.locator('#ag-detail a[href*="garantias.html"]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');page.locator('#wc-receive-case').click();expect(page.locator('#wc-piece')).to_have_value('Silla del comedor');expect(page.locator('#wc-issue')).to_have_value('Respaldo suelto');page.locator('#wc-condition').fill('Una silla sin accesorios');page.locator('[name=physicalCheck]').check();page.locator('#wc-form [type=submit]').click();expect(page.locator('#wc-title')).to_have_text('Garantía');assert writes[-1]['id']=='QA-REPORT';assert len(cases)==3;assert not errors,errors
   page.locator('#wc-dialog').evaluate('e=>{e.getAnimations().forEach(a=>a.finish());e.scrollTop=0}');page.screenshot(path=str(OUT/f'connected-reception-{width}.png'),full_page=True);assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth');page.locator('#wc-close').click();page.goto(ORIGIN+'/garantias.html');expect(page.locator('#wc-list [data-case]')).to_have_count(1);page.screenshot(path=str(OUT/f'hub-{width}.png'),full_page=True);page.goto(ORIGIN+'/agenda.html');page.locator('#ag-new').click();page.locator('[data-kind=GARANTIA]').click();expect(page.locator('#wc-title')).to_have_text('Nueva garantía');ctx.close()
  docs=Path('artifacts/warranty-documents');context=browser.new_context();page=context.new_page()
  snapshots=[(name,json.loads((docs/(name+'.json')).read_text())) for name in ['reception','home','delivery']]
  long=dict(snapshots[0][1]);long['issue']='Detalle de revisión y estado de la pieza. '*90;long['condition']='Observación de recepción. '*90;snapshots.append(('long',long))
  long_delivery=dict(snapshots[2][1]);long_delivery['work']='Trabajo final y comprobación de estabilidad. '*80;long_delivery['deliveryNotes']='Detalle de la entrega al receptor. '*80;snapshots.append(('delivery-long',long_delivery))
  for name,snapshot in snapshots:
   page.goto(ORIGIN+'/documento-render.html');page.evaluate("s=>{const n=document.createElement('script');n.type='application/json';n.id='maddy-document-data';n.textContent=JSON.stringify(s);document.body.append(n)}",snapshot);page.wait_for_selector('[data-document-ready="true"]')
   assert page.locator('.wg-document').count()>=1
   if name in ['long','delivery-long']:assert page.locator('.wg-document').count()>1
   if name.startswith('delivery'):expect(page.locator('.rm-doc-staff').first).to_contain_text(snapshot['recipient']);expect(page.locator('.rm-doc-body')).not_to_have_count(0)
   page.pdf(path=str(docs/(name+'.pdf')),print_background=True,prefer_css_page_size=True);page.screenshot(path=str(docs/(name+'.png')),full_page=True)
  context.close();browser.close()
 print('Warranty UI: receive component, lost response/reload without duplicate, repair, ready, delivery and 1440/390/320 layouts passed.')
finally:server.terminate();server.wait(timeout=10)




