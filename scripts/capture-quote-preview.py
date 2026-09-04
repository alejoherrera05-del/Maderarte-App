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


def fill(element, text):
    element.clear()
    element.send_keys(str(text))


def fill_item(card, *, description, category, quantity, unit_value, fabric, wood, specifications, photo_path):
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="description"]'), description)
    Select(card.find_element(By.CSS_SELECTOR, '[data-field="category"]')).select_by_value(category)
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="quantity"]'), quantity)
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="unitValue"]'), unit_value)
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="fabric"]'), fabric)
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="wood"]'), wood)
    fill(card.find_element(By.CSS_SELECTOR, '[data-field="specifications"]'), specifications)

    photo_input = card.find_element(By.CSS_SELECTOR, '[data-photo-input]')
    photo_input.send_keys(str(photo_path.resolve()))
    wait.until(lambda d: len(card.find_elements(By.CSS_SELECTOR, '.quote-photo-thumb img')) >= 1)


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

    # Cliente: todos los campos visibles del formulario.
    fill(driver.find_element(By.ID, "quote-client-document"), "1061760852")
    fill(driver.find_element(By.ID, "quote-client-name"), "María Fernanda López")
    fill(driver.find_element(By.ID, "quote-client-phone"), "3125559081")
    fill(driver.find_element(By.ID, "quote-client-email"), "mariafernanda@email.com")
    fill(driver.find_element(By.ID, "quote-client-address"), "Cra. 8 # 12-44, Apto 705")
    fill(driver.find_element(By.ID, "quote-client-city"), "Popayán")

    fixture_dir = Path.cwd() / "public" / "assets" / "interiors"

    first = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[0]
    fill_item(
        first,
        description="Sofá Oslo 2.10 m",
        category="SALA",
        quantity=1,
        unit_value=3800000,
        fabric="Bouclé marfil de textura media",
        wood="Patas en poliuretano champaña satinado",
        specifications="Medidas 2.10 x 0.88 m. Espuma de alta densidad, estructura en madera inmunizada, cojines decorativos incluidos y profundidad especial de asiento.",
        photo_path=fixture_dir / "living-room-morning.webp",
    )

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 2)
    second = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[1]
    fill_item(
        second,
        description="Poltrona Nova giratoria",
        category="SALA",
        quantity=2,
        unit_value=1150000,
        fabric="Lino premium tono taupe",
        wood="Base metálica negro mate y detalles en nogal",
        specifications="Dos poltronas giratorias con asiento envolvente, espuma de alta resiliencia, respaldo ergonómico y costura perimetral decorativa.",
        photo_path=fixture_dir / "living-room-afternoon.webp",
    )

    driver.find_element(By.ID, "quote-add-item").click()
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.quote-item')) == 3)
    third = driver.find_elements(By.CSS_SELECTOR, '.quote-item')[2]
    fill_item(
        third,
        description="Mesa de centro Mandala",
        category="COMPLEMENTO",
        quantity=1,
        unit_value=1200000,
        fabric="Acabado protector semimate transparente",
        wood="Madera tono nogal con tallado artesanal",
        specifications="Mesa redonda de 90 cm de diámetro, base robusta tallada, cantos suavizados y acabado poliuretano de alta resistencia.",
        photo_path=fixture_dir / "living-room-night.webp",
    )

    # Descuento y observaciones para comprobar el cierre completo del documento.
    fill(driver.find_element(By.ID, "quote-discount"), 300000)
    fill(
        driver.find_element(By.ID, "quote-notes"),
        "Cotización de prueba. Incluye fabricación personalizada según acabados seleccionados. El tono final de telas y maderas se confirma con muestra física antes de iniciar producción. Transporte urbano incluido para Popayán.",
    )

    wait.until(lambda d: "$\u00a07.000.000" in d.find_element(By.ID, "quote-total").text or "$ 7.000.000" in d.find_element(By.ID, "quote-total").text)
    wait.until(EC.element_to_be_clickable((By.ID, "quote-preview-button"))).click()
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-page")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-investment")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-term-cards")))
    wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".quote-editorial-footer")))
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, ".quote-preview-appendix-page .quote-appendix-item")) == 3)
    time.sleep(1)

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

    preview_html = driver.find_element(By.ID, "quote-preview-content").get_attribute("innerHTML")
    driver.execute_script("""
      document.body.innerHTML = arguments[0];
      document.body.className = 'quote-print-export';
      document.documentElement.style.background = '#fff';
      document.body.style.background = '#fff';
      const style = document.createElement('style');
      style.textContent = `
        @page { size: A4; margin: 0; }
        body.quote-print-export .quote-preview-page {
          width: 210mm !important;
          min-height: 297mm !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          break-after: page !important;
          page-break-after: always !important;
        }
        body.quote-print-export .quote-preview-page:last-child {
          break-after: auto !important;
          page-break-after: auto !important;
        }
      `;
      document.head.appendChild(style);
    """, preview_html)
    driver.execute_async_script("""
      const done = arguments[arguments.length - 1];
      const images = Array.from(document.images);
      Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }))).then(() => done());
    """)
    time.sleep(0.5)
    pdf = driver.execute_cdp_cmd("Page.printToPDF", {
      "printBackground": True,
      "paperWidth": 8.27,
      "paperHeight": 11.69,
      "marginTop": 0,
      "marginBottom": 0,
      "marginLeft": 0,
      "marginRight": 0,
      "preferCSSPageSize": True,
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
    appendix = metrics.get("appendix")
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
    if not investment or investment.get("height", 0) < 65:
        raise AssertionError("El resumen comercial no se renderizó")
    if not third_item:
        raise AssertionError("El tercer producto no se renderizó")
    if not appendix or "Item 3" not in appendix.get("text", ""):
        raise AssertionError("El anexo fotográfico no contiene los tres productos")
    if not first_term or first_term.get("height", 0) < 82:
        raise AssertionError("Las condiciones no se renderizaron con suficiente presencia")
    if not term_value or px(term_value) < 22:
        raise AssertionError("Los valores de condiciones volvieron a quedar demasiado pequeños")
    if not footer or footer.get("height", 0) < 60:
        raise AssertionError("El pie editorial de Maddy no se renderizó con suficiente presencia")
    if not maddy_art or maddy_art.get("width", 0) < 120:
        raise AssertionError("Maddy volvió a quedar demasiado pequeña en el pie")
    if PDF_OUTPUT.stat().st_size < 60_000:
        raise AssertionError("El PDF de prueba parece incompleto")
finally:
    driver.quit()
