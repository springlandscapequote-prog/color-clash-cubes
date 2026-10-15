/* Always-newest-version loader (no service worker). ES5, old-Safari safe.
   - version.json at the site root is stamped on every deploy (see stamp.sh / .github/workflows/stamp.yml).
   - On start, when the tab becomes visible again, on pageshow (back/forward cache), and when the player comes back to
     the title/setup/end screen we fetch version.json with cache-busting and compare it with the version baked into the
     code that is running (window.CCC_BUILD).
   - If it differs: from the TITLE screen with no game in progress we reload ONCE automatically (guarded by a
     sessionStorage flag so it can never loop). Anywhere else outside a game we show a big "New version ready! Tap to refresh" banner.
   - We NEVER reload or show the banner while a game is in progress.
   - Offline / errors: silently ignored. */
(function () {
  'use strict';
  var hooks = { inGame: function () { return false; }, canAutoReload: function () { return false; } };
  var pending = null;            // server version string when it differs from ours
  var lastCheck = 0, busy = false, banner = null;
  var FLAG = 'ccc.autoreload';
  function mine() { return String(window.CCC_BUILD || 'dev'); }
  function ss(k, v) { try { if (v === undefined) return window.sessionStorage.getItem(k); window.sessionStorage.setItem(k, v); } catch (e) { return null; } }

  function reloadNow(ver) {
    // Fresh URL => the browser cannot reuse a cached index.html. Keeps any other query params (like ?seed=).
    var q = (location.search || '').replace(/^\?/, '').split('&').filter(function (p) { return p && p.indexOf('u=') !== 0; });
    q.push('u=' + Date.now());
    var url = location.pathname + '?' + q.join('&') + (location.hash || '');
    try { location.replace(url); } catch (e) { location.href = url; }
  }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('button');
    banner.type = 'button'; banner.id = 'updateBanner';
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:9999;min-height:58px;padding:10px 14px;border:0;border-radius:18px;' +
      'background:#ffd23f;color:#3a2a00;font:800 18px "Trebuchet MS",Arial,sans-serif;box-shadow:0 5px 0 rgba(0,0,0,.3);text-align:center;display:none;' +
      'margin-top:constant(safe-area-inset-top);margin-top:env(safe-area-inset-top);touch-action:manipulation;cursor:pointer;';
    banner.textContent = '🎉 New version ready! Tap to refresh';
    banner.addEventListener('click', function (e) { e.preventDefault(); ss(FLAG, pending || ''); reloadNow(pending); });
    document.body.appendChild(banner);
    return banner;
  }
  function render() {
    if (!pending) { if (banner) banner.style.display = 'none'; return; }
    if (hooks.inGame()) { if (banner) banner.style.display = 'none'; return; }      // never interrupt a game
    // title screen, nothing in progress: reload once automatically (loop guard)
    if (hooks.canAutoReload() && ss(FLAG) !== pending) { ss(FLAG, pending); reloadNow(pending); return; }
    ensureBanner().style.display = 'block';
  }

  function got(ver) {
    ver = String(ver || '');
    if (!ver) return;
    if (ver === mine()) { pending = null; if (ss(FLAG)) ss(FLAG, ''); render(); return; }
    pending = ver; render();
  }
  function check(force) {
    var now = Date.now();
    if (busy || (!force && now - lastCheck < 4000)) { render(); return; }
    busy = true; lastCheck = now;
    var url = 'version.json?t=' + now;
    function done(txt) { busy = false; try { got(JSON.parse(txt).version); } catch (e) {} }
    function fail() { busy = false; }
    try {
      if (window.fetch) {
        window.fetch(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(function (r) { if (!r.ok) throw new Error('x'); return r.text(); }).then(done, fail);
      } else {
        var x = new XMLHttpRequest(); x.open('GET', url, true); x.setRequestHeader('Cache-Control', 'no-cache');
        x.onreadystatechange = function () { if (x.readyState === 4) { if (x.status === 200) done(x.responseText); else fail(); } };
        x.send();
      }
    } catch (e) { busy = false; }
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(false); });
  window.addEventListener('pageshow', function () { check(false); });
  window.addEventListener('online', function () { check(true); });

  // tidy the address bar (remove ?u=...) after an update reload
  try { if (/[?&]u=\d+/.test(location.search) && window.history && history.replaceState) { var q = location.search.replace(/^\?/, '').split('&').filter(function (p) { return p && p.indexOf('u=') !== 0; }).join('&'); history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash); } } catch (e) {}
  // old builds registered a service worker; make sure none is left behind
  try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }); } catch (e) {}

  window.CCCUpdate = {
    init: function (h) { if (h.inGame) hooks.inGame = h.inGame; if (h.canAutoReload) hooks.canAutoReload = h.canAutoReload; check(true); },
    check: check, render: render,
    _state: function () { return { mine: mine(), pending: pending, flag: ss(FLAG) }; }
  };
})();
