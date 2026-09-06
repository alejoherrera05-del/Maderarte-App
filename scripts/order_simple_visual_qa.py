import base64, json, os
from pathlib import Path
from pypdf import PdfReader
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get('QUOTE_PREVIEW_URL', 'http://127.0.0.1:4173/cotizacion.html?preview=1')
URL = BASE_URL.replace('/cotizacion.html', '/pedido.html')
ARTIFACTS = Path('artifacts')
ARTIFACTS.mkdir(parents=True, exist_ok=True)
PDF = ARTIFACTS / 'pedido-simple.pdf'

opts = webdriver.ChromeOptions()
for arg in ('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'):
    opts.add_argument(arg)
opts.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
driver = webdriver.Chrome(options=opts)
wait = WebDriverWait(driver, 35)


def setv(node, value):
    node.clear()
    node.send_keys(str(value))
    driver.execute_script("arguments[0].dispatchEvent(new Event('input',{bubbles:true}));", node)


def click_visible(node):
    driver.execute_script("arguments[0].scrollIntoView({block:'center',inline:'nearest'});", node)
    wait.until(lambda d: node.is_displayed() and node.is_enabled())
    node.click()


def fill_client():
    for id_, value in [
        ('quote-client-document', '909090'),
        ('quote-client-name', 'Cliente de revisión simple'),
        ('quote-client-phone', '0000000011'),
        ('quote-client-email', 'cliente@example.com'),
        ('quote-client-address', 'Dirección de prueba'),
        ('quote-client-city', 'Ciudad de prueba'),
    ]:
        setv(driver.find_element(By.ID, id_), value)


def fill_item(card, description, price):
    setv(card.find_element(By.CSS_SELECTOR, '[data-field="description"]'), description)
    setv(card.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]'), price)


def choose_plan(card, code):
    control = card.find_element(By.CSS_SELECTOR, f'[data-order-item-plan][value="{code}"]')
    driver.execute_script("arguments[0].click();", control)


def visible(selector):
    nodes = driver.find_elements(By.CSS_SELECTOR, selector)
    return any(node.is_displayed() for node in nodes)


def print_preview_pdf():
    pages = driver.find_elements(By.CSS_SELECTOR, '#quote-preview-content > .quote-preview-page')
    html = ''.join(page.get_attribute('outerHTML') for page in pages)
    driver.execute_script("document.body.innerHTML=arguments[0];document.body.className='quote-print-export';document.documentElement.style.background='#fff';", html)
    pdf = driver.execute_cdp_cmd('Page.printToPDF', {
        'printBackground': True,
        'paperWidth': 8.27,
        'paperHeight': 11.69,
        'marginTop': 0,
        'marginBottom': 0,
        'marginLeft': 0,
        'marginRight': 0,
        'displayHeaderFooter': False,
        'scale': 1,
    })
    PDF.write_bytes(base64.b64decode(pdf['data']))


results = []
try:
    for width, height in ((1440, 1100), (390, 844)):
        driver.execute_cdp_cmd('Emulation.clearDeviceMetricsOverride', {})
        driver.set_window_size(width, height)
        driver.get(URL)
        click_visible(wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="TP"]'))))
        wait.until(EC.visibility_of_element_located((By.ID, 'quote-workspace')))
        fill_client()

        first = driver.find_element(By.CSS_SELECTOR, '.quote-item[data-item-id="1"]')
        fill_item(first, 'Sala de revisión', 2000000)
        choose_plan(first, 'ENTREGA_INMEDIATA')

        click_visible(driver.find_element(By.ID, 'quote-add-item'))
        wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 2)
        second = driver.find_element(By.CSS_SELECTOR, '.quote-item[data-item-id="2"]')
        fill_item(second, 'Comedor de revisión', 1500000)
        choose_plan(second, 'SOLICITAR_FABRICA')

        Select(driver.find_element(By.CSS_SELECTOR, '[data-payment-method]')).select_by_value('TRANSFERENCIA')
        setv(driver.find_element(By.CSS_SELECTOR, '[data-payment-amount]'), 500000)

        cards = driver.find_elements(By.CSS_SELECTOR, '.quote-item')
        plan_counts = [len(card.find_elements(By.CSS_SELECTOR, '[data-order-item-plan]')) for card in cards]
        chips = [card.find_element(By.CSS_SELECTOR, '[data-order-plan-chip]').get_attribute('textContent').strip() for card in cards]
        assert plan_counts == [3, 3]
        assert chips == ['Entrega inmediata', 'Solicitar a fábrica']
        assert not visible('.order-legacy-agreements')
        assert not visible('.order-live-finance')
        assert not visible('.order-allocation')
        assert not visible('.order-balance-compat')
        assert not visible('.order-operational-summary')
        assert driver.execute_script('return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1')

        driver.execute_script("arguments[0].scrollIntoView({block:'start'});", driver.find_element(By.CSS_SELECTOR, '.quote-items-section'))
        driver.save_screenshot(str(ARTIFACTS / f'pedido-simple-formulario-{width}.png'))

        click_visible(driver.find_element(By.ID, 'quote-preview-button'))
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.order-document-page')))
        assert not visible('.order-finance-balance')
        assert not visible('.order-document-allocation')
        text = driver.find_element(By.ID, 'quote-preview-content').get_attribute('textContent')
        assert 'Sala de revisión' in text and 'Comedor de revisión' in text
        assert 'Se entrega hoy' in text and 'Solicitar a fábrica' in text
        driver.find_element(By.CSS_SELECTOR, '.order-document-page').screenshot(str(ARTIFACTS / f'pedido-simple-documento-{width}.png'))

        results.append({'width': width, 'plans': chips, 'legacyHidden': True, 'balanceHidden': True})
        if width == 1440:
            print_preview_pdf()

    pdf_text = ' '.join(page.extract_text() for page in PdfReader(PDF).pages)
    assert 'Sala de revisión' in pdf_text and 'Comedor de revisión' in pdf_text
    assert 'Solicitar a fábrica' in pdf_text
    assert 'Saldo por pagar' not in pdf_text
    assert 'INTERNO' not in pdf_text
    errors = [entry['message'] for entry in driver.get_log('browser') if entry['level'] == 'SEVERE' and 'favicon.ico' not in entry['message']]
    assert not errors, errors
    print('ORDER_SIMPLE_QA=' + json.dumps({'responsive': results, 'pdfPages': len(PdfReader(PDF).pages), 'consoleErrors': errors}, ensure_ascii=False))
finally:
    driver.quit()
