import json
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

URL = os.environ.get('TRACKING_PREVIEW_URL', 'http://127.0.0.1:4173/cotizaciones.html?preview=1')
DESKTOP = Path('artifacts/cotizaciones-seguimiento-desktop.png')
MOBILE = Path('artifacts/cotizaciones-seguimiento-mobile.png')
DESKTOP.parent.mkdir(parents=True, exist_ok=True)

options = webdriver.ChromeOptions()
for arg in ('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1680,2300', '--force-device-scale-factor=1'):
    options.add_argument(arg)

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 35)
try:
    driver.get(URL)
    wait.until(EC.visibility_of_element_located((By.ID, 'tracking-app')))
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.tracking-card')) >= 6)
    time.sleep(.6)

    metrics = driver.execute_script('''
      const cards = Array.from(document.querySelectorAll('.tracking-card'));
      const rect = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return {top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height), text: node.textContent.trim()};
      };
      return {
        cardCount: cards.length,
        resultCount: document.getElementById('tracking-result-count')?.textContent.trim() || '',
        summaryCount: document.getElementById('tracking-summary-count')?.textContent.trim() || '',
        summaryAmount: document.getElementById('tracking-summary-amount')?.textContent.trim() || '',
        radarRecent: document.getElementById('tracking-radar-recent-count')?.textContent.trim() || '',
        radarAttention: document.getElementById('tracking-radar-attention-count')?.textContent.trim() || '',
        radarPriority: document.getElementById('tracking-radar-priority-count')?.textContent.trim() || '',
        versionText: document.querySelector('.module-footer-meta')?.textContent.trim() || '',
        wordmarkWidth: Math.round(document.querySelector('.module-brand-wordmark')?.getBoundingClientRect().width || 0),
        maddyWidth: Math.round(document.querySelector('.module-footer-maddy')?.getBoundingClientRect().width || 0),
        command: rect('.tracking-command'),
        first: rect('.tracking-card:nth-child(1)'),
        second: rect('.tracking-card:nth-child(2)'),
        third: rect('.tracking-card:nth-child(3)'),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      };
    ''')
    print('TRACKING_QA_DESKTOP=' + json.dumps(metrics, ensure_ascii=False, sort_keys=True))

    assert metrics['cardCount'] == 6
    assert metrics['summaryCount'] == '5'
    assert '36.750.000' in metrics['summaryAmount']
    assert metrics['radarRecent'] == '2'
    assert metrics['radarAttention'] == '2'
    assert metrics['radarPriority'] == '1'
    assert '0.2.0' in metrics['versionText']
    assert metrics['wordmarkWidth'] >= 120
    assert metrics['maddyWidth'] >= 145
    assert metrics['command'] and metrics['command']['width'] >= 1200
    assert metrics['first'] and metrics['second'] and metrics['third']
    assert abs(metrics['first']['top'] - metrics['second']['top']) <= 3
    assert abs(metrics['first']['top'] - metrics['third']['top']) <= 3
    assert metrics['first']['width'] >= 300
    assert not metrics['overflowX']

    driver.find_element(By.ID, 'tracking-app').screenshot(str(DESKTOP))

    driver.set_window_size(390, 2000)
    time.sleep(.7)
    mobile = driver.execute_script('''
      const cards = Array.from(document.querySelectorAll('.tracking-card'));
      const first = cards[0]?.getBoundingClientRect();
      const second = cards[1]?.getBoundingClientRect();
      return {
        cardCount: cards.length,
        firstWidth: first ? Math.round(first.width) : 0,
        firstTop: first ? Math.round(first.top) : 0,
        secondTop: second ? Math.round(second.top) : 0,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        filterColumns: getComputedStyle(document.querySelector('.tracking-filter-grid')).gridTemplateColumns,
        commandColumns: getComputedStyle(document.querySelector('.tracking-command')).gridTemplateColumns,
        wordmarkWidth: Math.round(document.querySelector('.module-brand-wordmark')?.getBoundingClientRect().width || 0),
        footerVersion: document.querySelector('.module-footer-meta')?.textContent.trim() || ''
      };
    ''')
    print('TRACKING_QA_MOBILE=' + json.dumps(mobile, ensure_ascii=False, sort_keys=True))
    assert mobile['cardCount'] == 6
    assert mobile['firstWidth'] >= 330
    assert mobile['secondTop'] > mobile['firstTop'] + 100
    assert mobile['wordmarkWidth'] >= 95
    assert '0.2.0' in mobile['footerVersion']
    assert not mobile['overflowX']
    driver.find_element(By.ID, 'tracking-app').screenshot(str(MOBILE))
finally:
    driver.quit()
