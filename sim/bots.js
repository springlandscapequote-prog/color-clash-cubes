'use strict';
var C = require('../js/game.js');
function v(k) { return k * k * 0.5; }
function evalMove(s, a) {            // heuristic value of a move for the current player
  var p = s.cur, c = a.color, total = C.movePieces(a), before = s.piles[p][c];
  var cubes = Math.floor((before + total) / 6), after = (before + total) % 6;
  var vul = (s.pool[c] - a.take) > 0 ? 1 : 0.6;
  var val = 100 * cubes + v(after) * vul - v(before) * vul;
  var stolen = 0, opp = 0, i;
  for (i = 0; i < a.steals.length; i++) { var vp = s.piles[a.steals[i][0]][c], k = a.steals[i][1]; opp += (v(vp) - v(vp - k)); stolen += k; }
  return { val: val, opp: opp, total: total, cubes: cubes, stolen: stolen, exact: before + total === 6, after: after };
}
var RNG = Math.random;
function pick(arr, f) {   // best by f; ties broken at random (avoids a seat-order artifact)
  var best = [], bv = -1e9, i;
  for (i = 0; i < arr.length; i++) { var x = f(arr[i]); if (x > bv + 1e-9) { bv = x; best = [arr[i]]; } else if (Math.abs(x - bv) <= 1e-9) best.push(arr[i]); }
  return best[Math.floor(RNG() * best.length)];
}
function moves(acts) { var m = [], i; for (i = 0; i < acts.length; i++) if (acts[i].type === 'move') m.push(acts[i]); return m; }
function rerollAct(acts) { var i; for (i = 0; i < acts.length; i++) if (acts[i].type === 'reroll') return acts[i]; return null; }
function passAct(acts) { var i; for (i = 0; i < acts.length; i++) if (acts[i].type === 'pass') return acts[i]; return null; }

var BOTS = {
  _seed: function (r) { RNG = r; },
  random: function (s, acts, rng) {
    var m = moves(acts), pa = passAct(acts), rr = rerollAct(acts);
    if (rr && rng() < 0.3) return rr;
    var pool = m.slice(); if (pa) pool.push(pa);
    return pool[Math.floor(rng() * pool.length)];
  },
  greedy: function (s, acts, rng) {
    var m = moves(acts), rr = rerollAct(acts), pa = passAct(acts);
    if (!m.length) return pa;
    var b = pick(m, function (a) { var e = evalMove(s, a); return 100 * e.cubes + e.total + (e.exact ? 1 : 0); });
    var e = evalMove(s, b);
    if (rr && e.cubes === 0 && e.total < 4) return rr;
    return b;
  },
  aggro: function (s, acts, rng) {
    var m = moves(acts), rr = rerollAct(acts), pa = passAct(acts);
    if (!m.length) return pa;
    var b = pick(m, function (a) { var e = evalMove(s, a); return 100 * e.cubes + e.total + 3 * e.stolen + 2 * e.opp; });
    var e = evalMove(s, b);
    if (rr && e.stolen === 0 && e.cubes === 0 && e.total < 4) return rr;
    return b;
  },
  hoard: function (s, acts, rng) {      // never steals unless it finishes a cube; focuses on its biggest pile
    var m = moves(acts), rr = rerollAct(acts), pa = passAct(acts);
    if (!m.length) return pa;
    var ok = []; var i;
    for (i = 0; i < m.length; i++) { var e = evalMove(s, m[i]); if (m[i].steals.length === 0 || e.cubes > 0) ok.push(m[i]); }
    if (!ok.length) return pa || m[0];
    var b = pick(ok, function (a) { var e = evalMove(s, a); return 100 * e.cubes + e.after * e.after + 0.1 * e.total; });
    if (rr && evalMove(s, b).total < 2) return rr;
    return b;
  },
  smart: function (s, acts, rng) {
    var m = moves(acts), rr = rerollAct(acts), pa = passAct(acts);
    if (!m.length) return pa;
    var b = pick(m, function (a) { var e = evalMove(s, a); return e.val + 0.7 * e.opp + 0.2 * e.total; });
    var e = evalMove(s, b);
    if (rr && e.cubes === 0 && e.val + 0.7 * e.opp < 6) return rr;
    // original rules: declining a pointless steal is fine
    if (pa && e.val + 0.7 * e.opp <= 0) return pa;
    return b;
  }
};
module.exports = BOTS;
