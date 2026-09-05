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
    details = card.find_element(By.CSS_SELECTOR, '.quote-item-details')
    if not details.get_attribute('open'):
        details.find_element(By.TAG_NAME, 'summary').click()
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="description"]'), desc)
    Select(card.find_element(By.CSS_SELECTOR,'[data-field="category"]')).select_by_value(cat)
    set_quantity(card.find_element(By.CSS_SELECTOR,'[data-field="quantity"]'), qty)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="fabric"]'), fabric)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="wood"]'), wood)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="specifications"]'), spec)
    setv(card.find_element(By.CSS_SELECTOR,'[data-field="unitValue"]'), price)
    details.find_element(By.TAG_NAME, 'summary').click()

def metric(selector):
    return driver.execute_script('''
      const n=document.querySelector(arguments[0]); if(!n) return null;
      const r=n.getBoundingClientRect(), s=getComputedStyle(n);
      return {height:Math.round(r.height),width:Math.round(r.width),fontSize:parseFloat(s.fontSize)||0,
              text:n.textContent.trim(),overflowY:n.scrollHeight>n.clientHeight+2};''', selector)

def check_editor_and_home():
    results = []
    for width in (1440, 768, 390, 320):
        driver.set_window_size(width, 1000)
        driver.get(URL)
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="MP"]'))).click()
        wait.until(EC.visibility_of_element_located((By.ID, 'quote-workspace')))
        identification = driver.find_element(By.ID, 'quote-client-document')
        setv(identification, '909090')
        wait.until(lambda d: 'Sin coincidencias' in d.find_element(By.ID, 'quote-client-message').text)
        name = driver.find_element(By.ID, 'quote-client-name')
        setv(name, 'Cliente de revisión visual')
        editor = driver.execute_script('''
          const fields=[...document.querySelectorAll('.quote-editor input:not([type=file]),.quote-editor select,.quote-editor textarea')];
          return {width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth+1,
            label:parseFloat(getComputedStyle(document.querySelector('.quote-field > label')).fontSize),
            fieldSizes:fields.map(n=>parseFloat(getComputedStyle(n).fontSize)),
            documentFirst:document.querySelector('.quote-field-grid-client input').id==='quote-client-document',
            separateSearch:!!document.getElementById('quote-client-search'),
            name:document.getElementById('quote-client-name').value,
            writes:!document.getElementById('quote-submit').disabled};''')
        assert not editor['overflow'] and editor['label'] >= 15 and min(editor['fieldSizes']) >= 16
        assert editor['documentFirst'] and not editor['separateSearch'] and not editor['writes']
        assert editor['name'] == 'Cliente de revisión visual'
        driver.execute_script("const s=document.querySelector('.quote-editor-section');window.scrollTo(0,s.getBoundingClientRect().top+scrollY-95);")
        driver.save_screenshot(str(PNG.with_name(f'cotizacion-formulario-{width}.png')))
        driver.get(URL.split('/cotizacion.html')[0] + '/index.html?preview=1')
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.dashboard-menu-item')))
        home = driver.execute_script('''
          const row=document.querySelector('.dashboard-menu-item');
          return {width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth+1,
            rowHeight:row.getBoundingClientRect().height,
            titleSize:parseFloat(getComputedStyle(row.querySelector('strong')).fontSize),
            descriptionSize:parseFloat(getComputedStyle(row.querySelector('.dashboard-menu-copy > span')).fontSize)};''')
        assert not home['overflow'] and home['rowHeight'] >= 94 and home['titleSize'] >= 18 and home['descriptionSize'] >= 15
        driver.save_screenshot(str(PNG.with_name(f'inicio-{width}.png')))
        if width == 390:
            menu = driver.find_element(By.CSS_SELECTOR, '[data-menu-key="cotizaciones"]')
            driver.execute_script("arguments[0].scrollIntoView({block:'center'});", menu)
            menu.click()
            wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.dashboard-sheet-overlay.active')))
            assert driver.find_element(By.ID, 'dashboard-dialog-title').text == 'Cotización'
            assert driver.find_element(By.CSS_SELECTOR, '.dashboard-dialog-option').size['height'] >= 88
            driver.save_screenshot(str(PNG.with_name('inicio-opciones-mobile.png')))
        results.append({'editor': editor, 'home': home})
    print('EDITOR_HOME_QA=' + json.dumps(results, ensure_ascii=False))
    driver.set_window_size(1680, 2200)

