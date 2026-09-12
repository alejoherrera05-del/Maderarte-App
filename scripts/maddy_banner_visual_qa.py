import json, subprocess, time
from pathlib import Path
from PIL import Image
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait
out=Path('artifacts/maddy-banners');out.mkdir(parents=True,exist_ok=True)
for key in ('morning','afternoon','night'):
    path=Path('public/assets/banners/maddy-'+key+'-v1.png')
    with Image.open(path) as im:
        assert im.size==(2172,724), (key,im.size)
        assert im.mode=='RGB', (key,im.mode)
        im.verify()
server=subprocess.Popen(['node','scripts/serve.mjs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
opts=webdriver.ChromeOptions()
for arg in ('--headless=new','--no-sandbox','--disable-dev-shm-usage'):opts.add_argument(arg)
opts.set_capability('goog:loggingPrefs',{'browser':'ALL'})
driver=webdriver.Chrome(options=opts);wait=WebDriverWait(driver,25);records=[];handle=None
try:
    time.sleep(1)
    for width in (1440,768,390,320):
        driver.execute_cdp_cmd('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':2,'mobile':False})
        for key,hour in (('morning',9),('afternoon',15),('night',21)):
            if handle:driver.execute_cdp_cmd('Page.removeScriptToEvaluateOnNewDocument',{'identifier':handle})
            script="const RealDate=Date,instant=RealDate.parse('2026-09-12T%02d:00:00-05:00');window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[instant]))}static now(){return instant}};"%hour
            handle=driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument',{'source':script})['identifier']
            driver.get('http://127.0.0.1:4173/index.html?preview=1')
            wait.until(lambda d:d.execute_script("const i=document.querySelector('.home-interior');return i&&i.complete&&i.naturalWidth>0"))
            data=driver.execute_script("""
              const i=document.querySelector('.home-interior'),hero=document.querySelector('.home-hero'),g=document.querySelector('.home-greeting');
              const r=i.getBoundingClientRect(),h=hero.getBoundingClientRect();
              return {key:hero.dataset.moment,src:i.getAttribute('src'),width:innerWidth,height:h.height,
               natural:[i.naturalWidth,i.naturalHeight],density:i.naturalHeight/r.height,greeting:g.innerText,
               overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
               overlap:g.getBoundingClientRect().right>r.left+1&&g.getBoundingClientRect().bottom>r.top+1,
               imageHeight:r.height,
               actionsTop:document.querySelector('.dashboard-groups').getBoundingClientRect().top};
            """)
            assert data['key']==key and data['src'].endswith(key+'-v1.png'),data
            assert data['density']>=2 and not data['overflow'] and not data['overlap'],data
            if width<=390:assert data['height']>=350 and data['imageHeight']>=220,data
            driver.execute_async_script("const done=arguments[0];document.querySelector('.home-interior').decode().then(()=>requestAnimationFrame(()=>requestAnimationFrame(done)))")
            driver.save_screenshot(str(out/(key+'-'+str(width)+'-2x.png')))
            records.append(data)
    driver.execute_script("""
      const PreviousDate=Date,instant=PreviousDate.parse('2026-09-13T12:00:00-05:00');
      window.Date=class extends PreviousDate {constructor(...args){super(...(args.length?args:[instant]))}static now(){return instant}};
      document.dispatchEvent(new Event('visibilitychange'));
    """)
    wait.until(lambda d:d.execute_script("const h=document.querySelector('.home-hero'),i=h.querySelector('img');return h.dataset.moment==='afternoon'&&i.complete&&i.naturalWidth>0"))
    assert '13 de septiembre' in driver.find_element('css selector','.home-greeting > p').text
    assert 'Buenas tardes' in driver.find_element('css selector','.home-greeting-welcome').text
    print('RETURN_TO_APP_QA=scene, greeting and date refreshed without reload')
    errors=[e['message'] for e in driver.get_log('browser') if e['level']=='SEVERE' and 'favicon' not in e['message']]
    assert not errors,errors
    (out/'metrics.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    print('MADDY_BANNER_QA='+json.dumps(records,ensure_ascii=False))
finally:
    driver.quit();server.terminate();server.wait(timeout=10)
