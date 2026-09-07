"""Actual form + actual Apps Script logic; only Google transport is synthetic."""
import io, json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageFont
OUT=Path('artifacts/order-documents');OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:4174'
server=subprocess.Popen(['node','scripts/order-documents-test-server.mjs'])
def get(path):
    with urllib.request.urlopen(BASE+path) as r:return json.load(r)
def reference_image():
    image=Image.new('RGB',(1200,800),'#f1f1f0');draw=ImageDraw.Draw(image)
    font=ImageFont.load_default(size=36)
    draw.rounded_rectangle((50,50,1150,750),radius=28,fill='white',outline='#c4c4c4',width=3)
    draw.text((105,100),'REFERENCIA TECNICA DE ENSAYO',font=font,fill='#333333')
    draw.text((105,165),'Archivo sintetico para comprobar carga y anexo',font=ImageFont.load_default(size=25),fill='#666666')
    draw.rectangle((105,255,1095,585),fill='#e4e4e2',outline='#aaaaaa',width=2)
    draw.line((105,255,1095,585),fill='#bdbdbd',width=3);draw.line((1095,255,105,585),fill='#bdbdbd',width=3)
    draw.text((105,650),'NO ES UN PRODUCTO NI UNA VENTA REAL',font=ImageFont.load_default(size=28),fill='#8e4e23')
    buffer=io.BytesIO();image.save(buffer,format='PNG');return buffer.getvalue()
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
            try:
                page.goto(BASE+'/pedido.html?ensayo=1')
                page.locator('[data-quote-branch=MP]').click()
                for field,value in {'document':'000000001','name':'Cliente tecnico - NO REAL','phone':'000000011','alternatePhone':'000000022','email':'N/A','address':'Direccion de ensayo','city':'Popayan (ensayo)'}.items():page.locator('#quote-client-'+field).fill(value)
                first=page.locator('[data-item-id="1"]')
                first.locator('[data-field=description]').fill('Sofa de ensayo')
                first.locator('[data-field=unitValue]').fill('2000000')
                first.locator('.order-plan-option').filter(has=page.locator('[value=ENTREGA_INMEDIATA]')).click()
                first.locator('summary').click()
                first.locator('[data-field=fabric]').fill('Lino crema')
                first.locator('[data-field=wood]').fill('Nogal mate')
                first.locator('[data-field=specifications]').fill('2,10 × 0,88 m. Referencia tecnica de prueba; no fabricar.')
                first.locator('[data-photo-input]').set_input_files({'name':'referencia-qa.png','mimeType':'image/png','buffer':reference_image()})
                first.locator('.quote-photo-thumb img').wait_for(state='attached')
                page.locator('#quote-add-item').click()
                second=page.locator('[data-item-id="2"]')
                second.locator('[data-field=description]').fill('Comedor de ensayo')
                second.locator('[data-field=unitValue]').fill('1500000')
                second.locator('.order-plan-option').filter(has=page.locator('[value=SOLICITAR_FABRICA]')).click()
                page.locator('#quote-add-item').click()
                third=page.locator('[data-item-id="3"]')
                third.locator('[data-field=description]').fill('Puff de ensayo')
                third.locator('[data-field=quantity]').fill('2')
                third.locator('[data-field=unitValue]').fill('350000')
                third.locator('.order-plan-option').filter(has=page.locator('[value=SEPARADO]')).click()
                page.locator('#quote-discount').fill('200000')
                for index,(method,amount) in enumerate([('TRANSFERENCIA','500000'),('EFECTIVO','100000'),('TARJETA','100000'),('ADDI','300000')]):
                    if index:page.locator('#order-add-payment').click()
                    row=page.locator('[data-payment-row]').nth(index)
                    row.locator('[data-payment-method]').select_option(method)
                    row.locator('[data-payment-amount]').fill(amount)
                    row.locator('[data-payment-note]').fill('SECRETO-INTERNO-NO-IMPRIMIR')
                page.locator('#quote-notes').fill('ENSAYO TECNICO SIN VALIDEZ COMERCIAL. No entregar ni cobrar.')
                page.locator('#quote-submit').click()
                page.get_by_text('fotografías, orden y recibos archivados y enlazados.',exact=False).wait_for(timeout=120000)
                page.screenshot(path=str(OUT/f'completo-{width}.png'),full_page=True)
                data=get('/__test/state');tables=data['tables'];orders=tables['Ordenes_Pedido']['rows'];assert len(orders)==1
                op=orders[0];assert op['Estado_Documentos']=='COMPLETO';assert op['Cedula_NIT']=='000000001';assert op['Telefono_Alterno']=='000000022'
                assert len(tables['Abonos']['rows'])==4
                assert all(x['Nota_Interna']=='SECRETO-INTERNO-NO-IMPRIMIR' for x in tables['Abonos']['rows'])
                assert op['Valor_Total']==4000000 and op['Abonado_Total']==1000000
                assert all(op[k] for k in ['URL_PDF_OP','URL_Carpeta_Cliente','URL_Carpeta_OP'])
                assert len(tables['Documentos']['rows'])==6
                assert len(tables['Versiones_Documentos']['rows'])==5
                assert tables['Orden_Items']['rows'][0]['URL_Foto']
                assert len([x for x in data['posts'] if x['action']=='ORDEN_CREAR'])==1
                snapshots=[x for x in data['posts'] if x['action'].startswith('ORDEN_DOCUMENT')]
                assert 'SECRETO-INTERNO' not in json.dumps(snapshots)
                get('/__test/export')
                pdf=PdfReader(OUT/(op['Numero_OP']+'-v1.pdf'));assert len(pdf.pages)>=2
                for i,pg in enumerate(pdf.pages):
                    images=list(pg.images);assert images,f'Missing page image {i}'
                    (OUT/f'pdf-{width}-pagina-{i+1}.jpg').write_bytes(images[0].data)
                for payment in tables['Abonos']['rows']:
                    receipt=payment['Numero_Recibo'];rp=PdfReader(OUT/(receipt+'-v1.pdf'));assert len(rp.pages)>=1
                    (OUT/f'recibo-{width}-{receipt}.jpg').write_bytes(list(rp.pages[0].images)[0].data)
                page.reload();page.get_by_role('button',name='Abrir pedido',exact=True).first.wait_for(timeout=30000)
                page.get_by_role('button',name='Abrir pedido',exact=True).first.click()
                page.wait_for_url('**/orden.html?op=**',timeout=30000)
                # The compact header subtitle is deliberately hidden on mobile;
                # assert the visible product data rather than a desktop-only label.
                page.locator('.od-item-copy > strong').filter(has_text='Sofa de ensayo').wait_for()
                assert 'Lino crema' in page.locator('body').inner_text()
                assert '000000022' in page.locator('body').inner_text()
                assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
                page.screenshot(path=str(OUT/f'expediente-{width}.png'),full_page=True)
                assert len([x for x in get('/__test/state')['posts'] if x['action']=='ORDEN_CREAR'])==1
                assert not errors,errors
                print('PASS',width,'3 muebles / 4 unidades / 4 abonos: formulario real → Apps Script real → Google simulado → foto/OP/4 recibos/indexacion → recarga sin duplicados')
            except Exception:
                page.screenshot(path=str(OUT/f'error-{width}.png'),full_page=True)
                print('PAGE STATE',page.locator('body').inner_text());print('ERRORS',errors);raise
            finally:context.close()
        browser.close()
finally:server.terminate()
