import sys, time, json
from playwright.sync_api import sync_playwright
base, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'])
    pg = b.new_page(viewport={'width':1100,'height':700})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:300])); pg.on('console', lambda m: errs.append(m.text[:300]) if m.type=='error' else None)
    pg.goto(base + '/?play=hare&nomenu&bench&hour=10', wait_until='load')
    for i in range(120):
        time.sleep(1)
        s = pg.evaluate("document.getElementById('status')?.innerText ?? ''")
        if 'Stamina' in s: break
    time.sleep(25)
    print('status:', pg.evaluate("document.getElementById('status')?.innerText"))
    pg.screenshot(path=f'{out}/idle.png')
    pg.keyboard.down('w'); 
    for i in range(4):
        time.sleep(1.5); pg.screenshot(path=f'{out}/walk{i}.png')
    pg.keyboard.down('Shift')
    for i in range(6):
        time.sleep(.5); pg.screenshot(path=f'{out}/run{i}.png')
    print('status after:', pg.evaluate("document.getElementById('status')?.innerText"))
    print('errors', errs[:8])
    b.close()
