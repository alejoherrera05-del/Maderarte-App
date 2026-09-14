"""Actual adjustment UI, synthetic transport; no requests to Google."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/order-adjustments');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-adjust','name':'Equipo de prueba','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z'}
ORDER={'number':'MP-OP-0001','client':'Cliente de muestra','document':'000000001','date':'2026-09-12T12:00:00Z','city':'Popayán','status':'CONFIRMADA','branch':'MP','revision':1,'total':1500000,'paid':2100000,'balance':0,'credit':600000}
POSITION={k:ORDER[k] for k in ['total','paid','balance','credit']};POSITION['fingerprint']='a'*64
ITEM={'id':'item-1','description':'Sofá de tres puestos','category':'SOFA','quantity':1,'pending':1,'delivered':0,'cancelled':0,'net':1500000,'unitValue':1500000,'unit':'UN','agreement':'SEPARADO','fulfillment':'PARA_SOLICITAR','revision':1,'tracking':{'totals':{'SOLICITADO':1},'events':[{'id':'qa-production','stage':'SOLICITADO','quantity':1,'date':'2026-09-12','by':'Equipo de muestra','notes':''}],'stage':'SOLICITADO','received':0,'available':0}}
TARGET={'number':'MP-OP-0002','client':'Cuenta de familiar · muestra','document':'000000002','status':'CONFIRMADA','total':2000000,'paid':0,'balance':2000000,'credit':0}
TPOS={k:TARGET[k] for k in ['total','paid','balance','credit']};TPOS['fingerprint']='b'*64
EVENT={'id':'MP-AJ-0001','type':'DESISTIR','amount':2000000,'source':ORDER['number'],'date':'2026-09-12T12:00:00Z','reason':'Desistimiento de muestra','reference':''}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(40):
  try:urllib.request.urlopen(ORIGIN+'/orden.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   context=browser.new_context(viewport={'width':width,'height':960},device_scale_factor=2,reduced_motion='reduce' if width==320 else 'no-preference')
   context.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   writes=[];errors=[];withdrawn=[False]
   def route(r):
    b=r.request.post_data_json;a=b['action'];payload=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='ORDEN_OBTENER':data={'order':dict(ORDER,total=0,credit=2100000) if withdrawn[0] else ORDER,'items':[dict(ITEM,cancelled=1,pending=0,adjustmentVerified=True,tracking=dict(ITEM['tracking'],totals={'SOLICITADO':0},stage='')) if withdrawn[0] else ITEM],'payments':[],'remissions':[],'documents':[],'adjustments':[EVENT],'mediaWorkflow':0}
    elif a=='AJUSTE_CUENTA':data={'order':TARGET if payload['number']==TARGET['number'] else ORDER,'position':TPOS if payload['number']==TARGET['number'] else POSITION,'items':[ITEM],'events':[EVENT],'enabled':True}
    elif a=='ORDENES_LISTAR':data={'items':[TARGET],'total':1}
    elif a=='AJUSTE_PREVISUALIZAR':
     if payload['type']=='DESISTIR':
      assert payload['items']==[{'itemId':ITEM['id'],'quantity':1}]
      data={'type':'DESISTIR','amount':1500000,'before':POSITION,'after':dict(POSITION,total=0,credit=2100000),'items':[{'itemId':ITEM['id'],'description':ITEM['description'],'quantity':1,'reduction':1500000}]}
     else:
      assert payload['type']=='TRANSFERIR' and payload['amount']==100000
      data={'type':'TRANSFERIR','amount':100000,'before':POSITION,'after':dict(POSITION,paid=2000000,credit=500000),'target':TARGET,'targetBefore':TPOS,'targetAfter':dict(TPOS,paid=100000,balance=1900000),'items':[]}
    elif a=='AJUSTE_CONFIRMAR':writes.append(b);withdrawn[0]=payload['type']=='DESISTIR';data={'saved':True,'result':{'id':'MP-AJ-0002','number':ORDER['number']}}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   context.route('**/api/maderarte',route);page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/orden.html?op='+ORDER['number']);page.locator('.aj-entry').click();dialog=page.locator('.aj-dialog');expect(dialog.get_by_role('button',name='Usar saldo en otra OP')).to_be_visible()
   page.screenshot(path=str(OUT/f'account-{width}.png'));assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   dialog.get_by_role('button',name='Usar saldo en otra OP').click();dialog.locator('[name=amount]').fill('100000');dialog.locator('[data-query]').fill('familiar');dialog.get_by_role('button',name='Buscar cuenta',exact=True).click();dialog.locator('[data-destination]').click();expect(dialog.locator('[data-selected]')).to_contain_text(TARGET['number'])
   dialog.locator('[name=reason]').fill('Cliente autoriza traslado parcial a la cuenta de su familiar.');dialog.get_by_role('button',name='Revisar ajuste').click();expect(dialog.get_by_role('button',name='Confirmar traslado')).to_be_visible();expect(dialog).to_contain_text('500.000');expect(dialog).to_contain_text('1.900.000');assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.screenshot(path=str(OUT/f'review-{width}.png'));dialog.get_by_role('button',name='Confirmar traslado').click();expect(dialog).to_contain_text('Movimiento registrado');assert len(writes)==1;assert writes[0]['payload']['target']==TARGET['number'];assert not errors,errors
   dialog.locator('[data-close]').click();page.locator('.aj-entry').click();dialog.get_by_role('button',name='Retirar muebles',exact=True).click()
   amount=dialog.get_by_role('spinbutton',name='Cantidad a retirar de '+ITEM['description']);expect(amount).to_be_enabled();amount.fill('1')
   dialog.locator('[name=reason]').fill('El cliente retira el sofá del pedido.');page.screenshot(path=str(OUT/f'withdraw-select-{width}.png'))
   dialog.get_by_role('button',name='Revisar ajuste').click();expect(dialog).to_contain_text('2.100.000');page.screenshot(path=str(OUT/f'withdraw-review-{width}.png'))
   dialog.get_by_role('button',name='Confirmar desistimiento').click();expect(dialog).to_contain_text('Movimiento registrado');assert len(writes)==2
   page.goto(ORIGIN+'/orden.html?op='+ORDER['number']+'&item='+ITEM['id']);expect(page.locator('[data-route-content] h2')).to_have_text('Desistido')
   assert page.locator('[data-route-content] .ow-primary').count()==0
   page.locator('.ow-journey summary').click();expect(page.locator('.ow-journey')).to_contain_text('Retiro de la OP');page.screenshot(path=str(OUT/f'withdraw-result-{width}.png'),full_page=True)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert not errors,errors
   context.close()
  context=browser.new_context();page=context.new_page();page.goto(ORIGIN+'/documento-render.html')
  doc={'documentKind':'adjustment','issued':True,'number':'MP-AJ-0002','orderNumber':ORDER['number'],'branchCode':'MP','date':'2026-09-12T12:00:00Z','advisor':'Asesor de muestra','client':{'name':'Cliente de muestra','document':'000000001'},'type':'TRANSFERIR','amount':100000,'reason':'Autorización para trasladar saldo a un familiar.','reference':'Soporte de muestra','before':POSITION,'after':dict(POSITION,paid=2000000,credit=500000),'items':[],'target':{'number':TARGET['number'],'client':TARGET['client'],'document':'000000002','before':TPOS,'after':dict(TPOS,paid=100000,balance=1900000)},'sandbox':True}
  page.evaluate("d=>{const n=document.createElement('script');n.type='application/json';n.id='maddy-document-data';n.textContent=JSON.stringify(d);document.body.append(n);}",doc)
  page.wait_for_selector('[data-document-ready=true]');assert page.locator('.aj-document').count()==1
  page.pdf(path=str(OUT/'transfer-sample.pdf'),print_background=True,prefer_css_page_size=True);page.screenshot(path=str(OUT/'document.png'),full_page=True)
  context.close();browser.close()
 print('Adjustment sheet: desktop/mobile, destination search, before/after, one confirmed request and PDF rendering passed.')
finally:server.terminate();server.wait(timeout=10)


