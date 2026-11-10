(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('form');
  var urlInput = $('url');
  var aliasInput = $('alias');
  var submitBtn = $('submit');
  var errorEl = $('error');
  var resultBox = $('result');
  var shortLink = $('shortLink');
  var copyBtn = $('copyBtn');
  var warnEl = $('warn');
  var historyBox = $('historyBox');
  var historyList = $('historyList');
  var toastEl = $('toast');

  var HISTORY_KEY = 'alcashort-history';
  var MAX_HISTORY = 20;

  $('year').textContent = new Date().getFullYear();
  $('prefix').textContent = location.host + '/';

  // ---------- Tema ----------
  $('themeToggle').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('alcashort-theme', next); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0b0f14' : '#ffffff');
  });

  // ---------- Helpers ----------
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('loading', on);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { toast('Link disalin ✓'); })
        .catch(fallbackCopy.bind(null, text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Link disalin ✓'); } catch (e) { toast('Gagal menyalin'); }
    document.body.removeChild(ta);
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY))); } catch (e) {}
  }

  function renderHistory() {
    var list = loadHistory();
    historyList.innerHTML = '';
    historyBox.hidden = list.length === 0;

    list.forEach(function (item) {
      var li = document.createElement('li');

      var info = document.createElement('div');
      info.className = 'h-info';

      var a = document.createElement('a');
      a.className = 'h-short';
      a.href = item.short;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = item.short.replace(/^https?:\/\//, '');

      var long = document.createElement('span');
      long.className = 'h-long';
      long.textContent = item.url;
      long.title = item.url;

      info.appendChild(a);
      info.appendChild(long);

      var clicks = document.createElement('span');
      clicks.className = 'h-clicks';
      clicks.textContent = '… klik';
      clicks.dataset.slug = item.slug;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-btn';
      btn.textContent = 'Salin';
      btn.addEventListener('click', function () { copyText(item.short); });

      li.appendChild(info);
      li.appendChild(clicks);
      li.appendChild(btn);
      historyList.appendChild(li);
    });

    refreshClicks();
  }

  function refreshClicks() {
    var nodes = historyList.querySelectorAll('.h-clicks');
    Array.prototype.forEach.call(nodes, function (node) {
      fetch('/api/stats?slug=' + encodeURIComponent(node.dataset.slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { node.textContent = d ? d.clicks + ' klik' : '—'; })
        .catch(function () { node.textContent = '—'; });
    });
  }

  // ---------- Events ----------
  aliasInput.addEventListener('input', function () {
    aliasInput.value = aliasInput.value.replace(/[^a-zA-Z0-9_-]/g, '');
  });

  copyBtn.addEventListener('click', function () { copyText(shortLink.href); });

  $('clearHistory').addEventListener('click', function () {
    saveHistory([]);
    renderHistory();
    toast('Riwayat dihapus');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    resultBox.hidden = true;

    var url = urlInput.value.trim();
    var alias = aliasInput.value.trim();
    if (!url) { showError('Masukkan link tujuan dulu.'); urlInput.focus(); return; }
    if (alias && (alias.length < 3)) { showError('Alias minimal 3 karakter.'); aliasInput.focus(); return; }

    setLoading(true);
    fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, alias: alias })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok) { showError(res.data.error || 'Terjadi kesalahan.'); return; }
        var d = res.data;
        shortLink.href = d.short;
        shortLink.textContent = d.short.replace(/^https?:\/\//, '');
        warnEl.hidden = d.persistent;
        if (!d.persistent) {
          warnEl.textContent = 'Mode demo: database belum dihubungkan, link bisa hilang sewaktu-waktu. Lihat README.';
        }
        resultBox.hidden = false;

        var list = loadHistory().filter(function (x) { return x.slug !== d.slug; });
        list.unshift({ slug: d.slug, short: d.short, url: d.url });
        saveHistory(list);
        renderHistory();
        form.reset();
      })
      .catch(function () { showError('Tidak bisa terhubung ke server. Coba lagi.'); })
      .then(function () { setLoading(false); });
  });

  renderHistory();
})();
