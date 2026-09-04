import json
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get(
    "QUOTE_PREVIEW_URL",
    "http://127.0.0.1:4173/cotizacion.html?preview=1",
)
OUTPUT = Path(os.environ.get("QUOTE_SCREENSHOT", "artifacts/cotizacion-preview.png"))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1680,1400")
options.add_argument("--force-device-scale-factor=1")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 35)
try:
    driver.get(BASE_URL)
    wait.until(EC.visibility_of_element_located((By.ID, "quote-app")))
    wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-quote-branch="MP"]'))).click()
    wait.until(EC.visibility_of_element_located((By.ID, "quote-workspace")))

    driver.find_element(By.ID, "quote-client-name").send_keys("Cliente de muestra")
    driver.find_element(By.ID, "quote-client-document").send_keys("123456789")
    driver.find_element(By.ID, "quote-client-phone").send_keys("3000000000")
    driver.find_element(By.CSS_SELECTOR, '.quote-item [data-field="description"]').send_keys("Sofá de diseño personalizado")
    driver.find_element(By.CSS_SELECTOR, '.quote-item [data-field="unitValue"]').send_keys("4500000")

    wait.until(EC.element_to_be_clickable((By.ID, "quote-preview-button"))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-preview-main-page")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-document-signature")))
    time.sleep(0.6)

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
          display: style.display, fontFamily: style.fontFamily
        };
      };
      const page = pick('.quote-preview-main-page');
      const header = pick('.quote-brand-header');
      const band = pick('.quote-brand-band');
      const meta = pick('.quote-doc-meta');
      const title = pick('.quote-document-title');
      const client = pick('.quote-client-section');
      const detail = pick('.quote-section-heading');
      const result = {
        page,
        header,
        band,
        meta,
        title,
        client,
        detailHeading: detail,
        signature: pick('.quote-document-signature'),
        signatureName: pick('.quote-document-signature span'),
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

    header_height = metrics.get("header", {}).get("height", 999)
    band_height = metrics.get("band", {}).get("height", 999)
    meta_height = metrics.get("meta", {}).get("height", 999)
    client_start = metrics.get("clientStart", 999)
    detail_start = metrics.get("detailStart", 999)
    signature = metrics.get("signature")

    if header_height < 145 or header_height > 205:
        raise AssertionError(f"Cabecera fuera de rango: {header_height}px")
    if band_height < 105 or band_height > 145:
        raise AssertionError(f"Franja de marca fuera de rango: {band_height}px")
    if meta_height < 34 or meta_height > 52:
        raise AssertionError(f"Cápsula número/fecha fuera de rango: {meta_height}px")
    if client_start > 235:
        raise AssertionError(f"El cliente empieza demasiado abajo: {client_start}px")
    if detail_start > 335:
        raise AssertionError(f"El detalle empieza demasiado abajo: {detail_start}px")
    if not signature or signature.get("height", 0) < 20:
        raise AssertionError("La firma final del asesor no se renderizó")
finally:
    driver.quit()
