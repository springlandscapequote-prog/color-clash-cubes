'use strict';
var C = require('../js/game.js');
var BOTS = require('./bots.js');
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function runGame(np, rules, strat, rng) {
  var s = C.newGame(np, rules, rng); BOTS._seed(rng);
  var st = { decisions: 0, turns: 0, passes: 0, useless: 0, short: 0, surplus: 0, steals: 0, stealTurns: 0, optsSum: 0,
    cubeSnap: [], lead: 0 };
  var snaps = [];
  var guardTurn = 0;
  while (!s.over && guardTurn++ < 5000) {
    var p = s.cur, rolls = 0;
    C.startTurn(s, rng);
    for (;;) {
      var acts = C.legalActions(s), m = acts.filter(function (a) { return a.type === 'move'; });
      var a = BOTS[strat[p]](s, acts, rng);
      if (a.type !== 'reroll') {
        st.turns++; st.optsSum += m.length;
        // distinct outcomes
        var keys = {}; m.forEach(function (x) { keys[x.color + ':' + x.take + ':' + x.steals.map(function (z) { return z.join('/'); }).join(',')] = 1; });
        if (Object.keys(keys).length > 1) st.decisions++;
        var before = s.piles[p][a.color];
        var ev = C.apply(s, a, rng);
        if (a.type === 'pass' || ev.total === 0) { st.passes++; }
        else {
          if (ev.total < a.n) st.short++;
          if (ev.before + ev.total > 6 && ev.before + ev.total - 6 * ev.cubes > 0 && ev.cubes > 0) st.surplus++;
          if (ev.stealUsed) { st.steals++; }
        }
        break;
      }
      C.apply(s, a, rng); if (++rolls > 6) break;
    }
    C.endTurn(s);
    var cs = []; for (var q = 0; q < np; q++) cs.push(C.cubesTotal(s, q)); snaps.push(cs);
  }
  var sc = C.scores(s);
  var top = Math.max.apply(null, sc.map(function (x) { return x.cubes; }));
  var rawTie = sc.filter(function (x) { return x.cubes === top; }).length > 1;
  var hitCap = s.reason === 'Turn limit.';
  var N = snaps.length;
  // runaway / comeback at 50% and 70% of the game
  function leaderAt(frac) {
    var cs = snaps[Math.max(0, Math.floor(N * frac) - 1)] || snaps[0];
    var mx = Math.max.apply(null, cs), idx = []; cs.forEach(function (x, i) { if (x === mx) idx.push(i); });
    var mn = Math.min.apply(null, cs);
    return { idx: idx, uniq: idx.length === 1, trailing: cs.map(function (x) { return mx - x; }) };
  }
  var L5 = leaderAt(0.5), L7 = leaderAt(0.7);
  var wset = s.winners;
  var leaderWon50 = L5.uniq ? (wset.indexOf(L5.idx[0]) >= 0 ? 1 / wset.length : 0) : null;
  var comeback70 = null; // winner was trailing by >=2 cubes at 70%
  var cb = 0, wasTrail = false;
  if (L7.uniq) { wset.forEach(function (w) { if (L7.trailing[w] >= 2) wasTrail = true; }); comeback70 = wasTrail ? 1 : 0; }
  var maxLead = 0; snaps.forEach(function (cs) { var srt = cs.slice().sort(function (a, b) { return b - a; }); maxLead = Math.max(maxLead, srt[0] - srt[1]); });
  return { turns: st.turns, np: np, hitCap: hitCap, reason: s.reason, winners: wset, rawTie: rawTie, tie: wset.length > 1, st: st,
    leaderWon50: leaderWon50, comeback70: comeback70, maxLead: maxLead, cubes: sc.map(function (x) { return x.cubes; }),
    unsafeLeft: sc.reduce(function (a, x) { return a + x.unsafe; }, 0), completed: s.completed, tbUsed: !!s.tiebreakUsed };
}

