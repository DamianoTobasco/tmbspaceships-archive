/* Pais 3D scene 5 · High frequency gravitational wave generator (US 10,322,827 B2), FIG. 1 and 2:
 * a gas-filled shell 100 (charged outer surface 105 vibrated by microwave emitters 400) holding two
 * wedge-shaped acoustic resonant cavities 300 that counter-spin on parallel, offset axes, driven by
 * sound generators 200. Drawn as a shell of revolution about the spin axes, so the cavities clear it.
 * uA = (charge, first field, second field, gravitational waves)  uB.x = cavity spin  uC.x = spin angle */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes.hfgw = {
    title: 'High frequency gravitational wave generator',
    fig: 'After FIG. 1 and 2: the shell in half section, cavities turning inside',
    cam: { yaw: 0.36, pitch: 0.3, sway: 0.26, yawNarrow: 0.9 },
    fit: { hw: 1.85, hh: 1.2, hwNarrow: 1.7 },
    cutModes: [{ label: 'Half section', cut: 1, qt: 0 }, { label: 'Closed shell', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 14.0',
      '#define GLOWK 2.6',
      'const vec3 EL=vec3(1.6,1.0,1.6); const float TS=0.06; const float AX=0.07;',     // shell semi-axes, wall, axis offset
      'float cutD(vec3 p){ return p.z-mix(2.8,0.0,uCut); }',
      'float ell(vec3 p, vec3 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.0)/k1; }',
      'float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){',
      '  vec2 e0=p1-p0; vec2 e1=p2-p1; vec2 e2=p0-p2; vec2 v0=p-p0; vec2 v1=p-p1; vec2 v2=p-p2;',
      '  vec2 q0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.0,1.0); vec2 q1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.0,1.0); vec2 q2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.0,1.0);',
      '  float s=sign(e0.x*e2.y-e0.y*e2.x);',
      '  vec2 d=min(min(vec2(dot(q0,q0),s*(v0.x*e0.y-v0.y*e0.x)),vec2(dot(q1,q1),s*(v1.x*e1.y-v1.y*e1.x))),vec2(dot(q2,q2),s*(v2.x*e2.y-v2.y*e2.x)));',
      '  return -sqrt(d.x)*sign(d.y); }',
      // one wedge cavity in its own turning frame: q.x out from the spin axis, q.y up, q.z through the wedge
      // len and hgt make the two cavities incongruent, as the patent asks
      'float wedge(vec3 q, float len, float hgt){ float t=sdTri(q.xy,vec2(-0.06,0.24),vec2(len,0.24),vec2(-0.06,0.24+hgt));',
      '  vec2 w=vec2(t,abs(q.z)-0.12); return min(max(w.x,w.y),0.0)+length(max(w,0.0))-0.014; }',
      'float sgens(vec3 q, float len, float hgt){',                                        // sound generators 200 on two faces of a wedge
      '  float d=min(sdRBox(q-vec3(-0.105,0.24+hgt*0.3,0.0),vec3(0.035,0.04,0.055),0.008), sdRBox(q-vec3(-0.105,0.24+hgt*0.72,0.0),vec3(0.035,0.04,0.055),0.008));',
      '  float an=atan(hgt,len+0.06); vec3 h=q-vec3(-0.06,0.24+hgt,0.0); h.xy=rot(-an)*h.xy;',
      '  float L=length(vec2(len+0.06,hgt));',
      '  d=min(d,min(sdRBox(h-vec3(L*0.33,0.045,0.0),vec3(0.05,0.03,0.055),0.008), sdRBox(h-vec3(L*0.68,0.045,0.0),vec3(0.05,0.03,0.055),0.008)));',
      '  return d; }',
      'vec3 frameA(vec3 p){ vec3 q=p-vec3(AX,0.0,0.0); q.xz=rot(uC.x)*q.xz; return q; }',  // upper cavity
      'vec3 frameB(vec3 p){ vec3 q=vec3(-(p.x+AX),-p.y,p.z); q.xz=rot(uC.x+1.1)*q.xz; return q; }',   // lower cavity, turning the other way
      'float gE; float gW;',                                                              // shell and cavity distances at the point just mapped, reused by the glow
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float e=ell(p,EL); gE=e;',
      '  float vib=uA.y*0.0014*sin(atan(p.z,p.x)*26.0+uT*31.0)*sin(p.y*30.0-uT*21.0);',
      '  vec2 res=vec2(max(max(e-vib,-(e+TS)),cz),1.0);',                                   // gas-filled shell 100
      '  vec3 qa=frameA(p); vec3 qb=frameB(p);',
      '  float d=min(wedge(qa,0.98,0.36),wedge(qb,0.86,0.44)); gW=d; if(d<res.x) res=vec2(d,2.0);',   // acoustic resonant cavities 300
      '  if(d<0.2){ d=min(sgens(qa,0.98,0.36),sgens(qb,0.86,0.44)); if(d<res.x) res=vec2(d,3.0); }',
      // microwave emitters 400 in the rim
      '  vec3 m=vec3(abs(p.x)-1.565,p.y,p.z); d=(abs(m.x)+abs(m.y)+abs(m.z)-0.085)*0.577; if(d<res.x) res=vec2(d,4.0);',
      '  d=length(p)-0.13; if(d<res.x) res=vec2(d,5.0);',                                  // motor / power plant 800
      '  d=min(cylY(p-vec3(AX,0.185,0.0),0.022,0.065),cylY(p-vec3(-AX,-0.185,0.0),0.022,0.065)); if(d<res.x) res=vec2(d,5.0);',
      // support structure 600: twin rails from the hub to the rim, with the wiring 700 between them
      '  d=sdBox(vec3(abs(p.x)-0.83,abs(p.y)-0.036,p.z),vec3(0.71,0.011,0.05)); if(d<res.x) res=vec2(d,6.0);',
      '  d=max(length(p.yz)-0.012,abs(p.x)-1.54);',
      '  d=min(d,max(max(length(vec2(abs(e+0.085),p.z))-0.012,0.6-p.x),p.y+0.02)); if(d<res.x) res=vec2(d,7.0);',   // and down the wall to the source
      '  d=sdRBox(p-vec3(0.66,-0.745,0.0),vec3(0.2,0.055,0.16),0.012); if(d<res.x) res=vec2(d,8.0);',   // electrical source 500
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float e=gE; return (e>-0.02&&e<1.05&&(uA.y>0.01||uA.w>0.01))?0.04+0.17*max(e,0.0):(e<0.0&&uA.z>0.01)?0.09:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); if(cutD(p)>0.0) return g;',
      '  float e=gE; float az=atan(p.z,p.x);',
      '  if(e>0.0){',
      // first electromagnetic field, from the charged vibrating shell
      '    g+=vec3(0.5,0.42,1.0)*(exp(-e*24.0)*(0.4+0.6*vnoise(p*12.0+uT))*0.2+pow(0.5+0.5*sin(e*18.0-uT*8.0),12.0)*exp(-e*6.0)*0.1)*uA.y;',
      // gravitational waves: a quadrupole ripple leaving the machine
      '    g+=vec3(1.0,0.88,0.62)*pow(0.5+0.5*sin(e*10.0-uT*5.0+2.0*az),30.0)*exp(-e*1.9)*(0.3+0.7*abs(cos(az+uT*0.6)))*uA.w*0.3;',
      '  } else if(e<-TS){',
      // second field, from the ringing cavity walls; and the gas inside the shell
      '    float dw=gW;',
      '    g+=vec3(1.0,0.55,0.3)*pow(0.5+0.5*sin(dw*44.0-uT*10.0),12.0)*exp(-dw*7.0)*uA.z*0.2;',
      '    g+=vec3(0.3,0.25,0.6)*0.0015*(0.5+vnoise(p*5.0+vec3(0.0,uT*0.3,0.0)))*(0.4+uA.z);',
      '  }',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return ell(p,EL)<-TS*0.5 ? alb*(vec3(1.0,0.55,0.3)*uA.z*0.07+vec3(0.4,0.35,1.0)*uA.y*0.03) : vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&n.z>0.9; float hatch=hatchF(p); float e=ell(p,EL); float az=atan(p.z,p.x);',
      '  if(m<1.5){',
      '    if(e>-0.02){ alb=vec3(0.40,0.40,0.39)*(0.85+0.25*vnoise(p*46.0)); met=0.6; rgh=0.46;',   // outer shell surface 105: cermet
      '      float seam=max(smoothstep(0.006,0.0,abs(fract(az*2.5465)-0.5)/2.5465*length(p.xz)),smoothstep(0.006,0.0,abs(fract(p.y*3.0+0.5)-0.5)/3.0));',
      '      alb*=1.0-0.45*seam; float md=abs(sin(az*13.0)*sin(p.y*17.0)); emi=vec3(0.45,0.4,1.0)*md*md*uA.y*0.14*(0.6+0.4*sin(uT*29.0))+vec3(0.4,0.5,1.0)*uA.x*0.03; }',
      '    else { alb=vec3(0.30,0.32,0.38)*(0.8+0.3*smoothstep(0.012,0.004,abs(fract(az*3.8197)-0.5)/3.8197*length(p.xz))); met=0.5; rgh=0.55; }',   // inner shell surface 106
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ vec3 q=frameA(p); if(p.y<0.0) q=frameB(p);',                       // cavity surface 301: charged, ringing
      '    alb=vec3(0.50,0.42,0.30); met=1.0; rgh=0.32; float st=pow(0.5+0.5*sin((q.x*0.35+q.y)*60.0-uT*12.0),3.0);',
      '    emi=vec3(1.0,0.5,0.2)*st*uA.z*(0.05+0.09*sin(uT*27.0)*sin(uT*27.0))+vec3(0.5,0.55,1.0)*uA.x*0.03; alb*=1.0-0.3*smoothstep(0.006,0.0,abs(fract(q.x*4.0)-0.5)/4.0); }',
      '  else if(m<3.5){ alb=vec3(0.13,0.14,0.17); met=0.6; rgh=0.45; emi=vec3(0.3,0.8,1.0)*uA.z*0.5*(0.5+0.5*sin(uT*40.0)); }',
      '  else if(m<4.5){ alb=vec3(1.0,0.74,0.32); met=1.0; rgh=0.3; emi=vec3(1.0,0.5,0.1)*uA.y*(0.7+0.3*sin(uT*23.0)); }',
      '  else if(m<5.5){ alb=vec3(0.34,0.37,0.44); met=0.9; rgh=0.35; alb*=0.75+0.25*step(0.5,fract(p.y*22.0)); emi=vec3(0.2,0.7,1.0)*uB.x*0.25*step(0.5,fract(az*1.2732+uC.x)); }',
      '  else if(m<6.5){ alb=vec3(0.5,0.52,0.56); met=1.0; rgh=0.35; alb*=0.8+0.2*step(0.5,fract(p.x*14.0)); }',
      '  else if(m<7.5){ alb=vec3(0.2,0.22,0.26); rgh=0.5; emi=vec3(0.25,0.95,1.0)*uA.x*(0.35+0.65*pow(0.5+0.5*sin((abs(p.x)+abs(p.y))*26.0-uT*9.0),4.0)); }',   // room temperature superconducting wiring
      '  else { alb=vec3(0.16,0.17,0.2); met=0.7; rgh=0.45; vec2 f=p.xy-vec2(0.66,-0.745);',
      '    emi=vec3(1.0,0.8,0.25)*uA.x*smoothstep(0.012,0.004,abs(f.y-0.03*sign(sin(f.x*24.0))))*step(abs(f.x),0.13)*step(0.15,p.z); }',
      '}',
      // a faint grid of space behind the machine, shaken by the waves leaving it
      'vec3 bg(vec3 rd){ vec3 c=studioBg(rd,0.0,0.0); vec2 a=vec2(atan(rd.x,rd.z),asin(clamp(rd.y,-1.0,1.0)));',
      '  float l=length(a)+0.001; a+=a/l*uA.w*0.014*sin(l*30.0-uT*5.0);',
      '  vec2 f=abs(fract(a*9.0)-0.5); c+=vec3(0.14,0.24,0.5)*smoothstep(0.01,0.0,0.5-max(f.x,f.y))*(0.02+0.07*uA.w); return c; }'
    ].join('\n'),
    parts: [
      { n: '100', name: 'Gas-filled shell', at: [-0.78, 0.84, 0.0], cut: true, text: 'A shell of cermet (ceramic and metal) composite filled with gas. The patent suggests doping it with cobalt-57 or iron-57 so that its vibration also gives off gamma rays.' },
      { n: '105', name: 'Outer shell surface', at: [0.62, 0.85, -0.62], text: 'Electrically charged by the source 500 and vibrated by the microwave emitters, so that it gives off the first electromagnetic field.' },
      { n: '106', name: 'Inner shell surface', at: [-0.95, -0.45, -0.95], cut: true, text: 'The inside of the shell, facing the gas and the two cavities.' },
      { n: '300', name: 'Acoustic resonant cavities', at: [0.07, 0.61, 0.0], cut: true, text: 'Two gas-filled cavities shaped as “incongruent wedges”, deliberately asymmetric. They spin in opposite directions on parallel, offset axes. Helium, neon, argon or xenon inside turns to plasma.' },
      { n: '301', name: 'Cavity surface', at: [-0.4, -0.3, 0.0], cut: true, text: 'Each cavity has at least one electrically charged surface. Sound makes it vibrate, and the vibrating charge gives off the second electromagnetic field.' },
      { n: '200', name: 'Sound generators', at: [-0.03, 0.42, 0.0], cut: true, text: 'At least one per cavity, set where they make it resonate.' },
      { n: '400', name: 'Microwave emitters', at: [1.58, 0.06, 0.0], text: 'In the shell. They pulse at 300 MHz to 300 GHz to shake the charged outer surface.' },
      { n: '500', name: 'Electrical source', at: [0.66, -0.69, 0.16], cut: true, text: 'Charges the shell and cavity surfaces and powers the emitters, the sound generators and the motor.' },
      { n: '600', name: 'Support structure', at: [-0.85, 0.05, 0.05], cut: true, text: 'Mounts everything and carries the two counter-spinning cavities.' },
      { n: '700', name: 'Wiring', at: [1.22, -0.5, 0.0], cut: true, text: 'The patent’s preferred wiring is its own room temperature superconductor, so that power moves through the machine without heating it.' },
      { n: '800', name: 'Motor / power plant', at: [0.0, 0.0, 0.13], cut: true, text: 'Turns the two cavities against each other, which the patent says keeps the machine stable.' }
    ],
    steps: [
      { d: 4, label: 'Charging', text: 'The source 500 charges the outer shell surface 105 and the cavity surfaces 301 through the wiring 700.' },
      { d: 5, label: 'First field', text: 'Microwave emitters 400 make the charged shell vibrate. It gives off the first electromagnetic field.' },
      { d: 6, label: 'Second field', text: 'Sound generators 200 set the gas-filled wedge cavities 300 ringing while the motor 800 spins them against each other. Their charged walls give off a second field.' },
      { d: 6, label: 'Gravity waves', text: 'Where the second field travels through the first, the patent says high-frequency gravitational waves are generated.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), spin = smooth(9, 13, tt) * k;
      return { A: [smooth(0.3, 2.5, tt) * k, smooth(4, 6.5, tt) * k, smooth(9.5, 12.5, tt) * k, smooth(15, 18, tt) * k], B: [spin, 0, 0], rate: [spin * 1.5, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [1, 0, 0], rate: [1.5, 0, 0, 0] }
  };
})();
