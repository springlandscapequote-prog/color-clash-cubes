import os, time
from playwright.sync_api import sync_playwright
U='https://springlandscapequote-prog.github.io/color-clash-cubes/'
with sync_playwright() as p:
    pgs={}; v0={}; errs=[]
    for eng in ('chromium','webkit'):
        b=getattr(p,eng).launch(); ctx=b.new_context(viewport={'width':390,'height':664},has_touch=True,is_mobile=True); pg=ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.goto(U); pg.wait_for_timeout(1000)
        v0[eng]=pg.evaluate("window.CCC_BUILD"); pgs[eng]=pg; print(eng,'old copy loaded',v0[eng],flush=True)
    open('/tmp/ready','w').write('1')
    while not os.path.exists('/tmp/pushed'): time.sleep(1)
    t=time.time(); done={}
    while time.time()-t<240 and len(done)<2:
        for eng,pg in pgs.items():
            if eng in done: continue
            try:
                pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(4000)
                v=pg.evaluate("window.CCC_BUILD")
                if v!=v0[eng]: done[eng]=v; print(eng,'picked up new build',v,'after',int(time.time()-t),'s',flush=True)
            except Exception as e: pg.wait_for_timeout(2000)
    print('done',done,'errs',errs)
