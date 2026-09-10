"""Original form -> simulated API storage -> real approved PDF -> original case file.
Google authorization/Sheets/Drive are deliberately not exercised or claimed here.
"""
import base64, hashlib, io, json, shutil, subprocess, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

out=Path('artifacts/order-documents'); out.mkdir(parents=True, exist_ok=True)
session={'profile':{'uid':'qa-documents','email':'qa@example.invalid','name':'Asesor QA','role':'PROPIETARIO','status':'ACTIVO','mainBranch':'MP','branches':['MP','TP']},'permissions':['*'],'expiresAt':'2099-01-01T00:00:00.000Z','persistence':'session'}
init="const s=%s;s.validatedAt=Date.now();sessionStorage.setItem('MADERARTE_APP_SESSION_SNAPSHOT_V1',JSON.stringify(s));" % json.dumps(session)

def image(label):
    im=Image.new('RGB',(480,300),'#eeeeee'); d=ImageDraw.Draw(im)
    d.rectangle((15,15,465,285),outline='#555555',width=4)
    d.text((40,125),label,fill='#222222'); b=io.BytesIO();im.save(b,format='PNG');return b.getvalue()

server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(40):
        try: urllib.request.urlopen('http://127.0.0.1:4173/pedido.html',timeout=1).close();break
        except Exception: time.sleep(.1)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
        for width in (1440,390,320):
            context=browser.new_context(viewport={'width':width,'height':1000});context.add_init_script(init)
            state={'creates':0,'uploads':0,'renders':0,'lostPhoto':True,'complete':False,'files':[],'order':None,'pdf':b''}
            errors=[];number='MP-QA-OP-0001'
            def route(r):
                req=r.request.post_data_json; action=req['action']; payload=req['payload']; data={}
                def lost(): r.fulfill(status=503,json={'status':'error','code':'UPSTREAM_TIMEOUT','requestId':req['requestId'],'msg':'Respuesta perdida de prueba'})
                if action=='ORDEN_CAPACIDADES': data={'contractVersion':1,'enabled':True,'photosReady':True,'documentsReady':True,'mediaWorkflow':1}
                elif action=='AUTH_SESSION_VALIDATE': data=session
                elif action=='CLIENTES_LISTAR': data={'items':[],'total':0}
                elif action=='ORDEN_CREAR':
                    state['creates']+=1;assert state['creates']==1
                    assert '_media' not in payload and payload['payments'][0]['internalNote']=='INTERNO-QA-NO-IMPRIMIR'
                    state['payload']=payload;state['requestId']=req['requestId']
                    state['order']={'number':number,'branch':'MP','requestId':req['requestId'],'mediaWorkflow':1}
                    for item in payload['items']:
                        for position,photo in enumerate(item['photos'],1):
                            state['files'].append({'id':number+'-I-'+item['clientLineId']+'-F-'+photo['id'],'type':'FOTO','itemId':number+'-I-'+item['clientLineId'],'clientLineId':item['clientLineId'],'photoId':photo['id'],'position':position,'name':photo['name'],'mime':photo['mime'],'size':photo['size'],'sha256':photo['sha256'],'ready':False})
                    data={'saved':True,'order':state['order']}
                elif action=='ORDEN_CREACION_ESTADO': data={'saved':True,'order':state['order']}
                elif action=='ORDEN_DOCUMENTOS_ESTADO': data={'number':number,'complete':state['complete'],'files':[dict({k:v for k,v in f.items() if k!='bytes'},url='https://drive.google.com/file/d/qa-photo/view' if f['ready'] else '') for f in state['files']]+[{'id':'pdf-slot','type':'OP','ready':state['complete'],'url':'https://drive.google.com/file/d/qa-pdf/view' if state['complete'] else ''}]}
                elif action=='ORDEN_FOTO_GUARDAR':
                    f=next(f for f in state['files'] if f['id']==payload['id']);b=base64.b64decode(payload['base64'])
                    assert hashlib.sha256(b).hexdigest()==f['sha256'];assert len(b)==f['size'];assert not f['ready']
                    f['bytes']=b;f['ready']=True;state['uploads']+=1
                    if state['lostPhoto']: state['lostPhoto']=False;lost();return
                    data={'number':number,'id':f['id'],'ready':True}
                elif action=='ORDEN_DOCUMENTOS_FINALIZAR':
                    assert all(f['ready'] for f in state['files'])
                    state['renders']+=1;assert state['renders']==1
                    cmd=state['payload'];items=[]
                    for item in cmd['items']:
                        iid=number+'-I-'+item['clientLineId'];photos=['data:'+f['mime']+';base64,'+base64.b64encode(f['bytes']).decode() for f in state['files'] if f['itemId']==iid]
                        items.append(dict(item,id=iid,photos=photos,subtotal=item['quantity']*item['unitValue']))
                    subtotal=sum(item['subtotal'] for item in items);paid=sum(p['amount'] for p in cmd['payments'])
                    doc={'issued':True,'number':number,'date':'2026-09-07T18:00:00Z','advisor':'Asesor QA','branchCode':'MP','client':cmd['client'],'items':items,'notes':cmd['notes'],'subtotal':subtotal,'discount':cmd['discount'],'total':subtotal-cmd['discount'],'order':{'paid':paid,'balance':subtotal-cmd['discount']-paid,'payments':[{'method':p['method'],'amount':p['amount']} for p in cmd['payments']]}}
                    assert 'INTERNO-QA-NO-IMPRIMIR' not in json.dumps(doc)
                    renderer=browser.new_page(viewport={'width':1120,'height':1200})
                    renderer.goto('http://127.0.0.1:4173/documento-render.html',wait_until='networkidle')
                    renderer.evaluate('(data)=>{const s=document.createElement("script");s.id="maddy-document-data";s.type="application/json";s.textContent=JSON.stringify(data);document.body.append(s)}',doc)
                    renderer.wait_for_selector('[data-document-ready="true"]',timeout=20000)
                    assert renderer.locator('.quote-appendix-group').count()==2
                    state['pdf']=renderer.pdf(format='A4',print_background=True,prefer_css_page_size=True,display_header_footer=False,margin={'top':'0','bottom':'0','left':'0','right':'0'})
                    if width==1440:
                        (out/'pedido-formulario-a-pdf.pdf').write_bytes(state['pdf'])
                        for i,node in enumerate(renderer.locator('.quote-preview-page').all(),1):node.screenshot(path=str(out/f'flujo-pagina-{i}.png'))
                    renderer.close();state['complete']=True;lost();return
                elif action=='ORDEN_OBTENER':
                    cmd=state['payload'];subtotal=sum(i['quantity']*i['unitValue'] for i in cmd['items']);paid=sum(p['amount'] for p in cmd['payments'])
                    data={'mediaWorkflow':1,'order':{'number':number,'branch':'MP','document':cmd['client']['document'],'client':cmd['client']['name'],'phone':cmd['client']['phone'],'alternatePhone':cmd['client']['alternatePhone'],'email':cmd['client']['email'],'city':cmd['client']['city'],'address':cmd['client']['address'],'owner':'Asesor QA','notes':cmd['notes'],'total':subtotal-cmd['discount'],'paid':paid,'balance':subtotal-cmd['discount']-paid,'status':'CONFIRMADA','productionStatus':'PENDIENTE'},'items':[dict(i,id=number+'-I-'+i['clientLineId'],subtotal=i['quantity']*i['unitValue'],fabricColor=i['fabric'],woodColor=i['wood']) for i in cmd['items']],'payments':[{'method':p['method'],'value':p['amount'],'date':'2026-09-07T18:00:00Z'} for p in cmd['payments']],'documents':[]}
                elif action=='ORDEN_FOTO_LEER':
                    f=next(f for f in state['files'] if f['id']==payload['id']);data={'id':f['id'],'dataUrl':'data:'+f['mime']+';base64,'+base64.b64encode(f['bytes']).decode()}
                elif action=='ORDEN_PDF_LEER': data={'mime':'application/pdf','name':number+'.pdf','base64':base64.b64encode(state['pdf']).decode()}
                else: raise AssertionError(action)
                r.fulfill(status=200,json={'status':'success','code':'OK','requestId':req['requestId'],'data':data})
            context.route('**/api/maderarte',route)
            page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto('http://127.0.0.1:4173/pedido.html');page.locator('[data-quote-branch="MP"]').click()
            for name,value in {'document':'000000001','name':'CLIENTE QA — NO REAL','phone':'000000002','alternatePhone':'000000003','email':'qa@example.invalid','address':'Dirección de prueba','city':'Ciudad QA'}.items():page.locator('#quote-client-'+name).fill(value)
            for i,(name,price,plan) in enumerate([('Sofá QA',2000000,'ENTREGA_INMEDIATA'),('Comedor QA',1500000,'SOLICITAR_FABRICA')],1):
                if i>1:page.locator('#quote-add-item').click()
                card=page.locator(f'[data-item-id="{i}"]');card.locator('[data-field=description]').fill(name);card.locator('[data-field=unitValue]').fill(str(price))
                card.locator('.order-plan-option').filter(has=page.locator('[value='+plan+']')).click()
                card.locator('summary').click();card.locator('[data-field=fabric]').fill('Tela de prueba '+str(i));card.locator('[data-field=wood]').fill('Madera de prueba '+str(i))
                card.locator('[data-photo-input]').set_input_files({'name':f'referencia-{i}.png','mimeType':'image/png','buffer':image('REFERENCIA TECNICA MUEBLE '+str(i))})
                card.locator('.quote-photo-thumb img').wait_for(state='attached');page.wait_for_function('(i)=>document.querySelector(`[data-item-id="${i}"] [data-photo-input]`).files.length===0',arg=i)
            page.locator('[data-payment-method]').select_option('TRANSFERENCIA');page.locator('[data-payment-amount]').fill('500000');page.locator('[data-payment-note]').fill('INTERNO-QA-NO-IMPRIMIR')
            page.locator('#quote-notes').fill('PRUEBA AUTOMATIZADA CON API SIMULADA — SIN VALIDEZ COMERCIAL.')
            page.locator('#quote-submit').click();page.locator('.quote-write-note').filter(has_text='Faltan sus documentos').wait_for()
            assert state['creates']==1 and state['uploads']==1
            page.reload();page.locator('.quote-write-note').filter(has_text='Faltan sus documentos').wait_for()
            assert state['creates']==1 and state['uploads']==2 and state['renders']==1
            page.reload();page.get_by_role('button',name='Abrir pedido',exact=True).wait_for()
            page.get_by_role('button',name='Abrir pedido',exact=True).click();page.wait_for_url('**/orden.html?op=MP-QA-OP-0001')
            page.locator('[data-order-section="4"]').click()
            page.get_by_role('button',name='Abrir PDF',exact=True).wait_for()
            page.locator('[data-order-section="0"]').click()
            for i,node in enumerate(page.locator('[data-order-item]').all(),1):
                if page.locator('[data-list-back]').is_visible(): page.locator('[data-list-back]').click()
                page.locator('[data-select-item]').nth(i-1).click()
                node.get_by_role('tab',name='Referencias',exact=True).click()
                node.locator('.od-photo-details summary').click();img=node.locator('.od-photo-grid img');img.wait_for();page.wait_for_function('(el)=>el.complete&&el.naturalWidth>0',arg=img.element_handle())
                expected=next(f for f in state['files'] if f['clientLineId']==str(i))
                assert hashlib.sha256(base64.b64decode(img.get_attribute('src').split(',')[1])).hexdigest()==expected['sha256']
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+1')
            page.locator('[data-order-section="1"]').click()
            assert '000000001' in page.locator('#order-app').inner_text()
            page.screenshot(path=str(out/f'expediente-con-fotos-{width}.png'),full_page=True)
            pdftext=' '.join(p.extract_text() or '' for p in PdfReader(io.BytesIO(state['pdf'])).pages)
            assert 'Sofá QA' in pdftext and 'Comedor QA' in pdftext and 'INTERNO-QA-NO-IMPRIMIR' not in pdftext
            assert state['creates']==1 and state['uploads']==2 and state['renders']==1
            assert not errors,errors
            print(json.dumps({'viewport':width,'orders':state['creates'],'photos':state['uploads'],'pdfRenders':state['renders'],'lostResponses':2,'reopenPhotosMatch':True,'GoogleWrites':0}))
            context.close()
        browser.close()
finally:server.terminate()
