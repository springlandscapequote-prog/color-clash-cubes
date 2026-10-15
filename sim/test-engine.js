'use strict';
// Engine invariants: run thousands of random games under the FINAL and ORIGINAL rules and check the rules never break.
var C = require('../js/game.js'), B = require('./bots.js'), S = require('./sim.js');
var bad = 0, games = 0, turns = 0;
function check(s, tag) {
  var sum = 0, c, p;
  for (c = 0; c < 6; c++) { if (s.pool[c] < 0) fail('neg pool'); sum += s.pool[c]; for (p = 0; p < s.np; p++) { if (s.piles[p][c] < 0 || s.piles[p][c] >= 6) fail('pile out of range ' + s.piles[p][c]); sum += s.piles[p][c] + 6 * s.cubes[p][c]; } }
  if (sum !== 72) fail('pieces not conserved ' + sum);
  function fail(m) { bad++; if (bad < 10) console.log('FAIL', tag, m); }
}
[C.FINAL, C.ORIGINAL].forEach(function (rules) {
  [2, 3, 4].forEach(function (np) {
    var rng = S.mulberry32(99 + np);
    for (var g = 0; g < 1500; g++) {
      var s = C.newGame(np, rules, rng); B._seed(rng);
      var names = ['random', 'greedy', 'aggro', 'hoard', 'smart'];
      var strat = []; for (var i = 0; i < np; i++) strat.push(names[Math.floor(rng() * names.length)]);
      var guard = 0;
      while (!s.over && guard++ < 3000) {
        C.startTurn(s, rng);
        for (;;) {
          var acts = C.legalActions(s);
          if (!acts.length) { bad++; console.log('no actions'); break; }
          var a = B[strat[s.cur]](s, acts, rng);
          if (a.type === 'move') { // must be one of the legal moves and respect the rules
            var tot = C.movePieces(a); if (tot > a.n || tot < 0) { bad++; console.log('took more than die'); }
            a.steals.forEach(function (st) { if (st[0] === s.cur) { bad++; console.log('self steal'); } if (st[1] > s.piles[st[0]][a.color]) { bad++; console.log('steal more than victim has'); } });
            if (a.take > s.pool[a.color]) { bad++; console.log('take more than pool'); }
          }
          C.apply(s, a, rng); turns++;
          if (a.type === 'reroll') continue; break;
        }
        check(s, rules.name + ' ' + np + 'p');
        C.endTurn(s);
      }
      games++;
      if (!s.over) { bad++; console.log('game did not end', rules.name, np); }
      if (s.over && s.reason === 'All 12 cubes are built!' && s.completed !== 12) { bad++; console.log('end mismatch'); }
      if (rules.name === 'final' && s.reason !== 'All 12 cubes are built!' && s.reason !== 'Last lap finished!') { console.log(np + 'p', strat.join(','), 'pool', s.pool.join(','), 'piles', JSON.stringify(s.piles), 'cubes', JSON.stringify(s.cubes), 'turn', s.turnNo); bad++; console.log('final rules ended for another reason: ' + s.reason); }
      if (s.winners.length < 1) { bad++; console.log('no winner'); }
    }
  });
});
console.log('engine test: ' + games + ' games, ' + turns + ' actions, problems: ' + bad);
process.exit(bad ? 1 : 0);
