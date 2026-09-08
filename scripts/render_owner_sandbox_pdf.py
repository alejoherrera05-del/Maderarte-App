# Actual approved renderer; Browser Run transport is local in QA.
import json,sys,shutil,os
if os.environ.get('QA_PYTHON_PACKAGES'): sys.path.insert(0,os.environ['QA_PYTHON_PACKAGES'])
from pathlib import Path
from playwright.sync_api import sync_playwright
source,destination,origin=sys.argv[1:]
data=json.loads(Path(source).read_text(encoding='utf-8'))
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1120,'height':1200})
    page.goto(origin+('/cotizacion-render.html' if data.get('documentKind')=='quote' else '/documento-render.html'),wait_until='networkidle')
    page.evaluate("data=>{const s=document.createElement('script');s.id='maddy-document-data';s.type='application/json';s.textContent=JSON.stringify(data);document.body.append(s);}",data)
    page.locator('[data-document-ready="true"]').wait_for(timeout=30000)
    page.pdf(path=destination,format='A4',print_background=True,prefer_css_page_size=True,display_header_footer=False,margin={'top':'0','right':'0','bottom':'0','left':'0'})
    browser.close()
