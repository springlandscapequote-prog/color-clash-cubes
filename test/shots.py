import sys, time
from playwright.sync_api import sync_playwright
eng=sys.argv[1]; W=int(sys.argv[2]); H=int(sys.argv[3]); tag=sys.argv[4]; base=sys.argv[5] if len(sys.argv)>5 else 'http://localhost:8123/'
out='/workspace/color-clash/shots/' if len(sys.argv)>6 and sys.argv[6]=='final' else '/tmp/sh_'
with sync_playwright() as p:
    b=getattr(p,eng).launch()
    ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True,is_mobile=W<700)
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    def wait_phase(ph, to=15000):
        pg.wait_for_function("p=>window.__ccc.state().phase===p", arg=ph, timeout=to)
    def snap(n): pg.screenshot(path=out+tag+'_'+n+'.png')
    pg.goto(base+'index.html?x=1&seed=11'); pg.wait_for_timeout(600); snap('01_title')
    pg.tap('#btn-play'); pg.wait_for_timeout(300)
    pg.fill('.prow:nth-child(1) .pname','Gabi'); pg.fill('.prow:nth-child(2) .pname','Dad')
    pg.tap('.count-btn[data-n="3"]'); pg.fill('.prow:nth-child(3) .pname','Christina'); pg.tap('.prow:nth-child(1) .av-btn'); pg.wait_for_timeout(200); snap('02_setup')
    pg.tap('.prow:nth-child(1) .av-btn')
    pg.tap('#btn-start'); pg.wait_for_timeout(500); snap('03_pass')
    pg.tap('#btn-pass-ok'); pg.wait_for_timeout(300)
    # set up: current player has 4 yellow loose, opponent 3 red + 5 blue
    pg.evaluate("""()=>{var g=window.__ccc.game(),S=window.__ccc.state();var me=g.cur;var o1=(me+1)%g.np,o2=(me+2)%g.np;
      g.pool[0]-=4;g.piles[me][0]=4; g.pool[5]-=3;g.piles[o1][5]=3; g.pool[4]-=5; g.piles[o2][4]=5; g.pool[1]-=2; g.piles[o1][1]=2; g.pool[2]-=1;g.piles[me][2]=1;
      g.cubes[o2][3]=1; g.pool[3]-=6; g.completed=1; S.view={pool:g.pool.slice(),piles:g.piles.map(function(a){return a.slice()}),cubes:g.cubes.map(function(a){return a.slice()})};
      window.__forceRoll=[3,0];}""")
    pg.tap('#btn-roll'); pg.wait_for_timeout(350); snap('04_rolling'); pg.wait_for_selector('.choice',timeout=20000); pg.wait_for_timeout(400); snap('05_choose_take')
    # take 3 yellow -> collecting stack, mid animation
    pg.tap('.choice[data-kind="take"]'); pg.wait_for_timeout(1000); snap('06_collecting_stack'); pg.wait_for_timeout(900); snap('06b_cube_built'); pg.wait_for_timeout(700); snap('06c_cube_celebration')
    wait_phase('pass')
    pg.tap('#btn-pass-ok'); pg.wait_for_timeout(200)
    pg.evaluate("window.__forceRoll=[3,4]"); pg.tap('#btn-roll'); pg.wait_for_selector('.choice',timeout=20000); pg.wait_for_timeout(400); snap('07_steal_choices')
    pg.tap('.choice[data-kind="steal"]'); pg.wait_for_timeout(400); snap('08_steal_confirm')
    pg.tap('#btn-confirm-yes'); pg.wait_for_timeout(500); snap('09_steal_anim')
    wait_phase('pass')
    pg.tap('#btn-pass-ok'); pg.wait_for_timeout(200)
    pg.evaluate("window.__forceRoll=[2,0]"); pg.tap('#btn-roll'); pg.wait_for_selector('.choice',timeout=20000); pg.wait_for_timeout(400); snap('10_choose_cube')
    print('errs',errs)
    b.close()
