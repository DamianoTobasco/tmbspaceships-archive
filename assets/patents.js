/* Pais Patents — the five US Navy filings by Salvatore Cezar Pais, with an animated blueprint
 * cross-section of each machine, drawn from the patent's own description of its parts.
 *
 *   craft   US 10,144,532 B2   Craft using an inertial mass reduction device
 *   heem    US 10,135,366 B2   Electromagnetic field generator (HEEMFG, the "Pais Effect")
 *   rtsc    US 2019/0058105 A1 Piezoelectricity-induced room temperature superconductor
 *   fusion  US 2019/0295733 A1 Plasma compression fusion device
 *   hfgw    US 10,322,827 B2   High frequency gravitational wave generator
 *
 * This file is the drawing engine and the record; pais.js builds the Pais Patents page from
 * window.PaisViz. Diagrams are illustrations of the text, not copies of the patent figures.
 * Uses window.TMBFX (reactor.js) for the reduced-motion flag when it is present.
 */
(function () {
  'use strict';
  var FX = window.TMBFX || {};
  var still = /[?&]still=1\b/.test(location.search);
  var reduce = !!FX.reduce || still || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var TAU = Math.PI * 2;
  var C = { ink: '190,225,255', amb: '255,176,87', teal: '94,240,192', red: '255,107,138', blu: '107,182,255',
            grn: '125,255,176', pnk: '255,143,208', vio: '165,139,255', ion: '89,243,255', alp: '255,95,174', yel: '255,236,150' };
  var HAND = '"Architects Daughter", "Bradley Hand", "Segoe Print", cursive';
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(c, a) { return 'rgba(' + c + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function bell(u) { return Math.exp(-u * u); }
  function mono(px) { return '500 ' + px + 'px ' + MONO; }
  function hand(px) { return px + 'px ' + HAND; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function text(c, s, x, y, font, color, align) {
    c.font = font; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y);
  }
  // seeded noise so every diagram looks the same each time it is drawn
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

  /* ── a callout: dot on the part, an elbow line, a mono label and an optional hand note ── */
  function callout(c, s, px, py, lx, ly, label, note, rgb) {
    var right = lx >= px;
    c.strokeStyle = rgba(rgb || C.grn, 0.7); c.lineWidth = 1;
    c.beginPath(); c.moveTo(px, py); c.lineTo(lx, ly); c.lineTo(lx + (right ? 14 : -14), ly); c.stroke();
    c.fillStyle = rgba(rgb || C.grn, 0.95); c.beginPath(); c.arc(px, py, 2, 0, TAU); c.fill();
    var tx = lx + (right ? 18 : -18), al = right ? 'left' : 'right';
    text(c, label, tx, ly, mono(s.small ? 8 : 9), rgba(rgb || C.grn, 0.98), al);
    if (note) text(c, note, tx, ly + (s.small ? 12 : 14), hand(s.small ? 11.5 : 13), rgba(rgb || C.grn, 0.78), al);
  }

  /* ── the sheet: blueprint paper, grid, frame, titles ── */
  function paper(c, s, d) {
    var W = s.W, H = s.H;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d2363'); g.addColorStop(1, '#081644');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.lineWidth = 1;
    for (var x = 0.5, k = 0; x < W; x += 14, k++) { c.strokeStyle = rgba(C.ink, k % 5 ? 0.045 : 0.1); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (var y = 0.5, j = 0; y < H; y += 14, j++) { c.strokeStyle = rgba(C.ink, j % 5 ? 0.045 : 0.1); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.strokeStyle = rgba(C.ink, 0.18); c.strokeRect(5.5, 5.5, W - 11, H - 11);
    if (s.small) {                       // phone width: the handwritten name on its own, the number below
      text(c, d.hand, 14, 20, hand(15), 'rgba(255,255,255,0.95)');
      text(c, d.no, W - 14, H - 15, mono(7), rgba(C.ink, 0.5), 'right');
      return;
    }
    if ('letterSpacing' in c) c.letterSpacing = '1.2px';
    c.font = mono(9.5);
    var room = W - 60 - (c.font = hand(21), c.measureText(d.hand).width);
    c.font = mono(9.5);
    var fig = c.measureText(d.fig).width <= room ? d.fig : d.figShort;
    if (c.measureText(fig).width <= room) text(c, fig, 16, 20, mono(9.5), rgba(C.ink, 0.9));
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    text(c, d.hand, W - 16, 24, hand(21), 'rgba(255,255,255,0.95)', 'right');
    text(c, d.no + ' · ' + d.stamp, W - 16, H - 15, mono(8), rgba(C.ink, 0.5), 'right');
  }

  /* ════════════ 1 · CRAFT USING AN INERTIAL MASS REDUCTION DEVICE ════════════ */
  // a lens-shaped hull: leading (top) and trailing (bottom) portions mirror each other
  function lens(c, cx, cy, A, B, wob) {
    var n = 120;
    c.beginPath();
    for (var i = 0; i <= n; i++) {
      var a = i / n * TAU, ca = Math.cos(a), sa = Math.sin(a);
      var x = A * Math.sign(ca) * Math.pow(Math.abs(ca), 0.9), y = B * Math.sign(sa) * Math.pow(Math.abs(sa), 1.25);
      var w = wob ? wob(i / n) : 0, nx = x / A, ny = y / B, nl = Math.hypot(nx, ny) || 1;
      x += nx / nl * w; y += ny / nl * w;
      if (i) c.lineTo(cx + x, cy + y); else c.moveTo(cx + x, cy + y);
    }
    c.closePath();
  }
  var CRAFT = {
    no: 'US 10,144,532 B2', stamp: 'AFTER FIG. 1', hand: 'Inertial Mass Reduction Craft',
    fig: 'CRAFT · CROSS-SECTION · RESONANT CAVITY SHROUD 156', figShort: 'CRAFT · CROSS-SECTION',
    layout: function (s) {
      s.cx = s.W * (s.small ? 0.5 : 0.42); s.cy = s.H * 0.56;
      s.A = Math.min(s.W * (s.small ? 0.34 : 0.24), s.H * 0.62); s.B = s.A * 0.36;
      var r = rng(7); s.gas = [];
      for (var i = 0; i < 70; i++) s.gas.push({ a: r() * TAU, f: 0.79 + r() * 0.17, v: (r() - 0.5) * 0.5 });
      s.dip = [];
      for (var gx = 12; gx < s.W; gx += 22) for (var gy = 40; gy < s.H - 20; gy += 22) s.dip.push([gx, gy]);
    },
    draw: function (c, s, t) {
      var cx = s.cx, cy = s.cy, A = s.A, B = s.B, ai = 0.8, bi = 0.66, i;
      // the polarized vacuum: little dipoles line up with the field around the hull
      var pulse = 0.65 + 0.35 * Math.sin(t * 1.7);
      c.lineWidth = 1.2;
      for (i = 0; i < s.dip.length; i++) {
        var px = s.dip[i][0], py = s.dip[i][1], dx = (px - cx) / (A * 1.0), dy = (py - cy) / (B * 1.9);
        var d = Math.hypot(dx, dy);
        if (d < 1.06) continue;
        var str = clamp(1.9 / (d * d) * pulse, 0, 1), ang = Math.atan2(py - cy, (px - cx) * 0.55);
        var jitter = (1 - str) * Math.sin(px * 0.7 + py * 0.3 + t * 2.2) * 1.6;
        var a = ang * str + jitter, L = 3 + 4 * str;
        c.strokeStyle = rgba(str > 0.45 ? C.ion : C.ink, 0.12 + 0.55 * str);
        c.beginPath(); c.moveTo(px - Math.cos(a) * L, py - Math.sin(a) * L); c.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L); c.stroke();
        c.fillStyle = rgba(C.alp, 0.5 * str); c.fillRect(px + Math.cos(a) * L - 1, py + Math.sin(a) * L - 1, 2, 2);
      }
      c.setLineDash([4, 6]); c.strokeStyle = rgba(C.ion, 0.35 + 0.2 * pulse); c.lineWidth = 1;
      lens(c, cx, cy, A * 1.32, B * 1.62); c.stroke(); c.setLineDash([]);
      // outer resonant cavity wall 100 (charged, vibrating) and inner wall 200 (insulated)
      lens(c, cx, cy, A, B); c.fillStyle = 'rgba(14,30,92,0.95)'; c.fill();
      c.save(); lens(c, cx, cy, A, B); c.clip();
      c.fillStyle = rgba(C.vio, 0.16); c.fillRect(cx - A, cy - B, A * 2, B * 2);   // xenon 155 in the cavity 150
      c.restore();
      // microwave waves crossing the cavity
      c.save(); lens(c, cx, cy, A, B); lens(c, cx, cy, A * ai, B * bi); c.clip('evenodd');
      for (i = 0; i < 8; i++) {
        var ea = i / 8 * TAU + 0.2, ex = cx + Math.cos(ea) * A * ai * 0.96, ey = cy + Math.sin(ea) * B * bi * 0.96;
        for (var k = 0; k < 3; k++) {
          var rr = ((t * 60 + k * 18 + i * 7) % 54);
          c.strokeStyle = rgba(C.amb, (1 - rr / 54) * 0.7); c.lineWidth = 1.2;
          c.beginPath(); c.arc(ex, ey, rr, 0, TAU); c.stroke();
        }
      }
      for (i = 0; i < s.gas.length; i++) {
        var gp = s.gas[i], ga = gp.a + t * gp.v;
        c.fillStyle = rgba(C.vio, 0.85);
        c.beginPath(); c.arc(cx + Math.cos(ga) * A * gp.f * 0.99, cy + Math.sin(ga) * B * gp.f * 0.99 * (0.9 + 0.1 * Math.sin(t * 3 + i)), 1.3, 0, TAU); c.fill();
      }
      c.restore();
      // the emitters themselves, on the inner wall
      for (i = 0; i < 8; i++) {
        var ea2 = i / 8 * TAU + 0.2;
        c.save(); c.translate(cx + Math.cos(ea2) * A * ai, cy + Math.sin(ea2) * B * bi); c.rotate(ea2);
        c.fillStyle = rgba(C.amb, 0.9); c.fillRect(-3, -4, 6, 8); c.restore();
      }
      lens(c, cx, cy, A * ai, B * bi); c.fillStyle = '#0b1c54'; c.fill();
      c.strokeStyle = rgba(C.ink, 0.75); c.lineWidth = 1.4; c.stroke();
      // compartments in a Faraday cage: crew 55, power plant 56, cargo 57
      var fw = A * 0.6, fh = B * bi * 1.3, fx = cx - fw / 2, fy = cy - fh / 2;
      c.strokeStyle = rgba(C.ink, 0.16); c.lineWidth = 1;
      for (var hx = fx; hx <= fx + fw; hx += 7) { c.beginPath(); c.moveTo(hx, fy); c.lineTo(hx, fy + fh); c.stroke(); }
      for (var hy = fy; hy <= fy + fh; hy += 7) { c.beginPath(); c.moveTo(fx, hy); c.lineTo(fx + fw, hy); c.stroke(); }
      c.strokeStyle = rgba(C.ink, 0.6); c.strokeRect(fx, fy, fw, fh);
      var names = s.small ? ['CREW', 'POWER', 'CARGO'] : ['CREW 55', 'POWER PLANT 56', 'CARGO 57'], cols = [C.blu, C.amb, C.grn];
      for (i = 0; i < 3; i++) {
        var bw = fw / 3 - 6, bx = fx + 3 + i * fw / 3;
        c.fillStyle = 'rgba(8,22,70,0.9)'; c.fillRect(bx, fy + 4, bw, fh - 8);
        c.strokeStyle = rgba(cols[i], 0.9); c.lineWidth = 1.1; c.strokeRect(bx, fy + 4, bw, fh - 8);
        c.font = mono(s.small ? 6.5 : 7.5);
        var nm = c.measureText(names[i]).width > bw - 4 ? names[i].split(' ')[0] : names[i];
        text(c, nm, bx + bw / 2, cy, mono(s.small ? 6.5 : 7.5), rgba(cols[i], 0.95), 'center');
      }
      if (i) { var pg = c.createRadialGradient(cx, cy, 0, cx, cy, fh * 0.5); pg.addColorStop(0, rgba(C.amb, 0.25 + 0.1 * Math.sin(t * 5))); pg.addColorStop(1, 'rgba(255,176,87,0)'); c.fillStyle = pg; c.fillRect(cx - fh * 0.5, cy - fh * 0.5, fh, fh); }
      // the outer wall vibrates in "accelerated mode": a fast ripple, charge riding on it
      var amp = 1.6 + 0.8 * Math.sin(t * 2.3);
      lens(c, cx, cy, A, B, function (u) { return amp * Math.sin(u * TAU * 46 - t * 34); });
      c.strokeStyle = rgba(C.ion, 0.25); c.lineWidth = 5; c.stroke();
      c.strokeStyle = 'rgba(235,250,255,0.95)'; c.lineWidth = 1.6; c.stroke();
      for (i = 0; i < 18; i++) {
        var qa = i / 18 * TAU + t * 0.4, qx = cx + Math.cos(qa) * (A + 9) * 1.0, qy = cy + Math.sin(qa) * (B + 9) * 1.05;
        text(c, '+', qx, qy, mono(9), rgba(C.alp, 0.8), 'center');
      }
      // frustum 25 on the leading portion, spinning about its own axis 26
      var ftop = cy - B - B * 0.55, fb = cy - B * 0.97, wb = A * 0.22, wt = A * 0.12;
      c.beginPath(); c.moveTo(cx - wb, fb); c.lineTo(cx - wt, ftop); c.lineTo(cx + wt, ftop); c.lineTo(cx + wb, fb); c.closePath();
      c.fillStyle = 'rgba(14,30,92,0.95)'; c.fill(); c.strokeStyle = 'rgba(235,250,255,0.9)'; c.lineWidth = 1.4; c.stroke();
      c.save(); c.clip();
      for (i = 0; i < 10; i++) {
        var ph = (i / 10 * TAU + t * 3.2) % TAU, cs = Math.cos(ph);
        if (Math.sin(ph) < 0) continue;
        c.strokeStyle = rgba(C.ion, 0.25 + 0.5 * Math.sin(ph)); c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx + cs * wb, fb); c.lineTo(cx + cs * wt, ftop); c.stroke();
      }
      c.restore();
      c.setLineDash([2, 4]); c.strokeStyle = rgba(C.ink, 0.45);
      c.beginPath(); c.moveTo(cx, ftop - 16); c.lineTo(cx, cy + B + 14); c.stroke(); c.setLineDash([]);
      // labels
      if (s.small) {
        text(c, 'polarized vacuum', cx, cy + B * 1.62 + 14, hand(12), rgba(C.ion, 0.85), 'center');
        return;
      }
      var R = s.W - 24, lx = Math.min(R - 250, cx + A * 1.42);
      callout(c, s, cx + wt * 0.6, ftop + 6, lx, ftop - 2, 'FRUSTUM 25 · ROTATES ON AXIS 26', 'on the leading portion', C.ion);
      callout(c, s, cx + A * 0.86, cy - B * 0.42, lx, cy - B * 0.62, 'OUTER RESONANT CAVITY WALL 100', 'charged · vibrated in "accelerated mode"', '235,250,255');
      callout(c, s, cx + A * 0.82, cy + B * 0.06, lx, cy + B * 0.2, 'MICROWAVE EMITTERS 300', '300 MHz – 300 GHz, inside the cavity', C.amb);
      callout(c, s, cx + A * 0.64, cy + B * 0.62, lx, cy + B * 1.02, 'RESONANT CAVITY 150 · XENON 155', 'inner wall 200 is insulated', C.vio);
      var L = Math.max(24, cx - A * 1.45 - 210);
      if (cx - A * 1.32 - 24 > 150) {
        callout(c, s, cx - A * 1.22, cy - B * 0.9, L + 200, cy - B * 1.7, 'LOCAL POLARIZED VACUUM', 'the field the craft is said to move in', C.ion);
        callout(c, s, fx + 6, fy + fh * 0.75, L + 200, cy + B * 1.3, 'FARADAY CAGE 58', 'guards crew, power plant, cargo', C.ink);
      }
    }
  };

  /* ════════════ 2 · ELECTROMAGNETIC FIELD GENERATOR (HEEMFG) ════════════ */
  var HEEM = {
    no: 'US 10,135,366 B2', stamp: 'AFTER FIG. 1', hand: 'High Energy EM Field Generator',
    fig: 'SPHERICAL SHELL 100 · CROSS-SECTION', figShort: 'SPHERICAL SHELL · SECTION',
    layout: function (s) {
      s.cx = s.W * (s.small ? 0.5 : 0.36); s.cy = s.H * 0.55;
      s.R = Math.min(s.H * 0.36, s.W * (s.small ? 0.36 : 0.22));
      var r = rng(11); s.peb = [];
      for (var i = 0; i < 36; i++) { var a = r() * TAU, d = Math.sqrt(r()) * 0.15; s.peb.push([Math.cos(a) * d, Math.sin(a) * d, r()]); }
    },
    draw: function (c, s, t) {
      var cx = s.cx, cy = s.cy, R = s.R, i, spin = t * 1.1, Ri = R * 0.86;
      // EM flux radiating outward from the charged, spinning, vibrating shell
      for (i = 0; i < 4; i++) {
        var u = ((t * 0.55 + i / 4) % 1), rr = R + u * R * 1.15;
        c.strokeStyle = rgba(C.ion, (1 - u) * 0.55); c.lineWidth = 1.5 + (1 - u) * 1.5;
        c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.stroke();
      }
      for (i = 0; i < 16; i++) {
        var fa = i / 16 * TAU, f0 = R + 6, f1 = R + R * (0.5 + 0.12 * Math.sin(t * 3 + i));
        c.strokeStyle = rgba(C.ion, 0.22); c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx + Math.cos(fa) * f0, cy + Math.sin(fa) * f0); c.lineTo(cx + Math.cos(fa) * f1, cy + Math.sin(fa) * f1); c.stroke();
      }
      // shell: PZT ceramic in an aluminum matrix, spun and vibrated
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.arc(cx, cy, Ri, 0, TAU, true);
      c.fillStyle = rgba(C.blu, 0.22); c.fill('evenodd');
      for (i = 0; i < 28; i++) {
        var pa = i / 28 * TAU + spin, vib = Math.sin(t * 40 + i) * 1.2, pr = (R + Ri) / 2 + vib;
        c.save(); c.translate(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr); c.rotate(pa);
        c.fillStyle = rgba(C.yel, 0.85); c.fillRect(-2.5, -4, 5, 8); c.restore();
      }
      c.strokeStyle = 'rgba(235,250,255,0.95)'; c.lineWidth = 1.7;
      c.beginPath(); c.arc(cx, cy, R + Math.sin(t * 30) * 0.8, 0, TAU); c.stroke();
      c.strokeStyle = rgba(C.ink, 0.7); c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, Ri, 0, TAU); c.stroke();
      for (i = 0; i < 14; i++) { var qa = i / 14 * TAU + spin; text(c, '+', cx + Math.cos(qa) * (R + 11), cy + Math.sin(qa) * (R + 11), mono(10), rgba(C.alp, 0.85), 'center'); }
      // cruciform strut framework 103, turned by the motor, fixed to the shell's inside
      c.strokeStyle = rgba(C.grn, 0.55); c.lineWidth = 3;
      for (i = 0; i < 4; i++) {
        var sa = spin + i * Math.PI / 2;
        c.beginPath(); c.moveTo(cx + Math.cos(sa) * R * 0.3, cy + Math.sin(sa) * R * 0.3); c.lineTo(cx + Math.cos(sa) * Ri, cy + Math.sin(sa) * Ri); c.stroke();
      }
      // bearings 102 on the support structure 101 (everything inside stays still)
      c.strokeStyle = rgba(C.ink, 0.6); c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R * 0.3, 0, TAU); c.stroke();
      for (i = 0; i < 12; i++) { var ba = i / 12 * TAU - spin * 0.5; c.beginPath(); c.arc(cx + Math.cos(ba) * R * 0.3, cy + Math.sin(ba) * R * 0.3, 2.2, 0, TAU); c.stroke(); }
      // the annulus: thermoelectric generator 400 around the pebble-bed reactor 300
      c.fillStyle = rgba(C.red, 0.18); c.beginPath(); c.arc(cx, cy, R * 0.25, 0, TAU); c.arc(cx, cy, R * 0.18, 0, TAU, true); c.fill('evenodd');
      c.strokeStyle = rgba(C.red, 0.8); c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R * 0.25, 0, TAU); c.stroke();
      var hg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.2);
      hg.addColorStop(0, rgba(C.amb, 0.7 + 0.2 * Math.sin(t * 4))); hg.addColorStop(1, 'rgba(255,176,87,0.05)');
      c.fillStyle = hg; c.beginPath(); c.arc(cx, cy, R * 0.18, 0, TAU); c.fill();
      for (i = 0; i < s.peb.length; i++) {
        var pb = s.peb[i];
        c.fillStyle = rgba(C.yel, 0.55 + 0.45 * Math.sin(t * 3 + pb[2] * 9));
        c.beginPath(); c.arc(cx + pb[0] * R, cy + pb[1] * R, 2.1, 0, TAU); c.fill();
      }
      // two Pelletron generators 200: chains of pellets carry charge up to the shell
      [-1, 1].forEach(function (sg) {
        var x = cx + sg * R * 0.56, y0 = cy + R * 0.48, y1 = cy - R * 0.5, w = R * 0.07;
        c.strokeStyle = rgba(C.ink, 0.7); c.lineWidth = 1;
        c.strokeRect(x - w, y1, w * 2, y0 - y1);
        c.fillStyle = 'rgba(14,30,92,0.95)'; c.beginPath(); c.arc(x, y1, w * 1.8, Math.PI, 0); c.fill(); c.stroke();
        var n = 14, L = (y0 - y1) * 2 + w * 2 * Math.PI / 2;
        for (var k = 0; k < n; k++) {
          var p = ((k / n + t * 0.35 * sg) % 1 + 1) % 1, ppx, ppy, half = (y0 - y1);
          if (p < 0.5) { ppx = x - w * 0.55; ppy = y0 - (y0 - y1) * (p / 0.5); } else { ppx = x + w * 0.55; ppy = y1 + (y0 - y1) * ((p - 0.5) / 0.5); }
          c.fillStyle = rgba(p < 0.5 ? C.alp : C.ink, 0.95); c.beginPath(); c.arc(ppx, ppy, 1.8, 0, TAU); c.fill();
        }
        if (Math.sin(t * 6 + sg) > 0.6) {   // charge jumps to the shell
          c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.2; c.beginPath();
          var sx = x, sy = y1 - w * 1.8, ex = cx + sg * Ri * 0.62, ey = cy - Ri * 0.78;
          c.moveTo(sx, sy);
          for (var q = 1; q <= 5; q++) c.lineTo(sx + (ex - sx) * q / 5 + Math.sin(t * 50 + q) * 4, sy + (ey - sy) * q / 5);
          c.stroke();
        }
      });
      // motor 500
      c.fillStyle = 'rgba(8,22,70,0.95)'; c.fillRect(cx - R * 0.1, cy + R * 0.33, R * 0.2, R * 0.14);
      c.strokeStyle = rgba(C.grn, 0.9); c.strokeRect(cx - R * 0.1, cy + R * 0.33, R * 0.2, R * 0.14);
      text(c, 'M', cx, cy + R * 0.4, mono(9), rgba(C.grn, 0.95), 'center');
      if (s.small) return;
      // the other two shells the patent describes
      var ix = s.cx + R * 2.25, iy = s.H * 0.2;
      if (ix + 120 < s.W) {
        text(c, 'ALSO CLAIMED', ix, iy - 2, mono(8), rgba(C.ink, 0.6));
        c.strokeStyle = rgba(C.ink, 0.85); c.lineWidth = 1.2;
        c.beginPath(); c.arc(ix + 22, iy + 42, 18, Math.PI, 0); c.closePath(); c.stroke();
        c.beginPath(); c.moveTo(ix + 22, iy + 24); c.lineTo(ix + 22, iy + 12); c.stroke();
        text(c, 'HEMISPHERE 105 · sea', ix + 50, iy + 34, mono(8), rgba(C.ink, 0.85));
        c.beginPath(); c.ellipse(ix + 22, iy + 80, 20, 6, 0, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(ix + 22, iy + 74); c.lineTo(ix + 22, iy + 60); c.stroke();
        text(c, 'DISC 110 · land', ix + 50, iy + 78, mono(8), rgba(C.ink, 0.85));
        text(c, 'both with a spike 125', ix, iy + 104, hand(12.5), rgba(C.ink, 0.65));
      }
      var lx = cx + R * 1.5, R2 = s.W - 24;
      if (R2 - lx > 220) {
        var top = Math.max(60, cy - R * 0.62), step = Math.min(R * 0.42, (s.H - 46 - top) / 3.4);
        callout(c, s, cx + R * 0.95, cy - R * 0.25, lx, top, 'SHELL 100 · PZT IN ALUMINUM', 'charged · spun · vibrated', C.yel);
        callout(c, s, cx + R * 0.56, cy - R * 0.2, lx, top + step, 'PELLETRON GENERATORS 200', 'charge the shell from inside', C.alp);
        callout(c, s, cx + R * 0.12, cy + R * 0.05, lx, top + step * 2, 'PEBBLE-BED REACTOR 300 · 1–10 MW', 'inside thermoelectric generator 400', C.amb);
        callout(c, s, cx + R * 0.1, cy + R * 0.4, lx, top + step * 3, 'MOTOR 500 → CRUCIFORM STRUTS 103', 'spin the shell on bearings 102', C.grn);
      }
      text(c, 'EM flux directed outward', cx, cy - R * 2.0 + 30 < 40 ? 40 : cy - R - 34, hand(14), rgba(C.ion, 0.85), 'center');
    }
  };

  /* ════════════ 3 · PIEZOELECTRICITY-INDUCED ROOM TEMPERATURE SUPERCONDUCTOR ════════════ */
  var RTSC = {
    no: 'US 2019/0058105 A1', stamp: 'AFTER FIG. 1–2', hand: 'Room Temperature Superconductor',
    fig: 'COMPOSITE WIRE 100 · HELICAL COIL 200', figShort: 'WIRE 100 · COIL 200',
    layout: function (s) {
      s.x0 = s.W * 0.06; s.x1 = s.W * (s.small ? 0.94 : 0.64); s.yc = s.H * (s.small ? 0.5 : 0.54);
      s.r = clamp(s.H * 0.075, 12, 28);
    },
    draw: function (c, s, t) {
      var x0 = s.x0, x1 = s.x1, L = x1 - x0, r = s.r, i, n = 140;
      var kick = Math.pow(Math.max(0, Math.sin(t * 2.4)), 6);           // "abruptly vibrated": sharp strikes
      var amp = r * (0.18 + 0.55 * kick);
      function yAt(x) { var u = (x - x0) / L; return s.yc + amp * Math.sin(Math.PI * u * 3) * Math.sin(t * 26); }
      var pitch = r * 1.25, Rc = r * 1.75;
      function helix(front) {
        c.beginPath(); var on = false;
        for (var x = x0 + 8; x <= x1 - 8; x += 1.5) {
          var ph = (x - x0) / pitch * TAU, z = Math.cos(ph);
          var vis = front ? z >= 0 : z < 0;
          var y = yAt(x) + Math.sin(ph) * Rc;
          if (vis) { if (on) c.lineTo(x, y); else { c.moveTo(x, y); on = true; } } else on = false;
        }
      }
      helix(false); c.strokeStyle = rgba(C.amb, 0.35); c.lineWidth = 2.2; c.stroke();
      // the wire: insulator core 110 with a thin coating 120
      c.beginPath();
      for (i = 0; i <= n; i++) { var x = x0 + L * i / n; if (i) c.lineTo(x, yAt(x) - r); else c.moveTo(x, yAt(x) - r); }
      for (i = n; i >= 0; i--) { var x2 = x0 + L * i / n; c.lineTo(x2, yAt(x2) + r); }
      c.closePath();
      var g = c.createLinearGradient(0, s.yc - r, 0, s.yc + r);
      g.addColorStop(0, 'rgba(120,140,200,0.55)'); g.addColorStop(0.45, 'rgba(60,78,140,0.7)'); g.addColorStop(1, 'rgba(30,40,90,0.75)');
      c.fillStyle = g; c.fill();
      [-1, 1].forEach(function (sg) {
        c.beginPath();
        for (var k = 0; k <= n; k++) { var xx = x0 + L * k / n; if (k) c.lineTo(xx, yAt(xx) + sg * r); else c.moveTo(xx, yAt(xx) + sg * r); }
        c.strokeStyle = rgba(C.teal, 0.95); c.lineWidth = 3; c.stroke();
      });
      // pulsed current in the coating
      for (i = 0; i < 4; i++) {
        var px = x0 + ((t * 0.38 + i / 4) % 1) * L;
        [-1, 1].forEach(function (sg) {
          var pg = c.createRadialGradient(px, yAt(px) + sg * r, 0, px, yAt(px) + sg * r, 16);
          pg.addColorStop(0, 'rgba(240,255,250,0.95)'); pg.addColorStop(1, 'rgba(94,240,192,0)');
          c.fillStyle = pg; c.beginPath(); c.arc(px, yAt(px) + sg * r, 16, 0, TAU); c.fill();
        });
      }
      // the coil in front, pulsed at a different rate
      helix(true); c.strokeStyle = rgba(C.amb, 0.95); c.lineWidth = 2.4; c.stroke();
      c.setLineDash([10, 60]); c.lineDashOffset = -t * 220; c.strokeStyle = 'rgba(255,245,220,0.95)'; c.lineWidth = 2.6; c.stroke(); c.setLineDash([]);
      // a glow when a strike and a pulse coincide: the claimed superconducting state
      if (kick > 0.15) {
        c.globalCompositeOperation = 'lighter';
        var sgw = c.createLinearGradient(0, s.yc - r * 3, 0, s.yc + r * 3);
        sgw.addColorStop(0, 'rgba(89,243,255,0)'); sgw.addColorStop(0.5, rgba(C.ion, 0.35 * kick)); sgw.addColorStop(1, 'rgba(89,243,255,0)');
        c.fillStyle = sgw; c.fillRect(x0, s.yc - r * 3, L, r * 6);
        c.globalCompositeOperation = 'source-over';
      }
      // strike marks
      if (kick > 0.4) for (i = 0; i < 3; i++) { var kx = x0 + L * (0.2 + 0.3 * i); text(c, '⚡', kx, s.yc - r * 2.6, mono(12), rgba(C.yel, kick), 'center'); }
      if (s.small) { text(c, 'pulsed current · abrupt vibration', s.W / 2, s.H - 32, hand(12), rgba(C.ink, 0.8), 'center'); return; }
      // cross-section inset and two pulse trains
      var ix = x1 + (s.W - x1) * 0.18, icx = ix + 70, icy = s.H * 0.36, iR = Math.min(54, (s.W - x1) * 0.2);
      if (s.W - x1 > 260) {
        text(c, 'SECTION A–A', ix, s.H * 0.13, mono(8.5), rgba(C.ink, 0.85));
        c.fillStyle = 'rgba(60,78,140,0.8)'; c.beginPath(); c.arc(icx, icy, iR, 0, TAU); c.fill();
        c.strokeStyle = rgba(C.teal, 0.95); c.lineWidth = 4; c.beginPath(); c.arc(icx, icy, iR, 0, TAU); c.stroke();
        text(c, 'CORE 110', icx, icy - 6, mono(8), 'rgba(220,230,255,0.95)', 'center');
        text(c, 'Teflon', icx, icy + 8, hand(12), 'rgba(220,230,255,0.8)', 'center');
        c.strokeStyle = rgba(C.teal, 0.7); c.lineWidth = 1;
        c.beginPath(); c.moveTo(icx + iR * 0.72, icy - iR * 0.72); c.lineTo(icx + iR + 18, icy - iR - 10); c.stroke();
        text(c, 'COATING 120', icx + iR + 22, icy - iR - 10, mono(8), rgba(C.teal, 0.95));
        text(c, 'PZT / aluminum, about one', icx + iR + 22, icy - iR + 4, hand(12), rgba(C.teal, 0.8));
        text(c, 'London penetration depth', icx + iR + 22, icy - iR + 18, hand(12), rgba(C.teal, 0.8));
        var tx0 = ix, tw = Math.min(s.W - ix - 26, 260), ty = s.H * 0.72;
        [['WIRE 100 · PULSED', C.teal, 0.38, 0], ['COIL 200 · DIFFERENT RATE', C.amb, 0.61, 1]].forEach(function (tr, j) {
          var yb = ty + j * 44;
          text(c, tr[0], tx0, yb - 16, mono(8), rgba(tr[1], 0.95));
          c.beginPath();
          for (var k = 0; k <= 120; k++) {
            var u = k / 120, ph = (u * 6 + t * tr[2] * 3) % 1;
            var v = ph < (j ? 0.18 : 0.1) ? 1 : 0;
            if (k) c.lineTo(tx0 + tw * u, yb + 10 - v * 18); else c.moveTo(tx0 + tw * u, yb + 10 - v * 18);
          }
          c.strokeStyle = rgba(tr[1], 0.9); c.lineWidth = 1.4; c.stroke();
        });
      }
      callout(c, s, x0 + L * 0.3, s.yc + r + 2, x0 + L * 0.18, s.H - 46, 'HELICAL COIL 200', 'wound around the wire', C.amb);
      callout(c, s, x0 + L * 0.22, s.yc - r, x0 + L * 0.3, s.H * 0.15, 'WIRE 100 · STRUCK, THEN PULSED', '"abruptly vibrated" mechanically, magnetically or electrically', C.teal);
    }
  };

  /* ════════════ 4 · PLASMA COMPRESSION FUSION DEVICE ════════════ */
  var FUSION = {
    no: 'US 2019/0295733 A1', stamp: 'AFTER FIG. 1', hand: 'Plasma Compression Fusion Device',
    fig: 'CROSS-DUCT 100 · TWO PAIRS OF DYNAMIC FUSORS 200', figShort: 'CROSS-DUCT · FUSORS',
    layout: function (s) {
      s.cx = s.W * (s.small ? 0.5 : 0.38); s.cy = s.H * 0.54;
      s.L = Math.min(s.H * 0.42, s.W * (s.small ? 0.42 : 0.26)); s.w = s.L * 0.42;
      var r = rng(19); s.gas = [];
      for (var i = 0; i < 40; i++) s.gas.push({ d: Math.floor(r() * 4), u: r(), o: (r() - 0.5) });
    },
    draw: function (c, s, t) {
      var cx = s.cx, cy = s.cy, L = s.L, w = s.w, i;
      var dirs = [[0, -1, 1], [0, 1, -1], [-1, 0, 1], [1, 0, -1]];   // [dx, dy, spin]: each opposed pair counter-spins
      var squeeze = 0.5 + 0.5 * Math.sin(t * 1.6);
      // the cross-shaped duct and its vacuum chamber 110
      function cross(e) {
        c.beginPath();
        c.moveTo(cx - w - e, cy - L - e); c.lineTo(cx + w + e, cy - L - e); c.lineTo(cx + w + e, cy - w - e); c.lineTo(cx + L + e, cy - w - e);
        c.lineTo(cx + L + e, cy + w + e); c.lineTo(cx + w + e, cy + w + e); c.lineTo(cx + w + e, cy + L + e); c.lineTo(cx - w - e, cy + L + e);
        c.lineTo(cx - w - e, cy + w + e); c.lineTo(cx - L - e, cy + w + e); c.lineTo(cx - L - e, cy - w - e); c.lineTo(cx - w - e, cy - w - e); c.closePath();
      }
      cross(7); c.fillStyle = rgba(C.ink, 0.12); c.fill(); c.strokeStyle = rgba(C.ink, 0.85); c.lineWidth = 1.5; c.stroke();
      cross(0); c.fillStyle = '#050d30'; c.fill(); c.strokeStyle = rgba(C.ink, 0.5); c.lineWidth = 1; c.stroke();
      // magnetic flux funnelled from the four apexes into the core
      c.globalCompositeOperation = 'lighter';
      for (i = 0; i < 4; i++) {
        var d = dirs[i], ax = cx + d[0] * L * 0.32, ay = cy + d[1] * L * 0.32;
        for (var k = -2; k <= 2; k++) {
          var px = -d[1], py = d[0], spread = k * w * 0.18;
          c.beginPath(); c.moveTo(ax + px * spread * 0.3, ay + py * spread * 0.3);
          c.quadraticCurveTo(cx + d[0] * L * 0.15 + px * spread * (1.4 - squeeze * 0.6), cy + d[1] * L * 0.15 + py * spread * (1.4 - squeeze * 0.6), cx, cy);
          c.strokeStyle = rgba(C.vio, 0.35); c.lineWidth = 1; c.stroke();
        }
      }
      // plasma core 75: compressed, heated, held between the fusors
      var cr = w * (0.62 - 0.22 * squeeze);
      var pg = c.createRadialGradient(cx, cy, 0, cx, cy, cr * 2.2);
      pg.addColorStop(0, 'rgba(255,250,255,0.95)'); pg.addColorStop(0.3, rgba(C.pnk, 0.6 + 0.3 * squeeze)); pg.addColorStop(0.65, rgba(C.vio, 0.25)); pg.addColorStop(1, 'rgba(165,139,255,0)');
      c.fillStyle = pg; c.beginPath(); c.arc(cx, cy, cr * 2.2, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over';
      // gas from the orifices 205
      for (i = 0; i < s.gas.length; i++) {
        var gp = s.gas[i], dd = dirs[gp.d], u = (gp.u + t * 0.4) % 1;
        var sx = cx + dd[0] * L * 0.42 - dd[1] * gp.o * w * 0.8, sy = cy + dd[1] * L * 0.42 + dd[0] * gp.o * w * 0.8;
        var gx = sx + (cx - sx) * u, gy = sy + (cy - sy) * u;
        c.fillStyle = rgba(C.grn, 0.85 * (1 - u)); c.beginPath(); c.arc(gx, gy, 1.5, 0, TAU); c.fill();
      }
      // the four counter-spinning conical fusors on their hollow shafts 220
      for (i = 0; i < 4; i++) {
        var df = dirs[i], ang = Math.atan2(df[1], df[0]);
        c.save(); c.translate(cx, cy); c.rotate(ang);
        var tip = L * 0.3, base = L * 0.86, hw = w * 0.78;
        // shaft (fuel conduit) out through the duct end
        c.fillStyle = rgba(C.ink, 0.18); c.fillRect(base, -w * 0.14, L * 0.36, w * 0.28);
        c.strokeStyle = rgba(C.ink, 0.7); c.lineWidth = 1; c.strokeRect(base, -w * 0.14, L * 0.36, w * 0.28);
        c.setLineDash([4, 7]); c.lineDashOffset = t * 30; c.strokeStyle = rgba(C.grn, 0.9); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(base + L * 0.36, 0); c.lineTo(base, 0); c.stroke(); c.setLineDash([]);
        // cone with a smoothly curved apex 201
        c.beginPath(); c.moveTo(base, -hw); c.lineTo(tip + w * 0.22, -w * 0.18);
        c.quadraticCurveTo(tip - w * 0.05, 0, tip + w * 0.22, w * 0.18); c.lineTo(base, hw); c.closePath();
        var cg = c.createLinearGradient(0, -hw, 0, hw);
        cg.addColorStop(0, 'rgba(150,170,220,0.6)'); cg.addColorStop(0.5, 'rgba(70,90,160,0.75)'); cg.addColorStop(1, 'rgba(30,40,90,0.8)');
        c.fillStyle = cg; c.fill(); c.strokeStyle = rgba(C.ion, 0.85); c.lineWidth = 1.5; c.stroke();
        c.save(); c.clip();
        for (var k2 = 0; k2 < 9; k2++) {   // rotation stripes; opposite fusors turn opposite ways
          var ph = (k2 / 9 * TAU + t * 4 * df[2]) % TAU, sv = Math.sin(ph);
          if (Math.cos(ph) < 0) continue;
          c.strokeStyle = rgba('220,235,255', 0.15 + 0.35 * Math.cos(ph)); c.lineWidth = 1;
          c.beginPath(); c.moveTo(base, sv * hw); c.lineTo(tip, sv * w * 0.15); c.stroke();
        }
        c.restore();
        for (var o = 0; o < 4; o++) { c.fillStyle = rgba(C.grn, 0.95); c.beginPath(); c.arc(tip + (base - tip) * (0.3 + 0.17 * o), (o % 2 ? 1 : -1) * hw * (0.3 + 0.17 * o) * 0.9, 1.8, 0, TAU); c.fill(); }
        c.restore();
        // charge on its surface
        text(c, df[2] > 0 ? '⟳' : '⟲', cx + df[0] * L * 0.66 + df[1] * w * 1.05, cy + df[1] * L * 0.66 - df[0] * w * 1.05, mono(13), rgba(C.alp, 0.9), 'center');
      }
      if (s.small) return;
      var lx = cx + L * 1.35, R = s.W - 24;
      if (R - lx > 230) {
        var top = Math.max(58, cy - L * 0.82), step = (s.H - 50 - top) / 4.3;
        callout(c, s, cx + w * 0.6, cy - L * 0.6, lx, top, 'DYNAMIC FUSORS 200', 'charged · counter-spinning pairs', C.ion);
        callout(c, s, cx + L * 0.5, cy - w * 0.35, lx, top + step, 'GAS ORIFICES 205', 'deuterium preferred; p–¹¹B also named', C.grn);
        callout(c, s, cx + L * 1.0, cy + 2, lx, top + step * 2, 'HOLLOW SHAFTS 220 · FUEL CONDUITS', '', C.grn);
        callout(c, s, cx + w * 0.3, cy + w * 0.3, lx, top + step * 3, 'PLASMA CORE 75', 'compressed, heated, confined', C.pnk);
        callout(c, s, cx + w + 4, cy + L * 0.7, lx, top + step * 4, 'VACUUM CHAMBER 110 · ~10⁻⁵ TORR', 'inside cross-duct 100', C.ink);
      }
    }
  };

  /* ════════════ 5 · HIGH FREQUENCY GRAVITATIONAL WAVE GENERATOR ════════════ */
  function wedge(c, ax, ay, rot, scale, kind) {
    var P = kind ? [[-0.15, -0.95], [0.9, -0.2], [0.55, 0.55], [-0.35, 0.7]] : [[-0.2, -0.75], [0.75, -0.55], [0.45, 0.8], [-0.6, 0.35]];
    var cs = Math.cos(rot), sn = Math.sin(rot);
    c.beginPath();
    P.forEach(function (p, i) { var x = ax + (p[0] * cs - p[1] * sn) * scale, y = ay + (p[0] * sn + p[1] * cs) * scale; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath();
  }
  var HFGW = {
    no: 'US 10,322,827 B2', stamp: 'AFTER FIG. 1–2', hand: 'Gravitational Wave Generator',
    fig: 'GAS-FILLED SHELL 100 · COUNTER-SPINNING CAVITIES 300', figShort: 'SHELL 100 · CAVITIES 300',
    layout: function (s) {
      s.cx = s.W * (s.small ? 0.5 : 0.34); s.cy = s.H * 0.55;
      s.R = Math.min(s.H * 0.36, s.W * (s.small ? 0.36 : 0.21));
    },
    draw: function (c, s, t) {
      var cx = s.cx, cy = s.cy, R = s.R, i;
      // spacetime grid, rippled by waves leaving the shell
      var waves = []; for (i = 0; i < 3; i++) waves.push(R + ((t * 0.32 + i / 3) % 1) * Math.max(s.W, s.H) * 0.7);
      function disp(x, y) {
        var dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1, d = 0;
        for (var k = 0; k < waves.length; k++) d += 11 * Math.exp(-Math.pow((r - waves[k]) / 18, 2)) * Math.sin((r - waves[k]) * 0.32);
        return [x + dx / r * d, y + dy / r * d];
      }
      c.strokeStyle = rgba(C.vio, 0.42); c.lineWidth = 1.1;
      for (var gx = 28; gx < s.W; gx += 28) { c.beginPath(); for (var y = 30; y < s.H - 10; y += 8) { var p = disp(gx, y); if (y === 30) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); } c.stroke(); }
      for (var gy = 30; gy < s.H - 10; gy += 28) { c.beginPath(); for (var x = 0; x < s.W; x += 8) { var q = disp(x, gy); if (!x) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); } c.stroke(); }
      for (i = 0; i < waves.length; i++) {
        var a = clamp(1 - (waves[i] - R) / (Math.max(s.W, s.H) * 0.7), 0, 1);
        c.strokeStyle = rgba(C.vio, 0.22 * a); c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, waves[i], 0, TAU); c.stroke();
        c.strokeStyle = rgba('214,196,255', 0.75 * a); c.lineWidth = 2; c.stroke();
      }
      // shell: charged outer surface 105, vibrated by microwave emitters 400
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fillStyle = '#081747'; c.fill();
      c.fillStyle = rgba(C.blu, 0.1); c.fill();
      c.beginPath();
      for (i = 0; i <= 180; i++) { var a2 = i / 180 * TAU, rr = R + 1.4 * Math.sin(a2 * 60 - t * 40); var px = cx + Math.cos(a2) * rr, py = cy + Math.sin(a2) * rr; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.strokeStyle = 'rgba(235,250,255,0.95)'; c.lineWidth = 1.7; c.stroke();
      for (i = 0; i < 10; i++) {
        var ea = i / 10 * TAU + 0.3, ex = cx + Math.cos(ea) * R * 0.9, ey = cy + Math.sin(ea) * R * 0.9;
        c.save(); c.translate(ex, ey); c.rotate(ea); c.fillStyle = rgba(C.amb, 0.95); c.fillRect(-3, -4, 6, 8); c.restore();
        var ww = (t * 50 + i * 9) % 22;
        c.strokeStyle = rgba(C.amb, (1 - ww / 22) * 0.7); c.lineWidth = 1; c.beginPath(); c.arc(ex, ey, 4 + ww, ea - 0.9, ea + 0.9); c.stroke();
      }
      for (i = 0; i < 12; i++) { var qa = i / 12 * TAU; text(c, '+', cx + Math.cos(qa) * (R + 10), cy + Math.sin(qa) * (R + 10), mono(9), rgba(C.alp, 0.8), 'center'); }
      // two incongruent wedge-shaped acoustic cavities, counter-spinning on parallel offset axes
      var cav = [[cx - R * 0.36, cy - R * 0.08, 1, 0], [cx + R * 0.38, cy + R * 0.1, -1, 1]];
      cav.forEach(function (cv) {
        var rot = t * 1.5 * cv[2], sc = R * 0.42;
        wedge(c, cv[0], cv[1], rot, sc, cv[3]);
        c.fillStyle = rgba(C.teal, 0.14); c.fill(); c.strokeStyle = rgba(C.teal, 0.95); c.lineWidth = 1.5; c.stroke();
        c.save(); wedge(c, cv[0], cv[1], rot, sc, cv[3]); c.clip();
        for (var k = 0; k < 4; k++) {   // sound from a generator 200 inside each cavity
          var sr = ((t * 40 + k * 14) % 56);
          c.strokeStyle = rgba(C.teal, (1 - sr / 56) * 0.8); c.lineWidth = 1.2;
          c.beginPath(); c.arc(cv[0] + Math.cos(rot) * sc * 0.1, cv[1] + Math.sin(rot) * sc * 0.1, sr, 0, TAU); c.stroke();
        }
        c.restore();
        c.fillStyle = rgba(C.teal, 1); c.beginPath(); c.arc(cv[0], cv[1], 2.5, 0, TAU); c.fill();
        text(c, cv[2] > 0 ? '⟳' : '⟲', cv[0], cv[1] - sc * 1.05, mono(14), rgba(C.teal, 0.95), 'center');
      });
      // power 500 and motor 800 between the cavities, on support 600
      c.strokeStyle = rgba(C.ink, 0.5); c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx - R * 0.36, cy - R * 0.08); c.lineTo(cx + R * 0.38, cy + R * 0.1); c.stroke();
      c.fillStyle = 'rgba(8,22,70,0.95)'; c.fillRect(cx - R * 0.09, cy - R * 0.05, R * 0.18, R * 0.16);
      c.strokeStyle = rgba(C.grn, 0.9); c.strokeRect(cx - R * 0.09, cy - R * 0.05, R * 0.18, R * 0.16);
      text(c, '500·800', cx, cy + R * 0.03, mono(s.small ? 6 : 7), rgba(C.grn, 0.95), 'center');
      if (s.small) { text(c, 'gravitational waves (claimed)', s.W / 2, s.H - 30, hand(12), rgba(C.vio, 0.9), 'center'); return; }
      var lx = cx + R * 1.45, Rr = s.W - 24;
      if (Rr - lx > 240) {
        callout(c, s, cx + R * 0.7, cy - R * 0.7, lx, cy - R * 0.95, 'GAS-FILLED SHELL 100 · CERMET', 'outer surface charged and vibrated', '235,250,255');
        callout(c, s, cx + R * 0.86, cy - R * 0.25, lx, cy - R * 0.45, 'MICROWAVE EMITTERS 400', '', C.amb);
        callout(c, s, cx + R * 0.55, cy + R * 0.15, lx, cy + R * 0.1, 'ACOUSTIC RESONANT CAVITIES 300', 'wedge-shaped · counter-spinning', C.teal);
        callout(c, s, cx + R * 0.05, cy + R * 0.11, lx, cy + R * 0.62, 'POWER 500 · MOTOR 800', 'between the cavities', C.grn);
        text(c, 'gravitational waves', Math.min(s.W - 130, cx + R * 1.5), cy + R * 1.18, hand(15), rgba(C.vio, 0.95), 'center');
        text(c, '(claimed)', Math.min(s.W - 130, cx + R * 1.5), cy + R * 1.18 + 17, hand(12.5), rgba(C.vio, 0.7), 'center');
      }
    }
  };

  /* ════════════ the record ════════════ */
  var GP = 'https://patents.google.com/patent/';
  var PATENTS = [
    { key: 'craft', viz: CRAFT, gp: 'US10144532B2', no: 'US 10,144,532 B2', title: 'Craft using an inertial mass reduction device',
      status: 'lapsed', statusText: 'Granted · expired (fee)', dates: [['Filed', '28 Apr 2016'], ['Published', '2 Nov 2017'], ['Granted', '4 Dec 2018']],
      plain: 'A hybrid aerospace–underwater craft whose hull is a resonant cavity: an inner wall and an electrically charged outer wall, with microwave emitters in the gap and a noble gas (xenon) filling it. The emitters drive the outer wall to vibrate in an “accelerated mode”, which the patent says polarizes the vacuum just outside the hull and so reduces the craft’s inertial mass, letting it move through air, water and space alike. A rotating cone sits on the leading edge; vibrating different sections of the shroud steers it.',
      claim: 'create a local polarized vacuum outside the outer resonant cavity wall',
      nums: [['Emitters', '300 MHz – 300 GHz'], ['Cavity Q', '10⁴ – 10⁹'], ['Wall', 'Al · Cu · YBCO · Nb'], ['Gas', 'xenon']],
      note: 'The examiner rejected the application as unbuildable. In December 2017 the Navy’s chief technology officer for naval aviation wrote to the patent office in support of it; it was allowed in October 2018 and granted that December.' },
    { key: 'heem', viz: HEEM, gp: 'US10135366B2', no: 'US 10,135,366 B2', title: 'Electromagnetic field generator and method to generate an electromagnetic field',
      status: 'lapsed', statusText: 'Granted · expired (fee)', dates: [['Filed', '24 Jul 2015'], ['Published', '26 Jan 2017'], ['Granted', '20 Nov 2018']],
      plain: 'A shell of polarized piezoelectric ceramic (PZT) in an aluminum matrix — a sphere for space, a hemisphere for sea, a disc for land — charged from inside by two Pelletron generators, spun on bearings by a motor through a cross-shaped strut frame, and set vibrating by its piezoelectric modules. A helium-cooled pebble-bed reactor and a thermoelectric generator inside supply the power. The patent says the charged, accelerated surface throws an intense electromagnetic field outward: the “Pais Effect” the other filings build on.',
      claim: 'the entire electromagnetic energy flux density is directed outward of the shell',
      nums: [['Reactor', '1 – 10 MW'], ['Inside', '~20 bar SF₆'], ['Field', '10²⁴ W/m² (claimed)'], ['Shells', 'sphere · hemi · disc']],
      note: 'This is the one the Navy tested. From October 2016 to September 2019 its HEEMFG project (about $508,000, most of it salaries) spun charged test articles; across 31 charged-spindle runs the effect was not observed, and the estimated charge reached was 2.9×10⁻⁸ C against the 1 C the theory calls for. The Navy’s summary: it “could not be proven”.' },
    { key: 'rtsc', viz: RTSC, gp: 'US20190058105A1', no: 'US 2019/0058105 A1', title: 'Piezoelectricity-induced room temperature superconductor',
      status: 'abandoned', statusText: 'Application · abandoned', dates: [['Filed', '16 Aug 2017'], ['Published', '21 Feb 2019'], ['Abandoned', 'Nov 2019']],
      plain: 'A wire with an insulating core (Teflon) and a micron-thin coating of PZT, aluminum or barium strontium titanate — about as thick as the London penetration depth. Strike or shake the wire abruptly while pulsing current through it, the filing says, and it superconducts at room temperature. A helical coil wound around the wire is pulsed at a different frequency. The same wiring reappears inside the gravitational-wave generator.',
      claim: 'the current must be pulsed for maximum effect',
      nums: [['Coating', '≈ London depth (µm)'], ['PZT films', '> 100 MHz'], ['“Room temp”', '≥ 25 °C'], ['Follow-up', 'US 2019/0348597 A1']],
      note: 'The examiner issued a final rejection in April 2019 and the application was abandoned that November. A continuation for a “high temperature” version was also abandoned.' },
    { key: 'fusion', viz: FUSION, gp: 'US20190295733A1', no: 'US 2019/0295733 A1', title: 'Plasma compression fusion device',
      status: 'abandoned', statusText: 'Application · abandoned', dates: [['Filed', '22 Mar 2018'], ['Published', '26 Sep 2019'], ['Abandoned', 'Jul 2021']],
      plain: 'A cross-shaped duct around a vacuum chamber, with two pairs of opposed, counter-spinning cones (“dynamic fusors”) aimed at its center. Fuel gas, deuterium preferred, runs down their hollow shafts and out of orifices in the cones. Their charged, accelerating spin is claimed to produce concentrated magnetic flux and electromagnetic radiation that compress the gas into a plasma core, heat it and hold it between the cones, for fusion with net energy gain. In the craft story, this is the power plant.',
      claim: 'the concentrated magnetic energy flux compresses a mixture of gases',
      nums: [['Vacuum', '~10⁻⁵ Torr'], ['Lawson', 'nTτ ≥ 3×10²¹ keV·s/m³'], ['Fields', '> 30 T (claimed)'], ['Fuels', 'D-D · D-T · p-¹¹B']],
      note: 'Never granted: the application was abandoned in July 2021 after office actions went unanswered.' },
    { key: 'hfgw', viz: HFGW, gp: 'US10322827B2', no: 'US 10,322,827 B2', title: 'High frequency gravitational wave generator',
      status: 'lapsed', statusText: 'Granted · expired (fee)', dates: [['Filed', '14 Feb 2017'], ['Published', '16 Aug 2018'], ['Granted', '18 Jun 2019']],
      plain: 'A gas-filled cermet shell whose charged outer surface is vibrated by microwave emitters, with two wedge-shaped acoustic resonant cavities inside, spun against each other on parallel offset axes and driven by sound generators. The shell makes one electromagnetic field, the cavities a second; where the second propagates through the first, the patent says, high-frequency gravitational waves are generated. Its wiring is the room-temperature superconductor.',
      claim: 'propagating gravitational field fluctuations are generated',
      nums: [['Pulsing', '300 MHz – 300 GHz'], ['Flux', '10³³ W/m² (claimed)'], ['HFGW power', '10¹⁰ W (claimed)'], ['Cavity gas', 'He · Ne · Ar · Xe']],
      note: 'Granted in June 2019; it lapsed in 2023 when the maintenance fee went unpaid, like the other two granted patents.' }
  ];
  var TIMELINE = [
    ['2015-07', 'Field generator filed', 'f'], ['2016-04', 'Craft filed', 'f'], ['2016-10', 'Navy test program starts', 'n'],
    ['2017-02', 'Gravitational wave generator filed', 'f'], ['2017-08', 'Superconductor filed', 'f'], ['2017-12', 'Navy CTO letter backs the craft', 'n'],
    ['2018-03', 'Fusion device filed', 'f'], ['2018-11', 'Field generator granted', 'g'], ['2018-12', 'Craft granted', 'g'],
    ['2019-06', 'Gravitational wave generator granted', 'g'], ['2019-09', 'Testing ends: “could not be proven”', 'n'], ['2019-11', 'Superconductor abandoned', 'a'],
    ['2021-07', 'Fusion device abandoned', 'a'], ['2022–23', 'Granted patents lapse (fees unpaid)', 'a']
  ];
  // posts in this archive where @TMBSPACESHIPS answers someone talking about Pais
  var TMB_POSTS = ['1904936983530791239', '1873414378474934610', '1869044276686115298', '1905589226952933762', '1864136372056895836', '1912618190691029106', '1938602701190725972'];

  /* ════════════ shared with pais.js (the Pais Patents page) ════════════ */
  window.PaisViz = {
    C: C, reduce: reduce, still: still, TAU: TAU,
    rgba: rgba, clamp: clamp, text: text, mono: mono, hand: hand, esc: esc, paper: paper,
    list: PATENTS, timeline: TIMELINE, tmbPosts: TMB_POSTS
  };
})();
