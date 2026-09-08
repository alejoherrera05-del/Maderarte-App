"""Exact approved renderer with committed synthetic data. No Google/Cloudflare calls."""
import base64, io, json, shutil, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
from pypdf import PdfReader
out=Path('artifacts/order-documents');out.mkdir(parents=True,exist_ok=True)
buf=io.BytesIO();Image.new('RGB',(640,420),(214,213,210)).save(buf,format='PNG')
photo='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()
data={'number':'MP-QA-OP-0001','issued':True,'date':'2026-09-07T18:00:00Z','advisor':'Asesor QA','branchCode':'MP',
'client':{'document':'00000001','name':'CLIENTE SINTÉTICO — PRUEBA','phone':'00000002','alternatePhone':'00000003','email':'qa@example.invalid','address':'Dirección de ensayo','city':'Ciudad de ensayo'},
'notes':'PRUEBA TÉCNICA SIN VALIDEZ COMERCIAL. No entregar ni fabricar.','subtotal':3500000,'discount':100000,'total':3400000,
'order':{'paid':500000,'balance':2900000,'payments':[{'method':'TRANSFERENCIA','amount':500000}]},
'items':[{'id':'MP-QA-OP-0001-I-1','description':'Sofá sintético','category':'SALA','fabric':'Bouclé crema','wood':'Nogal mate','specifications':'2,10 × 0,88 m. Ensayo técnico.','quantity':1,'unitValue':2000000,'subtotal':2000000,'agreement':'ENTREGA_HOY','fulfillment':'DISPONIBLE','photos':[photo]},
{'id':'MP-QA-OP-0001-I-2','description':'Comedor sintético','category':'COMEDOR','fabric':'Lino taupe','wood':'Champaña','specifications':'1,50 × 0,90 m. Ensayo técnico.','quantity':1,'unitValue':1500000,'subtotal':1500000,'agreement':'ENTREGA_POSTERIOR','fulfillment':'PARA_SOLICITAR','photos':[]}]}
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(30):
  try: urllib.request.urlopen('http://127.0.0.1:4173/documento-render.html',timeout=1).close();break
  except Exception: time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1120,'height':1200});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4173/documento-render.html',wait_until='networkidle')
  # Emulate the deployed CSP, including no inline executable JS. JSON is inert.
  csp="default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src 'self'; object-src 'none'"
  page.evaluate('(csp)=>{const m=document.createElement("meta");m.httpEquiv="Content-Security-Policy";m.content=csp;document.head.append(m)}',csp)
  page.add_script_tag(type='application/json',content=json.dumps(data),path=None)
  # Cloudflare also sets the id supplied in addScriptTag.
  page.evaluate('document.querySelector("script[type=\\"application/json\\"]").id="maddy-document-data";document.body.append(document.querySelector("script[type=\\"application/json\\"]"))')
  try: page.wait_for_selector('[data-document-ready="true"]',timeout=20000)
  except Exception:
   print('PAGE_ERRORS',errors)
   print(page.content()[-2000:])
   print(page.evaluate('document.querySelector("#quote-preview-content").dataset'))
   raise
  total=int(page.locator('#quote-preview-content').get_attribute('data-document-pages'))
  assert total>=2
  assert page.locator('.quote-appendix-group').count()==1
  assert page.locator('.quote-appendix-group strong').inner_text()=='Sofá sintético'
  assert page.locator('.order-document-agreement').all_text_contents()==['Entrega inmediata','Solicitar a fábrica']
  assert 'Borrador' not in page.locator('#quote-preview-content').inner_text()
  assert 'undefined' not in page.locator('#quote-preview-content').inner_text()
  assert not errors,errors
  for i,item in enumerate(page.locator('.quote-preview-page').all(),1): item.screenshot(path=str(out/f'pedido-pagina-{i}.png'))
  page.pdf(path=str(out/'pedido-con-referencias.pdf'),format='A4',print_background=True,prefer_css_page_size=True,display_header_footer=False,margin={'top':'0','bottom':'0','left':'0','right':'0'})
  pdf=PdfReader(out/'pedido-con-referencias.pdf');text=' '.join(p.extract_text() or '' for p in pdf.pages)
  assert len(pdf.pages)==total,(len(pdf.pages),total)
  assert 'Sofá sintético' in text and 'Comedor sintético' in text and 'Referencias por mueble' in text
  assert 'Borrador' not in text and text.count('Saldo pendiente') == 1 and '00000001' in text
  assert page.locator('.order-finance-balance dd').inner_text().replace('\u00a0',' ') == '$ 2.900.000'
  for selector in ['.quote-editorial-client-field strong','.quote-editorial-item-title h3','.quote-editorial-item-total','.order-finance-figures dd']:
   for node in page.locator(selector).all(): assert int(node.evaluate('e=>getComputedStyle(e).fontWeight')) <= 500
  # No photo means no appendix. A bad image must fail instead of producing a partial PDF.
  for item in data['items']: item['photos']=[]
  page.goto('http://127.0.0.1:4173/documento-render.html',wait_until='networkidle')
  page.evaluate('(data)=>{const s=document.createElement("script");s.type="application/json";s.id="maddy-document-data";s.textContent=JSON.stringify(data);document.body.append(s)}',data)
  page.wait_for_selector('[data-document-ready="true"]')
  assert page.locator('.quote-preview-appendix-page').count()==0
  data['items'][0]['photos']=['data:image/png;base64,bm90LWFuLWltYWdl']
  page.goto('http://127.0.0.1:4173/documento-render.html',wait_until='networkidle')
  page.evaluate('(data)=>{const s=document.createElement("script");s.type="application/json";s.id="maddy-document-data";s.textContent=JSON.stringify(data);document.body.append(s)}',data)
  page.wait_for_selector('[data-document-error="true"]',state='attached')
  assert page.locator('[data-document-ready="true"]').count()==0
  browser.close()
  print(json.dumps({'pdfPages':total,'photos':1,'withoutPhotos':'no appendix','invalidImage':'blocked','externalWrites':0}))
finally: server.terminate()
