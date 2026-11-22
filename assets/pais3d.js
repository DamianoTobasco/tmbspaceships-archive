/* Pais 3D — a realistic, working 3D model of each patent's machine, drawn in the browser.
 *
 * No libraries and no downloads: every model is a signed-distance scene ray-marched in one
 * WebGL fragment shader (metal, ceramic, plasma glow, soft shadows), so it works offline and
 * inside the hosted copy alike. Each scene follows the patent's own description and reference
 * numerals; the parts list and the step-by-step run quote what the patent says happens.
 * What is shown is the machine as claimed. None of the effects has been demonstrated.
 *
 * This file is the engine. The scenes register themselves from p3d-<key>.js (key as in patents.js):
 *   Pais3D.scenes.craft = { title, fig, cam, fit, glsl, parts, steps, levels, rest, cutModes }
 *
 *   window.Pais3D.ok                 WebGL is available
 *   window.Pais3D.create(host, key, { compact })  mounts the viewer in host; returns { start, stop, resize, destroy }
 *                                    compact: no parts list beside it (for the page header)
 * Viewing: drag turns the model · pinch, Ctrl/⌘ + scroll, double-click or the + − buttons zoom toward that
 *          spot · Shift-drag, right-drag or two fingers pan · clicking a part zooms in on it
 *   ?p3d=time,yaw,pitch,cutMode      freezes every model in that state (for checking a view)
 *
 * A scene's GLSL defines FAR and GLOWK and these functions:
 *   vec2  map(vec3 p)                       distance, material id (> 0)
 *   vec3  glow(vec3 p)                      light given off by gas, plasma and fields at p
 *   float glowStep(vec3 p)                  longest step allowed at p (small inside glowing volumes)
 *   vec3  lit(vec3 p, vec3 alb, vec3 n)     extra light on a surface (plasma light and the like)
 *   void  material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi)
 *   vec3  bg(vec3 rd)
 * Uniforms: uT time · uCut 0 closed … 1 cut open · uA, uB.xyz levels from scene.levels(t) ·
 *           uB.w 1 while the first cut mode's second plane is in · uC running phases (∫ rate dt)
 */
