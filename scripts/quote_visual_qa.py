import base64, json, os, time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

URL = os.environ.get('QUOTE_PREVIEW_URL', 'http://127.0.0.1:4173/cotizacion.html?preview=1')
PNG = Path(os.environ.get('QUOTE_SCREENSHOT', 'artifacts/cotizacion-preview.png'))
PDF = Path(os.environ.get('QUOTE_PDF', 'artifacts/cotizacion-preview.pdf'))
PNG.parent.mkdir(parents=True, exist_ok=True); PDF.parent.mkdir(parents=True, exist_ok=True)

opts = webdriver.ChromeOptions()
for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--window-size=1680,2200','--force-device-scale-factor=1'):
    opts.add_argument(arg)
driver = webdriver.Chrome(options=opts); wait = WebDriverWait(driver, 35)

def setv(node, text):
    node.clear(); node.send_keys(str(text)); node.send_keys(' '); node.send_keys('\ue003')

def set_quantity(node, text):
    node.clear(); node.send_keys(str(text))
    driver.execute_script("arguments[0].dispatchEvent(new Event('input',{bubbles:true}));", node)

def fill(card, desc, cat, qty, fabric, wood, spec, price):
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="description"]'), desc)
    Select(card.find_element(By.CSS_SELECTOR,'[data-field="category"]')).select_by_value(cat)
    set_quantity(card.find_element(By.CSS_SELECTOR,'[data-field="quantity"]'), qty)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="fabric"]'), fabric)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="wood"]'), wood)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="specifications"]'), spec)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="unitValue"]'), price)

def metric(selector):
    return driver.execute_script('''
      const n=document.querySelector(arguments[0]); if(!n) return null;
      const r=n.getBoundingClientRect(), s=getComputedStyle(n);
      return {height:Math.round(r.height),width:Math.round(r.width),fontSize:parseFloat(s.fontSize)||0,
              text:n.textContent.trim(),overflowY:n.scrollHeight>n.clientHeight+2};''', selector)

