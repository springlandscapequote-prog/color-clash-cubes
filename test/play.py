import sys, time, random, json
from playwright.sync_api import sync_playwright

def phase(pg): return pg.evaluate("window.__ccc && window.__ccc.state().phase")

def board_ok(pg):
    """DOM scoreboard == game state? returns (ok, msg)"""
    return pg.evaluate("""()=>{
      var g=window.__ccc.game(); var S=window.__ccc.state(); if(!g) return [true,''];
      var rows=document.querySelectorAll('#board .brow'); var pool=rows[0].querySelectorAll('.cell');
      var v=S.view, msg=[];
      for(var c=0;c<6;c++){ if(parseInt(pool[c].textContent,10)!==g.pool[c]) msg.push('pool'+c+' dom '+pool[c].textContent+' state '+g.pool[c]); }
      for(var p=0;p<g.np;p++){ var cells=rows[p+1].querySelectorAll('.cell'); var tot=0;
        for(var c=0;c<6;c++){ var n=parseInt(cells[c].querySelector('.n').textContent,10); var lk=cells[c].querySelector('.lock').textContent; var k=lk?parseInt(lk.replace(/\\D/g,''),10):0;
          tot+=k; if(n!==g.piles[p][c]) msg.push('p'+p+'c'+c+' piles dom '+n+' state '+g.piles[p][c]); if(k!==g.cubes[p][c]) msg.push('p'+p+'c'+c+' cubes dom '+k+' state '+g.cubes[p][c]); }
        var sc=rows[p+1].querySelector('.score').textContent.replace(/\\D/g,''); if(parseInt(sc,10)!==tot) msg.push('score p'+p+' '+sc+' vs '+tot);
      }
      var sum=0; for(var c=0;c<6;c++){ sum+=g.pool[c]; for(var p=0;p<g.np;p++){ sum+=g.piles[p][c]+6*g.cubes[p][c]; } }
      if(sum!==72) msg.push('conservation '+sum);
      return [msg.length===0, msg.join('; ')];
    }""")

def play_game(pg, np, touch, rnd, log=None, max_steps=3000, shots=None, steal_bias=0.5, check=True, on_step=None, skip_setup=False):
    """Drive the UI from title to end screen. Returns stats dict."""
    tap = (lambda sel: pg.tap(sel)) if touch else (lambda sel: pg.click(sel))
    stats = dict(turns=0, steals=0, cubes=0, cancels=0, rerolls=0, board_errors=[], seen_choose=0)
    if not skip_setup:
        tap('#btn-play'); pg.wait_for_timeout(100)
        tap('.count-btn[data-n="%d"]' % np); tap('#btn-start')
    steps = 0; last_phase = None; stuck_since = time.time(); lastsig = None
    while True:
        steps += 1
        if steps > max_steps: raise RuntimeError('too many steps')
        ph = phase(pg)
        sig = (ph, pg.evaluate("(window.__ccc.game()||{}).turnNo"), pg.evaluate("document.querySelectorAll('.choice').length"), pg.evaluate("document.getElementById('overlay-confirm').className"))
        if sig != lastsig: lastsig = sig; stuck_since = time.time()
        if time.time() - stuck_since > int(__import__("os").environ.get("STUCKS","20")): 
            if shots: pg.screenshot(path=shots+'_stuck.png')
            raise RuntimeError('STUCK in phase %s sig %s' % (ph, sig))
        if on_step: on_step(pg, {'ph': ph})
        if ph == 'end': break
        if pg.evaluate("document.getElementById('overlay-confirm').className.indexOf('show')>=0"):
            if rnd.random() < 0.2 and stats['cancels'] < 3:
                tap('#btn-confirm-no'); stats['cancels'] += 1
            else:
                tap('#btn-confirm-yes')
            pg.wait_for_timeout(50); continue
        if ph == 'pass':
            if check:
                ok, msg = board_ok(pg)
                if not ok: stats['board_errors'].append(msg)
            tap('#btn-pass-ok'); stats['turns'] += 1
        elif ph == 'roll':
            tap('#btn-roll')
        elif ph == 'choose':
            stats['seen_choose'] += 1
            if check:
                ok, msg = board_ok(pg)
                if not ok: stats['board_errors'].append(msg)
            n = pg.evaluate("document.querySelectorAll('.choice').length")
            rr = pg.evaluate("!!document.getElementById('btn-reroll')")
            if rr and rnd.random() < 0.3:
                tap('#btn-reroll'); stats['rerolls'] += 1; pg.wait_for_timeout(100); continue
            kinds = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('.choice'),function(e){return e.getAttribute('data-kind')})")
            idxs = list(range(len(kinds)))
            steal_idx = [i for i in idxs if kinds[i] in ('steal','combo')]
            if steal_idx and rnd.random() < steal_bias: i = rnd.choice(steal_idx)
            else: i = rnd.choice(idxs)
            if kinds[i] in ('steal','combo'): stats['steals'] += 1
            pg.evaluate("i=>{var e=document.querySelectorAll('.choice')[i]; e.setAttribute('data-pick','1')}", i)
            tap('.choice[data-pick="1"]')
        else:
            pg.wait_for_timeout(60)
        pg.wait_for_timeout(15)
    g = pg.evaluate("(function(){var g=window.__ccc.game();return {winners:g.winners,cubes:g.cubes.map(function(r){return r.reduce(function(a,b){return a+b},0)}),completed:g.completed,reason:g.reason,turnNo:g.turnNo}})()")
    stats['game'] = g
    # end-screen sanity
    rows = pg.evaluate("document.querySelectorAll('#standings .srow').length")
    wins = pg.evaluate("document.querySelectorAll('#standings .srow.win').length")
    stats['end_rows'] = rows; stats['end_wins'] = wins
    stats['end_title'] = pg.evaluate("document.getElementById('endTitle').textContent")
    totals = pg.evaluate("Array.prototype.map.call(document.querySelectorAll('#standings .tot'),function(e){return parseInt(e.textContent,10)})")
    stats['end_totals'] = totals
    return stats
