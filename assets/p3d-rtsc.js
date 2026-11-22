/* Pais 3D scene 3 · Piezoelectricity-induced room temperature superconductor (US 2019/0058105 A1),
 * FIG. 2: a wire 100 with an insulator core 110 and a thin PZT (or aluminum) coating 120, a pulsed
 * current source V(t), and a helical EM coil 200 round it with its own pulsed source V*(t).
 * The coating is about a micron thick in the patent; it is drawn far thicker here so it can be seen.
 * uA = (current, vibration, coil, supercurrent)  uB = (outside magnetic field, expulsion)  uC = (wire pulses, coil pulses) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes.rtsc = {
    title: 'Piezoelectricity-induced room temperature superconductor',
    fig: 'After FIG. 2. The coating is really about a micron thick; it is drawn much thicker here',
    cam: { yaw: 0.42, pitch: 0.32, sway: 0.26, yawNarrow: 1.05 },
    fit: { hw: 2.3, hh: 1.3, hwNarrow: 1.6 },
    cutModes: [{ label: 'Layers peeled', cut: 1, qt: 1 }, { label: 'Whole wire', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 14.0',
      '#define GLOWK 2.8',
      'const float HW=1.7; const float RC=0.2; const float RO=0.236; const float RH=0.42; const float PT=0.5;',   // half-length, core radius, coated radius, coil radius, coil pitch
      // the plucked wire: three half-waves that ring down after each strike
      'float pluck(float x){ float ph=fract(uT/1.5); return uA.y*0.034*exp(-3.2*ph)*cos(ph*44.0)*sin((x+HW)*2.7720); }',
      // the peeled quarter: the coating is opened from x0, the core from x1
      'float peel(vec3 p, float x0){ return min(min(p.y,p.z),p.x-mix(3.0,x0,uCut)); }',
      'float helix(vec3 p){ float a=atan(p.z,p.y); float t=p.x-PT*(a/TAU+0.5); t=mod(t+0.5*PT,PT)-0.5*PT;',
      '  return max(length(vec2(length(p.yz)-RH,t))-0.022,abs(p.x)-1.26); }',
      'vec2 map(vec3 p){',
      '  vec3 w=p; w.y-=pluck(p.x); float r=length(w.yz);',
      '  float d=max(max(abs(r-0.5*(RC+RO))-0.5*(RO-RC),abs(w.x)-HW),peel(w,-0.3));',       // coating 120
      '  vec2 res=vec2(d,1.0);',
      '  d=max(max(r-RC,abs(w.x)-HW),peel(w,0.72)); if(d<res.x) res=vec2(d,2.0);',          // insulator core 110
      '  d=helix(p); if(d<res.x) res=vec2(d,3.0);',                                         // helical EM coil 200
      // terminals at each end, and the leads to the two pulsed current sources
      '  d=sdCone2(vec2(abs(p.x)-(HW+0.15),length(p.yz)),0.15,RO,0.045)-0.004; if(d<res.x) res=vec2(d,4.0);',
      '  vec3 l=vec3(abs(p.x),p.y,p.z);',
      '  d=min(cylY(l-vec3(HW+0.32,-0.48,0.0),0.02,0.5), cylX(l-vec3(1.15,-0.98,0.0),0.02,0.89));',
      '  d=min(d,cylX(l-vec3(HW+0.31,0.0,0.0),0.02,0.03));',
      '  d=min(d,min(cylY(l-vec3(1.25,0.71,0.0),0.02,0.29), cylX(l-vec3(0.74,1.0,0.0),0.02,0.53))); if(d<res.x) res=vec2(d,5.0);',
      '  d=min(sdRBox(p-vec3(0.0,-0.98,0.0),vec3(0.26,0.15,0.15),0.02), sdRBox(p-vec3(0.0,1.0,0.0),vec3(0.24,0.14,0.14),0.02)); if(d<res.x) res=vec2(d,6.0);',
      '  return res;',
      '}',
      // field lines of an outside magnetic field, drawn in one slice near the left end of the wire
      'float bline(vec3 p){ float a2=0.085; float rr=dot(p.yz,p.yz); float psi=p.z*(1.0-uB.y*a2/max(rr,a2));',
      '  float u=(p.x+1.47)/0.02; return pow(1.0-abs(2.0*fract(psi*4.5)-1.0),16.0)*exp(-u*u)*smoothstep(1.0,0.75,abs(p.y))*smoothstep(1.0,0.8,abs(p.z)); }',
      'float glowStep(vec3 p){ float r=length(p.yz); return (r<0.5&&abs(p.x)<1.3&&uA.z>0.01)?0.04:(uB.x>0.01&&abs(p.x+1.47)<0.12&&r<1.3)?0.012:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); float r=length(p.yz); float a=atan(p.z,p.y);',
      '  if(r>RO+0.01&&r<RH-0.03&&abs(p.x)<1.26){',                                         // the coil's changing magnetic field
      '    float bl=pow(0.5+0.5*sin(a*7.0),10.0)*smoothstep(1.26,1.0,abs(p.x));',
      '    g+=vec3(1.0,0.6,0.2)*bl*uA.z*0.5*(0.35+0.65*pow(0.5+0.5*sin(uC.y*TAU),2.0)); }',
      '  if(uB.x>0.0&&r>RO) g+=vec3(0.5,1.0,0.7)*bline(p)*uB.x*5.0;',
      '  if(r<RO+0.06&&abs(p.x)<HW) g+=vec3(0.2,0.9,1.0)*exp(-(r-RO)*70.0)*step(RO,r)*uA.w*0.22;',   // the wire once it is said to superconduct
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  vec3 w=p; w.y-=pluck(p.x); float r=length(w.yz); float hatch=hatchF(p);',
      '  bool sect=uCut>0.02&&(n.y>0.9||n.z>0.9||n.x>0.9)&&w.y>-0.003&&w.z>-0.003&&r<RO+0.002&&abs(w.x)<HW-0.01;',
      '  float edge=smoothstep(0.012,0.003,abs(r-RC));',                                     // the boundary between coating and core
      '  if(m<1.5){ alb=vec3(0.60,0.62,0.56); met=0.75; rgh=0.38; alb*=0.9+0.2*vnoise(w*vec3(8.0,60.0,60.0));',
      '    float pu=smoothstep(0.55,0.95,fract(w.x*0.55-uC.x)); emi=vec3(0.25,0.8,1.0)*pu*uA.x*(0.3+0.25*uA.w)+vec3(0.2,0.9,1.0)*uA.w*0.05;',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.25+vec3(0.2,0.95,1.0)*edge*(0.25+1.6*uA.w); } }',
      '  else if(m<2.5){ alb=vec3(0.90,0.91,0.90); rgh=0.55;',
      '    float pu=smoothstep(0.55,0.95,fract(w.x*0.55-uC.x));',
      '    if(sect) { alb=mix(vec3(0.82,0.88,0.95),vec3(0.66,0.74,0.86),hatch); emi=alb*0.14+vec3(0.2,0.95,1.0)*edge*(0.25+1.6*uA.w); }',
      '    else if(r>RC-0.004) emi=vec3(0.2,0.9,1.0)*uA.w*(0.12+0.35*pu); }',                 // the exposed core surface is the boundary itself
      '  else if(m<3.5){ float a=atan(p.z,p.y); float u=p.x/PT*TAU*0.2+a;',
      '    alb=vec3(0.95,0.55,0.26); met=1.0; rgh=0.3; emi=vec3(1.0,0.55,0.15)*uA.z*(0.15+0.85*smoothstep(0.5,0.95,fract(a/TAU+p.x*0.9-uC.y))); }',
      '  else if(m<4.5){ alb=vec3(1.0,0.74,0.34); met=1.0; rgh=0.3; emi=vec3(0.25,0.8,1.0)*uA.x*0.12; }',
      '  else if(m<5.5){ alb=p.y>0.3?vec3(0.75,0.3,0.12):vec3(0.1,0.25,0.45); rgh=0.5; emi=(p.y>0.3?vec3(1.0,0.5,0.15)*uA.z:vec3(0.2,0.7,1.0)*uA.x)*0.25; }',
      '  else { alb=vec3(0.13,0.14,0.17); met=0.6; rgh=0.45;',                               // the two pulsed current sources, each showing its waveform
      '    bool top=p.y>0.0; vec2 f=p.xy-vec2(0.0,top?1.0:-0.98); float lv=top?uA.z:uA.x; float ph=top?uC.y*3.0:uC.x*2.0;',
      '    float sq=sign(sin((f.x*(top?34.0:22.0))-ph*TAU))*0.05; float ln=smoothstep(0.014,0.004,abs(f.y-sq))*step(abs(f.x),0.19);',
      '    emi=(top?vec3(1.0,0.6,0.2):vec3(0.25,0.85,1.0))*ln*lv*step(0.12,p.z)*1.3; }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '100', name: 'Wire', at: [-1.2, 0.2, 0.13], text: 'A composite wire that the patent says becomes superconducting at room temperature when it is abruptly vibrated while a pulsed current runs through it.' },
      { n: '120', name: 'Coating', at: [-0.05, 0.154, 0.154], cut: true, text: 'Lead zirconate titanate (PZT) laid down by vacuum evaporation and then polarized, or aluminum. Its thickness is on the order of the London penetration depth: about a micron.' },
      { n: '110', name: 'Insulator core', at: [1.0, 0.1, 0.0], cut: true, text: 'Teflon or another flexible non-conducting polymer. No charge moves in the core; the patent expects the supercurrent along its boundary with the coating.' },
      { n: '200', name: 'Helical EM coil', at: [0.25, 0.42, 0.02], text: 'Wound round the wire and pulsed at a different frequency, to add a strong changing magnetic field and excite non-linear vibration. It can be made of the same wire.' },
      { n: 'V', name: 'Pulsed current source V(t)', at: [0.0, -0.98, 0.17], text: 'Drives the current through the wire. The patent stresses that the current must be pulsed for maximum effect.' },
      { n: 'V*', name: 'Pulsed current source V*(t)', at: [0.0, 1.0, 0.16], text: 'A second source for the coil, at its own frequency.' }
    ],
    steps: [
      { d: 4, label: 'Pulsed current', text: 'A pulsed current source V(t) drives current through the wire 100: a thin PZT or aluminum coating 120 on an insulating core 110.' },
      { d: 5, label: 'Vibration', text: 'The polarized PZT coating makes the wire vibrate abruptly, like plucking a guitar string again and again.' },
      { d: 5, label: 'Coil', text: 'The helical coil 200 is pulsed at a different frequency by its own source V*(t), adding a strong, changing magnetic field.' },
      { d: 7, label: 'Supercurrent', text: 'The patent claims a supercurrent then flows along the boundary between coating and core at room temperature, and that the wire pushes out an outside magnetic field (the Meissner effect).' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), cur = smooth(0.3, 2, tt) * k;
      return { A: [cur, smooth(4, 5.5, tt) * k, smooth(9, 11, tt) * k, smooth(15, 17, tt) * k],
               B: [smooth(14.2, 15.2, tt) * k, smooth(16.4, 18.6, tt) * k, 0], rate: [0.25 + cur * 0.9, 0.8, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [1, 1, 0], rate: [1.15, 0.8, 0, 0] }
  };
})();
