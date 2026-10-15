import sys, random
from playwright.sync_api import sync_playwright
from play import *
eng, W, H, tag, base = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
out='/workspace/color-clash/shots/'
np_ = int(sys.argv[6]) if len(sys.argv)>6 else 3
with sync_playwright() as p:
    b=getattr(p,eng).launch()
    ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True,is_mobile=W<700)
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.goto(base+'index.html?x=1&fast=1&seed='+__import__('os').environ.get('SEED','77')+''); pg.wait_for_timeout(400)
    pg.tap('#btn-play'); pg.fill('.prow:nth-child(1) .pname','Gabi'); pg.fill('.prow:nth-child(2) .pname','Dad')
    pg.tap('.count-btn[data-n="%d"]'%np_)
    if np_>=3: pg.fill('.prow:nth-child(3) .pname','Christina')
    if np_>=4: pg.fill('.prow:nth-child(4) .pname','Mom')
    pg.tap('#btn-start')
    state={'mid':False,'lap':False}
    def hook(pg, info):
        if not state['lap'] and pg.evaluate("(function(){var t=document.querySelectorAll('.toast');for(var i=0;i<t.length;i++){if(t[i].textContent.indexOf('LAST LAP')>=0)return true}return false})()"):
            state['lap']=True; pg.wait_for_timeout(120); pg.screenshot(path=out+tag+'_last_lap_banner.png')
        if info['ph']=='pass':
            g=pg.evaluate("(function(){var g=window.__ccc.game();return {c:g.completed,lap:g.lastLapLeft!==undefined,turn:g.turnNo}})()")
            if g['c']>=5 and not state['mid']:
                state['mid']=True; pg.wait_for_timeout(200); pg.screenshot(path=out+tag+'_scoreboard_midgame.png')
    s=play_game(pg,np_,True,random.Random(int(__import__('os').environ.get('RND','5'))),skip_setup=True,on_step=hook)
    pg.wait_for_timeout(1200); pg.screenshot(path=out+tag+'_end_screen'+__import__('os').environ.get('SUF','')+'.png')
    print(s['game'], s['end_title'], errs)
    b.close()
