import sys, random, json
from playwright.sync_api import sync_playwright
from play import *
eng = sys.argv[1]; W=int(sys.argv[2]); H=int(sys.argv[3]); games=int(sys.argv[4]); touch = sys.argv[5]=='touch'
base = sys.argv[6] if len(sys.argv)>6 else 'http://localhost:8123/'
fast = '1' if (len(sys.argv)<=7 or sys.argv[7]=='fast') else ''
with sync_playwright() as p:
    b = getattr(p, eng).launch()
    ctx = b.new_context(viewport={'width':W,'height':H}, has_touch=True, is_mobile=(W<700))
    pg = ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    pg.add_init_script("""window.__toasts={cube:0,steal:0,lap:0};document.addEventListener('DOMContentLoaded',function(){new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.className&&String(n.className).indexOf('toast')>=0){var t=n.textContent;if(t.indexOf('cube built')>=0)window.__toasts.cube++;else if(t.indexOf('steals')>=0)window.__toasts.steal++;else if(t.indexOf('LAST LAP')>=0)window.__toasts.lap++;}})})}).observe(document.getElementById('fxLayer'),{childList:true});});""")
    for gi in range(games):
        np_ = 2 + gi % 3
        rnd = random.Random(1000+gi)
        pg.goto(base + 'index.html?x=1' + ('&fast=1' if fast else '') + '&seed=%d' % (50+gi)); pg.wait_for_timeout(200)
        s = play_game(pg, np_, touch, rnd)
        ok = (not s['board_errors']) and s['game']['completed']<=12 and s['game']['reason'] in ('All 12 cubes are built!','Last lap finished!') and s['end_wins']==len(s['game']['winners']) and sum(s['end_totals'])==s['game']['completed']
        tt = pg.evaluate('window.__toasts'); ok = ok and tt['cube']==s['game']['completed']
        print('toasts', tt, end=' ')
        print(eng, W, H, 'game', gi, 'np', np_, 'turns', s['game']['turnNo'], 'ended', s['game']['reason'], 'built', s['game']['completed'], 'steals', s['steals'], 'cancels', s['cancels'], 'rerolls', s['rerolls'], 'winners', s['game']['winners'], 'cubes', s['game']['cubes'], 'OK' if ok else 'FAIL', s['board_errors'][:2])
    print('console problems:', errs[:5], len(errs))
    b.close()
