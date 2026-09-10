import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from PIL import Image,ImageDraw
from pypdf import PdfReader
OUT=Path('artifacts/owner-sandbox');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4177'
def api(path,data=None):
    req=urllib.request.Request(ORIGIN+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(req,timeout=90))
def wait_evidence(predicate):
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        data=api('/__qa/evidence')
        if predicate(data):return data
        time.sleep(.2)
    raise AssertionError('El estado esperado del transporte simulado no se confirmó')
photos=[]
for i in (1,2):
    file=OUT/f'referencia-{i}.png';im=Image.new('RGB',(400,240),(220-i*15,222,225));ImageDraw.Draw(im).text((24,100),f'REFERENCIA TECNICA {i} - NO PRODUCTO',fill=(30,30,30));im.save(file);photos.append(file)
server=subprocess.Popen(['node','scripts/owner-sandbox-test-server.mjs'])
try:
    for _ in range(60):
        try:api('/__qa/evidence');break
        except Exception:time.sleep(.2)
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
        for width,height in [(1440,1000),(390,844),(320,800)]:
            api('/__qa/reset');context=browser.new_context(viewport={'width':width,'height':height},extra_http_headers={'Cookie':'__Host-maderarte_session=qa-session'})
            context.add_init_script("""if(!sessionStorage.getItem('MADERARTE_APP_SESSION_SNAPSHOT_V1'))sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify({profile:{uid:'qa-owner',email:'owner@example.invalid',name:'Propietario QA',role:'PROPIETARIO',status:'ACTIVO',mainBranch:'MP',branches:['MP','TP']},permissions:['*'],expiresAt:'2099-01-01T00:00:00Z',validatedAt:Date.now(),persistence:'session'}));localStorage.setItem('maderarte.order-save.v1.otro-usuario','preservar');""")
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto(ORIGIN+'/prueba-pedido.html');page.get_by_role('button',name='Preparar espacio de prueba',exact=True).click()
            page.get_by_role('link',name='Abrir formulario de prueba',exact=True).wait_for(timeout=60000)
            page.screenshot(path=str(OUT/f'control-listo-{width}.png'),full_page=True)
            page.get_by_role('link',name='Abrir formulario de prueba',exact=True).click()
            page.locator('[data-quote-branch="MP"]').click();page.locator('#quote-workspace').wait_for(state='visible')
            expect(page.locator('#quote-client-document')).to_have_value('0000000001');assert page.locator('#quote-client-name').evaluate('e=>e.readOnly')
            for i in range(1,3):
                if i==2:page.locator('#quote-add-item').click()
                card=page.locator(f'.quote-item[data-item-id="{i}"]')
                card.locator('[data-field="description"]').fill('Sofá QA' if i==1 else 'Comedor QA')
                card.locator('[data-field="unitValue"]').fill('2000000' if i==1 else '1500000')
                plan='ENTREGA_INMEDIATA' if i==1 else 'SOLICITAR_FABRICA'
                card.locator('.order-plan-option').filter(has=page.locator(f'[value="{plan}"]')).click()
                card.locator('details').first.evaluate('e=>e.open=true')
                card.locator('[data-field="fabric"]').fill('Lino crema de prueba')
                card.locator('[data-field="wood"]').fill('Nogal mate')
                card.locator('[data-photo-input]').set_input_files(str(photos[i-1]))
                expect(card.locator('.quote-photo-thumb img')).to_have_count(1,timeout=15000)
                page.wait_for_function('(i)=>document.querySelector(`[data-item-id="${i}"] [data-photo-input]`).files.length===0',arg=i)
            page.locator('[data-payment-method]').first.select_option('TRANSFERENCIA');page.locator('[data-payment-amount]').first.fill('500000')
            page.locator('[data-payment-note]').first.fill('SECRETO INTERNO NO IMPRIMIR')
            page.locator('#order-add-payment').click();page.locator('[data-payment-method]').nth(1).select_option('EFECTIVO');page.locator('[data-payment-amount]').nth(1).fill('200000')
            page.locator('#quote-discount').fill('200000');page.locator('#quote-notes').fill('Prueba con referencias, sin cobro ni entrega.')
            expect(page.locator('#quote-submit')).to_be_enabled(timeout=15000)
            page.locator('.quote-items-section').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'formulario-{width}.png'),full_page=True)
            if width==1440:api('/__qa/faults',{'ORDEN_FOTO_GUARDAR':True,'INTERNO_DOCUMENTO_CONFIRMAR':True})
            page.locator('#quote-submit').click()
            if width==1440:
                # A button exists during progress too. Wait for the failure state
                # rather than clicking while the recovery routine still owns its lock.
                wait_evidence(lambda d:any(x.get('mimeType')=='image/png' for x in d['files']))
                expect(page.locator('.quote-write-note')).to_contain_text('Faltan sus documentos',timeout=20000)
                page.reload()
                wait_evidence(lambda d:bool(d.get('orders')) and d['orders'][0]['Estado_Documentos']=='COMPLETO')
                expect(page.locator('.quote-write-note')).to_contain_text('Faltan sus documentos',timeout=20000)
                page.reload()
                page.get_by_role('button',name='Abrir pedido',exact=True).wait_for(timeout=60000)
                page.get_by_role('button',name='Abrir pedido',exact=True).click()
            page.wait_for_url('**/orden.html?**',timeout=60000)
            page.locator('[data-order-section="4"]').click()
            page.get_by_role('button',name='Abrir PDF',exact=True).wait_for(timeout=30000)
            page.locator('[data-order-section="0"]').click()
            for index,details in enumerate(page.locator('.od-photo-details').all()):
                page.locator('[data-select-item]').nth(index).click()
                page.locator('[data-detail-index]').nth(index).get_by_role('tab',name='Referencias',exact=True).click()
                details.locator('summary').click()
            expect(page.locator('.od-photo-grid img')).to_have_count(2,timeout=30000)
            data=api('/__qa/evidence');assert data['productionUnchanged'] and data['commercialWrites'] is False
            assert data['counts']['Ordenes_Pedido']==1 and data['counts']['Orden_Items']==2 and data['counts']['Abonos']==2
            assert data['orders'][0]['Estado_Documentos']=='COMPLETO' and data['pdfs']==1
            assert all(x['Cantidad_Entregada']==0 for x in data['items'])
            number=data['orders'][0]['Numero_OP'];sid=data['state']['id'];assert '-QA-' in number
            for image in page.locator('.od-photo-grid img').all():assert image.evaluate('e=>e.complete&&e.naturalWidth>0')
            page.screenshot(path=str(OUT/f'expediente-{width}.png'),full_page=True)
            page.reload();page.locator('[data-order-section="4"]').click();page.get_by_role('button',name='Abrir PDF',exact=True).wait_for();assert api('/__qa/evidence')['counts']['Ordenes_Pedido']==1
            pdf=OUT/'pedido-1.pdf';reader=PdfReader(pdf);text=' '.join(pg.extract_text() or '' for pg in reader.pages)
            assert 'SECRETO INTERNO' not in text and 'Sofá QA' in text and 'Comedor QA' in text
            assert len(reader.pages)>=2
            for pg in reader.pages:assert 'SIN VALIDEZ COMERCIAL' in (pg.extract_text() or '')
            shutil.copyfile(pdf,OUT/f'pedido-verificado-{width}.pdf')
            page.goto(ORIGIN+'/prueba-pedido.html');page.get_by_role('button',name='Finalizar y limpiar prueba',exact=True).click()
            expect(page.locator('#sandbox-clean')).to_be_disabled();page.locator('#sandbox-confirmation').fill('LIMPIAR OTRO');expect(page.locator('#sandbox-clean')).to_be_disabled()
            page.locator('#sandbox-cancel').click();assert api('/__qa/evidence')['state']['stage']=='ACTIVA'
            page.get_by_role('button',name='Finalizar y limpiar prueba',exact=True).click();page.locator('#sandbox-confirmation').fill('LIMPIAR '+sid)
            page.screenshot(path=str(OUT/f'confirmacion-limpieza-{width}.png'),full_page=True);page.locator('#sandbox-clean').click()
            page.get_by_text('Limpieza confirmada.',exact=False).wait_for(timeout=60000)
            final=api('/__qa/evidence');assert final['state']['stage']=='CERRADA' and final['productionUnchanged']
            assert all(x.get('trashed',False) for x in final['files'] if x['id'] not in ['synthetic-production','production-docs','main-root'])
            assert page.evaluate("localStorage.getItem('maderarte.order-save.v1.otro-usuario')")=='preservar'
            assert page.evaluate("localStorage.getItem('maderarte.order-save.v1.qa-owner.'+"+json.dumps(sid)+")") is None
            page.screenshot(path=str(OUT/f'limpieza-confirmada-{width}.png'),full_page=True)
            page.goto(ORIGIN+'/pedido.html');page.locator('[data-quote-branch="MP"]').click();expect(page.locator('#quote-submit')).to_be_disabled()
            assert not errors,errors
            results.append({'width':width,'number':number,'orders':1,'payments':2,'photos':2,'pdfs':1,'pages':len(reader.pages),'cleanup':'CERRADA','productionUnchanged':True,'google':'SIMULADO'})
            print('PASS SANDBOX',results[-1]);context.close()
        browser.close()
    (OUT/'resultado.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
except Exception:
    try:
        (OUT/'fallo-evidencia.json').write_text(json.dumps(api('/__qa/evidence'),ensure_ascii=False,indent=2))
        page.screenshot(path=str(OUT/'fallo-pantalla.png'),full_page=True)
        (OUT/'fallo-texto.txt').write_text(page.locator('body').inner_text())
    except Exception:pass
    raise
finally:server.terminate();server.wait(timeout=10)
