"""Team UI on synthetic transport. Does not invite or alter real accounts."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/team-access');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-team','name':'Responsable de muestra','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP','TP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00Z'}
GROUPS=[{'title':'Acceso','items':[['app.access','Entrar a Maddy'],['ordenes.read','Consultar órdenes'],['ordenes.create','Crear órdenes'],['abonos.create','Registrar abonos']]}]
PEOPLE=[{'name':'Propietario de muestra','email':'owner@example.invalid','role':'PROPIETARIO','mainBranch':'MP','branches':['MP','TP'],'status':'ACTIVO','lastAccess':'2026-09-16T15:00:00Z'},{'name':'Asesora de Terraplaza','email':'asesora@example.invalid','role':'VENDEDOR','mainBranch':'TP','branches':['TP'],'status':'ACTIVO','lastAccess':'2026-09-16T14:00:00Z'}]
ROLES=[{'role':'PROPIETARIO','permissions':['*'],'active':True,'invitable':False},{'role':'VENDEDOR','permissions':['app.access','ordenes.read','ordenes.create','abonos.create'],'active':True,'invitable':True},{'role':'BODEGA_LOGISTICA','permissions':['app.access','ordenes.read','produccion.update','remisiones.create'],'active':True,'invitable':True}]
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(ORIGIN+'/configuracion.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=2)
   ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   pending=[];writes=[];errors=[];lost=[False]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='SISTEMA_ESTADO':data={'mode':'OPERACION','appVersion':'0.2.0','commercialWrites':'HABILITADAS','spreadsheetName':'Base de Datos Maderarte App','counts':{'clients':2,'orders':3}}
    elif a=='USUARIOS_LISTAR':data={'items':PEOPLE,'roles':ROLES,'invitations':pending,'permissionGroups':GROUPS,'permissionDependencies':{}}
    elif a=='INVITACION_CREAR':
     writes.append(v);assert v['mainBranch']=='TP' and 'TP' in v['branches'];pending.append(dict(v,id='QA-INV-'+str(len(writes)),expiresAt='2099-01-01T00:00:00Z',status='PENDIENTE'))
     if lost[0]:r.fulfill(status=503,json={'status':'error','code':'NETWORK_ERROR','message':'Respuesta interrumpida de muestra'});return
     data={'activationUrl':ORIGIN+'/activar-cuenta.html?token=synthetic-token','expiresAt':'2099-01-01T00:00:00Z'}
    else:raise AssertionError(a)
    r.fulfill(status=200,json={'status':'success','data':data})
   ctx.route('**/api/maderarte',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/configuracion.html');expect(page.locator('.team-person')).to_have_count(2);page.screenshot(path=str(OUT/f'equipo-{width}.png'),full_page=True)
   page.locator('#team-query').fill('asesora');expect(page.locator('.team-person')).to_have_count(1);page.locator('.team-person').click();expect(page.locator('#cfg-detail-body')).to_contain_text('Terraplaza');expect(page.locator('#cfg-detail-body')).to_contain_text('Crear órdenes');page.locator('#cfg-detail').evaluate('e=>e.getAnimations().forEach(a=>a.finish())');page.screenshot(path=str(OUT/f'persona-{width}.png'));page.keyboard.press('Escape')
   page.locator('#team-query').fill('');page.locator('#team-branch').select_option('MP');expect(page.locator('.team-person')).to_have_count(1);page.locator('#team-branch').select_option('')
   page.locator('[data-section=roles]').click();expect(page.locator('[data-panel=roles]')).to_be_visible();page.locator('#team-roles summary').nth(1).click();page.screenshot(path=str(OUT/f'roles-{width}.png'),full_page=True)
   page.locator('[data-section=equipo]').click();page.locator('#team-invite').click();page.locator('#invitation-name').fill('Persona de muestra');page.locator('#invitation-email').fill('new@example.invalid');page.locator('#invitation-main-branch').select_option('TP');expect(page.locator('[name=invitation-branch][value=TP]')).to_be_checked();expect(page.locator('[name=invitation-branch][value=TP]')).to_be_disabled();page.locator('#invitation-form [type=submit]').click();assert not writes
   expect(page.locator('#invitation-review')).to_contain_text('new@example.invalid');page.locator('#invitation-edit').click();expect(page.locator('#invitation-name')).to_have_value('Persona de muestra');page.locator('#invitation-form [type=submit]').click();page.locator('#cfg-detail').evaluate('e=>e.getAnimations().forEach(a=>a.finish())');page.screenshot(path=str(OUT/f'invitacion-{width}.png'))
   page.locator('#invitation-create').click();expect(page.locator('#invitation-link')).to_be_visible();assert len(writes)==1;page.locator('#cfg-detail-close').click();expect(page.locator('#team-invitations')).to_contain_text('new@example.invalid')
   lost[0]=True;page.locator('#team-invite').click();page.locator('#invitation-name').fill('Segunda persona');page.locator('#invitation-email').fill('second@example.invalid');page.locator('#invitation-main-branch').select_option('TP');page.locator('#invitation-form [type=submit]').click();page.locator('#invitation-create').click();expect(page.locator('#invitation-result')).to_contain_text('interrumpida');expect(page.locator('#invitation-create')).to_be_disabled();assert len(writes)==2
   assert not errors,errors;assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth');assert page.locator('#cfg-detail').evaluate('e=>e.scrollWidth<=e.clientWidth+1');ctx.close()
  # Config-only users must not query the protected directory.
  ctx=browser.new_context();limited=dict(SESSION,permissions=['app.access','config.read']);ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(limited));calls=[]
  def limited_route(r):
   a=r.request.post_data_json['action'];calls.append(a);assert a!='USUARIOS_LISTAR';r.fulfill(json={'status':'success','data':limited if a=='AUTH_SESSION_VALIDATE' else {'mode':'OPERACION'}})
  ctx.route('**/api/maderarte',limited_route);page=ctx.new_page();page.goto(ORIGIN+'/configuracion.html');expect(page.locator('#cfg-system')).to_contain_text('OPERACION');expect(page.locator('#team-invite')).to_have_count(0);assert 'USUARIOS_LISTAR' not in calls;ctx.close();browser.close()
 print('Team UI passed: people/roles, branch filtering, reviewed invitation, preserved edit, lost response without duplicate, config-only access and 1440/390/320 layouts.')
finally:server.terminate();server.wait(timeout=10)
