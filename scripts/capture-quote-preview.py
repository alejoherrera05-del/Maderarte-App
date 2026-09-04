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
options.add_argument("--window-size=1680,2200")
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
      if (number) number.textContent = 'MP-0251';
      if (date) date.textContent = '04 de sept de 2026';
      if (advisor) advisor.textContent = 'Alejandro Herrera';
    """)

    driver.find_element(By.ID, "quote-client-name").send_keys("María Fernanda López")
    driver.find_element(By.ID, "quote-client-document").send_keys("1061760852")
    driver.find_element(By.ID, "quote-client-phone").send_keys("3125559081")
    driver.find_element(By.ID, "quote-client-email").send_keys("mariafernanda@email.com")
    driver.find_element(By.ID, "quote-client-address").send_keys("Cra. 8 # 12-44, Apto 705")
    driver.find_element(By.ID, "quote-client-city").send_keys("Popayán")

    first = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[0]
    first.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Sofá Oslo 2.10 m")
    Select(first.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("SALA")
    first.find_element(By.CSS_SELECTOR, '[data-field="fabric"]').send_keys("Bouclé marfil de textura media")
    first.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Patas en poliuretano champaña satinado")
    first.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Medidas 2.10 x 0.88 m. Espuma de alta densidad, estructura en madera inmunizada, cojines decorativos incluidos y profundidad especial de asiento.")
    first.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("3800000")

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 2)
    second = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[1]
    second.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Poltrona Nova giratoria")
    Select(second.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("SALA")
    quantity = second.find_element(By.CSS_SELECTOR, '[data-field="quantity"]')
    quantity.clear()
    quantity.send_keys("2")
    second.find_element(By.CSS_SELECTOR, '[data-field="fabric"]').send_keys("Lino premium tono taupe")
    second.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Base metálica negro mate y detalles en nogal")
    second.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Dos poltronas giratorias con asiento envolvente, espuma de alta resiliencia, respaldo ergonómico y costura perimetral decorativa.")
    second.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("1150000")

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 3)
    third = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[2]
    third.find_element(By.CSS_SELECTOR, '[data-field="description"]').send_keys("Mesa de centro Mandala")
    Select(third.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value("COMPLEMENTO")
    third.find_element(By.CSS_SELECTOR, '[data-field="fabric"]').send_keys("Acabado protector semimate transparente")
    third.find_element(By.CSS_SELECTOR, '[data-field="wood"]').send_keys("Madera tono nogal con tallado artesanal")
    third.find_element(By.CSS_SELECTOR, '[data-field="specifications"]').send_keys("Mesa redonda de 90 cm de diámetro, base robusta tallada, cantos suavizados y acabado poliuretano de alta resistencia.")
    third.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]').send_keys("1200000")

    discount = driver.find_element(By.ID, "quote-discount")
    discount.send_keys("300000")
    driver.find_element(By.ID, "quote-notes").send_keys(
        "Cotización de prueba. Incluye fabricación personalizada según acabados seleccionados. "
        "El tono final de telas y maderas se confirma con muestra física antes de iniciar producción. "
        "Transporte urbano incluido para Popayán."
    )

    # Attach one real repository image to every product to exercise the appendix.
    image_urls = [
        "/assets/interiors/living-room-morning.webp",
        "/assets/interiors/living-room-afternoon.webp",
        "/assets/interiors/living-room-night.webp",
    ]
    driver.execute_script("""
      const urls = arguments[0];
      const cards = Array.from(document.querySelectorAll('.quote-item'));
      cards.forEach((card, index) => {
        const list = card.querySelector('[data-photo-list]');
        if (!list) return;
        list.innerHTML = `<div class="quote-photo-thumb"><img src="${urls[index]}" alt="Referencia demo ${index + 1}"></div>`;
      });
    """, image_urls)

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
        thirdItem: pick('.quote-editorial-item:nth-child(3)'),
        total: pick('.quote-editorial-total > strong'),
        investment: pick('.quote-editorial-investment'),
        termCards: pick('.quote-editorial-term-cards'),
        firstTerm: pick('.quote-editorial-term-card'),
        termValue: pick('.quote-editorial-term-value'),
        signature: pick('.quote-editorial-signature'),
        footer: pick('.quote-editorial-footer'),
        maddyArt: pick('.quote-editorial-footer > img'),
        appendix: pick('.quote-preview-appendix-page')
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
    appendix = driver.find_elements(By.CSS_SELECTOR, ".quote-preview-appendix-page")
    appendix_html = appendix[0].get_attribute("outerHTML") if appendix else ""
    driver.execute_script("""
      document.body.innerHTML = arguments[0] + arguments[1];
      document.body.className = 'quote-print-export';
      document.documentElement.style.background = '#fff';
    """, page_html, appendix_html)
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

    page_metric = metrics.get("page") or {}
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
    appendix_metric = metrics.get("appendix")
    third_item = metrics.get("thirdItem")

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
    if not total or px(total) < 26 or "7.000.000" not in total.get("text", ""):
        raise AssertionError("El total con descuento no tiene la jerarquía o el valor esperado")
    if not investment or investment.get("height", 0) < 80:
        raise AssertionError("El resumen comercial no se renderizó")
    if not third_item:
        raise AssertionError("El tercer producto no se renderizó")
    if not appendix_metric or "Item 3" not in appendix_metric.get("text", ""):
        raise AssertionError("El anexo fotográfico no contiene los tres productos")
    # The hybrid document deliberately uses compact, text-first conditions rather than cards.
    if not first_term or first_term.get("height", 0) < 28:
        raise AssertionError("Las condiciones comerciales no se renderizaron correctamente")
    if not term_value or px(term_value) < 10:
        raise AssertionError("Los valores de condiciones no son legibles")
    if not footer or footer.get("height", 0) < 28:
        raise AssertionError("El pie del documento no se renderizó")
    if not maddy_art or maddy_art.get("width", 0) < 75:
        raise AssertionError("Maddy no se renderizó con el tamaño mínimo esperado")
    if page_metric and footer:
        used_height = footer.get("bottom", 0) - page_metric.get("top", 0)
        if used_height > page_metric.get("height", 0):
            raise AssertionError("El contenido comercial principal desbordó la primera hoja")
    if PDF_OUTPUT.stat().st_size < 60_000:
        raise AssertionError("El PDF de prueba parece incompleto")
finally:
    driver.quit()
