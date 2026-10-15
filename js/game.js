/* Color Clash Cubes - pure game logic (no DOM). Shared by the app and the simulator.
   ES5 on purpose so it runs on old Safari. Works as a <script> (global CCC) or in node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.CCC = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COLORS = [
    { id: 'yellow', name: 'Yellow', hex: '#FFC400', dark: '#B38600' },
    { id: 'teal',   name: 'Teal',   hex: '#14B8A6', dark: '#0B7A6D' },
    { id: 'lilac',  name: 'Lilac',  hex: '#B794F4', dark: '#7C55C9' },
    { id: 'burgundy', name: 'Burgundy', hex: '#9B1B4B', dark: '#650F30' },
    { id: 'blue',   name: 'Blue',   hex: '#2F80ED', dark: '#1B55AA' },
    { id: 'red',    name: 'Red',    hex: '#E53935', dark: '#A31F1C' }
  ];
  var NC = 6, PER_COLOR = 12, CUBE = 6, TOTAL_CUBES = 12;

  /* ---- rule sets. ORIGINAL = Gabriela's rules as written (with documented interpretations). ---- */
  var ORIGINAL = {
    name: 'original',
    dice: 'single',        // 'single' = 1 number die + 1 color cube | 'pair' = roll 2+2, use ONE pair | 'mix' = roll 2+2, use any number with any color
    rerolls: 0,            // re-rolls allowed per turn (re-roll both)
    steal: 'empty',        // 'empty' = steal only to top up when pool is short (original) | 'anytime' = may steal instead of taking from pool
    stealCap: 6,           // max pieces per steal
    takeUpTo: false,       // may take fewer than the die says
    bonus: 'none',         // 'none' | 'exact' (roll again after an exact finish) | 'any' (roll again after any cube)
    tiebreak: 'none',      // 'none' | 'rainbow' (most different colors of cubes) | 'full' (rainbow, then most loose pieces, then whoever built the last cube)
    stealOptional: true,   // original says "may"
    lastLap: false,        // when the last piece leaves the pool, everyone else gets ONE more turn, then the game ends
    noStealFirstRound: false, // nobody may steal during the very first round (everyone gets one turn to build a pile first)
    lateSeatBonus: 0,      // players who are not first get this many extra re-rolls on their very first turn
    skipDead: false,       // if the color cube shows a color with nothing to take or steal, it is re-rolled automatically
    catchup: 0,            // 0 = off | k: a player trailing the leader by k+ cubes gets one extra re-roll
    maxTurns: 400          // safety stop
  };
  function mk(over) { var r = {}, k; for (k in ORIGINAL) r[k] = ORIGINAL[k]; for (k in over) r[k] = over[k]; return r; }

  /* the shipped rules (chosen with the simulator, see sim/RESULTS.md) */
  var FINAL = mk({
    name: 'final',
    dice: 'single',          // still ONE number die + ONE color cube, like Gabriela's rules
    steal: 'anytime',        // NEW: Take OR Steal, every turn (not only when the pool is empty)
    stealOptional: false,    // NEW: you must do something if you can (no declining), so games never stall
    skipDead: true,          // NEW: a color that is all built is skipped (cube re-rolls) - no wasted rolls
    catchup: 1,              // NEW: Underdog re-roll when someone has more safe cubes than you
    tiebreak: 'full',        // NEW: tie -> most colors of cubes -> most loose pieces -> whoever built the last cube
    lastLap: true            // NEW: when the last piece leaves the pool, everyone else gets one more turn, then the game ends
  });

  function rngDefault() { return Math.random(); }
  function die(rng) { return 1 + Math.floor(rng() * 6); }
  function colr(rng) { return Math.floor(rng() * NC); }
  /* colors the player could actually take or steal this turn */
  function liveColors(s, p) {
    var out = [], c, v;
    for (c = 0; c < NC; c++) {
      var ok = s.pool[c] > 0;
      for (v = 0; v < s.np && !ok; v++) if ((v !== p || s.rules.liveIncludesOwn) && s.piles[v][c] > 0) ok = true;
      if (ok) out.push(c);
    }
    return out;
  }

  function zeros(n) { var a = [], i; for (i = 0; i < n; i++) a.push(0); return a; }
  function newGame(np, rules, rng) {
    var s = { rules: rules || FINAL, np: np, pool: [], piles: [], cubes: [], cur: 0, turnNo: 0,
      roll: null, rerollsLeft: 0, completed: 0, over: false, winners: [], reason: '',
      idle: 0, log: [], bonusPending: false, lastEvent: null, startedBy: 0 };
    var i;
    for (i = 0; i < NC; i++) s.pool.push(PER_COLOR);
    for (i = 0; i < np; i++) { s.piles.push(zeros(NC)); s.cubes.push(zeros(NC)); }
    return s;
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  /* roll the dice for the current player */
  function rollDice(s, rng) {
    rng = rng || rngDefault;
    var r = s.rules, two = (r.dice !== 'single');
    var live = r.skipDead ? liveColors(s, s.cur) : null;
    function pickColor() { return live ? (live.length ? live[Math.floor(rng() * live.length)] : colr(rng)) : colr(rng); }
    s.roll = { nums: [die(rng)], cols: [pickColor()] };
    if (two) { s.roll.nums.push(die(rng)); s.roll.cols.push(pickColor()); }
    return s.roll;
  }
  function startTurn(s, rng) {
    s.rerollsLeft = s.rules.rerolls + (isBehind(s, s.cur) ? 1 : 0) + ((s.turnNo < s.np && s.cur > 0) ? s.rules.lateSeatBonus : 0);
    s.turnNo++;
    rollDice(s, rng);
    return s.roll;
  }

  function isBehind(s, p) {
    var k = s.rules.catchup; if (!k) return false;
    var mine = cubesTotal(s, p), mx = 0, q;
    for (q = 0; q < s.np; q++) { var c = cubesTotal(s, q); if (c > mx) mx = c; }
    return mx - mine >= k;
  }
  function unsafeTotal(s, p) { var t = 0, c; for (c = 0; c < NC; c++) t += s.piles[p][c]; return t; }
  function cubesTotal(s, p) { var t = 0, c; for (c = 0; c < NC; c++) t += s.cubes[p][c]; return t; }
  function rainbow(s, p) { var t = 0, c; for (c = 0; c < NC; c++) if (s.cubes[p][c] > 0) t++; return t; }

  /* every (number,color) pair the player may use this turn */
  function pairs(s) {
    var r = s.rules, ro = s.roll, out = [], i, j;
    if (r.dice === 'single') out.push({ n: ro.nums[0], c: ro.cols[0] });
    else if (r.dice === 'pair') { for (i = 0; i < 2; i++) out.push({ n: ro.nums[i], c: ro.cols[i] }); }
    else { for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) out.push({ n: ro.nums[i], c: ro.cols[j] }); }
    // dedupe
    var seen = {}, d = [];
    for (i = 0; i < out.length; i++) { var k = out[i].n + '-' + out[i].c; if (!seen[k]) { seen[k] = 1; d.push(out[i]); } }
    return d;
  }

  /* all legal actions. action = {type:'move', n, color, take, steals:[[victim,k]]} | {type:'reroll'} | {type:'pass'} */
  function legalActions(s) {
    var noSteal = s.rules.noStealFirstRound && s.turnNo <= s.np;
    var r = s.rules, p = s.cur, acts = [], ps = pairs(s), i, v, c, n, x, k, maxTake, kmax;
    for (i = 0; i < ps.length; i++) {
      n = ps[i].n; c = ps[i].c;
      var poolAvail = s.pool[c];
      var xmax = Math.min(n, poolAvail);
      var xs = [];
      if (xmax > 0) {
        if (r.takeUpTo) { for (x = 1; x <= xmax; x++) xs.push(x); } else xs.push(xmax);
      }
      var j, xi;
      for (xi = 0; xi < xs.length; xi++) {
        x = xs[xi];
        acts.push({ type: 'move', n: n, color: c, take: x, steals: [] });
        var rest = n - x;
        // top-up steal when the pool is short (also original rule)
        if (x === xmax && rest > 0 && xmax < n) {
          for (v = 0; v < s.np; v++) {
            if (noSteal || v === p || s.piles[v][c] <= 0) continue;
            kmax = Math.min(rest, s.piles[v][c], r.stealCap);
            acts.push({ type: 'move', n: n, color: c, take: x, steals: [[v, kmax]] });
          }
        }
      }
      if (xmax === 0) {
        for (v = 0; v < s.np; v++) {
          if (noSteal || v === p || s.piles[v][c] <= 0) continue;
          kmax = Math.min(n, s.piles[v][c], r.stealCap);
          acts.push({ type: 'move', n: n, color: c, take: 0, steals: [[v, kmax]] });
        }
      } else if (r.steal === 'anytime') {
        for (v = 0; v < s.np; v++) {
          if (noSteal || v === p || s.piles[v][c] <= 0) continue;
          kmax = Math.min(n, s.piles[v][c], r.stealCap);
          acts.push({ type: 'move', n: n, color: c, take: 0, steals: [[v, kmax]] });
        }
      }
    }
    if (s.rerollsLeft > 0) acts.push({ type: 'reroll' });
    var hasMove = false, hasTake = false;
    for (i = 0; i < acts.length; i++) if (acts[i].type === 'move') { hasMove = true; if (acts[i].take > 0) hasTake = true; }
    // nothing to do -> pass. Original says stealing is a "may": if the only moves are steals, you may decline (pass).
    if (!hasMove || (!hasTake && r.stealOptional)) acts.push({ type: 'pass' });
    return acts;
  }

  function movePieces(a) { var t = a.take, i; for (i = 0; i < a.steals.length; i++) t += a.steals[i][1]; return t; }

  /* apply an action. returns an event describing what happened (for animations). */
  function apply(s, a, rng) {
    var p = s.cur, ev = { type: a.type, player: p, color: a.color, n: a.n, take: 0, stolen: [], cubes: 0, exact: false,
      before: 0, after: 0, extraTurn: false, wasted: 0 };
    if (a.type === 'reroll') {
      s.rerollsLeft--; rollDice(s, rng); ev.roll = s.roll; s.lastEvent = ev; return ev;
    }
    if (a.type === 'pass') {
      s.idle++; ev.pass = true;
    } else {
      var c = a.color, i, k, v, total = 0;
      ev.before = s.piles[p][c];
      s.pool[c] -= a.take; s.piles[p][c] += a.take; total += a.take; ev.take = a.take;
      for (i = 0; i < a.steals.length; i++) {
        v = a.steals[i][0]; k = a.steals[i][1];
        s.piles[v][c] -= k; s.piles[p][c] += k; total += k; ev.stolen.push({ from: v, k: k });
      }
      ev.total = total;
      if (ev.before + total === CUBE) ev.exact = true;
      while (s.piles[p][c] >= CUBE) {
        s.piles[p][c] -= CUBE; s.cubes[p][c]++; s.completed++; ev.cubes++; s.lastCubeBy = p;
      }
      ev.after = s.piles[p][c];
      ev.overshoot = (a.n > total) ? 0 : 0;
      ev.short = a.n - total;          // die value not used (pool short / steal short)
      s.idle = total > 0 ? 0 : s.idle + 1;
      ev.stealUsed = a.steals.length > 0;
    }
    s.lastEvent = ev;
    // bonus roll?
    var rr = s.rules;
    if (a.type === 'move' && ((rr.bonus === 'exact' && ev.exact) || (rr.bonus === 'any' && ev.cubes > 0)) && s.completed < TOTAL_CUBES) {
      ev.extraTurn = true;
    }
    return ev;
  }

  /* strict "no legal moves remain": nobody could take or steal anything of any color */
  function anyMoveExists(s) {
    var c, v, w;
    for (c = 0; c < NC; c++) {
      if (s.pool[c] > 0) return true;
      var holders = 0;
      for (v = 0; v < s.np; v++) if (s.piles[v][c] > 0) holders++;
      if (holders >= 2) return true;
      if (holders === 1 && s.np >= 2) return true; // someone else can steal from the single holder
    }
    return false;
  }

  /* finish the turn: check the end, then hand over to the next player. */
  function poolEmpty(s) { var c; for (c = 0; c < NC; c++) if (s.pool[c] > 0) return false; return true; }
  function endTurn(s) {
    if (s.completed >= TOTAL_CUBES) return finish(s, 'All 12 cubes are built!');
    if (s.rules.lastLap) {
      if (s.lastLapLeft === undefined && poolEmpty(s)) { s.lastLapLeft = s.np - 1; s.lastLapStarter = s.cur; }   // started now: everybody else gets one more turn
      else if (s.lastLapLeft !== undefined) { s.lastLapLeft--; if (s.lastLapLeft <= 0) return finish(s, 'Last lap finished!'); }
    }
    if (!anyMoveExists(s)) return finish(s, 'No moves left.');
    if (s.turnNo >= s.rules.maxTurns) return finish(s, 'Turn limit.');
    if (s.lastEvent && s.lastEvent.extraTurn) { s.bonusPending = true; return s; }
    s.bonusPending = false;
    s.cur = (s.cur + 1) % s.np;
    return s;
  }

  function scores(s) {
    var out = [], p;
    for (p = 0; p < s.np; p++) out.push({ p: p, cubes: cubesTotal(s, p), rainbow: rainbow(s, p), unsafe: unsafeTotal(s, p) });
    return out;
  }
  function finish(s, why) {
    s.over = true; s.reason = why;
    var sc = scores(s), best = -1, i;
    for (i = 0; i < sc.length; i++) if (sc[i].cubes > best) best = sc[i].cubes;
    var w = [];
    for (i = 0; i < sc.length; i++) if (sc[i].cubes === best) w.push(i);
    if (w.length > 1 && (s.rules.tiebreak === 'rainbow' || s.rules.tiebreak === 'full')) {
      var bb = -1, w2 = [];
      for (i = 0; i < w.length; i++) if (sc[w[i]].rainbow > bb) bb = sc[w[i]].rainbow;
      for (i = 0; i < w.length; i++) if (sc[w[i]].rainbow === bb) w2.push(w[i]);
      w = w2; s.tiebreakUsed = true;
      if (w.length > 1 && s.rules.tiebreak === 'full') {      // 3rd tie-break: most loose pieces still on the table
        var bl = -1, w3 = [];
        for (i = 0; i < w.length; i++) if (sc[w[i]].unsafe > bl) bl = sc[w[i]].unsafe;
        for (i = 0; i < w.length; i++) if (sc[w[i]].unsafe === bl) w3.push(w[i]);
        if (w3.length < w.length) s.tiebreakLoose = true;
        w = w3;
      }
      if (w.length > 1 && s.rules.tiebreak === 'full' && w.indexOf(s.lastCubeBy) >= 0) { w = [s.lastCubeBy]; s.tiebreakLast = true; }
    }
    s.winners = w;
    return s;
  }

  /* convenience for bots/tests: play one full turn using a chooser(state, actions) -> action */
  function playTurn(s, chooser, rng) {
    do {
      startTurn(s, rng);
      var guard = 0;
      for (;;) {
        var acts = legalActions(s);
        var a = chooser(s, acts, rng);
        var ev = apply(s, a, rng);
        if (a.type === 'reroll') { if (++guard > 5) break; continue; }
        break;
      }
      endTurn(s);
    } while (s.bonusPending && !s.over);
    return s;
  }

  return { COLORS: COLORS, NC: NC, CUBE: CUBE, PER_COLOR: PER_COLOR, TOTAL_CUBES: TOTAL_CUBES,
    ORIGINAL: ORIGINAL, FINAL: FINAL, mk: mk, newGame: newGame, clone: clone, startTurn: startTurn, rollDice: rollDice,
    legalActions: legalActions, apply: apply, endTurn: endTurn, playTurn: playTurn, scores: scores,
    unsafeTotal: unsafeTotal, cubesTotal: cubesTotal, rainbow: rainbow, movePieces: movePieces, pairs: pairs,
    anyMoveExists: anyMoveExists, poolEmpty: poolEmpty, liveColors: liveColors, isBehind: isBehind };
});