function agg(np, rules, strats, N, seed, seatRot) {
  var rng = mulberry32(seed), R = [], i;
  for (i = 0; i < N; i++) {
    var strat = strats.slice();
    if (seatRot) { var k = i % np; strat = strat.map(function (_, j) { return strats[(j + k) % np]; }); }
    var r = runGame(np, rules, strat, rng); r.strat = strat; R.push(r);
  }
  return summarize(np, R);
}
function summarize(np, R) {
  var n = R.length, o = {};
  function mean(f) { var t = 0, c = 0; R.forEach(function (r) { var x = f(r); if (x !== null && x !== undefined) { t += x; c++; } }); return c ? t / c : null; }
  var turns = R.map(function (r) { return r.turns; }).sort(function (a, b) { return a - b; });
  o.games = n; o.np = np;
  o.turnsMean = mean(function (r) { return r.turns; });
  o.turnsPerPlayer = o.turnsMean / np;
  o.turnsP10 = turns[Math.floor(n * 0.1)]; o.turnsP90 = turns[Math.floor(n * 0.9)];
  o.stallPct = 100 * mean(function (r) { return r.hitCap ? 1 : 0; });
  o.tiePct = 100 * mean(function (r) { return r.tie ? 1 : 0; });
  o.rawTiePct = 100 * mean(function (r) { return r.rawTie ? 1 : 0; });
  o.seatWin = []; for (var p = 0; p < np; p++) o.seatWin.push(100 * mean(function (r) { return r.winners.indexOf(p) >= 0 ? 1 / r.winners.length : 0; }));
  o.decisionPct = 100 * mean(function (r) { return r.st.decisions / r.st.turns; });
  o.optsPerTurn = mean(function (r) { return r.st.optsSum / r.st.turns; });
  o.passPct = 100 * mean(function (r) { return r.st.passes / r.st.turns; });
  o.shortPct = 100 * mean(function (r) { return r.st.short / r.st.turns; });
  o.surplusPct = 100 * mean(function (r) { return r.st.surplus / r.st.turns; });
  o.stealPerGame = mean(function (r) { return r.st.steals; });
  o.leaderWon50 = 100 * mean(function (r) { return r.leaderWon50; });
  o.comeback70 = 100 * mean(function (r) { return r.comeback70; });
  o.maxLead = mean(function (r) { return r.maxLead; });
  o.completed = mean(function (r) { return r.completed; });
  o.unsafeLeft = mean(function (r) { return r.unsafeLeft; });
  return o;
}
function skill(np, rules, N, seed, a, b) { // strategy a in seat-rotated games vs np-1 of strategy b
  var rng = mulberry32(seed), win = 0, i;
  for (i = 0; i < N; i++) {
    var seat = i % np, strat = []; for (var j = 0; j < np; j++) strat.push(j === seat ? a : b);
    var r = runGame(np, rules, strat, rng);
    if (r.winners.indexOf(seat) >= 0) win += 1 / r.winners.length;
  }
  return 100 * win / N;
}
module.exports = { runGame: runGame, agg: agg, skill: skill, mulberry32: mulberry32, summarize: summarize };

if (require.main === module) {
  var which = process.argv[2] || 'original', N = +(process.argv[3] || 3000);
  var rules = which === 'original' ? C.ORIGINAL : which === 'final' ? C.FINAL : C.mk(JSON.parse(which));
  [2, 3, 4].forEach(function (np) {
    var mixes = { random: [], greedy: [], aggro: [], hoard: [], smart: [] };
    Object.keys(mixes).forEach(function (k) {
      var st = []; for (var i = 0; i < np; i++) st.push(k);
      var o = agg(np, rules, st, N, 1000 + np, false);
      console.log(np + 'p ' + k + ': turns/p ' + o.turnsPerPlayer.toFixed(1) + ' total ' + o.turnsMean.toFixed(1) + ' stall% ' + o.stallPct.toFixed(1) + ' tie% ' + o.tiePct.toFixed(1) + ' seat ' + o.seatWin.map(function (x) { return x.toFixed(1); }) + ' dec% ' + o.decisionPct.toFixed(0) + ' pass% ' + o.passPct.toFixed(1));
    });
  });
}
