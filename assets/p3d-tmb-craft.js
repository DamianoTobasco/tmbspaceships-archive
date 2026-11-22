/* TMB 3D scene · Brown-Cahill Method, antigravity spacecraft (drawing TMB-0712, archive shot 0712).
 * Built from the notes on the drawing: a pill fuselage with an incandescently heated antenna, a
 * speaker-like low frequency modulation diaphragm and drive coils at each end; avionics blocks and
 * seed gas inside; outside, slow ions ride compression waves in the gap while fast electrons bunch
 * into the soliton envelope membrane that contains the plasma.
 * uA = (antenna heat, 60 GHz, diaphragm stroke, soliton membrane) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes['tmb-craft'] = {
    title: 'Brown-Cahill Method antigravity spacecraft',
    fig: 'After drawing TMB-0712 (shot 0712)',
    from: 'the notes on the original drawing',
    partsNote: 'named as on the drawing',
    claim: 'Shown working the way the drawing’s notes describe it.',
    cam: { yaw: 0.5, pitch: 0.3, sway: 0.3, yawNarrow: 1.05 },
    fit: { hw: 2.3, hh: 1.25, hwNarrow: 1.5 },
    cutModes: [{ label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Half section', cut: 1, qt: 0 }, { label: 'Skin on', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 15.0',
      '#define GLOWK 2.4',
      'const float HX=1.05; const float RF=0.5; const float GM=0.34;',                      // straight half-length, radius, gap to the membrane
      'float cutD(vec3 p){ return min(p.z-mix(2.8,0.0,uCut), p.y-mix(-2.8,0.0,uB.w)); }',
      'float pill(vec3 p){ p.x-=clamp(p.x,-HX,HX); return length(p)-RF; }',
      'float strokeX(){ return 0.035*uA.z*sin(uT*4.2); }',                                   // both diaphragms push and pull together
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float dp=pill(p); float ax=abs(p.x); float r=length(p.yz);',
      '  vec2 res=vec2(max(abs(dp+0.012)-0.012,cz),1.0);',                                  // fuselage skin
      '  float xd=1.0+strokeX();',
      '  float d=max(abs(ax-xd-0.09*(1.0-r/0.43))-0.009,r-0.43); if(d<res.x) res=vec2(d,2.0);',   // modulation diaphragm
      '  d=sdTorus2(vec2(ax-0.93,r),0.3,0.035); if(d<res.x) res=vec2(d,3.0);',              // diaphragm drive coils
      '  d=min(cylX(vec3(ax-1.5,p.y,p.z),0.026,0.4),cylX(vec3(ax-1.55,p.y,p.z),0.06,0.05)); if(d<res.x) res=vec2(d,4.0);',   // heated antenna
      // avionics: three blocks above, three below
      '  vec3 bt=vec3(p.x-0.6*clamp(floor(p.x/0.6+0.5),-1.0,1.0),p.y-0.19,p.z); vec3 bb=vec3(p.x-0.6*clamp(floor(p.x/0.6+0.5),-1.0,0.0),p.y+0.19,p.z);',
      '  d=min(sdRBox(bt,vec3(0.25,0.145,0.21),0.015),sdRBox(bb,vec3(0.25,0.145,0.21),0.015)); if(d<res.x) res=vec2(d,5.0);',
      '  d=min(cylX(p-vec3(0.6,-0.12,0.0),0.085,0.22)-0.01,cylX(p-vec3(0.6,-0.29,0.0),0.065,0.22)-0.01); if(d<res.x) res=vec2(d,6.0);',   // the gas bottles
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float dp=pill(p); return (dp>-0.02&&dp<0.6&&(uA.x+uA.y>0.01))?0.035:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); float dp=pill(p); if(cutD(p)>0.0||dp<0.0) return g;',
      '  float ax=abs(p.x); float r=length(p.yz); float ang=atan(p.z,p.y);',
      // hot electrons spilling round each antenna
      '  vec3 n=vec3(ax-1.72,p.y,p.z); g+=vec3(1.0,0.85,0.45)*exp(-dot(n,n)*14.0)*(uA.x*0.5+uA.y*0.5)*(0.7+0.3*vnoise(p*10.0+uT*2.0));',
      // 60 GHz lights the gas in the gap; the diaphragms send ion compression waves along it, end to end
      '  float gap=smoothstep(GM,GM*0.6,dp)*smoothstep(0.0,0.05,dp);',
      '  float wv=pow(0.5+0.5*sin(p.x*13.0-uT*4.2),3.0);',
      '  g+=gap*(vec3(0.5,0.3,0.9)*uA.y*0.16+vec3(1.0,0.45,0.25)*wv*uA.z*0.55);',
      // the soliton envelope membrane: fast electrons bunched into a thin sheet
      '  float q=(dp-GM-0.012*sin(p.x*9.0+ang*4.0+uT*2.0))/0.016;',
      '  float streak=0.55+0.45*sin(p.x*60.0-uT*26.0+ang*5.0);',
      '  g+=vec3(0.35,0.95,1.0)*exp(-q*q)*streak*uA.w*1.1+vec3(0.2,0.5,1.0)*exp(-max(dp-GM,0.0)*9.0)*step(GM,dp)*uA.w*0.07;',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return pill(p)<-0.02 ? alb*vec3(1.0,0.6,0.3)*uA.x*0.12 : vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&(n.z>0.9||n.y>0.9); float hatch=hatchF(p); float ax=abs(p.x); float r=length(p.yz); float ang=atan(p.z,p.y);',
      '  if(m<1.5){ if(pill(p)>-0.014){ alb=vec3(0.6,0.63,0.68); met=1.0; rgh=0.32;',
      '      alb*=1.0-0.45*max(smoothstep(0.006,0.0,abs(fract(p.x*2.5+0.5)-0.5)/2.5),smoothstep(0.006,0.0,abs(ax-HX)));',
      '      if(ax>HX){ alb=vec3(0.78,0.76,0.7); met=0.1; rgh=0.5; } }',                     // the noses: a ceramic cap round each antenna
      '    else { alb=vec3(0.26,0.28,0.33); met=0.4; rgh=0.55; }',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ alb=vec3(0.3,0.33,0.4)*(0.75+0.25*step(0.5,fract(r*22.0))); met=1.0; rgh=0.3; emi=vec3(1.0,0.5,0.25)*uA.z*0.1*(0.5+0.5*sin(uT*4.2)); }',
      '  else if(m<3.5){ alb=mix(vec3(0.95,0.52,0.24),vec3(0.62,0.3,0.12),step(0.5,fract(ang*9.0))); met=1.0; rgh=0.32; emi=vec3(1.0,0.6,0.2)*uA.z*0.2; }',
      '  else if(m<4.5){ float hot=uA.x; alb=mix(vec3(0.5,0.5,0.52),vec3(0.2),hot); met=1.0-hot; rgh=0.4;',
      '    emi=mix(vec3(1.0,0.35,0.05),vec3(1.0,0.9,0.7),smoothstep(1.3,1.9,ax))*hot*(1.6+0.3*sin(uT*17.0)); if(r>0.03) emi*=0.25; }',
      '  else if(m<5.5){ float bx=clamp(floor(p.x/0.6+0.5),-1.0,1.0); float id=bx+1.0+(p.y<0.0?3.0:0.0);',
      '    alb=vec3(0.12,0.13,0.17); met=0.6; rgh=0.45; vec3 c=id<0.5?vec3(0.4,1.0,0.6):id<1.5?vec3(0.4,0.8,1.0):id<2.5?vec3(1.0,0.5,0.9):id<3.5?vec3(0.6,0.5,1.0):vec3(1.0,0.75,0.3);',
      '    float led=step(0.5,fract(p.x*9.0+id*0.37))*smoothstep(0.02,0.012,abs(abs(p.y)-0.19-0.07))*step(0.2,p.z);',
      '    emi=c*led*(0.35+0.65*uA.y)*(0.6+0.4*sin(uT*(3.0+id)+p.x*20.0)); alb*=1.0-0.4*smoothstep(0.004,0.0,abs(abs(p.y)-0.19)); }',
      '  else { bool he=p.y>-0.2; alb=he?vec3(0.5,0.6,0.72):vec3(0.95,0.5,0.15); met=0.5; rgh=0.35; alb*=1.0-0.3*smoothstep(0.006,0.0,abs(fract(p.x*4.0)-0.5)-0.44); }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '1', name: 'Incandescently heated antenna', at: [1.7, 0.04, 0.0], text: 'One at each end. “Is thorium zirconium coated to promote hot electron production efficiency.” Fed with HF HV 60 GHz DC+, modulated at 1.3–1.8 GHz; both fire in phase.' },
      { n: '2', name: 'Low frequency ion modulation diaphragm', at: [-1.0, 0.3, 0.2], cut: true, text: '“Manufacture from 4130. Oscillations are from .1 Hz to 70 Hz. Works similar to audio speaker.” Helium is its lubricant.' },
      { n: '3', name: 'Diaphragm drive coils', at: [0.86, 0.3, 0.0], cut: true, text: '“Low frequency modulator diaphragm has command over kinetic ion transport force.”' },
      { n: '4', name: 'HF HV 60 GHz DC+', at: [0.6, 0.19, 0.21], cut: true, text: 'The high-frequency, high-voltage supply for the antennas.' },
      { n: '5', name: 'Buoyancy system · master MCU', at: [0.0, 0.19, 0.21], cut: true, text: 'The master controller, with the buoyancy system.' },
      { n: '6', name: 'Gas mixture MCU', at: [-0.6, 0.19, 0.21], cut: true, text: 'Controls the gas mixture.' },
      { n: '7', name: 'HF electron reservoir', at: [-0.6, -0.19, 0.21], cut: true, text: '60 GHz, modulated 1.3–1.8 GHz.' },
      { n: '8', name: 'Propulsive input resolver', at: [0.0, -0.19, 0.21], cut: true, text: 'Resolves the propulsive input.' },
      { n: '9', name: 'Ion seed gas and helium', at: [0.6, -0.2, 0.2], cut: true, text: 'Heat-saturated ion seed gas (propane), and the helium lubricant for the diaphragms.' },
      { n: '10', name: 'Magnetoacoustic zone', at: [0.3, 0.66, 0.0], cut: true, text: 'The “laminar longitudinal magnetoacoustic zone” between the skin and the membrane, with ion velocity held below Mach 1. The diaphragms’ compression waves ride it end to end.' },
      { n: '11', name: 'Soliton envelope membrane', at: [-0.45, 0.84, 0.0], cut: true, text: 'The magnetic confinement soliton envelope membrane. “The fast electrons bunch in laminar 2 dimensional sheets that self contain the plasma.”' },
      { n: '12', name: 'Bunched zone of electrons', at: [-1.75, 0.16, 0.0], text: 'A bunched zone of heat super-saturated electrons round each antenna.' }
    ],
    steps: [
      { d: 4, label: 'Antennas heat', text: 'The thorium zirconium coated antennas are heated until they glow, to give off hot electrons. Ion seed gas is fed in.' },
      { d: 5, label: '60 GHz', text: 'HF HV 60 GHz DC+, modulated at 1.3–1.8 GHz, fires both antennas in phase and the gas round the fuselage lights up.' },
      { d: 5, label: 'Diaphragms', text: 'The low frequency diaphragms push and pull together, 0.1 to 70 Hz, like audio speakers. Ion compression waves ride the gap from end to end, held below Mach 1.' },
      { d: 6, label: 'Soliton envelope', text: '“Plasma consist of 2 velocity domains, the slow ION and fast ELECTRON.” The fast electrons bunch into laminar sheets: the soliton envelope membrane that contains the plasma.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt);
      return { A: [smooth(0.3, 2.5, tt) * k, smooth(4, 6, tt) * k, smooth(9, 11, tt) * k, smooth(14, 16.5, tt) * k], B: [0, 0, 0], rate: [0, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [0, 0, 0], rate: [0, 0, 0, 0] }
  };
})();