(function () {
  'use strict';
  var still = /[?&]still=1\b/.test(location.search);
  var reduce = still || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { var k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ════════════ shader: shared head, per-scene body, shared ray-marcher ════════════ */
  var HEAD = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uT; uniform vec3 uRo, uRi, uUp, uFw; uniform float uFl;',
    'uniform float uCut; uniform vec4 uA; uniform vec4 uB; uniform vec4 uC; uniform float uFar;',
    'const float PI=3.14159265; const float TAU=6.2831853;',
    'float hash1(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);',
    '  return mix(mix(mix(hash1(i),hash1(i+vec3(1,0,0)),f.x), mix(hash1(i+vec3(0,1,0)),hash1(i+vec3(1,1,0)),f.x),f.y),',
    '             mix(mix(hash1(i+vec3(0,0,1)),hash1(i+vec3(1,0,1)),f.x), mix(hash1(i+vec3(0,1,1)),hash1(i+vec3(1,1,1)),f.x),f.y),f.z); }',
    'mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }',
    'float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }',
    'float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p,b-r)-r; }',
    'float sdBox2(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,q.y),0.0); }',
    'float ndot(vec2 a, vec2 b){ return a.x*b.x-a.y*b.y; }',
    'float sdRhombus(vec2 p, vec2 b){ p=abs(p); float h=clamp(ndot(b-2.0*p,b)/dot(b,b),-1.0,1.0);',
    '  float d=length(p-0.5*b*vec2(1.0-h,1.0+h)); return d*sign(p.x*b.y+p.y*b.x-b.x*b.y); }',
    // ring with a rectangular section, around the y axis: radius r0..r1, height y0..y1
    'float ann(vec3 p, float r0, float r1, float y0, float y1){ return sdBox2(vec2(length(p.xz)-0.5*(r0+r1), p.y-0.5*(y0+y1)), vec2(0.5*(r1-r0),0.5*(y1-y0))); }',
    // cylinder along x: radius r, half-length h
    'float cyl2(vec2 d){ return min(max(d.x,d.y),0.0)+length(max(d,0.0)); }',
    'float cylX(vec3 p, float r, float h){ return cyl2(vec2(length(p.yz)-r, abs(p.x)-h)); }',
    'float cylY(vec3 p, float r, float h){ return cyl2(vec2(length(p.xz)-r, abs(p.y)-h)); }',
    'float cylZ(vec3 p, float r, float h){ return cyl2(vec2(length(p.xy)-r, abs(p.z)-h)); }',
    // cone frustum in (along-axis, radius) space: radius r1 at a=-h, r2 at a=+h
    'float sdCone2(vec2 q, float h, float r1, float r2){ vec2 k1=vec2(r2,h); vec2 k2=vec2(r2-r1,2.0*h);',
    '  vec2 ca=vec2(q.y-min(q.y,(q.x<0.0)?r1:r2), abs(q.x)-h); vec2 cb=vec2(q.y,q.x)-k1+k2*clamp(dot(k1-vec2(q.y,q.x),k2)/dot(k2,k2),0.0,1.0);',
    '  float s=(cb.x<0.0&&ca.y<0.0)?-1.0:1.0; return s*sqrt(min(dot(ca,ca),dot(cb,cb))); }',
    'float sdTorus2(vec2 q, float R, float r){ return length(q-vec2(0.0,R))-r; }',
    // a wire-mesh box: the faces sit half a cell away from the grid planes, so each face is a mesh
    'float cage(vec3 p, vec3 b, float n, float w){ float s=abs(sdBox(p,b))-w; vec3 f=(floor(b*n)+0.5)/b;',
    '  vec3 g=abs(fract(p*f+0.5)-0.5)/f; return max(s, min(min(g.x,g.y),g.z)-w); }',
    'float hatchF(vec3 p){ return smoothstep(0.35,0.5,abs(fract((p.x+p.y+p.z)*42.0)-0.5)); }',
    'vec3 env(vec3 r){ vec3 c=mix(vec3(0.02,0.03,0.07), vec3(0.10,0.16,0.30), smoothstep(-0.3,0.8,r.y));',
    '  c+=vec3(1.0,0.98,0.95)*smoothstep(0.55,0.8,r.y)*smoothstep(0.8,0.1,abs(r.x))*1.05;',   // overhead softbox
    '  c+=vec3(0.45,0.75,1.0)*smoothstep(0.16,0.0,abs(r.y+0.04))*0.4;',                          // horizon strip
    '  c+=vec3(1.0,0.78,0.55)*smoothstep(0.72,0.96,r.z)*0.45;',                                  // warm front fill
    '  c+=vec3(0.5,0.6,1.0)*smoothstep(0.75,0.97,-r.x)*0.3;',
    '  c+=vec3(0.75,0.85,1.0)*smoothstep(0.35,0.85,r.z)*smoothstep(0.15,-0.5,r.y)*smoothstep(-0.95,-0.6,r.y)*0.75;',  // low front softbox
    '  c+=vec3(0.10,0.14,0.24)*smoothstep(0.1,-0.7,r.y); return c; }',
    // dark studio backdrop; fine dust that streaks past when the machine is said to move
    'vec3 studioBg(vec3 rd, float travel, float speed){',
    '  vec3 c=mix(vec3(0.0025,0.005,0.018),vec3(0.008,0.02,0.062),smoothstep(-0.7,0.9,rd.y));',
    '  c+=vec3(0.012,0.03,0.08)*exp(-abs(rd.y+0.05)*5.0);',
    '  for(int k=0;k<2;k++){ float sc=k==0?9.0:17.0; vec2 q=vec2(atan(rd.x,rd.z)*sc*0.6, rd.y*sc+travel*(k==0?1.0:1.7));',
    '    vec2 id=floor(q); vec2 f=fract(q)-0.5; float h=hash1(vec3(id,float(k)+3.0)); f-=(vec2(h,fract(h*7.3))-0.5)*0.7;',
    '    f.y/=1.0+speed*(k==0?7.0:12.0); f.x*=1.0+speed*2.0; c+=vec3(0.5,0.72,1.0)*smoothstep(0.03,0.0,length(f))*step(0.62,h)*(0.035+0.16*speed); }',
    '  return c; }'
  ].join('\n');

  var MAIN = [
    'vec3 calcNormal(vec3 p){ const vec2 e=vec2(1.0,-1.0)*0.0009;',
    '  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x); }',
    'float softShadow(vec3 ro, vec3 rd){ float res=1.0; float t=0.02;',
    '  for(int i=0;i<22;i++){ float h=map(ro+rd*t).x; res=min(res,9.0*h/t); t+=clamp(h,0.02,0.25); if(res<0.01||t>4.0) break; }',
    '  return clamp(res,0.0,1.0); }',
    'float calcAO(vec3 p, vec3 n){ float o=0.0; float s=1.0;',
    '  for(int i=0;i<5;i++){ float h=0.01+0.07*float(i); o+=(h-map(p+n*h).x)*s; s*=0.75; } return clamp(1.0-2.2*o,0.0,1.0); }',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;',
    '  vec3 rd=normalize(uRi*uv.x+uUp*uv.y+uFw*uFl); vec3 ro=uRo;',
    '  float t=0.02*hash1(vec3(gl_FragCoord.xy,uT)); float m=-1.0; vec3 vol=vec3(0.0);',
    '  for(int i=0;i<150;i++){',
    '    vec3 p=ro+rd*t; vec2 h=map(p); float cap=glowStep(p);',
    '    vol+=glow(p)*clamp(min(h.x,cap),0.006,0.12);',
    '    if(h.x<0.0007*t+0.0003){ m=h.y; break; }',
    '    t+=min(h.x*0.92,cap); if(t>uFar) break;',
    '  }',
    '  vec3 col;',
    '  if(m>0.0){',
    '    vec3 p=ro+rd*t; vec3 n=calcNormal(p);',
    '    vec3 alb; float met; float rgh; vec3 emi; material(m,p,n,alb,met,rgh,emi);',
    '    vec3 L=normalize(vec3(0.36,0.74,0.58));',
    '    float dif=max(dot(n,L),0.0); float sh=softShadow(p+n*0.003,L); float ao=calcAO(p,n);',
    '    vec3 r=reflect(rd,n); float fre=pow(1.0-max(dot(n,-rd),0.0),5.0);',
    '    vec3 F0=mix(vec3(0.04),alb,met); vec3 F=F0+(1.0-F0)*fre;',
    '    vec3 ev=mix(env(r), vec3(0.12,0.16,0.26), rgh*rgh*0.85);',
    '    float hl=pow(max(dot(normalize(L-rd),n),0.0), mix(180.0,14.0,rgh))*(1.0-rgh*0.6);',
    '    vec3 dcol=alb*(1.0-met)*(dif*sh*vec3(1.05,1.0,0.94)*1.5+ao*(vec3(0.07,0.09,0.16)+0.14*max(dot(n,vec3(-0.6,0.2,0.5)),0.0)+0.12*max(dot(n,vec3(0.1,-0.5,0.85)),0.0)));',
    '    col=dcol+ev*F*ao*(0.55+0.45*sh)+vec3(1.0)*hl*sh*F*1.6+emi+lit(p,alb,n);',
    '    col=mix(col,bg(rd),smoothstep(uFar*0.85,uFar,t));',
    '  } else col=bg(rd);',
    '  col+=vol*GLOWK;',
    '  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);',
    '  col*=1.0-0.28*dot(uv,uv);',
    '  gl_FragColor=vec4(pow(clamp(col,0.0,1.0),vec3(0.4545)),1.0);',
    '}'
  ].join('\n');

  var VERT = 'attribute vec2 a; void main(){ gl_Position=vec4(a,0.0,1.0); }';
  var SCENES = {};
  var CUT_MODES = [{ label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Half section', cut: 1, qt: 0 }, { label: 'Closed', cut: 0, qt: 0 }];

  /* ════════════ WebGL plumbing ════════════ */
  function testGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }
  function program(gl, fragSrc) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  function create(host, key, opts) {
    var S = SCENES[key];
    if (!S || !host) return null;
    var compact = !!(opts && opts.compact);
    host.classList.toggle('p3d-compact', compact);
    var MODES = S.cutModes || CUT_MODES;
    var total = S.steps.reduce(function (a, s) { return a + s.d; }, 0);
    host.innerHTML =
      '<div class="p3d-stage">' +
        '<canvas class="p3d-cv" role="img" aria-label="3D model of the ' + esc(S.title.toLowerCase()) + ', built from ' + esc(S.from || 'the patent’s description') + '"></canvas>' +
        '<div class="p3d-pins" aria-hidden="true">' + S.parts.map(function (p, i) { return '<button type="button" class="p3d-pin" data-part="' + i + '" tabindex="-1">' + esc(p.n) + '</button>'; }).join('') + '</div>' +
        '<div class="p3d-ctl">' +
          '<button type="button" class="p3d-btn" data-p3d="cut" aria-pressed="true" title="Switch the cutaway view">' + esc(MODES[0].label) + '</button>' +
          '<button type="button" class="p3d-btn" data-p3d="run" aria-pressed="true">Running</button>' +
          '<button type="button" class="p3d-btn" data-p3d="reset">Reset view</button>' +
          '<span class="p3d-zoom"><button type="button" class="p3d-btn" data-p3d="zout" aria-label="Zoom out" title="Zoom out">−</button>' +
          '<button type="button" class="p3d-btn" data-p3d="zin" aria-label="Zoom in" title="Zoom in">+</button></span>' +
        '</div>' +
        '<p class="p3d-load">Building the 3D model…</p>' +
        '<div class="p3d-steps"><div class="p3d-dots" role="tablist" aria-label="How it is claimed to work">' +
          S.steps.map(function (s, i) { return '<button type="button" role="tab" data-step="' + i + '" aria-selected="false"><b>' + (i + 1) + '</b><span>' + esc(s.label) + '</span><i></i></button>'; }).join('') +
        '</div><p class="p3d-cap" aria-live="polite"></p></div>' +
        (compact ? '<p class="p3d-detail"></p>' : '') +
      '</div>' +
      (compact ? '' : '<aside class="p3d-legend">' +
        '<h4>Parts <small>' + esc(S.partsNote || 'numbered as in the patent') + '</small></h4>' +
        '<ol>' + S.parts.map(function (p, i) { return '<li><button type="button" data-part="' + i + '"><b>' + esc(p.n) + '</b><span>' + esc(p.name) + '</span></button></li>'; }).join('') + '</ol>' +
        '<p class="p3d-detail"></p>' +
        '<p class="p3d-note">' + esc(S.fig) + '. Drag to turn it; pinch, double-click or use + and − to zoom; click a part to zoom in on it. ' + esc(S.claim || 'Shown working as the patent claims; none of this has been demonstrated.') + '</p>' +
      '</aside>');
    var stage = host.querySelector('.p3d-stage'), cv = host.querySelector('.p3d-cv');
    var pins = Array.prototype.slice.call(host.querySelectorAll('.p3d-pin'));
    var rows = Array.prototype.slice.call(host.querySelectorAll('.p3d-legend li button'));
    var dots = Array.prototype.slice.call(host.querySelectorAll('.p3d-dots button'));
    var cap = host.querySelector('.p3d-cap'), detail = host.querySelector('.p3d-detail'), load = host.querySelector('.p3d-load');
    var cutBtn = host.querySelector('[data-p3d="cut"]'), runBtn = host.querySelector('[data-p3d="run"]');
    var gl = null, prog = null, U = {}, failed = false, PX = new Uint8Array(4);
    var q = (location.search.match(/[?&]p3d=([-\d.,]+)/) || [])[1], Q = q ? q.split(',').map(Number) : null;
    var st = { yaw: S.cam.yaw, pitch: S.cam.pitch, manual: false, mode: 0, cut: MODES[0].cut, cutCur: MODES[0].cut, qt: MODES[0].qt, qtCur: MODES[0].qt,
               zoom: 1, zoomCur: 1, tgt: [0, 0, 0], tgtCur: [0, 0, 0],
               run: !reduce, time: reduce ? 0 : 0.2, phase: [0, 0, 0, 0], scale: 1, slow: 0, frames: 0, W: 0, H: 0, sel: -1, step: -1, running: false, raf: 0, last: 0, drawn: false };
    if (Q) {
      st.time = Q[0] || 0; st.frozen = true; st.manual = true;
      if (Q.length > 1) st.yaw = Q[1];
      if (Q.length > 2) st.pitch = Q[2];
      if (Q.length > 3 && MODES[Q[3]]) { st.mode = Q[3]; st.cut = st.cutCur = MODES[Q[3]].cut; st.qt = st.qtCur = MODES[Q[3]].qt; cutBtn.textContent = MODES[Q[3]].label; }
    }

    function init() {
      if (gl || failed) return !failed;
      try {
        gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) || cv.getContext('experimental-webgl');
        if (!gl) throw new Error('no WebGL');
        prog = program(gl, HEAD + '\n' + S.glsl + '\n' + MAIN);
        gl.useProgram(prog);
        var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        ['uRes', 'uT', 'uRo', 'uRi', 'uUp', 'uFw', 'uFl', 'uCut', 'uA', 'uB', 'uC', 'uFar'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      } catch (e) {
        failed = true; gl = null;
        if (window.console) console.warn('Pais3D: ' + key + ' could not start', e);
        host.dispatchEvent(new CustomEvent('p3d-fail', { bubbles: true }));
        return false;
      }
      return true;
    }
    function resize() {
      var r = stage.getBoundingClientRect();
      if (!r.width) return false;
      st.W = r.width; st.H = r.height;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * st.scale;
      var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      return true;
    }
    var FL = 1.7;
    function camera() {
      var aspect = st.W / Math.max(1, st.H), narrow = aspect < 1.05;
      // until someone turns it, the model sways gently around a view that suits the stage's shape
      var yaw = st.manual ? st.yaw : (narrow && S.cam.yawNarrow || S.cam.yaw) + (reduce ? 0 : S.cam.sway * Math.sin(st.time * 0.22));
      var pitch = st.pitch;
      st.curYaw = yaw;
      // a little air round the model at zoom 1; zooming moves the camera along its line of sight to the target
      var D0 = 1.14 * FL * Math.max(S.fit.hh / 0.5, (narrow && S.fit.hwNarrow || S.fit.hw) / (0.5 * aspect)), D = D0 / st.zoomCur, T = st.tgtCur;
      var dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      var ro = [T[0] + D * dir[0], T[1] + D * dir[1], T[2] + D * dir[2]], fw = [-dir[0], -dir[1], -dir[2]];
      var ri = [-fw[2], 0, fw[0]], rl = Math.hypot(ri[0], ri[2]) || 1; ri = [ri[0] / rl, 0, ri[2] / rl];   // cross(fw, +Y)
      var up = [ri[1] * fw[2] - ri[2] * fw[1], ri[2] * fw[0] - ri[0] * fw[2], ri[0] * fw[1] - ri[1] * fw[0]];
      return (st.cam = { ro: ro, fw: fw, ri: ri, up: up, D: D, D0: D0 });
    }
    function levels() { return st.run ? S.levels(st.time % total, total) : S.rest; }
    function stepAt() {
      var tt = st.time % total, acc = 0;
      for (var i = 0; i < S.steps.length; i++) { if (tt < acc + S.steps[i].d) return { i: i, k: (tt - acc) / S.steps[i].d }; acc += S.steps[i].d; }
      return { i: S.steps.length - 1, k: 1 };
    }
    function pinHidden(p) {
      if (!p.cut) return false;
      return st.cutCur < 0.6 || (p.cut === 'full' && st.qtCur > 0.4);
    }
    function hud(C) {
      pins.forEach(function (el, i) {   // pins follow their parts
        var p = S.parts[i], v = [p.at[0] - C.ro[0], p.at[1] - C.ro[1], p.at[2] - C.ro[2]];
        var x = v[0] * C.ri[0] + v[1] * C.ri[1] + v[2] * C.ri[2], y = v[0] * C.up[0] + v[1] * C.up[1] + v[2] * C.up[2], z = v[0] * C.fw[0] + v[1] * C.fw[1] + v[2] * C.fw[2];
        el.style.transform = 'translate(' + (st.W / 2 + x / z * FL * st.H).toFixed(1) + 'px,' + (st.H / 2 - y / z * FL * st.H).toFixed(1) + 'px) translate(-50%,-50%)';
        el.classList.toggle('off', z < 0.1 || pinHidden(p));
      });
      var s = st.run ? stepAt() : { i: -1, k: 0 };
      if (s.i !== st.step) {
        st.step = s.i;
        dots.forEach(function (d, i) { d.setAttribute('aria-selected', i === s.i ? 'true' : 'false'); d.classList.toggle('done', s.i >= 0 && i < s.i); });
        cap.textContent = s.i >= 0 ? S.steps[s.i].text : 'Paused with everything running. Press Running to replay the sequence step by step.';
      }
      if (s.i >= 0) dots[s.i].style.setProperty('--k', s.k.toFixed(3));
    }
    function draw(dt) {
      if (!gl || !resize()) return;
      st.cutCur += (st.cut - st.cutCur) * Math.min(1, dt * 5); st.qtCur += (st.qt - st.qtCur) * Math.min(1, dt * 5);
      var ez = Math.min(1, dt * 9);
      st.zoomCur += (st.zoom - st.zoomCur) * ez;
      for (var j = 0; j < 3; j++) st.tgtCur[j] += (st.tgt[j] - st.tgtCur[j]) * ez;
      var lv = levels(), C = camera(), B = lv.B || [0, 0, 0], rate = lv.rate || [0, 0, 0, 0], i;
      for (i = 0; i < 4; i++) st.phase[i] = st.frozen ? (rate[i] || 0) * st.time : st.phase[i] + (reduce ? 0 : (rate[i] || 0) * dt);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uT, st.time);
      gl.uniform3fv(U.uRo, C.ro); gl.uniform3fv(U.uRi, C.ri); gl.uniform3fv(U.uUp, C.up); gl.uniform3fv(U.uFw, C.fw);
      gl.uniform1f(U.uFl, FL); gl.uniform1f(U.uCut, st.cutCur); gl.uniform1f(U.uFar, C.D + S.fit.hw * 1.3 + 3.5);
      gl.uniform4fv(U.uA, lv.A); gl.uniform4f(U.uB, B[0] || 0, B[1] || 0, B[2] || 0, st.qtCur); gl.uniform4fv(U.uC, st.phase);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      hud(C);
      if (!st.drawn) { st.drawn = true; load.hidden = true; host.classList.add('ready'); }
    }
    function frame(now) {
      st.raf = 0;
      if (!st.running) return;
      var dt = Math.min(0.06, (now - (st.last || now)) / 1000); st.last = now;
      if (!reduce && !st.frozen) st.time += dt;
      // keep it smooth: now and then time one frame for real (a 1-pixel read-back waits for the
      // graphics chip) and trade resolution for speed. Frame pacing alone can't tell a slow chip
      // from a browser that is throttling a background tab.
      var probe = gl && st.frames % 60 === 24, t0 = probe ? performance.now() : 0;   // not the first frames: the chip is still warming the shader up
      draw(dt);
      st.frames++;
      if (probe && gl) {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PX);
        var ms = performance.now() - t0;
        if (ms > 19 && st.scale > 0.4) { if (++st.slow >= 2) { st.scale = Math.max(0.4, st.scale * Math.sqrt(13 / ms)); st.slow = 0; } }   // two slow readings in a row, so one hiccup changes nothing
        else { st.slow = 0; if (ms < 9 && st.scale < 1) st.scale = Math.min(1, st.scale * 1.2); }
      }
      if (reduce && st.drawn && Math.abs(st.cut - st.cutCur) + Math.abs(st.qt - st.qtCur) + Math.abs(st.zoom - st.zoomCur) +
          Math.abs(st.tgt[0] - st.tgtCur[0]) + Math.abs(st.tgt[1] - st.tgtCur[1]) + Math.abs(st.tgt[2] - st.tgtCur[2]) < 0.004 && !st.dirty) { st.running = false; return; }
      st.dirty = false;
      st.raf = requestAnimationFrame(frame);
    }
    function start() {
      if (st.running || !init()) return;
      st.running = true; st.last = 0; st.raf = requestAnimationFrame(frame);
    }
    function stop() { st.running = false; if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; }
    function poke() { st.dirty = true; if (reduce && !st.running && gl) start(); }

    /* ── zoom and pan ── */
    function hold() { if (!st.manual) { st.manual = true; st.yaw = st.curYaw == null ? st.yaw : st.curYaw; } }   // stop the idle sway where it is
    function limit() {
      var mx = S.fit.hw * 1.1, my = S.fit.hh * 1.1;
      st.tgt[0] = clamp(st.tgt[0], -mx, mx); st.tgt[1] = clamp(st.tgt[1], -my, my); st.tgt[2] = clamp(st.tgt[2], -mx, mx);
    }
    // zoom by factor f; px, py (stage pixels from the centre) is the spot that should stay under the cursor
    function zoomBy(f, px, py) {
      var z0 = st.zoom, z1 = clamp(z0 * f, 0.45, 7), C = st.cam;
      f = z1 / z0;
      if (f === 1) return;
      hold();
      if (px != null && C && st.H) {
        var k = C.D0 / z0 / (FL * st.H) * (1 - 1 / f);
        for (var i = 0; i < 3; i++) st.tgt[i] += (C.ri[i] * px - C.up[i] * py) * k;
        limit();
      }
      st.zoom = z1; poke();
    }
    function panBy(dx, dy) {
      var C = st.cam;
      if (!C || !st.H) return;
      hold();
      var k = C.D / (FL * st.H);
      for (var i = 0; i < 3; i++) st.tgt[i] += (-C.ri[i] * dx + C.up[i] * dy) * k;
      limit(); poke();
    }
    function focus(p) { hold(); st.tgt = p.at.slice(); st.zoom = Math.max(st.zoom, p.zoom || 1.9); poke(); }
    function home() { st.zoom = 1; st.tgt = [0, 0, 0]; }

    function setCut(i) {
      var m = MODES[i];
      st.mode = i; st.cut = m.cut; st.qt = m.qt;
      cutBtn.setAttribute('aria-pressed', m.cut ? 'true' : 'false'); cutBtn.textContent = m.label;
      poke();
    }
    function select(i) {
      st.sel = st.sel === i ? -1 : i;
      pins.forEach(function (el, k) { el.classList.toggle('on', k === st.sel); });
      rows.forEach(function (el, k) { el.classList.toggle('on', k === st.sel); });
      var p = S.parts[st.sel];
      detail.innerHTML = p ? '<b>' + esc(p.n) + ' · ' + esc(p.name) + '</b>' + esc(p.text) : '';
      if (p && p.cut) {   // open the model far enough to show the part
        var need = function (m) { return m.cut && (p.cut !== 'full' || !m.qt); };
        if (!need(MODES[st.mode])) for (var k = 0; k < MODES.length; k++) if (need(MODES[k])) { setCut(k); break; }
      }
      if (p) focus(p);   // and bring it close
    }
    host.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target : null;
      if (!t) return;
      var part = t.closest('[data-part]'), stepB = t.closest('[data-step]'), b = t.closest('[data-p3d]');
      if (part) { select(+part.getAttribute('data-part')); poke(); }
      else if (stepB) {
        var acc = 0, idx = +stepB.getAttribute('data-step');
        for (var i = 0; i < idx; i++) acc += S.steps[i].d;
        st.time = acc + 0.05; st.run = !reduce; st.step = -2;
        runBtn.setAttribute('aria-pressed', st.run ? 'true' : 'false');
        if (reduce) cap.textContent = S.steps[idx].text;
        poke();
      } else if (b) {
        var act = b.getAttribute('data-p3d');
        if (act === 'cut') setCut((st.mode + 1) % MODES.length);
        else if (act === 'run') { st.run = !st.run && !reduce; b.setAttribute('aria-pressed', st.run ? 'true' : 'false'); st.step = -2; poke(); }
        else if (act === 'reset') { st.yaw = S.cam.yaw; st.pitch = S.cam.pitch; st.manual = false; home(); if (st.sel >= 0) select(st.sel); setCut(0); }
        else if (act === 'zin') zoomBy(1.4);
        else if (act === 'zout') zoomBy(1 / 1.4);
      }
    });
    // one pointer turns the model (Shift or the right button pans it); two fingers pinch to zoom and pan.
    // On touch only sideways movement turns it, so a vertical swipe still scrolls the page.
    var ptr = {}, drag = null, pinch = null;
    function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; }
    function two() { var k = Object.keys(ptr); return k.length === 2 ? [ptr[k[0]], ptr[k[1]]] : null; }
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      ptr[e.pointerId] = local(e);
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      var t = two();
      if (t) { drag = null; pinch = { d: Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]) || 1, m: [(t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2] }; return; }
      hold();
      drag = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch, touch: e.pointerType === 'touch', pan: e.shiftKey || e.button === 2 || e.button === 1 };
      stage.classList.add('grab');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!ptr[e.pointerId]) return;
      ptr[e.pointerId] = local(e);
      var t = two();
      if (t && pinch) {
        var d = Math.hypot(t[0][0] - t[1][0], t[0][1] - t[1][1]) || 1, m = [(t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2];
        panBy(m[0] - pinch.m[0], m[1] - pinch.m[1]);
        zoomBy(d / pinch.d, m[0], m[1]);
        pinch = { d: d, m: m };
        return;
      }
      if (!drag) return;
      if (drag.pan) { panBy(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; return; }
      st.yaw = drag.yaw - (e.clientX - drag.x) * 0.008;
      if (!drag.touch) st.pitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.006, -1.2, 1.3);
      poke();
    });
    function drop(e) { delete ptr[e.pointerId]; pinch = null; drag = null; stage.classList.remove('grab'); }
    stage.addEventListener('pointerup', drop); stage.addEventListener('pointercancel', drop);
    stage.addEventListener('contextmenu', function (e) { if (!e.target.closest('button')) e.preventDefault(); });   // the right button pans
    stage.addEventListener('wheel', function (e) {   // Ctrl/⌘ + scroll, which is also what a trackpad pinch sends; a plain scroll still moves the page
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var p = local(e);
      zoomBy(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.012)), p[0], p[1]);
    }, { passive: false });
    stage.addEventListener('dblclick', function (e) {
      if (e.target.closest('button')) return;
      var p = local(e);
      zoomBy(e.shiftKey ? 1 / 1.8 : 1.8, p[0], p[1]);
    });
    function destroy() {
      stop();
      try { var ex = gl && gl.getExtension('WEBGL_lose_context'); if (ex) ex.loseContext(); } catch (err) { /* ignore */ }
      gl = null; prog = null; host.innerHTML = ''; host.classList.remove('ready', 'p3d-compact');
    }
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); gl = null; prog = null; });
    cv.addEventListener('webglcontextrestored', function () { st.drawn = false; start(); });

    return { start: start, stop: stop, resize: function () { poke(); }, failed: function () { return failed; }, destroy: destroy };
  }

  // for checking a scene is not too heavy on this machine: ms to build its shader, and ms per frame
  // at w x h with everything running and the model cut open
  function bench(key, w, h) {
    var S = SCENES[key], c = document.createElement('canvas'); c.width = w = w || 64; c.height = h = h || 64;
    var gl = c.getContext('webgl'), t0 = performance.now(), px = new Uint8Array(4);
    var p = program(gl, HEAD + '\n' + SCENES[key].glsl + '\n' + MAIN);
    gl.useProgram(p);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function u(n) { return gl.getUniformLocation(p, n); }
    var D = 1.7 * Math.max(S.fit.hh / 0.5, S.fit.hw / (0.5 * w / h)), yaw = S.cam.yaw, pt = S.cam.pitch;
    var ro = [D * Math.sin(yaw) * Math.cos(pt), D * Math.sin(pt), D * Math.cos(yaw) * Math.cos(pt)], l = Math.hypot(ro[0], ro[1], ro[2]);
    var fw = [-ro[0] / l, -ro[1] / l, -ro[2] / l], ri = [-fw[2], 0, fw[0]], rl = Math.hypot(ri[0], ri[2]); ri = [ri[0] / rl, 0, ri[2] / rl];
    var up = [ri[1] * fw[2] - ri[2] * fw[1], ri[2] * fw[0] - ri[0] * fw[2], ri[0] * fw[1] - ri[1] * fw[0]], m = (S.cutModes || CUT_MODES)[0];
    gl.viewport(0, 0, w, h); gl.uniform2f(u('uRes'), w, h); gl.uniform1f(u('uT'), 3.3); gl.uniform1f(u('uFl'), 1.7); gl.uniform1f(u('uCut'), m.cut);
    gl.uniform3fv(u('uRo'), ro); gl.uniform3fv(u('uRi'), ri); gl.uniform3fv(u('uUp'), up); gl.uniform3fv(u('uFw'), fw);
    gl.uniform4fv(u('uA'), S.rest.A); gl.uniform4f(u('uB'), S.rest.B[0], S.rest.B[1], S.rest.B[2], m.qt); gl.uniform4f(u('uC'), 1, 1, 0, 0);
    gl.uniform1f(u('uFar'), D + S.fit.hw * 1.3 + 3.5);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var build = Math.round(performance.now() - t0), t1 = performance.now();
    for (var i = 0; i < 6; i++) { gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return { build: build, frame: +((performance.now() - t1) / 6).toFixed(1) };
  }

  window.Pais3D = { ok: testGL(), scenes: SCENES, create: create, smooth: smooth, clamp: clamp, bench: bench };
})();
