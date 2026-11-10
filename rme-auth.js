/* rme-auth.js: one place that decides "is this person logged in?" for every RME page.
   Load it in <head> on every page: <script src="rme-auth.js"></script> */
(function () {
  var LS; try { LS = window.localStorage; } catch (e) { LS = null; }
  function get(k) { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (LS) LS.setItem(k, v); } catch (e) {} }
  function del(k) { try { if (LS) LS.removeItem(k); } catch (e) {} }

  function sbKeys() {
    var out = [];
    try { for (var i = 0; LS && i < LS.length; i++) { var k = LS.key(i); if (/^sb-.+-auth-token$/.test(k)) out.push(k); } } catch (e) {}
    return out;
  }

  /* Reads the saved Supabase session first, then the older loggedInEmail value. */
  function read() {
    var email = '', type = '', ok = false;
    sbKeys().forEach(function (k) {
      try {
        var t = JSON.parse(get(k)), s = (t && t.currentSession) || t;
        /* an expired access token is fine, Supabase refreshes it with the refresh token */
        if (s && (s.access_token || s.refresh_token)) {
          ok = true;
          var u = s.user || {};
          if (u.email) email = u.email;
          if (u.user_metadata && u.user_metadata.type) type = u.user_metadata.type;
        }
      } catch (e) {}
    });
    var legacy = (get('loggedInEmail') || '').trim();
    if (!email && legacy) email = legacy;
    if (email) ok = true;
    type = (type || get('rmeType') || '').toLowerCase();
    if (type === 'provider') type = 'runner';
    return { ok: ok, email: email.trim().toLowerCase(), type: type };
  }

  /* keep loggedInEmail in step with the real session so every page agrees */
  function sync() {
    var a = read();
    if (a.ok && a.email && get('loggedInEmail') !== a.email) set('loggedInEmail', a.email);
    return a;
  }

  function home(a) { a = a || read(); return a.type === 'runner' ? 'runners-profile.html' : 'client-profile.html'; }

  function here() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p + location.search;
  }

  /* Call on pages that need a login. role: 'runner' or 'user' (optional). */
  function requireLogin(role) {
    var a = sync();
    if (!a.ok) { location.replace('login.html?next=' + encodeURIComponent(here())); return false; }
    if (role && a.type && a.type !== role && (a.type === 'runner' || a.type === 'user')) {
      location.replace(home(a)); return false;
    }
    addEventListener('storage', function () {
      if (!read().ok) location.replace('login.html?next=' + encodeURIComponent(here()));
    });
    return true;
  }

  function wipe() {
    sbKeys().forEach(del);
    ['loggedInEmail', 'rmeType'].forEach(del);
  }

  async function logout(dest) {
    try {
      if (window.supabase && window.CONFIG) {
        var c = window.supabase.createClient(window.CONFIG.S_URL, window.CONFIG.S_KEY);
        await Promise.race([c.auth.signOut(), new Promise(function (r) { setTimeout(r, 1500); })]);
      }
    } catch (e) {}
    wipe();
    location.href = dest || 'index.html';
  }

  /* Public pages: Login becomes "My account", Sign up / Get started links disappear. */
  function renderNav() {
    var a = sync();
    document.querySelectorAll('a[href="login.html"], a[href="client-profile.html"], a[href="runners-profile.html"], a[href="sign-up.html"]').forEach(function (el) {
      if (!el.dataset.rmeRole) {
        var h = el.getAttribute('href');
        el.dataset.rmeRole = h === 'sign-up.html' ? 'signup' : 'login';
        el.dataset.rmeText = el.textContent.trim();
        el.dataset.rmeHtml = el.innerHTML;
      }
      if (el.dataset.rmeRole === 'login') {
        el.setAttribute('href', a.ok ? home(a) : 'login.html');
        if (a.ok) el.textContent = 'My account'; else el.innerHTML = el.dataset.rmeHtml;
      } else {
        el.style.display = a.ok ? 'none' : '';
      }
    });
  }

  window.RME = {
    auth: sync, home: home, requireLogin: requireLogin, logout: logout, renderNav: renderNav,
    setType: function (t) { if (t) set('rmeType', t); }
  };

  sync();
  document.addEventListener('DOMContentLoaded', renderNav);
  addEventListener('pageshow', renderNav);
  addEventListener('storage', renderNav);
})();
      
