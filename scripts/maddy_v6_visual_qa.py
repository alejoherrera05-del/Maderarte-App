import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE = os.environ.get('MADDY_V6_URL', 'http://127.0.0.1:4173/cotizacion.html?preview=1&v6objects=1')
ART = Path('artifacts')
ART.mkdir(exist_ok=True)

opts = webdriver.ChromeOptions()
for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1'):
    opts.add_argument(arg)
opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=opts)
wait = WebDriverWait(driver, 30)


def set_value(selector, value, root=None):
    script = '''
      const root = arguments[0] || document;
      const node = root.querySelector(arguments[1]);
      if (!node) throw new Error('Missing field: ' + arguments[1]);
      node.value = arguments[2];
      node.dispatchEvent(new Event('input', {bubbles:true}));
      node.dispatchEvent(new Event('change', {bubbles:true}));
      return node.value;
    '''
    return driver.execute_script(script, root, selector, str(value))


def build_scene():
    driver.get(BASE)
    wait.until(lambda d: d.execute_script("return !!window.MaddyQuoteV6"))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID, 'quote-workspace')))

    client = {
      '#quote-client-document': '1061760852',
      '#quote-client-name': 'María Fernanda López',
      '#quote-client-phone': '312 555 9081',
      '#quote-client-email': 'mariafernanda@email.com',
      '#quote-client-address': 'Cra. 8 # 12-44, Apto 705',
      '#quote-client-city': 'Popayán',
    }
    for selector, field_value in client.items():
        set_value(selector, field_value)

    items = [
      {
        'description': 'Sofá Oslo 2.10 m', 'category': 'SALA', 'quantity': '1',
        'fabric': 'Bouclé marfil', 'wood': 'Champaña satinado',
        'specifications': '2.10 × 0.88 m · Espuma alta densidad', 'unitValue': '4850000',
        'photo': '/assets/interiors/living-room-morning.webp'
      },
      {
        'description': 'Comedor Siena 6 puestos', 'category': 'COMEDOR', 'quantity': '1',
        'fabric': 'Lino arena', 'wood': 'Roble champagne',
        'specifications': 'Mesa 1.80 m · 6 sillas tapizadas', 'unitValue': '6200000',
        'photo': '/assets/categories/furniture/comedor-v1.webp'
      },
      {
        'description': 'Alcoba Lucía Queen', 'category': 'ALCOBA', 'quantity': '1',
        'fabric': 'Lino gris', 'wood': 'Nogal mate',
        'specifications': 'Cama Queen · Cabecero tapizado', 'unitValue': '5900000',
        'photo': '/assets/categories/furniture/alcoba-v1.webp'
      },
    ]

    for index in range(1, len(items)):
        driver.execute_script("document.getElementById('quote-add-item').click()")
        wait.until(lambda d, count=index+1: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == count)

    cards = driver.find_elements(By.CSS_SELECTOR, '.quote-item')
    for card, data in zip(cards, items):
        for field in ('description','category','quantity','fabric','wood','specifications','unitValue'):
            set_value(f'[data-field="{field}"]', data[field], card)
        driver.execute_script('''
          const card=arguments[0], src=arguments[1];
          const list=card.querySelector('[data-photo-list]');
          list.innerHTML=`<div class="quote-photo-thumb"><img src="${src}" alt="Referencia del mueble"></div>`;
        ''', card, data['photo'])

    set_value('#quote-discount', '0')
    set_value('#quote-notes', 'Transporte urbano incluido en Popayán. Acabados finales sujetos a aprobación de muestra física.')

    driver.execute_script('''
      document.getElementById('quote-meta-number').textContent='MP-0251';
      document.getElementById('quote-meta-date').textContent='16 sept 2026';
      document.getElementById('quote-meta-advisor').textContent='Alejandro Herrera';
      window.MaddyQuoteV6.refresh();
      window.MaddyQuoteV6.compactClient();
      window.MaddyQuoteV6.compactItems();
      document.getElementById('quote-summary-column').classList.remove('is-open');
      document.body.classList.remove('mq-summary-open');
      document.getElementById('mq-summary-backdrop')?.setAttribute('hidden','');
      window.scrollTo(0,0);
    ''')
    wait.until(lambda d: d.execute_script("return document.querySelectorAll('.quote-item.mq5-compact').length") == 3)
    wait.until(lambda d: d.execute_script("return document.querySelector('.quote-editor-section.mq5-client-collapsed') !== null"))
    wait.until(lambda d: d.execute_script("return document.getElementById('quote-total').textContent.trim() !== '$ 0'"))


def audit():
    return driver.execute_script('''
      const summary=document.getElementById('quote-summary-column');
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        clientCompact: !!document.querySelector('.quote-editor-section.mq5-client-collapsed'),
        compactItems: document.querySelectorAll('.quote-item.mq5-compact').length,
        visibleForms: [...document.querySelectorAll('.quote-item .quote-item-essential')].filter(n=>getComputedStyle(n).display!=='none').length,
        total: document.getElementById('quote-total').textContent.trim(),
        dockVisible: getComputedStyle(document.getElementById('mq-mobile-dock')).display !== 'none',
        summaryOpen: summary.classList.contains('is-open'),
        summaryVisibility: getComputedStyle(summary).visibility
      };
    ''')


try:
    driver.set_window_size(1440, 1100)
    build_scene()
    desktop = audit()
    assert not desktop['overflow'] and desktop['clientCompact'] and desktop['compactItems'] == 3 and desktop['visibleForms'] == 0, desktop
    driver.save_screenshot(str(ART / 'maddy-v6-desktop.png'))

    # Reload from scratch at phone width so responsive state matches a real phone launch,
    # rather than a desktop session resized after the fact.
    driver.set_window_size(390, 1000)
    driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride', {'width':390,'height':1000,'deviceScaleFactor':1,'mobile':False})
    build_scene()
    mobile = audit()
    assert not mobile['overflow'] and mobile['clientCompact'] and mobile['compactItems'] == 3 and mobile['dockVisible'], mobile
    assert not mobile['summaryOpen'] and mobile['summaryVisibility'] == 'hidden', mobile
    driver.save_screenshot(str(ART / 'maddy-v6-mobile.png'))

    driver.find_element(By.ID, 'mq-dock-review').click()
    wait.until(lambda d: d.execute_script('''
      const panel=document.getElementById('quote-summary-column');
      const css=getComputedStyle(panel);
      if(!panel.classList.contains('is-open') || css.visibility!=='visible') return false;
      const transform=css.transform==='none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(css.transform);
      return parseFloat(css.opacity) > .99 && Math.abs(transform.m42) < .75;
    '''))
    driver.save_screenshot(str(ART / 'maddy-v6-mobile-review.png'))

    errors = [e['message'] for e in driver.get_log('browser') if e['level'] == 'SEVERE' and 'favicon.ico' not in e['message']]
    assert not errors, errors
    print({'desktop': desktop, 'mobile': mobile, 'consoleErrors': errors})
finally:
    driver.quit()