try:
    driver.get(URL)
    wait.until(EC.visibility_of_element_located((By.ID,'quote-app')))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID,'quote-workspace')))
    driver.execute_script("document.getElementById('quote-meta-number').textContent='MP-0251';document.getElementById('quote-meta-date').textContent='04 de sept de 2026';document.getElementById('quote-meta-advisor').textContent='Alejandro Herrera';")
    for id_, val in [('quote-client-name','María Fernanda López'),('quote-client-document','1061760852'),('quote-client-phone','3125559081'),('quote-client-email','mariafernanda@email.com'),('quote-client-address','Cra. 8 # 12-44, Apto 705'),('quote-client-city','Popayán')]:
        setv(driver.find_element(By.ID,id_), val)

    cards=driver.find_elements(By.CSS_SELECTOR,'.quote-item')
    fill(cards[0],'Sofá Oslo 2.10 m','SALA',1,'Bouclé marfil de textura media','Patas en poliuretano champaña satinado','Medidas 2.10 x 0.88 m. Espuma de alta densidad, estructura en madera inmunizada y cojines decorativos incluidos.',3800000)
    driver.find_element(By.ID,'quote-add-item').click(); wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR,'.quote-item'))==2)
    cards=driver.find_elements(By.CSS_SELECTOR,'.quote-item')
    fill(cards[1],'Poltrona Nova giratoria','SALA',2,'Lino premium tono taupe','Base metálica negro mate y detalles en nogal','Asiento envolvente, espuma de alta resiliencia, respaldo ergonómico y costura perimetral decorativa.',1150000)
    driver.find_element(By.ID,'quote-add-item').click(); wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR,'.quote-item'))==3)
    cards=driver.find_elements(By.CSS_SELECTOR,'.quote-item')
    fill(cards[2],'Mesa de centro Mandala','COMPLEMENTO',1,'Acabado protector semimate transparente','Madera tono nogal con tallado artesanal','Mesa redonda de 90 cm de diámetro, base robusta tallada y acabado poliuretano de alta resistencia.',1200000)
    setv(driver.find_element(By.ID,'quote-discount'),300000)
    setv(driver.find_element(By.ID,'quote-notes'),'Cotización de prueba. Incluye fabricación personalizada según acabados seleccionados. El tono final se confirma con muestra física. Transporte urbano incluido para Popayán.')

    driver.execute_script('''
      const u=['/assets/interiors/living-room-morning.webp','/assets/interiors/living-room-afternoon.webp','/assets/interiors/living-room-night.webp'];
      document.querySelectorAll('.quote-item').forEach((c,i)=>{const l=c.querySelector('[data-photo-list]');if(l)l.innerHTML=`<div class="quote-photo-thumb"><img src="${u[i]}" alt="Referencia ${i+1}"></div>`;});''')
    driver.find_element(By.ID,'quote-preview-button').click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'.quote-editorial-page'))); time.sleep(1.2)

    pages=driver.find_elements(By.CSS_SELECTOR,'#quote-preview-content > .quote-preview-page')
    nums=driver.execute_script("return Array.from(document.querySelectorAll('#quote-preview-content > .quote-preview-page')).map(p=>p.querySelector('.quote-document-page-number')?.textContent.trim()||'');")
    footer_count=driver.execute_script("return document.querySelectorAll('.quote-document-footer').length;")
    annex_count=driver.execute_script("return document.querySelectorAll('.quote-preview-appendix-page').length;")
    annex_text=driver.execute_script("return Array.from(document.querySelectorAll('.quote-preview-appendix-page')).map(p=>p.textContent).join(' | ');")
    gap=driver.execute_script("const p=document.querySelector('.quote-editorial-page'),f=p.querySelector('.quote-document-footer');return Math.round(p.getBoundingClientRect().bottom-f.getBoundingClientRect().bottom);")
    metrics={'pageCount':len(pages),'pageNumbers':nums,'footerCount':footer_count,'annexCount':annex_count,'footerGap':gap,
             'page':metric('.quote-editorial-page'),'header':metric('.quote-editorial-header'),'total':metric('.quote-editorial-total > strong'),
             'investment':metric('.quote-editorial-investment'),'third':metric('.quote-editorial-item:nth-child(3)'),'footer':metric('.quote-editorial-page .quote-document-footer')}
    print('VISUAL_QA_METRICS='+json.dumps(metrics,ensure_ascii=False,sort_keys=True))
    driver.find_element(By.CSS_SELECTOR,'.quote-editorial-page').screenshot(str(PNG))

    html=''.join(p.get_attribute('outerHTML') for p in pages)
    driver.execute_script("document.body.innerHTML=arguments[0];document.body.className='quote-print-export';document.documentElement.style.background='#fff';",html)
    driver.execute_async_script("const done=arguments[arguments.length-1];Promise.all(Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;}))).then(done);")
    pdf=driver.execute_cdp_cmd('Page.printToPDF',{'printBackground':True,'paperWidth':8.27,'paperHeight':11.69,'marginTop':0,'marginBottom':0,'marginLeft':0,'marginRight':0,'displayHeaderFooter':False,'scale':1})
    PDF.write_bytes(base64.b64decode(pdf['data']))

    assert metrics['header'] and 130 <= metrics['header']['height'] <= 270
    assert metrics['third'] and metrics['total'] and metrics['total']['fontSize'] >= 24 and '7.000.000' in metrics['total']['text']
    assert metrics['investment'] and metrics['investment']['height'] >= 95
    assert metrics['footer'] and metrics['footer']['height'] >= 28
    assert not metrics['page']['overflowY'] and metrics['footerGap'] <= 55
    assert metrics['pageCount']==3 and metrics['annexCount']==2 and metrics['footerCount']==3
    assert metrics['pageNumbers']==['Página 1 de 3','Página 2 de 3','Página 3 de 3']
    assert 'Item 1' in annex_text and 'Item 3' in annex_text and PDF.stat().st_size>=80000
finally:
    driver.quit()
