/* Pais 3D scene 1 · Craft using an inertial mass reduction device (US 10,144,532 B2).
 * FIG. 2 embodiment: the trailing portion mirrors the leading portion and the resonant cavity
 * shroud 156 (outer wall 100, xenon-filled cavity 150, insulated inner wall 200) wraps the craft.
 * uA = (emitters, plasma + wall vibration, polarized vacuum, -)  uB = (steer up, -, speed)  uC.x = travel */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes.craft = {
    title: 'Craft using an inertial mass reduction device',
    fig: 'After FIG. 2: the cavity shroud 156 wraps the whole craft',
    cam: { yaw: 0.6, pitch: 0.36, sway: 0.3, yawNarrow: 1.0 },
    fit: { hw: 2.4, hh: 1.3, hwNarrow: 1.72 },
    cutModes: [{ label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Half section', cut: 1, qt: 0 }, { label: 'Closed hull', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 14.0',
      '#define GLOWK 3.4',
      'const float HL=1.9; const float HR=0.8; const float TW=0.035; const float GAP=0.115; const float TI=0.03;',
      'const float FX=1.52; const float EX=1.40; const float SLOPE=0.3985;',     // atan(HR/HL)
      'float cutD(vec3 p){ return min(p.z-mix(2.6,0.0,uCut), p.y-mix(-2.6,0.0,uB.w)); }',
      'float hull(vec3 p){ return sdRhombus(vec2(p.x,length(p.yz)),vec2(HL,HR))-0.015; }',
      'float topMask(vec3 p){ return mix(1.0, smoothstep(-0.15,0.35,p.y)*1.5+0.1, uB.x); }',
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float d0=hull(p); float ang=atan(p.z,p.y);',
      '  float vib=uA.y*0.0011*sin(p.x*64.0+uT*33.0)*sin(ang*9.0-uT*19.0)*topMask(p);',
      '  float w1=max(d0-vib,-(d0+TW));',                                                  // outer resonant cavity wall 100
      '  w1=max(w1,-max(abs(abs(p.x)-FX)-0.006,-(d0+0.014)));',                            // seam of the rotating frustum 25
      '  float w2=max(d0+TW+GAP,-(d0+TW+GAP+TI));',                                        // inner resonant cavity wall 200
      '  vec2 res=vec2(max(w1,cz), abs(p.x)>FX?7.0:1.0);',
      '  float d=max(w2,cz); if(d<res.x) res=vec2(d,2.0);',
      // microwave emitters 300: a ring of eight in the cavity at each tip
      '  float sec=0.7853982; float a=mod(ang+0.5*sec,sec)-0.5*sec; float r=length(p.yz);',
      '  float er=HR*(1.0-EX/HL)-(TW+GAP*0.5)*1.085;',
      '  vec3 e=vec3(abs(p.x)-EX, r*cos(a)-er, r*sin(a)); e.xy=rot(-SLOPE)*e.xy;',
      '  d=min(sdRBox(e,vec3(0.055,0.021,0.03),0.006), max(length(e.yz)-0.007,abs(e.x+0.1)-0.05));',
      '  d=max(d,cz); if(d<res.x) res=vec2(d,3.0);',
      // crew compartment 55 with the cargo bay 57, and the power plant 56, each in a Faraday cage 58
      '  d=sdRBox(p-vec3(0.37,0.0,0.0),vec3(0.28,0.15,0.19),0.03); if(d<res.x) res=vec2(d,4.0);',
      '  d=sdRBox(p-vec3(0.135,-0.08,0.0),vec3(0.075,0.07,0.2),0.012); if(d<res.x) res=vec2(d,5.0);',
      '  vec3 pp=p-vec3(-0.44,0.0,0.0);',
      '  d=min(sdRBox(pp,vec3(0.19,0.12,0.15),0.03), max(length(pp.xy)-0.075,abs(pp.z)-0.165)); if(d<res.x) res=vec2(d,6.0);',
      '  d=min(cage(p-vec3(0.335,0.0,0.0),vec3(0.36,0.2,0.245),22.0,0.0024), cage(pp,vec3(0.24,0.17,0.205),22.0,0.0024));',
      '  if(d<res.x) res=vec2(d,8.0);',
      '  d=max(length(p.yz)-0.0035,abs(p.x)-(HL-0.2)); if(d<res.x) res=vec2(d,9.0);',     // axis 26
      '  return res;',
      '}',
      'float glowStep(vec3 p){ float d0=hull(p); return (d0>-0.02&&d0<0.34&&uA.z>0.01)?0.03:(d0<0.0&&d0>-(TW+GAP+0.02))?0.04:9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); if(cutD(p)>0.0) return g;',
      '  float d0=hull(p);',
      '  float band=smoothstep(GAP*0.5,GAP*0.22,abs(d0+TW+GAP*0.5));',                    // xenon 155 in the cavity 150
      '  if(band>0.0){',
      '    float s=HL-abs(p.x); float wav=0.5+0.5*sin(s*30.0-uT*10.0); float n=vnoise(p*9.0+vec3(0.0,uT*0.8,0.0));',
      '    vec3 xe=mix(vec3(0.32,0.22,1.0),vec3(0.78,0.62,1.0),n);',
      '    g+=band*(xe*(0.4+0.9*n)*uA.y*1.9*topMask(p)+vec3(1.0,0.55,0.14)*wav*wav*uA.x*exp(-s*1.5)*2.4+vec3(0.08,0.07,0.26)*0.3);',
      '  }',
      '  if(d0>0.0&&uA.z>0.0){',                                                           // local polarized vacuum 60
      '    float ang=atan(p.z,p.y); float w=0.5*sin(p.x*9.0+uT*2.3)+0.5*sin(ang*7.0-uT*1.7);',
      '    float q=(d0-0.14-0.03*w)/0.02; float fil=0.55+0.45*sin(p.x*38.0-uT*4.0+ang*3.0)*sin(ang*16.0+uT*2.0);',
      '    g+=(vec3(0.3,0.9,1.0)*exp(-q*q)*0.6*fil*fil+vec3(0.14,0.4,1.0)*exp(-d0*9.0)*0.1)*uA.z*topMask(p);',
      '  }',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ float d0=hull(p);',                             // plasma light on everything inside
      '  return d0<-TW ? alb*vec3(0.42,0.32,1.0)*uA.y*0.22 : vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&(n.z>0.9||n.y>0.9);',
      '  float hatch=hatchF(p);',
      '  float ang=atan(p.z,p.y);',
      '  if(m<1.5){ alb=vec3(0.62,0.66,0.72); met=1.0; rgh=0.34;',
      '    float seamX=smoothstep(0.007,0.0,abs(fract(p.x*2.4+0.5)-0.5)/2.4); float seamA=smoothstep(0.007,0.0,abs(fract(ang*1.9099)-0.5)/1.9099*length(p.yz));',
      '    float pid=hash1(vec3(floor(p.x*2.4+0.5),floor(ang*1.9099),3.0));',                 // each skin panel is slightly different
      '    alb*=(0.86+0.2*pid)*(1.0-0.55*max(seamX,seamA)); rgh+=0.12*pid+0.08*vnoise(p*vec3(6.0,60.0,60.0));',
      '    float mode=abs(sin(p.x*21.0)*sin(ang*6.0));',                                      // standing-wave pattern of the vibrating wall
      '    emi=vec3(0.2,0.7,1.0)*uA.y*0.16*mode*mode*(0.6+0.4*sin(uT*31.0))*topMask(p);',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); met=0.0; rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ alb=vec3(0.36,0.40,0.47); rgh=0.62; met=0.2;',
      '    float fr=smoothstep(0.014,0.006,abs(fract(p.x*3.2+0.5)-0.5)/3.2); float sg=smoothstep(0.014,0.006,abs(fract(ang*2.5465)-0.5)/2.5465*length(p.yz));',
      '    alb=mix(alb,vec3(0.62,0.66,0.72),max(fr,sg)); alb*=0.9+0.2*vnoise(p*22.0);',
      '    if(sect){ alb=mix(vec3(0.5,0.72,0.95),vec3(0.32,0.5,0.75),hatch); rgh=0.85; emi=alb*0.2; } }',
      '  else if(m<3.5){ alb=vec3(1.0,0.74,0.32); met=1.0; rgh=0.32; emi=vec3(1.0,0.5,0.08)*uA.x*(0.75+0.25*sin(uT*23.0)); }',
      '  else if(m<4.5){ alb=vec3(0.86,0.88,0.91); rgh=0.45; met=0.15;',
      '    float win=smoothstep(0.022,0.016,abs(p.y-0.055))*smoothstep(0.02,0.012,abs(fract(p.x*9.0)-0.5)-0.3)*step(0.2,p.x);',
      '    alb=mix(alb,vec3(0.05,0.07,0.1),win); emi=vec3(1.0,0.85,0.55)*win*0.9; alb*=1.0-0.25*smoothstep(0.004,0.0,abs(p.y+0.06)); }',
      '  else if(m<5.5){ alb=mix(vec3(0.95,0.55,0.16),vec3(0.2,0.2,0.22),step(0.5,fract((p.y-p.z)*14.0))*step(0.0,-p.y-0.1)); rgh=0.55; }',
      '  else if(m<6.5){ alb=vec3(0.17,0.19,0.24); met=0.85; rgh=0.38; vec2 c=p.xy-vec2(-0.44,0.0); float rr=length(c);',
      '    float core=smoothstep(0.062,0.05,rr)*step(0.15,abs(p.z)); float ring=smoothstep(0.012,0.0,abs(rr-0.066));',
      '    emi=vec3(0.25,0.9,1.0)*(core*(1.4+0.4*sin(uT*5.0))+ring*0.35); alb*=1.0-0.4*smoothstep(0.006,0.0,abs(fract(p.x*11.0)-0.5)-0.44); }',
      '  else if(m<7.5){ alb=vec3(0.42,0.45,0.52); met=1.0; rgh=0.3;',
      '    float st=smoothstep(0.12,0.08,abs(fract((ang+uT*1.6*sign(p.x))*0.9549)-0.5)); alb=mix(alb,vec3(0.95,0.7,0.3),st*0.75); emi=vec3(1.0,0.6,0.2)*st*0.12;',
      '    if(sect){ alb=mix(vec3(0.8,0.62,0.4),vec3(0.55,0.42,0.28),hatch); met=0.0; rgh=0.85; emi=alb*0.2; } }',
      '  else if(m<8.5){ alb=vec3(0.95,0.5,0.24); met=0.85; rgh=0.34; emi=vec3(0.9,0.4,0.15)*0.06; }',
      '  else { alb=vec3(0.1); emi=vec3(0.6,0.85,1.0)*step(0.5,fract(p.x*9.0))*0.9; }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,uC.x,uB.z); }'
    ].join('\n'),
    parts: [
      { n: '100', name: 'Outer resonant cavity wall', at: [0.78, 0.47, -0.1], text: 'The charged outer skin. Microwaves in the cavity make it vibrate in an “accelerated mode”. Ordinary aluminum or copper, or cryogenically cooled superconductor (YBCO or niobium).' },
      { n: '150', name: 'Resonant cavity, filled with xenon 155', at: [-0.95, 0.3, 0], cut: true, text: 'The gap between the two walls, an annular duct that wraps the whole craft as the resonant cavity shroud 156. A noble gas fills it; xenon is the patent’s choice, for its plasma phase transition.' },
      { n: '200', name: 'Inner resonant cavity wall', at: [-0.32, 0.49, 0], cut: true, text: 'Electrically insulated so that it does not vibrate. Only the outer wall moves.' },
      { n: '300', name: 'Microwave emitters', at: [1.4, 0.118, 0], cut: true, text: 'Antennas inside the cavity, 300 MHz to 300 GHz. They fill the cavity with high-frequency electromagnetic waves 50. The patent’s preferred emitter is Pais’s own field generator.' },
      { n: '25', name: 'Frustum, rotates on axis 26', at: [1.7, 0.085, -0.02], text: 'A cone on the leading portion that can rotate about its own axis. In this embodiment the trailing portion mirrors the leading one.' },
      { n: '55', name: 'Crew compartment', at: [0.5, 0.06, 0.19], cut: true, text: 'Surrounded by the cavity and shielded by a Faraday cage.' },
      { n: '57', name: 'Cargo bay', at: [0.135, -0.07, 0.2], cut: true, text: 'Shown inside the same shielded module as the crew compartment.' },
      { n: '56', name: 'Power plant system', at: [-0.44, 0.0, 0.165], cut: true, text: 'Feeds the emitters. The patent does not say what kind; Pais’s compact fusion device was filed two years later.' },
      { n: '58', name: 'Faraday-type cage', at: [-0.2, 0.17, 0.205], cut: true, text: 'Guards the crew, power plant and cargo “against all EM radiation effects”.' },
      { n: '60', name: 'Local polarized vacuum', at: [-0.25, 0.88, -0.05], text: 'The claimed effect: a sheath of polarized vacuum just outside the vibrating wall that lowers the craft’s inertial mass and pushes air or water aside.' }
    ],
    steps: [
      { d: 5, label: 'Emitters on', text: 'The microwave emitters 300 at each tip fill the cavity with high-frequency electromagnetic waves.' },
      { d: 5, label: 'Wall vibrates', text: 'The xenon in the cavity turns to plasma and the charged outer wall 100 vibrates in an accelerated mode. The insulated inner wall stays still.' },
      { d: 5, label: 'Polarized vacuum', text: 'The patent says this creates a local polarized vacuum 60 just outside the hull, reducing the craft’s inertial mass.' },
      { d: 6, label: 'Steering', text: 'To climb, only the top sections of the shroud (121 and 222) are vibrated, and the polarized vacuum moves the craft upward.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), steer = smooth(15, 16.6, tt) * k;
      return { A: [smooth(0.2, 1.6, tt) * k, smooth(5, 7.4, tt) * k, smooth(10, 12.4, tt) * k, 0], B: [steer, 0, steer], rate: [steer * 0.9, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 0], B: [0, 0, 0], rate: [0, 0, 0, 0] }
  };
})();
