var B = require('./baseline.json'), F = require('./final.json');
function f(x, d) { return x === null || x === undefined || isNaN(x) ? '-' : x.toFixed(d === undefined ? 1 : d); }
var rows = [
  ['Turns per player (avg)', function (o) { return f(o.smart.turnsPerPlayer); }],
  ['Total turns in a game (avg, 10th-90th pct)', function (o) { return f(o.smart.turnsMean, 0) + ' (' + o.smart.turnsP10 + '-' + o.smart.turnsP90 + ')'; }],
  ['Dead rolls (color had nothing to take) %', function (o) { return f(o.smart.passPct, 0); }],
  ['Roll not fully used (pool/steal short) %', function (o) { return f(o.smart.shortPct, 0); }],
  ['Turns with a real choice %', function (o) { return f(o.smart.decisionPct, 0); }],
  ['Ties for the win %', function (o) { return f(o.smart.tiePct, 0); }],
  ['Win rate by seat (1st..last, %)', function (o) { return o.smart.seatWin.map(function (x) { return f(x, 0); }).join('/'); }],
  ['Leader at half-time goes on to win %', function (o) { return f(o.smart.leaderWon50, 0); }],
  ['Winner was 2+ cubes behind at 70% %', function (o) { return f(o.smart.comeback70, 0); }],
  ['Games that never end (all players "hoard") %', function (o) { return f(o.hoardMix.stallPct, 0); }],
  ['Steals per game', function (o) { return f(o.smart.stealPerGame, 0); }],
  ['Smart player vs 100% random players: smart wins %', function (o, np) { return f(o.skillSmartVsRandom, 0) + ' (fair = ' + f(100 / np, 0) + ')'; }]
];
var out = '| Measure | 2p orig | 2p final | 3p orig | 3p final | 4p orig | 4p final |\n|---|---|---|---|---|---|---|\n';
rows.forEach(function (r) {
  out += '| ' + r[0];
  [2, 3, 4].forEach(function (np) { out += ' | ' + r[1](B.np[np], np) + ' | **' + r[1](F.np[np], np) + '**'; });
  out += ' |\n';
});
console.log(out);
