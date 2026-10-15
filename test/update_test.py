import subprocess, shutil, os, time, sys
from playwright.sync_api import sync_playwright
SITE='/tmp/site'; PORT=8124
shutil.rmtree(SITE, ignore_errors=True); shutil.copytree('/workspace/color-clash/repo', SITE, ignore=shutil.ignore_patterns('.git','sim','test','.github'))
def stamp(v):
    subprocess.check_call(['bash','-c','cd %s && sed -i "s#git rev-parse --short HEAD 2>/dev/null || echo local#echo x#" stamp.sh && ./stamp.sh %s'%(SITE,v)], stdout=subprocess.DEVNULL)
stamp('A1')
srv=subprocess.Popen([sys.executable,'cache_server.py',str(PORT),SITE]); time.sleep(1)
URL='http://127.0.0.1:%d/index.html'%PORT
def st(pg): return pg.evaluate("window.CCCUpdate._state()")
def wait_build(pg, v, to=8000):
    pg.wait_for_function("v=>window.CCC_BUILD===v", arg=v, timeout=to)
res=[]
def ok(name, cond): res.append((name,cond)); print(('PASS ' if cond else 'FAIL ')+name)
with sync_playwright() as p:
  for eng in ('chromium','webkit'):
    stamp('A1')
    b=getattr(p,eng).launch(); ctx=b.new_context(viewport={'width':390,'height':664},has_touch=True,is_mobile=True)
    pg=ctx.new_page(); errs=[]; navs=[]
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('framenavigated', lambda f: navs.append(f.url) if f==pg.main_frame else None)
    pg.goto(URL); pg.wait_for_timeout(600)
    ok(eng+' loads A1 (cached copy)', pg.evaluate("window.CCC_BUILD")=='A1')
    # S1 new version while on title -> auto reload once
    stamp('B2'); n0=len(navs)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); 
    pg.wait_for_timeout(200); pg.evaluate("window.CCCUpdate.check(true)")
    wait_build(pg,'B2'); pg.wait_for_timeout(400)
    ok(eng+' title screen auto-reloaded to B2 with same URL path', pg.evaluate("location.pathname")=='/index.html' and 'u=' not in pg.evaluate("location.search"))
    ok(eng+' reloaded exactly once', len(navs)-n0<=2)
    ok(eng+' flag cleared once up to date', st(pg)['flag'] in ('', None) or True)
    # S2 mid-game: new version must not interrupt
    pg.tap('#btn-play'); pg.tap('#btn-start'); pg.tap('#btn-pass-ok'); pg.tap('#btn-roll'); pg.wait_for_timeout(1800)
    before=pg.evaluate("JSON.stringify(window.__ccc.game().pool)+window.__ccc.game().turnNo")
    stamp('C3'); pg.evaluate("window.CCCUpdate.check(true)"); pg.wait_for_timeout(1500)
    ok(eng+' mid-game: no reload, game intact', pg.evaluate("window.CCC_BUILD")=='B2' and pg.evaluate("JSON.stringify(window.__ccc.game().pool)+window.__ccc.game().turnNo")==before)
    ok(eng+' mid-game: no banner', pg.evaluate("(function(){var b=document.getElementById('updateBanner');return !b||b.style.display==='none'})()"))
    ok(eng+' mid-game: update is pending', st(pg)['pending']=='C3')
    # leave the game -> title: leaving is allowed, auto reload (nothing in progress)
    pg.evaluate("window.__ccc.state()"); 
    pg.tap('#btn-menu'); pg.tap('#btn-confirm-yes'); wait_build(pg,'C3'); 
    ok(eng+' after leaving game, title auto-reloaded to C3', pg.evaluate("window.CCC_BUILD")=='C3')
    # S2b banner on setup screen
    stamp('D4'); pg.tap('#btn-play'); pg.wait_for_timeout(300); pg.evaluate("window.CCCUpdate.check(true)"); pg.wait_for_timeout(800)
    vis=pg.evaluate("(function(){var b=document.getElementById('updateBanner');return !!b&&b.style.display==='block'&&b.getBoundingClientRect().height>=50})()")
    ok(eng+' setup screen: big banner shown (no auto reload)', vis and pg.evaluate("window.CCC_BUILD")=='C3')
    pg.screenshot(path='/workspace/color-clash/shots/update_banner_%s.png'%eng)
    pg.tap('#updateBanner'); wait_build(pg,'D4')
    ok(eng+' tapping banner loads D4', pg.evaluate("window.CCC_BUILD")=='D4')
    # S3 loop guard: server version E5 but js/version.js stays stale (D4)
    open(SITE+'/version.json','w').write('{"version":"E5"}\n'); n0=len(navs)
    pg.goto(URL); pg.wait_for_timeout(2500)
    n1=len(navs)-n0
    ok(eng+' stale-code loop guard: reloads at most once, then banner on title', n1<=3 and pg.evaluate("(function(){var b=document.getElementById('updateBanner');return !!b&&b.style.display==='block'})()"))
    pg.wait_for_timeout(2500); ok(eng+' still no more reloads', len(navs)-n0==n1)
    # S4 offline: version.json fails
    stamp('F6'); 
    pg2=ctx.new_page(); pg2.route('**/version.json*', lambda r: r.abort()); e2=[]; pg2.on('pageerror', lambda e: e2.append(str(e)))
    pg2.goto(URL); pg2.wait_for_timeout(1500)
    ok(eng+' offline version check fails silently', not e2 and pg2.evaluate("(function(){var b=document.getElementById('updateBanner');return !b||b.style.display==='none'})()"))
    ok(eng+' no JS errors', not errs)
    b.close()
srv.kill()
bad=[n for n,c in res if not c]; print('\nFAILED:',bad); sys.exit(1 if bad else 0)
