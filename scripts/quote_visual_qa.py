import base64, json, os, time
from pathlib import Path
from pypdf import PdfReader
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
opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
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
             'investment':metric('.quote-editorial-investment'),'third':metric('.quote-editorial-item[data-item-position="3"]'),'footer':metric('.quote-editorial-page .quote-document-footer')}
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
    # The full client name and readable text now occupy two main pages.
    assert metrics['pageCount']==4 and metrics['annexCount']==2 and metrics['footerCount']==4
    assert metrics['pageNumbers']==['Página 1 de 4','Página 2 de 4','Página 3 de 4','Página 4 de 4']
    assert 'María Fernanda López' in metrics['page']['text']
    assert 'Item 1' in annex_text and 'Item 3' in annex_text and PDF.stat().st_size>=80000
    assert len(PdfReader(PDF).pages) == metrics['pageCount'], 'El PDF debe tener las mismas páginas que la vista previa'
    # Exercise the actual form and document with data beyond the old one-page case.
    driver.get(URL)
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID,'quote-workspace')))
    setv(driver.find_element(By.ID,'quote-client-name'),'Cliente de prueba de paginación')
    expected_names = []
    for index in range(25):
        if index:
            add_button=driver.find_element(By.ID,'quote-add-item')
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});",add_button)
            add_button.click()
        card = driver.find_elements(By.CSS_SELECTOR,'.quote-item')[index]
        name = f'QA Mueble {index + 1:02d}'
        expected_names.append(name)
        setv(card.find_element(By.CSS_SELECTOR,'[data-field="description"]'), name)
        setv(card.find_element(By.CSS_SELECTOR,'[data-field="unitValue"]'), 10000)
    long_spec = 'Detalle técnico de prueba que debe conservarse completo. ' * 100
    long_notes = 'Condición comercial de prueba que continúa entre páginas. ' * 80
    setv(driver.find_elements(By.CSS_SELECTOR,'.quote-item')[0].find_element(By.CSS_SELECTOR,'[data-field="specifications"]'), long_spec)
    setv(driver.find_element(By.ID,'quote-notes'), long_notes)
    driver.find_element(By.ID,'quote-preview-button').click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'.quote-editorial-page')))
    long_metrics = driver.execute_script("""
      const pages=[...document.querySelectorAll('#quote-preview-content > .quote-preview-page')];
      const items=[...document.querySelectorAll('.quote-editorial-item')];
      return {pages:pages.length, numbers:pages.map(p=>p.querySelector('.quote-document-page-number').textContent.trim()),
        overflow:pages.some(p=>p.scrollHeight>p.clientHeight+2),
        originals:items.filter(p=>p.dataset.continuation==='false').map(p=>p.querySelector('h3').textContent),
        continuations:items.filter(p=>p.dataset.continuation==='true').length,
        spec:items.map(p=>p.querySelector('.quote-editorial-item-spec')?.textContent||'').join(''),
        notes:[...document.querySelectorAll('.quote-editorial-notes p')].map(p=>p.textContent).join(''),
        total:[...document.querySelectorAll('.quote-editorial-total > strong')].map(p=>p.textContent),
        client:document.querySelector('.quote-editorial-client-field-name')?.textContent||'',
        measuringFrames:document.querySelectorAll('.quote-pagination-measure').length};
    """)
    assert long_metrics['pages'] > 3 and not long_metrics['overflow']
    assert long_metrics['originals'] == expected_names and long_metrics['continuations'] > 0
    assert ''.join(long_metrics['spec'].split()) == ''.join(long_spec.split())
    assert ''.join(long_metrics['notes'].split()) == ''.join(long_notes.split())
    assert len(long_metrics['total']) == 1 and '250.000' in long_metrics['total'][0]
    assert 'Cliente de prueba de paginación' in long_metrics['client']
    assert long_metrics['measuringFrames'] == 0
    assert long_metrics['numbers'] == [f'Página {i+1} de {long_metrics["pages"]}' for i in range(long_metrics['pages'])]
    driver.find_elements(By.CSS_SELECTOR,'.quote-editorial-page')[-1].screenshot(str(PNG.with_name('cotizacion-extensa-cierre.png')))
    long_html=''.join(p.get_attribute('outerHTML') for p in driver.find_elements(By.CSS_SELECTOR,'#quote-preview-content > .quote-preview-page'))

    driver.set_window_size(390,844)
    driver.find_element(By.ID,'quote-preview-close').click()
    driver.find_element(By.ID,'quote-preview-button').click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR,'.quote-editorial-page')))
    mobile = driver.execute_script("""
      const root=document.getElementById('quote-preview-content');
      return {width:window.innerWidth, overflow:document.documentElement.scrollWidth>window.innerWidth+1,
        pages:root.querySelectorAll(':scope > .quote-preview-page').length,
        inputSizes:[...document.querySelectorAll('#quote-workspace input:not([type="file"]), #quote-workspace textarea')].map(n=>parseFloat(getComputedStyle(n).fontSize))};
    """)
    assert not mobile['overflow'] and mobile['pages'] == long_metrics['pages']
    assert min(mobile['inputSizes']) >= 16
    driver.save_screenshot(str(PNG.with_name('cotizacion-extensa-mobile.png')))
    errors=[entry['message'] for entry in driver.get_log('browser') if entry['level']=='SEVERE' and 'favicon.ico' not in entry['message']]
    assert not errors, errors
    print('STABILITY_QA='+json.dumps({'mainPages':long_metrics['pages'],'continuations':long_metrics['continuations'],'all25ItemsPresent':True,'completeText':True,'uniqueTotal':True,'overflow':False,'mobile':mobile,'consoleErrors':errors},ensure_ascii=False))

    driver.set_window_size(1680,2200)
    driver.execute_script("document.body.innerHTML=arguments[0];document.body.className='quote-print-export';",long_html)
    pdf=driver.execute_cdp_cmd('Page.printToPDF',{'printBackground':True,'paperWidth':8.27,'paperHeight':11.69,'marginTop':0,'marginBottom':0,'marginLeft':0,'marginRight':0,'displayHeaderFooter':False,'scale':1})
    PDF.with_name('cotizacion-extensa.pdf').write_bytes(base64.b64decode(pdf['data']))
    exported=PdfReader(PDF.with_name('cotizacion-extensa.pdf'))
    assert len(exported.pages)==long_metrics['pages'], 'El PDF extenso debe conservar su numeración'
    exported_text=' '.join(page.extract_text() for page in exported.pages)
    assert all(name in exported_text for name in expected_names), 'Todos los muebles deben estar en el PDF final'
    print('PDF_STABILITY_QA='+json.dumps({'pages':len(exported.pages),'all25ItemsPresent':True,'matchesPreview':True}))
finally:
    driver.quit()
