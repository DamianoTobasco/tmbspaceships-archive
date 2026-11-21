/* Pais Patents page: hero exhibits, full-text search, the five patents, their original drawings,
 * the backup library and a reader for each document's abstract, description, claims, drawings and
 * legal record.
 *
 * Needs window.PAIS + window.PAIS_TMB (data/pais.js, built by tools/pais_extract.py) and
 * window.PaisViz (patents.js: the animated diagrams and the record). Uses window.TMBFX
 * (reactor.js: page effects, motion flags) when present.
 * window.PAIS_MODE = 'web' in the hosted build (plain #name links back to the archive).
 */
(function () {
  'use strict';
  var V = window.PaisViz, D = window.PAIS || {}, TMB = window.PAIS_TMB || [], FX = window.TMBFX || {};
  if (!V) return;
  var MODE = window.PAIS_MODE || 'local';
  var reduce = V.reduce, live = !!FX.live, esc = V.esc, rgba = V.rgba, C = V.C, TAU = V.TAU;
  var text = V.text, mono = V.mono, hand = V.hand, clamp = V.clamp;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function smooth(e0, e1, x) { var k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ════════════ documents ════════════ */
  var HOME = 'index.html';
  var GP = 'https://patents.google.com/patent/';
  var P = V.list, REC = {};
  P.forEach(function (r, i) { r.i = i; REC[r.gp] = r; });
  var CONT = { gp: 'US20190348597A1', no: 'US 2019/0348597 A1', title: 'Piezoelectricity-induced high temperature superconductor',
               status: 'abandoned', statusText: 'Continuation · abandoned', parent: 'US20190058105A1', key: 'rtsc-cont' };
  var DOCS = P.map(function (r) { return r.gp; }).concat([CONT.gp]).filter(function (id) { return !!D[id]; });
  function meta(id) { return REC[id] || CONT; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fdate(s) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m ? +m[3] + ' ' + MON[+m[2] - 1] + ' ' + m[1] : (s || '—'); }
  function fbytes(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB'; }
  function fint(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pad4(n) { return String(n).padStart(4, '0'); }
  function pdfHref(id) { return 'pais/pdf/' + id + '.pdf'; }
  function figHref(id, i) { return 'pais/fig/' + id + '-' + i + '.png'; }
  function postHref(p) { return MODE === 'web' ? HOME + '#shot-' + p.n : HOME + '#post=' + p.id; }
  function plain(h) { return String(h).replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
  function figName(id, i) { var n = D[id].figs.length - 1; return i === 0 ? 'Front-page drawing' : 'Sheet ' + i + ' of ' + n; }
  // the dates a reader wants, taken from the patent office record
  function keyDates(id) {
    var d = D[id], ev = d.events || [], lg = d.legal || [];
    var pub = ev.filter(function (e) { return e.type === 'publication'; })[0];
    var grant = ev.filter(function (e) { return e.type === 'granted'; })[0];
    var lapse = lg.filter(function (e) { return e.code === 'LAPS' || e.code === 'FP'; })[0];
    var aban = lg.filter(function (e) { return e.code === 'STCB'; }).pop();
    var out = [['Filed', fdate(d.filed)]];
    if (pub) out.push(['Published', fdate(pub.d)]);
    if (grant) out.push(['Granted', fdate(grant.d)]);
    if (lapse) out.push(['Lapsed', fdate(lapse.d)]);
    else if (aban) out.push(['Abandoned', fdate(aban.d)]);
    return out;
  }
  var TOTAL = { figs: 0, pages: 0, words: 0, bytes: 0 };
  DOCS.forEach(function (id) { var d = D[id]; TOTAL.figs += d.figs.length; TOTAL.pages += d.pdfPages || 0; TOTAL.words += d.words || 0; TOTAL.bytes += d.pdfBytes || 0; });

  /* ════════════ hero: one blueprint sheet per patent, plotted in on change ════════════ */
  var hero = $('#hero'), hcv = $('#paisSheet'), stageEl = $('#stage');
  var HS = { ctx: null, W: 0, H: 0, dpr: 1, s: null, d: null, cur: -1, t: 3, age: 99, snap: null, running: false, inView: true, raf: 0, last: 0, first: true };
  function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
  function sheetChrome(c, s, d) {
    var ink = function (a) { return rgba(C.ink, a); }, k, gx, gy, i;
    var g = c.createLinearGradient(0, s.sy, 0, s.sy + s.sh);
    g.addColorStop(0, 'rgba(18,48,128,0.52)'); g.addColorStop(1, 'rgba(10,26,84,0.46)');
    c.fillStyle = g; rr(c, s.sx, s.sy, s.sw, s.sh, 8); c.fill();
    c.save(); rr(c, s.sx, s.sy, s.sw, s.sh, 8); c.clip(); c.lineWidth = 1;
    for (k = 0, gx = s.sx + 0.5; gx < s.sx + s.sw; gx += 14, k++) { c.strokeStyle = ink(k % 5 ? 0.045 : 0.1); c.beginPath(); c.moveTo(gx, s.sy); c.lineTo(gx, s.sy + s.sh); c.stroke(); }
    for (k = 0, gy = s.sy + 0.5; gy < s.sy + s.sh; gy += 14, k++) { c.strokeStyle = ink(k % 5 ? 0.045 : 0.1); c.beginPath(); c.moveTo(s.sx, gy); c.lineTo(s.sx + s.sw, gy); c.stroke(); }
    c.restore();
    c.strokeStyle = ink(0.5); rr(c, s.sx + 0.5, s.sy + 0.5, s.sw - 1, s.sh - 1, 8); c.stroke();
    c.strokeStyle = ink(0.18); rr(c, s.sx + 5.5, s.sy + 5.5, s.sw - 11, s.sh - 11, 5); c.stroke();
    if (!s.small) {
      for (i = 1, gx = s.sx + 70; gx < s.sx + s.sw - 40; gx += 70, i++) {
        c.strokeStyle = ink(0.4); c.beginPath(); c.moveTo(gx, s.sy + s.sh - 5); c.lineTo(gx, s.sy + s.sh); c.stroke();
        text(c, String(i), gx + 35, s.sy + s.sh - 10, mono(7), ink(0.35), 'center');
      }
    }
    var hpx = s.small ? 15 : 24;
    c.font = hand(hpx);
    var handW = c.measureText(d.hand).width;
    if ('letterSpacing' in c) c.letterSpacing = '1.4px';
    if (s.small) text(c, d.no, s.sx + s.sw - 12, s.sy + s.sh - 11, mono(7), ink(0.75), 'right');
    else {
      c.font = mono(10);
      var room = s.sw - handW - 64, ttl = c.measureText(d.fig).width <= room ? d.fig : d.figShort;
      if (c.measureText(ttl).width <= room) text(c, ttl, s.sx + 16, s.sy + 18, mono(10), ink(0.92));
    }
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    text(c, d.hand, s.sx + s.sw - 16, s.sy + (s.small ? 15 : 24), hand(hpx), 'rgba(255,255,255,0.96)', 'right');
    if (!s.small) text(c, d.no + ' · ' + d.stamp, s.sx + s.sw - 16, s.sy + s.sh - 17, mono(8), ink(0.5), 'right');
  }
  function heroBase() {
    var hr = hero.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    var top = sr.top - hr.top, h = Math.max(150, sr.height), small = HS.W < 760, pad = small ? 10 : clamp(HS.W * 0.03, 16, 48);
    return { small: small, sx: pad, sy: top + (small ? 4 : 14), sw: HS.W - pad * 2, sh: h - (small ? 8 : 22) };
  }
  function heroBuild() {
    if (!HS.ctx || !HS.d) return;
    var r = hero.getBoundingClientRect();
    HS.W = Math.max(300, r.width); HS.H = Math.max(300, r.height);
    HS.dpr = Math.min(window.devicePixelRatio || 1, 2);
    hcv.width = Math.round(HS.W * HS.dpr); hcv.height = Math.round(HS.H * HS.dpr);
    var s = heroBase();
    s.in = { W: s.sw, H: s.sh, small: s.sw < 600 };
    HS.d.layout(s.in);
    HS.s = s;
  }
  function heroRender() {
    var c = HS.ctx, s = HS.s, d = HS.d;
    if (!c || !s) return;
    c.setTransform(HS.dpr, 0, 0, HS.dpr, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.setLineDash([]);
    c.clearRect(0, 0, HS.W, HS.H);
    var rev = reduce ? 1 : smooth(0, 1.5, HS.age), rx = s.sx + (s.sw + 2) * rev;
    if (HS.snap && rev < 1) {   // the plotter wipes the previous sheet away as it draws the new one
      c.save(); c.beginPath(); c.rect(rx, 0, HS.W - rx, HS.H); c.clip();
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(HS.snap, 0, 0); c.restore();
    } else if (HS.snap) HS.snap = null;
    c.save(); c.beginPath(); c.rect(0, 0, rx, HS.H); c.clip();
    sheetChrome(c, s, d);
    c.save(); c.beginPath(); c.rect(s.sx + 6, s.sy + 34, s.sw - 12, s.sh - 54); c.clip();
    c.translate(s.sx, s.sy);
    d.draw(c, s.in, reduce ? 2.4 : HS.t);
    c.restore(); c.restore();
    c.setTransform(HS.dpr, 0, 0, HS.dpr, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.setLineDash([]);
    if (rev < 1) {
      c.globalCompositeOperation = 'lighter';
      var hg = c.createLinearGradient(rx - 60, 0, rx, 0);
      hg.addColorStop(0, 'rgba(255,200,120,0)'); hg.addColorStop(1, 'rgba(255,214,150,0.26)');
      c.fillStyle = hg; c.fillRect(rx - 60, s.sy, 60, s.sh);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(rx - 1, s.sy, 1.5, s.sh);
      c.globalCompositeOperation = 'source-over';
    }
  }
  function heroFrame(now) {
    HS.raf = 0;
    if (!HS.running) return;
    var dt = Math.min(0.05, (now - (HS.last || now)) / 1000);
    HS.last = now; HS.t += dt; HS.age += dt;
    heroRender();
    HS.raf = requestAnimationFrame(heroFrame);
  }
  function heroLoop() {
    var want = !reduce && HS.inView && !document.hidden && !!HS.d;
    if (want && !HS.running) { HS.running = true; HS.last = 0; HS.raf = requestAnimationFrame(heroFrame); }
    else if (!want && HS.running) { HS.running = false; if (HS.raf) cancelAnimationFrame(HS.raf); HS.raf = 0; }
  }
  var heroAuto = !reduce;
  var SHORT = { craft: 'Craft', heem: 'Field generator', rtsc: 'Superconductor', fusion: 'Fusion device', hfgw: 'Gravity waves' };
  function heroLineHTML(r) {
    var n = r.nums || [];
    var st = r.status === 'abandoned' ? 'ABANDONED' : 'LAPSED';
    return '<span class="rx e">' + esc(r.no) + '</span>' +
      (n[0] ? '<span class="op opt">·</span><span class="rx opt">' + esc(n[0][1]) + '</span>' : '') +
      (n[1] ? '<span class="op opt">·</span><span class="rx b opt">' + esc(n[1][1]) + '</span>' : '') +
      '<span class="rx-sep"></span><span class="rx-k">status</span><span class="rx-v ' + r.status + '">' + st + '</span>' +
      '<span class="rx-sep"></span><button class="rx-link" type="button" data-act="read" data-doc="' + r.gp + '"><span class="opt">Read the </span>patent →</button>';
  }
  function heroSet(i, byUser) {
    if (byUser) heroAuto = false;
    if (i === HS.cur || !P[i]) return;
    if (HS.ctx && HS.s && HS.cur >= 0 && !reduce) {   // keep the outgoing sheet to wipe over
      HS.snap = document.createElement('canvas'); HS.snap.width = hcv.width; HS.snap.height = hcv.height;
      HS.snap.getContext('2d').drawImage(hcv, 0, 0);
    }
    HS.cur = i; HS.d = P[i].viz;
    hero.setAttribute('data-exhibit', P[i].key);
    $$('#exhibits button').forEach(function (b, k) { b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    var line = $('#heroLine');
    if (line) { line.innerHTML = heroLineHTML(P[i]); replay(line, 'swap'); }
    HS.age = reduce || (HS.first && !live) ? 99 : 0;
    HS.first = false;
    heroBuild(); heroRender(); heroLoop();
  }
  function initHero() {
    if (!hero) return;
    $('#exhibits').innerHTML = P.map(function (r, i) {
      return '<button type="button" role="tab" aria-selected="false" data-pick="' + i + '" aria-label="' + esc(r.viz.hand) + '" title="' + esc(r.viz.hand) + '"><span>0' + (i + 1) + '</span>' +
        '<b><i class="xl">' + esc(r.viz.hand) + '</i><i class="xs">' + esc(SHORT[r.key] || r.viz.hand) + '</i></b></button>';
    }).join('');
    $('#exhibits').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pick]');
      if (b) heroSet(+b.getAttribute('data-pick'), true);
    });
    HS.ctx = hcv && hcv.getContext ? hcv.getContext('2d') : null;
    var key = '', t = 0;
    function resize() {
      clearTimeout(t);
      t = setTimeout(function () {
        var hr = hero.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
        var k = [Math.round(hr.width), Math.round(hr.height), Math.round(sr.top - hr.top), Math.round(sr.height)].join(':');
        if (k === key) return;
        key = k; HS.snap = null; heroBuild(); heroRender();
      }, 80);
    }
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stageEl);
    document.addEventListener('visibilitychange', heroLoop);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { HS.inView = en[0].isIntersecting; heroLoop(); }, { threshold: 0 }).observe(hero);
    }
    // until someone picks, step through the machines while the hero is on screen
    setInterval(function () {
      if (!heroAuto || document.hidden || hero.getBoundingClientRect().bottom < 160) return;
      heroSet((HS.cur + 1) % P.length, false);
    }, 17000);
    var want = (location.search.match(/[?&]exhibit=(\w+)/) || [])[1], wi = -1;
    P.forEach(function (r, i) { if (r.key === want) wi = i; });
    heroSet(wi >= 0 ? wi : 0, wi >= 0);
  }

  /* ════════════ readouts + hints ════════════ */
  function initReadouts() {
    var granted = P.filter(function (r) { return r.status === 'lapsed'; }).length;
    var items = [['Filings', P.length], ['Granted', granted], ['Drawings', TOTAL.figs], ['PDF pages', TOTAL.pages], ['Words', TOTAL.words]];
    var el = $('#readouts');
    el.innerHTML = items.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + fint(r[1]) + '</dd></div>'; }).join('');
    if (!live) return;
    $$('dd', el).forEach(function (dd, i) {
      var to = items[i][1], t0 = 0, dur = 1100 + i * 130;
      function step(now) {
        if (!t0) t0 = now;
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        dd.textContent = fint(Math.round(to * e));
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  var HINTS = ['vacuum polarization', 'Pelletron', 'xenon', 'gravitational wave', 'Lawson', 'London penetration depth', 'Schwinger'];
  function initHints() {
    var el = $('#hints');
    if (!el) return;
    el.innerHTML = '<span class="hints-k">Try</span>' + HINTS.map(function (h) { return '<button class="hint" type="button" data-hint="' + esc(h) + '">' + esc(h) + '</button>'; }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hint]');
      if (!b) return;
      setQuery(b.getAttribute('data-hint'));
      $('#consoleWrap').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ════════════ full-text search ════════════ */
  var IDX = [];
  function buildIndex() {
    DOCS.forEach(function (id) {
      var d = D[id], head = '';
      IDX.push({ id: id, tab: 'abstract', a: 'abs', label: 'Abstract', html: d.abstract });
      d.description.forEach(function (b, k) {
        if (b.t === 'h') { head = plain(b.html); return; }
        IDX.push({ id: id, tab: 'description', a: 'p' + k, label: (b.n ? '¶ ' + pad4(b.n) : 'Description') + (head ? ' · ' + head.toLowerCase() : ''), html: b.html });
      });
      d.claims.forEach(function (cl) {
        IDX.push({ id: id, tab: 'claims', a: 'c' + cl.n, label: 'Claim ' + cl.n + (cl.dep ? '' : ' · independent'), html: cl.lines.map(function (l) { return l[1]; }).join(' ') });
      });
    });
    IDX.forEach(function (e) { e.txt = plain(e.html).replace(/\s+/g, ' ').trim(); e.low = e.txt.toLowerCase(); });
  }
  function parseQuery(q) {
    var terms = [], m, re = /"([^"]+)"|(\S+)/g;
    while ((m = re.exec(q))) { var t = (m[1] || m[2]).toLowerCase().trim(); if (t) terms.push(t); }
    return terms;
  }
  function ranges(low, terms) {
    var out = [];
    terms.forEach(function (t) { var i = 0; while ((i = low.indexOf(t, i)) >= 0) { out.push([i, i + t.length]); i += t.length; } });
    out.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    out.forEach(function (r) { var l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); });
    return merged;
  }
  function marked(s, terms) {
    var rg = ranges(s.toLowerCase(), terms), out = '', at = 0;
    rg.forEach(function (r) { out += esc(s.slice(at, r[0])) + '<mark>' + esc(s.slice(r[0], r[1])) + '</mark>'; at = r[1]; });
    return out + esc(s.slice(at));
  }
  function snippet(e, terms) {
    var first = Infinity;
    terms.forEach(function (t) { var i = e.low.indexOf(t); if (i >= 0 && i < first) first = i; });
    if (first === Infinity) first = 0;
    var a = Math.max(0, first - 90), b = Math.min(e.txt.length, first + 190);
    if (a > 0) { var sp = e.txt.indexOf(' ', a); if (sp > 0 && sp < first) a = sp + 1; }
    if (b < e.txt.length) { var sp2 = e.txt.lastIndexOf(' ', b); if (sp2 > first) b = sp2; }
    return (a > 0 ? '… ' : '') + marked(e.txt.slice(a, b), terms) + (b < e.txt.length ? ' …' : '');
  }
  var SQ = { q: '', terms: [], hits: [], doc: '' };
  function search() {
    var t0 = performance.now(), terms = parseQuery(SQ.q);
    SQ.terms = terms;
    SQ.hits = terms.length ? IDX.filter(function (e) { return terms.every(function (t) { return e.low.indexOf(t) >= 0; }); }) : [];
    if (SQ.doc && !SQ.hits.some(function (h) { return h.id === SQ.doc; })) SQ.doc = '';
    renderHits(performance.now() - t0);
  }
  function renderHits(ms) {
    var box = $('#hits'), ov = $('#overview'), stat = $('#stat');
    if (!SQ.terms.length) {
      box.hidden = true; ov.hidden = false;
      stat.innerHTML = '<b>' + DOCS.length + '</b> documents<span class="of"> · ' + fint(TOTAL.words) + ' words</span>';
      return;
    }
    var by = {};
    SQ.hits.forEach(function (h) { by[h.id] = (by[h.id] || 0) + 1; });
    var ndocs = Object.keys(by).length;
    stat.innerHTML = '<b>' + SQ.hits.length + '</b> passages<span class="of"> · ' + ndocs + ' of ' + DOCS.length + ' documents</span><span class="ms"> · ' + Math.max(1, Math.round(ms)) + ' ms</span>';
    var list = SQ.doc ? SQ.hits.filter(function (h) { return h.id === SQ.doc; }) : SQ.hits, CAP = 150;
    box.innerHTML = '<section class="panel hits-panel">' +
      '<div class="panel-head"><h2><span class="ph-k">Full-text hits</span><span class="ph-sub">“' + esc(SQ.q) + '” in the abstract, description and claims</span></h2>' +
      '<button class="tool-btn" type="button" data-act="clear">Clear search</button></div>' +
      (SQ.hits.length ? '<div class="chips hit-docs">' + DOCS.filter(function (id) { return by[id]; }).map(function (id) {
        var m = meta(id);
        return '<button class="chip c-hot" type="button" data-act="hit-doc" data-doc="' + id + '" aria-pressed="' + (SQ.doc === id) + '"><span class="dot"></span>' + esc(m.no) + ' <span class="n">' + by[id] + '</span></button>';
      }).join('') + '</div>' : '') +
      (list.length ? '<ol class="hit-list">' + list.slice(0, CAP).map(function (h) {
        var m = meta(h.id);
        return '<li><button type="button" data-act="hit" data-i="' + IDX.indexOf(h) + '">' +
          '<span class="hit-k"><b>' + esc(m.no) + '</b> · ' + esc(h.label) + '</span>' +
          '<span class="hit-t">' + esc(m.title) + '</span>' +
          '<span class="hit-x">' + snippet(h, SQ.terms) + '</span></button></li>';
      }).join('') + '</ol>' + (list.length > CAP ? '<p class="pp-src">Showing the first ' + CAP + ' of ' + list.length + ' passages. Add a word to narrow it down.</p>' : '')
        : '<div class="empty"><div class="empty-orb" aria-hidden="true"></div><h3>No signal</h3><p>None of the six documents contains every word of this query. Try fewer or shorter words.</p></div>') +
      '</section>';
    box.hidden = false; ov.hidden = true;
  }
  var qT = 0;
  function setQuery(q) { $('#q').value = q; SQ.q = q.trim(); SQ.doc = ''; search(); }

  /* ════════════ overview: intro, cards, drawings, library, TMB posts ════════════ */
  function figThumbs(id, cls) {
    return D[id].figs.map(function (u, i) {
      return '<button type="button" class="' + cls + '" data-act="fig" data-doc="' + id + '" data-i="' + i + '" aria-label="' + esc(meta(id).no + ', ' + figName(id, i)) + '">' +
        '<img src="' + figHref(id, i) + '" alt="" loading="lazy" decoding="async"></button>';
    }).join('');
  }
  function cardHTML(r, i) {
    var d = D[r.gp];
    return '<article class="pp-card" id="pais-' + r.key + '" style="--i:' + i + '">' +
      '<div class="pp-viz"><canvas data-viz="' + i + '" role="img" aria-label="Animated cross-section of the ' + esc(r.title.toLowerCase()) + ', drawn from the patent text"></canvas></div>' +
      '<div class="pp-body">' +
        '<header class="pp-head"><span class="pp-n">0' + (i + 1) + '</span>' +
          '<div><h3>' + esc(r.title) + '</h3>' +
          '<p class="pp-no"><span class="pp-num">' + esc(r.no) + '</span><span class="pp-status ' + r.status + '">' + esc(r.statusText) + '</span></p></div>' +
        '</header>' +
        '<div class="pp-acts">' +
          '<button class="tool-btn pp-go" type="button" data-act="read" data-doc="' + r.gp + '" data-tab="description">Read the full patent <span>' + fint(d.words) + ' words</span></button>' +
          '<button class="tool-btn" type="button" data-act="read" data-doc="' + r.gp + '" data-tab="claims">Claims · ' + d.claims.length + '</button>' +
          '<button class="tool-btn" type="button" data-act="read" data-doc="' + r.gp + '" data-tab="drawings">Drawings · ' + d.figs.length + '</button>' +
          '<a class="tool-btn" href="' + pdfHref(r.gp) + '" target="_blank" rel="noopener">PDF · ' + d.pdfPages + ' pp</a>' +
          '<a class="tool-btn" href="' + GP + r.gp + '/en" target="_blank" rel="noopener">Google Patents ↗</a>' +
        '</div>' +
        '<div class="pp-cols">' +
          '<div class="pp-text"><p>' + esc(r.plain) + '</p>' +
            '<blockquote class="pp-quote">“' + esc(r.claim) + '”<cite>— from the patent</cite></blockquote>' +
            '<p class="pp-note">' + esc(r.note) + '</p></div>' +
          '<div class="pp-side">' +
            '<dl class="pp-dates">' + keyDates(r.gp).map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' +
            '<dl class="pp-nums">' + r.nums.map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
            '<p class="pp-figk">Original drawings</p><div class="pp-figs">' + figThumbs(r.gp, 'pp-fig') + '</div>' +
            '<p class="pp-by">Inventor: ' + esc(d.inventor || 'Salvatore Cezar Pais') + ' · Assignee: US Navy</p>' +
          '</div>' +
        '</div>' +
      '</div></article>';
  }
  function drawingsHTML() {
    return '<section class="panel pp-section" id="drawings">' +
      '<div class="panel-head"><h2><span class="ph-k">Original patent drawings</span><span class="ph-sub">' + TOTAL.figs + ' sheets as filed · tap to enlarge</span></h2></div>' +
      '<div class="dw-grid">' + DOCS.map(function (id) {
        var m = meta(id);
        return D[id].figs.map(function (u, i) {
          return '<figure class="dw"><button type="button" data-act="fig" data-doc="' + id + '" data-i="' + i + '" aria-label="Enlarge ' + esc(m.no + ', ' + figName(id, i)) + '">' +
            '<img src="' + figHref(id, i) + '" alt="' + esc(m.title + ': ' + figName(id, i)) + '" loading="lazy" decoding="async"></button>' +
            '<figcaption><b>' + esc(m.no) + '</b>' + esc(figName(id, i)) + '</figcaption></figure>';
        }).join('');
      }).join('') + '</div></section>';
  }
  function libraryHTML() {
    return '<section class="panel pp-section" id="library">' +
      '<div class="panel-head"><h2><span class="ph-k">Patent backup library</span><span class="ph-sub">stored with this site · ' + DOCS.length + ' PDFs · ' + fbytes(TOTAL.bytes) + '</span></h2></div>' +
      '<p class="lib-intro">Every document is kept here as published: the official PDF, each original drawing sheet and the full text, so all of it stays readable if Google Patents or the USPTO links ever change. The sixth entry is the follow-up “high temperature” superconductor application.</p>' +
      '<ol class="lib">' + DOCS.map(function (id, k) {
        var m = meta(id), d = D[id];
        return '<li class="lib-row">' +
          '<span class="lib-n">' + (REC[id] ? '0' + (m.i + 1) : '+') + '</span>' +
          '<div class="lib-main"><b class="lib-no">' + esc(m.no) + '</b><span class="lib-t">' + esc(m.title) + '</span>' +
            '<span class="lib-m"><span class="pp-status ' + m.status + '">' + esc(m.statusText) + '</span>' +
            keyDates(id).map(function (x) { return '<span>' + x[0] + ' ' + x[1] + '</span>'; }).join('') + '</span></div>' +
          '<div class="lib-acts">' +
            '<button class="tool-btn pp-go" type="button" data-act="read" data-doc="' + id + '">Read</button>' +
            '<a class="tool-btn" href="' + pdfHref(id) + '" target="_blank" rel="noopener" title="Open the PDF">PDF · ' + d.pdfPages + ' pp · ' + fbytes(d.pdfBytes) + '</a>' +
            '<a class="tool-btn" href="' + pdfHref(id) + '" download="' + id + '.pdf" title="Download the PDF" aria-label="Download ' + esc(m.no) + ' PDF">↓</a>' +
          '</div></li>';
      }).join('') + '</ol></section>';
  }
  function excerpt(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function tmbHTML() {
    if (!TMB.length) return '';
    return '<section class="panel pp-tmb pp-section" id="tmb"><div class="panel-head"><h2><span class="ph-k">@TMBSPACESHIPS on Pais</span><span class="ph-sub">' + TMB.length + ' replies in the archive</span></h2></div><ol>' +
      TMB.map(function (p) {
        var r = p.ref || {};
        return '<li><a class="pp-tmb-a" href="' + postHref(p) + '">' +
          '<span class="pp-tmb-d">SHOT ' + pad4(p.n) + '<br>' + esc(p.t.slice(0, 10)) + '</span>' +
          '<span class="pp-tmb-x">' + (r.x ? '<span class="pp-tmb-ctx">' + (r.u ? '@' + esc(r.u) + ': ' : '') + esc(excerpt(r.x.replace(/^((?:@\w+[\s,]*)+)/, ''), 150)) + '</span>' : '') +
          '<span class="pp-tmb-reply">↳ ' + esc(excerpt(p.x, 260)) + '</span></span></a></li>';
      }).join('') + '</ol></section>';
  }
  function introHTML() {
    var tl = V.timeline.map(function (e, i) {
      return '<li class="pp-tl-' + e[2] + '" style="--i:' + i + '"><span class="pp-tl-d">' + e[0] + '</span><span class="pp-tl-x">' + esc(e[1]) + '</span></li>';
    }).join('');
    return '<section class="pp-intro panel" id="intro">' +
      '<div class="pp-intro-txt">' +
        '<p class="eyebrow"><span class="blink">●</span> The Navy “UFO patents”</p>' +
        '<h2 class="pp-h">Salvatore Pais · 5 US Navy filings</h2>' +
        '<p>Between 2015 and 2018 Salvatore Cezar Pais, an aerospace engineer at the Naval Air Warfare Center Aircraft Division in Patuxent River, Maryland, filed five patent applications through the US Navy: a craft that reduces its own inertial mass, the field generator behind it, a gravitational-wave generator, a room-temperature superconductor and a compact fusion reactor. Three were granted; two were abandoned. All three granted patents have since lapsed for unpaid fees.</p>' +
        '<p class="pp-small">Each animated drawing is a cross-section built from the parts and numbers the patent itself describes (reference numerals in the labels). They illustrate the claims; nothing here has been demonstrated. The original drawings, the PDFs and the complete text of every filing are stored on this page: open any patent to read it.</p>' +
        '<nav class="pp-jump" aria-label="Jump to a patent">' + P.map(function (r, i) {
          return '<a href="#pais-' + r.key + '" data-jump="pais-' + r.key + '"><b>0' + (i + 1) + '</b>' + esc(r.viz.hand) + '</a>';
        }).join('') + '</nav>' +
      '</div>' +
      '<ol class="pp-tl" aria-label="Timeline">' + tl + '</ol>' +
    '</section>';
  }
  function sideHTML() {
    $('#sideDocs').innerHTML = DOCS.map(function (id) {
      var m = meta(id);
      return '<li><a href="' + (REC[id] ? '#pais-' + m.key : '#read-' + id) + '" ' + (REC[id] ? 'data-jump="pais-' + m.key + '"' : 'data-act="read" data-doc="' + id + '"') + '>' +
        '<b>' + (REC[id] ? '0' + (m.i + 1) : '+') + '</b><span>' + esc(REC[id] ? m.viz.hand : 'High Temperature Superconductor') + '<small>' + esc(m.no) + '</small></span>' +
        '<i class="st ' + m.status + '" title="' + esc(m.statusText) + '"></i></a></li>';
    }).join('');
    $('#sideNote').innerHTML = 'Backed up here: ' + DOCS.length + ' PDFs (' + fbytes(TOTAL.bytes) + '), ' + TOTAL.figs + ' original drawings and ' + fint(TOTAL.words) + ' words of full text. Search covers every abstract, description and claim.';
  }
  var vizzes = [], vRunning = false, vRaf = 0, vLast = 0, io = null;
  function buildOverview() {
    var el = $('#overview');
    el.innerHTML = introHTML() + P.map(cardHTML).join('') + drawingsHTML() + libraryHTML() + tmbHTML() +
      '<p class="pp-src">Sources: the patents on Google Patents (text, drawings and PDFs copied here as backups); US Navy test records released under FOIA in 2021 (HEEMFG test report, August 2019). Patent text is quoted from the filings.</p>';
    sideHTML();
    vizzes = $$('canvas[data-viz]', el).map(function (cv) {
      return { cv: cv, ctx: cv.getContext('2d'), d: P[+cv.getAttribute('data-viz')].viz, s: null, on: false, t: 2 + Math.random() * 3, key: '' };
    });
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = vizzes.filter(function (x) { return x.cv === en.target; })[0];
          if (v) { v.on = en.isIntersecting; if (v.on) { vSize(v); vDraw(v, 0); } }
        });
        vLoop();
      }, { rootMargin: '120px 0px' });
      vizzes.forEach(function (v) { io.observe(v.cv); });
    } else vizzes.forEach(function (v) { v.on = true; vSize(v); vDraw(v, 0); });
    window.addEventListener('resize', function () { vizzes.forEach(function (v) { v.key = ''; if (v.on) { vSize(v); vDraw(v, 0); } }); });
    document.addEventListener('visibilitychange', vLoop);
  }
  function vSize(v) {
    var r = v.cv.getBoundingClientRect();
    if (!r.width) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), key = Math.round(r.width) + 'x' + Math.round(r.height) + '@' + dpr;
    if (key === v.key) return true;
    v.key = key;
    v.cv.width = Math.round(r.width * dpr); v.cv.height = Math.round(r.height * dpr);
    v.s = { W: r.width, H: r.height, dpr: dpr, small: r.width < 600 };
    v.d.layout(v.s);
    return true;
  }
  function vDraw(v, dt) {
    if (!v.s && !vSize(v)) return;
    v.t += dt;
    var c = v.ctx, s = v.s;
    c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
    c.clearRect(0, 0, s.W, s.H);
    V.paper(c, s, v.d);
    c.save(); c.beginPath(); c.rect(6, 34, s.W - 12, s.H - 54); c.clip();
    v.d.draw(c, s, reduce ? 2.4 : v.t);
    c.restore();
  }
  function vFrame(now) {
    vRaf = 0;
    if (!vRunning) return;
    var dt = Math.min(0.05, (now - (vLast || now)) / 1000); vLast = now;
    vizzes.forEach(function (v) { if (v.on) { vSize(v); vDraw(v, dt); } });
    vRaf = requestAnimationFrame(vFrame);
  }
  function vLoop() {
    var want = !reduce && !document.hidden && vizzes.some(function (v) { return v.on; }) && !$('#overview').hidden;
    if (want && !vRunning) { vRunning = true; vLast = 0; vRaf = requestAnimationFrame(vFrame); }
    else if (!want && vRunning) { vRunning = false; if (vRaf) cancelAnimationFrame(vRaf); vRaf = 0; }
  }

  /* ════════════ reader ════════════ */
  var RD = { dlg: $('#reader'), id: null, tab: 'abstract', last: null };
  var TABS = [['abstract', 'Abstract'], ['description', 'Description'], ['claims', 'Claims'], ['drawings', 'Drawings'], ['record', 'Record']];
  function rdTabsHTML(id) {
    var d = D[id];
    return TABS.map(function (t) {
      var n = t[0] === 'claims' ? d.claims.length : t[0] === 'drawings' ? d.figs.length : 0;
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (RD.tab === t[0]) + '">' + t[1] + (n ? ' <span class="rd-n">' + n + '</span>' : '') + '</button>';
    }).join('');
  }
  function factGrid(id) {
    var d = D[id], m = meta(id);
    var rows = keyDates(id).concat([['Application', d.app || '—'], ['PDF', d.pdfPages + ' pages']]);
    if (d.cited != null) rows.push(['Cited by', d.cited + (d.cited === 1 ? ' patent' : ' patents')]);
    else if (d.famCited != null) rows.push(['Citing families', String(d.famCited)]);
    return '<dl class="insp-meta rd-facts">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="pp-by">Inventor: ' + esc(d.inventor) + ' · Assignee: ' + esc(d.assignee) + ' · Status: ' + esc(d.status || m.statusText) + '</p>';
  }
  function docLinks(id) {
    return '<div class="pp-acts rd-acts">' +
      '<a class="tool-btn" href="' + pdfHref(id) + '" target="_blank" rel="noopener">Open PDF backup · ' + D[id].pdfPages + ' pp</a>' +
      '<a class="tool-btn" href="' + pdfHref(id) + '" download="' + id + '.pdf">Download PDF ↓</a>' +
      '<a class="tool-btn" href="' + GP + id + '/en" target="_blank" rel="noopener">Google Patents ↗</a></div>';
  }
  function rdBodyHTML(id, tab) {
    var d = D[id], m = meta(id), h = '';
    if (tab === 'abstract') {
      h = '<p class="rd-k">Abstract</p><p class="rd-abs">' + d.abstract + '</p>';
      if (REC[id]) h += '<p class="rd-k">In plain words</p><p class="rd-plain">' + esc(m.plain) + '</p>';
      if (id === CONT.gp) h += '<p class="rd-note">A continuation of <button class="rd-xref" type="button" data-act="read" data-doc="' + CONT.parent + '">US 2019/0058105 A1</button>, filed after that application was rejected. It went to appeal and was discontinued in 2023.</p>';
      if (id === CONT.parent && D[CONT.gp]) h += '<p class="rd-note">A follow-up “high temperature” version was filed in 2019: <button class="rd-xref" type="button" data-act="read" data-doc="' + CONT.gp + '">US 2019/0348597 A1</button>.</p>';
      h += factGrid(id) + docLinks(id);
    } else if (tab === 'description') {
      var heads = [];
      d.description.forEach(function (b, k) { if (b.t === 'h') heads.push([k, plain(b.html)]); });
      h = (heads.length ? '<nav class="rd-toc" aria-label="Sections">' + heads.map(function (x) {
        return '<button type="button" data-act="rd-jump" data-a="h' + x[0] + '">' + esc(x[1].toLowerCase()) + '</button>';
      }).join('') + '</nav>' : '') +
        '<div class="rd-desc">' + d.description.map(function (b, k) {
          return b.t === 'h' ? '<h4 id="rd-h' + k + '">' + b.html + '</h4>'
            : '<p id="rd-p' + k + '" class="rd-p">' + (b.n ? '<span class="pn">[' + pad4(b.n) + ']</span>' : '') + b.html + '</p>';
        }).join('') + '</div>';
    } else if (tab === 'claims') {
      h = '<p class="rd-k">What is claimed is:</p><ol class="rd-claims">' + d.claims.map(function (cl) {
        return '<li id="rd-c' + cl.n + '" class="rd-claim' + (cl.dep ? ' dep' : '') + '">' + cl.lines.map(function (l) {
          return '<div class="rd-cl" style="--d:' + Math.min(4, l[0]) + '">' + l[1] + '</div>';
        }).join('') + '</li>';
      }).join('') + '</ol>';
    } else if (tab === 'drawings') {
      h = '<div class="rd-figs">' + d.figs.map(function (u, i) {
        return '<figure class="dw"><button type="button" data-act="fig" data-doc="' + id + '" data-i="' + i + '" aria-label="Enlarge ' + esc(figName(id, i)) + '">' +
          '<img src="' + figHref(id, i) + '" alt="' + esc(m.title + ': ' + figName(id, i)) + '" loading="lazy"></button>' +
          '<figcaption><b>' + esc(figName(id, i)) + '</b><a href="' + figHref(id, i) + '" target="_blank" rel="noopener">PNG ↗</a></figcaption></figure>';
      }).join('') + '</div>';
    } else if (tab === 'record') {
      var evs = (d.events || []).map(function (e) {
        var cls = e.type === 'granted' ? 'g' : e.type === 'filed' ? 'f' : e.type === 'legal-status' ? 'a' : 'n';
        return '<li class="pp-tl-' + cls + '"><span class="pp-tl-d">' + esc(e.d) + '</span><span class="pp-tl-x">' + esc(e.t) + '</span></li>';
      }).join('');
      var legal = (d.legal || []).map(function (e) {
        return '<tr><td>' + esc(e.d) + '</td><td><code>' + esc(e.code) + '</code></td><td>' + esc(e.t) + '</td></tr>';
      }).join('');
      var cpc = (d.cpc || []).map(function (c) { return '<li><code>' + esc(c.code) + '</code> ' + esc(c.d) + '</li>'; }).join('');
      h = factGrid(id) +
        '<p class="rd-k">Application events</p><ol class="pp-tl rd-tl">' + evs + '</ol>' +
        (legal ? '<p class="rd-k">Legal events</p><table class="syntax rd-legal"><tbody>' + legal + '</tbody></table>' : '') +
        (cpc ? '<p class="rd-k">Classifications</p><ul class="rd-cpc">' + cpc + '</ul>' : '') +
        '<p class="pp-src">From the Google Patents record for ' + esc(m.no) + '. “Adjusted expiration” is the date the patent would have run to had its fees been paid.</p>' + docLinks(id);
    }
    return h;
  }
  function highlight(root, terms) {
    if (!terms || !terms.length) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    nodes.forEach(function (node) {
      var s = node.nodeValue, rg = ranges(s.toLowerCase(), terms);
      if (!rg.length) return;
      var frag = document.createDocumentFragment(), at = 0;
      rg.forEach(function (r) {
        frag.appendChild(document.createTextNode(s.slice(at, r[0])));
        var mk = document.createElement('mark'); mk.textContent = s.slice(r[0], r[1]); frag.appendChild(mk);
        at = r[1];
      });
      frag.appendChild(document.createTextNode(s.slice(at)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function writeHash() {
    var nm = RD.id ? 'read-' + RD.id + (RD.tab !== 'abstract' ? '-' + RD.tab : '') : '';
    if (location.hash.slice(1) === nm) return;
    try { history.replaceState(null, '', nm ? '#' + nm : location.pathname + location.search); } catch (e) { /* file:// quirks */ }
  }
  function rdRender(anim, anchor, terms) {
    var id = RD.id, m = meta(id);
    $('#rdTitle').innerHTML = '<span class="badge c-hot rd-badge">' + esc(m.no) + '</span><span class="pp-status ' + m.status + '">' + esc(m.statusText) + '</span><span class="rd-t">' + esc(m.title) + '</span>';
    var tabsEl = $('#rdTabs');
    tabsEl.innerHTML = rdTabsHTML(id);
    var sel = $('[aria-selected="true"]', tabsEl);   // keep the current tab in view on narrow screens
    if (sel) {
      var x = sel.offsetLeft - tabsEl.offsetLeft;
      if (x < tabsEl.scrollLeft || x + sel.offsetWidth > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = Math.max(0, x - 14);
    }
    var body = $('#rdBody');
    body.innerHTML = rdBodyHTML(id, RD.tab);
    body.scrollTop = 0;
    body.classList.remove('sw-next', 'sw-prev', 'sw-tab');
    if (anim && !reduce) replay(body, anim);
    highlight(body, terms || []);
    if (anchor) {
      var el = document.getElementById('rd-' + anchor);
      if (el) {
        el.scrollIntoView({ block: anchor.charAt(0) === 'h' ? 'start' : 'center' });
        el.classList.add('flash');
      }
    }
    writeHash();
  }
  function openReader(id, tab, anchor, terms) {
    if (!D[id]) return;
    var was = RD.dlg.open;
    var anim = was ? (RD.id === id ? 'sw-tab' : (DOCS.indexOf(id) > DOCS.indexOf(RD.id) ? 'sw-next' : 'sw-prev')) : '';
    RD.id = id; RD.tab = tab || 'abstract';
    if (!was) {
      RD.last = document.activeElement;
      if (RD.dlg.showModal) RD.dlg.showModal(); else RD.dlg.setAttribute('open', '');
    }
    rdRender(anim, anchor, terms);
  }
  function closeReader() {
    if (RD.dlg.open) { if (RD.dlg.close) RD.dlg.close(); else RD.dlg.removeAttribute('open'); }
  }
  RD.dlg.addEventListener('close', function () {
    RD.id = null;
    if (/^#read-/.test(location.hash)) writeHash();   // leave any other #section the page moved to
    if (RD.last && RD.last.focus) try { RD.last.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  });
  function step(dir) {
    if (!RD.id) return;
    var i = (DOCS.indexOf(RD.id) + dir + DOCS.length) % DOCS.length;
    openReader(DOCS[i], RD.tab);
  }

  /* ════════════ drawing viewer ════════════ */
  var LB = { dlg: $('#lightbox'), list: [], i: 0 };
  function lbOpen(id, i) {
    LB.list = [];
    DOCS.forEach(function (d) { D[d].figs.forEach(function (u, k) { LB.list.push({ id: d, i: k }); }); });
    LB.i = 0;
    LB.list.forEach(function (x, k) { if (x.id === id && x.i === i) LB.i = k; });
    if (!LB.dlg.open) { if (LB.dlg.showModal) LB.dlg.showModal(); else LB.dlg.setAttribute('open', ''); }
    lbShow();
  }
  function lbShow() {
    var x = LB.list[LB.i], m = meta(x.id), src = figHref(x.id, x.i);
    $('#lbStage').innerHTML = '<img src="' + src + '" alt="' + esc(m.title + ': ' + figName(x.id, x.i)) + '">';
    $('#lbCap').innerHTML = '<span class="shot-no">' + esc(m.no) + ' · ' + esc(figName(x.id, x.i)) + '</span>' + esc(m.title);
    $('#lbCount').textContent = (LB.i + 1) + ' / ' + LB.list.length;
    $('#lbOpen').href = src;
  }
  function lbStep(d) { LB.i = (LB.i + d + LB.list.length) % LB.list.length; lbShow(); }

  /* ════════════ events ════════════ */
  function jumpTo(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;
    var a = t.closest('[data-act]');
    var jump = t.closest('[data-jump]');
    if (jump && !a) {
      e.preventDefault();
      if (!$('#overview').hidden) jumpTo(jump.getAttribute('data-jump'));
      else { setQuery(''); requestAnimationFrame(function () { jumpTo(jump.getAttribute('data-jump')); }); }
      return;
    }
    if (t.closest('.rd-body .fr')) { RD.tab = 'drawings'; rdRender('sw-tab'); return; }
    var cr = t.closest('.rd-body .cr');
    if (cr) {
      var cn = (cr.textContent.match(/\d+/) || [])[0];
      if (cn) { RD.tab = 'claims'; rdRender('sw-tab', 'c' + cn); }
      return;
    }
    var tabB = t.closest('#rdTabs [data-tab]');
    if (tabB) { RD.tab = tabB.getAttribute('data-tab'); rdRender('sw-tab'); return; }
    if (!a) {
      if (t === LB.dlg || t.id === 'lbStage') LB.dlg.close();
      return;
    }
    var act = a.getAttribute('data-act');
    if (act === 'read') { e.preventDefault(); openReader(a.getAttribute('data-doc'), a.getAttribute('data-tab') || 'abstract'); }
    else if (act === 'rd-close') closeReader();
    else if (act === 'rd-prev') step(-1);
    else if (act === 'rd-next') step(1);
    else if (act === 'rd-jump') { var el = document.getElementById('rd-' + a.getAttribute('data-a')); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
    else if (act === 'fig') lbOpen(a.getAttribute('data-doc'), +a.getAttribute('data-i'));
    else if (act === 'lb-prev') lbStep(-1);
    else if (act === 'lb-next') lbStep(1);
    else if (act === 'lb-close') LB.dlg.close();
    else if (act === 'clear') { setQuery(''); $('#q').focus(); }
    else if (act === 'hit-doc') { var dd = a.getAttribute('data-doc'); SQ.doc = SQ.doc === dd ? '' : dd; renderHits(0); }
    else if (act === 'hit') { var h = IDX[+a.getAttribute('data-i')]; if (h) openReader(h.id, h.tab, h.a, SQ.terms); }
    else if (act === 'home') { e.preventDefault(); setQuery(''); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  });
  $('#q').addEventListener('input', function () {
    clearTimeout(qT);
    var v = this.value;
    qT = setTimeout(function () { SQ.q = v.trim(); SQ.doc = ''; search(); vLoop(); }, 90);
  });
  $('#q').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setQuery(''); vLoop(); }
    if (e.key === 'Enter') { var first = $('#hits [data-act="hit"]'); if (first) first.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
    if (LB.dlg.open) {
      if (e.key === 'ArrowLeft') { lbStep(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { lbStep(1); e.preventDefault(); }
      return;
    }
    if (RD.dlg.open) {
      if (e.key === 'ArrowLeft' && !typing) { step(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && !typing) { step(1); e.preventDefault(); }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  });
  function readHash() {
    var h = decodeURIComponent(location.hash.slice(1)), m = /^read-(US\w+?)(?:-(abstract|description|claims|drawings|record))?$/.exec(h);
    if (m && D[m[1]]) { openReader(m[1], m[2] || 'abstract'); return; }
    if (h && document.getElementById(h)) requestAnimationFrame(function () { jumpTo(h); });
  }
  window.addEventListener('hashchange', function () {
    var cur = RD.id ? 'read-' + RD.id + (RD.tab !== 'abstract' ? '-' + RD.tab : '') : '';
    if (location.hash.slice(1) === cur) return;
    if (RD.dlg.open && !/^#read-/.test(location.hash)) closeReader();
    readHash();
  });

  /* ════════════ boot ════════════ */
  buildIndex();
  initReadouts();
  initHints();
  buildOverview();
  search();
  initHero();
  readHash();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('14px "Architects Daughter"'), document.fonts.load('500 10px "JetBrains Mono"')]).then(function () {
      heroBuild(); heroRender();
      vizzes.forEach(function (v) { v.key = ''; if (v.on) { vSize(v); vDraw(v, 0); } });
    }, function () { /* fallback faces */ });
  }
  window.PaisPage = { open: openReader, search: setQuery, exhibit: function (i) { heroSet(i, true); } };
})();
