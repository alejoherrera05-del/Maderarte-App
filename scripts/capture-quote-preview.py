import base64
import json
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get(
    "QUOTE_PREVIEW_URL",
    "http://127.0.0.1:4173/cotizacion.html?preview=1",
)
OUTPUT = Path(os.environ.get("QUOTE_SCREENSHOT", "artifacts/cotizacion-preview.png"))
PDF_OUTPUT = Path(os.environ.get("QUOTE_PDF", "artifacts/cotizacion-preview.pdf"))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PDF_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1680,1900")
options.add_argument("--force-device-scale-factor=1")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 35)
try:
    driver.get(BASE_URL)
    wait.until(EC.visibility_of_element_located((By.ID, "quote-app")))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "quote-workspace")))

    driver.execute_script("""
      const number = document.getElementById('quote-meta-number');
      const date = document.getElementById('quote-meta-date');
      const advisor = document.getElementById('quote-meta-advisor');
      if (number) number.textContent = 'MP-0248';
      if (date) date.textContent = '04 de sept de 2026';
      if (advisor) advisor.textContent = 'Alejandro Herrera';
    """)

    driver.find_element(By.ID, "quote-client-name").send_keys("María Fernanda López")
    driver.find_element(By.ID, "quote-client-document").send_keys("1061760852")
    driver.find_element(By.ID, "quote-client-phone").send_keys("3125559081")
    driver.find_element(By.ID, "quote-client-email").send_keys("mariafernanda@email.com")
    driver.find_element(By.ID, "quote-client-address").send_keys("Cra. 8 # 12-44")
    driver.find_element(By.ID, "quote-client-city").send_keys("Popayán")

    first = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[0]
    first.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Sofá Oslo 2.10 m")
    Select(first.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("SALA")
    first.find_element(By.CSS_SELECTOR, '[data-field="fabric"]').send_keys("Bouclé marfil")
    first.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Poliuretano champaña")
    first.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Medidas 2.10 x 0.88 m. Espuma de alta densidad y cojines decorativos incluidos.")
    first.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("3800000")

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 2)
    second = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[1]
    second.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Mesa de centro Mandala")
    Select(second.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("SALA")
    second.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Madera tono nogal con tallado artesanal")
    second.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Mesa redonda con base robusta y acabado semimate.")
    second.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("700000")

    wait.until(EC.element_to_be_clickable((By.ID, "quote-preview-button"))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-page")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-investment")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-term-cards")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-footer")))
    time.sleep(0.8)

    metrics = driver.execute_script("""
      const pick = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          top: Math.round(rect.top), bottom: Math.round(rect.bottom),
          width: Math.round(rect.width), height: Math.round(rect.height),
          fontSize: style.fontSize, lineHeight: style.lineHeight,
          display: style.display, fontFamily: style.fontFamily,
          backgroundColor: style.backgroundColor,
          text: node.textContent.trim(),
          overflowingX: node.scrollWidth > node.clientWidth + 1
        };
      };
      const page = pick('.quote-editorial-page');
      const header = pick('.quote-editorial-header');
      const client = pick('.quote-editorial-client');
      const itemsHead = pick('.quote-editorial-section-head');
      const result = {
        page,
        header,
        letterhead: pick('.quote-editorial-letterhead'),
        documentTitle: pick('.quote-editorial-document h1'),
        quoteNumber: pick('.quote-editorial-number strong'),
        quoteDate: pick('.quote-editorial-secondary-meta span:first-child strong'),
        quoteBranch: pick('.quote-editorial-secondary-meta span:last-child strong'),
        client,
        itemsHead,
        firstItem: pick('.quote-editorial-item'),
        total: pick('.quote-editorial-total > strong'),
        investment: pick('.quote-editorial-investment'),
        termCards: pick('.quote-editorial-term-cards'),
        firstTerm: pick('.quote-editorial-term-card'),
        termValue: pick('.quote-editorial-term-value'),
        signature: pick('.quote-editorial-signature'),
        footer: pick('.quote-editorial-footer'),
        maddyArt: pick('.quote-editorial-footer > img')
      };
      if (page && client) result.clientStart = Math.round(client.top - page.top);
      if (page && itemsHead) result.itemsStart = Math.round(itemsHead.top - page.top);
      return result;
    """)

    page = driver.find_element(By.CSS_SELECTOR, ".quote-editorial-page")
    page.screenshot(str(OUTPUT))
    print("VISUAL_QA_METRICS=" + json.dumps(metrics, ensure_ascii=False, sort_keys=True))
    print(f"Screenshot guardado en {OUTPUT}")

    page_html = page.get_attribute("outerHTML")
    driver.execute_script("""
      document.body.innerHTML = arguments[0];
      document.body.className = 'quote-print-export';
      document.documentElement.style.background = '#fff';
    """, page_html)
    driver.execute_async_script("""
      const done = arguments[arguments.length - 1];
      const images = Array.from(document.images);
      Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))).then(() => done());
    """)
    time.sleep(0.3)
    pdf = driver.execute_cdp_cmd("Page.printToPDF", {
      "printBackground": True,
      "paperWidth": 8.27,
      "paperHeight": 11.69,
      "marginTop": 0,
      "marginBottom": 0,
      "marginLeft": 0,
      "marginRight": 0,
      "preferCSSPageSize": False,
      "displayHeaderFooter": False,
      "scale": 1
    })
    PDF_OUTPUT.write_bytes(base64.b64decode(pdf["data"]))
    print(f"PDF real guardado en {PDF_OUTPUT}")

    def px(metric, key="fontSize"):
        raw = (metric or {}).get(key, "0")
        try:
            return float(str(raw).replace("px", ""))
        except ValueError:
            return 0

    header_height = metrics.get("header", {}).get("height", 999)
    client_start = metrics.get("clientStart", 999)
    items_start = metrics.get("itemsStart", 999)
    investment = metrics.get("investment")
    quote_number = metrics.get("quoteNumber")
    quote_date = metrics.get("quoteDate")
    quote_branch = metrics.get("quoteBranch")
    total = metrics.get("total")
    first_term = metrics.get("firstTerm")
    term_value = metrics.get("termValue")
    footer = metrics.get("footer")
    maddy_art = metrics.get("maddyArt")

    if header_height < 130 or header_height > 270:
        raise AssertionError(f"Membrete editorial fuera de rango: {header_height}px")
    if client_start > 300:
        raise AssertionError(f"El cliente empieza demasiado abajo: {client_start}px")
    if items_start > 430:
        raise AssertionError(f"El detalle empieza demasiado abajo: {items_start}px")
    if not quote_number or px(quote_number) < 16:
        raise AssertionError("El número de cotización volvió a quedar demasiado pequeño")
    if not quote_date or px(quote_date) < 11.5 or quote_date.get("overflowingX"):
        raise AssertionError("La fecha no es suficientemente legible o se está recortando")
    if not quote_branch or px(quote_branch) < 11.5 or quote_branch.get("overflowingX"):
        raise AssertionError("La sede no es suficientemente legible o se está recortando")
    if not total or px(total) < 26:
        raise AssertionError("El total no tiene la jerarquía visual necesaria")
    if not investment or investment.get("height", 0) < 65:
        raise AssertionError("El resumen comercial no se renderizó")
    if not first_term or first_term.get("height", 0) < 82:
        raise AssertionError("Las tarjetas de condiciones no se renderizaron con suficiente presencia")
    if not term_value or px(term_value) < 22:
        raise AssertionError("Los valores de condiciones volvieron a quedar demasiado pequeños")
    if not footer or footer.get("height", 0) < 60:
        raise AssertionError("El pie editorial de Maddy no se renderizó con suficiente presencia")
    if not maddy_art or maddy_art.get("width", 0) < 120:
        raise AssertionError("Maddy volvió a quedar demasiado pequeña en el pie")
    if PDF_OUTPUT.stat().st_size < 20_000:
        raise AssertionError("El PDF exportado parece incompleto")
finally:
    driver.quit()
