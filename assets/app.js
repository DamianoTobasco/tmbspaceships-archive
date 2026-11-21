/* TMBSPACESHIPS archive browser — search, facets, views, inspector. No dependencies. */
(function () {
  'use strict';

  function showError(msg) {
    var el = document.getElementById('view-stream');
    if (el) el.innerHTML = '<p class="loadline" style="color:var(--alp)">' + msg + '</p>';
  }

  function start(D) {
  var META = D.meta, POSTS = D.posts, PATH = META.paths;
  // 'local' = opened from the archive folder (thumbs/ + ../media/ + ../screenshots/)
  // 'web'   = hosted build: thumbnails live in packs/pNN.json, loaded as they scroll into view
  var MODE = META.mode || 'local';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ───────────── thumbnail packs (web build) ───────────── */
  var MEDIA_PK = new Map(), PACKS = {}, THUMB_URL = new Map();
  POSTS.forEach(function (p) { p.md.forEach(function (m) { if (m.pk != null) MEDIA_PK.set(m.f, m.pk); }); });
  function loadPack(k) {
    if (!PACKS[k]) {
      PACKS[k] = fetch(PATH.packs + 'p' + String(k).padStart(2, '0') + '.json').then(function (r) {
        if (!r.ok) throw new Error('pack ' + k + ': ' + r.status);
        return r.json();
      });
      PACKS[k].catch(function () { delete PACKS[k]; });
    }
    return PACKS[k];
  }
  function thumbURL(f) {
    if (THUMB_URL.has(f)) return Promise.resolve(THUMB_URL.get(f));
    var k = MEDIA_PK.get(f);
    if (k == null) return Promise.reject(new Error('no thumbnail'));
    return loadPack(k).then(function (pack) {
      if (THUMB_URL.has(f)) return THUMB_URL.get(f);
      var bin = atob(pack[f]), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([u8], { type: 'image/jpeg' }));
      THUMB_URL.set(f, url);
      delete pack[f]; // free the base64 copy once decoded
      return url;
    });
  }
  function fillImg(img) {
    var f = img.getAttribute('data-m');
    if (!f) return;
    img.removeAttribute('data-m');
    thumbURL(f).then(function (u) { img.src = u; }, function () { img.setAttribute('data-m', f); });
  }
  var imgIO = MODE === 'web' && 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { imgIO.unobserve(e.target); fillImg(e.target); } });
      }, { rootMargin: '900px 0px' })
    : null;
  function hydrate(root) {
    if (MODE !== 'web') return;
    $$('img[data-m]', root).forEach(function (img) { if (imgIO) imgIO.observe(img); else fillImg(img); });
  }
  function imgSrcAttr(m) {
    if (MODE === 'web') return 'data-m="' + esc(m.f) + '"';
    return 'src="' + esc(m.th ? PATH.thumbs + m.th : PATH.media + m.f) + '"';
  }

  /* ───────────── constants ───────────── */
  var TYPES = [
    { k: 'o', label: 'Original', sp: 'p⁺', name: 'proton' },
    { k: 'r', label: 'Reply', sp: 'e⁻', name: 'electron' },
    { k: 'rt', label: 'Repost', sp: '¹¹B', name: 'boron-11' },
    { k: 'q', label: 'Quote', sp: 'α', name: 'alpha' }
  ];
  var TYPE_BY = {}; TYPES.forEach(function (t) { TYPE_BY[t.k] = t; });
  var TYPE_ALIAS = { original: 'o', originals: 'o', o: 'o', post: 'o', reply: 'r', replies: 'r', r: 'r',
                     repost: 'rt', reposts: 'rt', retweet: 'rt', rt: 'rt', quote: 'q', quotes: 'q', q: 'q' };
  var TOPICS = META.topics;
  var TOPIC_BY = {}; TOPICS.forEach(function (t) { TOPIC_BY[t.k] = t; });

  var stars = new Set();
  try { JSON.parse(localStorage.getItem('tmb.stars') || '[]').forEach(function (id) { stars.add(id); }); } catch (e) { /* storage blocked */ }
  function saveStars() { try { localStorage.setItem('tmb.stars', JSON.stringify(Array.from(stars))); } catch (e) { /* ignore */ } }

  var HAS = [
    { k: 'media', label: 'Has media', test: function (p) { return p.md.length > 0; } },
    { k: 'video', label: 'Video', test: function (p) { return p.md.some(function (m) { return m.ty === 'v'; }); } },
    { k: 'link', label: 'External link', test: function (p) { return p.hasLink; } },
    { k: 'thread', label: 'In a thread', test: function (p) { return (p.th || 0) > 1; } },
    { k: 'star', label: 'Starred ★', test: function (p) { return stars.has(p.id); } }
  ];
  var HAS_BY = {}; HAS.forEach(function (h) { HAS_BY[h.k] = h; });

  /* ───────────── precompute ───────────── */
  var ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
                                               hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' });
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var BY_ID = new Map(), BY_SHOT = new Map(), CONV = new Map(), HANDLE_CASE = new Map(), CANON = new Set();
  var maxViews = 1, totalViews = 0;

  POSTS.forEach(function (p, i) {
    var parts = {};
    ET.formatToParts(new Date(p.t)).forEach(function (x) { parts[x.type] = x.value; });
    var hr = (+parts.hour) % 24;
    p.ymd = parts.year + '-' + parts.month + '-' + parts.day;
    p.ym = p.ymd.slice(0, 7);
    p.y = +parts.year;
    p.hr = hr;
    p.hm = String(hr).padStart(2, '0') + ':' + parts.minute;
    p.wd = WD.indexOf(parts.weekday);
    p.ts = Date.parse(p.t);
    var isRt = p.ty === 'rt' && p.ref && p.ref.x;
    p.body = isRt ? p.ref.x : p.x;
    p.links = isRt ? p.ref.l : p.l;
    p.hay = (p.body + (p.ty === 'q' && p.ref ? '\n' + p.ref.x : '')).toLowerCase();
    var hs = new Set();
    p.rm.forEach(function (h) { hs.add(h.toLowerCase()); if (!CANON.has(h.toLowerCase())) HANDLE_CASE.set(h.toLowerCase(), h); });
    // usernames from the API's user objects carry the canonical capitalisation, so they win
    if (p.ref && p.ref.u) { hs.add(p.ref.u.toLowerCase()); HANDLE_CASE.set(p.ref.u.toLowerCase(), p.ref.u); CANON.add(p.ref.u.toLowerCase()); }
    (p.body.match(/@\w{1,15}/g) || []).forEach(function (h) {
      var k = h.slice(1).toLowerCase(); hs.add(k); if (!HANDLE_CASE.has(k)) HANDLE_CASE.set(k, h.slice(1));
    });
    hs.delete('tmbspaceships');
    p.handles = hs;
    p.target = p.ty === 'r' ? (p.rm[0] || (p.ref && !p.ref.self && p.ref.u) || null) : null;
    p.hasLink = p.links.some(function (l) { return !/^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(l.e); });
    p.len = p.body.length;
    if (p.m[0] > maxViews) maxViews = p.m[0];
    totalViews += p.m[0];
    p._s = 0;
    BY_ID.set(p.id, p);
    BY_SHOT.set(p.n, p);
    if (!CONV.has(p.cv)) CONV.set(p.cv, []);
    CONV.get(p.cv).push(p);
  });
  CONV.forEach(function (arr) { arr.sort(function (a, b) { return a.ts - b.ts; }); });

  var minYm = POSTS.reduce(function (a, p) { return p.ym < a ? p.ym : a; }, '9999');
  var maxYm = POSTS.reduce(function (a, p) { return p.ym > a ? p.ym : a; }, '0000');
  var MONTHS = [];
  (function () {
    var y = +minYm.slice(0, 4), m = +minYm.slice(5), y2 = +maxYm.slice(0, 4), m2 = +maxYm.slice(5);
    while (y < y2 || (y === y2 && m <= m2)) { MONTHS.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  })();
  var MONTH_IDX = new Map(MONTHS.map(function (m, i) { return [m, i]; }));
  var MONTH_TOTAL = MONTHS.map(function () { return 0; });
  POSTS.forEach(function (p) { MONTH_TOTAL[MONTH_IDX.get(p.ym)]++; });
  function monthLabel(ym) { return MON[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4); }

  /* ───────────── helpers ───────────── */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function wb(s) { return /^\w/.test(s) ? '\\b' : ''; }
  function pad(n) { return String(n).padStart(4, '0'); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e4) return Math.round(n / 1e3) + 'K';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }
  function excerpt(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function xurl(p) { return 'https://x.com/' + META.handle + '/status/' + p.id; }
  function stripLead(s) { return (s || '').replace(/^((?:@\w+[\s,]*)+)/, '').trim(); }
  function userLink(u) { return '<a href="https://x.com/' + esc(u) + '" target="_blank" rel="noopener">@' + esc(u) + '</a>'; }

  var REDUCE = /[?&]still=1\b/.test(location.search) || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // ease a displayed number from its last value to a new one
  function tween(el, to, fmtFn, ms) {
    var from = el._v || 0;
    el._v = to;
    if (el._raf) cancelAnimationFrame(el._raf);
    if (REDUCE || document.hidden || from === to) { el.textContent = fmtFn(to); return; }
    var t0 = performance.now();
    (function tick(now) {
      var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmtFn(Math.round(from + (to - from) * e));
      el._raf = k < 1 ? requestAnimationFrame(tick) : 0;
    })(t0);
    // frames can be throttled in a background tab; make sure the final value lands
    setTimeout(function () { if (el._v === to) el.textContent = fmtFn(to); }, ms + 300);
  }
  // restart a CSS animation by re-adding its class
  function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // posts in the top 5% by impressions get a "high flux" tag
  var HI_VIEWS = (function () {
    var v = POSTS.map(function (p) { return p.m[0]; }).sort(function (a, b) { return b - a; });
    return v[Math.floor(v.length * 0.05)] || Infinity;
  })();

  /* ───────────── query language ───────────── */
  var METRIC_IDX = { views: 0, impressions: 0, likes: 1, reposts: 2, retweets: 2, replies: 3, quotes: 4, bookmarks: 5 };
  function cmpParse(v) {
    var m = String(v).match(/^(>=|<=|>|<|=)?\s*([\d.]+)\s*([km]?)$/i);
    if (!m) return null;
    var n = parseFloat(m[2]) * (/k/i.test(m[3]) ? 1e3 : /m/i.test(m[3]) ? 1e6 : 1), op = m[1] || '>=';
    return function (x) { return op === '>' ? x > n : op === '<' ? x < n : op === '<=' ? x <= n : op === '=' ? x === n : x >= n; };
  }
  function dateOk(v) { return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v); }
  var OPS = {
    type: function (v) {
      var ks = v.toLowerCase().split(/[,|]/).map(function (x) { return TYPE_ALIAS[x]; }).filter(Boolean);
      return ks.length ? function (p) { return ks.indexOf(p.ty) >= 0; } : null;
    },
    has: function (v) {
      var fs = v.toLowerCase().split(/[,|]/).map(function (k) {
        if (/^(image|images|photo|photos|pic)$/.test(k)) return function (p) { return p.md.some(function (m) { return m.ty === 'p'; }); };
        if (k === 'screenshot' || k === 'embed') return function (p) { return !!p.sh; };
        if (k === 'links') k = 'link';
        if (k === 'starred' || k === 'stars') k = 'star';
        return HAS_BY[k] ? HAS_BY[k].test : null;
      }).filter(Boolean);
      return fs.length ? function (p) { return fs.some(function (f) { return f(p); }); } : null;
    },
    topic: function (v) {
      var k = v.toLowerCase();
      var t = TOPICS.find(function (t) { return t.k === k || t.label.toLowerCase().indexOf(k) === 0; });
      return t ? function (p) { return p.tp.indexOf(t.k) >= 0; } : null;
    },
    year: function (v) { var y = +v; return y ? function (p) { return p.y === y; } : null; },
    after: function (v) { return dateOk(v) ? function (p) { return p.ymd >= v; } : null; },
    before: function (v) { return dateOk(v) ? function (p) { return p.ymd < v; } : null; },
    on: function (v) { return dateOk(v) ? function (p) { return p.ymd.indexOf(v) === 0; } : null; },
    shot: function (v) { var n = +v; return n ? function (p) { return p.n === n; } : null; },
    id: function (v) { return function (p) { return p.id === v; }; },
    lang: function (v) { return function (p) { return (p.lg || '') === v; }; }
  };
  OPS.is = OPS.type; OPS.since = OPS.after; OPS.until = OPS.before;
  Object.keys(METRIC_IDX).forEach(function (k) {
    OPS[k] = function (v) { var c = cmpParse(v), i = METRIC_IDX[k]; return c ? function (p) { return c(p.m[i]); } : null; };
  });

  function compile(q) {
    var out = { clauses: [], neg: [], ops: [], hl: [], empty: true, hlRe: null };
    var toks = (q || '').match(/-?"[^"]*"?|\S+/g) || [];
    var orNext = false;
    toks.forEach(function (raw) {
      if (raw === 'OR' || raw === '|') { orNext = true; return; }
      var neg = false;
      if (raw.length > 1 && raw[0] === '-') { neg = true; raw = raw.slice(1); }
      var om = raw.match(/^([a-z]+):(.+)$/i);
      if (om && OPS[om[1].toLowerCase()]) {
        var fn = OPS[om[1].toLowerCase()](om[2]);
        if (fn) { out.ops.push(neg ? function (p) { return !fn(p); } : fn); out.empty = false; }
        orNext = false;
        return;
      }
      var term;
      if (raw[0] === '"') {
        var s = raw.replace(/^"|"$/g, '').trim().toLowerCase();
        if (!s) return;
        var body = reEsc(s).replace(/\s+/g, '\\s+');
        term = { kind: 'phrase', re: new RegExp(wb(s) + body, 'g'), hl: wb(s) + body, w: 2.2 };
      } else if (raw[0] === '@' && raw.length > 1) {
        var h = raw.slice(1).toLowerCase().replace(/\W/g, '');
        if (!h) return;
        term = { kind: 'handle', s: h, hl: '@' + reEsc(h) + '\\w*', w: 1.5 };
      } else {
        var w = raw.toLowerCase().replace(/^[^\w#]+|[^\w]+$/g, '');
        if (!w) return;
        term = { kind: 'word', re: new RegExp(wb(w) + reEsc(w), 'g'), ex: new RegExp(wb(w) + reEsc(w) + '(?!\\w)', 'g'),
                 hl: wb(w) + reEsc(w) + '\\w*', w: 1 };
      }
      out.empty = false;
      if (neg) { out.neg.push(term); orNext = false; return; }
      if (orNext && out.clauses.length) out.clauses[out.clauses.length - 1].push(term);
      else out.clauses.push([term]);
      orNext = false;
      out.hl.push(term.hl);
    });
    if (out.hl.length) {
      out.hl.sort(function (a, b) { return b.length - a.length; });
      out.hlRe = new RegExp(out.hl.join('|'), 'gi');
    }
    return out;
  }
  function count(re, s) { re.lastIndex = 0; var n = 0; while (n < 30 && re.exec(s)) n++; return n; }
  function termScore(t, p) {
    if (t.kind === 'handle') {
      if (p.handles.has(t.s)) return 3;
      var hit = false;
      if (t.s.length >= 3) p.handles.forEach(function (h) { if (!hit && h.indexOf(t.s) === 0) hit = true; });
      return hit ? 1.5 : 0;
    }
    var n = count(t.re, p.hay);
    if (!n) return 0;
    var sc = Math.log2(1 + n) * t.w;
    if (t.ex) sc += 0.6 * Math.log2(1 + count(t.ex, p.hay));
    return sc;
  }
  function scoreQuery(p, cq) {
    var i, j;
    for (i = 0; i < cq.ops.length; i++) if (!cq.ops[i](p)) return -1;
    for (i = 0; i < cq.neg.length; i++) if (termScore(cq.neg[i], p) > 0) return -1;
    var s = 0;
    for (i = 0; i < cq.clauses.length; i++) {
      var best = 0, cl = cq.clauses[i];
      for (j = 0; j < cl.length; j++) { var v = termScore(cl[j], p); if (v > best) best = v; }
      if (!best) return -1;
      s += best;
    }
    if (cq.clauses.length) s += 0.12 * Math.log10(1 + p.m[0]);
    return s;
  }

  /* ───────────── text rendering ───────────── */
  var TOKEN_RE = /(https?:\/\/[^\s]+)|(@\w{1,15})|(#[A-Za-z]\w*)/g;
  function hlText(s, re) {
    if (!s) return '';
    if (!re) return esc(s);
    var out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(s.slice(last));
  }
  function fmtText(text, links, re) {
    if (!text) return '';
    var lm = new Map((links || []).map(function (l) { return [l.t, l]; }));
    var out = '', last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      out += hlText(text.slice(last, m.index), re);
      if (m[1]) {
        var url = m[1].replace(/[),.;:!?…"']+$/, ''), tail = m[1].slice(url.length);
        var l = lm.get(url);
        var href = l ? l.e : url, disp = l ? l.d : url.replace(/^https?:\/\//, '');
        if (!/^https?:\/\//i.test(href)) href = url;
        out += '<a class="ext" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(disp) + '</a>' + esc(tail);
      } else if (m[2]) {
        out += '<a class="mention" href="https://x.com/' + esc(m[2].slice(1)) + '" target="_blank" rel="noopener">' + hlText(m[2], re) + '</a>';
      } else {
        out += hlText(m[3], re);
      }
      last = m.index + m[0].length;
    }
    return out + hlText(text.slice(last), re);
  }

  /* ───────────── state ───────────── */
  var state = { q: '', types: new Set(), topics: new Set(), has: new Set(), handles: new Set(), range: null, sort: 'auto', view: 'stream' };
  var cur = { list: [], cq: compile(''), shown: 0, gridItems: [], gridShown: 0, focus: -1, counts: null, mode: 'new' };

  function passType(p) { return !state.types.size || state.types.has(p.ty); }
  function passTopic(p) {
    if (!state.topics.size) return true;
    for (var i = 0; i < p.tp.length; i++) if (state.topics.has(p.tp[i])) return true;
    return false;
  }
  function passHas(p) {
    var ok = true;
    state.has.forEach(function (k) { if (ok && !HAS_BY[k].test(p)) ok = false; });
    return ok;
  }
  function passHandle(p) {
    if (!state.handles.size) return true;
    var ok = false;
    state.handles.forEach(function (h) { if (!ok && p.handles.has(h)) ok = true; });
    return ok;
  }
  function passRange(p) { return !state.range || (p.ym >= state.range[0] && p.ym <= state.range[1]); }

  var SORTS = {
    rel: function (a, b) { return b._s - a._s || b.ts - a.ts; },
    'new': function (a, b) { return b.ts - a.ts; },
    old: function (a, b) { return a.ts - b.ts; },
    views: function (a, b) { return b.m[0] - a.m[0] || b.ts - a.ts; },
    likes: function (a, b) { return b.m[1] - a.m[1] || b.ts - a.ts; },
    bookmarks: function (a, b) { return b.m[5] - a.m[5] || b.ts - a.ts; },
    replies: function (a, b) { return b.m[3] - a.m[3] || b.ts - a.ts; },
    'long': function (a, b) { return b.len - a.len; }
  };

  function compute() {
    var t0 = performance.now();
    var cq = compile(state.q);
    var list = [], cType = {}, cTopic = {}, cHas = {}, cHandle = {}, cMonth = MONTHS.map(function () { return 0; });
    for (var i = 0; i < POSTS.length; i++) {
      var p = POSTS[i];
      var s = cq.empty ? 0 : scoreQuery(p, cq);
      if (s < 0) continue;
      p._s = s;
      var a0 = passType(p), a1 = passTopic(p), a2 = passHas(p), a3 = passHandle(p), a4 = passRange(p);
      if (a0 && a1 && a2 && a3 && a4) list.push(p);
      if (a1 && a2 && a3 && a4) cType[p.ty] = (cType[p.ty] || 0) + 1;
      if (a0 && a2 && a3 && a4) p.tp.forEach(function (k) { cTopic[k] = (cTopic[k] || 0) + 1; });
      if (a0 && a1 && a3 && a4) HAS.forEach(function (h) { if (h.test(p)) cHas[h.k] = (cHas[h.k] || 0) + 1; });
      if (a0 && a1 && a2 && a4 && p.target) { var tk = p.target.toLowerCase(); cHandle[tk] = (cHandle[tk] || 0) + 1; }
      if (a0 && a1 && a2 && a3) cMonth[MONTH_IDX.get(p.ym)]++;
    }
    var mode = state.sort === 'auto' ? (cq.clauses.length ? 'rel' : 'new') : state.sort;
    list.sort(SORTS[mode]);
    cur.list = list; cur.cq = cq; cur.mode = mode; cur.focus = -1;
    cur.counts = { type: cType, topic: cTopic, has: cHas, handle: cHandle, month: cMonth };
    cur.ms = performance.now() - t0;
  }

  /* ───────────── render: chrome ───────────── */
  function renderReadouts() {
    var first = POSTS.reduce(function (a, p) { return p.ts < a.ts ? p : a; });
    var lastP = POSTS.reduce(function (a, p) { return p.ts > a.ts ? p : a; });
    var items = [
      ['Posts', META.count, fmt],
      ['Span', first.ym.replace('-', '.') + ' → ' + lastP.ym.replace('-', '.')],
      ['Σ Views', totalViews, compact],
      ['Media', META.media_files, fmt],
      ['Followers', META.followers, fmt]
    ];
    $('#readouts').innerHTML = items.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + (r[2] ? r[2](r[1]) : r[1]) + '</dd></div>'; }).join('');
    $$('#readouts dd').forEach(function (dd, i) { if (items[i][2]) tween(dd, items[i][1], items[i][2], 1100 + i * 130); });
    $('#footCount').textContent = fmt(META.count) + ' of ' + fmt(META.profile_posts) + ' posts archived';
    $('#q').placeholder = window.innerWidth < 640 ? 'Search ' + fmt(META.count) + ' posts…'
      : 'Search ' + fmt(META.count) + ' posts — words, "phrases", @accounts, type:original…';
    var hints = ['antigravity', '"hydrogen lattice"', 'soliton', 'fusion OR muon', 'plasma propulsion', 'type:original has:media', 'views:>20k', '@ChiefDinger'];
    $('#hints').innerHTML = '<span class="hints-k">Try</span>' + hints.map(function (h) {
      return '<button class="hint" type="button" data-hint="' + esc(h) + '">' + esc(h) + '</button>';
    }).join('');
  }

  function chip(f, k, label, extra, cls) {
    return '<button type="button" class="chip ' + (cls || '') + '" data-f="' + f + '" data-k="' + esc(k) + '" aria-pressed="false">' +
      (extra || '') + '<span class="lab">' + label + '</span><span class="n"></span></button>';
  }
  function buildFacets() {
    $('#fType').innerHTML = TYPES.map(function (t) {
      return chip('types', t.k, t.label, '<span class="dot"></span><span class="sp">' + t.sp + '</span>', 'c-' + t.k);
    }).join('');
    $('#fTopic').innerHTML = TOPICS.map(function (t) { return chip('topics', t.k, esc(t.label)); }).join('');
    $('#fHas').innerHTML = HAS.map(function (h) { return chip('has', h.k, esc(h.label), '', h.k === 'star' ? 'c-hot' : ''); }).join('');
  }
  function renderFacets() {
    var c = cur.counts;
    function upd(sel, f, counts) {
      var chips = $$(sel + ' .chip'), max = 1;
      chips.forEach(function (b) { max = Math.max(max, counts[b.dataset.k] || 0); });
      chips.forEach(function (b) {
        var k = b.dataset.k, n = counts[k] || 0, on = state[f].has(k);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.querySelector('.n').textContent = fmt(n);
        b.classList.toggle('zero', !n && !on);
        b.style.setProperty('--p', (n / max * 100).toFixed(1) + '%');   // share of the largest chip
      });
    }
    upd('#fType', 'types', c.type);
    upd('#fTopic', 'topics', c.topic);
    upd('#fHas', 'has', c.has);

    // handles: top targets for the current query, keeping selected ones visible
    var focusK = document.activeElement && document.activeElement.closest && document.activeElement.closest('#fHandles') ? document.activeElement.dataset.k : null;
    var arr = Object.keys(c.handle).map(function (k) { return [k, c.handle[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var top = arr.slice(0, 12).map(function (x) { return x[0]; });
    state.handles.forEach(function (h) { if (top.indexOf(h) < 0) top.push(h); });
    var hmax = Math.max(1, arr.length ? arr[0][1] : 1);
    $('#fHandles').innerHTML = top.length ? top.map(function (k) {
      var on = state.handles.has(k);
      return '<button type="button" class="chip c-r" style="--p:' + ((c.handle[k] || 0) / hmax * 100).toFixed(1) + '%" data-f="handles" data-k="' + esc(k) + '" aria-pressed="' + on + '">@' +
        esc(HANDLE_CASE.get(k) || k) + '<span class="n">' + fmt(c.handle[k] || 0) + '</span></button>';
    }).join('') : '<span class="side-note" style="margin:0">No replies in these results.</span>';
    if (focusK) { var fb = $('#fHandles [data-k="' + CSS.escape(focusK) + '"]'); if (fb) fb.focus(); }
  }

  function renderStat() {
    var el = $('#stat'), n = cur.list.length;
    if (!el.firstChild) el.innerHTML = '<b aria-hidden="true"></b><span class="sr"></span><span class="of"></span><span class="ms"></span>';
    tween(el.children[0], n, fmt, 260);
    el.children[1].textContent = fmt(n) + ' results';
    el.children[2].textContent = ' / ' + fmt(POSTS.length);
    el.children[3].textContent = ' · ' + cur.ms.toFixed(1) + ' ms';
  }

  function renderPills() {
    var pills = [];
    state.types.forEach(function (k) { pills.push(['types', k, TYPE_BY[k].sp + ' ' + TYPE_BY[k].label]); });
    state.topics.forEach(function (k) { pills.push(['topics', k, '⌁ ' + TOPIC_BY[k].label]); });
    state.has.forEach(function (k) { pills.push(['has', k, HAS_BY[k].label]); });
    state.handles.forEach(function (k) { pills.push(['handles', k, '@' + (HANDLE_CASE.get(k) || k)]); });
    if (state.range) pills.push(['range', '', state.range[0] === state.range[1] ? monthLabel(state.range[0]) : monthLabel(state.range[0]) + ' → ' + monthLabel(state.range[1])]);
    $('#pills').innerHTML = pills.map(function (x) {
      return '<span class="pill">' + esc(x[2]) + '<button type="button" data-pill="' + x[0] + '" data-k="' + esc(x[1]) + '" aria-label="Remove filter ' + esc(x[2]) + '">✕</button></span>';
    }).join('');
  }

  /* ───────────── spectrum ───────────── */
  var SP = { padL: 6, padR: 6, top: 18, H: 132, base: 108, step: 10, W: 800 };
  function barPath(x, yTop, w, base, r) {
    r = Math.min(r, w / 2, (base - yTop));
    return 'M' + x + ',' + base + 'V' + (yTop + r) + 'Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop + r) + 'V' + base + 'Z';
  }
  var spW = 0;
  function buildSpectrum(W) {
    var wrap = $('#spectrumPlot'), n = MONTHS.length;
    SP.W = W; SP.step = (W - SP.padL - SP.padR) / n;
    var bw = Math.max(2, Math.min(SP.step * 0.6, 16)), span = SP.base - SP.top;
    var s = '<svg viewBox="0 0 ' + W + ' ' + SP.H + '" role="img" aria-label="Posts per month, ' + MONTHS[0] + ' to ' + MONTHS[n - 1] + '">';
    s += '<defs><linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0feff"/><stop offset=".3" stop-color="#59f3ff"/><stop offset="1" stop-color="#59f3ff" stop-opacity=".35"/></linearGradient>' +
      '<filter id="spGlow" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    s += '<rect id="spSel" class="sp-sel" rx="4" style="display:none"/>';
    s += '<line class="sp-axis" x1="0" x2="' + W + '" y1="' + (SP.base + 0.5) + '" y2="' + (SP.base + 0.5) + '"/>';
    var bars = '', ghosts = '', axis = '', hits = '';
    MONTHS.forEach(function (m, i) {
      var x0 = SP.padL + i * SP.step, bx = x0 + SP.step / 2 - bw / 2;
      if (MONTH_TOTAL[i]) ghosts += '<path class="sp-ghost" d="' + barPath(bx, SP.base - 3, bw, SP.base, 1) + '"/>';
      // full-height bar, scaled to its value so height changes can ease
      bars += '<rect class="sp-bar" x="' + bx.toFixed(2) + '" y="' + SP.top + '" width="' + bw.toFixed(2) + '" height="' + span + '" rx="2" style="transform:scaleY(0)"/>';
      var mo = +m.slice(5);
      if (mo === 1 || (i === 0 && mo <= 9)) {
        axis += '<line class="sp-tick" x1="' + x0 + '" x2="' + x0 + '" y1="' + SP.base + '" y2="' + (SP.base + 7) + '"/>' +
          '<text class="sp-year" x="' + (x0 + 4) + '" y="' + (SP.H - 8) + '">' + m.slice(0, 4) + '</text>';
      }
      hits += '<rect class="sp-hit" data-i="' + i + '" x="' + x0 + '" y="0" width="' + SP.step + '" height="' + (SP.base + 2) + '"/>' +
        '<rect class="sp-hover" x="' + x0 + '" y="0" width="' + SP.step + '" height="' + SP.base + '" rx="3"/>';
    });
    s += ghosts + '<g filter="url(#spGlow)">' + bars + '</g>' + axis + '<text id="spPeak" class="sp-peak"></text>' + hits +
      '<rect id="spDrag" class="sp-sel" x="0" y="0" width="0" height="0" style="display:none"/></svg>';
    wrap.innerHTML = s;
    spW = W;
    void wrap.offsetWidth;   // flush styles so the bars grow in from zero
  }
  function renderSpectrum() {
    var wrap = $('#spectrumPlot');
    var W = Math.max(280, wrap.clientWidth - 16);
    if (W !== spW || !wrap.querySelector('svg')) buildSpectrum(W);
    var cm = cur.counts.month, span = SP.base - SP.top;
    // scale to the matching posts so a narrow query still reads; months that have posts
    // but no matches keep a faint baseline mark
    var maxT = Math.max(1, Math.max.apply(null, cm));
    var bars = $$('.sp-bar', wrap), hits = $$('.sp-hit', wrap);
    var peakI = -1, peakV = 0;
    MONTHS.forEach(function (m, i) {
      var c = cm[i], tot = MONTH_TOTAL[i];
      var inR = !state.range || (m >= state.range[0] && m <= state.range[1]);
      bars[i].style.transform = 'scaleY(' + (c ? Math.max(c / maxT, 2 / span) : 0).toFixed(4) + ')';
      bars[i].classList.toggle('off', !inR);
      if (c && inR && c > peakV) { peakV = c; peakI = i; }
      hits[i].setAttribute('data-tip', '<b>' + monthLabel(m) + '</b><br>' + fmt(c) + ' matching' +
        (c !== tot ? ' <span class="mut">of ' + fmt(tot) + ' posts</span>' : ' posts') +
        '<br><span class="mut">click to isolate · drag for a window</span>');
    });
    var sel = $('#spSel');
    if (state.range) {
      var i0 = MONTH_IDX.get(state.range[0]), i1 = MONTH_IDX.get(state.range[1]);
      sel.setAttribute('x', SP.padL + i0 * SP.step); sel.setAttribute('y', SP.top - 12);
      sel.setAttribute('width', (i1 - i0 + 1) * SP.step); sel.setAttribute('height', SP.base - SP.top + 12);
      sel.style.display = '';
    } else sel.style.display = 'none';
    $('#spDrag').style.display = 'none';
    var pk = $('#spPeak');
    if (peakI >= 0) {
      var px = SP.padL + peakI * SP.step + SP.step / 2;
      pk.setAttribute('x', px); pk.setAttribute('y', SP.base - Math.max(peakV / maxT * span, 2) - 6);
      pk.setAttribute('text-anchor', px > W - 90 ? 'end' : px < 90 ? 'start' : 'middle');
      pk.textContent = MON[+MONTHS[peakI].slice(5) - 1] + ' ’' + MONTHS[peakI].slice(2, 4) + ' · ' + fmt(peakV);
    } else pk.textContent = '';

    var matched = cm.reduce(function (a, b) { return a + b; }, 0);
    $('#spectrumRead').innerHTML = (state.range
      ? '<span>window <b>' + monthLabel(state.range[0]) + (state.range[1] !== state.range[0] ? ' → ' + monthLabel(state.range[1]) : '') + '</b></span><button type="button" data-act="clear-range">Clear window</button>'
      : '<span><b>' + fmt(matched) + '</b> posts across ' + MONTHS.length + ' months</span>');
  }

  var drag = null;
  function spIdx(e) {
    var svg = $('#spectrumPlot svg'); if (!svg) return null;
    var r = svg.getBoundingClientRect();
    var x = (e.clientX - r.left) * (SP.W / r.width);
    return Math.max(0, Math.min(MONTHS.length - 1, Math.floor((x - SP.padL) / SP.step)));
  }
  function spDrawDrag() {
    var el = $('#spDrag'); if (!el || !drag) return;
    var a = Math.min(drag.a, drag.b), b = Math.max(drag.a, drag.b);
    el.style.display = '';
    el.setAttribute('x', SP.padL + a * SP.step); el.setAttribute('y', SP.top - 12);
    el.setAttribute('width', (b - a + 1) * SP.step); el.setAttribute('height', SP.base - SP.top + 12);
  }
  function bindSpectrum() {
    var plot = $('#spectrumPlot');
    plot.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var i = spIdx(e); if (i == null) return;
      drag = { a: i, b: i, id: e.pointerId };
      try { plot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      spDrawDrag();
    });
    plot.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var i = spIdx(e); if (i == null || i === drag.b) return;
      drag.b = i; spDrawDrag(); hideTip();
    });
    function end() {
      if (!drag) return;
      var a = Math.min(drag.a, drag.b), b = Math.max(drag.a, drag.b);
      drag = null;
      if (a === b && state.range && state.range[0] === MONTHS[a] && state.range[1] === MONTHS[a]) state.range = null;
      else state.range = [MONTHS[a], MONTHS[b]];
      update({ scroll: false });
    }
    plot.addEventListener('pointerup', end);
    plot.addEventListener('pointercancel', function () { drag = null; renderSpectrum(); });
  }

  /* ───────────── cards ───────────── */
  var ICON = {
    v: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.1C1.5 7.6 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.4C19.5 15.4 12 20 12 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    rt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3M17 17H6l3 3M4 13V9a2 2 0 0 1 2-2M20 11v4a2 2 0 0 1-2 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H10l-6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    b: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  };
  function metricsHTML(p) {
    var M = [['v', 0, 'impressions'], ['l', 1, 'likes'], ['rt', 2, 'reposts'], ['r', 3, 'replies'], ['b', 5, 'bookmarks']];
    return M.map(function (x) {
      return '<span class="metric ' + x[0] + '" title="' + fmt(p.m[x[1]]) + ' ' + x[2] + '">' + ICON[x[0]] + compact(p.m[x[1]]) + '</span>';
    }).join('');
  }
  function flux(p) { return Math.max(2, (Math.log10(1 + p.m[0]) / Math.log10(1 + maxViews)) * 100).toFixed(1); }

  function mediaHTML(p, full) {
    var md = p.md, n = md.length;
    if (!n) return '';
    var shown = full ? md : md.slice(0, 4);
    return '<div class="media n' + Math.min(n, 4) + '">' + shown.map(function (m, i) {
      var ar = n === 1 && m.w && m.h ? ' style="aspect-ratio:' + m.w + '/' + m.h + '"' : '';
      var more = !full && i === 3 && n > 4 ? '<span class="plus">+' + (n - 4) + '</span>' : '';
      return '<button type="button" class="tile" data-act="media" data-i="' + i + '"' + ar + ' aria-label="Open ' + (m.ty === 'v' ? 'video' : 'image') + ' ' + (i + 1) + ' of ' + n + '">' +
        '<img ' + imgSrcAttr(m) + ' alt="' + esc(m.alt || '') + '" loading="lazy" decoding="async"' + (m.w ? ' width="' + m.w + '" height="' + m.h + '"' : '') + '>' +
        (m.ty === 'v' ? '<span class="play" aria-hidden="true">▶</span>' : '') + more + '</button>';
    }).join('') + '</div>';
  }

  function ctxHTML(p, full) {
    if (p.ty === 'r') {
      var r = p.ref, who = r && r.u ? userLink(r.u) : p.rm[0] ? userLink(p.rm[0]) : 'a post';
      var inArchive = r && r.id && BY_ID.has(r.id);
      var label = r && r.self ? '↳ Thread continuation' : '↳ Replying to ' + who;
      var extra = p.rm.length > 1 ? ' <span title="' + esc(p.rm.slice(1).map(function (h) { return '@' + h; }).join(' ')) + '">+' + (p.rm.length - 1) + '</span>' : '';
      var txt = r && r.x ? stripLead(r.x) : '';
      return '<div class="ctx"><span class="ctx-k">' + label + extra + '</span>' +
        (inArchive ? ' <button type="button" class="act" data-act="goto" data-id="' + r.id + '">Open parent</button>' : '') +
        (txt ? '<p class="ctx-text">' + fmtText(txt, r.l, null) + '</p>' : '') + '</div>';
    }
    if (p.ty === 'rt') {
      return '<div class="ctx"><span class="ctx-k">↻ Reposted ' + (p.ref && p.ref.u ? userLink(p.ref.u) : '') + '</span></div>';
    }
    return '';
  }
  function quotedHTML(p, re) {
    if (p.ty !== 'q' || !p.ref) return '';
    return '<div class="quoted"><span class="ctx-k">❝ Quoting ' + (p.ref.u ? userLink(p.ref.u) : 'a post') + '</span><p>' + fmtText(p.ref.x, p.ref.l, re) + '</p></div>';
  }

  function cardHTML(p, j) {
    var T = TYPE_BY[p.ty], re = cur.cq.hlRe;
    var lines = (p.body.match(/\n/g) || []).length;
    var long = p.body.length > 720 || lines > 12;
    if (long && re) {
      // don't hide the first match below the fold
      re.lastIndex = 0;
      var fm = re.exec(p.body);
      if (fm && (fm.index > 360 || (p.body.slice(0, fm.index).match(/\n/g) || []).length > 5)) long = false;
    }
    return '<article class="shot enter c-' + p.ty + '" data-id="' + p.id + '" style="--d:' + Math.min(j || 0, 9) + '" tabindex="-1" aria-label="' + esc(T.label + ', ' + p.ymd + ': ' + excerpt(p.body, 80)) + '">' +
      '<header class="shot-head">' +
        '<span class="tok" aria-hidden="true"><b>' + T.sp + '</b></span>' +
        '<div class="shot-id">' +
          '<div class="shot-kind"><span class="k">' + T.label + '</span><span class="shot-no"><i>SHOT</i> ' + pad(p.n) + '</span>' +
            (p.m[0] >= HI_VIEWS ? '<span class="hi" title="Top 5% of the archive by impressions">⚡ High flux</span>' : '') +
          '</div>' +
          '<time datetime="' + p.t + '" title="' + esc(p.t.replace('.000Z', ' UTC').replace('T', ' ')) + '">' + p.ymd + ' · ' + p.hm + ' ET</time>' +
        '</div>' +
        '<span class="grow"></span>' +
        '<button type="button" class="head-btn star" data-act="star" aria-pressed="' + stars.has(p.id) + '" aria-label="Star this post" title="Star (s)">★</button>' +
        '<a class="head-btn" href="' + xurl(p) + '" target="_blank" rel="noopener" aria-label="Open on X" title="Open on X">↗</a>' +
      '</header>' +
      ctxHTML(p) +
      (p.body ? '<div class="body' + (long ? ' clamp' : '') + '">' + fmtText(p.body, p.links, re) + '</div>' +
        (long ? '<button type="button" class="more-btn" data-act="expand">Expand ↓</button>' : '') : '') +
      quotedHTML(p, re) +
      mediaHTML(p, false) +
      '<footer class="shot-foot">' +
        '<div class="metrics">' + metricsHTML(p) + '</div>' +
        '<span class="flux" title="Reach vs. the archive peak (log scale)"><i style="width:' + flux(p) + '%"></i></span>' +
        '<div class="tags">' + p.tp.map(function (k) {
          return '<button type="button" class="tag' + (state.topics.has(k) ? ' on' : '') + '" data-act="topic" data-k="' + k + '" title="Filter: ' + esc(TOPIC_BY[k].label) + '">#' + k + '</button>';
        }).join('') + '</div>' +
        '<div class="actions">' +
          (p.th ? '<button type="button" class="act" data-act="thread">Thread ' + p.th + '</button>' : '') +
          (p.sh ? '<button type="button" class="act" data-act="embed">Embed</button>' : '') +
          '<button type="button" class="act" data-act="inspect">Inspect</button>' +
        '</div>' +
      '</footer>' +
    '</article>';
  }

  /* ───────────── views ───────────── */
  var STREAM_PAGE = 30, GRID_PAGE = 72;
  function renderStream(reset) {
    var el = $('#view-stream');
    if (reset) { el.innerHTML = ''; cur.shown = 0; }
    var next = cur.list.slice(cur.shown, cur.shown + STREAM_PAGE);
    if (next.length) el.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
    cur.shown += next.length;
    hydrate(el);
  }
  function renderGrid(reset) {
    var el = $('#view-grid');
    if (reset) {
      el.innerHTML = ''; cur.gridShown = 0; cur.gridItems = [];
      cur.list.forEach(function (p) { p.md.forEach(function (m, i) { cur.gridItems.push({ p: p, i: i }); }); });
    }
    var next = cur.gridItems.slice(cur.gridShown, cur.gridShown + GRID_PAGE);
    el.insertAdjacentHTML('beforeend', next.map(function (it, j) {
      var m = it.p.md[it.i];
      return '<button type="button" class="mcell" data-act="gridmedia" data-g="' + (cur.gridShown + j) + '" aria-label="' + esc((m.ty === 'v' ? 'Video' : 'Image') + ' from ' + it.p.ymd + ': ' + excerpt(it.p.body, 60)) + '">' +
        '<img ' + imgSrcAttr(m) + ' alt="" loading="lazy" decoding="async">' +
        (m.ty === 'v' ? '<span class="vtag">VIDEO</span>' : '') +
        '<span class="cap">' + pad(it.p.n) + ' · ' + it.p.ymd + '<br>' + esc(excerpt(it.p.body, 70)) + '</span></button>';
    }).join(''));
    cur.gridShown += next.length;
    hydrate(el);
  }

  function hbars(rows, max, act) {
    return '<div class="hbars">' + rows.map(function (r, i) {
      return '<button type="button" class="hbar" style="--i:' + i + '" data-act="' + act + '" data-k="' + esc(r.k) + '" data-tip="' + esc('<b>' + esc(r.label) + '</b><br>' + fmt(r.v) + ' posts · click to filter') + '">' +
        '<span class="lab">' + esc(r.label) + '</span><span class="trk"><i style="width:' + Math.max(1, (r.v / max) * 100).toFixed(1) + '%"></i></span><span class="val">' + fmt(r.v) + '</span></button>';
    }).join('') + '</div>';
  }
  function renderTelemetry() {
    var L = cur.list, el = $('#view-telemetry');
    if (!L.length) { el.innerHTML = ''; return; }
    function sum(i) { return L.reduce(function (a, p) { return a + p.m[i]; }, 0); }
    var views = L.map(function (p) { return p.m[0]; }).sort(function (a, b) { return a - b; });
    var med = views[Math.floor(views.length / 2)];
    var withMedia = L.filter(function (p) { return p.md.length; }).length;
    var h = '';
    var kpis = [['Posts', L.length, fmt], ['Σ Impressions', sum(0), compact], ['Σ Likes', sum(1), compact],
                ['Σ Bookmarks', sum(5), compact], ['Median views', med, compact], ['With media', withMedia, fmt]];
    h += '<dl class="t-kpis">' + kpis.map(function (k) { return '<div class="kpi"><dt>' + k[0] + '</dt><dd>' + k[2](k[1]) + '</dd></div>'; }).join('') + '</dl>';

    // monthly impressions
    var mv = MONTHS.map(function () { return 0; }), mc = MONTHS.map(function () { return 0; });
    L.forEach(function (p) { var i = MONTH_IDX.get(p.ym); mv[i] += p.m[0]; mc[i]++; });
    var mmax = Math.max.apply(null, mv) || 1;
    h += '<section class="panel t-wide"><div class="panel-head"><h2><span class="ph-k">Reach by month</span><span class="ph-sub">Σ impressions of matching posts</span></h2></div><div class="t-body">' +
      '<div class="cols">' + mv.map(function (v, i) {
        return '<span class="col" style="--i:' + i + '" data-tip="' + esc('<b>' + monthLabel(MONTHS[i]) + '</b><br>' + fmt(v) + ' impressions<br><span class="mut">' + fmt(mc[i]) + ' posts</span>') + '"><i style="height:' + (v ? Math.max(1.5, (v / mmax) * 100) : 0).toFixed(2) + '%"></i></span>';
      }).join('') + '</div><div class="cols-x"><span>' + monthLabel(MONTHS[0]) + '</span><span>' + monthLabel(MONTHS[MONTHS.length - 1]) + '</span></div></div></section>';

    // top 10
    var top = L.slice().sort(SORTS.views).slice(0, 10), tmax = top[0] ? top[0].m[0] || 1 : 1;
    h += '<section class="panel t-wide"><div class="panel-head"><h2><span class="ph-k">Peak transmissions</span><span class="ph-sub">top 10 by impressions</span></h2></div><div class="t-body"><ol class="toplist">' +
      top.map(function (p, i) {
        return '<li style="--i:' + i + '"><button type="button" data-act="open" data-id="' + p.id + '"><span class="rk">' + String(i + 1).padStart(2, '0') + '</span><span class="dt">' + p.ymd + '</span><span class="ex">' + esc(excerpt(p.body || '[media]', 140)) + '</span>' +
          '<span class="vv">' + fmt(p.m[0]) + '<i style="width:' + ((p.m[0] / tmax) * 100).toFixed(1) + '%"></i></span></button></li>';
      }).join('') + '</ol></div></section>';

    // heatmap
    var hm = WD.map(function () { return new Array(24).fill(0); }), hmax = 0;
    L.forEach(function (p) { if (p.wd >= 0) { hm[p.wd][p.hr]++; if (hm[p.wd][p.hr] > hmax) hmax = hm[p.wd][p.hr]; } });
    var heat = '<div class="heat"><span></span>';
    for (var hr = 0; hr < 24; hr++) heat += '<span class="hh">' + (hr % 6 === 0 ? hr : '') + '</span>';
    WD.forEach(function (d, wi) {
      heat += '<span class="hl">' + d + '</span>';
      for (var hh = 0; hh < 24; hh++) {
        var c = hm[wi][hh], a = c ? (0.12 + 0.88 * (c / hmax)) : 0;
        heat += '<span class="cell" style="--a:' + a.toFixed(3) + ';--i:' + (wi + hh) + '" data-tip="' + esc('<b>' + d + ' ' + String(hh).padStart(2, '0') + ':00 ET</b><br>' + fmt(c) + ' posts') + '"></span>';
      }
    });
    heat += '</div><div class="heat-legend">fewer' + [0.12, 0.34, 0.56, 0.78, 1].map(function (a) { return '<i style="--a:' + a + '"></i>'; }).join('') + 'more · peak ' + fmt(hmax) + '</div>';
    h += '<section class="panel t-wide"><div class="panel-head"><h2><span class="ph-k">Activity matrix</span><span class="ph-sub">weekday × hour, US Eastern</span></h2></div><div class="t-body">' + heat + '</div></section>';

    // topics
    var tc = TOPICS.map(function (t) { return { k: t.k, label: t.label, v: L.filter(function (p) { return p.tp.indexOf(t.k) >= 0; }).length }; })
      .sort(function (a, b) { return b.v - a.v; });
    h += '<section class="panel t-half"><div class="panel-head"><h2><span class="ph-k">Field line density</span><span class="ph-sub">posts per topic</span></h2></div><div class="t-body">' +
      hbars(tc, Math.max(1, tc[0].v), 'topic') + '</div></section>';

    // reply targets
    var rc = {};
    L.forEach(function (p) { if (p.target) { var k = p.target.toLowerCase(); rc[k] = (rc[k] || 0) + 1; } });
    var rrows = Object.keys(rc).map(function (k) { return { k: k, label: '@' + (HANDLE_CASE.get(k) || k), v: rc[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 10);
    h += '<section class="panel t-half"><div class="panel-head"><h2><span class="ph-k">Most addressed</span><span class="ph-sub">reply targets</span></h2></div><div class="t-body">' +
      (rrows.length ? hbars(rrows, rrows[0].v, 'handle') : '<p class="t-note">No replies in these results.</p>') + '</div></section>';

    // species
    var sc = {}; L.forEach(function (p) { sc[p.ty] = (sc[p.ty] || 0) + 1; });
    h += '<section class="panel t-wide"><div class="panel-head"><h2><span class="ph-k">Species mix</span><span class="ph-sub">post types</span></h2></div><div class="t-body"><div class="species">' +
      TYPES.map(function (t, i) {
        var v = sc[t.k] || 0;
        return '<div class="sp-tile c-' + t.k + '" style="--i:' + i + '"><div class="k"><span class="dot"></span>' + t.sp + ' ' + t.label + '</div><div class="v">' + fmt(v) + '</div><div class="p">' + (L.length ? ((v / L.length) * 100).toFixed(1) : 0) + '%</div></div>';
      }).join('') + '</div><p class="t-note" style="margin:12px 0 0">Original = proton, reply = electron, repost = boron-11, quote = alpha.</p></div></section>';

    el.innerHTML = h;
    if (el.classList.contains('swap')) $$('.kpi dd', el).forEach(function (dd, i) { tween(dd, kpis[i][1], kpis[i][2], 900); });
  }

  function renderView(reset) {
    var v = state.view;
    $('#view-stream').hidden = v !== 'stream';
    $('#view-grid').hidden = v !== 'grid';
    $('#view-telemetry').hidden = v !== 'telemetry';
    $$('.tabs [role="tab"]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'); });
    var empty = (!cur.list.length) || (v === 'grid' && reset !== false && !cur.list.some(function (p) { return p.md.length; }));
    if (v === 'stream') renderStream(true);
    else if (v === 'grid') renderGrid(true);
    else renderTelemetry();
    $('#empty').hidden = !empty;
    if (empty && v === 'grid' && cur.list.length) $('#empty p').textContent = 'None of the matching posts carry images or video.';
    else $('#empty p').textContent = 'Nothing in the archive matches this query. Loosen a filter or try a shorter word.';
    $('#sentinel').hidden = v === 'telemetry';
  }

  /* ───────────── update + url state ───────────── */
  var lastResultKey = '';
  function update(opts) {
    opts = opts || {};
    compute();
    renderStat();
    renderPills();
    renderFacets();
    renderSpectrum();
    renderView();
    writeHash();
    var key = cur.list.length + ':' + state.q;
    if (opts.fire && key !== lastResultKey) {
      if (window.Reactor) window.Reactor.fire(1);
      replay($('#spectrumPlot'), 'scan');
      replay($('.console'), 'ping');
    }
    lastResultKey = key;
    if (opts.scroll !== false) {
      var deck = $('#results'), top = deck.getBoundingClientRect().top + window.scrollY - 150;
      if (window.scrollY > top + 40) window.scrollTo({ top: top, behavior: 'auto' });
    }
  }

  var inspId = null, inspTab = 'post';
  // The hosted viewer passes only a plain #name through shared links, so the web build uses
  // #shot-1234 for a post and #spectrograph / #telemetry for views.
  var VIEW_HASH = { grid: 'spectrograph', telemetry: 'telemetry' };
  function writeHash() {
    if (MODE === 'web') {
      var nm = inspId ? 'shot-' + BY_ID.get(inspId).n : (VIEW_HASH[state.view] || '');
      if (location.hash.slice(1) === nm) return;
      try { history.replaceState(null, '', nm ? '#' + nm : location.pathname + location.search); } catch (e) { /* ignore */ }
      return;
    }
    var h = new URLSearchParams();
    if (state.q) h.set('q', state.q);
    if (state.types.size) h.set('type', Array.from(state.types).join(','));
    if (state.topics.size) h.set('topic', Array.from(state.topics).join(','));
    if (state.has.size) h.set('has', Array.from(state.has).join(','));
    if (state.handles.size) h.set('acct', Array.from(state.handles).join(','));
    if (state.range) { h.set('from', state.range[0]); h.set('until', state.range[1]); }
    if (state.sort !== 'auto') h.set('sort', state.sort);
    if (state.view !== 'stream') h.set('view', state.view);
    if (inspId) h.set('post', inspId);
    var s = h.toString();
    try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (e) { /* file:// quirks */ }
  }
  function readHash() {
    if (MODE === 'web') {
      var name = location.hash.slice(1), sm = name.match(/^shot-(\d+)$/);
      if (name === 'pais-patents') { location.replace('pais.html'); return null; }   // the old Pais tab is its own page now
      state.view = name === 'spectrograph' ? 'grid' : name === 'telemetry' ? 'telemetry' : 'stream';
      var sp = sm && BY_SHOT.get(+sm[1]);
      return sp ? sp.id : null;
    }
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get('view') === 'patents') { location.replace('pais.html'); return null; }   // the old Pais tab is its own page now
    state.q = h.get('q') || '';
    function set(name, valid) { return new Set((h.get(name) || '').split(',').filter(function (x) { return x && valid(x); })); }
    state.types = set('type', function (k) { return !!TYPE_BY[k]; });
    state.topics = set('topic', function (k) { return !!TOPIC_BY[k]; });
    state.has = set('has', function (k) { return !!HAS_BY[k]; });
    state.handles = set('acct', function (k) { return /^\w+$/.test(k); });
    var f = h.get('from'), u = h.get('until');
    state.range = f && u && MONTH_IDX.has(f) && MONTH_IDX.has(u) ? [f, u] : null;
    state.sort = SORTS[h.get('sort')] ? h.get('sort') : 'auto';
    state.view = ['stream', 'grid', 'telemetry'].indexOf(h.get('view')) >= 0 ? h.get('view') : 'stream';
    $('#q').value = state.q;
    $('#sort').value = state.sort;
    return h.get('post');
  }

  /* ───────────── inspector ───────────── */
  var inspDlg = $('#inspect'), lbDlg = $('#lightbox'), helpDlg = $('#help');
  var lastFocus = null;
  // slide the inspector's content in from the side it came from (or fade for a tab change)
  function swapBody(cls) {
    var b = $('#inspBody');
    b.classList.remove('sw-next', 'sw-prev', 'sw-tab');
    if (cls) replay(b, cls);
  }
  function openInspect(id, tab, anim) {
    var p = BY_ID.get(id);
    if (!p) return;
    if (!inspDlg.open) lastFocus = document.activeElement;
    inspId = id;
    inspTab = tab || 'post';
    if (inspTab === 'embed' && !p.sh) inspTab = 'post';
    if (inspTab === 'thread' && !p.th) inspTab = 'post';
    renderInspect();
    swapBody(anim);
    if (!inspDlg.open) inspDlg.showModal();
    $('#inspBody').scrollTop = 0;
    writeHash();
  }
  function renderInspect() {
    var p = BY_ID.get(inspId), T = TYPE_BY[p.ty], re = cur.cq.hlRe;
    $('#inspTitle').innerHTML = '<span class="badge c-' + p.ty + '"><span class="bsp">' + T.sp + '</span>' + T.label + '</span><span class="shot-no">SHOT ' + pad(p.n) + '</span><time datetime="' + p.t + '">' + p.ymd + ' · ' + p.hm + ' ET</time>';
    var tabs = [['post', 'Post']];
    if (p.sh) tabs.push(['embed', 'Official embed']);
    if (p.th) tabs.push(['thread', 'Conversation · ' + p.th]);
    $('#inspTabs').innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (t[0] === inspTab) + '">' + t[1] + '</button>';
    }).join('');
    var b = '';
    if (inspTab === 'post') {
      b += ctxHTML(p, true);
      if (p.body) b += '<div class="body">' + fmtText(p.body, p.links, re) + '</div>';
      b += quotedHTML(p, re);
      b += mediaHTML(p, true);
      var M = [['Impressions', 0], ['Likes', 1], ['Reposts', 2], ['Replies', 3], ['Quotes', 4], ['Bookmarks', 5]];
      b += '<dl class="insp-meta">' + M.map(function (m) { return '<div><dt>' + m[0] + '</dt><dd>' + fmt(p.m[m[1]]) + '</dd></div>'; }).join('') + '</dl>';
      var ext = p.links.filter(function (l) { return !/^https?:\/\/(www\.)?(x|twitter)\.com\//i.test(l.e); });
      if (ext.length) b += '<div class="insp-links">' + ext.map(function (l) { return '<span><span class="lk">LINK →</span> <a href="' + esc(l.e) + '" target="_blank" rel="noopener noreferrer">' + esc(l.e) + '</a></span>'; }).join('') + '</div>';
      b += '<div class="insp-row">' +
        '<a class="tool-btn" href="' + xurl(p) + '" target="_blank" rel="noopener">Open on X ↗</a>' +
        '<button type="button" class="tool-btn" data-act="copy-link">Copy link</button>' +
        '<button type="button" class="tool-btn" data-act="copy-text">Copy text</button>' +
        '<button type="button" class="tool-btn star" data-act="star" aria-pressed="' + stars.has(p.id) + '">' + (stars.has(p.id) ? '★ Starred' : '☆ Star') + '</button>' +
        (p.tp.length ? '<span class="tags" style="align-self:center">' + p.tp.map(function (k) { return '<button type="button" class="tag" data-act="topic" data-k="' + k + '">#' + k + '</button>'; }).join('') + '</span>' : '') +
        '</div>';
      b += '<p class="t-note" style="margin:14px 0 0">Post ID ' + p.id + ' · ' + esc(p.t.replace('.000Z', ' UTC').replace('T', ' ')) + (p.lg ? ' · lang ' + esc(p.lg) : '') + '</p>';
    } else if (inspTab === 'embed') {
      b += '<p class="shot-note">X’s official embed, rendered at 2× when the archive was built · ' + esc(p.sh) + '</p>' +
        '<div class="shot-img"><img src="' + esc(PATH.shots + p.sh) + '" alt="Screenshot of this post as rendered by X’s official embed" loading="lazy"></div>';
    } else {
      var conv = CONV.get(p.cv) || [p];
      b += '<p class="shot-note" style="text-align:left">Posts from @' + META.handle + ' in this conversation, oldest first.</p><div class="thread">' +
        conv.map(function (q) {
          return '<button type="button" class="thread-item' + (q.id === p.id ? ' cur' : '') + '" data-act="goto" data-id="' + q.id + '">' +
            '<span class="ti-d">' + pad(q.n) + '<br>' + q.ymd + '<br>' + q.hm + ' ET</span><span class="ti-x">' + esc(q.body || '[media only]') + '</span></button>';
        }).join('') + '</div>';
    }
    $('#inspBody').innerHTML = b;
    hydrate($('#inspBody'));
    var i = cur.list.indexOf(p);
    $('[data-act="prev"]', inspDlg).disabled = i <= 0;
    $('[data-act="next"]', inspDlg).disabled = i < 0 || i >= cur.list.length - 1;
  }
  function navInspect(d) {
    var p = BY_ID.get(inspId), i = cur.list.indexOf(p);
    if (i < 0) return;
    var n = cur.list[i + d];
    if (n) openInspect(n.id, inspTab === 'thread' ? 'post' : inspTab, d > 0 ? 'sw-next' : 'sw-prev');
  }
  inspDlg.addEventListener('close', function () {
    inspId = null;
    writeHash();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  });

  /* ───────────── lightbox ───────────── */
  var lb = { items: [], k: 0 };
  function openLightbox(items, k) {
    lb.items = items; lb.k = k;
    renderLb();
    if (!lbDlg.open) lbDlg.showModal();
  }
  function renderLb() {
    var it = lb.items[lb.k], p = it.p, m = p.md[it.i];
    var src = PATH.media + m.f;
    var alt = esc(m.alt || 'Image from post ' + pad(p.n));
    if (MODE === 'web') {
      // hosted build: videos ship as files; photos show the packed thumbnail and link to the original on X
      $('#lbStage').innerHTML = m.ty === 'v'
        ? '<video src="' + esc(src) + '" controls autoplay playsinline></video>'
        : '<img data-m="' + esc(m.f) + '" alt="' + alt + '">';
      var mine = lb.k;
      thumbURL(m.f).then(function (u) {
        if (lb.k !== mine) return;
        var v = $('#lbStage video'), im = $('#lbStage img');
        if (v) v.poster = u; else if (im) { im.removeAttribute('data-m'); im.src = u; }
      }, function () { /* no thumbnail: the link below still opens the original */ });
      src = m.ty === 'v' ? src : (m.u || xurl(p));
    } else {
      // 'local' shows the full-size file from ../media; 'public' ships only thumbnails for
      // photos, so it shows the thumbnail and links to the full-size original on X
      var shown = MODE === 'local' || m.ty === 'v' ? src : (m.th ? PATH.thumbs + m.th : src);
      $('#lbStage').innerHTML = m.ty === 'v'
        ? '<video src="' + esc(src) + '" controls autoplay playsinline' + (m.th ? ' poster="' + esc(PATH.thumbs + m.th) + '"' : '') + '></video>'
        : '<img src="' + esc(shown) + '" alt="' + alt + '">';
      if (MODE !== 'local' && m.ty !== 'v') src = m.u || xurl(p);
    }
    $('#lbCap').innerHTML = '<span class="shot-no">SHOT ' + pad(p.n) + ' · ' + p.ymd + '</span>' + esc(excerpt(p.body || '', 140)) +
      ' <button type="button" class="act" data-act="lb-inspect">Inspect</button>';
    $('#lbCount').textContent = (lb.k + 1) + ' / ' + lb.items.length;
    $('#lbOpen').href = src;
    $('[data-act="lb-prev"]', lbDlg).disabled = lb.k <= 0;
    $('[data-act="lb-next"]', lbDlg).disabled = lb.k >= lb.items.length - 1;
  }
  function navLb(d) {
    var k = lb.k + d;
    if (k < 0 || k >= lb.items.length) return;
    lb.k = k; renderLb();
  }
  lbDlg.addEventListener('close', function () { $('#lbStage').innerHTML = ''; });

  /* ───────────── tooltip + toast ───────────── */
  var tip = $('#tip');
  function showTip(el, e) {
    tip.innerHTML = el.getAttribute('data-tip');
    tip.hidden = false;
    moveTip(e);
  }
  function moveTip(e) {
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = e.clientX + 14, y = e.clientY - h - 12;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y < 8) y = e.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.hidden = true; }
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('[data-tip]');
    if (el && !drag) showTip(el, e); else hideTip();
  });
  document.addEventListener('mousemove', function (e) { if (!tip.hidden) moveTip(e); });
  document.addEventListener('scroll', hideTip, { passive: true });

  var toastT = 0;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 1800);
  }
  function copy(text, msg) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      (inspDlg.open ? inspDlg : document.body).appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(msg); } catch (e) { toast('Copy failed'); }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast(msg); }, fallback);
    else fallback();
  }

  /* ───────────── actions ───────────── */
  function toggle(f, k) {
    if (f === 'range') { state.range = null; }
    else if (state[f].has(k)) state[f].delete(k); else state[f].add(k);
    update();
  }
  function toggleStar(id) {
    if (stars.has(id)) stars.delete(id); else stars.add(id);
    saveStars();
    $$('[data-id="' + id + '"] .star, #inspect .star').forEach(function (b) {
      var on = stars.has(id);
      b.setAttribute('aria-pressed', on);
      if (on) replay(b, 'pop');
      if (b.closest('#inspect')) b.textContent = on ? '★ Starred' : '☆ Star';
    });
    toast(stars.has(id) ? '★ Starred — find it under Payload › Starred' : 'Star removed');
    if (state.has.has('star')) update({ scroll: false });
    else { compute(); renderFacets(); }
  }
  var swapT = 0;
  function setView(v) {
    if (v === state.view) return;
    state.view = v;
    var tel = $('#view-telemetry');
    tel.classList.toggle('swap', v === 'telemetry');   // charts animate in only on a view switch
    renderView();
    replay($('#view-' + v), 'viewin');
    clearTimeout(swapT);
    if (v === 'telemetry') swapT = setTimeout(function () { tel.classList.remove('swap'); }, 1900);
    writeHash();
  }
  function resetAll() {
    state.q = ''; $('#q').value = '';
    state.types.clear(); state.topics.clear(); state.has.clear(); state.handles.clear(); state.range = null; state.sort = 'auto';
    $('#sort').value = 'auto';
    update();
  }
  function randomPost() {
    var L = cur.list.length ? cur.list : POSTS;
    openInspect(L[(Math.random() * L.length) | 0].id);
    if (window.Reactor) window.Reactor.fire(2);
  }
  function focusCard(i) {
    if (state.view !== 'stream' || !cur.list.length) return;
    i = Math.max(0, Math.min(cur.list.length - 1, i));
    while (i >= cur.shown && cur.shown < cur.list.length) renderStream(false);
    var prev = $('.shot.focused'); if (prev) prev.classList.remove('focused');
    var el = $('#view-stream .shot[data-id="' + cur.list[i].id + '"]');
    if (!el) return;
    cur.focus = i;
    el.classList.add('focused');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var hint = t.closest('[data-hint]');
    if (hint) {
      $('#q').value = hint.dataset.hint; state.q = hint.dataset.hint; update({ fire: true, scroll: false });
      if (window.Reactor) window.Reactor.fire(2);
      var top = $('#spectrum').getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: 'smooth' });
      return;
    }
    var chipEl = t.closest('.chip[data-f]');
    if (chipEl) { toggle(chipEl.dataset.f, chipEl.dataset.k); return; }
    var pill = t.closest('[data-pill]');
    if (pill) { toggle(pill.dataset.pill, pill.dataset.k); return; }
    var tab = t.closest('.tabs [data-view]');
    if (tab) { setView(tab.dataset.view); return; }
    var itab = t.closest('#inspTabs [data-tab]');
    if (itab) { inspTab = itab.dataset.tab; renderInspect(); swapBody('sw-tab'); $('#inspBody').scrollTop = 0; return; }

    var actEl = t.closest('[data-act]');
    var card = t.closest('.shot');
    var p = card ? BY_ID.get(card.dataset.id) : inspDlg.open && inspDlg.contains(t) ? BY_ID.get(inspId) : null;
    if (actEl) {
      var act = actEl.dataset.act;
      switch (act) {
        case 'home': e.preventDefault(); resetAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
        case 'reset': resetAll(); return;
        case 'clear-range': state.range = null; update({ scroll: false }); return;
        case 'expand':
          var body = actEl.previousElementSibling;
          var open = body.classList.toggle('clamp');
          actEl.textContent = open ? 'Expand ↓' : 'Collapse ↑';
          return;
        case 'star': if (p) toggleStar(p.id); return;
        case 'topic':
          if (inspDlg.open) inspDlg.close();
          toggle('topics', actEl.dataset.k); return;
        case 'handle':
          toggle('handles', actEl.dataset.k); return;
        case 'inspect': if (p) openInspect(p.id, 'post'); return;
        case 'embed': if (p) openInspect(p.id, 'embed'); return;
        case 'thread': if (p) openInspect(p.id, 'thread'); return;
        case 'open': openInspect(actEl.dataset.id, 'post'); return;
        case 'goto': openInspect(actEl.dataset.id, 'post'); return;
        case 'media':
          if (p) openLightbox(p.md.map(function (m, i) { return { p: p, i: i }; }), +actEl.dataset.i);
          return;
        case 'gridmedia': openLightbox(cur.gridItems, +actEl.dataset.g); return;
        case 'prev': navInspect(-1); return;
        case 'next': navInspect(1); return;
        case 'close': inspDlg.close(); return;
        case 'copy-link': if (p) copy(xurl(p), 'Link copied'); return;
        case 'copy-text': if (p) copy(p.body, 'Text copied'); return;
        case 'lb-prev': navLb(-1); return;
        case 'lb-next': navLb(1); return;
        case 'lb-close': lbDlg.close(); return;
        case 'lb-inspect': var it = lb.items[lb.k]; lbDlg.close(); openInspect(it.p.id, 'post'); return;
        case 'help-close': helpDlg.close(); return;
      }
    }
    // click on card surface → inspect (but not when selecting text or on links)
    if (card && !t.closest('a, button') && (!window.getSelection || window.getSelection().isCollapsed)) {
      openInspect(card.dataset.id, 'post');
    }
  });

  // close dialogs when the backdrop is clicked
  [inspDlg, lbDlg, helpDlg].forEach(function (d) {
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      if (d === lbDlg) { d.close(); return; }
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });
  $('#lbStage').addEventListener('click', function (e) { if (e.target === e.currentTarget) lbDlg.close(); });

  /* ───────────── inputs ───────────── */
  var qT = 0, busyT = 0;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(qT);
    var v = e.target.value, box = $('.console');
    box.classList.add('busy');
    clearTimeout(busyT); busyT = setTimeout(function () { box.classList.remove('busy'); }, 500);
    qT = setTimeout(function () { state.q = v; update({ fire: true, scroll: false }); }, 90);
  });
  $('#q').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearTimeout(qT);
      state.q = e.target.value; update({ fire: true, scroll: false });
      if (window.Reactor) window.Reactor.fire(3);
      var top = $('#spectrum').getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY < top - 40) window.scrollTo({ top: top, behavior: 'smooth' });
      if (cur.list.length === 1) openInspect(cur.list[0].id);
    }
  });
  $('#sort').addEventListener('change', function (e) { state.sort = e.target.value; update(); });
  $('#randomBtn').addEventListener('click', randomPost);
  $('#helpBtn').addEventListener('click', function () { helpDlg.showModal(); });
  $('#filtersToggle').addEventListener('click', function (e) {
    var side = $('#side'), open = side.classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', open);
  });

  document.addEventListener('keydown', function (e) {
    var ae = document.activeElement;
    var inField = ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (lbDlg.open) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); navLb(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navLb(1); }
      return;
    }
    if (inspDlg.open) {
      if (inField) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navInspect(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navInspect(1); }
      else if (e.key === 's') toggleStar(inspId);
      return;
    }
    if (helpDlg.open) return;
    if (inField) {
      if (e.key === 'Escape' && ae.id === 'q') { if (!ae.value) ae.blur(); }
      if (e.key === 'ArrowDown' && ae.id === 'q' && state.view === 'stream') { e.preventDefault(); ae.blur(); focusCard(0); }
      return;
    }
    switch (e.key) {
      case '/': e.preventDefault(); $('#q').focus(); $('#q').select(); break;
      case 'j': e.preventDefault(); focusCard(cur.focus + 1); break;
      case 'k': e.preventDefault(); focusCard(cur.focus - 1); break;
      case 'Enter':
        if (cur.focus >= 0 && ae && ae.classList && ae.classList.contains('shot')) { e.preventDefault(); openInspect(cur.list[cur.focus].id); }
        break;
      case 's': if (cur.focus >= 0) toggleStar(cur.list[cur.focus].id); break;
      case '1': setView('stream'); break;
      case '2': setView('grid'); break;
      case '3': setView('telemetry'); break;
      case 'r': case 'R': randomPost(); break;
      case '?': helpDlg.showModal(); break;
    }
  });

  // infinite scroll
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      if (state.view === 'stream' && cur.shown < cur.list.length) renderStream(false);
      else if (state.view === 'grid' && cur.gridShown < cur.gridItems.length) renderGrid(false);
    }, { rootMargin: '1400px 0px' }).observe($('#sentinel'));
  }

  var rsT = 0;
  window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(renderSpectrum, 150); });
  window.addEventListener('hashchange', function () {
    var post = readHash();
    update({ scroll: false });
    if (post && BY_ID.has(post)) openInspect(post); else if (inspDlg.open) inspDlg.close();
  });

  /* ───────────── boot ───────────── */
  renderReadouts();
  buildFacets();
  bindSpectrum();
  var initialPost = readHash();
  update({ scroll: false });
  if (initialPost && BY_ID.has(initialPost)) openInspect(initialPost);
  }

  if (window.TMB) start(window.TMB);
  else if (window.TMB_SRC) {
    fetch(window.TMB_SRC)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { window.TMB = d; start(d); })
      .catch(function () { showError('The archive data could not be loaded. Reload the page to try again.'); });
  } else {
    showError('data/posts.js is missing — run: python3 tools/build_site.py');
  }
})();
