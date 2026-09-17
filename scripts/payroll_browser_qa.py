"""Synthetic payroll UI evidence; never calls the commercial service."""
import json,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('artifacts/payroll');out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 for _ in range(50):
  try:urllib.request.urlopen('http://127.0.0.1:4173/nomina.html',timeout=1).close();break
  except Exception:time.sleep(.1)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox'])
  for width in [1440,390,320]:
   ctx=browser.new_context(viewport={'width':width,'height':950},device_scale_factor=2)
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:4173/nomina.html?preview=1');expect(page.locator('.np-summary')).to_be_visible()
   page.locator('[data-tab=comisiones]').click();expect(page.locator('[data-commission]')).to_have_count(2)
   assert page.locator('body').evaluate('e=>e.scrollWidth<=innerWidth')
   page.screenshot(path=str(out/f'comisiones-{width}.png'),full_page=True)
   page.locator('[data-commission]').first.click();expect(page.locator('#np-dialog')).to_be_visible()
   page.locator('[name=from]').fill('2026-06-01');page.locator('[name=to]').fill('2026-06-30')
   page.get_by_role('button',name='Revisar desglose',exact=True).click();expect(page.locator('.np-total')).to_contain_text('46.000')
   assert page.locator('#np-dialog').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   page.screenshot(path=str(out/f'comprobante-{width}.png'))
   page.locator('#np-close').click();page.locator('[data-tab=trabajadores]').click();page.locator('[data-employee]').click()
   expect(page.locator('#np-body')).to_contain_text('2026-01-01');page.screenshot(path=str(out/f'ficha-{width}.png'))
   assert not errors,errors;ctx.close()
  # Render the same document module used by Cloudflare, using only synthetic data.
  script="""import {payrollDocument} from './public/js/core/payroll-document.js';import {payrollCalculate} from './public/js/core/payroll-rules.js';const employee={name:'Trabajador de muestra',document:'DEMO-001',role:'Asesor comercial',start:'2026-01-01',transport:true};const commissions=[{order:'MP-OP-DEMO-001',date:'2026-01-10',total:5000000,paid:500000,amount:50000}];console.log(JSON.stringify({documentKind:'payroll',...payrollCalculate({type:'COMISION',from:'2026-06-01',to:'2026-06-30'},employee,commissions),employee,number:'NOM-DEMO-001',status:'EMITIDO',revision:1}));"""
  payload=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],text=True))
  page=browser.new_page(viewport={'width':1120,'height':1200})
  page.goto('http://127.0.0.1:4173/documento-render.html')
  page.evaluate("d=>{const n=document.createElement('script');n.id='maddy-document-data';n.type='application/json';n.textContent=JSON.stringify(d);document.body.append(n)}",payload)
  expect(page.locator('#quote-preview-content')).to_have_attribute('data-document-ready','true')
  page.locator('.np-paper img').first.wait_for();page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');page.pdf(path=str(out/'comision-muestra.pdf'),format='A4',print_background=True,prefer_css_page_size=True)
  page.screenshot(path=str(out/'pdf-muestra.png'),full_page=True)
  commission_script=script
  script=script.replace("type:'COMISION',from:'2026-06-01',to:'2026-06-30'","type:'LIQUIDACION',from:'2026-01-01',to:'2026-12-31',primaFrom:'2026-07-01',benefitBase:2000000,severanceBase:2000000,vacationBase:1750905,primaPaid:100000,severancePaid:100000,interestPaid:10000,vacationPaid:100000,salaryPending:100000,salaryPendingFrom:'2026-12-16',salaryPendingTo:'2026-12-31',advance:10000,deduction:10000,indemnity:100000,reviewed:true,notes:'Detalle verificado. '.repeat(25)").replace('employee,commissions)','employee,[])')
  payload=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],text=True))
  page.goto('http://127.0.0.1:4173/documento-render.html')
  page.evaluate("d=>{const n=document.createElement('script');n.id='maddy-document-data';n.type='application/json';n.textContent=JSON.stringify(d);document.body.append(n)}",payload)
  expect(page.locator('#quote-preview-content')).to_have_attribute('data-document-ready','true')
  page.evaluate('Promise.all([...document.images].map(i=>i.decode()))');page.emulate_media(media='print')
  assert page.locator('.np-paper').evaluate_all('rows=>rows.every(r=>[...r.children].filter(c=>c.tagName!=="FOOTER").every(c=>c.getBoundingClientRect().bottom<r.querySelector("footer").getBoundingClientRect().top))'), 'PDF content overlaps footer'
  page.pdf(path=str(out/'liquidacion-muestra.pdf'),format='A4',print_background=True,prefer_css_page_size=True)
  page.screenshot(path=str(out/'liquidacion-muestra.png'),full_page=True)
  script=commission_script.replace("type:'COMISION',from:'2026-06-01',to:'2026-06-30'","type:'SALARIO',from:'2026-09-01',to:'2026-09-15'").replace('employee,commissions)','employee,[])').replace("transport:true","transport:true,branch:'MP'").replace("status:'EMITIDO'","status:'PAGADO',issuedBy:'Administración · Muestra',payment:{date:'2026-09-15',method:'TRANSFERENCIA',reference:'DEMO-QUINCENA-01',by:'Administración · Muestra'}")
  payload=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],text=True))
  page.goto('http://127.0.0.1:4173/documento-render.html')
  page.evaluate("d=>{const n=document.createElement('script');n.id='maddy-document-data';n.type='application/json';n.textContent=JSON.stringify(d);document.body.append(n)}",payload)
  expect(page.locator('#quote-preview-content')).to_have_attribute('data-document-ready','true')
  expect(page.locator('.np-doc-heading h1')).to_have_text('Comprobante de nómina')
  expect(page.locator('.np-doc-heading')).to_contain_text('Primera quincena')
  expect(page.locator('.np-detail')).to_contain_text('1.750.905')
  expect(page.locator('.np-detail')).to_contain_text('15 / 30 días')
  expect(page.locator('.np-payment')).to_contain_text('DEMO-QUINCENA-01')
  assert page.locator('.np-doc-heading').evaluate('e=>getComputedStyle(e).textAlign==="center"')
  expect(page.locator('.np-doc-net')).to_contain_text('Neto pagado')
  assert page.locator('.np-paper').evaluate('e=>parseFloat(getComputedStyle(e.querySelector("h1")).fontSize)>parseFloat(getComputedStyle(e.querySelector(".np-doc-net strong")).fontSize)')
  assert page.locator('.np-detail tbody tr').evaluate_all('rows=>rows.every(r=>r.getBoundingClientRect().height>=40)')
  assert page.locator('.np-paper td').evaluate_all('cells=>cells.every(c=>c.scrollWidth<=c.clientWidth+1)'), 'A table value is clipped'

  assert page.locator('.np-paper').evaluate_all('rows=>rows.every(r=>[...r.children].filter(c=>c.tagName!=="FOOTER").every(c=>c.getBoundingClientRect().bottom<r.querySelector("footer").getBoundingClientRect().top))')
  assert page.locator('.np-paper').count()==1
  page.pdf(path=str(out/'quincena-muestra.pdf'),format='A4',print_background=True,prefer_css_page_size=True)
  page.screenshot(path=str(out/'quincena-muestra.png'),full_page=True);browser.close()
 print('Payroll UI: desktop, mobile, narrow viewport, January sale paid in June, calculation review, employee detail, no overflow and actual PDF generated.')
finally:server.terminate();server.wait(timeout=10)
