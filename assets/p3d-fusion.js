/* Pais 3D scene 4 · Plasma compression fusion device (US 2019/0295733 A1), FIG. 1:
 * the cross-duct configuration. Two pairs of opposed, counter-spinning cones (dynamic fusors 200)
 * point at the centre of a hollow cross-duct 100; fuel gas runs down their hollow shafts 220 and
 * out of orifices 205 into the vacuum chamber 110, where the plasma core 75 forms.
 * uA = (gas feed, spin, plasma, burn)  uB = (wall charge + vibration, energy gain)  uC = (spin angle, gas flow) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes.fusion = {
    title: 'Plasma compression fusion device',
    fig: 'After FIG. 1: the cross-duct configuration, with the fusor internals of FIG. 3',
    cam: { yaw: 0.5, pitch: 0.34, sway: 0.3, yawNarrow: 0.5 },
    fit: { hw: 2.25, hh: 2.2, hwNarrow: 2.05 },
    cutModes: [{ label: 'Duct opened', cut: 1, qt: 1 }, { label: 'Full section', cut: 1, qt: 0 }, { label: 'Closed duct', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 15.0',
      '#define GLOWK 2.3',
      'const float W=0.44; const float LD=1.14; const float TD=0.035;',                      // duct half-width, half-length, wall
      'const float CA=0.30; const float CB=1.02; const float CR=0.37; const float SL=0.4444;', // cone apex, base, base radius, slope
      'float cutDuct(vec3 p){ return p.z-mix(2.6,0.0,uCut); }',
      'float cutCone(vec3 p){ return p.z-mix(2.6,0.0,uCut*(1.0-uB.w)); }',
      // fold any point onto one arm: x = distance along the arm, yz = across it. s = that cone's spin direction
      'vec3 arm(vec3 p, out float s){',
      '  if(abs(p.x)>abs(p.y)){ s=p.x>0.0?1.0:-1.0; return vec3(abs(p.x),p.y,p.z); }',
      '  s=p.y>0.0?-1.0:1.0; return vec3(abs(p.y),p.x,p.z); }',
      'float coneR(float x){ return 0.05+(x-CA)*SL; }',
      'float ductO(vec3 p){ return min(sdBox(p,vec3(LD,W,W)),sdBox(p,vec3(W,LD,W)))-0.012; }',
      'float ductI(vec3 p){ return min(sdBox(p,vec3(LD-TD,W-TD,W-TD)),sdBox(p,vec3(W-TD,LD-TD,W-TD))); }',
      'vec2 map(vec3 p){',
      '  float s; vec3 a=arm(p,s); float rr=length(a.yz); float cd=cutDuct(p); float cc=cutCone(p);',
      '  float d=max(max(ductO(p),-ductI(p)),-(rr-0.225));',                               // hollow cross-duct 100
      '  vec2 res=vec2(max(d,cd),1.0);',
      '  d=max(max(abs(rr-0.25)-0.035,abs(a.x-LD-0.03)-0.03),cc); if(d<res.x) res=vec2(d,6.0);',   // collar where each shaft leaves the duct
      // dynamic fusor 200: a hollow cone with a smoothly curved apex 201
      '  float cone=sdCone2(vec2(a.x-0.5*(CA+CB),rr),0.5*(CB-CA)-0.03,0.02,CR-0.03)-0.03;',
      '  float sh=max(cone,-(cone+0.03));',
      '  float ph=atan(a.z,a.y)-s*uC.x; float sc=1.0471976; float pa=mod(ph+0.5*sc,sc)-0.5*sc;',
      '  vec3 h=vec3(a.x-(CA+0.17),rr*cos(pa)-coneR(CA+0.17),rr*sin(pa));',
      '  sh=max(sh,-(length(h)-0.032));',                                                   // orifices 205 near the apex
      '  d=max(sh,cc); if(d<res.x) res=vec2(d,2.0);',
      // inside each cone: electrified grids 202 with a toroidal magnetic coil 203 between them
      '  float g=1e3;',
      '  g=min(g,max(abs(a.x-(CA+0.30))-0.006,rr-(coneR(CA+0.30)-0.034)));',
      '  g=min(g,max(abs(a.x-(CA+0.45))-0.006,rr-(coneR(CA+0.45)-0.034)));',
      '  g=min(g,max(abs(a.x-(CA+0.63))-0.006,rr-(coneR(CA+0.63)-0.034)));',
      '  d=max(g,cc); if(d<res.x) res=vec2(d,3.0);',
      '  d=max(length(vec2(a.x-(CA+0.54),rr-0.165))-0.037,cc); if(d<res.x) res=vec2(d,4.0);',
      // hollow shaft 220: carries the fuel gas and turns the cone
      '  d=max(max(abs(rr-0.165)-0.045,abs(a.x-1.37)-0.36),cc); if(d<res.x) res=vec2(d,5.0);',
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float o=ductO(p); return (o<0.02&&(uA.x>0.01))?0.045:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); if(cutDuct(p)>0.0||ductI(p)>0.0) return g;',
      '  float s; vec3 a=arm(p,s); float rr=length(a.yz); float r=length(p);',
      '  float cone=sdCone2(vec2(a.x-0.5*(CA+CB),rr),0.5*(CB-CA)-0.03,0.02,CR-0.03)-0.03;',
      '  if(cone<0.0) return g;',
      '  float ph=atan(a.z,a.y)-s*uC.x;',
      // fuel gas sprayed from the orifices, drawn toward the centre
      '  float wj=0.05+0.34*a.x; float jet=exp(-rr*rr/(wj*wj))*smoothstep(CA+0.3,CA-0.05,a.x);',
      '  float flow=0.55+0.45*sin(a.x*34.0+uC.y*9.0+sin(ph*3.0));',
      '  g+=vec3(0.35,0.6,1.0)*jet*flow*uA.x*0.28*(1.0-0.7*uA.z);',
      // concentrated magnetic flux from each spinning cone, pointing at the core
      '  float fl=pow(0.5+0.5*sin(ph*4.0+a.x*22.0-uT*6.0),5.0)*exp(-rr*rr/(0.006+0.16*a.x*a.x))*smoothstep(CA+0.2,0.05,a.x);',
      '  g+=vec3(0.15,1.0,0.7)*fl*uA.y*uA.z*3.2;',
      // plasma core 75: squeezed smaller and hotter as the flux builds
      '  float rc=mix(0.34,0.19,uA.z)*(1.0+0.03*sin(uT*9.0)); float n=vnoise(vec3(rot(uT*1.4)*p.xy,p.z)*9.0+uT);',
      '  float core=smoothstep(rc,rc*0.55,r*(0.9+0.2*n));',
      '  g+=mix(vec3(0.8,0.08,0.95),vec3(1.0,0.8,0.6),smoothstep(rc*0.9,rc*0.25,r))*core*(uA.z*(5.0+5.0*uA.w)+uB.y*4.0)*(0.7+0.5*n);',
      '  g+=vec3(1.0,0.3,0.75)*exp(-r*r*16.0)*(uA.z*0.2+uA.w*0.3);',
      // the charged, vibrating duct wall 115 holds the plasma off
      '  g+=vec3(0.55,0.4,1.0)*exp(ductI(p)*34.0)*(0.4+0.6*vnoise(p*16.0+vec3(0.0,0.0,uT*3.0)))*uB.x*0.3;',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ if(ductO(p)>0.0) return alb*vec3(1.0,0.5,0.2)*uB.y*0.25*smoothstep(0.2,0.0,ductO(p));',
      '  return alb*vec3(1.0,0.5,0.85)*(uA.z*0.22+uA.w*0.3)/(1.0+5.0*dot(p,p)); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  float s; vec3 a=arm(p,s); float rr=length(a.yz); float ph=atan(a.z,a.y)-s*uC.x;',
      '  bool sd=uCut>0.02&&abs(cutDuct(p))<0.004&&n.z>0.9; bool sc=uCut>0.02&&abs(cutCone(p))<0.004&&n.z>0.9;',
      '  float hatch=hatchF(p);',
      '  if(m<1.5){',
      '    if(ductI(p)>-0.012){ alb=vec3(0.62,0.64,0.70); met=1.0; rgh=0.3;',                // inner surface 115: charged liner with PZT film
      '      alb=vec3(0.42,0.44,0.5)*(0.9+0.1*step(0.5,fract(a.x*9.0))); rgh=0.42; emi=vec3(0.5,0.38,1.0)*uB.x*0.1*(0.5+0.5*sin(a.x*60.0+uT*31.0)); }',
      '    else { alb=vec3(0.15,0.16,0.19); met=0.45; rgh=0.6;',                              // outer surface 116: shielding
      '      float rib=smoothstep(0.02,0.012,abs(fract(a.x*5.0+0.5)-0.5)/5.0); alb*=1.0+0.5*rib; rgh-=0.15*rib; emi=vec3(1.0,0.35,0.1)*uB.y*0.1; }',
      '    if(sd){ alb=mix(vec3(0.72,0.74,0.78),vec3(0.46,0.48,0.54),hatch); met=0.0; rgh=0.85; emi=alb*0.2; } }',
      '  else if(m<2.5){ float cone=sdCone2(vec2(a.x-0.5*(CA+CB),rr),0.5*(CB-CA)-0.03,0.02,CR-0.03)-0.03;',
      '    if(cone>-0.012){ alb=vec3(0.34,0.30,0.26); met=1.0; rgh=0.36;',                   // charged outer surface 210, tungsten alloy
      '      float st=smoothstep(0.2,0.1,abs(fract(ph*0.4775+a.x*1.6)-0.5)); alb=mix(alb,vec3(0.95,0.72,0.34),st*0.55);',
      '      emi=vec3(0.45,0.5,1.0)*uA.y*0.07*vnoise(vec3(a.x*30.0,ph*6.0,uT*2.0))+vec3(1.0,0.5,0.3)*uA.w*0.12*smoothstep(CA+0.3,CA,a.x); }',
      '    else { alb=vec3(0.78,0.8,0.78); rgh=0.6; }',                                      // insulating liner
      '    if(sc){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<3.5){ vec2 f=abs(fract(a.yz*26.0)-0.5); float mesh=step(0.34,max(f.x,f.y));',   // electrified grids
      '    alb=mix(vec3(0.12,0.1,0.06),vec3(1.0,0.78,0.35),mesh); met=mesh; rgh=0.35; emi=vec3(0.4,0.7,1.0)*mesh*(0.1+0.6*uA.w*(0.6+0.4*sin(uT*21.0+a.x*40.0))); }',
      '  else if(m<4.5){ float w=step(0.5,fract(atan(rr-0.165,a.x-(CA+0.54))*4.0+ph*9.0));',   // toroidal coil windings
      '    alb=mix(vec3(0.95,0.52,0.24),vec3(0.6,0.3,0.12),w); met=1.0; rgh=0.35; emi=vec3(0.2,1.0,0.75)*uA.y*0.12; }',
      '  else if(m<5.5){ alb=vec3(0.56,0.58,0.62); met=1.0; rgh=0.3;',
      '    float st=smoothstep(0.16,0.1,abs(fract(ph*0.3183+a.x*2.2)-0.5)); alb=mix(alb,vec3(0.2,0.22,0.26),st*0.7);',
      '    if(rr<0.13) { alb=vec3(0.3,0.5,0.9); met=0.0; emi=vec3(0.3,0.55,1.0)*uA.x*0.35; }',
      '    if(sc){ alb=mix(vec3(0.75,0.77,0.8),vec3(0.5,0.52,0.56),hatch); met=0.0; rgh=0.85; emi=alb*0.18; } }',
      '  else { alb=vec3(0.36,0.38,0.42); met=1.0; rgh=0.32; alb*=0.75+0.25*step(0.5,fract(atan(a.z,a.y)*1.9099));',
      '    if(sc){ alb=mix(vec3(0.75,0.77,0.8),vec3(0.5,0.52,0.56),hatch); met=0.0; rgh=0.85; emi=alb*0.18; } }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '100', name: 'Hollow cross-duct', at: [0.82, 0.45, -0.2], text: 'The cross-shaped housing. The patent suggests 10–15 cm of boron carbide or tungsten alloy shielding around it, doubling as a Faraday cage and carrying the cooling channels.' },
      { n: '110', name: 'Vacuum chamber', at: [0.3, -0.3, -0.2], cut: true, text: 'The space inside the duct, pumped down to about a hundred-thousandth of a torr before the fuel goes in.' },
      { n: '115', name: 'Inner surface', at: [-0.7, 0.18, -0.405], cut: true, text: 'Electrically charged and vibrated by embedded PZT films, to keep plasma particles from hitting the wall and quenching the plasma.' },
      { n: '116', name: 'Outer surface', at: [-0.82, 0.45, -0.2], text: 'Heat exchangers flush with this wall would carry the fusion heat to a thermoelectric generator.' },
      { n: '200', name: 'Dynamic fusors', at: [0.75, 0.18, 0.18], cut: true, text: 'Counter-spinning conical structures of a high-capacitance tungsten alloy. Each spins the opposite way to the one facing it, so the magnetic flux always points at the core.' },
      { n: '201', name: 'Curved apex', at: [-0.32, 0.03, 0.04], cut: true, text: 'Each cone has a smoothly curved head pointing at the centre.' },
      { n: '205', name: 'Orifices', at: [0.09, 0.47, 0.09], cut: true, text: 'Openings near the apex through which the fuel gas, preferably deuterium, is injected into the chamber.' },
      { n: '210', name: 'Charged outer surface', at: [0.19, -0.8, 0.19], cut: true, text: 'The outside of each cone is electrically charged. The patent says accelerating its spin produces magnetic fields that could exceed anything a superconducting magnet can make.' },
      { n: '220', name: 'Hollow shafts', at: [1.45, 0.16, 0.13], text: 'Turn the cones and pressure-feed the fuel gas into them from a reservoir.' },
      { n: '202', name: 'Electrified grids', at: [0.14, 0.75, 0.0], cut: 'full', text: 'Assemblies of grids inside each cone, held at opposite voltages. They ionize the gas and fire electrons into the core, as an ion thruster does.' },
      { n: '203', name: 'Toroidal magnetic coil', at: [0.165, 0.84, 0.0], cut: 'full', text: 'Sits between two grids. Electrons follow its field lines out of the cone and into the core.' },
      { n: '75', name: 'Plasma core', at: [0.0, 0.0, 0.0], cut: true, text: 'A roughly spherical ball of electrons and ions held between the cones. Compressed and heated here until, the patent claims, it ignites and gives more energy than it takes.' }
    ],
    steps: [
      { d: 4, label: 'Fuel in', text: 'The chamber 110 is pumped down to vacuum. Deuterium gas runs down the hollow shafts 220 and out of the orifices 205 in each cone.' },
      { d: 5, label: 'Spin up', text: 'The charged cones 200 spin up, each one opposite to the cone facing it, faster and faster.' },
      { d: 5, label: 'Compression', text: 'The patent says their accelerating spin makes a concentrated magnetic flux that squeezes the gas into a plasma core 75, and radiation that heats it.' },
      { d: 5, label: 'Fusion', text: 'Grids 202 fire electrons into the core to make a deep potential well; ions circle through it and fuse. The charged, vibrating wall 115 keeps the plasma off the duct.' },
      { d: 4, label: 'Energy gain', text: 'With more fuel fed in, the patent claims a net energy gain, with the heat carried off through the outer wall 116.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), spin = smooth(4, 9, tt) * k;
      return { A: [smooth(0.3, 2, tt) * k, spin, smooth(9, 12, tt) * k, smooth(14, 17, tt) * k], B: [smooth(14, 16, tt) * k, smooth(19, 21, tt) * k, 0], rate: [spin * 4.5, 1, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [1, 1, 0], rate: [4.5, 1, 0, 0] }
  };
})();