def check_order():
    order_url = URL.replace('/cotizacion.html', '/pedido.html')
    home_url = URL.replace('/cotizacion.html', '/index.html')
    results = []
    for width in (1440, 390, 320):
        # Element screenshots can leave a device viewport override in Chrome.
        driver.execute_cdp_cmd('Emulation.clearDeviceMetricsOverride', {})
        driver.set_window_size(width, 1100)
        driver.get(home_url)
        menu = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-menu-key="pedido"]')))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", menu)
        menu.click()
        link = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '.dashboard-dialog-option[href*="pedido.html"]')))
        link.click()
        assert driver.current_url == order_url
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="TP"]'))).click()
        wait.until(EC.visibility_of_element_located((By.ID, 'quote-workspace')))
        assert driver.find_element(By.ID, 'quote-meta-number').text == 'Borrador'
        assert driver.find_element(By.ID, 'quote-meta-branch').text == 'TP'
        setv(driver.find_element(By.ID, 'quote-client-document'), '909090')
        wait.until(lambda d: 'Sin coincidencias' in d.find_element(By.ID, 'quote-client-message').text)
        setv(driver.find_element(By.ID, 'quote-client-name'), 'Cliente de revisión del pedido')
        setv(driver.find_element(By.ID, 'quote-client-phone'), '0000000011')
        setv(driver.find_element(By.ID, 'quote-client-alternatePhone'), '0000000022')
        setv(driver.find_element(By.ID, 'quote-client-email'), 'cliente@example.com')
        setv(driver.find_element(By.ID, 'quote-client-address'), 'Dirección de entrega de prueba')
        fill(driver.find_element(By.CSS_SELECTOR, '.quote-item'), 'Sala de revisión', 'SALA', 1, 'Lino', 'Roble', 'Medidas y acabados de revisión.', 1000000)
        Select(driver.find_element(By.CSS_SELECTOR, '[data-item-agreement]')).select_by_value('ENTREGA_HOY')
        add_item = driver.find_element(By.ID, 'quote-add-item')
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", add_item)
        add_item.click()
        dining = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[1]
        fill(dining, 'Comedor de revisión', 'COMEDOR', 1, '', 'Roble', '', 1000000)
        Select(dining.find_element(By.CSS_SELECTOR, '[data-item-agreement]')).select_by_value('SEPARADO')
        Select(dining.find_element(By.CSS_SELECTOR, '[data-item-fulfillment]')).select_by_value('PARA_SOLICITAR')
        setv(driver.find_element(By.ID, 'quote-discount'), '100000')
        setv(driver.find_element(By.ID, 'quote-notes'), 'Obsequio de cojines. Transporte incluido a Cali.')
        Select(driver.find_element(By.CSS_SELECTOR, '[data-payment-method]')).select_by_value('TRANSFERENCIA')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-amount]'), '50000')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-note]'), 'INTERNO-QA-CUENTA-A')
        driver.find_element(By.ID, 'order-add-payment').click()
        Select(driver.find_element(By.CSS_SELECTOR, '[data-payment-row="2"] [data-payment-method]')).select_by_value('EFECTIVO')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-row="2"] [data-payment-amount]'), '100000')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-row="2"] [data-payment-note]'), 'INTERNO-QA-CUENTA-B')
        editor = driver.execute_script("""
          const amount=id=>Number(document.getElementById(id).textContent.replace(/[^0-9]/g,''));
          return {width:innerWidth, overflow:document.documentElement.scrollWidth>innerWidth+1,
            sizes:[...document.querySelectorAll('.quote-editor input:not([type=file]),.quote-editor textarea')].map(n=>parseFloat(getComputedStyle(n).fontSize)),
            total:amount('quote-total'), paid:amount('order-paid'), balance:amount('order-balance'),
            writeDisabled:document.getElementById('quote-submit').disabled};
        """)
        if editor['overflow']:
            editor['overflowNodes'] = driver.execute_script("return [...document.querySelectorAll('#quote-app *')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left < -1)}).slice(0,25).map(n=>({tag:n.tagName,id:n.id,class:n.className,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}));")
            driver.save_screenshot(str(PNG.with_name(f'pedido-overflow-{width}.png')))
        assert not editor['overflow'] and min(editor['sizes']) >= 16 and editor['writeDisabled'], editor
        assert editor['width'] == width, editor
        assert [editor['total'], editor['paid'], editor['balance']] == [1900000, 150000, 1750000]
        driver.execute_script("window.scrollTo(0,0)")
        driver.save_screenshot(str(PNG.with_name(f'pedido-formulario-{width}.png')))
        driver.execute_script("arguments[0].scrollIntoView({block:'start'});", driver.find_element(By.CSS_SELECTOR,'.quote-items-section'))
        driver.save_screenshot(str(PNG.with_name(f'pedido-muebles-{width}.png')))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", driver.find_element(By.ID,'order-payments-title'))
        driver.save_screenshot(str(PNG.with_name(f'pedido-pagos-{width}.png')))
        allocation = driver.find_element(By.ID, 'order-allocate-payments')
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", allocation)
        allocation.click()
        setv(driver.find_element(By.CSS_SELECTOR, '[data-item-allocation="1"]'), '100000')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-item-allocation="2"]'), '50000')
        assert driver.find_element(By.ID, 'order-allocation-error').text == ''
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", driver.find_element(By.ID,'order-allocations'))
        driver.save_screenshot(str(PNG.with_name(f'pedido-distribucion-{width}.png')))
        driver.find_element(By.ID, 'quote-preview-button').click()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.order-document-page')))
        assert len(driver.find_elements(By.CSS_SELECTOR, '.order-document-allocation')) == 2
        allocation_texts = [node.get_attribute('textContent') for node in driver.find_elements(By.CSS_SELECTOR, '.order-document-allocation')]
        driver.find_element(By.CSS_SELECTOR, '.order-document-page').screenshot(str(PNG.with_name(f'pedido-documento-{width}.png')))
        assert '850.000' in allocation_texts[0] and '900.000' in allocation_texts[1], allocation_texts
        document_metrics = driver.execute_script("""
          const pages=[...document.querySelectorAll('.quote-preview-page')];
          return {pages:pages.length, titles:pages.map(p=>p.querySelector('h1')?.textContent),
            overflow:document.documentElement.scrollWidth>innerWidth+1,
            pageOverflow:pages.some(p=>p.scrollHeight>p.clientHeight+2),
            draft:pages.every(p=>p.querySelector('footer').textContent.includes('Borrador · sin validez comercial')),
            address:document.querySelector('.quote-editorial-client').textContent,
            signatureLabel:getComputedStyle(document.querySelector('.quote-editorial-signature'),'::before').content,
            annex:document.querySelectorAll('.quote-preview-appendix-page').length,
            totals:document.querySelectorAll('.order-finance-total dd').length,
            text:document.getElementById('quote-preview-content').textContent,
            html:document.getElementById('quote-preview-content').innerHTML,
            conditions:document.querySelector('.order-document-conditions').textContent,
            availability:[...document.querySelectorAll('.order-document-fulfillment')].map(n=>n.dataset.fulfillment)};
        """)
        assert all(title == 'ORDEN DE PEDIDO' for title in document_metrics['titles'])
        if width == 1440 and document_metrics['pages'] != 1:
            layout = driver.execute_script("""
              const pages=[...document.querySelectorAll('.order-document-page')], full=pages[0].cloneNode(true);
              full.classList.remove('quote-continuation-page');
              full.querySelector('.quote-editorial-items').replaceChildren(...pages.flatMap(p=>[...p.querySelectorAll('.quote-editorial-item')].map(n=>n.cloneNode(true))));
              const body=full.querySelector('.quote-editorial-body');
              body.querySelector('.quote-editorial-signoff').remove();
              body.append(pages.at(-1).querySelector('.order-document-closing').cloneNode(true), pages.at(-1).querySelector('.quote-editorial-signoff').cloneNode(true));
              document.getElementById('quote-preview-content').append(full);
              const measure=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {class:n.className,width:r.width,height:r.height,marginTop:s.marginTop,padding:s.padding,gap:s.gap};};
              const result={page:measure(full),scrollHeight:full.scrollHeight,header:measure(full.querySelector('header')),body:[...body.children].map(measure),closing:[...full.querySelector('.order-document-closing').children].map(measure)};
              full.remove();return result;
            """)
            raise AssertionError('El pedido corto debe aprovechar una sola hoja: ' + json.dumps(layout))
        assert not document_metrics['overflow'] and not document_metrics['pageOverflow']
        assert document_metrics['draft'] and document_metrics['annex'] == 0 and document_metrics['totals'] == 1
        assert 'Dirección de entrega de prueba' in document_metrics['address']
        assert '0000000022' in document_metrics['address'] and '0000000011' in document_metrics['address']
        assert 'cliente@example.com' in document_metrics['address']
        assert 'Obsequio de cojines' in document_metrics['text'] and 'Transporte incluido a Cali' in document_metrics['text']
        assert 'INTERNO-QA' not in document_metrics['html'], 'Las notas internas no llegan al HTML del documento'
        assert 'Abono indicado' in document_metrics['text'] and 'Saldo por pagar' in document_metrics['text']
        assert '30%' not in document_metrics['text']
        assert document_metrics['availability'] == ['PARA_SOLICITAR']
        assert 'Se entrega hoy' in document_metrics['text'] and 'Queda separado' in document_metrics['text']
        assert '25 a 30 días' in document_metrics['conditions']
        finance = driver.execute_script("""
          const box=document.querySelector('.order-finance'), figures=box.querySelector('.order-finance-figures');
          const rect=box.getBoundingClientRect(), cells=[...figures.children];
          const r=cells.map(n=>n.getBoundingClientRect());
          return {viewport:innerWidth, width:rect.width, leftInset:r[0].left-rect.left, rightInset:rect.right-r.at(-1).right,
            values:cells.map(n=>Number(n.querySelector('dd').textContent.replace(/[^0-9]/g,''))),
            fonts:cells.map(n=>parseFloat(getComputedStyle(n.querySelector('dd')).fontSize)),
            noClip:[box,...box.querySelectorAll('*')].every(n=>n.scrollWidth<=n.clientWidth+1 || getComputedStyle(n).display==='inline'),
            sameRow:Math.abs(r[0].top-r[2].top)<2};
        """)
        assert finance['leftInset'] <= 24 and finance['rightInset'] <= 24, finance
        assert finance['noClip'] and min(finance['fonts']) >= 22, finance
        assert finance['values'] == [1900000, 150000, 1750000]
        assert finance['viewport'] == width and finance['sameRow'] == (width == 1440), {'target': width, 'editor': editor, 'finance': finance}
        driver.find_element(By.CSS_SELECTOR, '.order-finance').screenshot(str(PNG.with_name(f'pedido-resumen-{width}.png')))
        document_metrics['finance'] = finance
        # Keep logs concise; assertions above inspect the complete HTML/text.
        del document_metrics['text'], document_metrics['html']
        assert document_metrics['signatureLabel'] in ('none', 'normal')
        driver.find_element(By.CSS_SELECTOR, '.order-document-page').screenshot(str(PNG.with_name(f'pedido-documento-{width}.png')))
        driver.find_element(By.ID, 'quote-preview-close').click()
        assert driver.execute_script("return document.activeElement.id") == 'quote-preview-button'
        results.append({'editor': editor, 'document': document_metrics})

    allocation_toggle = driver.find_element(By.ID, 'order-allocate-payments')
    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", allocation_toggle)
    allocation_toggle.click()
    # An entirely available order has no factory deadline; changing it keeps payments.
    Select(driver.find_elements(By.CSS_SELECTOR, '[data-item-fulfillment]')[1]).select_by_value('DISPONIBLE')
    driver.find_element(By.ID, 'quote-preview-button').click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.order-finance')))
    assert '25 a 30 días' not in driver.find_element(By.CSS_SELECTOR, '.order-document-conditions').text
    driver.find_element(By.ID, 'quote-preview-close').click()
    Select(driver.find_elements(By.CSS_SELECTOR, '[data-item-fulfillment]')[1]).select_by_value('PARA_SOLICITAR')
    # A full Addi payment is valid; an overpayment is not printed as a paid order.
    driver.find_element(By.CSS_SELECTOR, '[data-payment-row="2"] [data-remove-payment]').click()
    Select(driver.find_element(By.CSS_SELECTOR, '[data-payment-method]')).select_by_value('ADDI')
    setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-amount]'), '1900001')
    driver.find_element(By.ID, 'quote-preview-button').click()
    assert not driver.find_element(By.ID, 'quote-preview-overlay').is_displayed()
    assert 'superan' in driver.find_element(By.ID, 'order-payment-error').text
    setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-amount]'), '1900000')
    assert driver.find_element(By.ID, 'order-balance').text.replace('$', '').strip() == '0'
    # A real file input exercises reference photos and their separate annex.
    driver.find_element(By.CSS_SELECTOR, '[data-photo-input]').send_keys(str(Path('public/assets/brand/maderarte-logo-2026.webp').resolve()))
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.quote-photo-thumb img')))
    long_notes = 'Condición de fabricación y entrega para revisión. ' * 100
    setv(driver.find_element(By.ID, 'quote-notes'), long_notes)
    driver.set_window_size(1680, 2200)
    driver.find_element(By.ID, 'quote-preview-button').click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.quote-preview-appendix-page')))
    pages = driver.find_elements(By.CSS_SELECTOR, '#quote-preview-content > .quote-preview-page')
    assert len(pages) >= 3, 'Pedido extenso más anexo debe paginar sin comprimir'
    assert len(driver.find_elements(By.CSS_SELECTOR, '.quote-preview-appendix-page')) == 1
    assert not driver.execute_script("return [...document.querySelectorAll('.quote-preview-page')].some(p=>p.scrollHeight>p.clientHeight+2)")
    text = ''.join(n.text for n in driver.find_elements(By.CSS_SELECTOR, '.quote-editorial-notes p'))
    assert ''.join(text.split()) == ''.join(long_notes.split())
    html = ''.join(p.get_attribute('outerHTML') for p in pages)
    driver.execute_script("document.body.innerHTML=arguments[0];document.body.className='quote-print-export';", html)
    pdf = driver.execute_cdp_cmd('Page.printToPDF', {'printBackground': True, 'paperWidth': 8.27, 'paperHeight': 11.69, 'marginTop': 0, 'marginBottom': 0, 'marginLeft': 0, 'marginRight': 0, 'displayHeaderFooter': False, 'scale': 1})
    output = PDF.with_name('pedido-revision.pdf')
    output.write_bytes(base64.b64decode(pdf['data']))
    exported = PdfReader(output)
    assert len(exported.pages) == len(pages), 'PDF del pedido coincide con la vista previa'
    pdf_text = ' '.join(page.extract_text() for page in exported.pages)
    assert 'ORDEN DE PEDIDO' in pdf_text and 'COTIZACIÓN' not in pdf_text
    assert 'Cliente de revisión del pedido' in pdf_text and 'Dirección de entrega de prueba' in pdf_text
    assert 'Asesor comercial' not in pdf_text
    assert '0000000022' in pdf_text and 'Addi' in pdf_text
    assert 'INTERNO-QA' not in pdf_text, 'La nota interna tampoco aparece en el PDF real'
    assert '30%' not in pdf_text and 'fabricación estimada de 25 a 30 días' in pdf_text
    assert 'Sala de revisión' in pdf_text and 'Comedor de revisión' in pdf_text
    assert 'Se entrega hoy' in pdf_text and 'Queda separado' in pdf_text and 'Solicitar a fábrica' in pdf_text
    assert pdf_text.count('Saldo por pagar') == 1 and pdf_text.count('Abono indicado') == 1
    assert all('Borrador' in page.extract_text() for page in exported.pages)
    errors = [entry['message'] for entry in driver.get_log('browser') if entry['level'] == 'SEVERE' and 'favicon.ico' not in entry['message']]
    assert not errors, errors
    print('ORDER_QA=' + json.dumps({'responsive': results, 'pdfPages': len(exported.pages), 'photos': True, 'consoleErrors': errors}, ensure_ascii=False))
    driver.set_window_size(1680, 2200)

try:
    check_order()
    check_editor_and_home()
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
