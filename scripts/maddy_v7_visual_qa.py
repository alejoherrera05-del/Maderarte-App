import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE = os.environ.get('MADDY_V7_URL', 'http://127.0.0.1:4173/cotizacion.html?preview=1&v6objects=1&v7states=1')
ART = Path('artifacts')
ART.mkdir(exist_ok=True)

opts = webdriver.ChromeOptions()
for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1'):
    opts.add_argument(arg)
opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=opts)
wait = WebDriverWait(driver, 30)


def set_value(selector, value, root=None):
    return driver.execute_script('''
      const root=arguments[0]||document;
      const node=root.querySelector(arguments[1]);
      if(!node) throw new Error('Missing field '+arguments[1]);
      node.value=arguments[2];
      node.dispatchEvent(new Event('input',{bubbles:true}));
      node.dispatchEvent(new Event('change',{bubbles:true}));
      return node.value;
    ''', root, selector, str(value))


def open_quote():
    driver.get(BASE)
    wait.until(lambda d: d.execute_script('return !!window.MaddyQuoteV7 && !!window.MaddyQuoteV6'))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR,'[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID,'quote-workspace')))
    driver.execute_script("window.scrollTo(0,0)")


def audit():
    return driver.execute_script('''
      const card=document.querySelector('.quote-item');
      return {
        width:innerWidth,
        overflow:document.documentElement.scrollWidth>innerWidth+1,
        bodyState:[...document.body.classList].find(x=>x.startsWith('mq7-')&&x.endsWith('-quote'))||'',
        itemState:card?.dataset.mq7State||'',
        compactItems:document.querySelectorAll('.quote-item.mq5-compact').length,
        clientCompact:!!document.querySelector('.quote-editor-section.mq5-client-collapsed'),
        reviewDisabled:document.querySelector('.mq6-review-cta')?.disabled||false,
        coverPhotos:document.querySelectorAll('.quote-photo-thumb.mq7-cover-photo').length,
        total:document.getElementById('quote-total')?.textContent.trim()||''
      };
    ''')


def build_working():
    set_value('#quote-client-document','1061760852')
    set_value('#quote-client-name','María Fernanda López')
    card=driver.find_element(By.CSS_SELECTOR,'.quote-item')
    set_value('[data-field="description"]','Sofá Oslo 2.10 m',card)
    set_value('[data-field="category"]','SALA',card)
    set_value('[data-field="fabric"]','Bouclé marfil',card)
    driver.execute_script('window.MaddyQuoteV7.refresh()')


def build_ready():
    client={
      '#quote-client-document':'1061760852', '#quote-client-name':'María Fernanda López',
      '#quote-client-phone':'312 555 9081', '#quote-client-email':'mariafernanda@email.com',
      '#quote-client-address':'Cra. 8 # 12-44, Apto 705', '#quote-client-city':'Popayán'
    }
    for selector,value in client.items(): set_value(selector,value)

    items=[
      ('Sofá Oslo 2.10 m','SALA','1','Bouclé marfil','Champaña satinado','2.10 × 0.88 m · Espuma alta densidad','4850000','/assets/interiors/living-room-morning.webp'),
      ('Comedor Siena 6 puestos','COMEDOR','1','Lino arena','Roble champagne','Mesa 1.80 m · 6 sillas tapizadas','6200000','/assets/categories/furniture/comedor-v1.webp'),
      ('Alcoba Lucía Queen','ALCOBA','1','Lino gris','Nogal mate','Cama Queen · Cabecero tapizado','5900000','/assets/categories/furniture/alcoba-v1.webp')
    ]
    for index in range(1,3):
        driver.execute_script("document.getElementById('quote-add-item').click()")
        wait.until(lambda d,count=index+1: len(d.find_elements(By.CSS_SELECTOR,'.quote-item'))==count)
    cards=driver.find_elements(By.CSS_SELECTOR,'.quote-item')
    fields=('description','category','quantity','fabric','wood','specifications','unitValue')
    for card,data in zip(cards,items):
        for field,val in zip(fields,data[:7]): set_value(f'[data-field="{field}"]',val,card)
        driver.execute_script('''
          const list=arguments[0].querySelector('[data-photo-list]');
          list.innerHTML=`<div class="quote-photo-thumb"><img src="${arguments[1]}" alt="Referencia"></div>`;
        ''',card,data[7])
    set_value('#quote-notes','Transporte urbano incluido en Popayán. Acabados sujetos a aprobación de muestra física.')
    driver.execute_script('''
      document.getElementById('quote-meta-number').textContent='MP-0251';
      document.getElementById('quote-meta-date').textContent='16 sept 2026';
      document.getElementById('quote-meta-advisor').textContent='Alejandro Herrera';
      window.MaddyQuoteV6.refresh();
      window.MaddyQuoteV7.refresh();
      window.MaddyQuoteV6.compactClient();
      window.MaddyQuoteV6.compactItems();
      window.MaddyQuoteV7.refresh();
      window.scrollTo(0,0);
    ''')
    wait.until(lambda d: d.execute_script("return document.querySelectorAll('.quote-item.mq5-compact').length===3"))


def capture(width, name, builder=None):
    driver.set_window_size(width,1000)
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000,'deviceScaleFactor':1,'mobile':False})
    open_quote()
    if builder: builder()
    driver.execute_script('window.MaddyQuoteV7.refresh();window.scrollTo(0,0)')
    state=audit()
    assert not state['overflow'], state
    driver.save_screenshot(str(ART/name))
    return state


try:
    empty_desktop=capture(1440,'maddy-v7-empty-desktop.png')
    assert empty_desktop['itemState']=='empty' and empty_desktop['reviewDisabled'], empty_desktop

    working_desktop=capture(1440,'maddy-v7-working-desktop.png',build_working)
    assert working_desktop['itemState']=='working' and working_desktop['bodyState']=='mq7-working-quote', working_desktop

    ready_desktop=capture(1440,'maddy-v7-ready-desktop.png',build_ready)
    assert ready_desktop['compactItems']==3 and ready_desktop['clientCompact'] and ready_desktop['coverPhotos']==3, ready_desktop

    empty_mobile=capture(390,'maddy-v7-empty-mobile.png')
    assert empty_mobile['itemState']=='empty' and empty_mobile['reviewDisabled'], empty_mobile

    ready_mobile=capture(390,'maddy-v7-ready-mobile.png',build_ready)
    assert ready_mobile['compactItems']==3 and ready_mobile['clientCompact'] and ready_mobile['coverPhotos']==3, ready_mobile

    driver.find_element(By.ID,'mq-dock-review').click()
    wait.until(lambda d: d.execute_script("return document.getElementById('quote-summary-column').classList.contains('is-open')"))
    driver.save_screenshot(str(ART/'maddy-v7-review-mobile.png'))

    errors=[e['message'] for e in driver.get_log('browser') if e['level']=='SEVERE' and 'favicon.ico' not in e['message']]
    assert not errors,errors
    print({'emptyDesktop':empty_desktop,'workingDesktop':working_desktop,'readyDesktop':ready_desktop,'emptyMobile':empty_mobile,'readyMobile':ready_mobile,'consoleErrors':errors})
finally:
    driver.quit()
