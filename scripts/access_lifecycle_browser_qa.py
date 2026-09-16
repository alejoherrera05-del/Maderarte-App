"""Browser acceptance with synthetic accounts only; never contacts Firebase/Sheets."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('artifacts/access-lifecycle');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4173'
SESSION={'profile':{'uid':'qa-owner','email':'owner@example.invalid','name':'Responsable de muestra','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP','TP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00Z','persistence':'session'}
USER={'name':'Asesora de muestra','email':'asesora@example.invalid','role':'VENDEDOR','mainBranch':'TP','branches':['TP'],'status':'ACTIVO','lastAccess':'2026-09-16T14:00:00Z','permissions':['app.access','ordenes.read'],'accessRevision':'rev1','editable':True,'customAccess':True}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen(ORIGIN+'/configuracion.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=2)
   ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(SESSION))
   user=dict(USER);writes=[];errors=[]
   def route(r):
    b=r.request.post_data_json;a=b['action'];v=b.get('payload',{})
    if a=='AUTH_SESSION_VALIDATE':data=SESSION
    elif a=='SISTEMA_ESTADO':data={'mode':'OPERACION'}
    elif a=='USUARIOS_LISTAR':data={'items':[user],'roles':[],'invitations':[]}
    elif a=='USUARIO_ESTADO_GUARDAR':
     assert v['revision']==user['accessRevision'];writes.append(v);user['status']=v['status'];user['accessRevision']='rev'+str(len(writes)+1);data={'saved':True}
    else:raise AssertionError(a)
    r.fulfill(json={'status':'success','data':data})
   ctx.route('**/api/maderarte',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(ORIGIN+'/configuracion.html');page.locator('.team-person').click();page.get_by_role('button',name='Desactivar cuenta',exact=True).click()
   expect(page.locator('.account-impact')).to_contain_text('conservarán');assert not writes
   page.screenshot(path=str(OUT/f'desactivar-{width}.png'))
   page.locator('#account-cancel').click();assert not writes
   page.locator('.team-person').click();page.get_by_role('button',name='Desactivar cuenta',exact=True).click();page.locator('#account-confirm').click();expect(page.locator('#account-feedback')).to_contain_text('Cuenta desactivada');assert len(writes)==1
   page.locator('#cfg-detail-close').click();expect(page.locator('.team-status')).to_contain_text('Inactivo')
   page.locator('.team-person').click();page.get_by_role('button',name='Reactivar cuenta',exact=True).click();expect(page.locator('.account-impact')).to_contain_text('mismas casillas');page.screenshot(path=str(OUT/f'reactivar-{width}.png'));page.locator('#account-confirm').click();expect(page.locator('#account-feedback')).to_contain_text('Cuenta reactivada');assert len(writes)==2
   assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth');assert page.locator('#cfg-detail').evaluate('e=>e.scrollWidth<=e.clientWidth+1');assert not errors;ctx.close()
  # Published source renders only the grants and blocks an already open page after revocation.
  ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
  limited=dict(SESSION,permissions=['app.access','perfil.read','ordenes.read']);revoked=[False]
  ctx.add_init_script("const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));"%json.dumps(limited))
  def limited_route(r):
   a=r.request.post_data_json['action'];assert a=='AUTH_SESSION_VALIDATE'
   if revoked[0]:r.fulfill(status=403,json={'status':'error','code':'USER_INACTIVE','msg':'Cuenta desactivada'})
   else:r.fulfill(json={'status':'success','data':limited})
  ctx.route('**/api/maderarte',limited_route);page=ctx.new_page();page.goto(ORIGIN+'/index.html')
  expect(page.locator('[data-menu-key=ventas]')).to_be_visible();expect(page.locator('[data-menu-key=cotizaciones]')).to_be_hidden();page.locator('[data-menu-key=ventas]').click()
  expect(page.get_by_role('link',name='Nueva orden')).to_be_hidden();expect(page.get_by_role('link',name='Ver órdenes')).to_be_visible();page.locator('#dashboard-sheet-close').click();page.screenshot(path=str(OUT/'inicio-limitado-390.png'))
  revoked[0]=True;page.evaluate("window.dispatchEvent(new Event('maddy:access-recheck'))");expect(page.locator('#access-changed')).to_be_visible();page.screenshot(path=str(OUT/'acceso-retirado-390.png'));page.keyboard.press('Escape');expect(page.locator('#access-changed')).to_be_visible();ctx.close()
  # No real identity is created. Both paths use a stub transport and reject final activation.
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=2);firebase=[]
   def activation_route(r):
    a=r.request.post_data_json['action']
    if a=='INVITACION_VALIDAR':r.fulfill(json={'status':'success','data':dict(USER,branches=['TP'])})
    elif a=='INVITACION_ACTIVAR':r.fulfill(status=409,json={'status':'error','code':'QA_ONLY','msg':'Prueba visual: sin activar cuentas reales'})
    else:raise AssertionError(a)
   def identity(r):firebase.append(r.request.url);r.fulfill(json={'idToken':'synthetic-token'})
   ctx.route('**/api/maderarte',activation_route);ctx.route('https://identitytoolkit.googleapis.com/**',identity);page=ctx.new_page();page.goto(ORIGIN+'/activar-cuenta.html?token=synthetic')
   expect(page.locator('#activation-form')).to_be_visible();expect(page.locator('#activation-confirm-field')).to_be_hidden();expect(page.locator('#activation-branches')).to_contain_text('Terraplaza');page.locator('#activation-password').fill('synthetic-password');page.locator('#activation-button').click();expect(page.locator('#activation-message')).to_contain_text('sin activar');assert 'signInWithPassword' in firebase[-1]
   page.locator('[name=activation-mode][value=new]').check();expect(page.locator('#activation-confirm-field')).to_be_visible();page.screenshot(path=str(OUT/f'primer-ingreso-{width}.png'));page.locator('#activation-confirm').fill('synthetic-password');page.locator('#activation-button').click();expect(page.locator('#activation-message')).to_contain_text('sin activar');assert 'signUp' in firebase[-1]
   assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth');ctx.close()
  browser.close()
 print('Access lifecycle browser acceptance passed: reviewed state changes, cancel, reactivation, scoped home, live revocation, existing/new identity paths, 1440/390/320.')
finally:server.terminate();server.wait(timeout=10)
