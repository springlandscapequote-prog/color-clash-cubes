/* Color Clash Cubes - app (pass-and-play UI). ES5 only, no dependencies. Rules live in game.js (shared with the simulator). */
(function () {
  'use strict';
  var C = window.CCC, RULES = C.FINAL, NC = C.NC;
  var COLORS = C.COLORS;
  var AVATARS = ['🦊', '🐱', '🐶', '🐼', '🦄', '🐸', '🐙', '🦁', '🐯', '🐵', '🐰', '🐢'];

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; }
  function on(node, fn) { node.addEventListener('click', function (ev) { ev.preventDefault(); fn(ev); }); }
  function addCls(n, c) { if ((' ' + n.className + ' ').indexOf(' ' + c + ' ') < 0) n.className += (n.className ? ' ' : '') + c; }
  function rmCls(n, c) { n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function hasCls(n, c) { return (' ' + n.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function setT(node, t) { node.style.webkitTransform = t; node.style.transform = t; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function query() { var o = {}, s = (location.search || '').replace(/^\?/, ''), parts = s ? s.split('&') : [], i; for (i = 0; i < parts.length; i++) { var kv = parts[i].split('='); o[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : '1'; } return o; }
  var Q = query();
  var rng = Q.seed ? mulberry32(parseInt(Q.seed, 10) || 1) : Math.random;
  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  if (Q.reduce) reduceMotion = true;
  var speed = Q.fast ? 0.1 : 1;
  if (reduceMotion) { document.body.className += ' reduce'; }
  function T(ms) { return Math.max(0, Math.round(ms * (reduceMotion ? Math.min(speed, 0.3) : speed))); }
  function later(ms, fn) { return setTimeout(fn, ms); }
  var store = { get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} } };

  /* ---------- svg bits ---------- */
  function hashSvg(color, outline) {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      (outline === false ? '' : '<g fill="none" stroke="rgba(0,0,0,.35)" stroke-width="19" stroke-linecap="round" transform="translate(0,5)"><path d="M36 14 L30 86"/><path d="M68 14 L62 86"/><path d="M14 36 L86 32"/><path d="M14 68 L86 64"/></g>') +
      '<g fill="none" stroke="' + color + '" stroke-width="15" stroke-linecap="round"><path d="M36 14 L30 86"/><path d="M68 14 L62 86"/><path d="M14 36 L86 32"/><path d="M14 68 L86 64"/></g></svg>';
  }

  /* ---------- sound (optional, off by default) ---------- */
  var audio = { ctx: null, on: store.get('ccc.sound') === '1' };
  function ac() {
    if (!audio.ctx) { try { var A = window.AudioContext || window.webkitAudioContext; if (A) audio.ctx = new A(); } catch (e) {} }
    if (audio.ctx && audio.ctx.state === 'suspended' && audio.ctx.resume) { try { audio.ctx.resume(); } catch (e2) {} }
    return audio.ctx;
  }
  function beep(freq, dur, type, vol, delay, slideTo) {
    if (!audio.on) return; var c = ac(); if (!c) return;
    try {
      var o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + (delay || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.15, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  var sfx = {
    roll: function () { var i; for (i = 0; i < 7; i++) beep(260 + (i % 3) * 90, 0.07, 'square', 0.07, i * 0.1); },
    take: function (n) { beep(420 + n * 60, 0.12, 'triangle', 0.16); },
    steal: function () { beep(700, 0.35, 'sawtooth', 0.09, 0, 180); },
    cube: function () { var f = [523, 659, 784, 1047], i; for (i = 0; i < f.length; i++) beep(f[i], 0.2, 'triangle', 0.17, i * 0.11); },
    win: function () { var f = [523, 659, 784, 1047, 784, 1047, 1319], i; for (i = 0; i < f.length; i++) beep(f[i], 0.25, 'triangle', 0.17, i * 0.14); },
    click: function () { beep(600, 0.05, 'sine', 0.1); }
  };
  function paintSound() {
    var b = [$('btn-sound'), $('btn-sound-title')], i;
    for (i = 0; i < b.length; i++) { b[i].textContent = audio.on ? '🔊' : '🔇'; b[i].setAttribute('aria-label', audio.on ? 'Sound on. Tap to turn sound off.' : 'Sound off. Tap to turn sound on.'); }
  }
  function toggleSound() { audio.on = !audio.on; store.set('ccc.sound', audio.on ? '1' : '0'); paintSound(); if (audio.on) { ac(); sfx.click(); } }

  /* ---------- state ---------- */
  var S = { np: 2, players: [], game: null, view: null, phase: 'title', busy: false, hl: -1, pendingConfirm: null };
  var refs = { cells: [], pool: [], rows: [], scores: [] };

  /* ---------- screens ---------- */
  function show(id) {
    var ids = ['screen-title', 'screen-setup', 'screen-game', 'screen-end'], i;
    for (i = 0; i < ids.length; i++) { var n = $(ids[i]); if (ids[i] === id) addCls(n, 'active'); else rmCls(n, 'active'); }
    S.phase = id.replace('screen-', '');
    if (window.CCCUpdate) { CCCUpdate.render(); if (id !== 'screen-game') CCCUpdate.check(false); }
  }
  function overlay(id, on_) { var n = $(id); if (on_) addCls(n, 'show'); else rmCls(n, 'show'); }

  /* ---------- title ---------- */
  function buildTitle() {
    var h = document.querySelector('#screen-title .title'), i, k = 0;
    clear(h);
    function word(w, cls) {
      var wrap = el('span', cls || '', null), j;
      for (j = 0; j < w.length; j++) {
        if (w.charAt(j) === ' ') { wrap.appendChild(document.createTextNode(' ')); continue; }
        var s = el('span', 'l', w.charAt(j)); s.style.color = COLORS[k % NC].hex; s.style.webkitAnimationDelay = (-(k * 0.18)) + 's'; s.style.animationDelay = (-(k * 0.18)) + 's'; k++;
        wrap.appendChild(s);
      }
      h.appendChild(wrap);
    }
    word('Color Clash');
    var br = el('span', 'title-cubes-word', null); h.appendChild(br);
    var w2 = 'Cubes', j;
    for (j = 0; j < w2.length; j++) { var s2 = el('span', 'l', w2.charAt(j)); s2.style.color = COLORS[(k + 2) % NC].hex; s2.style.webkitAnimationDelay = (-(k * 0.18)) + 's'; s2.style.animationDelay = (-(k * 0.18)) + 's'; k++; br.appendChild(s2); }
    h.setAttribute('aria-label', 'Color Clash Cubes');
    var tc = $('titleCubes'); clear(tc);
    for (i = 0; i < NC; i++) { var m = el('div', 'mini3d'); m.style.background = COLORS[i].hex; m.style.webkitAnimationDelay = (-(i * 0.3)) + 's'; m.style.animationDelay = (-(i * 0.3)) + 's'; m.innerHTML = hashSvg('#fff', false); tc.appendChild(m); }
  }

  /* ---------- setup ---------- */
  function loadSetup() {
    var raw = store.get('ccc.setup.v1'), d = null;
    try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    var np = 2, pl = [], i;
    if (d && d.n >= 2 && d.n <= 4 && d.p && d.p.length) { np = d.n; }
    for (i = 0; i < 4; i++) {
      var p = d && d.p && d.p[i] ? d.p[i] : null;
      var av = p && AVATARS.indexOf(p.a) >= 0 ? p.a : AVATARS[i];
      var nm = p && typeof p.n === 'string' ? p.n.slice(0, 12) : '';
      pl.push({ name: nm, avatar: av });
    }
    // make avatars unique
    var used = {};
    for (i = 0; i < 4; i++) { if (used[pl[i].avatar]) { var j; for (j = 0; j < AVATARS.length; j++) if (!used[AVATARS[j]]) { pl[i].avatar = AVATARS[j]; break; } } used[pl[i].avatar] = 1; }
    S.np = np; S.players = pl;
  }
  function saveSetup() { var arr = [], i; for (i = 0; i < 4; i++) arr.push({ n: S.players[i].name, a: S.players[i].avatar }); store.set('ccc.setup.v1', JSON.stringify({ n: S.np, p: arr })); }
  function pname(i) { var n = S.players[i].name.replace(/^\s+|\s+$/g, ''); return n || ('Player ' + (i + 1)); }
  function renderSetup() {
    var cb = document.querySelectorAll('.count-btn'), i;
    for (i = 0; i < cb.length; i++) { if (parseInt(cb[i].getAttribute('data-n'), 10) === S.np) addCls(cb[i], 'on'); else rmCls(cb[i], 'on'); cb[i].setAttribute('aria-pressed', parseInt(cb[i].getAttribute('data-n'), 10) === S.np ? 'true' : 'false'); }
    var list = $('playerList'); clear(list);
    for (i = 0; i < S.np; i++) (function (idx) {
      var row = el('div', 'prow'), top = el('div', 'prow-top');
      var ab = el('button', 'av-btn', S.players[idx].avatar); ab.type = 'button'; ab.setAttribute('aria-label', 'Pick a picture for player ' + (idx + 1));
      var grid = el('div', 'av-grid');
      var num = el('span', 'pnum', '#' + (idx + 1));
      var inp = el('input', 'pname'); inp.type = 'text'; inp.maxLength = 12; inp.placeholder = 'Player ' + (idx + 1); inp.value = S.players[idx].name; inp.setAttribute('aria-label', 'Name for player ' + (idx + 1));
      inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocapitalize', 'words'); inp.setAttribute('autocorrect', 'off'); inp.setAttribute('spellcheck', 'false');
      inp.addEventListener('input', function () { S.players[idx].name = inp.value; });
      function drawGrid() {
        clear(grid); var taken = {}, q;
        for (q = 0; q < S.np; q++) if (q !== idx) taken[S.players[q].avatar] = 1;
        AVATARS.forEach(function (a) {
          var b = el('button', 'av-opt' + (S.players[idx].avatar === a ? ' sel' : ''), a); b.type = 'button'; if (taken[a]) b.disabled = true; b.setAttribute('aria-label', 'Picture ' + a);
          on(b, function () { S.players[idx].avatar = a; ab.textContent = a; rmCls(grid, 'open'); });
          grid.appendChild(b);
        });
      }
      on(ab, function () { if (hasCls(grid, 'open')) { rmCls(grid, 'open'); } else { drawGrid(); addCls(grid, 'open'); } });
      top.appendChild(ab); top.appendChild(inp); row.appendChild(top); row.appendChild(grid); list.appendChild(row);
    })(i);
  }

  /* ---------- game: board ---------- */
  function copyView(g) { return { pool: g.pool.slice(), piles: g.piles.map(function (a) { return a.slice(); }), cubes: g.cubes.map(function (a) { return a.slice(); }) }; }
  function safeTotal(v, p) { var t = 0, c; for (c = 0; c < NC; c++) t += v.cubes[p][c]; return t; }
  function buildBoard() {
    var b = $('board'), p, c; clear(b); refs.cells = []; refs.pool = []; refs.rows = []; refs.scores = []; refs.names = [];
    // pool row
    var pr = el('div', 'brow pool'), pn = el('div', 'bname'); pn.appendChild(el('span', 'nm', 'Pool')); pr.appendChild(pn);
    var pcs = el('div', 'cells');
    for (c = 0; c < NC; c++) { var pc = el('div', 'cell c' + c); pc.setAttribute('data-c', c); pc.setAttribute('data-pool', '1'); pc.appendChild(el('span', 'n', '12')); pcs.appendChild(pc); refs.pool.push(pc); }
    pr.appendChild(pcs); b.appendChild(pr);
    for (p = 0; p < S.np; p++) {
      var row = el('div', 'brow'), nm = el('div', 'bname');
      nm.appendChild(el('span', 'av', S.players[p].avatar)); var who = el('span', 'who'); var nn = el('span', 'nm', pname(p)); who.appendChild(nn);
      var sc = el('span', 'score', '🔒0'); who.appendChild(sc); nm.appendChild(who);
      row.appendChild(nm);
      var cs = el('div', 'cells'), arr = [];
      for (c = 0; c < NC; c++) { var cell = el('div', 'cell c' + c); cell.setAttribute('data-c', c); cell.setAttribute('data-p', p); cell.appendChild(el('span', 'n', '0')); cell.appendChild(el('span', 'lock', '')); cs.appendChild(cell); arr.push(cell); }
      row.appendChild(cs); b.appendChild(row); refs.cells.push(arr); refs.rows.push(row); refs.scores.push(sc);
    }
  }
  function updateBoard() {
    var v = S.view, p, c;
    for (c = 0; c < NC; c++) { var pc = refs.pool[c]; pc.firstChild.textContent = v.pool[c]; if (v.pool[c] === 0) addCls(pc, 'zero'); else rmCls(pc, 'zero'); pc.setAttribute('aria-label', COLORS[c].name + ' pool ' + v.pool[c]); }
    for (p = 0; p < S.np; p++) {
      for (c = 0; c < NC; c++) {
        var cell = refs.cells[p][c], n = v.piles[p][c], k = v.cubes[p][c];
        cell.firstChild.textContent = n; cell.lastChild.textContent = k > 0 ? ('🔒' + k) : '';
        cell.lastChild.style.display = k > 0 ? 'block' : 'none';
        if (n === 0) addCls(cell, 'zero'); else rmCls(cell, 'zero');
        cell.setAttribute('aria-label', pname(p) + ' ' + COLORS[c].name + ': ' + n + ' loose pieces, ' + k + ' safe cubes');
      }
      refs.scores[p].textContent = '🔒' + safeTotal(v, p);
      refs.scores[p].setAttribute('aria-label', safeTotal(v, p) + ' safe cubes');
    }
    // highlight rolled color column
    var all = $('board').querySelectorAll('.cell'), i;
    for (i = 0; i < all.length; i++) { var cc = parseInt(all[i].getAttribute('data-c'), 10); if (cc === S.hl) addCls(all[i], 'hl'); else rmCls(all[i], 'hl'); }
    for (p = 0; p < S.np; p++) { if (S.game && S.game.cur === p && !S.game.over) addCls(refs.rows[p], 'me'); else rmCls(refs.rows[p], 'me'); }
  }
  function flash(cell, cls) { rmCls(cell, cls); void cell.offsetWidth; addCls(cell, cls); later(700, function () { rmCls(cell, cls); }); }

  /* ---------- dice ---------- */
  var PIPS = { 1: [[50, 50]], 2: [[27, 27], [73, 73]], 3: [[27, 27], [50, 50], [73, 73]], 4: [[27, 27], [73, 27], [27, 73], [73, 73]], 5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]], 6: [[30, 25], [70, 25], [30, 50], [70, 50], [30, 75], [70, 75]] };
  function paintNum(node, v) {
    clear(node); var pips = el('div', 'pips'), k;
    for (k = 0; k < PIPS[v].length; k++) { var pp = el('div', 'pip' + (v === 1 ? ' red1' : '')); pp.style.left = PIPS[v][k][0] + '%'; pp.style.top = PIPS[v][k][1] + '%'; pips.appendChild(pp); }
    node.appendChild(pips); node.setAttribute('aria-label', 'Number die shows ' + v);
  }
  function paintCol(node, c) {
    node.style.background = COLORS[c].hex; node.innerHTML = hashSvg('#ffffff', false); node.setAttribute('aria-label', 'Color cube shows ' + COLORS[c].name);
  }
  function buildDice() { paintNum($('dieNum'), 6); paintCol($('dieCol'), 4); }
  function showRoll(roll, cb) {
    var n = $('dieNum'), c = $('dieCol');
    sfx.roll();
    if (reduceMotion) { paintNum(n, roll.nums[0]); paintCol(c, roll.cols[0]); later(T(150), cb); return; }
    rmCls(n, 'land'); rmCls(c, 'land'); void n.offsetWidth; addCls(n, 'tumble'); addCls(c, 'tumble');
    var tick = setInterval(function () { paintNum(n, 1 + Math.floor(Math.random() * 6)); paintCol(c, Math.floor(Math.random() * NC)); }, 85);
    later(T(950), function () {
      clearInterval(tick); rmCls(n, 'tumble'); rmCls(c, 'tumble');
      paintNum(n, roll.nums[0]); paintCol(c, roll.cols[0]); addCls(n, 'land'); addCls(c, 'land');
      later(T(420), function () { rmCls(n, 'land'); rmCls(c, 'land'); cb(); });
    });
  }

  /* ---------- bench (the stack) ---------- */
  function renderBench(color, count, animateTop) {
    var st = $('stack'), i; clear(st);
    var h = parseInt((window.getComputedStyle(st).height || '100'), 10) || 100;
    var lh = 38; try { lh = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--lh')) || 0; } catch (e) {}
    var layerH = st.offsetWidth || 92; var cosH = layerH * 0.47;
    var step = Math.max(7, Math.min(16, (h - cosH - 4) / 5));
    for (i = 0; i < 6; i++) {
      var on_ = i < count;
      var L = el('div', 'layer' + (on_ ? ' on' : ' ghost')); L.style.bottom = (i * step) + 'px'; L.style.zIndex = i + 1;
      L.innerHTML = hashSvg(COLORS[color].hex, on_);
      if (on_ && !(animateTop && i === count - 1)) { L.style.webkitAnimation = 'none'; L.style.animation = 'none'; }
      st.appendChild(L);
    }
    $('benchTitle').textContent = COLORS[color].name + ' stack: ' + count + ' / 6';
  }
  function benchIdle(msg) {
    var st = $('stack'); clear(st); $('bigCubeWrap').innerHTML = '';
    $('benchTitle').textContent = msg || '\u00a0'; $('benchNote').textContent = '\u00a0';
  }

  /* an isometric cube drawn flat (no 3D transforms needed), with a # on every face */
  function isoCube(hex, dark) {
    var H = '<g stroke="#fff" stroke-opacity=".75" stroke-width=".11" stroke-linecap="round" fill="none"><path d="M.36 .14 L.3 .86"/><path d="M.68 .14 L.62 .86"/><path d="M.14 .36 L.86 .32"/><path d="M.14 .68 L.86 .64"/></g>';
    return '<svg class="iso" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<polygon points="10,28 50,8 90,28 50,48" fill="' + hex + '"/><polygon points="10,28 50,48 50,92 10,72" fill="' + hex + '"/><polygon points="50,48 90,28 90,72 50,92" fill="' + dark + '"/>' +
      '<polygon points="10,28 50,48 50,92 10,72" fill="rgba(0,0,0,.14)"/><polygon points="10,28 50,8 90,28 50,48" fill="rgba(255,255,255,.28)"/>' +
      '<g transform="matrix(40 20 40 -20 10 28)">' + H + '</g><g transform="matrix(40 20 0 44 10 28)">' + H + '</g><g transform="matrix(40 -20 0 44 50 48)">' + H + '</g>' +
      '<polyline points="10,28 50,48 90,28" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/><line x1="50" y1="48" x2="50" y2="92" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/></svg>';
  }

  /* ---------- fx ---------- */
  function centerOf(node) { var r = node.getBoundingClientRect(), f = $('fxLayer').getBoundingClientRect(); return { x: r.left + r.width / 2 - f.left, y: r.top + r.height / 2 - f.top }; }
  function flyPiece(fromEl, toEl, color, cb) {
    if (reduceMotion) { later(T(60), cb); return; }
    var a = centerOf(fromEl), b = centerOf(toEl), f = el('div', 'flyer');
    f.innerHTML = hashSvg(COLORS[color].hex, true);
    setT(f, 'translate(' + (a.x - 13) + 'px,' + (a.y - 13) + 'px) scale(.7)');
    $('fxLayer').appendChild(f); void f.offsetWidth;
    setT(f, 'translate(' + (b.x - 13) + 'px,' + (b.y - 30) + 'px) scale(1.15) rotate(180deg)');
    var done = false; function fin() { if (done) return; done = true; if (f.parentNode) f.parentNode.removeChild(f); cb(); }
    later(Math.max(T(520), 40), fin);
  }
  function sparks(color, node) {
    if (reduceMotion) return;
    var c = centerOf(node), i, layer = $('fxLayer');
    for (i = 0; i < 16; i++) (function (i) {
      var s = el('div', 'spark'); s.style.background = i % 3 === 0 ? '#fff' : COLORS[color].hex; s.style.left = (c.x - 5) + 'px'; s.style.top = (c.y - 5) + 'px';
      layer.appendChild(s); void s.offsetWidth;
      var ang = (i / 16) * Math.PI * 2, d = 50 + (i % 4) * 14;
      setT(s, 'translate(' + Math.cos(ang) * d + 'px,' + Math.sin(ang) * d + 'px) scale(.3)'); s.style.opacity = '0';
      later(900, function () { if (s.parentNode) s.parentNode.removeChild(s); });
    })(i);
  }
  function toast(text, cls) {
    var t = el('div', 'toast' + (cls ? ' ' + cls : ''), text); $('fxLayer').appendChild(t);
    later(T(1900) + 100, function () { if (t.parentNode) t.parentNode.removeChild(t); });
  }
  function confetti(layer, n) {
    if (reduceMotion) return;
    var i; for (i = 0; i < n; i++) {
      var p = el('div', 'cf'); p.style.left = (Math.random() * 100) + '%'; p.style.background = COLORS[i % NC].hex;
      var d = 2.2 + Math.random() * 2.5; p.style.webkitAnimationDuration = d + 's'; p.style.animationDuration = d + 's'; p.style.webkitAnimationDelay = (Math.random() * 1.2) + 's'; p.style.animationDelay = (Math.random() * 1.2) + 's';
      layer.appendChild(p);
    }
  }

  /* ---------- turn flow ---------- */
  function setBanner(p, text) {
    var b = $('turnBanner'); clear(b);
    if (S.game && S.game.lastLapLeft !== undefined && !S.game.over) text += ' · LAST LAP!';
    var a = el('span', 'av', S.players[p].avatar); b.appendChild(a); b.appendChild(document.createTextNode(text));
  }
  function startGame() {
    var np = S.np;
    S.view = null; S.lapAnnounced = false; S.game = C.newGame(np, RULES, rng);
    S.game.cur = Math.floor(rng() * np);       // random starter keeps seat order fair over many games
    S.view = copyView(S.game); S.hl = -1; S.busy = false;
    buildBoard(); buildDice(); updateBoard(); benchIdle('Roll the dice!');
    $('actions').innerHTML = ''; show('screen-game');
    showPass(true);
  }
  function showPass(first) {
    var p = S.game.cur;
    $('passAvatar').textContent = S.players[p].avatar; $('passName').textContent = pname(p);
    $('btn-pass-ok').textContent = first ? 'Start!' : "I'm ready!";
    S.hl = -1; updateBoard();
    setBanner(p, pname(p) + "'s turn");
    $('actions').innerHTML = ''; benchIdle('\u00a0');
    overlay('overlay-pass', true); S.phase = 'pass';
  }
  function beginTurn() {
    overlay('overlay-pass', false);
    var g = S.game, p = g.cur;
    S.phase = 'roll'; S.hl = -1; updateBoard(); benchIdle('Your turn!');
    $('benchNote').textContent = 'Tap Roll!';
    var a = $('actions'); clear(a);
    var b = el('button', 'btn btn-go roll-btn', '🎲 Roll!'); b.type = 'button'; b.id = 'btn-roll'; b.setAttribute('data-testid', 'roll');
    on(b, function () { if (S.busy || S.phase !== 'roll') return; doRoll(); });
    a.appendChild(b);
  }
  function doRoll() {
    S.busy = true; S.phase = 'rolling';
    var a = $('actions'); clear(a); a.appendChild(el('div', 'act-msg', 'Rolling…'));
    C.startTurn(S.game, rng);
    if (window.__forceRoll) { S.game.roll = { nums: [window.__forceRoll[0]], cols: [window.__forceRoll[1]] }; window.__forceRoll = null; }  // test hook only
    showRoll(S.game.roll, function () { S.busy = false; showChoices(); });
  }
  function colorName(c) { return COLORS[c].name; }
  function describe(act) {
    var g = S.game, c = act.color, total = C.movePieces(act), kind, title, sub;
    var name = colorName(c);
    if (act.steals.length && act.take > 0) {
      kind = 'combo'; var v = act.steals[0][0], k = act.steals[0][1];
      title = 'Take ' + act.take + ' + steal ' + k; sub = 'Pool gives ' + act.take + ', ' + pname(v) + ' loses ' + k + ' ' + name;
    } else if (act.steals.length) {
      kind = 'steal'; var v2 = act.steals[0][0], k2 = act.steals[0][1];
      title = 'Steal ' + k2 + ' ' + name; sub = 'from ' + S.players[v2].avatar + ' ' + pname(v2) + ' (has ' + g.piles[v2][c] + ')';
    } else {
      kind = 'take'; title = 'Take ' + act.take + ' ' + name; sub = act.take < act.n ? ('Only ' + act.take + ' left in the pool') : 'from the pool';
    }
    var mine = g.piles[g.cur][c], after = mine + total;
    if (after >= 6) sub += ' · makes a cube!';
    return { kind: kind, title: title, sub: sub };
  }
  function showChoices() {
    var g = S.game, p = g.cur, r = g.roll, c = r.cols[0], n = r.nums[0];
    S.hl = c; updateBoard();
    renderBench(c, g.piles[p][c]);
    $('benchNote').textContent = 'Rolled ' + n + ' ' + colorName(c);
    var acts = C.legalActions(g), area = $('actions'); clear(area);
    var msg = el('div', 'act-msg', 'You rolled ' + n + ' × ' + colorName(c) + '. Pick one!'); area.appendChild(msg);
    var box = el('div', 'choices'), i, hasPass = false, rer = null;
    for (i = 0; i < acts.length; i++) (function (act, idx) {
      if (act.type === 'reroll') { rer = act; return; }
      if (act.type === 'pass') { hasPass = true; return; }
      var d = describe(act);
      var b = el('button', 'choice c' + act.color + (act.steals.length ? ' steal' : '')); b.type = 'button';
      b.setAttribute('data-kind', d.kind); b.setAttribute('data-idx', idx); b.setAttribute('data-testid', 'choice-' + d.kind);
      b.appendChild(el('span', 'ct', (act.steals.length ? '😈 ' : '✋ ') + d.title)); b.appendChild(el('span', 'cs', d.sub));
      on(b, function () { if (S.busy || S.phase !== 'choose') return; choose(act); });
      box.appendChild(b);
    })(acts[i], i);
    if (hasPass && !box.firstChild) {
      msg.textContent = 'Nothing to take this time.';
      var pb = el('button', 'choice pass'); pb.type = 'button'; pb.setAttribute('data-testid', 'choice-pass'); pb.appendChild(el('span', 'ct', 'OK, pass')); pb.appendChild(el('span', 'cs', 'Nothing is available'));
      on(pb, function () { if (S.busy) return; choose({ type: 'pass' }); }); box.appendChild(pb);
    }
    area.appendChild(box);
    if (rer) {
      var rb = el('button', 'btn reroll-btn', '🔄 Underdog re-roll'); rb.type = 'button'; rb.id = 'btn-reroll'; rb.setAttribute('data-testid', 'reroll');
      on(rb, function () { if (S.busy || S.phase !== 'choose') return; S.busy = true; S.phase = 'rolling'; C.apply(g, rer, rng); clear(area); area.appendChild(el('div', 'act-msg', 'Re-rolling…')); showRoll(g.roll, function () { S.busy = false; showChoices(); }); });
      area.appendChild(rb);
    }
    S.phase = 'choose';
  }
  function ask(opts, yes) {
    $('confirmEmoji').textContent = opts.emoji; $('confirmTitle').textContent = opts.title; $('confirmText').textContent = opts.text;
    $('btn-confirm-yes').textContent = opts.yes || 'Yes!'; $('btn-confirm-no').textContent = opts.no || 'Not yet';
    S.pendingConfirm = yes; overlay('overlay-confirm', true);
  }
  function choose(act) {
    if (act.steals && act.steals.length) {
      var v = act.steals[0][0], k = act.steals[0][1];
      ask({ emoji: '😈', title: 'Steal ' + k + ' ' + colorName(act.color) + ' from ' + pname(v) + '?', text: 'Those loose pieces will move to your pile. Safe cubes can never be stolen.', yes: 'Steal!', no: 'No, wait' }, function () { perform(act); });
    } else perform(act);
  }
  function perform(act) {
    S.busy = true; S.phase = 'animating';
    var g = S.game, me = g.cur, before = copyView(g);
    S.view = before;
    var area = $('actions'); clear(area); area.appendChild(el('div', 'act-msg', act.type === 'pass' ? '…' : 'Go go go!'));
    var ev = C.apply(g, act, rng);
    if (act.type === 'pass') { return finishTurn(); }
    var c = act.color, pieces = [], i, k;
    for (i = 0; i < act.take; i++) pieces.push({ src: -1 });
    for (i = 0; i < act.steals.length; i++) for (k = 0; k < act.steals[i][1]; k++) pieces.push({ src: act.steals[i][0] });
    if (act.steals.length) { toast(S.players[me].avatar + ' ' + pname(me) + ' steals ' + act.steals[0][1] + ' from ' + S.players[act.steals[0][0]].avatar + ' ' + pname(act.steals[0][0]) + '!', 'steal'); sfx.steal(); }
    var count = ev.before, idx = 0;
    renderBench(c, count);
    function next() {
      if (idx >= pieces.length) { return later(T(350), finishTurn); }
      var pc = pieces[idx++], fromEl = pc.src < 0 ? refs.pool[c] : refs.cells[pc.src][c], toEl = $('stack');
      flyPiece(fromEl, toEl, c, function () {
        if (pc.src < 0) S.view.pool[c]--; else { S.view.piles[pc.src][c]--; flash(refs.cells[pc.src][c], 'hurt'); }
        S.view.piles[me][c]++; count++;
        renderBench(c, count, true); updateBoard(); flash(refs.cells[me][c], 'bump'); sfx.take(count);
        if (count >= 6) {
          count -= 6;
          later(T(380), function () {
            celebrate(c, me, function () { S.view.piles[me][c] -= 6; S.view.cubes[me][c]++; updateBoard(); flash(refs.cells[me][c], 'bump'); renderBench(c, count); next(); });
          });
        } else later(T(130), next);
      });
    }
    next();
  }
  function celebrate(c, me, cb) {
    var st = $('stack'), layers = st.querySelectorAll('.layer'), i;
    for (i = 0; i < layers.length; i++) addCls(layers[i], 'glue');
    $('benchTitle').textContent = 'CUBE! 🎉';
    later(T(450), function () {
      var w = $('bigCubeWrap'); w.innerHTML = '';
      var big = el('div', 'bigcube'); big.innerHTML = isoCube(COLORS[c].hex, COLORS[c].dark); big.appendChild(el('div', 'shield', '🛡️')); w.appendChild(big);
      sparks(c, big); sfx.cube();
      toast('🔒 ' + colorName(c) + ' cube built! It\'s safe!', 'safe');
      $('benchNote').textContent = 'Safe forever! 🔒';
      later(T(1900), function () { w.innerHTML = ''; clear(st); cb(); });
    });
  }
  function finishTurn() {
    var g = S.game;
    S.view = copyView(g); S.hl = -1; updateBoard();
    C.endTurn(g);
    S.busy = false;
    if (g.over) { later(T(500), showEnd); return; }
    if (g.lastLapLeft !== undefined && !S.lapAnnounced) { S.lapAnnounced = true; toast('🏁 LAST LAP! The pool is empty. Everyone gets one more turn!', 'safe lap'); sfx.cube(); later(T(1900), function () { showPass(false); }); return; }
    later(T(300), function () { showPass(false); });
  }

  /* ---------- end ---------- */
  function showEnd() {
    var g = S.game, sc = C.scores(g), order = [], i, p;
    for (p = 0; p < g.np; p++) order.push(p);
    order.sort(function (a, b) {
      var wa = g.winners.indexOf(a) >= 0 ? 1 : 0, wb = g.winners.indexOf(b) >= 0 ? 1 : 0;
      if (wa !== wb) return wb - wa;
      if (sc[b].cubes !== sc[a].cubes) return sc[b].cubes - sc[a].cubes;
      if (sc[b].rainbow !== sc[a].rainbow) return sc[b].rainbow - sc[a].rainbow;
      return a - b;
    });
    var title = $('endTitle'), sub = $('endSub');
    if (g.winners.length === 1) {
      title.textContent = S.players[g.winners[0]].avatar + ' ' + pname(g.winners[0]) + ' wins!';
      var w = sc[g.winners[0]];
      sub.textContent = g.tiebreakLast ? 'Tied on everything, but they built the last cube! 🏁' : (g.tiebreakLoose ? 'Tied on cubes and colors, but they have the most loose pieces! #' : (g.tiebreakUsed ? 'Tied on cubes, but they built the most colors! 🌈' : w.cubes + ' safe cubes. Great building!'));
    } else {
      var names = [], q; for (q = 0; q < g.winners.length; q++) names.push(pname(g.winners[q]));
      title.textContent = "It's a tie!"; sub.textContent = names.join(' & ') + ' share the win! 🎉';
    }
    var box = $('standings'); clear(box);
    for (i = 0; i < order.length; i++) (function (pp, rank) {
      var win = g.winners.indexOf(pp) >= 0;
      var row = el('div', 'srow' + (win ? ' win' : '')); row.setAttribute('data-testid', 'standing');
      row.appendChild(el('span', 'rk', win ? '🏆' : String(rank + 1)));
      row.appendChild(el('span', 'av', S.players[pp].avatar)); row.appendChild(el('span', 'nm', pname(pp)));
      var cr = el('span', 'cubesrow'), cc, kk;
      for (cc = 0; cc < NC; cc++) for (kk = 0; kk < g.cubes[pp][cc]; kk++) { var sq = el('span', 'sc'); sq.style.background = COLORS[cc].hex; cr.appendChild(sq); }
      row.appendChild(cr); row.appendChild(el('span', 'tot', String(sc[pp].cubes)));
      box.appendChild(row);
    })(order[i], i);
    clear($('confetti')); confetti($('confetti'), 70); sfx.win();
    overlay('overlay-pass', false); show('screen-end'); S.phase = 'end';
  }

  /* ---------- wiring ---------- */
  function init() {
    buildTitle(); loadSetup(); paintSound();
    on($('btn-play'), function () { sfx.click(); renderSetup(); show('screen-setup'); });
    on($('btn-how'), function () { overlay('overlay-how', true); });
    on($('btn-how-close'), function () { overlay('overlay-how', false); });
    on($('btn-sound'), toggleSound); on($('btn-sound-title'), toggleSound);
    var cb = document.querySelectorAll('.count-btn'), i;
    for (i = 0; i < cb.length; i++) (function (b) { on(b, function () { S.np = parseInt(b.getAttribute('data-n'), 10); renderSetup(); }); })(cb[i]);
    on($('btn-setup-back'), function () { show('screen-title'); });
    on($('btn-start'), function () { saveSetup(); startGame(); });
    on($('btn-pass-ok'), function () { if (S.phase === 'pass') beginTurn(); });
    on($('btn-confirm-no'), function () { S.pendingConfirm = null; overlay('overlay-confirm', false); });
    on($('btn-confirm-yes'), function () { var f = S.pendingConfirm; S.pendingConfirm = null; overlay('overlay-confirm', false); if (f) f(); });
    on($('btn-menu'), function () {
      if (S.busy) return;
      ask({ emoji: '🏠', title: 'Leave this game?', text: 'The game will be lost.', yes: 'Leave', no: 'Keep playing' }, function () { overlay('overlay-pass', false); show('screen-title'); });
    });
    on($('btn-again'), function () { startGame(); });
    on($('btn-home'), function () { renderSetup(); show('screen-setup'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { overlay('overlay-how', false); } });
    // iOS: stop pinch/double-tap zoom and rubber-banding
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
    window.__ccc = { state: function () { return S; }, game: function () { return S.game; }, CCC: C, rules: RULES };
    if (window.CCCUpdate && !Q.noupdate) {
      CCCUpdate.init({
        inGame: function () { return hasCls($('screen-game'), 'active'); },
        canAutoReload: function () { return hasCls($('screen-title'), 'active') && !hasCls($('overlay-how'), 'show'); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
