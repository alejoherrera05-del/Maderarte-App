"""GitHub runner only. Dispatch UI against a simulated API, plus actual PDF layout."""
import copy, json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from pypdf import PdfReader
OUT=Path('artifacts/remissions');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-remission','email':'qa@example.invalid','name':'Despachador de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP','TP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z','persistence':'session'}
OP='MP-QA-OP-0001';REM='MP-QA-REM-0001';QA='QA-'+'a'*32
PEOPLE={'transporters':[{'name':'Piallero de prueba','favorite':True,'lastUsed':'2026-09-08T18:00:00Z','mode':'PIALLERO'}],'assistants':[{'name':'Operario de prueba','favorite':False,'lastUsed':'2026-09-08T18:00:00Z','mode':''}]}
BASE={'documentKind':'remission','issued':True,'number':REM,'orderNumber':OP,'date':'2026-09-08T18:00:00Z','branchCode':'MP','dispatcher':'Despachador de prueba','transporter':{'name':'Piallero de prueba','mode':'PIALLERO'},'assistant':'Operario de prueba','sandbox':True,'client':{'name':'CLIENTE DE MUESTRA','document':'00000001','phone':'00000002','alternatePhone':'00000003','address':'Dirección de prueba, sin entrega real','city':'Popayán (prueba)'},'items':[{'itemId':OP+'-I-1','description':'Sofá de muestra','quantity':2,'pendingAfter':2,'unit':'UN'}],'notes':'SIN ENTREGA REAL. Solo verificación de formato.'}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen(ORIGIN+'/remision.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in (1916,1366,1024,1440,390,320):
   context=browser.new_context(viewport={'width':width,'height':{1916:950,1366:768,1024:768,1440:1000}.get(width,800)},device_scale_factor=2 if width==1366 else 1)
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));" % json.dumps(SESSION))
   state={'creates':0,'finishes':0,'complete':False,'saved':None,'doc':None,'searches':[],'held':None};errors=[]
   orders=[{'number':n,'client':'Cliente de muestra','document':'00000001','city':'Popayán','date':'2026-09-08T18:00:00Z','description':description,'address':'Dirección de prueba'} for n,description in [(OP,'Sofá de muestra'),('MP-OP-0002','Comedor de cuatro puestos')]]
   def route(r):
    req=r.request.post_data_json;a=req['action'];data={}
    if a.startswith('REMISION_') and a!='REMISION_CAPACIDADES':assert req.get('sandboxId')==QA
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='RECIBO_CAPACIDADES':data={'enabled':False}
    elif a=='REMISION_CAPACIDADES':data={'contractVersion':1,'enabled':req.get('sandboxId')==QA,'photosReady':True,'documentsReady':True}
    elif a=='ORDENES_LISTAR':
     assert req.get('sandboxId')==QA
     query=req['payload']['query'];state['searches'].append(query)
     if query=='anterior':state['held']=r;return
     if query=='fallo':r.fulfill(status=400,json={'status':'error','code':'BAD_REQUEST','requestId':req['requestId'],'msg':'Consulta de prueba no disponible'});return
     matches=[] if query=='sin coincidencias' else orders
     data={'items':matches,'total':len(matches),'limit':50}
    elif a=='REMISION_CUENTA':
     data={'order':{'number':OP,'client':BASE['client']['name'],'document':'00000001','phone':'00000002','alternatePhone':'00000003','address':BASE['client']['address'],'city':BASE['client']['city'],'notes':'Sin entrega real'},'dispatcher':BASE['dispatcher'],'people':PEOPLE,'canDeliver':True,'position':{'fingerprint':'a'*64,'history':[],'items':[{'id':OP+'-I-1','description':'Sofá de muestra','quantity':4,'delivered':0,'pending':4,'blocked':''},{'id':OP+'-I-2','description':'Mueble en fabricación','quantity':1,'delivered':0,'pending':1,'blocked':'Requiere revisión de producción antes de entregar.'},{'id':OP+'-I-3','description':'Mueble ya despachado','quantity':1,'delivered':1,'pending':0,'blocked':''}]}}
    elif a=='REMISION_CREAR':
     state['creates']+=1;assert state['creates']==1
     cmd=req['payload'];assert cmd['items']==[{'itemId':OP+'-I-1','quantity':2}];assert cmd['transporter']=={'name':'Piallero de prueba','mode':'PIALLERO','favorite':True};assert cmd['assistant']['name']=='Operario de prueba';assert cmd['physicalCheck'] is True;assert 'receiver' not in cmd
     state['saved']={'number':REM,'orderNumber':OP,'branch':'MP','quantity':2,'requestId':req['requestId']};state['doc']=copy.deepcopy(BASE)
     # A lost response must recover the same dispatch before sending anything again.
     r.fulfill(status=503,json={'status':'error','code':'REMISSION_SAVE_UNCERTAIN','requestId':req['requestId'],'msg':'Respuesta perdida del despacho de prueba'});return
    elif a=='REMISION_CREACION_ESTADO':data={'saved':True,'remission':state['saved']}
    elif a=='REMISION_DOCUMENTOS_FINALIZAR':
     state['finishes']+=1;state['complete']=True;data={'number':REM,'complete':True}
    elif a=='REMISION_OBTENER':data={'number':REM,'orderNumber':OP,'document':state['doc'],'complete':state['complete']}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','code':'OK','requestId':req['requestId'],'data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   # Approved entrance: no operational data before choosing a match.
   for route_name,prefix,input_id in [('clientes','clients','clients-search-input'),('abono','receipt','receipt-query'),('remision','remission','remission-query')]:
    page.goto(ORIGIN+'/'+route_name+'.html')
    cover=page.locator('.maddy-entrance');expect(cover).to_be_visible()
    page.wait_for_function("[...document.querySelectorAll('.maddy-entrance img')].every(i=>i.complete&&i.naturalWidth>0)")
    expect(page.locator('#'+input_id)).not_to_be_focused()
    assert page.evaluate("getComputedStyle(document.querySelector('.maddy-entrance')).backgroundColor==='rgb(245, 245, 244)'")
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    assert page.locator('.maddy-entrance-character').evaluate('(e)=>getComputedStyle(e).filter==="none"&&getComputedStyle(e).mixBlendMode==="normal"'), 'Mascot must retain its original colors'
    assert page.locator('.maddy-entrance-character').evaluate('(e)=>e.naturalWidth>=1086&&e.naturalHeight>=1448&&e.naturalHeight>=e.getBoundingClientRect().height*2'), 'Mascot must provide real pixels for a 2x display'
    if width>=900:
     assert page.locator('.maddy-entrance-folio').evaluate('(e)=>e.getBoundingClientRect().left===0&&Math.abs(e.getBoundingClientRect().right-innerWidth)<=1'), 'Desktop graphite field must span the viewport'
     assert page.locator('.maddy-entrance-folio').evaluate('(e)=>e.getBoundingClientRect().height<innerHeight*.31'), 'Desktop base must not split the viewport in half'
     assert page.locator('.maddy-entrance-content').evaluate('(e)=>e.getBoundingClientRect().right+16<document.querySelector(".maddy-entrance-character").getBoundingClientRect().left'), 'Search and mascot must have separate columns'
     assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'), 'Idle desktop entrance must fit its viewport'
    assert page.locator('.maddy-entrance button[type=submit]').evaluate('(e)=>Math.abs(e.getBoundingClientRect().y-e.closest("form").querySelector("input").getBoundingClientRect().y)<16'), 'Search action must stay beside the input'
    page.screenshot(path=str(OUT/f'entrada-{route_name}-{width}.png'),full_page=True)
    page.locator('#'+input_id).focus()
    if width<900:expect(page.locator('.maddy-entrance-art')).to_be_hidden()
    page.screenshot(path=str(OUT/f'buscador-{route_name}-{width}.png'),full_page=True)
   if width in (1916,1366,1024):
    context.close()
    continue
   page.goto(ORIGIN+'/index.html')
   expect(page.locator('#dashboard-group-diario .dashboard-menu-copy strong')).to_have_text(['Ventas','Cotizaciones','Abonos','Remisiones'])
   assert page.evaluate("document.querySelectorAll('.dashboard-menu-group')[1].getBoundingClientRect().top>=document.querySelector('.dashboard-menu-group').getBoundingClientRect().bottom"),'Secondary tools must be below all daily actions'
   if width<=760:
    page.get_by_role('button',name='Más herramientas').click()
    for item in page.locator('#dashboard-group-diario .dashboard-menu-item').all():expect(item).to_be_visible()
   page.screenshot(path=str(OUT/f'inicio-diario-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.get_by_role('link',name='Remisiones Buscar una OP y preparar la entrega').click()
   expect(page).to_have_url(ORIGIN+'/remision.html');expect(page.locator('#remission-query')).to_be_visible()
   page.goto(ORIGIN+'/remision.html?prueba='+QA)
   query=page.locator('#remission-query');query.fill('00000001')
   expect(page.locator('.rm-client-group')).to_have_count(1);expect(page.locator('.rm-order-option')).to_have_count(2)
   expect(page.locator('.rm-client-heading')).to_contain_text('Cliente de muestra')
   page.screenshot(path=str(OUT/f'busqueda-remisiones-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   query.fill('anterior')
   page.wait_for_function("document.querySelector('#remission-search-form').dataset.state==='loading'")
   deadline=time.monotonic()+10
   while not state['held'] and time.monotonic()<deadline:page.wait_for_timeout(20)
   assert state['held'],'Previous search did not reach the API'
   query.fill('Cliente de muestra');expect(page.locator('.rm-order-option')).to_have_count(2)
   state['held'].fulfill(status=200,json={'status':'success','code':'OK','data':{'items':[],'total':0}})
   page.wait_for_timeout(100);expect(page.locator('.rm-order-option')).to_have_count(2)
   query.fill('sin coincidencias');expect(page.locator('#remission-search-status')).to_contain_text('No encontramos órdenes')
   query.fill('fallo');expect(page.locator('#remission-search-status')).to_contain_text('Pulsa Buscar para volver a intentar')
   page.get_by_role('button',name='Limpiar búsqueda').click();expect(query).to_have_value('');expect(page.locator('#remission-account')).to_be_hidden()
   query.fill('Cliente de muestra');expect(page.locator('.rm-order-option')).to_have_count(2)
   page.locator('.rm-order-option').first.click();expect(page.locator('#remission-account')).to_be_visible()
   expect(page.locator('#remission-cover')).to_be_hidden()
   page.get_by_role('button',name='Nueva búsqueda').click();count=len(state['searches'])
   query.fill('mp-op-0002');query.press('Enter');expect(page.locator('#remission-account')).to_be_visible()
   assert len(state['searches'])==count,'Exact OP must skip list search'
   expect(page.locator('#remission-order-link')).to_have_text('MP-OP-0002')
   page.goto(ORIGIN+'/remision.html?op='+OP+'&prueba='+QA)
   expect(page.locator('#remission-account')).to_be_visible();expect(page.locator('#rm-select-0')).not_to_be_checked();expect(page.locator('#rm-select-1')).to_be_disabled();expect(page.locator('#rm-select-2')).to_be_disabled()
   assert page.locator('.is-complete').inner_text().find('✓ Despacho completo')>=0
   page.locator('#remission-mode-person').select_option('PROPIETARIO');expect(page.get_by_label('Nombre del propietario',exact=True)).to_be_visible()
   page.locator('#remission-transporter-people').get_by_role('button',name='Piallero de prueba').click();expect(page.locator('#remission-mode-person')).to_have_value('PIALLERO');expect(page.locator('#remission-transporter-favorite')).to_be_checked()
   page.locator('#remission-accompanied').check();page.locator('#remission-assistant-people').get_by_role('button',name='Operario de prueba').click()
   page.locator('#remission-accompanied').uncheck();expect(page.locator('#remission-assistant-section')).to_be_hidden();page.locator('#remission-accompanied').check()
   page.locator('#rm-select-0').check();page.locator('#rm-qty-0').fill('2');page.locator('#remission-physical').check()
   page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/f'remision-form-{width}.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.locator('#remission-submit').click();page.get_by_role('button',name='Consultar resultado',exact=True).wait_for();page.reload();page.get_by_role('button',name='Abrir remisión',exact=True).wait_for();page.get_by_role('button',name='Abrir remisión',exact=True).click();expect(page.locator('#remission-result')).to_contain_text('Piallero de prueba');expect(page.locator('#remission-result')).to_contain_text('Operario de prueba')
   assert state['creates']==1 and state['finishes']==1;assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(OUT/f'remision-result-{width}.png'),full_page=True);context.close()
  for name,many in [('remision-horizontal',False),('remision-continuacion',True)]:
   doc=copy.deepcopy(BASE)
   if many:
    doc['items']=[{'itemId':f'ITEM-{i}','description':f'Mueble de control {i:02d}: '+('Descripción con medidas y acabados de ejemplo. '*5),'quantity':1,'pendingAfter':2,'unit':'UN'} for i in range(1,31)]
    doc['notes']=('Indicaciones extensas para comprobar continuidad sin perder texto. '*30)+'FIN DE INDICACIONES'
   renderer=browser.new_page(viewport={'width':1120,'height':1200});errors=[];renderer.on('pageerror',lambda e:errors.append(str(e)))
   renderer.goto(ORIGIN+'/documento-render.html',wait_until='networkidle');renderer.evaluate('(data)=>{const s=document.createElement("script");s.id="maddy-document-data";s.type="application/json";s.textContent=JSON.stringify(data);document.body.append(s)}',doc)
   renderer.wait_for_selector('[data-document-ready="true"]',timeout=20000)
   count=renderer.locator('.rm-document').count();assert count>1 if many else count==1
   for i,node in enumerate(renderer.locator('.rm-document').all(),1):
    assert node.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1');node.screenshot(path=str(OUT/f'{name}-{i}.png'))
   pdf=OUT/f'{name}.pdf';renderer.pdf(path=str(pdf),width='8.5in',height='5.5in',print_background=True,prefer_css_page_size=True,display_header_footer=False,margin={'top':'0','bottom':'0','left':'0','right':'0'})
   reader=PdfReader(pdf);assert len(reader.pages)==count
   text=' '.join(pg.extract_text() or '' for pg in reader.pages)
   for pg in reader.pages:assert abs(float(pg.mediabox.width)-612)<1 and abs(float(pg.mediabox.height)-396)<1
   assert all(x in text for x in ['REMISIÓN','Piallero de prueba','Operario de prueba','Despachador de prueba','Firma de quien despacha']);assert 'Saldo' not in text and 'Valor' not in text
   if many:
    for i in range(1,31):assert text.count(f'Mueble de control {i:02d}')==1
    assert 'FIN DE INDICACIONES' in text
   assert not errors,errors;renderer.close()
  browser.close()
 print('OK: despacho móvil/escritorio, favoritos, operario opcional, respuesta perdida sin duplicar y PDF horizontal con continuación.')
finally:server.terminate()
