"""Actual frontend with synthetic API responses; never writes commercial data."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/collections');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-cash','name':'Responsable de muestra','role':'PROPIETARIO','branches':['MP','TP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00Z'}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(ORIGIN+'/recaudos.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=2)
   ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   rows=[dict(number='MP-RC-001',orderNumber='MP-OP-001',branch='MP',client='Cliente de muestra · sala',date='2026-09-14T17:00:00Z',amount=500000,method='EFECTIVO',registeredBy='Asesor principal',handover=None),dict(number='TP-RC-001',orderNumber='TP-OP-001',branch='TP',client='Cliente de muestra · comedor',date='2026-09-14T18:00:00Z',amount=300000,method='EFECTIVO',registeredBy='Asesor Terraplaza',handover=None)]
   for method,value in [('TARJETA',450000),('ADDI',900000),('TRANSFERENCIA',650000)]:rows.append(dict(rows[0],number='MP-RC-'+method,method=method,amount=value))
   results={};writes=[];errors=[];queries=[]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='RECAUDOS_LISTAR':
     queries.append(v);items=[x for x in rows if not v.get('branch') or v['branch']==x['branch']];methods={};branches={}
     for x in items:methods[x['method']]=methods.get(x['method'],0)+x['amount'];branches[x['branch']]=branches.get(x['branch'],0)+x['amount']
     cash=methods.get('EFECTIVO',0);received=sum(x['amount'] for x in items if x['handover'])
     data=dict(items=items,total=sum(x['amount'] for x in items),cash=cash,received=received,pending=cash-received,methods=methods,branches=branches,asOf='2026-09-14T19:00:00Z',enabled=True)
    elif a=='RECAUDO_RECIBIR':
     rid=b['requestId'];assert rid not in results;assert v['physicalCheck'] and v['expectedTotal']==800000;assert set(v['receipts'])=={'MP-RC-001','TP-RC-001'};writes.append(v);results[rid]={'requestId':rid}
     for x in rows:
      if x['number'] in v['receipts']:x['handover']={'by':SESSION['profile']['name'],'date':'2026-09-14T19:00:00Z'}
     r.fulfill(status=503,json={'status':'error','code':'COLLECTION_SAVE_UNCERTAIN','message':'Respuesta interrumpida de prueba'});return
    elif a=='RECAUDO_RECEPCION_ESTADO':data={'saved':v['requestId'] in results,'result':results.get(v['requestId'])}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   ctx.route('**/api/maderarte',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/recaudos.html');expect(page.locator('.cl-row')).to_have_count(5)
   page.locator('[data-period=month]').click();expect(page.locator('[data-period=month]')).to_have_attribute('aria-pressed','true');expect(page.locator('#cl-filter button')).to_be_enabled();assert queries[-1]['from'].endswith('-01')
   page.locator('#cl-branch').select_option('TP');page.locator('#cl-filter button').click();expect(page.locator('.cl-row')).to_have_count(1)
   page.locator('#cl-branch').select_option('');page.locator('#cl-filter button').click();expect(page.locator('.cl-row')).to_have_count(5)
   before=page.locator('#cl-total').inner_text();page.screenshot(path=str(OUT/f'overview-{width}.png'),full_page=True)
   page.locator('#cl-view').select_option('pending');expect(page.locator('.cl-row')).to_have_count(2);page.locator('#cl-select-all').click();page.locator('#cl-receive').click();expect(page.locator('#cl-confirm-form')).to_be_visible()
   page.locator('#cl-confirm-form input').check();page.locator('#cl-dialog').evaluate('e=>e.getAnimations().forEach(a=>a.finish())');page.screenshot(path=str(OUT/f'confirm-{width}.png'),full_page=True)
   page.locator('#cl-confirm-form button').click();expect(page.locator('#cl-recover')).to_be_visible();page.reload();expect(page.locator('#cl-recover')).to_be_visible();page.locator('#cl-recover').click();expect(page.locator('#cl-dialog')).not_to_be_visible();expect(page.locator('#cl-total')).to_have_text(before);assert len(writes)==1
   page.locator('#cl-view').select_option('received');expect(page.locator('.cl-row')).to_have_count(2);expect(page.locator('#cl-list')).to_contain_text('Responsable de muestra');page.screenshot(path=str(OUT/f'received-{width}.png'),full_page=True)
   assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth'),width
   assert not errors,errors;ctx.close()
  browser.close()
 print('Collections UI passed: daily/month periods, branch filters, selection, physical check, lost reply/reload recovery, unchanged total and 1440/390/320 layouts.')
finally:server.terminate();server.wait(timeout=10)
