"""Actual form + actual Apps Script logic; only Google transport is synthetic."""
import base64, json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
OUT=Path('artifacts/order-documents');OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:4174'
server=subprocess.Popen(['node','scripts/order-documents-test-server.mjs'])
def get(path):
    with urllib.request.urlopen(BASE+path) as r:return json.load(r)
try:
    for _ in range(60):
        try:get('/__test/state');break
        except Exception:time.sleep(.2)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
        for width in [1440,390,320]:
            session=get('/__test/reset')['session']
            context=browser.new_context(viewport={'width':width,'height':1000 if width==1440 else 844},device_scale_factor=1)
            context.add_init_script("sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify("+json.dumps(session)+"));")
            page=context.new_page();errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:print('CONSOLE',m.type,m.text) if m.type=='error' else None)
            page.goto(BASE+'/pedido.html?ensayo=1')
            page.locator('[data-quote-branch=MP]').click()
            for field,value in {'document':'000000001','name':'Cliente técnico — NO REAL','phone':'000000011','alternatePhone':'000000022','email':'N/A','address':'Dirección de ensayo','city':'Popayán (ensayo)'}.items():page.locator('#quote-client-'+field).fill(value)
            first=page.locator('[data-item-id="1"]')
            first.locator('[data-field=description]').fill('Sofá de ensayo')
            first.locator('[data-field=unitValue]').fill('2000000')
            first.locator('.order-plan-option').filter(has=page.locator('[value=ENTREGA_INMEDIATA]')).click()
            first.locator('summary').click()
            first.locator('[data-field=fabric]').fill('Lino crema')
            first.locator('[data-field=wood]').fill('Nogal mate')
            first.locator('[data-field=specifications]').fill('2,10 × 0,88 m. Fotografía técnica de prueba; no fabricar.')
            first.locator('[data-photo-input]').set_input_files({'name':'referencia-qa.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')})
            first.locator('.quote-photo-thumb img').wait_for(state='attached')
            page.locator('#quote-add-item').click()
            second=page.locator('[data-item-id="2"]')
            second.locator('[data-field=description]').fill('Comedor de ensayo')
            second.locator('[data-field=unitValue]').fill('1500000')
            second.locator('.order-plan-option').filter(has=page.locator('[value=SOLICITAR_FABRICA]')).click()
            page.locator('[data-payment-method]').select_option('TRANSFERENCIA')
            page.locator('[data-payment-amount]').fill('500000')
            page.locator('[data-payment-note]').fill('SECRETO-INTERNO-NO-IMPRIMIR')
            page.locator('#quote-notes').fill('ENSAYO TÉCNICO SIN VALIDEZ COMERCIAL. No entregar ni cobrar.')
            page.locator('#quote-submit').click()
            try:
                page.get_by_text('fotografías, orden y recibos archivados y enlazados.',exact=False).wait_for(timeout=120000)
            except Exception:
                page.screenshot(path=str(OUT/f'error-{width}.png'),full_page=True)
                print('PAGE STATE',page.locator('body').inner_text());print('SERVER',json.dumps(get('/__test/state'),ensure_ascii=False)[-12000:]);raise
            page.screenshot(path=str(OUT/f'completo-{width}.png'),full_page=True)
            data=get('/__test/state');tables=data['tables']
            orders=tables['Ordenes_Pedido']['rows'];assert len(orders)==1
            op=orders[0];assert op['Estado_Documentos']=='COMPLETO';assert op['Cedula_NIT']=='000000001';assert op['Telefono_Alterno']=='000000022'
            assert len(tables['Abonos']['rows'])==1;assert tables['Abonos']['rows'][0]['Nota_Interna']=='SECRETO-INTERNO-NO-IMPRIMIR'
            assert op['Valor_Total']==3500000 and op['Abonado_Total']==500000
            assert all(op[k] for k in ['URL_PDF_OP','URL_Carpeta_Cliente','URL_Carpeta_OP'])
            assert len(tables['Documentos']['rows'])==3
            assert len(tables['Versiones_Documentos']['rows'])==2
            assert tables['Orden_Items']['rows'][0]['URL_Foto']
            assert len([x for x in data['posts'] if x['action']=='ORDEN_CREAR'])==1
            snapshots=[x for x in data['posts'] if x['action'].startswith('ORDEN_DOCUMENT')]
            assert 'SECRETO-INTERNO' not in json.dumps(snapshots)
            get('/__test/export')
            pdf=PdfReader(OUT/(op['Numero_OP']+'-v1.pdf'));assert len(pdf.pages)>=2
            for i,pg in enumerate(pdf.pages):
                images=list(pg.images);assert images,f'Missing page image {i}'
                (OUT/f'pdf-{width}-pagina-{i+1}.jpg').write_bytes(images[0].data)
            receipt=tables['Abonos']['rows'][0]['Numero_Recibo']
            rp=PdfReader(OUT/(receipt+'-v1.pdf'));assert len(rp.pages)>=1
            (OUT/f'recibo-{width}.jpg').write_bytes(list(rp.pages[0].images)[0].data)
            page.reload();page.get_by_role('button',name='Abrir pedido',exact=True).first.wait_for(timeout=30000)
            page.get_by_role('button',name='Abrir pedido',exact=True).first.click()
            page.wait_for_url('**/orden.html?op=**',timeout=30000)
            page.get_by_text('Expediente de orden',exact=True).wait_for()
            assert 'Lino crema' in page.locator('body').inner_text()
            assert '000000022' in page.locator('body').inner_text()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            page.screenshot(path=str(OUT/f'expediente-{width}.png'),full_page=True)
            assert len([x for x in get('/__test/state')['posts'] if x['action']=='ORDEN_CREAR'])==1
            assert not errors,errors
            print('PASS',width,'formulario real → lógica Apps Script real → Google simulado → fotos/OP/recibo/indexación → recarga sin venta duplicada')
            context.close()
        browser.close()
finally:server.terminate()
