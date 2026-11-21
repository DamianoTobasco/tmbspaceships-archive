/* Hero canvas + page-level effects.
 *
 * REACTOR — a stylised aneutronic direct-fusion drive:
 *  - Field-reversed configuration (FRC) plasmoid inside a magnetic-mirror chamber
 *  - Open flux surfaces wrap the plasmoid's separatrix and diverge through a magnetic nozzle
 *  - Ions (p⁺, cyan) and electrons (e⁻, violet) gyrate along field lines; Larmor radius
 *    grows as B falls in the nozzle (ρ ∝ 1/B, B ∝ 1/r_wall²)
 *  - Protons and boron-11 (green) circulate on closed field lines inside the plasmoid
 *  - p + ¹¹B → 3 ⁴He events flash and release three alphas (magenta) that escape the
 *    separatrix and stream out the nozzle as exhaust, over standing shock diamonds
 *
 * On load it runs an ignition sequence: coils energise one by one, field lines sweep in,
 * neutral beams fire, the plasmoid lights, then the nozzle opens.
 * Hover the chamber for a field probe; click the plasmoid to trigger a fusion event.
 *
 * window.Reactor.fire(n) triggers n fusion events (the search box calls it).
 *
 * The blueprint exhibits and the exhibit switcher live in sheets.js.
 *
 * PAGE FX (bottom of file) — scroll beam, back-to-top, sticky-search state,
 * cursor spotlight on cards, image fade-in, title letter reveal.
 */
