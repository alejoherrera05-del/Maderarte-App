import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.environ.get(
    "QUOTE_PREVIEW_URL",
    "https://etapa-4-paridad-homeeasy-maderarte-app.alejoherrera05.workers.dev/cotizacion.html?preview=1",
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
    page = driver.find_element(By.CSS_SELECTOR, ".quote-preview-main-page")
    page.screenshot(str(OUTPUT))
    print(f"Screenshot guardado en {OUTPUT}")
finally:
    driver.quit()
