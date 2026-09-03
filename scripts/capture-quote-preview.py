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
    wait.until(EC.element_to_be_clickable((By.ID, "quote-preview-button"))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-preview-main-page")))
    time.sleep(0.6)

    metrics = driver.execute_script("""
      const pick = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          display: style.display
        };
      };
      const page = pick('.quote-preview-main-page');
      const detail = pick('.quote-premium-section-heading');
      const result = {
        page,
        brand: pick('.quote-premium-brand-pane'),
        documentCard: pick('.quote-premium-doc-card'),
        companyGrid: pick('.quote-premium-company-grid'),
        contextBand: pick('.quote-premium-context-band'),
        clientBlock: pick('.quote-preview-client-block'),
        detailHeading: detail,
        number: pick('.quote-premium-number-block strong'),
      };
      if (page && detail) {
        result.headerFootprint = Math.round(detail.top - page.top);
        result.headerRatio = Number(((detail.top - page.top) / page.height).toFixed(3));
      }
      return result;
    """)

    page = driver.find_element(By.CSS_SELECTOR, ".quote-preview-main-page")
    page.screenshot(str(OUTPUT))
    print("VISUAL_QA_METRICS=" + json.dumps(metrics, ensure_ascii=False, sort_keys=True))
    print(f"Screenshot guardado en {OUTPUT}")
finally:
    driver.quit()
