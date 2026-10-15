'use strict';
var C = require('../js/game.js'), S = require('./sim.js');
function f(x, d) { return x === null || x === undefined || isNaN(x) ? '-' : x.toFixed(d === undefined ? 1 : d); }
function report(name, rules, N) {
  N = N || 3000;
  var out = { name: name, rules: rules, np: {} };
  [2, 3, 4].forEach(function (np) {
    var sm = [], rn = [], mixed = [], i;
    for (i = 0; i < np; i++) { sm.push('smart'); rn.push('random'); }
    var A = S.agg(np, rules, sm, N, 11 * np, false);
    var Rn = S.agg(np, rules, rn, N, 13 * np, false);
    // mixed population: every seat a different bot from this list, rotating seats
    var pool = ['smart', 'greedy', 'aggro', 'hoard', 'random'];
    var mx = []; for (i = 0; i < np; i++) mx.push(pool[i % pool.length]);
    var M = S.agg(np, rules, mx, N, 17 * np, true);
    var hoardMix = []; for (i = 0; i < np; i++) hoardMix.push('hoard');
    var H = S.agg(np, rules, hoardMix, N, 19 * np, true);
    var skillSR = S.skill(np, rules, N, 23 * np, 'smart', 'random');
    var skillSG = S.skill(np, rules, N, 29 * np, 'smart', 'greedy');
    out.np[np] = { smart: A, random: Rn, mixed: M, hoardMix: H, skillSmartVsRandom: skillSR, skillSmartVsGreedy: skillSG };
  });
  return out;
}
function row(r) {
  var s = '';
  [2, 3, 4].forEach(function (np) {
    var o = r.np[np], A = o.smart, R = o.random;
    s += np + 'p | turns/player ' + f(A.turnsPerPlayer) + ' (p10-p90 total ' + A.turnsP10 + '-' + A.turnsP90 + ') | dead rolls ' + f(A.passPct, 0) + '% | short ' + f(A.shortPct, 0) + '% | decision turns ' + f(A.decisionPct, 0) + '% | opts/turn ' + f(A.optsPerTurn) +
      ' | tie ' + f(A.tiePct, 0) + '% | seat ' + A.seatWin.map(function (x) { return f(x, 0); }).join('/') + ' | steals/game ' + f(A.stealPerGame) +
      ' | leader@50% wins ' + f(A.leaderWon50, 0) + '% | comeback(-2 @70%) ' + f(A.comeback70, 0) + '% | stall(mixed) ' + f(o.mixed.stallPct, 1) + '% stall(all-hoard) ' + f(o.hoardMix.stallPct, 1) + '% | smart-vs-random ' + f(o.skillSmartVsRandom, 0) + '% (fair ' + f(100 / np, 0) + '%), vs greedy ' + f(o.skillSmartVsGreedy, 0) + '%' +
      ' | random-mirror seat ' + R.seatWin.map(function (x) { return f(x, 0); }).join('/') + ' turns/p ' + f(R.turnsPerPlayer) + '\n';
  });
  return s;
}
module.exports = { report: report, row: row };
if (require.main === module) {
  var which = process.argv[2], N = +(process.argv[3] || 2000);
  var rules = which === 'original' ? C.ORIGINAL : which === 'final' ? C.FINAL : C.mk(JSON.parse(which));
  var r = report(which, rules, N);
  console.log(row(r));
  if (process.argv[4]) require('fs').writeFileSync(process.argv[4], JSON.stringify(r, null, 1));
}
