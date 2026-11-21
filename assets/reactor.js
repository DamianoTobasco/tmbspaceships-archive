/* Hero canvas: a stylised aneutronic direct-fusion drive.
 *
 *  - Field-reversed configuration (FRC) plasmoid inside a magnetic-mirror chamber
 *  - Open flux surfaces wrap the plasmoid's separatrix and diverge through a magnetic nozzle
 *  - Ions (p⁺, cyan) and electrons (e⁻, violet) gyrate along field lines; Larmor radius
 *    grows as B falls in the nozzle (ρ ∝ 1/B, B ∝ 1/r_wall²)
 *  - Protons and boron-11 (green) circulate on closed field lines inside the plasmoid
 *  - p + ¹¹B → 3 ⁴He events flash and release three alphas (magenta) that escape the
 *    separatrix and stream out the nozzle as exhaust
 *
 *  window.Reactor.fire(n) triggers n fusion events (the search box calls it).
 */
(function () {
  'use strict';
  var canvas = document.getElementById('reactor');
  var stageEl = document.getElementById('stage');
  if (!canvas || !stageEl || !canvas.getContext) return;
  var host = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  var TAU = Math.PI * 2;
  var RGB = { p: '89,243,255', e: '165,139,255', b: '125,255,176', a: '255,95,174', w: '255,244,252' };
  var counterEl = document.getElementById('alphaCount');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = 1, tdpr = 1;
  var G = null;
  var stars = null, trail = null, tctx = null;
  var open = [], core = [], free = [], flashes = [];
  var events = 0, t = 0, last = 0, nextFusion = 1.2, running = false, inView = true, raf = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
  function bell(u) { return Math.exp(-u * u); }

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
    // open field lines as Path2D (both sides)
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
    // coils
    G.coils = [];
    var nc = W < 560 ? 5 : 7;
    for (var k = 0; k < nc; k++) {
      var cx = xa + (Lc * k) / (nc - 1);
      G.coils.push({ x: cx, ry: G.wall(cx) * 1.2 + 6, mirror: k === 0 || k === nc - 1 });
    }
    [0.38, 0.85].forEach(function (f) {
      var nx = xb + Ln * f;
      G.coils.push({ x: nx, ry: Math.min(G.wall(nx) * 1.12, R * 1.3) + 6, nozzle: true });
    });
  }

  function buildStars() {
    stars = document.createElement('canvas');
    stars.width = Math.round(W * dpr); stars.height = Math.round(H * dpr);
    var s = stars.getContext('2d');
    s.scale(dpr, dpr);
    var n = Math.round((W * H) / 2600);
    for (var i = 0; i < n; i++) {
      var x = Math.random() * W, y = Math.random() * H;
      var r = Math.random() < 0.08 ? rand(0.9, 1.5) : rand(0.3, 0.8);
      var tint = Math.random();
      var c = tint < 0.12 ? RGB.e : tint < 0.22 ? RGB.p : '220,228,255';
      s.fillStyle = 'rgba(' + c + ',' + rand(0.12, 0.6).toFixed(2) + ')';
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
  function newCore() {
    var boron = Math.random() < 0.3;
    return { k: boron ? 'b' : 'p', f: rand(0.12, 0.96), th: rand(0, TAU), w: rand(0.5, 1.25) * (Math.random() < 0.85 ? 1 : -1),
             wob: rand(0, TAU), px: null, py: null };
  }
  function seed() {
    var scale = clamp(W / 1400, 0.35, 1.25);
    open = []; core = []; free = []; flashes = [];
    var ni = Math.round(170 * scale), ne = Math.round(70 * scale), nk = Math.round(110 * scale);
    for (var i = 0; i < ni; i++) open.push(newOpen('p'));
    for (var j = 0; j < ne; j++) open.push(newOpen('e'));
    for (var k = 0; k < nk; k++) core.push(newCore());
  }

  function fusion() {
    if (!G) return;
    var src = core[(Math.random() * core.length) | 0];
    var x, y;
    if (src && src.px != null) { x = src.px; y = src.py; }
    else { x = G.xc + rand(-0.5, 0.5) * G.a; y = G.y0 + rand(-0.4, 0.4) * G.b; }
    flashes.push({ x: x, y: y, age: 0 });
    var rot = rand(0, TAU), sp = rand(150, 210);
    for (var i = 0; i < 3; i++) {
      var ang = rot + (i * TAU) / 3 + rand(-0.15, 0.15);
      free.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.75, px: x, py: y, age: 0 });
    }
    events++;
    if (counterEl) counterEl.textContent = String(events).padStart(4, '0');
  }

  /* ── simulation step ───────────────────────────────────── */
  function step(dt) {
    t += dt;
    nextFusion -= dt;
    if (nextFusion <= 0) { fusion(); nextFusion = rand(0.5, 1.6); }

    var g = G, i, p;
    for (i = 0; i < open.length; i++) {
      p = open[i];
      var acc = 1 + 2.6 * smooth(g.xb - g.R * 0.5, g.xb + g.Ln * 1.6, p.x);
      p.x += p.v * acc * dt;
      p.ph += p.w * dt * (p.k === 'e' ? -1 : 1);
      if (p.x > W + 30) {
        if (p.k === 'a') { open.splice(i, 1); i--; continue; }
        var n = newOpen(p.k, g.x0 - rand(0, 60));
        open[i] = n;
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
    var rho0 = p.k === 'e' ? 1.3 : p.k === 'a' ? 5.5 : 3.4;
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

    var i, p, q, a;
    for (i = 0; i < open.length; i++) {
      p = open[i];
      q = openPos(p);
      if (p.x < g.x0) { p.px = null; continue; }
      var fadeIn = smooth(g.x0, g.xa, p.x);
      a = (0.35 + 0.65 * (q.depth + 1) / 2) * fadeIn;
      if (p.k === 'a') a = Math.min(1, a + 0.3);
      if (p.px != null && Math.abs(q.x - p.px) < 60) {
        tctx.strokeStyle = 'rgba(' + RGB[p.k] + ',' + (a * (p.k === 'e' ? 0.55 : 0.8)).toFixed(3) + ')';
        tctx.lineWidth = p.k === 'a' ? 2.2 : p.k === 'e' ? 0.9 : 1.4;
        tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(q.x, q.y); tctx.stroke();
      }
      p.px = q.x; p.py = q.y;
    }
    for (i = 0; i < core.length; i++) {
      p = core[i];
      var f = p.f + 0.03 * Math.sin(p.wob);
      var x = g.xc + g.a * f * Math.cos(p.th), y = g.y0 + g.b * f * Math.sin(p.th);
      if (p.px != null) {
        tctx.strokeStyle = 'rgba(' + RGB[p.k] + ',' + (p.k === 'b' ? 0.55 : 0.5) + ')';
        tctx.lineWidth = p.k === 'b' ? 1.8 : 1.2;
        tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(x, y); tctx.stroke();
      }
      p.px = x; p.py = y;
    }
    for (i = 0; i < free.length; i++) {
      p = free[i];
      tctx.strokeStyle = 'rgba(' + RGB.a + ',0.95)';
      tctx.lineWidth = 2.4;
      tctx.beginPath(); tctx.moveTo(p.px, p.py); tctx.lineTo(p.x, p.y); tctx.stroke();
      p.px = p.x; p.py = p.y;
    }
  }

  function coilHalf(c, front) {
    var g = G, rx = c.ry * 0.17;
    ctx.beginPath();
    ctx.ellipse(c.x, g.y0, rx, c.ry, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : Math.PI * 1.5);
    if (front) {
      ctx.strokeStyle = c.nozzle ? 'rgba(255,170,215,0.42)' : 'rgba(190,206,255,0.5)';
      ctx.lineWidth = c.mirror ? 4 : 3;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(130,150,220,0.18)';
      ctx.lineWidth = c.mirror ? 3.5 : 2.5;
      ctx.stroke();
    }
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
    ctx.fillStyle = color || 'rgba(170,186,236,0.85)';
    ctx.fillText(text, tx, ly);
  }

  function render(dt) {
    var g = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    if (stars) ctx.drawImage(stars, 0, 0, W, H);

    // axis + ticks
    ctx.strokeStyle = 'rgba(122,150,255,0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(g.x0 - 40, g.y0); ctx.lineTo(W, g.y0); ctx.stroke();
    ctx.setLineDash([]);

    // field lines (fade in at inlet, out at far plume)
    var grad = ctx.createLinearGradient(g.x0, 0, W, 0);
    grad.addColorStop(0, 'rgba(89,243,255,0)');
    grad.addColorStop(clamp((g.xa - g.x0) / (W - g.x0), 0, 1), 'rgba(89,243,255,0.2)');
    grad.addColorStop(clamp((g.xb - g.x0) / (W - g.x0), 0, 1), 'rgba(140,170,255,0.22)');
    grad.addColorStop(1, 'rgba(165,139,255,0.03)');
    ctx.strokeStyle = grad;
    for (var i = 0; i < g.lines.length; i++) {
      ctx.lineWidth = g.lines[i].s === 1 ? 1.3 : 0.8;
      ctx.stroke(g.lines[i].p);
    }

    // closed field lines + separatrix
    [0.35, 0.62, 0.84].forEach(function (f) {
      ctx.strokeStyle = 'rgba(200,170,255,0.16)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(g.xc, g.y0, g.a * f, g.b * f, 0, 0, TAU); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,95,174,0.42)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -t * 14;
    ctx.beginPath(); ctx.ellipse(g.xc, g.y0, g.a, g.b, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    // neutral-beam injectors
    var bx = g.xa - g.R * 0.6, by = g.R * 1.55;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 70;
    [[-1, -0.35], [1, 0.35]].forEach(function (d) {
      ctx.strokeStyle = 'rgba(125,255,176,0.32)';
      ctx.beginPath(); ctx.moveTo(bx, g.y0 + d[0] * by); ctx.lineTo(g.xc - g.a * 0.35, g.y0 + d[1] * g.b); ctx.stroke();
    });
    ctx.setLineDash([]);

    // coil back halves
    g.coils.forEach(function (c) { coilHalf(c, false); });

    // ── glow layer ──
    ctx.globalCompositeOperation = 'lighter';

    // exhaust plume
    var px0 = g.xb - g.R * 0.4;
    var pg = ctx.createLinearGradient(px0, 0, W, 0);
    var pk = clamp((g.xb + g.R * 0.3 - px0) / (W - px0), 0.01, 0.5);
    pg.addColorStop(0, 'rgba(255,95,174,0)');
    pg.addColorStop(pk, 'rgba(255,95,174,0.24)');
    pg.addColorStop(Math.min(0.95, pk + 0.3), 'rgba(165,139,255,0.1)');
    pg.addColorStop(1, 'rgba(89,243,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    var x;
    for (x = g.xb - g.R * 0.4; x <= W + 10; x += 8) ctx.lineTo(x, g.y0 - g.r(x, 0.62));
    for (x = W + 10; x >= g.xb - g.R * 0.4; x -= 8) ctx.lineTo(x, g.y0 + g.r(x, 0.62));
    ctx.closePath(); ctx.fill();
    var pc0 = g.xb - g.R * 0.2;
    var pc = ctx.createLinearGradient(pc0, 0, W, 0);
    pc.addColorStop(0, 'rgba(255,244,252,0)');
    pc.addColorStop(clamp((g.xb + g.R * 0.2 - pc0) / (W - pc0), 0.01, 0.5), 'rgba(255,244,252,0.2)');
    pc.addColorStop(0.6, 'rgba(255,95,174,0.05)');
    pc.addColorStop(1, 'rgba(255,95,174,0)');
    ctx.fillStyle = pc;
    ctx.beginPath();
    for (x = g.xb - g.R * 0.2; x <= W + 10; x += 8) ctx.lineTo(x, g.y0 - g.r(x, 0.2));
    for (x = W + 10; x >= g.xb - g.R * 0.2; x -= 8) ctx.lineTo(x, g.y0 + g.r(x, 0.2));
    ctx.closePath(); ctx.fill();

    // plasmoid glow (breathing)
    var flashBoost = 0;
    for (var f = 0; f < flashes.length; f++) flashBoost += Math.max(0, 0.5 - flashes[f].age) * 0.25;
    var pulse = 1 + 0.04 * Math.sin(t * 1.8) + flashBoost;
    ctx.save();
    ctx.translate(g.xc, g.y0); ctx.scale(g.a * 1.3 * pulse, g.b * 1.35 * pulse);
    var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, 'rgba(255,246,255,' + (0.5 + flashBoost).toFixed(3) + ')');
    rg.addColorStop(0.22, 'rgba(210,170,255,0.34)');
    rg.addColorStop(0.55, 'rgba(120,120,255,0.13)');
    rg.addColorStop(1, 'rgba(89,243,255,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
    ctx.restore();

    // throat hot-spot
    var tg = ctx.createRadialGradient(g.xb, g.y0, 0, g.xb, g.y0, g.R * 0.9);
    tg.addColorStop(0, 'rgba(255,200,235,0.35)');
    tg.addColorStop(1, 'rgba(255,95,174,0)');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(g.xb, g.y0, g.R * 0.9, 0, TAU); ctx.fill();

    // particle trails
    drawTrails(dt);
    ctx.drawImage(trail, 0, 0, W, H);

    // fusion flashes
    for (var k = 0; k < flashes.length; k++) {
      var fl = flashes[k], age = fl.age;
      var rad = 4 + age * g.R * 0.9;
      ctx.strokeStyle = 'rgba(255,95,174,' + Math.max(0, 0.8 - age * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fl.x, fl.y, rad, 0, TAU); ctx.stroke();
      if (age < 0.35) {
        var fg = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 22);
        fg.addColorStop(0, 'rgba(255,255,255,' + (1 - age / 0.35).toFixed(3) + ')');
        fg.addColorStop(1, 'rgba(255,95,174,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 22, 0, TAU); ctx.fill();
      }
    }

    // ── foreground hardware ──
    ctx.globalCompositeOperation = 'source-over';
    g.coils.forEach(function (c) {
      coilHalf(c, true);
      // coil housings
      ctx.fillStyle = c.nozzle ? 'rgba(255,170,215,0.35)' : 'rgba(170,190,250,0.38)';
      ctx.fillRect(c.x - 3, g.y0 - c.ry - 5, 6, 7);
      ctx.fillRect(c.x - 3, g.y0 + c.ry - 2, 6, 7);
    });

    if (g.labels) {
      var top = g.stageTop + 10, bot = g.stageTop + g.stageH - 10;
      label('FRC PLASMOID · p–¹¹B', g.xc + g.a * 0.2, g.y0 - g.b * 0.98, g.xc + g.a * 0.45, top, 'rgba(230,214,255,0.9)');
      label('MIRROR COIL', g.coils[0].x, g.y0 + g.coils[0].ry + 5, g.coils[0].x + 26, bot);
      label('MAGNETIC NOZZLE', g.xb, g.y0 + g.wall(g.xb) * 1.2 + 10, g.xb + 26, bot);
      var ex = Math.min(W - 160, g.xb + g.Ln * 1.25);
      label('α EXHAUST →', ex, g.y0 - g.r(ex, 0.62), ex + 22, top, 'rgba(255,150,200,0.9)');
      var nby = Math.max(top + 14, g.y0 - by);
      label('NBI', bx, g.y0 - by, bx + 16, nby, 'rgba(125,255,176,0.8)');
    }
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
    if (reduce || running) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function resize() {
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
    // settle the simulation and paint a frame immediately, so the hero is never blank
    // (also the only frame drawn when reduced motion is on)
    for (var i = 0; i < 180; i++) { step(1 / 60); if (i > 150) drawTrails(1 / 60); }
    render(1 / 60);
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (inView) start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView && !document.hidden) start(); else stop();
    }, { threshold: 0 }).observe(host);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); });

  resize();
  start();

  window.Reactor = {
    fire: function (n) {
      if (reduce || !G) return;
      for (var i = 0; i < (n || 1); i++) setTimeout(fusion, i * 120);
    }
  };
})();
