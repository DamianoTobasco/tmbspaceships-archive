/* TMB 3D scene · Ion Pumpy Thing: closed cycle plasma amplifier / dynamic plasma alternator
 * (drawing TMB-0566, archive shot 0566). Built from the notes on the drawing:
 * an HV HF ionizer (20 kV @ 300 kHz) drives two ring electrodes; arcs jump between them through a
 * spindle of Hastelloy screens; a servo piston commands adiabatic pressure (almost still until
 * ignition, then long slow 10-30 Hz strokes); magnetron port, ion seed gas inlet, water jacket,
 * and a return loop that closes the cycle.
 * uA = (seed gas, arcs, piston stroke, output)  uB.x = compression (arc peak)  uC = (piston phase, flow) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes['tmb-pump'] = {
    title: 'Ion Pumpy Thing, a closed cycle plasma amplifier',
    fig: 'After drawing TMB-0566 (shot 0566)',
    from: 'the notes on the original drawing',
    partsNote: 'named as on the drawing',
    claim: 'Shown working the way the drawing’s notes describe it.',
    cam: { yaw: 0.38, pitch: 0.24, sway: 0.26, yawNarrow: 1.0 },
    fit: { hw: 2.35, hh: 1.5, hwNarrow: 1.75 },
    cutModes: [{ label: 'Half section', cut: 1, qt: 0 }, { label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Closed', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 16.0',
      '#define GLOWK 2.6',
      'const float RC=0.36; const float XA=-1.45; const float XB=-0.35;',                    // cylinder radius, the two ring electrodes
      'float cutD(vec3 p){ return min(p.z-mix(2.8,0.0,uCut), p.y-mix(-2.8,0.0,uB.w)); }',
      'float pist(){ return 0.07*uA.z*sin(uT*2.6); }',                                      // piston travel
      'float comp(){ return uA.z*(0.5-0.5*sin(uT*2.6)); }',                                 // how far the stroke has squeezed the chamber
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float r=length(p.yz); float px=pist();',
      // chromoly cylinder, closed at the left by a domed head
      '  float cyl=max(abs(r-RC)-0.016,abs(p.x+0.4)-1.5); float head=max(abs(length(p-vec3(-1.9,0.0,0.0))-RC)-0.016,p.x+1.9);',
      '  vec2 res=vec2(max(min(cyl,head),cz),1.0);',
      // water jacket round the piston end
      '  float d=max(max(abs(r-0.455)-0.02,abs(p.x-0.25)-0.5),cz); d=min(d,max(max(abs(abs(p.x-0.25)-0.5)-0.02,r-0.475),max(-(r-RC),cz))); if(d<res.x) res=vec2(d,2.0);',
      // ring electrodes
      '  d=max(min(sdTorus2(vec2(p.x-XA,r),0.2,0.045),sdTorus2(vec2(p.x-XB,r),0.2,0.045)),cz); if(d<res.x) res=vec2(d,3.0);',
      // spindle of Hastelloy screens
      '  float u=clamp((p.x+1.27)/0.74,0.0,1.0); float k=floor(u*12.0); float xs=-1.27+0.74*(k+0.5)/12.0;',
      '  float rs=0.31*(0.42+0.58*sin(3.14159*(k+0.5)/12.0));',
      '  d=max(max(max(abs(p.x-xs)-0.006,r-rs),abs(p.x+0.9)-0.37),cz); if(d<res.x) res=vec2(d,4.0);',
      // piston, rod and linear servo
      '  d=cylX(p-vec3(0.08+px,0.0,0.0),RC-0.022,0.16); if(d<res.x) res=vec2(d,5.0);',
      '  d=cylX(p-vec3(0.85+px,0.0,0.0),0.05,0.62); if(d<res.x) res=vec2(d,6.0);',
      '  d=min(cylX(p-vec3(1.68,0.0,0.0),0.3,0.3)-0.01,max(abs(r-0.32)-0.03,abs(abs(p.x-1.68)-0.15)-0.03)); if(d<res.x) res=vec2(d,7.0);',
      // the return loop that closes the cycle: over the top and under the bottom
      '  vec3 q=vec3(p.x,abs(p.y),p.z);',
      '  d=min(cylX(q-vec3(-0.5,0.78,0.0),0.065,1.32),min(cylY(q-vec3(-1.82,0.56,0.0),0.065,0.22),cylY(q-vec3(0.82,0.56,0.0),0.065,0.22)));',
      '  d=max(d,-(r-RC+0.01)); if(d<res.x) res=vec2(d,8.0);',
      // ionizer and output boxes above, magnetron and seed gas below
      '  d=min(sdRBox(p-vec3(-1.5,1.22,0.0),vec3(0.36,0.16,0.2),0.02),sdRBox(p-vec3(-0.55,1.22,0.0),vec3(0.3,0.16,0.2),0.02)); if(d<res.x) res=vec2(d,9.0);',
      '  d=min(cylY(p-vec3(XA,0.8,0.0),0.018,0.42),cylY(p-vec3(XB,0.8,0.0),0.018,0.42));',
      '  d=min(d,min(cylY(p-vec3(-1.05,0.72,0.12),0.014,0.5),cylY(p-vec3(-0.75,0.72,-0.12),0.014,0.5))); d=max(d,-(r-0.19)); if(d<res.x) res=vec2(d,10.0);',
      '  d=min(sdRBox(p-vec3(-0.45,-1.2,0.0),vec3(0.2,0.14,0.18),0.02),cylY(p-vec3(-0.45,-0.72,0.0),0.07,0.36)); d=max(d,-(r-RC+0.01)); if(d<res.x) res=vec2(d,11.0);',
      '  d=min(cylY(p-vec3(-1.25,-1.14,0.0),0.13,0.2)-0.02,cylY(p-vec3(-1.25,-0.62,0.0),0.025,0.3)); d=max(d,-(r-RC+0.01)); if(d<res.x) res=vec2(d,12.0);',
      '  return res;',
      '}',
      // a jagged arc from electrode to electrode; n picks which arc
      'float arc(vec3 p, float n){ float t=floor(uT*14.0)+n*7.0; vec2 o=vec2(vnoise(vec3(p.x*5.0,t,n))-0.5,vnoise(vec3(p.x*5.0,n,t))-0.5)*0.34*sin(3.14159*clamp((p.x-XA)/(XB-XA),0.0,1.0));',
      '  float d=length(p.yz-o); return exp(-d*d*420.0)+0.3*exp(-d*d*36.0); }',
      'float glowStep(vec3 p){ return (length(p.yz)<RC&&p.x>-2.0&&p.x<0.0)?0.03:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); float r=length(p.yz); if(cutD(p)>0.0||r>RC-0.015||p.x<-2.2||p.x>-0.05+pist()) return g;',
      '  float inx=step(XA,p.x)*step(p.x,XB); float pw=uA.y*(0.55+0.45*comp());',
      '  g+=vec3(0.65,0.8,1.0)*(arc(p,1.0)+arc(p,2.0)*step(0.5,comp())+0.6*arc(p,3.0)*step(0.35,pw))*inx*pw*5.0;',   // massive arcs
      '  g+=vec3(0.5,0.3,1.0)*(0.25+0.35*vnoise(p*7.0+vec3(uT,0.0,0.0)))*pw*0.5*smoothstep(RC,0.05,r);',          // the plasma they leave
      '  g+=vec3(0.3,0.9,0.5)*0.12*uA.x*(0.5+0.5*vnoise(p*5.0-vec3(uC.y,0.0,0.0)))*(1.0-0.7*uA.y);',             // seed gas, mercury and SF6
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return (length(p.yz)<RC+0.02&&p.x<0.3) ? alb*vec3(0.55,0.6,1.0)*uA.y*(0.25+0.35*comp()) : vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&(n.z>0.9||n.y>0.9); float hatch=hatchF(p); float r=length(p.yz); float ang=atan(p.z,p.y);',
      '  if(m<1.5){ alb=vec3(0.42,0.45,0.5); met=1.0; rgh=0.34; alb*=1.0-0.4*smoothstep(0.006,0.0,abs(fract(p.x*2.0+0.5)-0.5)/2.0);',
      '    if(r<RC){ alb=vec3(0.3,0.31,0.36); rgh=0.5; }',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ alb=vec3(0.2,0.42,0.62); met=0.4; rgh=0.4; emi=vec3(0.1,0.4,0.8)*0.06;',
      '    if(sect){ alb=mix(vec3(0.4,0.7,0.95),vec3(0.25,0.5,0.75),hatch); met=0.0; rgh=0.85; emi=alb*0.2; } }',
      '  else if(m<3.5){ alb=vec3(1.0,0.76,0.34); met=1.0; rgh=0.28; emi=vec3(1.0,0.75,0.4)*uA.y*(0.25+0.5*comp()); }',
      '  else if(m<4.5){ vec2 f=abs(fract(p.yz*30.0)-0.5); float mesh=step(0.3,max(f.x,f.y));',
      '    alb=mix(vec3(0.1,0.1,0.12),vec3(0.75,0.78,0.72),mesh); met=mesh; rgh=0.4; emi=mix(vec3(1.0,0.3,0.3),vec3(0.3,0.5,1.0),step(0.0,p.y))*mesh*uA.w*0.5; }',
      '  else if(m<5.5){ alb=vec3(0.25,0.6,0.42); met=0.7; rgh=0.36; alb*=1.0-0.45*smoothstep(0.012,0.0,abs(abs(p.x-0.08-pist())-0.08)-0.012); }',
      '  else if(m<6.5){ alb=vec3(0.8,0.82,0.85); met=1.0; rgh=0.15; }',
      '  else if(m<7.5){ alb=vec3(0.24,0.26,0.3)*(0.8+0.2*step(0.5,fract(ang*3.8197))); met=0.8; rgh=0.4; emi=vec3(0.2,0.8,1.0)*uA.z*0.12*step(0.5,fract(p.x*6.0-uT*0.8)); }',
      '  else if(m<8.5){ alb=vec3(0.36,0.38,0.44); met=1.0; rgh=0.35; float fl=smoothstep(0.75,0.95,fract((p.x*sign(p.y)+abs(p.y))*1.6-uC.y));',
      '    emi=vec3(0.3,0.75,1.0)*fl*(0.25+uA.z)*0.3; }',
      '  else if(m<9.5){ alb=vec3(0.13,0.14,0.18); met=0.6; rgh=0.45; bool iz=p.x<-1.0; vec2 f=p.xy-vec2(iz?-1.5:-0.55,1.22);',
      '    float ln=smoothstep(0.014,0.004,abs(f.y-0.05*sin(f.x*(iz?60.0:26.0)-uT*(iz?40.0:9.0))))*step(abs(f.x),iz?0.28:0.22)*step(0.17,p.z);',
      '    emi=(iz?vec3(1.0,0.75,0.3)*uA.y:vec3(0.3,1.0,0.7)*uA.w)*ln*1.2; }',
      '  else if(m<10.5){ bool bus=p.x>-1.2&&p.x<-0.6; alb=bus?(p.z>0.0?vec3(0.7,0.12,0.1):vec3(0.1,0.2,0.75)):vec3(0.75,0.6,0.25); met=0.3; rgh=0.45;',
      '    emi=bus?alb*uA.w*0.8*(0.5+0.5*sin(p.y*30.0+uT*10.0)):vec3(1.0,0.8,0.4)*uA.y*0.5*(0.5+0.5*sin(p.y*40.0-uT*30.0)); }',
      '  else if(m<11.5){ alb=vec3(0.2,0.21,0.25); met=0.7; rgh=0.4; emi=vec3(1.0,0.35,0.5)*uA.y*0.3*step(-0.95,p.y)*step(0.5,fract(p.y*12.0+uT*4.0)); }',
      '  else { alb=vec3(0.25,0.5,0.3); met=0.5; rgh=0.4; emi=vec3(0.3,0.9,0.5)*uA.x*0.15; }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '1', name: 'Ionizer, 20 kV @ 300 kHz', at: [-1.5, 1.22, 0.2], text: 'A “min field” high-voltage, high-frequency AC ionizer. It drives the two ring electrodes.' },
      { n: '2', name: 'Ring electrodes', at: [-1.45, 0.2, 0.0], cut: true, text: 'The ionizer’s two electrodes, one at each end of the screen spindle. The arcs jump from one to the other.' },
      { n: '3', name: 'Hastelloy screens', at: [-0.9, 0.3, 0.0], cut: true, text: 'A spindle of screens between the electrodes. The arcs pass through them, and the output is taken off them on a red and a blue bus.' },
      { n: '4', name: 'Output “Colmunator”', at: [-0.55, 1.22, 0.2], text: 'The output box, fed from the screens.' },
      { n: '5', name: 'Piston', at: [0.08, 0.2, 0.2], cut: true, text: '“Piston has full command of adiabatic pressure.” It barely moves until ignition temperature is reached, then makes long slow 10–30 Hz oscillations.' },
      { n: '6', name: 'Linear servo piston drive', at: [1.68, 0.3, 0.1], text: 'A 3000 watt, high-speed drive motor on a chromemolly cylinder with a 1500 °F piston rating.' },
      { n: '7', name: 'Water jacket', at: [0.45, 0.46, 0.05], text: 'Cools the cylinder round the piston.' },
      { n: '8', name: 'Magnetron', at: [-0.45, -1.2, 0.18], text: '1 GHz or more, 50 watt, fed into the chamber by the second electrode.' },
      { n: '9', name: 'Ion seed gas', at: [-1.25, -1.14, 0.14], text: 'The seed gas “contains Mercury and SF6”. A filament heater and a wire feed for metal ions sit at this end, with a solenoid vent.' },
      { n: '10', name: 'Return loop', at: [-0.3, 0.78, 0.07], text: 'Equilibrium air flow: the cycle is closed, so the working gas runs back round to the other end.' }
    ],
    steps: [
      { d: 4, label: 'Seed gas', text: 'Ion seed gas, containing mercury and SF6, is let into the cylinder and the filament heater comes on.' },
      { d: 5, label: 'Massive arcs', text: 'The ionizer puts 20 kV at 300 kHz across the ring electrodes. Arcs jump between them through the Hastelloy screens, with the magnetron adding 1 GHz.' },
      { d: 4, label: 'Piston holds', text: 'The pump action is almost no movement until ignition temperature is reached.' },
      { d: 7, label: 'Long slow strokes', text: 'Then the piston makes long slow 10–30 Hz oscillations, commanding the adiabatic pressure. The arcs peak on each compression and the output is taken off the screens.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt);
      return { A: [smooth(0.3, 2.5, tt) * k, smooth(4, 6, tt) * k, smooth(13, 15, tt) * k, smooth(14, 16, tt) * k], B: [0, 0, 0], rate: [0, 0.9, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [0, 0, 0], rate: [0, 0.9, 0, 0] }
  };
})();
