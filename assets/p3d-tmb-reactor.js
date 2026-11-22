/* TMB 3D scene · Fusion drive: the archive's own stylised aneutronic direct-fusion drive
 * (the fifth header exhibit, drawn in 2D by reactor.js). A field-reversed configuration (FRC)
 * plasmoid sits in a magnetic-mirror chamber; open flux surfaces wrap it and spread through a
 * magnetic nozzle; p + 11B -> 3 4He, and the alphas stream out as exhaust over shock diamonds.
 * uA = (coils, field lines, plasmoid, exhaust) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes['tmb-reactor'] = {
    title: 'Aneutronic fusion drive',
    fig: 'A stylised direct-fusion drive, the archive’s own illustration',
    from: 'the archive’s fusion drive illustration',
    partsNote: 'this model’s own labels',
    claim: 'An illustration of the idea, not a drawing from the archive.',
    cam: { yaw: 0.42, pitch: 0.24, sway: 0.28, yawNarrow: 1.0 },
    fit: { hw: 2.7, hh: 1.3, hwNarrow: 1.7 },
    cutModes: [{ label: 'Half section', cut: 1, qt: 0 }, { label: 'Closed', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 17.0',
      '#define GLOWK 2.5',
      'float cutD(vec3 p){ return p.z-mix(3.0,0.0,uCut); }',
      // inside radius of the vessel along its length: chamber, mirror throat, then the nozzle bell
      'float wall(float x){ return x<-1.55 ? 0.62*sqrt(max(1.0-(x+1.55)*(x+1.55)/0.1225,0.0)) : x<0.3 ? 0.62 : x<0.75 ? mix(0.62,0.3,smoothstep(0.3,0.75,x)) : 0.3+0.52*smoothstep(0.75,1.8,x); }',
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float r=length(p.yz);',
      '  float d=max(max(abs(r-wall(p.x)-0.02)*0.6-0.012,p.x-1.8),-p.x-1.93); vec2 res=vec2(max(d,cz),1.0);',   // vessel and nozzle
      // mirror coils at each end of the chamber, lighter coils between them, two more shaping the nozzle
      '  d=min(sdTorus2(vec2(p.x+1.4,r),0.78,0.1),sdTorus2(vec2(p.x-0.18,r),0.78,0.1));',
      '  d=min(d,min(sdTorus2(vec2(p.x+0.87,r),0.76,0.06),sdTorus2(vec2(p.x+0.35,r),0.76,0.06)));',
      '  d=min(d,min(sdTorus2(vec2(p.x-0.78,r),0.46,0.07),sdTorus2(vec2(p.x-1.35,r),0.78,0.07))); if(d<res.x) res=vec2(d,2.0);',
      // neutral beam injectors, top and bottom
      '  vec3 q=vec3(p.x+0.62,abs(p.y)-1.0,p.z);',
      '  d=min(cylY(q,0.1,0.36),sdRBox(q-vec3(0.0,0.42,0.0),vec3(0.17,0.12,0.17),0.02)); d=max(d,-(r-0.63)); if(d<res.x) res=vec2(d,3.0);',
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float r=length(p.yz); return (r<wall(clamp(p.x,-1.9,1.8))+0.25&&p.x>-2.0&&p.x<3.4&&uA.x>0.01)?0.045:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); if(cutD(p)>0.0) return g;',
      '  float r=length(p.yz); float x=p.x; float w=wall(clamp(x,-1.9,1.8)); float ang=atan(p.z,p.y);',
      '  if(x<1.8&&r<w){',
      // open flux surfaces: they follow the wall, pinch at the mirror throat and spread in the nozzle
      '    float fl=pow(0.5+0.5*cos(r/w*22.0),24.0)*smoothstep(0.25,0.4,r/w+0.2*step(0.3,x));',
      '    g+=vec3(0.3,0.75,1.0)*fl*uA.y*0.3;',
      // the plasmoid: closed field lines circulating inside the separatrix
      '    vec3 c=vec3((x+0.62)/0.62,p.y/0.36,p.z/0.36); float e=length(c);',
      '    float ring=pow(0.5+0.5*cos(e*26.0-uT*2.0),10.0);',
      '    g+=mix(vec3(0.95,0.3,0.75),vec3(1.0,0.92,0.8),smoothstep(0.9,0.2,e))*smoothstep(1.0,0.55,e)*(0.7+0.5*ring)*uA.z*(2.6+0.4*sin(uT*7.0));',
      '    g+=vec3(0.4,0.9,1.0)*exp(-(e-1.0)*(e-1.0)*160.0)*uA.z*0.5;',                              // the separatrix
      // fusion events: brief flashes inside it
      '    float h=vnoise(p*13.0+vec3(uT*5.0,-uT*3.0,uT*4.0));',
      '    g+=vec3(1.0,0.75,0.9)*pow(h,14.0)*step(e,0.9)*uA.z*26.0;',
      // neutral beams
      '    g+=vec3(0.5,1.0,0.6)*exp(-((x+0.62)*(x+0.62)+p.z*p.z)*60.0)*step(0.25,abs(p.y))*uA.z*0.5*(0.6+0.4*sin(abs(p.y)*30.0+uT*20.0));',
      '  }',
      // exhaust: alphas streaming through the throat and out, over standing shock diamonds
      '  if(x>0.2){ float we=x<1.8 ? w*0.75 : 0.62+0.1*(x-1.8); float dia=0.55+0.45*cos((x-0.75)*7.0);',
      '    float core=exp(-r*r/(we*we*(0.12+0.2*dia)));',
      '    g+=mix(vec3(1.0,0.35,0.75),vec3(1.0,0.85,0.9),core)*core*(0.5+0.8*dia)*smoothstep(0.2,0.75,x)*smoothstep(3.3,1.6,x)*uA.w*0.8;',
      '    g+=vec3(1.0,0.45,0.8)*pow(vnoise(vec3(x*5.0-uT*11.0,p.y*16.0,p.z*16.0)),9.0)*exp(-r*r/(we*we))*smoothstep(3.3,2.0,x)*uA.w*9.0; }',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ vec3 v=p-vec3(-0.62,0.0,0.0); return alb*vec3(1.0,0.5,0.8)*uA.z*0.5/(1.0+3.0*dot(v,v)); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0); float r=length(p.yz); float ang=atan(p.z,p.y);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&n.z>0.9; float hatch=hatchF(p);',
      '  if(m<1.5){ if(r>wall(clamp(p.x,-1.9,1.8))+0.018){ alb=vec3(0.5,0.53,0.58); met=1.0; rgh=0.34; alb*=1.0-0.4*smoothstep(0.006,0.0,abs(fract(p.x*2.5+0.5)-0.5)/2.5); }',
      '    else { alb=vec3(0.26,0.27,0.32); met=0.7; rgh=0.5; if(p.x>0.75) emi=vec3(1.0,0.4,0.6)*uA.w*0.12; }',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ float k=p.x<-1.1?0.0:p.x<-0.6?1.0:p.x<-0.1?2.0:p.x<0.5?3.0:p.x<1.0?4.0:5.0; float on=smoothstep(k*0.15,k*0.15+0.2,uA.x);',   // energised one by one
      '    alb=mix(vec3(0.85,0.5,0.24),vec3(0.66,0.36,0.16),step(0.5,fract(ang*28.0))); met=1.0; rgh=0.34;',
      '    emi=vec3(0.3,0.75,1.0)*on*(0.05+0.2*smoothstep(0.8,1.0,fract(ang*0.1592*3.0-uT*0.6+k*0.3))); }',
      '  else { alb=vec3(0.2,0.22,0.27); met=0.7; rgh=0.42; emi=vec3(0.5,1.0,0.6)*uA.z*0.25*step(0.5,fract(abs(p.y)*8.0+uT*5.0))*step(abs(p.y),1.3); }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '1', name: 'Mirror coils', at: [-1.4, 0.88, 0.0], text: 'A strong coil at each end of the chamber. Together they make a magnetic mirror that reflects the plasma back toward the middle.' },
      { n: '2', name: 'Chamber', at: [-0.1, 0.64, -0.1], text: 'The vacuum vessel. The open field lines run along its walls.' },
      { n: '3', name: 'FRC plasmoid', at: [-0.62, 0.0, 0.0], cut: true, text: 'A field-reversed configuration: a self-contained plasmoid held on closed field lines inside its separatrix. Protons and boron-11 circulate in it and fuse.' },
      { n: '4', name: 'Neutral beam injectors', at: [-0.62, 1.42, 0.17], text: 'Fire fast neutral atoms into the plasmoid to heat and fuel it.' },
      { n: '5', name: 'Open flux surfaces', at: [-0.1, 0.42, 0.0], cut: true, text: 'Field lines outside the separatrix. They wrap the plasmoid, pinch at the mirror throat and spread through the nozzle.' },
      { n: '6', name: 'Magnetic nozzle', at: [1.35, 0.72, -0.05], text: 'The field spreads here. Charged particles follow it out, turning their heat into directed thrust.' },
      { n: '7', name: 'Exhaust', at: [2.4, 0.1, 0.0], text: 'p + ¹¹B → 3 ⁴He + 8.7 MeV. The three alpha particles escape the separatrix and stream out the nozzle, over standing shock diamonds.' }
    ],
    steps: [
      { d: 5, label: 'Coils', text: 'The coils energise one by one.' },
      { d: 4, label: 'Field lines', text: 'The magnetic field sweeps in: a mirror at each end of the chamber, spreading into the nozzle.' },
      { d: 6, label: 'Plasmoid', text: 'Neutral beams fire and the plasmoid lights. Protons and boron-11 circulate on its closed field lines: p + ¹¹B → 3 ⁴He + 8.7 MeV.' },
      { d: 6, label: 'Exhaust', text: 'The nozzle opens. Alpha particles escape the separatrix and stream out as exhaust, over standing shock diamonds.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt);
      return { A: [smooth(0.3, 4.5, tt) * k, smooth(5, 7.5, tt) * k, smooth(9, 11.5, tt) * k, smooth(15, 17.5, tt) * k], B: [0, 0, 0], rate: [0, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [0, 0, 0], rate: [0, 0, 0, 0] }
  };
})();
