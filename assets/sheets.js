/* Blueprint sheets — animated, plotted redraws of hand drawings from the archive.
 *
 * One canvas, one engine (sheet paper, titles, plot-in wipe, lifecycle) and a set of
 * sheets. Every sheet keeps the wording written on its original drawing.
 *
 *   pump    Ion Pumpy Thing — closed cycle plasma amplifier        (shot 0566)
 *   craft   Brown-Cahill Method — antigravity spacecraft            (shot 0712)
 *   bubble  Bouyancy System teaching model — the vacuum bubble      (shot 0403)
 *   mod     Low Frequency Plasma Modulator for open air combustion  (shot 1474)
 *
 * The exhibit switcher at the bottom of this file cycles these with the fusion drive
 * drawn by reactor.js. Needs window.TMBFX (helpers exported by reactor.js).
 */
(function () {
  'use strict';
  var FX = window.TMBFX;
  var canvas = document.getElementById('blueprint');
  var stageEl = document.getElementById('stage');
  if (!FX || !canvas || !stageEl || !canvas.getContext) return;
  var reduce = FX.reduce, live = FX.live, rand = FX.rand, clamp = FX.clamp, smooth = FX.smooth, bell = FX.bell, rgba = FX.rgba;
  var host = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  var TAU = Math.PI * 2;
  var C = { ink: '190,225,255', amb: '255,176,87', teal: '94,240,192', red: '255,107,138', blu: '107,182,255',
            grn: '125,255,176', pnk: '255,143,208', vio: '165,139,255', ion: '89,243,255', alp: '255,95,174', yel: '255,236,150' };
  var HAND = '"Architects Daughter", "Bradley Hand", "Segoe Print", cursive';
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  var PAPER = 'rgb(11,28,84)';

  var W = 0, H = 0, dpr = 1, S = null, stat = null, snap = null;
  var sheet = null, sheetName = '', firstShow = true;
  var active = false, running = false, inView = true, raf = 0, last = 0, t = 0, age = 0, burst = 0;
  var counts = {};

  /* ── drawing helpers ───────────────────────────────────── */
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  }
  function poly(c, pts) {
    c.beginPath();
    for (var i = 0; i < pts.length; i++) { if (i) c.lineTo(pts[i][0], pts[i][1]); else c.moveTo(pts[i][0], pts[i][1]); }
  }
  function text(c, str, x, y, font, color, align) {
    c.font = font; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'middle';
    c.fillText(str, x, y);
  }
  function mono(px) { return '500 ' + px + 'px ' + MONO; }
  function hand(px) { return px + 'px ' + HAND; }
  // word-wrap at the current font; returns the number of lines drawn
  function wrap(c, str, x, y, maxW, lh, maxLines) {
    var words = str.split(' '), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y + n * lh); n++; line = words[i];
        if (n >= maxLines) return n;
      } else line = test;
    }
    if (line && n < maxLines) { c.fillText(line, x, y + n * lh); n++; }
    return n;
  }
  function note(c, str, x, y, maxW, px, color, maxLines, align) {
    c.font = hand(px); c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'middle';
    return wrap(c, str, x, y, maxW, px * 1.38, maxLines || 9);
  }
  function leader(c, x1, y1, x2, y2, rgb) {
    c.strokeStyle = rgba(rgb, 0.7); c.lineWidth = 1;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.fillStyle = rgba(rgb, 0.95); c.beginPath(); c.arc(x1, y1, 1.8, 0, TAU); c.fill();
  }
  // a label with a paper-coloured backing, for text that sits on top of a line
  function tag(c, str, x, y, font, color, align) {
    c.font = font;
    var w = c.measureText(str).width + 8, x0 = align === 'right' ? x - w + 4 : align === 'center' ? x - w / 2 : x - 4;
    c.fillStyle = PAPER; c.fillRect(x0, y - 6, w, 12);
    text(c, str, x, y, font, color, align);
  }
  // a labelled box; text shrinks to fit and is dropped if it would be unreadable
  function block(c, x, y, w, h, lines, rgb, px, short) {
    c.fillStyle = 'rgba(8,22,70,0.66)'; rr(c, x, y, w, h, Math.min(6, h / 3)); c.fill();
    c.strokeStyle = rgba(rgb || C.ink, 0.92); c.lineWidth = 1.2; c.stroke();
    if (!lines || !lines.length) return;
    var p0 = px || 8.5;
    function fit(ls) {
      var maxW = 0;
      c.font = mono(p0);
      ls.forEach(function (l) { maxW = Math.max(maxW, c.measureText(l).width); });
      return p0 * Math.min(1, (w - 8) / maxW, (h - 4) / (ls.length * p0 * 1.28));
    }
    var p = fit(lines);
    if (p < 6.3 && short) { lines = [short]; p = fit(lines); }
    if (p < 5.2) return;
    var lh = p * 1.3, y0 = y + h / 2 - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { text(c, l, x + w / 2, y0 + i * lh, mono(p), rgba(C.ink, 0.96), 'center'); });
  }
  function pillPath(c, x0, x1, yc, r) {
    c.beginPath();
    c.moveTo(x0 + r, yc - r); c.lineTo(x1 - r, yc - r);
    c.arc(x1 - r, yc, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x0 + r, yc + r);
    c.arc(x0 + r, yc, r, Math.PI / 2, Math.PI * 1.5);
    c.closePath();
  }
  // point and outward normal at fraction u (0..1) around a pill, clockwise from the top-left
  function pillPt(x0, x1, yc, r, u) {
    var Ls = Math.max(0, x1 - x0 - 2 * r), arc = Math.PI * r, P = 2 * Ls + 2 * arc;
    var d = (((u % 1) + 1) % 1) * P, a;
    if (d < Ls) return { x: x0 + r + d, y: yc - r, nx: 0, ny: -1 };
    d -= Ls;
    if (d < arc) { a = -Math.PI / 2 + d / r; return { x: x1 - r + Math.cos(a) * r, y: yc + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) }; }
    d -= arc;
    if (d < Ls) return { x: x1 - r - d, y: yc + r, nx: 0, ny: 1 };
    d -= Ls; a = Math.PI / 2 + d / r;
    return { x: x0 + r + Math.cos(a) * r, y: yc + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  function bump(name) {
    counts[name] = (counts[name] || 0) + 1;
    var el = document.getElementById('count-' + name);
    if (el) el.textContent = String(counts[name] % 10000).padStart(4, '0');
  }

  /* ── sheet paper: everything hangs off the stage band ─────── */
  function base() {
    var hr = host.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
    var top = sr.top - hr.top, h = Math.max(150, sr.height);
    var small = W < 760, pad = small ? 10 : clamp(W * 0.03, 16, 48);
    // keep the sheet clear of the title above and the readout row below
    return { small: small, wide: W >= 1180, sx: pad, sy: top + (small ? 4 : 14), sw: W - pad * 2, sh: h - (small ? 8 : 22) };
  }
  function chrome(c, s, def) {
    var ink = function (a) { return rgba(C.ink, a); }, i, k = 0, gx, gy;
    var sg = c.createLinearGradient(0, s.sy, 0, s.sy + s.sh);
    sg.addColorStop(0, 'rgba(18,48,128,0.50)'); sg.addColorStop(1, 'rgba(10,26,84,0.44)');
    c.fillStyle = sg; rr(c, s.sx, s.sy, s.sw, s.sh, 8); c.fill();
    c.save(); rr(c, s.sx, s.sy, s.sw, s.sh, 8); c.clip();
    c.lineWidth = 1;
    for (gx = s.sx + 0.5; gx < s.sx + s.sw; gx += 14, k++) {
      c.strokeStyle = ink(k % 5 ? 0.045 : 0.1);
      c.beginPath(); c.moveTo(gx, s.sy); c.lineTo(gx, s.sy + s.sh); c.stroke();
    }
    for (k = 0, gy = s.sy + 0.5; gy < s.sy + s.sh; gy += 14, k++) {
      c.strokeStyle = ink(k % 5 ? 0.045 : 0.1);
      c.beginPath(); c.moveTo(s.sx, gy); c.lineTo(s.sx + s.sw, gy); c.stroke();
    }
    c.restore();
    c.strokeStyle = ink(0.5); rr(c, s.sx + 0.5, s.sy + 0.5, s.sw - 1, s.sh - 1, 8); c.stroke();
    c.strokeStyle = ink(0.18); rr(c, s.sx + 5.5, s.sy + 5.5, s.sw - 11, s.sh - 11, 5); c.stroke();
    if (!s.small) {   // drawing-sheet zone ticks
      for (i = 1, gx = s.sx + 70; gx < s.sx + s.sw - 40; gx += 70, i++) {
        c.strokeStyle = ink(0.4);
        c.beginPath(); c.moveTo(gx, s.sy + s.sh - 5); c.lineTo(gx, s.sy + s.sh); c.stroke();
        text(c, String(i), gx + 35, s.sy + s.sh - 10, mono(7), ink(0.35), 'center');
      }
    }
    // titles: mono heading top-left, handwritten name top-right, drawing number bottom-right
    var hpx = s.small ? 15 : 24;
    c.font = hand(hpx);
    var handW = c.measureText(def.hand).width;
    if ('letterSpacing' in c) c.letterSpacing = '1.4px';
    if (s.small) {
      text(c, def.titleShort, s.sx + s.sw - 12, s.sy + s.sh - 11, mono(7), ink(0.75), 'right');
    } else {
      c.font = mono(10);
      var room = s.sw - handW - 64;
      var ttl = c.measureText(def.title).width <= room ? def.title : c.measureText(def.titleMid).width <= room ? def.titleMid : def.titleShort;
      text(c, ttl, s.sx + 16, s.sy + 18, mono(10), ink(0.92));
    }
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    text(c, def.hand, s.sx + s.sw - 16, s.sy + (s.small ? 15 : 24), hand(hpx), 'rgba(255,255,255,0.96)', 'right');
    if (!s.small) text(c, def.stamp, s.sx + s.sw - 16, s.sy + s.sh - 17, mono(8), ink(0.5), 'right');
  }

  var SHEETS = {};

  /* ═════════ 01 · ION PUMPY THING (closed cycle plasma amplifier) ═════════
   *  - HV HF ionizer (20 kV @ 300 kHz) drives two ring electrodes; arcs jump between
   *    them through a spindle of Hastelloy screens ("Make massive Arcs")
   *  - the screens feed the output box over a red and a blue bus
   *  - a servo piston commands adiabatic pressure: it barely moves until ignition,
   *    then makes long slow strokes; the arcs peak on each compression
   *  - magnetron port, ion seed-gas inlet and a water jacket around the cylinder
   */
  SHEETS.pump = (function () {
    var PS = null, arcs = [], arcClock = 0, prevDx = 0, flowDir = 1;
    function makeArcs(pw) {
      var s = PS, out = [], i;
      var nMain = pw > 0.7 ? 1 + (Math.random() < 0.6 ? 1 : 0) + (burst > 0.2 ? 1 : 0) : (Math.random() < pw * 1.3 ? 1 : 0);
      for (var m = 0; m < nMain; m++) {
        var xa = s.xA + s.er, xb = s.xB - s.er, ya = s.yc + rand(-0.4, 0.4) * s.er, yb = s.yc + rand(-0.4, 0.4) * s.er;
        var n = 20, pts = [], amp = s.Ri * 0.62 * pw;
        for (i = 0; i <= n; i++) {
          var u = i / n;
          pts.push([xa + (xb - xa) * u + (i && i < n ? rand(-3, 3) : 0), ya + (yb - ya) * u + Math.sin(Math.PI * u) * amp * rand(-1, 1)]);
        }
        out.push({ pts: pts, w: 2.1, a: 1 });
        if (pw > 0.75 && Math.random() < 0.7) {   // a branch that grounds on the wall
          var b0 = pts[3 + ((Math.random() * (n - 6)) | 0)], dir = Math.random() < 0.5 ? -1 : 1, br = [b0];
          for (i = 1; i <= 4; i++) br.push([b0[0] + i * rand(4, 9), b0[1] + dir * i * s.Ri * 0.22 + rand(-3, 3)]);
          out.push({ pts: br, w: 1.2, a: 0.8 });
        }
      }
      var mini = Math.round(pw * 5);
      for (i = 0; i < mini; i++) {
        var j = (Math.random() * (s.screens.length - 1)) | 0, p = s.screens[j], q = s.screens[j + 1];
        var y = s.yc + rand(-0.85, 0.85) * Math.min(p.h, q.h);
        out.push({ pts: [[p.x + 2, y], [(p.x + q.x) / 2, y + rand(-5, 5)], [q.x - 2, y + rand(-3, 3)]], w: 1, a: 0.75 });
      }
      arcs = out;
      if (nMain > 1) bump('pump');
    }
    return {
      title: 'CLOSED CYCLE PLASMA AMPLIFIER  ·  DYNAMIC PLASMA ALTERNATOR',
      titleMid: 'CLOSED CYCLE PLASMA AMPLIFIER',
      titleShort: 'CLOSED CYCLE PLASMA AMPLIFIER',
      hand: 'Ion Pumpy Thing', stamp: 'DWG TMB-0566 · REV A',
      layout: function (b) {
      var small = b.small, sx = b.sx, sy = b.sy, sw = b.sw, sh = b.sh;
      var L = sw * (small ? 0.9 : 0.86), x1 = sx + sw * (small ? 0.05 : 0.04);
      var Ro = Math.min(sh * 0.19, 84), Ri = Ro * 0.7, er = Ri * 0.74;
      var yc = sy + sh * (small ? 0.6 : 0.61);
      var gap = Math.max(10, L * 0.03);
      var boxY = sy + (small ? 26 : 40);
      var boxH = clamp(yc - Ro - boxY - (small ? 16 : 26), 22, 76);
      var xA = x1 + Ro * 0.95;
      var scr0 = xA + er + gap, scr1 = scr0 + L * (small ? 0.2 : 0.24);
      var xB = scr1 + gap + er;
      var pis0 = xB + er + 4, pisW = L * 0.1, stroke = L * 0.02;
      var ionX = xA - Math.min(L * 0.04, 44), ionW = small ? L * 0.22 : Math.min(L * 0.19, 230);
      var colX = ionX + ionW + (small ? 6 : Math.min(L * 0.02, 24)), colW = small ? L * 0.17 : Math.min(L * 0.16, 200);
      var S = { small: small, wide: b.wide, sx: sx, sy: sy, sw: sw, sh: sh, L: L, x1: x1, Ro: Ro, Ri: Ri, er: er, yc: yc,
            boxY: boxY, boxH: boxH, xj: x1 + L * 0.86, xEnd: x1 + L * 0.985,
            xA: xA, xB: xB, scr0: scr0, scr1: scr1, pis0: pis0, pisW: pisW, stroke: stroke,
            flow1: x1 + L * 0.93, servo0: Math.max(x1 + L * 0.69, pis0 + pisW + stroke + 12),
            mag: scr1 + gap * 0.5, inlet: scr0 - gap * 0.5, pw: small ? 4 : 6,
            yT: yc - Ri * 0.26, yB: yc + Ri * 0.26,
            ion: { x: ionX, w: ionW }, col: { x: colX, w: colW }, screens: [] };
      var n = small ? 9 : L > 900 ? 18 : 14;
      for (var i = 0; i < n; i++) {
        S.screens.push({ x: scr0 + (scr1 - scr0) * (i + 0.5) / n, h: Ri * 0.92 * (0.42 + 0.58 * Math.sin(Math.PI * (i + 0.5) / n)) });
      }
      var s = S, by = boxY + boxH;
      s.wires = {
        hv1: [[xA, by], [xA, yc - er]],
        hv2: [[ionX + ionW - 10, boxY], [ionX + ionW - 10, boxY - 9], [xB, boxY - 9], [xB, yc - er]],
        blue: [[colX + 10, by], [colX + 10, by + 8], [s.inlet, by + 8], [s.inlet, s.yB], [scr1 + 2, s.yB]],
        red: [[colX + colW - 10, by], [colX + colW - 10, by + 8], [s.mag, by + 8], [s.mag, s.yT], [scr0 - 2, s.yT]]
      };
      PS = S;
      return S;
      },
      statics: function (c, s) {
        var i, ink = function (a) { return rgba(C.ink, a); };
      // handwritten notes, upper right
      if (!s.small) {
        var nx = s.pis0 + 14, ny = s.sy + 58, nw = s.sx + s.sw - 18 - nx;
        var lines = Math.floor((s.yc - s.Ro - 14 - ny) / 21) + 1;
        if (nw > 200 && lines > 0) {
          c.font = '15.5px ' + HAND; c.fillStyle = ink(0.88); c.textAlign = 'left'; c.textBaseline = 'middle';
          // the full note needs three lines; with less room keep just its first sentence
          var note = 'Piston has full command of adiabatic pressure.';
          var fits = c.measureText(note).width <= Math.min(nw, 560);
          if (lines >= 3 || !fits) note += ' Pump action is almost no movement till ignition temperature is reached, then long slow 10–30 Hz oscillations take place.';
          if (lines >= 3 || fits) wrap(c, note, nx, ny, Math.min(nw, 560), 21, lines);
        }
      }

      // cylinder: double wall (water jacket) with a rounded closed end
      var cxl = s.x1 + s.Ro;
      c.beginPath();
      c.moveTo(s.xj, s.yc - s.Ro); c.lineTo(cxl, s.yc - s.Ro);
      c.arc(cxl, s.yc, s.Ro, -Math.PI / 2, Math.PI / 2, true);
      c.lineTo(s.xj, s.yc + s.Ro); c.lineTo(s.xj, s.yc + s.Ri); c.lineTo(cxl, s.yc + s.Ri);
      c.arc(cxl, s.yc, s.Ri, Math.PI / 2, -Math.PI / 2, false);
      c.lineTo(s.xj, s.yc - s.Ri); c.closePath();
      c.fillStyle = rgba(C.vio, 0.14); c.fill();
      c.strokeStyle = ink(0.9); c.lineWidth = 1.5; c.stroke();
      // ports through the lower wall (seed-gas inlet, magnetron)
      [s.inlet, s.mag].forEach(function (px) {
        c.fillStyle = 'rgb(13,32,92)';
        c.fillRect(px - s.pw, s.yc + s.Ri - 1, s.pw * 2, s.Ro - s.Ri + 2);
        c.strokeStyle = ink(0.9); c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(px - s.pw, s.yc + s.Ri); c.lineTo(px - s.pw, s.yc + s.Ro);
        c.moveTo(px + s.pw, s.yc + s.Ri); c.lineTo(px + s.pw, s.yc + s.Ro);
        c.stroke();
      });
      // right-hand housing
      c.strokeStyle = ink(0.55); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(s.xj, s.yc - s.Ri); c.lineTo(s.xEnd - 7, s.yc - s.Ri);
      c.quadraticCurveTo(s.xEnd, s.yc - s.Ri, s.xEnd, s.yc - s.Ri + 7);
      c.lineTo(s.xEnd, s.yc + s.Ri - 7);
      c.quadraticCurveTo(s.xEnd, s.yc + s.Ri, s.xEnd - 7, s.yc + s.Ri);
      c.lineTo(s.xj, s.yc + s.Ri);
      c.stroke();

      // ring electrodes
      [s.xA, s.xB].forEach(function (ex, j) {
        c.strokeStyle = rgba(C.amb, 0.95); c.lineWidth = 2;
        c.beginPath(); c.arc(ex, s.yc, s.er, 0, TAU); c.stroke();
        c.strokeStyle = rgba(C.amb, 0.4); c.lineWidth = 1;
        c.beginPath(); c.arc(ex, s.yc, s.er - 3.5, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(ex, s.yc); c.lineTo(ex + Math.cos(-0.7 - j) * s.er * 0.8, s.yc + Math.sin(-0.7 - j) * s.er * 0.8); c.stroke();
        c.fillStyle = rgba(C.amb, 0.9); c.beginPath(); c.arc(ex, s.yc, 1.8, 0, TAU); c.fill();
      });

      // Hastelloy screens + output buses
      s.screens.forEach(function (q, j) {
        c.strokeStyle = rgba(j % 2 ? C.red : C.teal, 0.9); c.lineWidth = 1.2;
        rr(c, q.x - 2, s.yc - q.h, 4, q.h * 2, 2); c.stroke();
      });
      [['red', C.red], ['blue', C.blu], ['hv1', C.amb], ['hv2', C.amb]].forEach(function (wv) {
        c.strokeStyle = rgba(wv[1], 0.8); c.lineWidth = 1.4; c.lineJoin = 'round';
        poly(c, s.wires[wv[0]]); c.stroke();
      });
      s.screens.forEach(function (q, j) {
        c.fillStyle = rgba(j % 2 ? C.blu : C.red, 0.95);
        c.beginPath(); c.arc(q.x, j % 2 ? s.yB : s.yT, 2, 0, TAU); c.fill();
      });

      // ionizer + output boxes
      [[s.ion, 0], [s.col, 1]].forEach(function (bx) {
        var b = bx[0];
        c.fillStyle = 'rgba(8,22,70,0.6)'; rr(c, b.x, s.boxY, b.w, s.boxH, 7); c.fill();
        c.strokeStyle = ink(0.85); c.lineWidth = 1.2; c.stroke();
        var mx = b.x + b.w / 2, y0 = s.boxY;
        if (bx[1] === 0) {
          if (s.small) {
            text(c, 'IONIZER', mx, y0 + s.boxH * 0.34, '500 7px ' + MONO, ink(0.95), 'center');
            text(c, '20KV 300KHZ', mx, y0 + s.boxH * 0.7, '500 6.5px ' + MONO, rgba(C.amb, 0.95), 'center');
          } else if (s.boxH >= 46) {
            var big = s.boxH >= 66;
            text(c, 'Min Field IONIZER', mx, y0 + (big ? 17 : 13), (big ? 16 : 13) + 'px ' + HAND, ink(0.95), 'center');
            text(c, 'HV HF AC', mx, y0 + s.boxH * 0.55, '500 ' + (big ? 10 : 9) + 'px ' + MONO, ink(0.8), 'center');
            text(c, '20KV @ 300KHZ', mx, y0 + s.boxH - (big ? 14 : 11), '500 ' + (big ? 10.5 : 9) + 'px ' + MONO, rgba(C.amb, 0.95), 'center');
          } else {
            text(c, 'IONIZER · HV HF AC', mx, y0 + s.boxH * 0.33, '500 8.5px ' + MONO, ink(0.95), 'center');
            text(c, '20KV @ 300KHZ', mx, y0 + s.boxH * 0.7, '500 8.5px ' + MONO, rgba(C.amb, 0.95), 'center');
          }
        } else {
          if (s.small) {
            text(c, 'OUTPUT', mx, y0 + s.boxH * 0.5, '500 7px ' + MONO, ink(0.95), 'center');
          } else {
            var big2 = s.boxH >= 66;
            text(c, 'OUTPUT', mx, y0 + (s.boxH >= 46 ? (big2 ? 15 : 12) : s.boxH * 0.33), '500 ' + (big2 ? 10 : 9) + 'px ' + MONO, ink(0.95), 'center');
            text(c, 'Colmunator', mx, y0 + (s.boxH >= 46 ? (big2 ? 34 : 26) : s.boxH * 0.7), (big2 ? 16 : 13) + 'px ' + HAND, ink(0.9), 'center');
            if (s.boxH >= 46) {   // inductor, terminals, capacitor
              var sy2 = y0 + s.boxH - (s.boxH >= 66 ? 15 : 10), x = b.x + 14;
              c.strokeStyle = ink(0.75); c.lineWidth = 1;
              c.beginPath(); c.moveTo(x, sy2); c.lineTo(x + 8, sy2);
              for (var q = 0; q < 3; q++) c.arc(x + 11 + q * 6, sy2, 3, Math.PI, 0, false);
              c.lineTo(x + 34, sy2); c.stroke();
              c.beginPath(); c.arc(x + 37, sy2, 2.4, 0, TAU); c.stroke();
              var cx2 = b.x + b.w - 14;
              c.beginPath(); c.arc(cx2 - 37, sy2, 2.4, 0, TAU); c.stroke();
              c.beginPath(); c.moveTo(cx2 - 34, sy2); c.lineTo(cx2 - 20, sy2);
              c.moveTo(cx2 - 20, sy2 - 5); c.lineTo(cx2 - 20, sy2 + 5);
              c.moveTo(cx2 - 15, sy2 - 5); c.lineTo(cx2 - 15, sy2 + 5);
              c.moveTo(cx2 - 15, sy2); c.lineTo(cx2, sy2); c.stroke();
            }
          }
        }
      });

      // linear servo: rows of drive elements above and below the flow channel
      c.strokeStyle = ink(0.45); c.lineWidth = 1;
      c.strokeRect(s.servo0, s.yc - s.Ri * 0.94, s.flow1 - s.servo0, s.Ri * 0.52);
      c.strokeRect(s.servo0, s.yc + s.Ri * 0.52, (s.flow1 - s.servo0) * 0.6, s.Ri * 0.36);
      c.strokeStyle = ink(0.6);
      var sp = s.small ? 6 : 7, rad = s.small ? 1.6 : 2.1;
      for (var x2 = s.servo0 + 5, j2 = 0; x2 < s.flow1 - 3; x2 += sp, j2++) {
        c.beginPath(); c.arc(x2, s.yc - s.Ri * 0.8, rad, 0, TAU); c.stroke();
        c.beginPath(); c.arc(x2 + sp / 2, s.yc - s.Ri * 0.56, rad, 0, TAU); c.stroke();
        if (x2 < s.servo0 + (s.flow1 - s.servo0) * 0.6 - 4) { c.beginPath(); c.arc(x2, s.yc + s.Ri * 0.7, rad, 0, TAU); c.stroke(); }
      }

      // magnetron: horn through the wall into a small box
      var my0 = s.yc + s.Ro + 5, room = s.sy + s.sh - my0;
      var mh = clamp(room - (s.small ? 16 : 26), 8, 22), mw = s.small ? 7 : 11;
      c.strokeStyle = ink(0.85); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(s.mag - s.pw, s.yc + s.Ro); c.lineTo(s.mag - mw, my0); c.moveTo(s.mag + s.pw, s.yc + s.Ro); c.lineTo(s.mag + mw, my0); c.stroke();
      c.strokeRect(s.mag - mw, my0, mw * 2, mh);
      c.beginPath();
      for (i = 0; i <= 12; i++) { var wx = s.mag - mw + 3 + (mw * 2 - 6) * i / 12, wy = my0 + mh / 2 + Math.sin(i / 12 * TAU * 1.5) * Math.min(3, mh / 4); if (i) c.lineTo(wx, wy); else c.moveTo(wx, wy); }
      c.stroke();
      if (!s.small) {
        text(c, 'MAGNATRON', s.mag + mw + 8, my0 + 5, '500 9px ' + MONO, ink(0.95));
        text(c, '1GHz or >', s.mag + mw + 8, my0 + 18, '12px ' + HAND, ink(0.8));
        text(c, '50 watt', s.mag + mw + 8, my0 + 31, '12px ' + HAND, ink(0.8));
      } else {
        text(c, 'MAGNATRON', s.mag, my0 + mh + 8, '500 6.5px ' + MONO, ink(0.8), 'center');
      }

      // ion seed-gas inlet: pipe, filament heater box, vent
      var iy0 = s.yc + s.Ro, ib = iy0 + (s.small ? 6 : 10), ih = clamp(room - (s.small ? 20 : 46), 8, 18), iw = s.small ? 9 : 13;
      c.strokeStyle = ink(0.85); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(s.inlet - s.pw, iy0); c.lineTo(s.inlet - s.pw, ib); c.moveTo(s.inlet + s.pw, iy0); c.lineTo(s.inlet + s.pw, ib); c.stroke();
      c.strokeRect(s.inlet - iw, ib, iw * 2, ih);
      c.beginPath();
      for (i = 0; i < 4; i++) c.arc(s.inlet - iw + 5 + i * ((iw * 2 - 10) / 3), ib + ih / 2, Math.min(3, ih / 4), 0, TAU);
      c.stroke();
      c.strokeRect(s.inlet - 4, ib + ih, 8, 5);
      s.feedY = ib;
      if (!s.small) {
        text(c, 'FILAMENT HEATER', s.inlet - iw - 8, ib + ih / 2, '500 8.5px ' + MONO, ink(0.9), 'right');
        text(c, 'SELINOID VENT', s.inlet, ib + ih + (s.wide ? 27 : 15), '500 8px ' + MONO, ink(0.7), 'center');
        if (s.wide) {
          if (room > 76) text(c, 'wire feed · metal ions', s.inlet - iw - 8, ib + ih / 2 + 15, '12px ' + HAND, ink(0.75), 'right');
          var gxl = s.inlet + iw + 12;
          c.strokeStyle = ink(0.7); rr(c, gxl, ib - 1, 88, 17, 8.5); c.stroke();
          c.beginPath(); c.moveTo(s.inlet + iw, ib + 7.5); c.lineTo(gxl, ib + 7.5); c.stroke();
          text(c, 'ION SEED GAS', gxl + 44, ib + 8, '500 8.5px ' + MONO, ink(0.95), 'center');
          text(c, 'contains Mercury and SF6', gxl + 2, ib + 27, '12px ' + HAND, ink(0.75));
        }
      }

      // leader labels
      if (!s.small) {
        var grn = rgba(C.grn, 0.95), ly = s.yc + s.Ro + 20;
        function leader(x1, y1, x2, y2) { c.strokeStyle = rgba(C.grn, 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.fillStyle = grn; c.beginPath(); c.arc(x1, y1, 1.8, 0, TAU); c.fill(); }
        var hx = (s.wide ? s.inlet + iw + 118 : s.inlet + iw + 26), hsx = s.screens[Math.floor(s.screens.length * 0.6)].x;
        if (s.mag - 16 - hx > 96) {
          leader(hsx + 4, s.yc + s.Ri * 0.5, hx + 30, ly - 7);
          text(c, 'HASTELLOY SCREENS', hx, ly, '500 9px ' + MONO, grn);
        }
        var wx2 = s.pis0 + s.pisW * 0.5;
        leader(wx2, s.yc + (s.Ro + s.Ri) / 2, wx2 + 22, ly - 7);
        text(c, 'WATER JACKET', wx2 + 26, ly, '500 9px ' + MONO, grn);
        var vx = s.servo0 + 8;
        leader(vx + 26, s.yc + s.Ri * 0.7, vx + 12, ly - 7);
        text(c, 'LINEAR SERVO PISTON', vx, ly, '500 10px ' + MONO, grn);
        if (room > 48) text(c, '3000 watt drive motor · HIGH SPEED', vx, ly + 16, '12.5px ' + HAND, rgba(C.grn, 0.85));
        if (room > 62) text(c, '1500°F piston rating · CHROMEMOLLY CYLINDER', vx, ly + 31, '12.5px ' + HAND, rgba(C.grn, 0.85));
      }
      },
      dynamics: function (ctx, s, dt, dyn) {
        var i;
      // piston cycle: barely moving while it charges, then long slow strokes after ignition
      var T = 10, u = t % T, dx, pw, flash = 0;
      if (u < 3.6) {
        dx = Math.sin(t * 38) * 0.8;
        pw = 0.16 + 0.42 * (u / 3.6);
      } else {
        var v = u - 3.6, osc = Math.sin(v * TAU * 0.8);
        dx = -s.stroke * osc * Math.exp(-v * 0.1);
        pw = 0.72 + 0.28 * Math.max(0, osc);
        flash = bell((u - 3.68) / 0.13);
      }
      if (burst > 0) pw = Math.max(pw, 0.6 + 0.4 * burst);
      if (reduce) { dx = 0; pw = 0.9; }
      pw *= dyn;
      if (Math.abs(dx - prevDx) > 0.02) flowDir = dx > prevDx ? 1 : -1;
      prevDx = dx;


      // water circulating in the jacket
      var rm = (s.Ro + s.Ri) / 2, cxl = s.x1 + s.Ro;
      ctx.strokeStyle = rgba(C.vio, 0.8 * dyn); ctx.lineWidth = 2;
      ctx.setLineDash([5, 11]); ctx.lineDashOffset = -t * 26;
      ctx.beginPath();
      ctx.moveTo(s.xj, s.yc - rm); ctx.lineTo(cxl, s.yc - rm);
      ctx.arc(cxl, s.yc, rm, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(s.inlet - s.pw - 2, s.yc + rm);
      ctx.moveTo(s.inlet + s.pw + 2, s.yc + rm); ctx.lineTo(s.mag - s.pw - 2, s.yc + rm);
      ctx.moveTo(s.mag + s.pw + 2, s.yc + rm); ctx.lineTo(s.xj, s.yc + rm);
      ctx.stroke();
      ctx.setLineDash([]);

      // flow channel behind the piston
      var px = s.pis0 + dx, fx0 = px + s.pisW, fh = s.Ri * 0.3, span = s.flow1 - fx0;
      ctx.fillStyle = rgba(C.pnk, 0.16); ctx.strokeStyle = rgba(C.pnk, 0.6); ctx.lineWidth = 1;
      ctx.fillRect(fx0, s.yc - fh, span, fh * 2); ctx.strokeRect(fx0, s.yc - fh, span, fh * 2);
      ctx.strokeStyle = rgba('255,214,238', 0.85 * dyn); ctx.lineWidth = 1.2;
      var step = 44, off = (t * 34 * flowDir) % step;
      ctx.beginPath();
      for (var ax = fx0 + 12 + ((off + step) % step); ax < s.flow1 - 8; ax += step) {
        for (var lane = -1; lane <= 1; lane += 2) {
          var ay = s.yc + lane * fh * 0.55;
          ctx.moveTo(ax - 3 * flowDir, ay - 3); ctx.lineTo(ax, ay); ctx.lineTo(ax - 3 * flowDir, ay + 3);
        }
      }
      ctx.stroke();
      if (!s.small && span > 260) {
        text(ctx, 'EQUILIBRIUM AIR FLOW', fx0 + 14, s.yc, '500 8px ' + MONO, 'rgba(255,224,242,0.9)');
        text(ctx, 'AIRFLOW', (s.servo0 + s.flow1) / 2, s.yc, '500 8px ' + MONO, 'rgba(255,224,242,0.9)', 'center');
      }

      // piston
      var ph = s.Ri * 0.9, e = s.er * 0.55, r = Math.sqrt(e * e + ph * ph), a0 = Math.atan2(ph, e);
      ctx.beginPath();
      ctx.moveTo(px, s.yc - ph); ctx.lineTo(px + s.pisW, s.yc - ph); ctx.lineTo(px + s.pisW, s.yc + ph); ctx.lineTo(px, s.yc + ph);
      ctx.arc(px - e, s.yc, r, a0, -a0, true);
      ctx.closePath();
      ctx.fillStyle = rgba(C.grn, 0.12); ctx.fill();
      ctx.strokeStyle = rgba(C.grn, 0.95); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.lineWidth = 1;
      for (i = 0; i < 3; i++) {
        var nx = px + s.pisW * (0.42 + 0.19 * i);
        ctx.strokeRect(nx, s.yc - ph - 3, s.small ? 3 : 6, 3); ctx.strokeRect(nx, s.yc + ph, s.small ? 3 : 6, 3);
      }
      if (!s.small) {
        text(ctx, 'PISTON', px + s.pisW * 0.63, s.yc - ph * 0.56, '500 8px ' + MONO, rgba(C.grn, 0.95), 'center');
        text(ctx, 'slides', px + s.pisW * 0.63, s.yc - ph * 0.2, '12px ' + HAND, rgba(C.grn, 0.9), 'center');
        var ay2 = s.yc + ph * 0.45, a1 = px + s.pisW * 0.4, a2 = px + s.pisW * 0.88;
        ctx.strokeStyle = rgba(C.grn, 0.9); ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a1, ay2); ctx.lineTo(a2, ay2);
        ctx.moveTo(a1 + 5, ay2 - 4); ctx.lineTo(a1, ay2); ctx.lineTo(a1 + 5, ay2 + 4);
        ctx.moveTo(a2 - 5, ay2 - 4); ctx.lineTo(a2, ay2); ctx.lineTo(a2 - 5, ay2 + 4);
        ctx.stroke();
      }

      // ion seed feed rising through the inlet
      for (i = 0; i < 3; i++) {
        var k = (t * 0.42 + i / 3) % 1;
        var fy = s.feedY + (s.yc - s.feedY) * Math.min(1, k / 0.6);
        var fx = s.inlet + Math.sin(k * 30) * 1.4 + Math.max(0, k - 0.6) * (s.scr0 - s.inlet + 20) * 2.5;
        ctx.fillStyle = rgba(C.grn, (1 - smooth(0.78, 1, k)) * dyn);
        ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, TAU); ctx.fill();
      }

      ctx.globalCompositeOperation = 'lighter';

      // HV pulses on the ionizer leads, output current on the buses
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash([14, 74]);
      ctx.lineDashOffset = -t * 260;
      ctx.strokeStyle = rgba('255,236,200', 0.95 * dyn); ctx.lineWidth = 2.2;
      poly(ctx, s.wires.hv1); ctx.stroke();
      poly(ctx, s.wires.hv2); ctx.stroke();
      ctx.setLineDash([6, 38]);
      ctx.lineDashOffset = t * 120;
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(C.red, 0.9 * pw); poly(ctx, s.wires.red); ctx.stroke();
      ctx.strokeStyle = rgba(C.blu, 0.9 * pw); poly(ctx, s.wires.blue); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';

      // electrode glow
      [s.xA, s.xB].forEach(function (ex) {
        var g = ctx.createRadialGradient(ex, s.yc, 0, ex, s.yc, s.er * 2.3);
        g.addColorStop(0, rgba(C.amb, 0.2 + 0.4 * pw)); g.addColorStop(1, 'rgba(255,176,87,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, s.yc, s.er * 2.3, 0, TAU); ctx.fill();
      });

      // screens light up with the discharge
      ctx.lineWidth = 2.6;
      s.screens.forEach(function (q, j) {
        ctx.strokeStyle = rgba(j % 2 ? C.red : C.teal, 0.1 + 0.4 * pw * (0.6 + 0.4 * Math.sin(t * 20 + j)));
        rr(ctx, q.x - 2, s.yc - q.h, 4, q.h * 2, 2); ctx.stroke();
      });

      // magnetron output
      for (i = 0; i < 3; i++) {
        var mr = 5 + ((t * 34 + i * 12) % 36);
        ctx.strokeStyle = rgba(C.blu, (1 - mr / 41) * 0.85 * dyn); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(s.mag, s.yc + s.Ri, mr, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
      }

      // arcs
      arcClock -= dt;
      if (arcClock <= 0 || reduce) { makeArcs(pw); arcClock = rand(0.04, 0.09); }
      for (i = 0; i < arcs.length; i++) {
        var arc = arcs[i];
        poly(ctx, arc.pts);
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = rgba('89,243,255', 0.24 * arc.a * dyn); ctx.lineWidth = arc.w * 3.2; ctx.stroke();
        ctx.strokeStyle = rgba('255,255,255', 0.95 * arc.a * dyn); ctx.lineWidth = arc.w; ctx.stroke();
      }
      if (flash > 0.03) {   // ignition
        var ix = (s.scr0 + s.scr1) / 2;
        var ig = ctx.createRadialGradient(ix, s.yc, 0, ix, s.yc, s.Ri * 3.4);
        ig.addColorStop(0, rgba('255,255,255', flash * 0.55)); ig.addColorStop(0.4, rgba('89,243,255', flash * 0.2)); ig.addColorStop(1, 'rgba(89,243,255,0)');
        ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, s.yc, s.Ri * 3.4, 0, TAU); ctx.fill();
      }
      }
    };
  })();

  /* ═════════ 02 · BROWN-CAHILL METHOD (antigravity spacecraft) ═════════
   *  - a pill fuselage with a heated antenna, a speaker-like modulating diaphragm and
   *    drive coils at each end
   *  - the diaphragms push and pull together, so ion compression waves ride the gap
   *    between fuselage skin and the soliton envelope membrane, end to end
   *  - fast electrons run the membrane; hot electrons spill around each nose
   */
  SHEETS.craft = (function () {
    var lastHalf = 0;
    return {
      title: 'BROWN-CAHILL METHOD FOR THE REDUCTION OF KINETIC PEMITTIVITY OF FREE SPACE',
      titleMid: 'BROWN-CAHILL METHOD  ·  KINETIC PEMITTIVITY OF FREE SPACE',
      titleShort: 'BROWN-CAHILL METHOD',
      hand: 'Antigravity Spacecraft', stamp: 'DWG TMB-0712 · OPEN SOURCE',
      layout: function (b) {
        var s = Object.assign({}, b);
        s.yc = b.sy + b.sh * (b.small ? 0.52 : 0.52);
        s.Rf = Math.min(b.sh * (b.small ? 0.165 : b.wide ? 0.185 : 0.2), 76);
        s.Lf = b.small ? b.sw * 0.6 : Math.min(b.sw * (b.wide ? 0.44 : 0.6), s.Rf * 10.5);
        var cx = b.sx + b.sw * 0.5;
        s.cx = cx; s.fx0 = cx - s.Lf / 2; s.fx1 = cx + s.Lf / 2;
        s.d1 = s.Rf * 0.42; s.d2 = s.Rf * (b.small ? 0.82 : 0.95);
        s.g = s.Rf * 0.16; s.Ri = s.Rf - 6;
        s.ends = [{ x: s.fx0, dir: -1 }, { x: s.fx1, dir: 1 }];
        var gw = b.small ? 4 : 7, bx0 = s.fx0 + s.Rf * 1.28, bx1 = s.fx1 - s.Rf * 1.28, bw = bx1 - bx0 - gw * 2;
        var by0 = s.yc - s.Ri + (b.small ? 6 : 19), by1 = s.yc + s.Ri - (b.small ? 6 : 19);
        var bh = b.small ? by1 - by0 : (by1 - by0 - gw) / 2, c1 = bw * 0.3, c2 = bw * 0.37, c3 = bw * 0.33;
        var x2 = bx0 + c1 + gw, x3 = x2 + c2 + gw, yb = by0 + bh + gw;
        s.blocks = b.small
          ? { res: [bx0, by0, c1, bh], mcu: [x2, by0, c2, bh], hv: [x3, by0, c3, bh] }
          : { gas: [bx0, by0, c1, bh], res: [bx0, yb, c1, bh], mcu: [x2, by0, c2, bh], prop: [x2, yb, c2, bh], hv: [x3, by0, c3, bh], he: [x3, yb, c3, bh] };
        s.ductT = s.yc - s.Ri + 9; s.ductB = s.yc + s.Ri - 9;
        s.dx0 = s.fx0 + s.Rf * 1.0; s.dx1 = s.fx1 - s.Rf * 1.0;
        var ra = s.blocks.res, hv = s.blocks.hv, fl = s.fx0 + s.Rf * 1.13, fr = s.fx1 - s.Rf * 1.13;
        s.feedL = [[ra[0], ra[1] + ra[3] / 2], [fl, ra[1] + ra[3] / 2], [fl, s.yc], [s.fx0 + s.Rf, s.yc]];
        s.feedR = [[hv[0] + hv[2], hv[1] + hv[3] / 2], [fr, hv[1] + hv[3] / 2], [fr, s.yc], [s.fx1 - s.Rf, s.yc]];
        return s;
      },
      statics: function (c, s) {
        var i, ink = function (a) { return rgba(C.ink, a); };
        // outer plasma envelope and the zone between skin and membrane
        c.setLineDash([3, 5]); c.strokeStyle = rgba(C.vio, 0.32); c.lineWidth = 1;
        pillPath(c, s.fx0 - s.d2, s.fx1 + s.d2, s.yc, s.Rf + s.d2); c.stroke(); c.setLineDash([]);
        pillPath(c, s.fx0 - s.d1, s.fx1 + s.d1, s.yc, s.Rf + s.d1); c.fillStyle = rgba(C.vio, 0.08); c.fill();
        // fuselage: double skin
        pillPath(c, s.fx0, s.fx1, s.yc, s.Rf); c.fillStyle = PAPER; c.fill();
        c.strokeStyle = ink(0.92); c.lineWidth = 1.7; c.stroke();
        pillPath(c, s.fx0 + 5, s.fx1 - 5, s.yc, s.Rf - 5); c.strokeStyle = ink(0.32); c.lineWidth = 1; c.stroke();
        s.ends.forEach(function (e) {
          // nose opening with its lips
          c.fillStyle = PAPER; c.fillRect(e.x - 5, s.yc - s.g, 10, s.g * 2);
          c.strokeStyle = ink(0.9); c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(e.x - e.dir * 8, s.yc - s.g); c.lineTo(e.x + e.dir * 3, s.yc - s.g);
          c.moveTo(e.x - e.dir * 8, s.yc + s.g); c.lineTo(e.x + e.dir * 3, s.yc + s.g);
          c.stroke();
          // heated antenna on the axis
          var a0 = e.x + e.dir * 6, a1 = e.x - e.dir * s.Rf, ax = Math.min(a0, a1), aw = Math.abs(a1 - a0), ah = Math.max(3, s.g * 0.55);
          c.fillStyle = rgba(C.amb, 0.18); rr(c, ax, s.yc - ah / 2, aw, ah, ah / 2); c.fill();
          c.strokeStyle = rgba(C.amb, 0.95); c.lineWidth = 1.4; c.stroke();
          for (i = 1; i < 4; i++) { c.beginPath(); c.moveTo(ax + aw * i / 4, s.yc - ah / 2); c.lineTo(ax + aw * i / 4, s.yc + ah / 2); c.stroke(); }
          // diaphragm drive coils, above and below the axis
          var cxl = e.x - e.dir * s.Rf * 0.86, cw = s.small ? 7 : 11, n = s.small ? 3 : 4;
          [-1, 1].forEach(function (sg) {
            var y0 = s.yc + sg * s.Rf * 0.22, y1 = s.yc + sg * s.Rf * 0.74, top = Math.min(y0, y1), hh = Math.abs(y1 - y0);
            c.strokeStyle = ink(0.8); c.lineWidth = 1.1; rr(c, cxl - cw / 2, top, cw, hh, cw / 2); c.stroke();
            for (i = 0; i < n; i++) { c.beginPath(); c.arc(cxl, top + hh * (i + 0.5) / n, cw * 0.27, 0, TAU); c.stroke(); }
          });
        });
        // feeds from the 60 GHz boxes to the antennas
        c.strokeStyle = rgba(C.amb, 0.75); c.lineWidth = 1.3; c.lineJoin = 'round';
        poly(c, s.feedL); c.stroke(); poly(c, s.feedR); c.stroke();
        // interior blocks
        var B = s.blocks;
        if (s.small) {
          block(c, B.res[0], B.res[1], B.res[2], B.res[3], ['60GHz'], C.amb, 7);
          block(c, B.mcu[0], B.mcu[1], B.mcu[2], B.mcu[3], ['MASTER', 'MCU'], C.blu, 7);
          block(c, B.hv[0], B.hv[1], B.hv[2], B.hv[3], ['60GHz'], C.amb, 7);
        } else {
          block(c, B.gas[0], B.gas[1], B.gas[2], B.gas[3], ['GAS MIXTURE MCU'], C.ink);
          block(c, B.res[0], B.res[1], B.res[2], B.res[3], ['HF ELECTRON RESIVOIR', '60GHz · mod 1.3–1.8GHz'], C.amb, 8.5, 'ELECTRON RESIVOIR');
          block(c, B.mcu[0], B.mcu[1], B.mcu[2], B.mcu[3], ['BOYANCY SYSTEM', 'MASTER MCU'], C.blu, 8.5, 'MASTER MCU');
          block(c, B.prop[0], B.prop[1], B.prop[2], B.prop[3], ['PROPULSIVE INPUT', 'RESOLVER'], C.blu, 8.5, 'INPUT RESOLVER');
          block(c, B.hv[0], B.hv[1], B.hv[2], B.hv[3], ['HF HV 60GHz DC+', 'fires in phase'], C.red, 8.5, 'HF HV 60GHz DC+');
          block(c, B.he[0], B.he[1], B.he[2], B.he[3], ['HELIUM LUBRICANT', 'for DIAPHRAGM'], C.vio, 8.5, 'HELIUM LUBRICANT');
          // ion seed gas (top) and helium (bottom) lines, each with a valve
          [[s.ductT, C.grn, 0.64, 'ION SEED GAS', s.Lf > 560 ? 'HEAT SATURATED ION SEED GAS – PROPANE' : 'PROPANE'], [s.ductB, C.vio, 0.56, 'HELIUM', '']].forEach(function (d) {
            c.strokeStyle = rgba(d[1], 0.55); c.lineWidth = 1.1;
            c.beginPath(); c.moveTo(s.dx0, d[0]); c.lineTo(s.dx1, d[0]); c.stroke();
            var vx = s.fx0 + s.Lf * d[2];
            c.fillStyle = PAPER; c.beginPath(); c.arc(vx, d[0], 5, 0, TAU); c.fill();
            c.strokeStyle = rgba(C.red, 0.9); c.stroke();
            c.beginPath(); c.moveTo(vx - 3, d[0] - 3); c.lineTo(vx + 3, d[0] + 3); c.moveTo(vx + 3, d[0] - 3); c.lineTo(vx - 3, d[0] + 3); c.stroke();
            tag(c, d[3], s.dx0 + 14, d[0], mono(6.5), rgba(d[1], 0.95));
            if (d[4]) tag(c, d[4], s.dx1 - 14, d[0], mono(6.5), rgba(d[1], 0.95), 'right');
          });
        }
        if (s.small) return;

        // zone labels in and around the envelope
        var long = s.Lf > 540;
        text(c, long ? 'LAMINAR LONGITUDINAL MAGNETOACOUSTIC ZONE · ION VELOCITY HELD < M1' : 'MAGNETOACOUSTIC ZONE · ION VELOCITY < M1',
             s.cx, s.yc - s.Rf - s.d1 * 0.5, mono(7.5), rgba(C.ion, 0.95), 'center');
        text(c, 'HOT ION LONGITUDAL TRANSIENT ZONE', s.cx, s.yc + s.Rf + s.d1 * 0.5, mono(7.5), rgba(C.ion, 0.95), 'center');
        var zo = (s.d1 + s.d2) / 2;
        text(c, long ? 'BUNCHED ZONE of HEAT SUPER SATURATED ELECTRONS' : 'BUNCHED ZONE of ELECTRONS', s.cx, s.yc - s.Rf - zo, mono(7.5), rgba(C.vio, 0.95), 'center');
        text(c, 'ION-ELECTRON COLLISIONAL MIXING ZONE', s.cx, s.yc + s.Rf + zo, mono(7.5), rgba(C.vio, 0.95), 'center');
        var topY = s.yc - s.Rf - s.d2;
        if (topY - s.sy > 44) {
          var mx = s.cx - s.Lf * 0.22;
          leader(c, mx, s.yc - s.Rf - s.d1, mx - 16, topY - 12, '214,130,255');
          text(c, 'MAGNETIC CONFINEMENT SOLITON ENVELOPE MEMBRANE', mx - 20, topY - 12, mono(8), 'rgba(226,170,255,0.95)', 'right');
        }
        // side callouts
        var leftRoom = s.fx0 - s.d2 - s.Rf * 1.25 - s.sx - 18, rightRoom = s.sx + s.sw - 18 - (s.fx1 + s.d2 + s.Rf * 1.25);
        var lx = s.sx + 18, rx = s.sx + s.sw - 18, botY = s.yc + s.Rf * 0.9;
        if (leftRoom > 150) {
          note(c, 'Plasma consist of 2 velocity domains, the slow ION and fast ELECTRON. The fast electrons bunch in laminar 2 dimensional sheets that self contain the plasma.',
               lx, s.sy + 52, Math.min(leftRoom, 250), 13, ink(0.85), 6);
          leader(c, s.fx0 - 4, s.yc, lx + 60, botY - 12, C.amb);
          text(c, 'INCANDESCENTLY HEATED ANTENNA', lx, botY, mono(8.5), rgba(C.amb, 0.98));
          note(c, 'is thorium zircronium coated to promote hot electron production efficency', lx, botY + 16, Math.min(leftRoom, 240), 12.5, rgba(C.amb, 0.85), 3);
        } else {
          var my = Math.min(s.yc + s.Rf + s.d2 + 14, s.sy + s.sh - 13);
          leader(c, s.fx0 - 4, s.yc, s.fx0 - s.d2 - 8, my - 9, C.amb);
          text(c, 'HEATED ANTENNA', s.fx0 - s.d2 * 0.2, my, mono(8.5), rgba(C.amb, 0.98), 'right');
        }
        if (rightRoom > 150) {
          var rw = Math.min(rightRoom, 250), rl = rx - rw;
          leader(c, s.fx1 - s.Rf * 0.86, s.yc - s.Rf * 0.5, rl - 6, s.sy + 62, C.ink);
          text(c, 'DIAPHRAGM DRIVE COILS', rl, s.sy + 62, mono(8.5), ink(0.98));
          note(c, 'low frequency modulator diaphragm has command over kinetic ion transport force', rl, s.sy + 78, rw, 12.5, ink(0.82), 3);
          leader(c, s.fx1 - s.Rf * 0.58, s.yc + s.Rf * 0.5, rl - 6, botY, C.teal);
          text(c, 'LOW FREQUENCY ION MODULATION DIAPHRAGM', rl, botY, mono(8), rgba(C.teal, 0.98));
          note(c, 'manufacture from 4130. Oscillations are from .1Hz to 70Hz. Works similar to audio speaker.', rl, botY + 16, rw, 12.5, rgba(C.teal, 0.85), 3);
        } else {
          var my2 = Math.min(s.yc + s.Rf + s.d2 + 14, s.sy + s.sh - 13);
          leader(c, s.fx1 - s.Rf * 0.58, s.yc + s.Rf * 0.5, s.fx1 - s.Rf * 0.2, my2 - 9, C.teal);
          text(c, 'DIAPHRAGM · .1Hz to 70Hz', s.fx1 + s.d2 * 0.2, my2, mono(8.5), rgba(C.teal, 0.98), 'right');
        }
        // the poster's closing claim, along the bottom
        var by = s.yc + s.Rf + s.d2;
        if (s.sy + s.sh - by > 44 && leftRoom > 150) {
          note(c, 'The ability to move frictional ELECTRONS across the external surface of the slow ION’s dimensional space is a novel concept not found in textbooks or patents.',
               s.cx, s.sy + s.sh - 36, Math.min(s.sw * 0.5, 620), 12.5, 'rgba(226,170,255,0.9)', 2, 'center');
        }
      },
      dynamics: function (ctx, s, dt, dyn) {
        var i, om = t * 2.1, push = Math.sin(om);
        var half = Math.floor(om / Math.PI);
        if (half !== lastHalf) { lastHalf = half; if (dyn > 0.5) bump('craft'); }

        // gas lines
        if (!s.small) {
          ctx.lineWidth = 1.6; ctx.setLineDash([5, 10]); ctx.lineDashOffset = -t * 30;
          ctx.strokeStyle = rgba(C.grn, 0.8 * dyn); ctx.beginPath(); ctx.moveTo(s.dx1, s.ductT); ctx.lineTo(s.dx0, s.ductT); ctx.stroke();
          ctx.strokeStyle = rgba(C.vio, 0.8 * dyn); ctx.beginPath(); ctx.moveTo(s.dx1, s.ductB); ctx.lineTo(s.dx0, s.ductB); ctx.stroke();
          ctx.setLineDash([]);
        }
        // ion compression waves in the gap: a standing bunching plus a front that rides end to end
        var x0 = s.fx0 + s.Rf, Ls = s.Lf - 2 * s.Rf, n = Math.max(8, Math.floor(Ls / 8));
        var xp = x0 + Ls * (0.5 - 0.5 * Math.cos(om));
        ctx.lineWidth = 1.1;
        for (i = 0; i <= n; i++) {
          var xi = x0 + Ls * i / n, near = bell((xi - xp) / (Ls * 0.07));
          var xx = xi + 5 * Math.sin(Math.PI * 3 * i / n) * Math.cos(om);
          ctx.strokeStyle = rgba(near > 0.3 ? '225,250,255' : C.ion, (0.16 + 0.62 * near) * dyn);
          ctx.beginPath();
          ctx.moveTo(xx, s.yc - s.Rf - 4); ctx.lineTo(xx, s.yc - s.Rf - s.d1 + 4);
          ctx.moveTo(xx, s.yc + s.Rf + 4); ctx.lineTo(xx, s.yc + s.Rf + s.d1 - 4);
          ctx.stroke();
        }
        // soliton envelope membrane, rippling
        var amp = (s.small ? 1.4 : 2.2) + burst * 5, M = s.small ? 120 : 220, p;
        ctx.beginPath();
        for (i = 0; i <= M; i++) {
          p = pillPt(s.fx0 - s.d1, s.fx1 + s.d1, s.yc, s.Rf + s.d1, i / M);
          var w = amp * Math.sin(i / M * TAU * 34 - t * 5);
          if (i) ctx.lineTo(p.x + p.nx * w, p.y + p.ny * w); else ctx.moveTo(p.x + p.nx * w, p.y + p.ny * w);
        }
        ctx.closePath();
        ctx.strokeStyle = rgba('214,130,255', 0.9 * dyn); ctx.lineWidth = 1.4; ctx.stroke();
        // fast electrons running the membrane
        for (i = 0; i < 16; i++) {
          p = pillPt(s.fx0 - s.d1, s.fx1 + s.d1, s.yc, s.Rf + s.d1, t * 0.11 + i / 16);
          ctx.fillStyle = rgba(C.vio, 0.95 * dyn); ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, TAU); ctx.fill();
        }
        // modulating diaphragms: both ends push and pull together
        s.ends.forEach(function (e) {
          var xd = e.x - e.dir * s.Rf * 0.58 + push * (s.small ? 2 : 3.5);
          ctx.strokeStyle = rgba(C.teal, 0.95); ctx.lineWidth = 1.7;
          [-1, 1].forEach(function (sg) {
            ctx.beginPath();
            for (var y = s.g + 2; y <= s.Rf * 0.8; y += 2) {
              var xx2 = xd + 2.2 * Math.sin(y * 0.55), yy = s.yc + sg * y;
              if (y === s.g + 2) ctx.moveTo(xx2, yy); else ctx.lineTo(xx2, yy);
            }
            ctx.stroke();
          });
        });

        ctx.globalCompositeOperation = 'lighter';
        // outer plasma envelope breathing
        var br = 2.5 * Math.sin(t * 1.3) + burst * 6;
        pillPath(ctx, s.fx0 - s.d2 - br, s.fx1 + s.d2 + br, s.yc, s.Rf + s.d2 + br);
        ctx.strokeStyle = rgba(C.alp, 0.17 * dyn); ctx.lineWidth = 3; ctx.stroke();
        // plasma lobes spilling round each nose, with hot electrons riding them
        s.ends.forEach(function (e) {
          // soft plume behind the lobes
          var pg = ctx.createRadialGradient(e.x + e.dir * s.Rf * 0.5, s.yc, 0, e.x + e.dir * s.Rf * 0.5, s.yc, s.Rf * 2.1);
          pg.addColorStop(0, rgba(C.alp, 0.2 * dyn)); pg.addColorStop(0.5, rgba(C.vio, 0.09 * dyn)); pg.addColorStop(1, 'rgba(165,139,255,0)');
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(e.x + e.dir * s.Rf * 0.5, s.yc, s.Rf * 2.1, 0, TAU); ctx.fill();
          for (var k = 1; k <= 6; k++) {
            [-1, 1].forEach(function (sg) {
              var x1 = e.x + e.dir * 3, y1 = s.yc + sg * 2;
              var cxp = e.x + e.dir * s.Rf * (0.7 + 0.24 * k), cyp = s.yc + sg * s.Rf * (0.22 + 0.3 * k);
              var x2 = e.x - e.dir * s.Rf * (0.2 + 0.24 * k), y2 = s.yc + sg * (s.Rf + s.d1 * 0.25 + (k - 1) * (s.d2 - s.d1 * 0.25) / 5);
              ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cxp, cyp, x2, y2);
              ctx.setLineDash([5, 8]); ctx.lineDashOffset = -t * 34 - k * 3;
              ctx.strokeStyle = rgba(k % 3 === 0 ? C.blu : k % 2 ? C.alp : C.vio, (0.72 - k * 0.07) * dyn); ctx.lineWidth = 1.35; ctx.stroke();
              ctx.setLineDash([]);
              var q = (t * 0.45 + k * 0.21 + (sg > 0 ? 0.5 : 0)) % 1, iq = 1 - q;
              ctx.fillStyle = rgba(C.amb, (1 - q) * dyn);
              ctx.beginPath(); ctx.arc(iq * iq * x1 + 2 * iq * q * cxp + q * q * x2, iq * iq * y1 + 2 * iq * q * cyp + q * q * y2, 1.7, 0, TAU); ctx.fill();
            });
          }
          // antenna glow, coils firing with the stroke
          var g = ctx.createRadialGradient(e.x, s.yc, 0, e.x, s.yc, s.Rf * 0.9);
          g.addColorStop(0, rgba(C.amb, (0.34 + 0.18 * Math.sin(t * 7)) * dyn)); g.addColorStop(1, 'rgba(255,176,87,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, s.yc, s.Rf * 0.9, 0, TAU); ctx.fill();
          var cxl = e.x - e.dir * s.Rf * 0.86, cw = s.small ? 7 : 11;
          [-1, 1].forEach(function (sg) {
            var y0 = s.yc + sg * s.Rf * 0.22, y1 = s.yc + sg * s.Rf * 0.74;
            ctx.strokeStyle = rgba(C.amb, 0.7 * Math.abs(push) * dyn); ctx.lineWidth = 2;
            rr(ctx, cxl - cw / 2, Math.min(y0, y1), cw, Math.abs(y1 - y0), cw / 2); ctx.stroke();
          });
        });
        // 60 GHz pulses down the antenna feeds
        ctx.setLineDash([10, 50]); ctx.lineDashOffset = -t * 210; ctx.lineCap = 'round';
        ctx.strokeStyle = rgba('255,236,200', 0.95 * dyn); ctx.lineWidth = 2;
        poly(ctx, s.feedL); ctx.stroke(); poly(ctx, s.feedR); ctx.stroke();
        ctx.setLineDash([]); ctx.lineCap = 'butt';
      }
    };
  })();

  /* ═════════ 03 · VACUUM BUBBLE (bouyancy system teaching model) ═════════
   *  - an avionic block diagram inside a rigid body with a heated antenna at each end
   *  - a double-pulsed HV LF AC oscillatory wave pushes the air away; the bubble
   *    boundary breathes with each pulse and the air outside is shoved back
   *  - on wide screens a small schematic plots pressure across the bubble
   */
  SHEETS.bubble = (function () {
    var air = [], lastP = -1;
    function env(tt) {   // the double pulse, 0..1
      var p = (tt % 1.6) / 1.6;
      return Math.min(1, bell((p - 0.1) / 0.06) + 0.8 * bell((p - 0.3) / 0.06));
    }
    return {
      title: 'BOUYANCY SYSTEM  ·  TEACHING MODEL  ·  UNMANNED',
      titleMid: 'BOUYANCY SYSTEM  ·  TEACHING MODEL',
      titleShort: 'BOUYANCY SYSTEM TEACHING MODEL',
      hand: 'Vacuum Bubble', stamp: 'DWG TMB-0403 · CRAYOLA AIDED DRAWING',
      layout: function (b) {
        var s = Object.assign({}, b), i;
        s.yc = b.sy + b.sh * (b.small ? 0.5 : 0.53);
        s.Rf = Math.min(b.sh * (b.small ? 0.175 : b.wide ? 0.19 : 0.215), 80);
        s.Lf = b.small ? b.sw * 0.6 : Math.min(b.sw * (b.wide ? 0.4 : 0.5), s.Rf * 7.4);
        s.cx = b.sx + b.sw * (b.wide ? 0.4 : 0.5);
        s.fx0 = s.cx - s.Lf / 2; s.fx1 = s.cx + s.Lf / 2;
        s.db = s.Rf * (b.small ? 0.72 : 0.84);
        var ix = s.fx1 + s.db + s.Rf * 0.9, iw = b.sx + b.sw - 26 - ix;
        s.inset = b.wide && iw > 190 ? { x: ix, y: s.yc - s.Rf * 1.1, w: Math.min(iw, 330), h: s.Rf * 2.0 } : null;
        // avionic blocks, as fractions of the interior
        var ix0 = s.fx0 + s.Rf * 0.34, iw2 = s.Lf - s.Rf * 0.68, Ri = s.Rf - 8, yc = s.yc;
        function R(a, bb, y0, y1) { return [ix0 + iw2 * a, yc + Ri * y0, iw2 * (bb - a), Ri * (y1 - y0)]; }
        s.bk = { antL: R(0, 0.155, -0.22, 0.22), att: R(0.18, 0.37, -0.82, -0.14), mcu: R(0.42, 0.56, -0.74, -0.14), prop: R(0.6, 0.845, -0.82, -0.26),
                 antR: R(0.845, 1, -0.22, 0.22), ac: R(0.19, 0.31, 0.2, 0.8), bouy: R(0.36, 0.62, 0.16, 0.82), dc: R(0.66, 0.76, 0.2, 0.8), bat: R(0.79, 0.955, 0.32, 0.76) };
        function P(a, y) { return [ix0 + iw2 * a, yc + Ri * y]; }
        s.wires = [
          { rgb: C.red, pts: [P(0.155, 0.04), P(0.4, 0.04), P(0.4, 0.16)] },
          { rgb: C.red, pts: [P(0.845, 0.04), P(0.58, 0.04), P(0.58, 0.16)] },
          { rgb: C.ink, pts: [P(0.31, 0.5), P(0.36, 0.5)] },
          { rgb: C.ink, pts: [P(0.79, 0.54), P(0.76, 0.54)] },
          { rgb: C.ink, pts: [P(0.66, 0.5), P(0.62, 0.5)] },
          { rgb: C.ink, pts: [P(0.49, -0.14), P(0.49, 0.16)] },
          { rgb: C.blu, pts: [P(0.42, -0.46), P(0.37, -0.46)] },
          { rgb: C.grn, pts: [P(0.56, -0.5), P(0.6, -0.5)] }
        ];
        air = [];
        for (i = 0; i < (b.small ? 34 : 70); i++) air.push({ u: Math.random(), r: rand(4, 50) });
        return s;
      },
      statics: function (c, s) {
        var ink = function (a) { return rgba(C.ink, a); }, K = s.bk;
        // the bubble: rarefied zone between skin and boundary
        pillPath(c, s.fx0 - s.db, s.fx1 + s.db, s.yc, s.Rf + s.db); c.fillStyle = rgba(C.vio, 0.09); c.fill();
        c.strokeStyle = ink(0.4); c.lineWidth = 1; c.stroke();
        // rigid body with its three colour-coded bays
        pillPath(c, s.fx0, s.fx1, s.yc, s.Rf); c.fillStyle = PAPER; c.fill();
        c.save(); pillPath(c, s.fx0, s.fx1, s.yc, s.Rf); c.clip();
        c.fillStyle = rgba(C.blu, 0.2); c.fillRect(s.fx0, s.yc - s.Rf, s.Lf * 0.53, s.Rf);
        c.fillStyle = rgba(C.grn, 0.15); c.fillRect(s.fx0 + s.Lf * 0.53, s.yc - s.Rf, s.Lf * 0.47, s.Rf);
        c.fillStyle = rgba(C.alp, 0.17); c.fillRect(s.fx0, s.yc, s.Lf, s.Rf);
        c.restore();
        pillPath(c, s.fx0, s.fx1, s.yc, s.Rf); c.strokeStyle = ink(0.92); c.lineWidth = 1.7; c.stroke();
        // heated antenna tips
        [[s.fx0, -1], [s.fx1, 1]].forEach(function (e) {
          c.strokeStyle = rgba(C.amb, 0.95); c.lineWidth = 2.2;
          c.beginPath(); c.moveTo(e[0] - e[1] * 6, s.yc); c.lineTo(e[0] + e[1] * (s.small ? 6 : 10), s.yc); c.stroke();
        });
        // wiring
        s.wires.forEach(function (w) { c.strokeStyle = rgba(w.rgb, 0.8); c.lineWidth = 1.3; c.lineJoin = 'round'; poly(c, w.pts); c.stroke(); });
        var px = s.small ? 7 : 9;
        block(c, K.antL[0], K.antL[1], K.antL[2], K.antL[3], ['HEATED', 'ANTENNA'], C.amb, px, 'ANTENNA');
        block(c, K.antR[0], K.antR[1], K.antR[2], K.antR[3], ['HEATED', 'ANTENNA'], C.amb, px, 'ANTENNA');
        block(c, K.att[0], K.att[1], K.att[2], K.att[3], ['Attitude', 'COMMAND', 'CONTROL'], C.blu, px, 'ATTITUDE');
        block(c, K.mcu[0], K.mcu[1], K.mcu[2], K.mcu[3], ['MAIN', 'MCU'], C.ink, px, 'MCU');
        block(c, K.prop[0], K.prop[1], K.prop[2], K.prop[3], ['PROPULSIVE', 'SYSTEM'], C.grn, px, 'PROPULSIVE');
        block(c, K.ac[0], K.ac[1], K.ac[2], K.ac[3], ['ESS', 'AC', 'BUSS'], C.ink, px, 'AC BUSS');
        block(c, K.bouy[0], K.bouy[1], K.bouy[2], K.bouy[3], ['BOUYANCY', 'SYSTEM'], C.alp, px + 1);
        block(c, K.dc[0], K.dc[1], K.dc[2], K.dc[3], ['ESS', 'DC', 'BUSS'], C.ink, px, 'DC BUSS');
        block(c, K.bat[0], K.bat[1], K.bat[2], K.bat[3], ['BATTERY'], C.ink, px);
        if (s.small) return;
        text(c, 'RIGID BODY', s.fx0 + s.Rf * 0.62, s.yc + s.Rf - 9, mono(7), ink(0.8));
        // labels
        var topY = s.yc - s.Rf - s.db, botY = s.yc + s.Rf + s.db;
        var sideRoom = s.fx0 - s.db - s.sx - 30;
        if (topY - s.sy > 46) text(c, 'air pushed away by HV LF AC oscillatory wave', s.cx, topY - 15, hand(15), ink(0.9), 'center');
        else if (sideRoom > 130) note(c, 'air pushed away by HV LF AC oscillatory wave', s.sx + 18, s.yc - 22, Math.min(sideRoom, 190), 14.5, ink(0.9), 4);
        var vbx = s.fx0 + s.Lf * 0.12, vby = s.yc + s.Rf + s.db * 0.5;
        c.fillStyle = PAPER; rr(c, vbx, vby - 9, 112, 18, 9); c.fill();
        c.setLineDash([3, 3]); c.strokeStyle = rgba(C.vio, 0.9); c.lineWidth = 1; c.stroke(); c.setLineDash([]);
        text(c, 'VACUUM BUBBLE', vbx + 56, vby, mono(9), 'rgba(214,196,255,0.98)', 'center');
        if (s.sy + s.sh - botY > 30) text(c, 'Bouyancy System Teaching Model · unmanned', s.cx, botY + 16, hand(14), ink(0.8), 'center');
        else if (!s.inset && s.sx + s.sw - (s.fx1 + s.db) - 30 > 130) {
          note(c, 'Bouyancy System Teaching Model · unmanned', s.fx1 + s.db + 22, s.yc - 14, Math.min(s.sx + s.sw - (s.fx1 + s.db) - 40, 190), 14, ink(0.8), 4);
        }
        // pressure schematic
        var n = s.inset;
        if (n) {
          c.strokeStyle = ink(0.4); c.lineWidth = 1; rr(c, n.x, n.y, n.w, n.h, 6); c.stroke();
          text(c, 'PRESSURE ACROSS THE BUBBLE', n.x + 10, n.y + 13, mono(8), ink(0.95));
          text(c, 'schematic', n.x + n.w - 10, n.y + 13, hand(11.5), ink(0.6), 'right');
          var by = n.y + n.h * 0.46;
          c.setLineDash([4, 4]); c.strokeStyle = ink(0.45);
          c.beginPath(); c.moveTo(n.x + 10, by); c.lineTo(n.x + n.w - 10, by); c.stroke(); c.setLineDash([]);
          text(c, 'ambient', n.x + n.w - 12, by - 8, mono(7), ink(0.7), 'right');
          var ex = n.x + 10 + (n.w - 20) * 0.6;
          c.strokeStyle = ink(0.3); c.beginPath(); c.moveTo(ex, n.y + 24); c.lineTo(ex, n.y + n.h - 16); c.stroke();
          text(c, 'skin', n.x + 12, n.y + n.h - 9, mono(7), ink(0.7));
          text(c, 'bubble edge', ex, n.y + n.h - 9, mono(7), ink(0.7), 'center');
          text(c, 'air', n.x + n.w - 12, n.y + n.h - 9, mono(7), ink(0.7), 'right');
        }
      },
      dynamics: function (ctx, s, dt, dyn) {
        var i, p, e = Math.min(1, env(t) + burst), per = Math.floor(t / 1.6);
        if (per !== lastP) { lastP = per; if (dyn > 0.5) bump('bubble'); }
        if (reduce) e = 0.7;
        var ox = s.db + 3 * e;   // boundary breathes outward on each pulse

        // electron sheath hugging the skin
        ctx.setLineDash([1.5, 6]); ctx.lineDashOffset = -t * 12; ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(C.red, (0.5 + 0.5 * e) * dyn); ctx.lineWidth = 2;
        pillPath(ctx, s.fx0 - 5, s.fx1 + 5, s.yc, s.Rf + 5); ctx.stroke();
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        // arrows: the oscillatory wave pushing outward from the skin
        var M = s.small ? 30 : 84, span = s.db - 14;
        ctx.lineWidth = 1.3;
        for (i = 0; i < M; i++) {
          var fr = (t * 0.55 + (i * 0.618) % 1) % 1;   // golden-ratio stagger so neighbours are out of step
          p = pillPt(s.fx0, s.fx1, s.yc, s.Rf, (i + 0.5) / M);
          var r0 = 7 + span * fr, len = s.small ? 6 : 9, a = Math.sin(Math.PI * fr) * (0.3 + 0.7 * e) * dyn;
          var x1 = p.x + p.nx * r0, y1 = p.y + p.ny * r0, x2 = p.x + p.nx * (r0 + len), y2 = p.y + p.ny * (r0 + len);
          ctx.strokeStyle = rgba('200,170,255', a);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
          ctx.moveTo(x2 - p.nx * 4 - p.ny * 3, y2 - p.ny * 4 + p.nx * 3); ctx.lineTo(x2, y2); ctx.lineTo(x2 - p.nx * 4 + p.ny * 3, y2 - p.ny * 4 - p.nx * 3);
          ctx.stroke();
        }
        // air outside: drifts in, gets shoved back at every pulse
        for (i = 0; i < air.length; i++) {
          var q = air[i];
          q.r += (-7 + 95 * e * Math.exp(-q.r / 13)) * dt;
          if (q.r < 2) q.r = 2;
          if (q.r > 58) { q.r = rand(26, 52); q.u = Math.random(); }
          p = pillPt(s.fx0 - ox, s.fx1 + ox, s.yc, s.Rf + ox, q.u);
          ctx.fillStyle = rgba(C.ink, 0.65 * (1 - q.r / 60) * dyn);
          ctx.beginPath(); ctx.arc(p.x + p.nx * q.r, p.y + p.ny * q.r, 1.3, 0, TAU); ctx.fill();
        }

        ctx.globalCompositeOperation = 'lighter';
        // bubble boundary
        pillPath(ctx, s.fx0 - ox, s.fx1 + ox, s.yc, s.Rf + ox);
        ctx.strokeStyle = rgba(C.vio, 0.22 * e * dyn); ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = rgba('255,255,255', (0.4 + 0.5 * e) * dyn); ctx.lineWidth = 1.4; ctx.stroke();
        // antenna tips glow
        [s.fx0, s.fx1].forEach(function (x) {
          var g = ctx.createRadialGradient(x, s.yc, 0, x, s.yc, s.Rf * 0.75);
          g.addColorStop(0, rgba(C.amb, (0.3 + 0.4 * e) * dyn)); g.addColorStop(1, 'rgba(255,176,87,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, s.yc, s.Rf * 0.75, 0, TAU); ctx.fill();
        });
        // bus traffic
        ctx.setLineDash([6, 30]); ctx.lineDashOffset = -t * 70; ctx.lineCap = 'round'; ctx.lineWidth = 2;
        s.wires.forEach(function (w) { ctx.strokeStyle = rgba(w.rgb === C.ink ? '255,255,255' : w.rgb, 0.85 * dyn); poly(ctx, w.pts); ctx.stroke(); });
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        ctx.globalCompositeOperation = 'source-over';

        // pressure across the bubble
        var n = s.inset;
        if (n) {
          var x0 = n.x + 10, wv = n.w - 20, by = n.y + n.h * 0.46, ampY = n.h * 0.3, re = 0.6, k, pts = [];
          for (k = 0; k <= 60; k++) {
            var r = k / 60;
            var P = -(0.72 + 0.16 * e) * (1 - smooth(re - 0.17, re, r)) + (0.14 + 0.62 * e) * bell((r - re - 0.045) / 0.05);
            pts.push([x0 + wv * r, by - P * ampY]);
          }
          ctx.beginPath(); ctx.moveTo(x0, by);
          for (k = 0; k <= 36; k++) ctx.lineTo(pts[k][0], pts[k][1]);
          ctx.lineTo(pts[36][0], by); ctx.closePath();
          ctx.fillStyle = rgba(C.vio, 0.26 * dyn); ctx.fill();
          poly(ctx, pts); ctx.strokeStyle = rgba(C.ion, 0.95 * dyn); ctx.lineWidth = 1.6; ctx.stroke();
          text(ctx, '−ΔP', x0 + wv * 0.24, by + ampY * 0.42, mono(10), rgba('230,220,255', 0.95 * dyn), 'center');
          text(ctx, 'pressure front', x0 + wv * (re + 0.07), by - ampY * (0.3 + 0.62 * e) - 9, mono(7), rgba(C.ion, (0.4 + 0.6 * e) * dyn), 'center');
        }
      }
    };
  })();

  /* ═════════ 04 · LOW FREQUENCY PLASMA MODULATOR (open air combustion) ═════════
   *  - cold gas is drawn through the hole in a stamped steel diaphragm, past a
   *    thorium coated heated antenna fed with 60 GHz
   *  - the diaphragm strokes below 70 Hz; each stroke sends a compression front out
   *    through the electron rich, ion-electron and ion rich zones
   */
  SHEETS.mod = (function () {
    var parts = [], lastS = -1;
    function flame(c, s, L, Hh) {
      var g = s.gap, x = s.xd, y = s.yc;
      c.beginPath();
      c.moveTo(x, y - g);
      c.bezierCurveTo(x - L * 0.22, y - Hh * 1.3, x - L * 0.72, y - Hh * 0.8, x - L, y);
      c.bezierCurveTo(x - L * 0.72, y + Hh * 0.8, x - L * 0.22, y + Hh * 1.3, x, y + g);
      c.closePath();
    }
    function spawnGas(s) { return { st: 0, x: rand(s.xd + 30, s.sx + s.sw - 10), y: rand(s.sy + 12, s.sy + s.sh - 12), sg: Math.random() < 0.5 ? -1 : 1, lane: rand(0.1, 0.95), prog: 0 }; }
    return {
      title: 'LOW FREQUENCY PLASMA MODULATOR FOR OPEN AIR COMBUSTION',
      titleMid: 'LOW FREQUENCY PLASMA MODULATOR',
      titleShort: 'LF PLASMA MODULATOR',
      hand: 'Plasma Modulator', stamp: 'DWG TMB-1474 · OPEN SOURCE',
      layout: function (b) {
        var s = Object.assign({}, b), i;
        s.yc = b.sy + b.sh * 0.5;
        s.xd = b.sx + b.sw * (b.small ? 0.5 : 0.47);
        s.gap = clamp(b.sh * 0.075, 9, 24);
        s.Lfl = (s.xd - b.sx) * 0.9; s.Hfl = b.sh * 0.33;
        s.La = Math.min(s.Lfl * 0.36, 210); s.ha = s.gap * 0.6;
        var off = b.small ? 7 : 14;
        s.cx0 = s.xd + (b.small ? 15 : 34); s.cw = b.small ? b.sw * 0.13 : clamp(b.sw * 0.1, 70, 130);
        s.ch = clamp(b.sh * 0.21, 26, 70);
        s.cyT = s.yc - s.gap - off - s.ch; s.cyB = s.yc + s.gap + off;
        s.px0 = s.cx0 + s.cw; s.px1 = b.sx + b.sw - (b.small ? 12 : 20);
        parts = [];
        for (i = 0; i < (b.small ? 36 : 80); i++) {
          var p = spawnGas(s);
          if (i % 2) { p.st = 1; p.prog = Math.random(); }
          parts.push(p);
        }
        return s;
      },
      statics: function (c, s) {
        var i, j, ink = function (a) { return rgba(C.ink, a); };
        // left: open air (electron-ion mix). right: cold gas feed zone, hatched
        c.save(); rr(c, s.sx + 6, s.sy + 6, s.sw - 12, s.sh - 12, 5); c.clip();
        c.fillStyle = rgba(C.grn, 0.05); c.fillRect(s.sx, s.sy, s.xd - s.sx, s.sh);
        c.beginPath(); c.rect(s.xd, s.sy, s.sx + s.sw - s.xd, s.sh); c.clip();
        c.strokeStyle = rgba(C.grn, 0.09); c.lineWidth = 1;
        for (i = -s.sh; i < s.sw; i += 13) {
          c.beginPath(); c.moveTo(s.xd + i, s.sy); c.lineTo(s.xd + i + s.sh, s.sy + s.sh); c.stroke();
        }
        c.restore();
        // plasma zones, outermost first
        [[1.04, 1.0, C.vio, 0.13], [0.8, 0.58, C.amb, 0.16], [0.56, 0.3, C.yel, 0.18]].forEach(function (z, k) {
          flame(c, s, s.Lfl * z[0], s.Hfl * z[1]);
          c.fillStyle = rgba(z[2], z[3]); c.fill();
          c.strokeStyle = rgba(z[2], 0.6); c.lineWidth = 1; if (!k) c.setLineDash([4, 4]);
          c.stroke(); c.setLineDash([]);
        });
        // heated antenna
        var ax = s.xd - 12 - s.La;
        c.fillStyle = rgba(C.alp, 0.14); rr(c, ax, s.yc - s.ha, s.La, s.ha * 2, s.ha); c.fill();
        c.strokeStyle = rgba(C.alp, 0.95); c.lineWidth = 1.6; c.stroke();
        c.fillStyle = rgba(C.alp, 0.8);
        for (i = 0; i < Math.floor(s.La / 9); i++) {
          c.beginPath(); c.arc(ax + 8 + i * 9, s.yc - s.ha * 0.55, 1, 0, TAU); c.fill();
          c.beginPath(); c.arc(ax + 8 + i * 9, s.yc + s.ha * 0.55, 1, 0, TAU); c.fill();
        }
        // feed duct on the axis, widening behind the diaphragm
        var fg = s.gap * 0.7;
        c.fillStyle = PAPER;
        c.beginPath(); c.moveTo(s.xd - 12, s.yc - s.ha); c.lineTo(s.xd + 8, s.yc - s.ha); c.lineTo(s.xd + 26, s.yc - fg); c.lineTo(s.px1, s.yc - fg);
        c.lineTo(s.px1, s.yc + fg); c.lineTo(s.xd + 26, s.yc + fg); c.lineTo(s.xd + 8, s.yc + s.ha); c.lineTo(s.xd - 12, s.yc + s.ha); c.closePath(); c.fill();
        c.strokeStyle = ink(0.88); c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(s.xd - 12, s.yc - s.ha); c.lineTo(s.xd + 8, s.yc - s.ha); c.lineTo(s.xd + 26, s.yc - fg); c.lineTo(s.px1, s.yc - fg);
        c.moveTo(s.xd - 12, s.yc + s.ha); c.lineTo(s.xd + 8, s.yc + s.ha); c.lineTo(s.xd + 26, s.yc + fg); c.lineTo(s.px1, s.yc + fg); c.stroke();
        c.strokeStyle = rgba(C.grn, 0.85); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(s.xd + 30, s.yc + fg + 4); c.lineTo(s.px1, s.yc + fg + 4); c.stroke();
        // permanent magnets, coil packs and support pillars above and below
        [s.cyT, s.cyB].forEach(function (cy, k) {
          var mw = s.small ? 6 : 12;
          c.fillStyle = 'rgba(255,255,255,0.06)'; c.strokeStyle = rgba(C.alp, 0.85); c.lineWidth = 1.1;
          rr(c, s.xd + 9, cy + s.ch * 0.14, mw, s.ch * 0.72, 2); c.fill(); c.stroke();
          c.fillStyle = rgba(C.blu, 0.2); rr(c, s.cx0, cy, s.cw, s.ch, 6); c.fill();
          c.strokeStyle = rgba(C.blu, 0.95); c.lineWidth = 1.3; c.stroke();
          c.strokeStyle = ink(0.6); c.lineWidth = 1;
          var rows = Math.max(2, Math.floor((s.ch - 8) / 7)), cols = s.small ? 2 : 3;
          for (i = 0; i < cols; i++) for (j = 0; j < rows; j++) { c.beginPath(); c.arc(s.cx0 + 7 + i * 6.5, cy + 7 + j * ((s.ch - 14) / Math.max(1, rows - 1)), 2, 0, TAU); c.stroke(); }
          var br = Math.min(s.ch * 0.16, s.cw * 0.11);
          [0.56, 0.83].forEach(function (fx) { [0.3, 0.7].forEach(function (fy) { c.beginPath(); c.arc(s.cx0 + s.cw * fx, cy + s.ch * fy, br, 0, TAU); c.stroke(); }); });
          var lines = s.small ? (k ? ['< 70HZ'] : ['SUPPORT', 'PILLAR'])
            : (k ? ['DIAPHRAM MODULATION', 'IS KEPT < 70HZ', 'to constrain IONIZATION.'] : ['SUPPORT PILLAR', 'DIAPHRAM MODULATOR', 'FEED with WATER COOLING']);
          block(c, s.px0, cy + 2, s.px1 - s.px0, s.ch - 4, lines, C.alp, s.small ? 7 : 9.5);
        });
        if (s.small) return;

        // labels
        var hz = 15;
        text(c, 'ION RICH ZONE', s.xd - s.Lfl * 0.9, s.yc - s.Hfl * 0.58, hand(hz), 'rgba(226,210,255,0.95)');
        text(c, 'ELECTRON RICH ZONE', s.xd - s.Lfl * 0.74, s.yc + s.Hfl * 0.32, hand(hz), 'rgba(255,224,170,0.98)');
        text(c, 'ION-ELECTRON ZONE', s.xd - s.Lfl * 0.86, s.yc + s.Hfl * 0.74, hand(hz), 'rgba(226,210,255,0.95)');
        text(c, 'ELECTRON-ION MIX', s.sx + 20, s.sy + s.sh - 40, hand(hz), rgba(C.grn, 0.85));
        if (s.La > 110) text(c, 'HEATED ANTENNA', ax + s.La / 2, s.yc, mono(Math.min(8.5, s.ha * 1.1)), 'rgba(255,220,238,0.98)', 'center');
        leader(c, ax + s.La * 0.5, s.yc - s.ha, ax + s.La * 0.38, s.yc - s.ha - 15, C.alp);
        text(c, 'THORIUM COATED antenna', ax + s.La * 0.38 - 4, s.yc - s.ha - 16, mono(8.5), 'rgba(255,200,228,0.98)', 'right');
        text(c, 'MODULATION DIAPHRAM', s.xd - 16, s.sy + s.sh - 44, mono(9), rgba(C.blu, 0.98), 'right');
        text(c, '.250" stamped 4130 steel', s.xd - 16, s.sy + s.sh - 28, hand(13), rgba(C.blu, 0.85), 'right');
        if (s.cyT - s.sy > 44) {
          leader(c, s.xd + 15, s.cyT + s.ch * 0.3, s.xd - 18, s.sy + 46, C.alp);
          text(c, 'PERMANENT MAGNET', s.xd - 22, s.sy + 46, mono(8.5), 'rgba(255,200,228,0.98)', 'right');
        }
        if (s.cyT - s.sy > 46) text(c, 'cold gas like propane or thorium mercury · gas feed zone', s.cx0, s.cyT - 12, hand(13.5), ink(0.78));
        var dw = s.px1 - s.xd - 44;
        c.font = mono(9);
        var hvT = c.measureText('HIGH VOLTAGE · 60GHz MODULATED ≈ 1.41GHz').width <= dw ? 'HIGH VOLTAGE · 60GHz MODULATED ≈ 1.41GHz' : '60GHz MOD ≈ 1.41GHz';
        if (fg >= 13) {
          text(c, hvT, s.xd + 40, s.yc - fg * 0.42, mono(9), ink(0.96));
          text(c, 'insulative calcium copper titanate', s.xd + 40, s.yc + fg * 0.42, hand(12), rgba(C.grn, 0.9));
        } else text(c, hvT, s.xd + 40, s.yc, mono(8), ink(0.96));
        var below = s.sy + s.sh - (s.cyB + s.ch);
        if (below > 36) text(c, 'DIAPHRAM MODULATION SPEED DRIVES AVAILABE IONIZATION', s.cx0, s.cyB + s.ch + 15, mono(8.5), ink(0.9));
        if (below > 62) text(c, 'no disclosure · you’re on your own', s.px1, s.cyB + s.ch + 33, hand(13), ink(0.6), 'right');
      },
      dynamics: function (ctx, s, dt, dyn) {
        var i, om = t * 2.4, stroke = Math.sin(om), per = Math.floor(om / TAU);
        if (per !== lastS) { lastS = per; if (dyn > 0.5) bump('mod'); }
        if (reduce) stroke = 0.6;
        var kick = 1 + burst * 1.5;

        // gas drawn to the hole, then carried out through the zones as plasma
        for (i = 0; i < parts.length; i++) {
          var p = parts[i];
          if (p.st === 0) {
            var tx = s.xd + 4, ty = s.yc + p.sg * s.gap * 0.86, dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            var v = (22 + 900 / (d + 20)) * dt;
            p.x += dx / d * v; p.y += dy / d * v;
            if (d < 5) { p.st = 1; p.prog = 0; }
            ctx.fillStyle = rgba(C.grn, 0.55 * dyn);
            ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, TAU); ctx.fill();
          } else {
            p.prog += dt * (0.2 + 0.11 * Math.sin(om - p.prog * 5)) * kick / (0.6 + 0.5 * p.lane);
            if (p.prog >= 1) { parts[i] = spawnGas(s); continue; }
            var L = s.Lfl * (0.5 + 0.52 * p.lane), sh = 4 * p.prog * (1 - p.prog);
            var x = s.xd - L * p.prog, y = s.yc + p.sg * (s.gap * (1 - p.prog) + s.Hfl * p.lane * sh * 0.92);
            var col = p.prog < 0.22 ? C.yel : p.prog < 0.55 ? C.amb : '200,170,255';
            ctx.fillStyle = rgba(col, Math.pow(Math.sin(Math.PI * p.prog), 0.6) * 0.95 * dyn);
            ctx.beginPath(); ctx.arc(x, y, p.prog < 0.3 ? 1.7 : 1.4, 0, TAU); ctx.fill();
          }
        }
        // the diaphragm: a stamped plate that bows with each stroke
        var half = s.sh / 2 - 8;
        ctx.strokeStyle = rgba(C.blu, 0.92); ctx.lineWidth = s.small ? 4 : 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        [-1, 1].forEach(function (sg) {
          ctx.beginPath();
          for (var yy = s.gap; yy <= half; yy += 3) {
            var bow = (s.small ? 4 : 7) * stroke * Math.pow(1 - yy / half, 1.4);
            var xx = s.xd + bow + 3.2 * Math.sin(yy * 0.055 + 1);
            if (yy === s.gap) ctx.moveTo(xx, s.yc + sg * yy); else ctx.lineTo(xx, s.yc + sg * yy);
          }
          ctx.stroke();
        });
        ctx.lineCap = 'butt';

        ctx.globalCompositeOperation = 'lighter';
        // compression fronts travelling out through the zones
        for (i = 0; i < 3; i++) {
          var f = ((om / TAU) * 0.5 + i / 3) % 1, hh = s.Hfl * 4 * f * (1 - f) * 0.95 + s.gap * (1 - f);
          var fx = s.xd - s.Lfl * f;
          ctx.strokeStyle = rgba('255,240,210', (1 - f) * 0.5 * dyn * (0.6 + 0.4 * kick)); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(fx + hh * 0.22, s.yc - hh); ctx.quadraticCurveTo(fx - hh * 0.3, s.yc, fx + hh * 0.22, s.yc + hh); ctx.stroke();
        }
        // antenna glow and the 60 GHz feed
        var ax = s.xd - 12 - s.La, g = ctx.createRadialGradient(ax + s.La * 0.5, s.yc, 0, ax + s.La * 0.5, s.yc, s.La * 0.75);
        g.addColorStop(0, rgba(C.yel, (0.3 + 0.12 * Math.sin(t * 9)) * dyn)); g.addColorStop(1, 'rgba(255,176,87,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ax + s.La * 0.5, s.yc, s.La * 0.75, s.Hfl * 0.4, 0, 0, TAU); ctx.fill();
        ctx.setLineDash([9, 120]); ctx.lineDashOffset = -t * 230; ctx.lineCap = 'round';
        ctx.strokeStyle = rgba('255,236,200', 0.9 * dyn); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.px1, s.yc); ctx.lineTo(s.xd - 12, s.yc); ctx.stroke();
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        // coil packs fire with the stroke
        var br = Math.min(s.ch * 0.16, s.cw * 0.11);
        [s.cyT, s.cyB].forEach(function (cy) {
          ctx.fillStyle = rgba(C.blu, 0.55 * Math.abs(stroke) * dyn);
          [0.56, 0.83].forEach(function (fx2) { [0.3, 0.7].forEach(function (fy) { ctx.beginPath(); ctx.arc(s.cx0 + s.cw * fx2, cy + s.ch * fy, br, 0, TAU); ctx.fill(); }); });
        });
      }
    };
  })();

  /* ── engine: build, render, lifecycle ──────────────────── */
  function build() {
    var r = host.getBoundingClientRect();
    W = Math.max(300, r.width); H = Math.max(300, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = sheet.layout(base());
    stat = document.createElement('canvas');
    stat.width = canvas.width; stat.height = canvas.height;
    var c = stat.getContext('2d');
    c.scale(dpr, dpr);
    chrome(c, S, sheet);
    sheet.statics(c, S);
  }
  function render(dt) {
    var s = S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setLineDash([]);
    ctx.clearRect(0, 0, W, H);
    var rev = reduce ? 1 : smooth(0, 1.5, age), dyn = reduce ? 1 : smooth(1.2, 2.1, age);
    var rx = s.sx + (s.sw + 2) * rev;
    // the plotter wipes the previous sheet away as it draws the new one
    if (snap && rev < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(rx, 0, W - rx, H); ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(snap, 0, 0);
      ctx.restore(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else if (snap) snap = null;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, rx, H); ctx.clip();
    ctx.drawImage(stat, 0, 0, W, H);
    sheet.dynamics(ctx, s, dt, dyn);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.lineCap = 'butt';
    if (rev < 1) {   // plotter head
      ctx.globalCompositeOperation = 'lighter';
      var hg = ctx.createLinearGradient(rx - 60, 0, rx, 0);
      hg.addColorStop(0, 'rgba(120,200,255,0)'); hg.addColorStop(1, 'rgba(160,220,255,0.28)');
      ctx.fillStyle = hg; ctx.fillRect(rx - 60, s.sy, 60, s.sh);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(rx - 1, s.sy, 1.5, s.sh);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now; t += dt; age += dt;
    burst = Math.max(0, burst - dt * 1.2);
    render(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (reduce || running || !active) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  var sizeKey = '';
  function resize() {
    if (!sheet) return;
    var key = FX.stageKey(host, stageEl);
    if (key === sizeKey) return;
    sizeKey = key; snap = null;
    build();
    if (active) render(1 / 60);
  }
  function show(name) {
    if (!SHEETS[name]) return;
    if (active && sheet && !reduce) {   // keep the outgoing sheet to wipe over
      snap = document.createElement('canvas');
      snap.width = canvas.width; snap.height = canvas.height;
      snap.getContext('2d').drawImage(canvas, 0, 0);
    }
    sheet = SHEETS[name]; sheetName = name; active = true;
    sizeKey = FX.stageKey(host, stageEl);
    build();
    // plot the sheet in, except on a page that loaded off screen (show it finished)
    age = reduce || (firstShow && !live) ? 99 : 0;
    firstShow = false;
    render(1 / 60);
    if (inView && !document.hidden) start();
  }
  function hide() { active = false; stop(); snap = null; }

  FX.watchStage(host, stageEl, resize);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (inView) start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView && !document.hidden) start(); else stop();
    }, { threshold: 0 }).observe(host);
  }
  // the handwriting face is only used on canvas, so ask for it explicitly, then redraw
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('14px "Architects Daughter"'), document.fonts.load('500 10px "JetBrains Mono"')])
      .then(function () { if (sheet) { build(); if (active && !running) render(1 / 60); } }, function () { /* fallback faces */ });
  }
  host.addEventListener('click', function (e) {
    if (!active || !S || (e.target.closest && e.target.closest('a, button, input, label'))) return;
    var r = host.getBoundingClientRect(), y = e.clientY - r.top;
    if (y > S.sy && y < S.sy + S.sh) { burst = 1; if (reduce) render(1 / 60); }
  });

  /* ── exhibit switcher: the four sheets, then the fusion drive ───── */
  (function exhibits() {
    var chips = Array.prototype.slice.call(host.querySelectorAll('[data-exhibit-pick]'));
    var order = ['pump', 'craft', 'bubble', 'mod', 'reactor'], cur = '', auto = !reduce, viz3d = false;
    // while the header shows a 3D model (hero3d.js), neither the sheet nor the fusion drive is drawn
    function apply() {
      var isSheet = cur !== 'reactor';
      if (window.Reactor) window.Reactor.setActive(!isSheet && !viz3d);
      if (isSheet && !viz3d) show(cur); else hide();
    }
    function set(name, byUser) {
      if (order.indexOf(name) < 0) return;
      if (byUser) auto = false;
      if (name === cur) return;
      cur = name;
      host.setAttribute('data-exhibit', name);
      chips.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-exhibit-pick') === name ? 'true' : 'false'); });
      apply();
      host.dispatchEvent(new CustomEvent('exhibit', { detail: name }));
    }
    host.addEventListener('heroviz', function (e) { viz3d = e.detail === '3d'; if (viz3d) auto = false; if (cur) apply(); });
    chips.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-exhibit-pick'), true); }); });
    // until someone picks, step through the exhibits while the hero is on screen
    setInterval(function () {
      if (!auto || document.hidden || host.getBoundingClientRect().bottom < 160) return;
      set(order[(order.indexOf(cur) + 1) % order.length], false);
    }, 17000);
    window.Exhibits = { set: function (n) { set(n, true); }, current: function () { return cur; } };
    // ?exhibit=craft opens straight on that exhibit (useful for sharing a view)
    var want = (location.search.match(/[?&]exhibit=(\w+)/) || [])[1];
    set(want && order.indexOf(want) >= 0 ? want : 'pump', !!(want && order.indexOf(want) >= 0));
  })();
})();
