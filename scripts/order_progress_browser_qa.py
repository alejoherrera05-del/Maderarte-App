"""Observed save stages; real form/Worker/Cerebro, isolated synthetic Google only."""
import json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image
OUT=Path('artifacts/order-progress');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4177'
def api(path,data=None):
    return json.load(urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'}),timeout=60))
photo=OUT/'reference.png';Image.new('RGB',(300,200),(218,218,218)).save(photo)
server=subprocess.Popen(['node','scripts/owner-sandbox-test-server.mjs'])
try:
    for _ in range(60):
        try:api('/__qa/evidence');break
        except Exception:time.sleep(.2)
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
        for width in (1440,390,320):
            api('/__qa/reset')
            context=browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce' if width==320 else 'no-preference',extra_http_headers={'Cookie':'__Host-maderarte_session=qa-session'})
            context.add_init_script("""sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify({profile:{uid:'qa-owner',email:'owner@example.invalid',name:'Propietario QA',role:'PROPIETARIO',status:'ACTIVO',mainBranch:'MP',branches:['MP','TP']},permissions:['*'],expiresAt:'2099-01-01T00:00:00Z',validatedAt:Date.now(),persistence:'session'}));
            const realFetch=window.fetch; window.__gates={}; let finalized=false;
            window.fetch=async(url,options)=>{let action;try{action=JSON.parse(options?.body||'{}').action;}catch{}
              if(['ORDEN_CREAR','ORDEN_FOTO_GUARDAR','ORDEN_DOCUMENTOS_FINALIZAR'].includes(action)||(action==='ORDEN_DOCUMENTOS_ESTADO'&&finalized))await new Promise(resolve=>window.__gates[action]=resolve);
              const response=await realFetch(url,options);if(action==='ORDEN_DOCUMENTOS_FINALIZAR')finalized=true;return response;};""")
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(ORIGIN+'/prueba-pedido.html');page.get_by_role('button',name='Preparar espacio de prueba',exact=True).click()
            page.get_by_role('link',name='Abrir formulario de prueba',exact=True).click(timeout=60000)
            page.locator('[data-quote-branch="MP"]').click()
            card=page.locator('[data-item-id="1"]');card.locator('[data-field="description"]').fill('Mueble QA progreso');card.locator('[data-field="unitValue"]').fill('2000000')
            card.locator('.order-plan-option').filter(has=page.locator('[value="ENTREGA_INMEDIATA"]')).click();card.locator('details').first.evaluate('e=>e.open=true')
            card.locator('[data-photo-input]').set_input_files(str(photo));page.wait_for_function('()=>document.querySelector("[data-photo-input]").files.length===0')
            page.locator('#order-no-payment').check();expect(page.locator('#quote-submit')).to_be_enabled()
            page.locator('#quote-submit').click();dialog=page.locator('.order-progress-dialog');expect(dialog).to_be_visible()
            def gate(action):page.wait_for_function('(a)=>typeof window.__gates[a]==="function"',arg=action,timeout=30000)
            def release(action):page.evaluate('(a)=>{window.__gates[a]();delete window.__gates[a]}',action)
            def status(step,value):expect(page.locator('[data-progress-step="'+step+'"]')).to_have_attribute('data-state',value)
            gate('ORDEN_CREAR');status('prepare','complete');status('record','running');status('photos','pending');status('document','pending')
            page.keyboard.press('Escape');expect(dialog).to_be_visible()
            page.screenshot(path=str(OUT/f'01-registrando-{width}.png'))
            page.wait_for_timeout(1100);status('record','running');status('photos','pending')
            release('ORDEN_CREAR');gate('ORDEN_FOTO_GUARDAR');status('record','complete');status('photos','running');status('document','pending')
            page.screenshot(path=str(OUT/f'02-fotografias-{width}.png'))
            release('ORDEN_FOTO_GUARDAR');gate('ORDEN_DOCUMENTOS_FINALIZAR');status('photos','complete');status('document','running');status('verify','pending')
            assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
            if width==320:assert page.locator('[data-state="running"] .order-progress-icon').evaluate('e=>getComputedStyle(e).animationName')=='none'
            page.screenshot(path=str(OUT/f'03-creando-pdf-{width}.png'))
            release('ORDEN_DOCUMENTOS_FINALIZAR');gate('ORDEN_DOCUMENTOS_ESTADO');status('document','complete');status('verify','running')
            page.screenshot(path=str(OUT/f'04-verificando-{width}.png'));release('ORDEN_DOCUMENTOS_ESTADO')
            page.wait_for_url('**/orden.html?**',timeout=30000)
            evidence=api('/__qa/evidence');assert evidence['counts']['Ordenes_Pedido']==1 and evidence['pdfs']==1 and evidence['productionUnchanged']
            assert not errors,errors;results.append({'width':width,'stagesConfirmed':True,'timerDoesNotAdvanceSteps':True,'orders':1,'pdfs':1,'google':'SIMULADO'})
            context.close()
        browser.close()
    (OUT/'resultado.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(results)
finally:server.terminate();server.wait(timeout=10)
