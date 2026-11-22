/* Pais 3D scene 2 · Electromagnetic field generator (US 10,135,366 B2), FIG. 1 and 2:
 * the space-based version, a spherical shell 100 with everything housed inside it.
 * The shell and the cruciform strut framework 103 spin; the support tube 101 with the reactor 300,
 * thermoelectric generator 400, motor 500 and the two Pelletron generators 200 rides on bearings 102.
 * uA = (reactor heat, charge, spin, field)  uB.x = shell vibration  uC = (spin angle, chain travel) */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes.heem = {
    title: 'Electromagnetic field generator',
    fig: 'After FIG. 1 and 2: the spherical shell used in space',
    cam: { yaw: 0.66, pitch: 0.2, sway: 0.24, yawNarrow: 0.66 },
    fit: { hw: 1.5, hh: 1.36, hwNarrow: 1.22 },
    cutModes: [{ label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Half section', cut: 1, qt: 0 }, { label: 'Closed shell', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 12.0',
      '#define GLOWK 3.0',
      'const float R=1.0; const float TS=0.04;',
      // quarter cut opens the wedge toward the viewer (x>0, z>0); the half section removes the whole front
      'float cutD(vec3 p){ return min(p.z-mix(2.6,0.0,uCut), p.x-mix(-2.6,0.0,uB.w)); }',
      // distance along the Pelletron chain loop (two pulleys 0.4 apart, radius 0.072)
      'float pelU(vec2 l){ const float h=0.2; const float r=0.072;',
      '  if(l.y>h) return h+r*atan(l.y-h,l.x);',
      '  if(l.y<-h) return 3.0*h+r*PI+r*atan(-(l.y+h),-l.x);',
      '  return l.x>0.0 ? l.y : 2.0*h+r*PI-l.y; }',
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float r=length(p); float rx=length(p.xz);',
      '  vec3 q=p; q.xz=rot(uC.x)*q.xz;',                                                   // the frame that spins with the shell
      '  float th=atan(q.z,q.x); float la=asin(clamp(q.y/max(r,0.001),-1.0,1.0));',
      '  float vib=uB.x*0.0012*sin(th*40.0+uT*37.0)*sin(la*30.0-uT*23.0);',
      '  vec2 res=vec2(max(abs(r-(R-0.5*TS))-0.5*TS-vib,cz),1.0);',                         // shell 100
      '  float d=max(max(abs(rx-0.19)-0.012,abs(p.y)-0.925),cz); if(d<res.x) res=vec2(d,2.0);',   // support structure 101
      '  d=max(ann(p,0.2,0.24,-0.925,-0.865),cz); if(d<res.x) res=vec2(d,3.0);',            // low friction bearings 102
      // cruciform strut framework 103: four arms from the hub to the shell
      '  vec3 a=abs(q);',
      '  d=min(sdBox(vec3(a.x-0.57,q.y,q.z),vec3(0.37,0.085,0.115)), sdBox(vec3(q.x,q.y,a.z-0.57),vec3(0.115,0.085,0.37)));',
      '  d=min(d,min(sdBox(vec3(a.x-0.945,q.y,q.z),vec3(0.02,0.05,0.075)), sdBox(vec3(q.x,q.y,a.z-0.945),vec3(0.075,0.05,0.02))));',
      '  d=min(d,ann(q,0.2,0.33,-0.1,0.1))-0.006; d=max(max(d,-(rx-0.203)),cz); if(d<res.x) res=vec2(d,4.0);',
      // electric motor 500, thermoelectric generator 400 and pebble bed reactor 300: rings round the tube
      '  d=max(ann(p,0.205,0.285,0.11,0.40),cz); if(d<res.x) res=vec2(d,5.0);',
      '  d=max(ann(p,0.205,0.38,0.41,0.66),cz); if(d<res.x) res=vec2(d,6.0);',
      '  d=max(max(ann(p,0.205,0.36,0.67,0.86),-ann(p,0.22,0.345,0.685,0.845)),cz); if(d<res.x) res=vec2(d,7.0);',
      '  vec3 c=mod(p+0.029,0.058)-0.029;',
      '  d=max(max(length(c)-0.026,ann(p,0.222,0.343,0.687,0.843)),cz); if(d<res.x) res=vec2(d,8.0);',   // the pebbles
      // electrostatic generators 200 (Pelletron): a chain of metal pellets running round two pulleys
      '  vec3 l=vec3(p.x,abs(p.y)-0.56,p.z); vec2 s=l.xy; s.y-=clamp(s.y,-0.2,0.2);',
      '  d=length(vec2(abs(length(s)-0.072),l.z))-0.013; if(d<res.x) res=vec2(d,9.0);',
      '  d=min(cylZ(l-vec3(0.0,0.2,0.0),0.057,0.03),cylZ(l-vec3(0.0,-0.2,0.0),0.057,0.03)); if(d<res.x) res=vec2(d,10.0);',
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float d=length(p)-R; return (d>-0.02&&d<0.95&&(uA.w>0.01||uA.y>0.01))?0.035+0.16*max(d,0.0):9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); if(cutD(p)>0.0) return g;',
      '  float r=length(p);',
      '  if(r>R){',
      '    float d=r-R; vec3 q=p; q.xz=rot(uC.x)*q.xz; float th=atan(q.z,q.x);',
      '    float eq=1.0-abs(p.y)/r;',                                                       // strongest round the equator, where the charged skin moves fastest
      '    g+=vec3(0.45,0.55,1.0)*exp(-d*30.0)*(0.3+0.7*vnoise(q*14.0+vec3(0.0,uT*2.0,0.0)))*uA.y*0.55;',   // charge on the skin
      '    float wv=pow(0.5+0.5*sin(d*15.0-uT*7.0+sin(th*3.0)*0.7),10.0);',                  // the field, directed outward
      '    g+=mix(vec3(0.25,0.8,1.0),vec3(0.7,0.4,1.0),smoothstep(0.0,0.9,d))*wv*exp(-d*2.6)*(0.25+0.75*eq)*uA.w*0.5;',
      '  }',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ if(length(p)>R-TS) return vec3(0.0);',           // the hot pebble bed lights the inside
      '  vec3 v=p-vec3(0.0,0.76,0.0); return alb*vec3(1.0,0.45,0.15)*uA.x*0.4/(1.0+7.0*dot(v,v)); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&(n.z>0.9||n.x>0.9);',
      '  float hatch=hatchF(p); float r=length(p);',
      '  vec3 q=p; q.xz=rot(uC.x)*q.xz; float th0=atan(p.z,p.x);',
      '  if(m<1.5){',                                                                       // shell: PZT crystal modules set in an aluminum matrix
      '    float th=atan(q.z,q.x); float la=asin(clamp(q.y/r,-1.0,1.0));',
      '    alb=vec3(0.5,0.53,0.58); met=1.0; rgh=0.4;',
      '    if(r>R-0.012){',
      '      vec2 g=vec2(th,la)*11.4592; vec2 f=abs(fract(g)-0.5);',
      '      float tile=smoothstep(0.34,0.28,max(f.x,f.y))*smoothstep(1.4,1.2,abs(la)); float id=hash1(vec3(floor(g),1.0));',
      '      alb=mix(alb,vec3(0.62,0.58,0.46)*(0.85+0.25*id),tile); met=mix(1.0,0.1,tile); rgh=mix(0.4,0.5,tile);',
      '      emi=vec3(0.25,0.85,1.0)*tile*uB.x*(0.03+0.13*pow(0.5+0.5*sin(uT*29.0+id*40.0),4.0))+vec3(0.5,0.55,1.0)*uA.y*0.03*vnoise(q*30.0+uT);',
      '    } else { alb=vec3(0.34,0.37,0.44)*(0.75+0.35*smoothstep(0.012,0.004,abs(fract(la*3.8197)-0.5)/3.8197)); met=0.6; rgh=0.55; }',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ alb=vec3(0.80,0.82,0.85)*(1.0-0.3*smoothstep(0.006,0.0,abs(fract(p.y*5.0)-0.5)-0.47)); rgh=0.55; met=0.1;',
      '    if(sect){ alb=mix(vec3(0.5,0.72,0.95),vec3(0.32,0.5,0.75),hatch); rgh=0.85; emi=alb*0.2; } }',
      '  else if(m<3.5){ alb=vec3(0.78,0.8,0.83)*(0.7+0.3*step(0.5,fract(th0*3.8197))); met=1.0; rgh=0.22;',
      '    if(sect){ alb=mix(vec3(0.75,0.77,0.8),vec3(0.5,0.52,0.56),hatch); met=0.0; rgh=0.85; emi=alb*0.18; } }',
      '  else if(m<4.5){ float w=step(0.5,fract(q.x*34.0+0.5*step(0.5,fract(q.z*34.0+q.y*34.0))));',   // carbon composite, non-conducting
      '    alb=mix(vec3(0.06,0.065,0.075),vec3(0.13,0.14,0.16),w); met=0.35; rgh=0.32;',
      '    if(sect){ alb=mix(vec3(0.32,0.33,0.36),vec3(0.18,0.19,0.21),hatch); met=0.0; rgh=0.85; emi=alb*0.15; } }',
      '  else if(m<5.5){ alb=vec3(0.30,0.34,0.42)*(0.8+0.2*step(0.5,fract(th0*5.7296))); met=0.9; rgh=0.35;',
      '    emi=vec3(0.2,0.6,1.0)*uA.z*0.2*smoothstep(0.02,0.0,abs(p.y-0.255)-0.11)*step(0.5,fract(th0*1.9099-uC.x*0.6));',
      '    if(sect){ alb=mix(vec3(0.92,0.52,0.26),vec3(0.62,0.32,0.14),step(0.5,fract(p.y*60.0))); met=0.0; rgh=0.7; emi=alb*0.2; } }',
      '  else if(m<6.5){ alb=vec3(0.5,0.52,0.56)*(0.75+0.25*step(0.5,fract(p.y*42.0))); met=0.8; rgh=0.4; emi=vec3(1.0,0.4,0.1)*uA.x*0.1;',
      '    if(sect){ alb=mix(vec3(0.78,0.62,0.88),vec3(0.52,0.4,0.64),hatch); met=0.0; rgh=0.85; emi=alb*0.2+vec3(1.0,0.4,0.1)*uA.x*0.08; } }',
      '  else if(m<7.5){ alb=vec3(0.28,0.30,0.34); met=0.9; rgh=0.4; emi=vec3(1.0,0.35,0.08)*uA.x*0.14;',
      '    if(sect){ alb=mix(vec3(0.6,0.62,0.66),vec3(0.4,0.42,0.46),hatch); met=0.0; rgh=0.85; emi=alb*0.18; } }',
      '  else if(m<8.5){ float id=hash1(floor((p+0.029)/0.058)); alb=vec3(0.2,0.19,0.19); rgh=0.6;',
      '    emi=mix(vec3(1.0,0.3,0.04),vec3(1.0,0.72,0.28),id)*uA.x*(0.85+0.45*sin(uT*2.0+id*20.0)); }',
      '  else if(m<9.5){ vec3 l=vec3(p.x,abs(p.y)-0.56,p.z); float u=pelU(l.xy)+uC.y; float pel=step(0.45,fract(u*15.975));',   // metal pellets on insulating links
      '    alb=mix(vec3(0.93,0.92,0.86),vec3(0.86,0.88,0.92),pel); met=pel; rgh=mix(0.6,0.24,pel);',
      '    emi=vec3(0.5,0.6,1.0)*pel*uA.y*0.55*(0.6+0.4*sin(uT*17.0+u*90.0)); }',
      '  else { alb=vec3(0.55,0.57,0.6); met=1.0; rgh=0.3; }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,0.0,0.0); }'
    ].join('\n'),
    parts: [
      { n: '100', name: 'Shell', at: [-0.62, 0.45, 0.64], text: 'An epoxy-ceramic composite in an aluminum matrix with polarized PZT crystal modules embedded in it. Charged to very high voltage, spun and made to vibrate. Pressurized inside to about 20 bar with sulfur hexafluoride.' },
      { n: '200', name: 'Electrostatic generators (Pelletron)', at: [0.0, 0.62, 0.03], cut: true, text: 'Two of them, to charge the shell quickly. A Pelletron is a Van de Graaff generator with the belt replaced by a chain of metal pellets on insulating links; the patent expects 30 megavolts or more.' },
      { n: '300', name: 'Pebble bed reactor', at: [0.285, 0.765, 0.0], cut: true, text: 'A small helium-cooled fission reactor that burns tennis-ball-sized uranium pebbles and delivers 1 to 10 megawatts of heat. Ring-shaped in this version.' },
      { n: '400', name: 'Thermoelectric generator', at: [0.3, 0.535, 0.0], cut: true, text: 'Turns the reactor’s heat into the electricity that runs the motor, the Pelletrons and the PZT modules.' },
      { n: '500', name: 'Electric motor', at: [0.245, 0.255, 0.0], cut: true, text: 'A high-speed, variable-drive motor. Its drive shaft turns the cruciform strut framework, and with it the shell, at up to 30,000 RPM in the patent’s example.' },
      { n: '101', name: 'Support structure', at: [-0.135, -0.5, 0.135], cut: true, text: 'An insulated mount that carries all the subsystems inside the shell.' },
      { n: '102', name: 'Low friction bearings', at: [-0.16, -0.895, 0.16], cut: true, text: 'Couple the support structure to the spinning shell.' },
      { n: '103', name: 'Cruciform strut framework', at: [-0.23, 0.1, 0.25], cut: true, text: 'Four struts fixed to the inside of the shell. Because the shell carries a huge charge they are made of strong non-conducting material, such as carbon nanotube or graphite-epoxy composite.' }
    ],
    steps: [
      { d: 4, label: 'Reactor on', text: 'The pebble bed reactor 300 makes heat and the thermoelectric generator 400 turns it into electricity.' },
      { d: 4, label: 'Charging', text: 'The two Pelletron generators 200 charge the shell 100 to a very high voltage.' },
      { d: 4.5, label: 'Spin', text: 'The motor 500 drives the cruciform struts 103, spinning the charged shell faster and faster.' },
      { d: 4, label: 'Vibration', text: 'Voltage on the PZT crystal modules makes the shell vibrate at high frequency as it spins.' },
      { d: 5, label: 'Field', text: 'The patent says the charged, spinning, vibrating shell throws an extremely intense electromagnetic field outward, with nothing inside the shell affected by it.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), spin = smooth(8, 12.5, tt) * k, charge = smooth(4, 7, tt) * k;
      return { A: [smooth(0.2, 2.5, tt) * k, charge, spin, smooth(16.5, 19, tt) * k], B: [smooth(12.5, 14.5, tt) * k, 0, 0], rate: [spin * 2.6, 0.12 + charge * 0.5, 0, 0] };
    },
    rest: { A: [1, 1, 1, 1], B: [1, 0, 0], rate: [2.6, 0.62, 0, 0] }
  };
})();
