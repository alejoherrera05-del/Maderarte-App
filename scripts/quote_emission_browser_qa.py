"""Real form + Worker + Apps Script, loopback Google transport; no real writes."""
import json,os,sys,subprocess,time,urllib.request,shutil,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from pypdf import PdfReader
OUT=Path('artifacts/quote-emission');OUT.mkdir(parents=True,exist_ok=True)
ORIGIN='http://127.0.0.1:4177'
def api(path,data=None):
    return json.load(urllib.request.urlopen(urllib.request.Request(ORIGIN+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'}),timeout=90))
server=subprocess.Popen(['node','scripts/owner-sandbox-test-server.mjs'])
try:
    for _ in range(60):
        try:api('/__qa/evidence');break
        except Exception:time.sleep(.2)
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
        for width,height in [(1440,1000),(390,844),(320,800)]:
            api('/__qa/reset')
            context=browser.new_context(viewport={'width':width,'height':height},extra_http_headers={'Cookie':'__Host-maderarte_session=qa-session'})
            context.add_init_script("""sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify({profile:{uid:'qa-owner',email:'owner@example.invalid',name:'Propietario QA',role:'PROPIETARIO',status:'ACTIVO',mainBranch:'MP',branches:['MP','TP']},permissions:['*'],expiresAt:'2099-01-01T00:00:00Z',validatedAt:Date.now(),persistence:'session'}));""")
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto(ORIGIN+'/prueba-pedido.html');page.get_by_role('button',name='Preparar espacio de prueba',exact=True).click()
            page.get_by_role('link',name='Probar cotización',exact=True).click(timeout=60000)
            page.locator('[data-quote-branch="MP"]').click();page.locator('#quote-workspace').wait_for(state='visible')
            expect(page.locator('#quote-client-document')).to_have_value('0000000001')
            for i in range(2):
                if i:page.locator('#quote-add-item').click()
                card=page.locator('.quote-item').nth(i)
                card.locator('[data-field="description"]').fill(['Sofá QA','Comedor QA'][i]);card.locator('[data-field="unitValue"]').fill(['2000000','1500000'][i])
                card.locator('details').first.evaluate('e=>e.open=true')
                card.locator('[data-field="fabric"]').fill('Lino de prueba')
                if i==0:
                    import base64
                    photo=OUT/'reference.png';photo.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aI1cAAAAASUVORK5CYII='))
                    card.locator('[data-photo-input]').set_input_files(str(photo))
                    expect(card.locator('.quote-photo-thumb img')).to_have_count(1)
            page.locator('#quote-discount').fill('200000');page.locator('#quote-notes').fill('Observación QA sin cobro ni entrega.')
            expect(page.locator('#quote-submit')).to_be_enabled()
            baseline=api('/__qa/evidence')['actions']
            page.locator('#quote-preview-button').click();expect(page.locator('#quote-preview-content')).to_have_attribute('aria-busy','false',timeout=30000)
            ids=page.locator('.order-progress-dialog h2').evaluate_all('nodes=>nodes.map(n=>n.id)')
            assert len(ids)==len(set(ids)),'Preview/save module versions must retain unique accessible IDs'
            assert page.locator('.quote-preview-page').count()>=2
            evidence=api('/__qa/evidence');assert evidence['counts']['Clientes']==0 and evidence['counts']['Cotizaciones']==0
            assert evidence['actions']==baseline,'Preview must not call the API'
            page.screenshot(path=str(OUT/f'preview-{width}.png'),full_page=True)
            page.locator('#quote-preview-close').click()
            if width==1440:api('/__qa/faults',{'COTIZACION_CREAR':True,'COTIZACION_FOTO_GUARDAR':True,'INTERNO_COTIZACION_DOCUMENTO_CONFIRMAR':True})
            page.locator('#quote-submit').evaluate('e=>{e.click();e.click()}')
            if width==1440:
                expect(page.locator('.order-progress-dialog[open]')).to_have_attribute('data-mode','paused',timeout=30000)
                expect(page.locator('.order-progress-dialog[open] [data-progress-number]')).to_be_hidden()
                # Lost entity reply -> photo reply -> PDF reply: recover same journal.
                for _ in range(3):
                    page.reload()
                    expect(page.locator('.order-progress-dialog[open]')).to_have_attribute('data-mode','paused',timeout=60000) if _<2 else page.get_by_role('button',name='Abrir cotización',exact=True).wait_for(timeout=60000)
                page.get_by_role('button',name='Abrir cotización',exact=True).click()
            page.wait_for_url('**/cotizacion-ver.html?**',timeout=60000)
            expect(page.get_by_role('button',name='Abrir PDF',exact=True)).to_be_enabled(timeout=30000)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'expediente-{width}.png'),full_page=True)
            evidence=api('/__qa/evidence');assert evidence['counts']['Cotizaciones']==1 and evidence['counts']['Clientes']==1
            assert evidence['counts']['Ordenes_Pedido']==0 and evidence['counts']['Abonos']==0
            assert evidence['counts']['Archivos_Cotizacion']==2 and evidence['pdfs']==1 and evidence['productionUnchanged'] and not evidence['commercialWrites']
            creates=[a for a in evidence['actions'] if a['action']=='COTIZACION_CREAR'];assert len(creates)==1
            assert all(a['sandbox']==evidence['state']['id'] for a in evidence['actions'] if a['action'].startswith(('COTIZACION_','INTERNO_COTIZACION_')))
            reader=PdfReader('artifacts/owner-sandbox/pedido-1.pdf');text=' '.join(pg.extract_text() or '' for pg in reader.pages)
            assert len(reader.pages)==2 and 'Sofá QA' in text and 'Comedor QA' in text and '3.300.000' in ''.join(text.split())
            assert 'ASESOR COMERCIAL' not in text.upper()
            assert 'SIN VALIDEZ COMERCIAL' in text
            for pg in reader.pages:assert abs(float(pg.mediabox.width)-595.28)<2 and abs(float(pg.mediabox.height)-841.89)<2
            page.reload();expect(page.get_by_role('button',name='Abrir PDF',exact=True)).to_be_enabled()
            page.get_by_role('link',name='Preparar orden de pedido',exact=True).click()
            page.wait_for_url('**/pedido.html?**',timeout=30000)
            conversion_url=page.url
            expect(page.locator('#quote-origin-notice')).to_be_visible(timeout=30000)
            expect(page.locator('.quote-item')).to_have_count(2)
            expect(page.locator('#quote-discount')).to_have_value('200000')
            assert page.locator('#quote-client-document').evaluate('e=>e.readOnly')
            expect(page.locator('#quote-add-item')).to_be_disabled()
            expect(page.locator('.quote-photo-thumb img')).to_have_count(1)
            assert api('/__qa/evidence')['counts']['Ordenes_Pedido']==0
            for card in page.locator('.quote-item').all():
                assert card.locator('[data-field="description"]').evaluate('e=>e.readOnly')
                card.locator('.order-plan-option').filter(has=page.locator('[value="ENTREGA_INMEDIATA"]')).click()
            page.locator('#order-no-payment').check()
            page.locator('#quote-notes').fill('Acuerdo revisado desde la cotización.')
            expect(page.locator('#quote-submit')).to_be_enabled()
            page.locator('#quote-submit').click()
            page.wait_for_url('**/orden.html?**',timeout=60000)
            page.locator('[data-order-section="4"]').click()
            source_link=page.get_by_role('link',name='Cotización de origen',exact=False)
            expect(source_link).to_be_visible(timeout=30000)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'conversion-{width}.png'),full_page=True)
            evidence=api('/__qa/evidence')
            assert evidence['counts']['Cotizaciones']==1 and evidence['counts']['Ordenes_Pedido']==1
            assert evidence['counts']['Abonos']==0 and evidence['pdfs']==2
            assert evidence['productionUnchanged'] and not evidence['commercialWrites']
            order_url=page.url
            source_link.click()
            expect(page.get_by_role('link',name='Ver OP',exact=False)).to_be_visible(timeout=30000)
            expect(page.get_by_role('link',name='Preparar orden de pedido',exact=True)).to_have_count(0)
            page.goto(conversion_url);page.wait_for_url(order_url,timeout=30000)
            assert api('/__qa/evidence')['counts']['Ordenes_Pedido']==1
            page.get_by_role('link',name='Registrar abono',exact=True).click()
            page.wait_for_url('**/abono.html?**',timeout=30000)
            expect(page.locator('#receipt-account')).to_be_visible(timeout=30000)
            expect(page.locator('#receipt-balance')).to_contain_text('3.300.000')
            page.locator('#receipt-amount').fill('100000')
            page.locator('#receipt-method').select_option('TRANSFERENCIA')
            page.locator('#receipt-concept').fill('Abono de caja de prueba')
            page.locator('summary').filter(has_text='Nota interna').click()
            page.locator('#receipt-internal').fill('PRIVADO JAMAS IMPRIMIR')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'recibo-formulario-{width}.png'),full_page=True)
            if width==1440:api('/__qa/faults',{'RECIBO_CREAR':True,'INTERNO_RECIBO_DOCUMENTO_CONFIRMAR':True})
            expect(page.locator('#receipt-submit')).to_be_enabled()
            page.locator('#receipt-submit').click()
            if width==1440:
                page.get_by_role('button',name='Consultar resultado',exact=True).wait_for(timeout=60000)
                page.reload()
                page.get_by_role('button',name='Consultar resultado',exact=True).wait_for(timeout=60000)
                page.reload()
                page.get_by_role('button',name='Abrir recibo',exact=True).click(timeout=60000)
            page.wait_for_url('**/abono.html?recibo=**',timeout=60000)
            expect(page.get_by_role('button',name='Abrir PDF',exact=True)).to_be_enabled(timeout=30000)
            page.screenshot(path=str(OUT/f'recibo-confirmado-{width}.png'),full_page=True)
            evidence=api('/__qa/evidence')
            assert evidence['counts']['Abonos']==1 and evidence['orders'][0]['Abonado_Total']==100000
            assert evidence['orders'][0]['Saldo_Pendiente']==3200000
            receipt_pdf=PdfReader('artifacts/owner-sandbox/pedido-3.pdf')
            receipt_text=' '.join(pg.extract_text() or '' for pg in receipt_pdf.pages)
            assert len(receipt_pdf.pages)==1 and 'RECIBO DE CAJA' in receipt_text
            assert abs(float(receipt_pdf.pages[0].mediabox.width)-612)<1 and abs(float(receipt_pdf.pages[0].mediabox.height)-396)<1
            assert 'PRIVADO' not in receipt_text and 'Abono de caja de prueba' in receipt_text
            assert '100.000' in ''.join(receipt_text.split()) and '3.200.000' in ''.join(receipt_text.split())
            assert evidence['productionUnchanged'] and not evidence['commercialWrites']
            for payment_index,amount in enumerate([400000,700000,800000],start=2):
                page.get_by_role('button',name='Nuevo abono',exact=True).click()
                page.wait_for_url('**/abono.html?prueba=**',timeout=30000)
                page.goto(order_url)
                page.get_by_role('link',name='Registrar abono',exact=True).click()
                expect(page.locator('#receipt-account')).to_be_visible(timeout=30000)
                expect(page.locator('.receipt-history-row')).to_have_count(payment_index-1)
                page.locator('#receipt-amount').fill(str(amount))
                page.locator('#receipt-method').select_option('TRANSFERENCIA')
                page.locator('#receipt-concept').fill('Abono de prueba '+str(payment_index))
                page.locator('#receipt-submit').click()
                page.wait_for_url('**/abono.html?recibo=**',timeout=60000)
                expect(page.get_by_role('button',name='Abrir PDF',exact=True)).to_be_enabled(timeout=30000)
            evidence=api('/__qa/evidence')
            assert evidence['counts']['Abonos']==4 and evidence['orders'][0]['Abonado_Total']==2000000 and evidence['orders'][0]['Saldo_Pendiente']==1300000
            final_pdf=PdfReader('artifacts/owner-sandbox/pedido-6.pdf')
            assert len(final_pdf.pages)==1,'four payments fit on one half-letter page'
            final_text=final_pdf.pages[0].extract_text()
            assert 'Historial de abonos' in final_text and 'PRIVADO' not in final_text
            for payment in evidence['payments']:assert payment['Numero_Recibo'] in final_text
            for n,label in [(1,'cotizacion'),(2,'orden'),(3,'recibo-1'),(4,'recibo-2'),(5,'recibo-3'),(6,'recibo-4')]:
                shutil.copyfile(f'artifacts/owner-sandbox/pedido-{n}.pdf',OUT/f'recorrido-{label}.pdf')
            subprocess.run(['pdftoppm','-scale-to','1600','-png','-singlefile',str(OUT/'recorrido-recibo-4.pdf'),str(OUT/'recorrido-recibo-4')],check=True)
            if width==1440:
                long_history=json.loads(Path('artifacts/owner-sandbox/render-plan-6.json').read_text())
                long_history['history']=[{'number':f'MP-QA-REC-{n:04d}','date':long_history['date'],'method':'TRANSFERENCIA','amount':10000,'balance':3300000-n*10000} for n in range(1,31)]
                long_history.update(number='MP-QA-REC-0030',amount=10000,previousBalance=3010000,balance=3000000,total=3300000)
                long_source=OUT/'historial-largo.json';long_source.write_text(json.dumps(long_history))
                long_pdf_path=OUT/'historial-largo.pdf'
                subprocess.run(['python','scripts/render_owner_sandbox_pdf.py',str(long_source),str(long_pdf_path),ORIGIN],check=True)
                long_pdf=PdfReader(long_pdf_path);assert len(long_pdf.pages)>1
                long_text=' '.join(p.extract_text() for p in long_pdf.pages)
                for row in long_history['history']:assert row['number'] in long_text
                for p in long_pdf.pages:assert abs(float(p.mediabox.width)-612)<1 and abs(float(p.mediabox.height)-396)<1
                subprocess.run(['pdftoppm','-scale-to','1600','-png',str(long_pdf_path),str(OUT/'historial-largo')],check=True)
            before_sample=evidence['counts'].copy()
            with page.expect_response(lambda r:r.url.endswith('/api/maderarte') and r.request.post_data_json.get('action')=='RECIBO_MUESTRA_PDF',timeout=90000) as sample_response:
                page.get_by_role('button',name='PDF de muestra',exact=True).click()
            sample_data=sample_response.value.json()['data']
            expect(page.get_by_role('link',name='Abrir PDF de muestra',exact=True)).to_be_visible(timeout=30000)
            sample_path=OUT/'recibo-muestra-media-carta.pdf'
            sample_path.write_bytes(base64.b64decode(sample_data['base64']))
            sample_pdf=PdfReader(sample_path)
            assert len(sample_pdf.pages)==1
            assert abs(float(sample_pdf.pages[0].mediabox.width)-612)<1 and abs(float(sample_pdf.pages[0].mediabox.height)-396)<1
            assert 'SIN VALIDEZ COMERCIAL' in sample_pdf.pages[0].extract_text()
            assert api('/__qa/evidence')['counts']==before_sample
            subprocess.run(['pdftoppm','-scale-to','1600','-png','-singlefile',str(sample_path),str(OUT/'recibo-muestra-media-carta')],check=True)
            page.goto(ORIGIN+'/abono.html')
            expect(page.get_by_role('heading',name='Abonos',exact=True)).to_be_visible()
            expect(page.locator('#receipt-workflow')).to_be_hidden()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'recibo-inicio-{width}.png'),full_page=True)
            assert not errors,errors
            results.append({'width':width,'quotes':1,'orders':1,'receipts':4,'pdfs':6,'pages':len(reader.pages),'previewWrites':0,'productionUnchanged':True,'google':'SIMULADO'})
            context.close();print(results[-1])
        browser.close()
    (OUT/'resultado.json').write_text(json.dumps(results,indent=2))
finally:
    server.terminate();server.wait(timeout=10)
