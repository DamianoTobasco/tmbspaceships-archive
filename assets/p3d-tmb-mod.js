/* TMB 3D scene · Low frequency plasma modulator for open air combustion (drawing TMB-1474,
 * archive shot 1474). Built from the notes on the drawing: cold gas is drawn through the hole in a
 * stamped steel diaphragm, past a thorium coated heated antenna fed with 60 GHz; the diaphragm
 * strokes below 70 Hz and each stroke sends a compression front out through the electron rich,
 * ion-electron and ion rich zones. Support pillars carry the permanent magnets and the feed.
 * uA = (gas feed, antenna, diaphragm stroke, zones) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes['tmb-mod'] = {
    title: 'Low frequency plasma modulator',
    fig: 'After drawing TMB-1474 (shot 1474)',
    from: 'the notes on the original drawing',
    partsNote: 'named as on the drawing',
    claim: 'Shown working the way the drawing’s notes describe it. The drawing itself adds: “no disclosure · you’re on your own”.',
    cam: { yaw: -0.5, pitch: 0.26, sway: 0.3, yawNarrow: -1.0 },
    fit: { hw: 2.6, hh: 1.3, hwNarrow: 1.7 },
    cutModes: [{ label: 'Plume in section', cut: 1, qt: 0 }, { label: 'Whole plume', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 16.0',
      '#define GLOWK 2.4',
      'const float RD=0.95; const float RH=0.13;',                                          // diaphragm radius, the hole in it
      'float cutD(vec3 p){ return p.z-mix(3.0,0.0,uCut); }',
      'float strokeX(){ return 0.05*uA.z*sin(uT*3.6); }',
      'vec2 map(vec3 p){',
      '  float r=length(p.yz); float xs=strokeX();',
      // the modulation diaphragm: a dished steel disc with a hole, in a fixed rim
      '  float d=max(max(abs(p.x-xs-0.07*(1.0-r/RD))-0.014,r-RD),-(r-RH)); vec2 res=vec2(d,1.0);',
      '  d=sdTorus2(vec2(p.x,r),RD+0.03,0.04); if(d<res.x) res=vec2(d,2.0);',
      '  d=max(abs(r-0.33)-0.012,abs(p.x-xs-0.16)-0.11); if(d<res.x) res=vec2(d,3.0);',     // the coil that drives it
      // heated antenna through the hole; insulated feed with water cooling behind it
      '  d=cylX(p-vec3(-0.42,0.0,0.0),0.032,0.5)-0.004; if(d<res.x) res=vec2(d,4.0);',
      '  d=cylX(p-vec3(1.0,0.0,0.0),0.075,1.0); if(d<res.x) res=vec2(d,5.0);',
      '  d=min(cylX(p-vec3(1.2,0.0,0.0),0.115,0.78),cylY(p-vec3(1.7,0.26,0.0),0.035,0.2)); if(d<res.x) res=vec2(d,6.0);',
      // support pillars above and below, each with four permanent magnets
      '  vec3 q=vec3(p.x-1.1,abs(p.y)-0.58,p.z);',
      '  d=min(sdRBox(q,vec3(0.86,0.2,0.26),0.02),sdRBox(p-vec3(2.0,0.0,0.0),vec3(0.05,0.8,0.3),0.02)); if(d<res.x) res=vec2(d,7.0);',
      '  vec3 mg=vec3(abs(q.x+0.5)-0.17,abs(q.y)-0.095,q.z);',
      '  d=cylZ(mg,0.075,0.285); if(d<res.x) res=vec2(d,8.0);',
      '  return res;',
      '}',
      // the three zones in front of the diaphragm: nested teardrops along the antenna
      'float zone(vec3 p, float c, float a, float b){ float s=-p.x; float w=b*(0.55+0.45*smoothstep(c+a,c-a,s)); return length(vec2((s-c)/a,length(p.yz)/w)); }',
      'float glowStep(vec3 p){ return (p.x<0.3&&p.x>-2.7&&length(p.yz)<1.0&&(uA.x+uA.y>0.01))?0.04:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); float r=length(p.yz);',
      '  if(p.x>0.0){ if(r<RH+0.03&&p.x<0.6) g+=vec3(0.35,0.6,1.0)*uA.x*0.3*(0.5+0.5*sin(p.x*40.0+uT*9.0)); return g; }',   // cold gas coming through the hole
      '  if(cutD(p)>0.0) return g;',
      '  float e=zone(p,0.5,0.62,0.2); float m=zone(p,0.78,0.95,0.42); float o=zone(p,1.05,1.4,0.7);',
      '  float rho=length(p-vec3(0.0,0.0,0.0)); float front=pow(0.5+0.5*sin(rho*8.0-uT*3.6),10.0)*uA.z;',                   // a compression front for every stroke
      '  g+=vec3(0.35,0.6,1.0)*exp(-r*r*40.0)*smoothstep(-0.6,0.0,p.x)*uA.x*0.2*(1.0-uA.y);',
      '  g+=vec3(1.0,0.84,0.4)*(smoothstep(1.0,0.5,e)*1.1+exp(-(e-1.0)*(e-1.0)*90.0)*0.8)*uA.y*(0.8+0.4*front);',          // electron rich
      '  g+=vec3(0.85,0.4,0.95)*(smoothstep(1.0,0.6,m)*0.14+exp(-(m-1.0)*(m-1.0)*120.0)*0.7)*uA.w*(0.7+0.7*front);',       // ion-electron mix
      '  g+=vec3(0.3,0.55,1.0)*(smoothstep(1.0,0.7,o)*0.05+exp(-(o-1.0)*(o-1.0)*160.0)*0.65)*uA.w*(0.7+0.7*front);',       // ion rich
      '  g+=vec3(0.7,0.8,1.0)*front*smoothstep(1.05,0.9,o)*0.1;',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return p.x<0.1 ? alb*vec3(1.0,0.75,0.4)*uA.y*0.35/(1.0+2.0*dot(p,p)) : vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0); float r=length(p.yz); float ang=atan(p.z,p.y);',
      '  if(m<1.5){ alb=vec3(0.36,0.39,0.46)*(0.8+0.2*step(0.5,fract(r*9.0))); met=1.0; rgh=0.3; }',
      '  else if(m<2.5){ alb=vec3(0.09,0.09,0.1); rgh=0.7; }',
      '  else if(m<3.5){ alb=mix(vec3(0.95,0.52,0.24),vec3(0.62,0.3,0.12),step(0.5,fract(p.x*60.0))); met=1.0; rgh=0.32; emi=vec3(1.0,0.6,0.2)*uA.z*0.18; }',
      '  else if(m<4.5){ float hot=uA.y; alb=mix(vec3(0.55,0.5,0.5),vec3(0.2),hot); met=1.0-hot; rgh=0.4;',
      '    emi=mix(vec3(1.0,0.3,0.25),vec3(1.0,0.75,0.6),smoothstep(-0.1,-0.9,p.x))*hot*(1.4+0.3*sin(uT*19.0)); }',
      '  else if(m<5.5){ alb=vec3(0.82,0.78,0.66); rgh=0.55; alb*=1.0-0.25*smoothstep(0.006,0.0,abs(fract(p.x*8.0)-0.5)-0.46); }',
      '  else if(m<6.5){ alb=vec3(0.2,0.42,0.66); met=0.5; rgh=0.35; emi=vec3(0.1,0.4,0.9)*0.06*(0.5+0.5*sin(p.x*20.0-uT*4.0)); }',
      '  else if(m<7.5){ alb=vec3(0.2,0.22,0.27); met=0.7; rgh=0.45; alb*=1.0-0.35*smoothstep(0.006,0.0,abs(fract(p.x*3.0)-0.5)-0.47); }',
      '  else { alb=vec3(0.62,0.64,0.68); met=1.0; rgh=0.2; float pole=step(0.0,p.z);',
      '    if(abs(p.z)>0.27) alb=mix(vec3(0.75,0.15,0.15),vec3(0.15,0.25,0.75),pole); }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '1', name: 'Modulation diaphragm', at: [0.04, 0.6, 0.3], text: '“.250" stamped 4130 steel.” It strokes back and forth like a speaker cone. “Diaphragm modulation is kept < 70 Hz to constrain ionization.”' },
      { n: '2', name: 'Heated antenna', at: [-0.6, 0.04, 0.0], text: 'A thorium coated antenna, heated, standing out through the hole in the diaphragm.' },
      { n: '3', name: 'Permanent magnets', at: [0.77, 0.675, 0.285], text: 'Four on each support pillar, beside the diaphragm’s drive coil.' },
      { n: '4', name: 'Support pillar · diaphragm modulator', at: [1.5, 0.78, 0.1], text: 'Carries the diaphragm modulator and the feed.' },
      { n: '5', name: 'Feed with water cooling', at: [1.4, 0.115, 0.05], text: 'High voltage, 60 GHz modulated at about 1.41 GHz, runs down the centre to the antenna, water cooled.' },
      { n: '6', name: 'Calcium copper titanate insulator', at: [0.2, 0.075, 0.03], text: '“Insulative calcium copper titanate” round the feed.' },
      { n: '7', name: 'Gas feed zone', at: [0.3, -0.14, 0.1], text: '“Cold gas like propane or thorium mercury”, drawn forward through the hole in the diaphragm.' },
      { n: '8', name: 'Electron rich zone', at: [-0.5, 0.2, 0.0], text: 'The innermost zone, hugging the antenna.' },
      { n: '9', name: 'Ion-electron zone', at: [-0.95, 0.4, 0.0], text: 'The mixing zone between the two: the electron-ion mix.' },
      { n: '10', name: 'Ion rich zone', at: [-1.5, 0.62, 0.0], text: 'The outermost zone, reaching furthest into the open air.' }
    ],
    steps: [
      { d: 4, label: 'Gas feed', text: 'Cold gas, like propane or thorium mercury, is drawn through the hole in the diaphragm.' },
      { d: 5, label: 'Antenna', text: 'The thorium coated antenna is heated and fed with high voltage at 60 GHz, modulated at about 1.41 GHz. An electron rich zone forms round it.' },
      { d: 5, label: 'Diaphragm', text: 'The stamped steel diaphragm strokes, kept below 70 Hz to constrain ionization. Each stroke sends a compression front out.' },
      { d: 6, label: 'Zones', text: 'The fronts pass out through the electron rich zone, the ion-electron mix and the ion rich zone. “Diaphragm modulation speed drives available ionization.”' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt);
      return { A: [smooth(0.3, 2.5, tt) * k, smooth(4, 6, tt) * k, smooth(9, 11, tt) * k, smooth(14, 16.5, tt) * k], B: [0, 0, 0], rate: [0, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [0, 0, 0], rate: [0, 0, 0, 0] }
  };
})();
