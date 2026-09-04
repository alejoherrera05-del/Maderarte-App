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
options.add_argument("--window-size=1680,1800")
options.add_argument("--force-device-scale-factor=1")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 35)
try:
    driver.get(BASE_URL)
    wait.until(EC.visibility_of_element_located((By.ID, "quote-app")))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "quote-workspace")))

    # Datos representativos de una cotización real para revisar la página completa.
    driver.execute_script("""
      const number = document.getElementById('quote-meta-number');
      const advisor = document.getElementById('quote-meta-advisor');
      if (number) number.textContent = 'MP-0248';
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
    first.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Medidas 2.10 x 0.88 m · Espuma alta densidad · Cojines decorativos incluidos")
    first.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("3800000")

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 2)
    second = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[1]
    second.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Mesa de centro Mandala")
    Select(second.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("SALA")
    second.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Madera tono nogal con tallado artesanal")
    second.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Mesa redonda con base robusta y acabado semimate")
    second.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("700000")

    wait.until(EC.element_to_be_clickable((By.ID, "quote-preview-button"))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-preview-main-page")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-document-signature")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-order-conditions")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-maddy-footer")))
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
          backgroundColor: style.backgroundColor
        };
      };
      const page = pick('.quote-preview-main-page');
      const header = pick('.quote-brand-header');
      const band = pick('.quote-brand-band');
      const meta = pick('.quote-doc-meta');
      const client = pick('.quote-client-section');
      const detail = pick('.quote-section-heading');
      const result = {
        page,
        header,
        band,
        meta,
        client,
        detailHeading: detail,
        firstItem: pick('.quote-preview-item'),
        conditions: pick('.quote-order-conditions'),
        signature: pick('.quote-document-signature'),
        maddyFooter: pick('.quote-maddy-footer'),
        maddyArt: pick('.quote-maddy-footer-art'),
        number: pick('.quote-doc-meta-item > strong')
      };
      if (page && client) result.clientStart = Math.round(client.top - page.top);
      if (page && detail) result.detailStart = Math.round(detail.top - page.top);
      return result;
    """)

    page = driver.find_element(By.CSS_SELECTOR, ".quote-preview-main-page")
    page.screenshot(str(OUTPUT))
    print("VISUAL_QA_METRICS=" + json.dumps(metrics, ensure_ascii=False, sort_keys=True))
    print(f"Screenshot guardado en {OUTPUT}")

    # Exportar el mismo HTML como PDF A4 real, sin la interfaz de la aplicación alrededor.
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

    header_height = metrics.get("header", {}).get("height", 999)
    band_height = metrics.get("band", {}).get("height", 999)
    meta_height = metrics.get("meta", {}).get("height", 999)
    client_start = metrics.get("clientStart", 999)
    detail_start = metrics.get("detailStart", 999)
    signature = metrics.get("signature")
    conditions = metrics.get("conditions")
    maddy_footer = metrics.get("maddyFooter")
    maddy_art = metrics.get("maddyArt")

    if header_height < 145 or header_height > 205:
        raise AssertionError(f"Cabecera fuera de rango: {header_height}px")
    if band_height < 105 or band_height > 145:
        raise AssertionError(f"Franja de marca fuera de rango: {band_height}px")
    if meta_height < 34 or meta_height > 52:
        raise AssertionError(f"Barra número/fecha/sede fuera de rango: {meta_height}px")
    if client_start > 235:
        raise AssertionError(f"El cliente empieza demasiado abajo: {client_start}px")
    if detail_start > 345:
        raise AssertionError(f"El detalle empieza demasiado abajo: {detail_start}px")
    if not conditions or conditions.get("height", 0) < 55:
        raise AssertionError("Las condiciones del pedido no se renderizaron")
    if not signature or signature.get("height", 0) < 20:
        raise AssertionError("La firma final del asesor no se renderizó")
    if not maddy_footer or maddy_footer.get("height", 0) < 45:
        raise AssertionError("El pie de página de Maddy no se renderizó")
    if not maddy_art or maddy_art.get("width", 0) < 80:
        raise AssertionError("El recurso de Maddy no se renderizó")
    if PDF_OUTPUT.stat().st_size < 20_000:
        raise AssertionError("El PDF exportado parece incompleto")
finally:
    driver.quit()