(function () {
  'use strict';
  // ?still=1 renders the finished frame with no motion (used to capture preview images)
  var still = /[?&]still=1\b/.test(location.search);
  var reduce = still || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.classList.add('fx');
  if (still) document.documentElement.classList.add('still');
  // Entrance animations only run when the page is actually on screen at load. A page opened
  // in a background tab (or captured for a preview) shows its finished state straight away.
  var live = !reduce && document.visibilityState === 'visible';
  if (live) document.documentElement.classList.add('anim');

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
  function bell(u) { return Math.exp(-u * u); }
  function rgba(c, a) { return 'rgba(' + c + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  // The stage band changes height when rows around it load or wrap, so each exhibit
  // re-measures whenever it does. `key` skips work when nothing actually moved.
  function stageKey(host, stageEl) {
    var hr = host.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    return [Math.round(hr.width), Math.round(hr.height), Math.round(sr.top - hr.top), Math.round(sr.height)].join(':');
  }
  function watchStage(host, stageEl, fn) {
    var t = 0, run = function () { clearTimeout(t); t = setTimeout(fn, 80); };
    window.addEventListener('resize', run);
    if ('ResizeObserver' in window) new ResizeObserver(run).observe(stageEl);
  }
  // shared with sheets.js (the blueprint exhibits)
  window.TMBFX = { reduce: reduce, live: live, still: still, rand: rand, clamp: clamp, smooth: smooth, bell: bell, rgba: rgba,
                   stageKey: stageKey, watchStage: watchStage };

  /* ════════════════════════════ REACTOR ════════════════════════════ */
  (function reactor() {
    var canvas = document.getElementById('reactor');
    var stageEl = document.getElementById('stage');
    if (!canvas || !stageEl || !canvas.getContext) return;
    var host = canvas.parentElement;
    var ctx = canvas.getContext('2d');
    var TAU = Math.PI * 2;
    var RGB = { p: '89,243,255', e: '165,139,255', b: '125,255,176', a: '255,95,174', w: '255,244,252', x: '255,176,216' };
    var counterEl = document.getElementById('alphaCount');

    var W = 0, H = 0, dpr = 1, tdpr = 1, G = null;
    var stars = null, trail = null, tctx = null;
    var open = [], core = [], free = [], flashes = [];
    var events = 0, t = 0, last = 0, nextFusion = 0.4, running = false, inView = true, raf = 0;
    var INTRO = live ? 3.4 : 0;     // seconds; 0 disables the ignition sequence
    var age = 0;                    // seconds of animation since load
    var mouse = { x: 0, y: 0, on: false, sx: 0.5, sy: 0.5 };
    var cx = 0, cy = 0;             // plasmoid centre (wobbles slightly)
    var active = false;             // the blueprint sheets open the show; the drive comes up when picked
    var shown = false;

    function env(a, b) { return INTRO ? smooth(a, b, age) : 1; }   // intro envelope
    function revealX() { return INTRO ? G.x0 + (W + 60 - G.x0) * smooth(0.7, 1.9, age) : W + 60; }

    /* ── geometry ─────────────────────────────────────────── */
    function buildGeometry() {
      var hr = host.getBoundingClientRect();
      var sr = stageEl.getBoundingClientRect();
      var stageTop = sr.top - hr.top, stageH = Math.max(150, sr.height);
      var y0 = stageTop + stageH * 0.5;
      var R = Math.min(stageH * 0.3, W * 0.12);
      var Lc = Math.min(W * 0.5, R * 8.5);
      var xa = Math.max(W * 0.05, (W - Lc * 1.7) / 2);
      var xb = xa + Lc;
      var xc = xa + Lc * 0.48;
      var a = Lc * 0.3, b = R * 0.6;
      var Ln = Lc * 0.45;
      var throat = R * 0.5;
      G = { y0: y0, R: R, Lc: Lc, xa: xa, xb: xb, xc: xc, a: a, b: b, Ln: Ln, throat: throat,
            x0: xa - R * 1.4, stageTop: stageTop, stageH: stageH, labels: W > 760 };
      G.wall = function (x) {
        if (x <= xb) {
          var r = R;
          r -= (R - throat) * bell((x - xb) / (R * 1.1));
          r -= R * 0.34 * bell((x - xa) / (R * 0.9));
          return r;
        }
        var d = (x - xb) / Ln;
        return throat * (1 + 2.5 * d * d / (1 + 0.45 * d));
      };
      G.sep = function (x) {
        var u = (x - xc) / a;
        return Math.abs(u) < 1 ? b * Math.sqrt(1 - u * u) : 0;
      };
      G.r = function (x, s) {
        var rs = G.sep(x), rw = G.wall(x);
        return Math.sqrt(rs * rs + s * s * (rw * rw - rs * rs));
      };
      G.lines = [];
      var S = [0.12, 0.26, 0.4, 0.55, 0.7, 0.85, 1];
      for (var i = 0; i < S.length; i++) {
        var s = S[i];
        for (var side = -1; side <= 1; side += 2) {
          var p = new Path2D();
          for (var x = G.x0; x <= W + 12; x += 4) {
            var y = y0 + side * G.r(x, s);
            if (x === G.x0) p.moveTo(x, y); else p.lineTo(x, y);
          }
          G.lines.push({ p: p, s: s });
        }
      }
      G.coils = [];
      var nc = W < 560 ? 5 : 7;
      for (var k = 0; k < nc; k++) {
        var ccx = xa + (Lc * k) / (nc - 1);
        G.coils.push({ x: ccx, ry: G.wall(ccx) * 1.2 + 6, mirror: k === 0 || k === nc - 1 });
      }
      [0.38, 0.85].forEach(function (f) {
        var nx = xb + Ln * f;
        G.coils.push({ x: nx, ry: Math.min(G.wall(nx) * 1.12, R * 1.3) + 6, nozzle: true });
      });
      // neutral-beam injector geometry
      G.nbi = { x: xa - R * 0.6, dy: R * 1.55 };
      cx = xc; cy = y0;
    }

    function buildStars() {
      stars = document.createElement('canvas');
      stars.width = Math.round((W + 24) * dpr); stars.height = Math.round((H + 16) * dpr);
      var s = stars.getContext('2d');
      s.scale(dpr, dpr);
      var n = Math.round((W * H) / 2400);
      for (var i = 0; i < n; i++) {
        var x = Math.random() * (W + 24), y = Math.random() * (H + 16);
        var r = Math.random() < 0.07 ? rand(0.9, 1.6) : rand(0.3, 0.8);
        var tint = Math.random();
        var c = tint < 0.12 ? RGB.e : tint < 0.22 ? RGB.p : '220,228,255';
        s.fillStyle = rgba(c, rand(0.12, 0.6));
        s.beginPath(); s.arc(x, y, r, 0, TAU); s.fill();
      }
    }

    /* ── particles ─────────────────────────────────────────── */
    function newOpen(kind, x) {
      var e = kind === 'e';
      return {
        k: kind, s: rand(0.06, 0.98), side: Math.random() < 0.5 ? -1 : 1,
        x: x == null ? rand(G.x0, W) : x, ph: rand(0, TAU),
        v: e ? rand(110, 170) : rand(36, 66), w: e ? rand(24, 34) : rand(8, 12),
        px: null, py: null
      };
    }
    function newExhaust(x) {   // fast streaks leaving the throat
      return {
        k: 'x', s: rand(0.03, 0.5), side: Math.random() < 0.5 ? -1 : 1,
        x: x == null ? G.xb - rand(0, G.R * 0.5) : x, ph: rand(0, TAU),
        v: rand(250, 400), w: rand(9, 15), px: null, py: null, c: Math.random() < 0.35 ? RGB.w : RGB.x
      };
    }
    function newCore() {
      var boron = Math.random() < 0.3;
      return { k: boron ? 'b' : 'p', f: rand(0.12, 0.96), th: rand(0, TAU), w: rand(0.5, 1.25) * (Math.random() < 0.85 ? 1 : -1),
               wob: rand(0, TAU), px: null, py: null };
    }
    function seed() {
      var scale = clamp(W / 1400, 0.35, 1.25);
      open = []; core = []; free = []; flashes = [];
      var ni = Math.round(170 * scale), ne = Math.round(70 * scale), nk = Math.round(110 * scale), nx = Math.round(44 * scale);
      var i;
      for (i = 0; i < ni; i++) open.push(newOpen('p'));
      for (i = 0; i < ne; i++) open.push(newOpen('e'));
      for (i = 0; i < nx; i++) open.push(newExhaust(rand(G.xb, W)));
      for (i = 0; i < nk; i++) core.push(newCore());
    }

    function fusionAt(x, y) {
      flashes.push({ x: x, y: y, age: 0 });
      var rot = rand(0, TAU), sp = rand(150, 210);
      for (var i = 0; i < 3; i++) {
        var ang = rot + (i * TAU) / 3 + rand(-0.15, 0.15);
        free.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.75, px: x, py: y, age: 0 });
      }
      events++;
      if (counterEl) counterEl.textContent = String(events).padStart(4, '0');
    }
    function fusion() {
      if (!G) return;
      var src = core[(Math.random() * core.length) | 0];
      if (src && src.px != null) fusionAt(src.px, src.py);
      else fusionAt(cx + rand(-0.5, 0.5) * G.a, cy + rand(-0.4, 0.4) * G.b);
    }

    /* ── simulation step ───────────────────────────────────── */
    function step(dt) {
      t += dt; age += dt;
      var g = G, i, p;
      cx = g.xc + Math.sin(t * 0.6) * g.a * 0.012;
      cy = g.y0 + Math.sin(t * 0.9 + 1) * g.b * 0.035;
      mouse.sx += ((mouse.on ? mouse.x / W : 0.5) - mouse.sx) * Math.min(1, dt * 5);
      mouse.sy += ((mouse.on ? mouse.y / H : 0.5) - mouse.sy) * Math.min(1, dt * 5);

      if (!INTRO || age > 2.3) {
        nextFusion -= dt;
        if (nextFusion <= 0) { fusion(); nextFusion = rand(0.45, 1.5); }
      }
      for (i = 0; i < open.length; i++) {
        p = open[i];
        var acc = p.k === 'x' ? 1 + 0.6 * smooth(g.xb, g.xb + g.Ln * 2, p.x)
                              : 1 + 2.6 * smooth(g.xb - g.R * 0.5, g.xb + g.Ln * 1.6, p.x);
        p.x += p.v * acc * dt;
        p.ph += p.w * dt * (p.k === 'e' ? -1 : 1);
        if (p.x > W + 30) {
          if (p.k === 'a') { open.splice(i, 1); i--; continue; }
          open[i] = p.k === 'x' ? newExhaust() : newOpen(p.k, g.x0 - rand(0, 60));
        }
      }
      for (i = 0; i < core.length; i++) {
        p = core[i];
        p.th += p.w * dt * (1.4 - p.f * 0.6);
        p.wob += dt * 2.3;
      }
      for (i = 0; i < free.length; i++) {
        p = free[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
        var u = (p.x - g.xc) / g.a, v = (p.y - g.y0) / g.b;
        if (u * u + v * v > 1.04 || p.age > 2) {
          // crossed the separatrix: capture onto the open flux surface it sits on and exhaust it
          var rr = Math.abs(p.y - g.y0), rs = g.sep(p.x), rw = g.wall(p.x);
          var s = clamp(Math.sqrt(Math.max(0, (rr * rr - rs * rs) / Math.max(1, rw * rw - rs * rs))), 0.04, 0.9);
          open.push({ k: 'a', s: s, side: p.y < g.y0 ? -1 : 1, x: p.x, ph: rand(0, TAU), v: rand(150, 220), w: rand(6, 8), px: p.px, py: p.py });
          free.splice(i, 1); i--;
        }
      }
      for (i = 0; i < flashes.length; i++) {
        flashes[i].age += dt;
        if (flashes[i].age > 1.1) { flashes.splice(i, 1); i--; }
      }
    }

    function openPos(p) {
      var g = G;
      var base = g.y0 + p.side * g.r(p.x, p.s);
      var rw = g.wall(p.x) / g.R;
      var rho0 = p.k === 'e' ? 1.3 : p.k === 'a' ? 5.5 : p.k === 'x' ? 2.2 : 3.4;
      var rho = Math.min(rho0 * rw * rw, g.R * 0.45);
      return { x: p.x, y: base + rho * Math.sin(p.ph), depth: Math.cos(p.ph) };
    }

    /* ── drawing ───────────────────────────────────────────── */
    function drawTrails(dt) {
      var g = G;
      tctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0,0,0,' + clamp(dt * 9, 0.06, 0.4).toFixed(3) + ')';
      tctx.fillRect(0, 0, W, H);
      tctx.globalCompositeOperation = 'lighter';
      tctx.lineCap = 'round';

      var reveal = revealX(), ignite = env(1.7, 2.3), thrust = env(2.2, 3.2);
      var i, p, q, a;
      for (i = 0; i < open.length; i++) {
        p = open[i];
        q = openPos(p);
        if (p.x < g.x0 || q.x > reveal || (p.k === 'x' && thrust < 0.15)) { p.px = null; continue; }
        var fadeIn = smooth(g.x0, g.xa, p.x);
        a = (0.35 + 0.65 * (q.depth + 1) / 2) * fadeIn;
        if (p.k === 'a') a = Math.min(1, a + 0.3);
        if (p.k === 'x') a *= thrust * (1 - 0.75 * smooth(g.xb + g.Ln, W, p.x));
        if (p.px != null && Math.abs(q.x - p.px) < 60) {
          tctx.strokeStyle = rgba(p.k === 'x' ? p.c : RGB[p.k], a * (p.k === 'e' ? 0.55 : p.k === 'x' ? 0.6 : 0.8));
          tctx.lineWidth = p.k === 'a' ? 2.2 : p.k === 'e' ? 0.9 : p.k === 'x' ? 1.1 : 1.4;
          tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(q.x, q.y); tctx.stroke();
        }
        p.px = q.x; p.py = q.y;
      }
      for (i = 0; i < core.length; i++) {
        p = core[i];
        var f = p.f + 0.03 * Math.sin(p.wob);
        var x = cx + g.a * f * Math.cos(p.th), y = cy + g.b * f * Math.sin(p.th);
        if (p.px != null && ignite > 0.03) {
          tctx.strokeStyle = rgba(RGB[p.k], (p.k === 'b' ? 0.55 : 0.5) * ignite);
          tctx.lineWidth = p.k === 'b' ? 1.8 : 1.2;
          tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(x, y); tctx.stroke();
        }
        p.px = x; p.py = y;
      }
      for (i = 0; i < free.length; i++) {
        p = free[i];
        tctx.strokeStyle = rgba(RGB.a, 0.95);
        tctx.lineWidth = 2.4;
        tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(p.x, p.y); tctx.stroke();
        p.px = p.x; p.py = p.y;
      }
    }

    function coilOn(k) { var tk = 0.15 + k * 0.08; return INTRO ? smooth(tk, tk + 0.18, age) : 1; }
    function coilHalf(c, k, front) {
      var g = G, rx = c.ry * 0.17, a = 0.14 + 0.86 * coilOn(k);
      ctx.beginPath();
      ctx.ellipse(c.x, g.y0, rx, c.ry, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : Math.PI * 1.5);
      if (front) {
        ctx.strokeStyle = rgba(c.nozzle ? '255,170,215' : '190,206,255', (c.nozzle ? 0.42 : 0.5) * a);
        ctx.lineWidth = c.mirror ? 4 : 3;
        ctx.stroke();
        ctx.strokeStyle = rgba('255,255,255', 0.22 * a);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = rgba('130,150,220', 0.18 * a);
        ctx.lineWidth = c.mirror ? 3.5 : 2.5;
        ctx.stroke();
      }
    }
    // a bright current pulse circulating around each energised coil
    function coilPulse(c, k, front) {
      if (coilOn(k) < 0.6) return;
      var th = (t * (c.nozzle ? 2.7 : 1.9) + k * 1.7) % TAU;
      if ((Math.cos(th + 0.3) > 0) !== front) return;
      ctx.beginPath();
      ctx.ellipse(c.x, G.y0, c.ry * 0.17, c.ry, 0, th, th + 0.62);
      ctx.strokeStyle = rgba(c.nozzle ? RGB.a : RGB.p, front ? 0.95 : 0.3);
      ctx.lineWidth = front ? 2.2 : 1.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    function label(text, px, py, lx, ly, color) {
      ctx.strokeStyle = 'rgba(160,180,240,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, ly); ctx.lineTo(lx, ly); ctx.stroke();
      ctx.fillStyle = color || 'rgba(170,186,236,0.85)';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      var w = ctx.measureText(text).width;
      var tx = lx >= px ? lx + 6 : lx - 6 - w;
      ctx.fillText(text, tx, ly);
    }

    // field probe that follows the cursor inside the vessel
    function probe() {
      var g = G;
      if (!mouse.on || !g.labels || (INTRO && age < INTRO)) return;
      var mx = mouse.x, my = mouse.y;
      if (my < g.stageTop || my > g.stageTop + g.stageH || mx < g.xa - g.R * 0.4) return;
      var r = Math.abs(my - g.y0), rw = g.wall(mx);
      if (r > rw * 1.2 + 8) return;
      var u = (mx - cx) / g.a, v = (my - cy) / g.b, text;
      if (u * u + v * v < 1) {
        text = 'FRC CORE · FIELD REVERSED · β ≈ 1';
      } else {
        var rs = g.sep(mx);
        var psi = clamp(Math.sqrt(Math.max(0, (r * r - rs * rs) / Math.max(1, rw * rw - rs * rs))), 0, 1);
        var B = 3.2 * Math.pow(g.R / rw, 2);                 // tesla; peaks at the mirror throats
        var z = ((mx - g.xa) / g.Lc) * 2.4;                   // metres along the axis
        text = '|B| ' + B.toFixed(1) + ' T · ψ ' + psi.toFixed(2) + ' · z ' + z.toFixed(2) + ' m';
      }
      ctx.strokeStyle = 'rgba(89,243,255,0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 16, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 16, my);
      ctx.moveTo(mx, my - 16); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 16);
      ctx.stroke();
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      var tw = ctx.measureText(text).width, bx = mx + 20, by = my - 24;
      if (bx + tw + 16 > W) bx = mx - 20 - tw - 16;
      ctx.fillStyle = 'rgba(5,8,20,0.82)';
      ctx.strokeStyle = 'rgba(89,243,255,0.4)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by - 10, tw + 16, 20, 5); else ctx.rect(bx, by - 10, tw + 16, 20);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(220,240,255,0.95)';
      ctx.fillText(text, bx + 8, by);
    }

    function render(dt) {
      var g = G, i, x;
      var reveal = revealX(), ignite = env(1.7, 2.3), thrust = env(2.2, 3.2);
      var igFlash = INTRO ? bell((age - 1.95) / 0.16) : 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      if (stars) ctx.drawImage(stars, -12 - (mouse.sx - 0.5) * 18, -8 - (mouse.sy - 0.5) * 10, W + 24, H + 16);

      // axis
      ctx.strokeStyle = 'rgba(122,150,255,0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(g.x0 - 40, g.y0); ctx.lineTo(W, g.y0); ctx.stroke();
      ctx.setLineDash([]);

      // open field lines sweep in from the inlet, with flow dashes running toward the nozzle
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, reveal, H); ctx.clip();
      var grad = ctx.createLinearGradient(g.x0, 0, W, 0);
      grad.addColorStop(0, 'rgba(89,243,255,0)');
      grad.addColorStop(clamp((g.xa - g.x0) / (W - g.x0), 0, 1), 'rgba(89,243,255,0.2)');
      grad.addColorStop(clamp((g.xb - g.x0) / (W - g.x0), 0, 1), 'rgba(140,170,255,0.22)');
      grad.addColorStop(1, 'rgba(165,139,255,0.03)');
      ctx.strokeStyle = grad;
      for (i = 0; i < g.lines.length; i++) {
        ctx.lineWidth = g.lines[i].s === 1 ? 1.3 : 0.8;
        ctx.stroke(g.lines[i].p);
      }
      ctx.setLineDash([3, 30]);
      ctx.lineDashOffset = -t * 46;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.9;
      for (i = 0; i < g.lines.length; i += 2) ctx.stroke(g.lines[i + (i % 4 === 0 ? 0 : 1)].p);
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      if (INTRO && reveal < W) {   // bright leading edge of the sweep
        var eg = ctx.createLinearGradient(reveal - 70, 0, reveal, 0);
        eg.addColorStop(0, 'rgba(89,243,255,0)'); eg.addColorStop(1, 'rgba(200,250,255,0.5)');
        ctx.strokeStyle = eg; ctx.lineWidth = 1.6;
        for (i = 0; i < g.lines.length; i++) ctx.stroke(g.lines[i].p);
      }
      ctx.restore();

      // closed field lines, separatrix and drifting filaments
      var cl = 0.25 + 0.75 * ignite;
      [0.35, 0.62, 0.84].forEach(function (f) {
        ctx.strokeStyle = rgba('200,170,255', 0.16 * cl);
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(cx, cy, g.a * f, g.b * f, 0, 0, TAU); ctx.stroke();
      });
      ctx.strokeStyle = rgba(RGB.a, 0.42 * cl);
      ctx.lineWidth = 1.1;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath(); ctx.ellipse(cx, cy, g.a, g.b, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (ignite > 0.05) {
        [[0.48, 0.55, 1], [0.7, -0.4, 1.3], [0.9, 0.3, 0.9]].forEach(function (fl, j) {
          var th = t * fl[1] + j * 2.1;
          ctx.strokeStyle = rgba('236,222,255', 0.3 * ignite);
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.ellipse(cx, cy, g.a * fl[0], g.b * fl[0], 0, th, th + fl[2]); ctx.stroke();
        });
        ctx.lineCap = 'butt';
      }

      // neutral-beam injectors
      var nb = env(1.3, 1.7);
      if (nb > 0.01) {
        ctx.lineWidth = 1.4;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -t * 70;
        [[-1, -0.35], [1, 0.35]].forEach(function (d) {
          var x1 = g.nbi.x, y1 = g.y0 + d[0] * g.nbi.dy, x2 = g.xc - g.a * 0.35, y2 = g.y0 + d[1] * g.b;
          ctx.strokeStyle = rgba(RGB.b, 0.32 * nb);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.setLineDash([]);
          for (var j = 0; j < 3; j++) {   // neutral bunches riding the beam
            var k = (t * 0.8 + j / 3) % 1;
            ctx.fillStyle = rgba('210,255,230', 0.85 * nb * (1 - k * 0.5));
            ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 1.7, 0, TAU); ctx.fill();
          }
          ctx.setLineDash([10, 8]);
        });
        ctx.setLineDash([]);
      }

      // coil back halves
      g.coils.forEach(function (c, k) { coilHalf(c, k, false); coilPulse(c, k, false); });

      // ── glow layer ──
      ctx.globalCompositeOperation = 'lighter';

      // coils flash as they energise
      if (INTRO && age < INTRO) {
        g.coils.forEach(function (c, k) {
          var tk = 0.15 + k * 0.08, fl = age > tk ? Math.exp(-(age - tk) * 4.5) : 0;
          if (fl < 0.02) return;
          ctx.strokeStyle = rgba(c.nozzle ? RGB.a : RGB.p, fl * 0.75);
          ctx.lineWidth = 7;
          ctx.beginPath(); ctx.ellipse(c.x, g.y0, c.ry * 0.17, c.ry, 0, 0, TAU); ctx.stroke();
        });
      }

      // exhaust plume (opens when the nozzle fires)
      if (thrust > 0.01) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, g.xb + (W + 20 - g.xb) * thrust, H); ctx.clip();
        ctx.globalAlpha = 0.86 + 0.14 * Math.sin(t * 23) * Math.sin(t * 7.3);
        var px0 = g.xb - g.R * 0.4;
        var pg = ctx.createLinearGradient(px0, 0, W, 0);
        var pk = clamp((g.xb + g.R * 0.3 - px0) / (W - px0), 0.01, 0.5);
        pg.addColorStop(0, 'rgba(255,95,174,0)');
        pg.addColorStop(pk, 'rgba(255,95,174,0.26)');
        pg.addColorStop(Math.min(0.95, pk + 0.3), 'rgba(165,139,255,0.1)');
        pg.addColorStop(1, 'rgba(89,243,255,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        for (x = px0; x <= W + 10; x += 8) ctx.lineTo(x, g.y0 - g.r(x, 0.62));
        for (x = W + 10; x >= px0; x -= 8) ctx.lineTo(x, g.y0 + g.r(x, 0.62));
        ctx.closePath(); ctx.fill();
        var pc0 = g.xb - g.R * 0.2;
        var pc = ctx.createLinearGradient(pc0, 0, W, 0);
        pc.addColorStop(0, 'rgba(255,244,252,0)');
        pc.addColorStop(clamp((g.xb + g.R * 0.2 - pc0) / (W - pc0), 0.01, 0.5), 'rgba(255,244,252,0.22)');
        pc.addColorStop(0.6, 'rgba(255,95,174,0.05)');
        pc.addColorStop(1, 'rgba(255,95,174,0)');
        ctx.fillStyle = pc;
        ctx.beginPath();
        for (x = pc0; x <= W + 10; x += 8) ctx.lineTo(x, g.y0 - g.r(x, 0.2));
        for (x = W + 10; x >= pc0; x -= 8) ctx.lineTo(x, g.y0 + g.r(x, 0.2));
        ctx.closePath(); ctx.fill();
        // standing shock diamonds
        for (var j = 0; j < 5; j++) {
          var dx = g.xb + g.Ln * (0.2 + 0.42 * j);
          if (dx > W + 20) break;
          var al = (0.36 - j * 0.065) * (0.72 + 0.28 * Math.sin(t * 5 - j * 1.4));
          ctx.save();
          ctx.translate(dx, g.y0); ctx.scale(g.Ln * 0.13, Math.max(4, g.r(dx, 0.34)));
          var dg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          dg.addColorStop(0, rgba(RGB.w, al)); dg.addColorStop(0.5, rgba(RGB.a, al * 0.45)); dg.addColorStop(1, 'rgba(255,95,174,0)');
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // plasmoid glow (breathing; flares on fusion and at ignition)
      var flashBoost = 0;
      for (var f = 0; f < flashes.length; f++) flashBoost += Math.max(0, 0.5 - flashes[f].age) * 0.25;
      var pulse = 1 + 0.04 * Math.sin(t * 1.8) + flashBoost + igFlash * 0.45;
      if (ignite > 0.01 || igFlash > 0.01) {
        var ga = Math.max(ignite, igFlash);
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(g.a * 1.3 * pulse, g.b * 1.35 * pulse);
        var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0, rgba('255,246,255', (0.5 + flashBoost + igFlash * 0.5) * ga));
        rg.addColorStop(0.22, rgba('210,170,255', 0.34 * ga));
        rg.addColorStop(0.55, rgba('120,120,255', 0.13 * ga));
        rg.addColorStop(1, 'rgba(89,243,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // ignition shock ring
      if (INTRO && age > 1.9 && age < 2.75) {
        var kk = (age - 1.9) / 0.85;
        ctx.strokeStyle = rgba('255,220,240', (1 - kk) * 0.7);
        ctx.lineWidth = 2.5 * (1 - kk) + 0.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, g.a * (0.35 + 1.25 * kk), g.b * (0.35 + 1.9 * kk), 0, 0, TAU); ctx.stroke();
      }

      // throat hot-spot
      if (thrust > 0.01) {
        var tg = ctx.createRadialGradient(g.xb, g.y0, 0, g.xb, g.y0, g.R * 0.9);
        tg.addColorStop(0, rgba('255,200,235', (0.35 + flashBoost * 0.6) * thrust));
        tg.addColorStop(1, 'rgba(255,95,174,0)');
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.arc(g.xb, g.y0, g.R * 0.9, 0, TAU); ctx.fill();
      }

      // particle trails
      drawTrails(dt);
      ctx.drawImage(trail, 0, 0, W, H);

      // fusion flashes
      for (var m = 0; m < flashes.length; m++) {
        var fl = flashes[m], fa = fl.age;
        ctx.strokeStyle = rgba(RGB.a, 0.8 - fa * 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 4 + fa * g.R * 0.9, 0, TAU); ctx.stroke();
        if (fa < 0.35) {
          var fg = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 24);
          fg.addColorStop(0, rgba('255,255,255', 1 - fa / 0.35));
          fg.addColorStop(1, 'rgba(255,95,174,0)');
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(fl.x, fl.y, 24, 0, TAU); ctx.fill();
        }
      }

      // ── foreground hardware ──
      ctx.globalCompositeOperation = 'source-over';
      g.coils.forEach(function (c, k) {
        coilHalf(c, k, true);
        coilPulse(c, k, true);
        ctx.fillStyle = rgba(c.nozzle ? '255,170,215' : '170,190,250', (c.nozzle ? 0.35 : 0.38) * (0.2 + 0.8 * coilOn(k)));
        ctx.fillRect(c.x - 3, g.y0 - c.ry - 5, 6, 7);
        ctx.fillRect(c.x - 3, g.y0 + c.ry - 2, 6, 7);
      });

      var la = env(2.7, 3.3);
      if (g.labels && la > 0.01) {
        ctx.globalAlpha = la;
        var top = g.stageTop + 10, bot = g.stageTop + g.stageH - 10;
        label('FRC PLASMOID · p–¹¹B', g.xc + g.a * 0.2, g.y0 - g.b * 0.98, g.xc + g.a * 0.45, top, 'rgba(230,214,255,0.9)');
        label('MIRROR COIL', g.coils[0].x, g.y0 + g.coils[0].ry + 5, g.coils[0].x + 26, bot);
        label('MAGNETIC NOZZLE', g.xb, g.y0 + g.wall(g.xb) * 1.2 + 10, g.xb + 26, bot);
        var ex = Math.min(W - 160, g.xb + g.Ln * 1.25);
        label('α EXHAUST →', ex, g.y0 - g.r(ex, 0.62), ex + 22, top, 'rgba(255,150,200,0.9)');
        label('NBI', g.nbi.x, g.y0 - g.nbi.dy, g.nbi.x + 16, Math.max(top + 14, g.y0 - g.nbi.dy), 'rgba(125,255,176,0.8)');
        ctx.globalAlpha = 1;
      }
      probe();
    }

    /* ── loop & lifecycle ──────────────────────────────────── */
    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      step(dt);
      render(dt);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (reduce || running || !active) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    function settle() {   // run the simulation forward without advancing the intro clock
      var a = age;
      for (var i = 0; i < 180; i++) { step(1 / 60); if (i > 150) drawTrails(1 / 60); }
      age = a;
    }
    var sizeKey = '';
    function resize(force) {
      var key = stageKey(host, stageEl);
      if (key === sizeKey && force !== true) return;
      sizeKey = key;
      var r = host.getBoundingClientRect();
      W = Math.max(300, r.width); H = Math.max(300, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      tdpr = Math.min(dpr, 1.5);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      trail = document.createElement('canvas');
      trail.width = Math.round(W * tdpr); trail.height = Math.round(H * tdpr);
      tctx = trail.getContext('2d');
      buildGeometry();
      buildStars();
      seed();
      // paint a frame right away so the hero is never blank: the dark pre-ignition state
      // while the intro is still ahead, otherwise a settled steady state
      if (!(INTRO && age < INTRO)) settle();
      render(1 / 60);
    }

    watchStage(host, stageEl, resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (inView) start();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView && !document.hidden) start(); else stop();
      }, { threshold: 0 }).observe(host);
    }

    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.on = e.pointerType !== 'touch';
    });
    host.addEventListener('pointerleave', function () { mouse.on = false; });
    host.addEventListener('click', function (e) {
      if (reduce || !active || !G || (e.target.closest && e.target.closest('a, button, input, label'))) return;
      var r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var u = (x - cx) / G.a, v = (y - cy) / G.b;
      if (u * u + v * v < 1) fusionAt(x, y);
    });

    resize();
    start();

    window.Reactor = {
      fire: function (n) {
        if (reduce || !G || !active) return;
        for (var i = 0; i < (n || 1); i++) setTimeout(fusion, i * 120);
      },
      setActive: function (on) {
        active = on;
        if (!on) { stop(); mouse.on = false; return; }
        if (!shown) { shown = true; age = 0; }   // the ignition sequence plays the first time it comes up
        if (inView && !document.hidden) start();
      }
    };
  })();

  /* ════════════════════════════ PAGE FX ════════════════════════════ */

  // title: letters materialise one by one (each letter carries its own gradient so the
  // effect survives background-clip:text)
  (function title() {
    var h1 = document.querySelector('.hero h1');
    if (!h1 || !live) return;
    var i = 0;
    h1.setAttribute('aria-label', h1.textContent.trim());
    ['.h1a', '.h1b'].forEach(function (sel) {
      var el = h1.querySelector(sel);
      if (!el) return;
      el.innerHTML = el.textContent.split('').map(function (ch) {
        return '<span class="ch" aria-hidden="true" style="--i:' + (i++) + '">' + ch + '</span>';
      }).join('');
      el.classList.add('split');
    });
  })();

  // scroll beam, back-to-top ring, and the "stuck" state of the sticky search bar
  (function scroll() {
    var beam = document.getElementById('beam');
    var toTop = document.getElementById('toTop');
    var hero = document.getElementById('hero');
    var brand = document.querySelector('.console-brand');
    var ticking = false;
    function apply() {
      ticking = false;
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      var p = Math.min(1, Math.max(0, window.scrollY / max));
      if (beam) beam.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (toTop) {
        toTop.style.setProperty('--sp', (p * 100).toFixed(1));
        toTop.classList.toggle('on', window.scrollY > 700);
      }
      var stuck = hero ? hero.getBoundingClientRect().bottom < 4 : false;
      if (document.body.classList.contains('stuck') !== stuck) {
        document.body.classList.toggle('stuck', stuck);
        if (brand) brand.tabIndex = stuck ? 0 : -1;
      }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
    window.addEventListener('resize', apply);
    apply();
    function top() { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
    if (toTop) toTop.addEventListener('click', top);
    if (brand) brand.addEventListener('click', top);
  })();

  // cursor-tracked spotlight on cards and panels
  (function spotlight() {
    if (reduce || !window.matchMedia('(hover: hover)').matches) return;
    var pending = null, queued = false;
    document.addEventListener('pointermove', function (e) {
      pending = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var el = pending.target.closest && pending.target.closest('.shot, .kpi, .telemetry .panel');
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (pending.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (pending.clientY - r.top).toFixed(0) + 'px');
      });
    }, { passive: true });
  })();

  // images fade in once decoded (load/error don't bubble, so listen in the capture phase)
  function mark(e) { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ok'); }
  document.addEventListener('load', mark, true);
  document.addEventListener('error', mark, true);
})();
