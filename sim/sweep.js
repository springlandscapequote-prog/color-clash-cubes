'use strict';
var C = require('../js/game.js'), S = require('./sim.js');
function f(x, d) { return x === null || x === undefined || isNaN(x) ? '-' : x.toFixed(d === undefined ? 1 : d); }
var F0 = { skipDead: true, stealOptional: false, steal: 'anytime', tiebreak: 'full', catchup: 1 };
function F(o) { var r = {}, k; for (k in F0) r[k] = F0[k]; for (k in o) r[k] = o[k]; return r; }
var V = {
  '0 ORIGINAL (as written)': {},
  'single tweaks on the original:': null,
  'must-act (no declining a steal)': { stealOptional: false },
  'skip finished colors (re-roll cube)': { skipDead: true },
  'take-or-steal any time': { steal: 'anytime' },
  'tie-break (colors > loose > last cube)': { tiebreak: 'full' },
  'underdog re-roll': { catchup: 1 },
  'last lap when pool is empty': { lastLap: true },
  'every player 1 re-roll/turn': { rerolls: 1 },
  'roll 2+2, use one pair': { dice: 'pair' },
  'roll 2+2, mix any number+color': { dice: 'mix' },
  'may take fewer than the die': { takeUpTo: true },
  'roll again after exact cube': { bonus: 'exact' },
  'steal cap 3': { steal: 'anytime', stealCap: 3 },
  'combos:': null,
  'skip + must-act': { skipDead: true, stealOptional: false },
  'skip + must-act + anytime-steal': { skipDead: true, stealOptional: false, steal: 'anytime' },
  'FINAL without last lap': F({}),
  'FINAL (+ last lap)': F({ lastLap: true }),
  'FINAL without underdog': F({ lastLap: true, catchup: 0 }),
  'FINAL but roll 2+2 pick pair': F({ lastLap: true, dice: 'pair' }),
  'FINAL + every player 1 re-roll': F({ lastLap: true, rerolls: 1 }),
  'FINAL + steal cap 4': F({ lastLap: true, stealCap: 4 }),
  'FINAL + roll-again on exact cube': F({ lastLap: true, bonus: 'exact' })
};
var only = process.argv[3] ? process.argv[3].split('|') : Object.keys(V), N = +(process.argv[2] || 1500);
var nps = (process.argv[4] || '3').split(',').map(Number);
nps.forEach(function (np) {
  console.log('--- ' + np + ' players, N=' + N + ' (smart mirror unless noted)');
  only.forEach(function (k) {
    if (V[k] === null) { console.log('  ' + k); return; }
    var rules = C.mk(V[k]), i, sm = [], rn = [];
    for (i = 0; i < np; i++) { sm.push('smart'); rn.push('random'); }
    var A = S.agg(np, rules, sm, N, 7 * np, false);
    var sr = S.skill(np, rules, N, 5 * np, 'smart', 'random');
    var hm = []; for (i = 0; i < np; i++) hm.push('hoard');
    var H = S.agg(np, rules, hm, Math.min(N, 500), 3 * np, false);
    var Mx = S.agg(np, rules, ['smart', 'greedy', 'aggro', 'hoard'].slice(0, np).concat(['random']).slice(0, np), N, 9 * np, true);
    console.log(k.padEnd(40) + 't/p ' + f(A.turnsPerPlayer) + ' dead ' + f(A.passPct, 0) + '% dec ' + f(A.decisionPct, 0) + '% opts ' + f(A.optsPerTurn) + ' tie ' + f(A.tiePct, 0) + '% seat ' + A.seatWin.map(function (x) { return f(x, 0); }).join('/') +
      ' steals ' + f(A.stealPerGame, 1) + ' lead50 ' + f(A.leaderWon50, 0) + '% cb ' + f(A.comeback70, 0) + '% maxLead ' + f(A.maxLead) + ' | smart>rand ' + f(sr, 0) + '% (fair ' + f(100 / np, 0) + ') | stall hoard-mirror ' + f(H.stallPct, 0) + '% mixed ' + f(Mx.stallPct, 1) + '% p90 ' + A.turnsP90 / np);
  });
});
