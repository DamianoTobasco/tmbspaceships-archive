/* TMB 3D scene · Vacuum Bubble: the Bouyancy System teaching model, unmanned (drawing TMB-0403,
 * archive shot 0403). Built from the notes on the drawing: an avionic block diagram inside a rigid
 * body with a heated antenna at each end; a double-pulsed HV LF AC oscillatory wave pushes the air
 * away, leaving a bubble of lower pressure whose edge breathes with every pulse.
 * uA = (antenna heat, oscillatory wave, bubble, lift)  uC.x = climb */
(function () {
  'use strict';
  var P3 = window.Pais3D;
  if (!P3) return;
  var smooth = P3.smooth;
  P3.scenes['tmb-bubble'] = {
    title: 'Vacuum Bubble, the buoyancy system teaching model',
    fig: 'After drawing TMB-0403 (shot 0403), a “Crayola aided drawing”',
    from: 'the notes on the original drawing',
    partsNote: 'named as on the drawing',
    claim: 'Shown working the way the drawing’s notes describe it.',
    cam: { yaw: 0.45, pitch: 0.26, sway: 0.3, yawNarrow: 1.0 },
    fit: { hw: 2.25, hh: 1.3, hwNarrow: 1.5 },
    cutModes: [{ label: 'Quarter cut', cut: 1, qt: 1 }, { label: 'Half section', cut: 1, qt: 0 }, { label: 'Body closed', cut: 0, qt: 0 }],
    glsl: [
      '#define FAR 15.0',
      '#define GLOWK 2.4',
      'const float HX=0.85; const float RB=0.4; const float BG=0.5;',                      // body half-length and radius, gap out to the bubble edge
      'float cutD(vec3 p){ return min(p.z-mix(2.8,0.0,uCut), p.y-mix(-2.8,0.0,uB.w)); }',
      'float pill(vec3 p){ p.x-=clamp(p.x,-HX,HX); return length(p)-RB; }',
      // the double pulse: two quick beats, then a rest
      'float pulse(){ float ph=fract(uT*0.8); float a=(ph-0.12)/0.05; float b=(ph-0.3)/0.05; return exp(-a*a)+exp(-b*b); }',
      'vec2 map(vec3 p){',
      '  float cz=cutD(p); float dp=pill(p); float ax=abs(p.x);',
      '  vec2 res=vec2(max(abs(dp+0.012)-0.012,cz),1.0);',                                  // rigid body
      // heated antenna at each end
      '  float d=min(sdRBox(vec3(ax-1.3,p.y,p.z),vec3(0.07,0.09,0.09),0.015),cylX(vec3(ax-1.47,p.y,p.z),0.03,0.14)); if(d<res.x) res=vec2(d,2.0);',
      // the avionic blocks: three above, three below, and the battery
      '  vec3 bt=vec3(p.x-0.5*clamp(floor(p.x/0.5+0.5),-1.0,1.0),p.y-0.15,p.z); vec3 bb=vec3(p.x+0.25-0.5*clamp(floor((p.x+0.25)/0.5+0.5),-1.0,1.0),p.y+0.15,p.z);',
      '  d=min(sdRBox(bt,vec3(0.2,0.11,0.17),0.015),max(sdRBox(bb,vec3(0.2,0.11,0.17),0.015),p.x-0.5)); if(d<res.x) res=vec2(d,3.0);',
      '  d=cylZ(p-vec3(0.82,-0.15,0.0),0.11,0.16)-0.01; if(d<res.x) res=vec2(d,4.0);',
      '  return res;',
      '}',
      'float edge(){ return BG+0.05*pulse()*uA.y; }',
      'float glowStep(vec3 p){ float dp=pill(p); return (dp>-0.02&&dp<1.3&&(uA.x+uA.y>0.01))?0.035+0.1*max(dp-BG,0.0):9.0; }',
      'vec3 glow(vec3 p){',
      '  vec3 g=vec3(0.0); float dp=pill(p); if(cutD(p)>0.0||dp<0.0) return g;',
      '  float ax=abs(p.x); float e=edge(); float pu=pulse();',
      '  vec3 n=vec3(ax-1.52,p.y,p.z); g+=vec3(1.0,0.65,0.25)*exp(-dot(n,n)*16.0)*uA.x*(0.8+0.3*pu*uA.y);',     // the antennas, hot
      // the oscillatory wave running out from the body, and the edge of the bubble it leaves
      '  if(dp<e) g+=vec3(0.55,0.4,1.0)*pow(0.5+0.5*sin(dp*34.0-uT*9.0),8.0)*uA.y*0.16*(1.0-0.5*uA.z);',
      '  float q=(dp-e)/0.02; g+=vec3(0.4,0.92,1.0)*exp(-q*q)*uA.z*(0.75+0.5*pu);',
      // the air outside, shoved back by each pulse
      '  if(dp>e) g+=vec3(0.45,0.6,1.0)*pow(0.5+0.5*sin((dp-e)*20.0-uT*6.4),10.0)*exp(-(dp-e)*3.4)*uA.y*(0.25+0.5*pu)*0.5;',
      '  return g;',
      '}',
      'vec3 lit(vec3 p, vec3 alb, vec3 n){ return vec3(0.0); }',
      'void material(float m, vec3 p, vec3 n, out vec3 alb, out float met, out float rgh, out vec3 emi){',
      '  alb=vec3(0.6); met=0.0; rgh=0.5; emi=vec3(0.0);',
      '  bool sect=uCut>0.02&&abs(cutD(p))<0.004&&(n.z>0.9||n.y>0.9); float hatch=hatchF(p); float ax=abs(p.x);',
      '  if(m<1.5){ if(pill(p)>-0.014){ alb=vec3(0.78,0.8,0.84); met=0.25; rgh=0.4; alb*=1.0-0.4*smoothstep(0.006,0.0,abs(fract(p.x*2.0+0.5)-0.5)/2.0); }',
      '    else { alb=vec3(0.24,0.26,0.32); rgh=0.6; }',
      '    if(sect){ alb=mix(vec3(0.95,0.72,0.36),vec3(0.7,0.5,0.22),hatch); rgh=0.85; emi=alb*0.22; } }',
      '  else if(m<2.5){ float hot=uA.x*step(1.37,ax); alb=mix(vec3(0.75,0.72,0.66),vec3(0.2),hot); rgh=0.45; emi=vec3(1.0,0.55,0.15)*hot*(1.5+0.5*pulse()*uA.y); }',
      '  else if(m<3.5){ bool top=p.y>0.0; float bx=top?clamp(floor(p.x/0.5+0.5),-1.0,1.0):clamp(floor((p.x+0.25)/0.5+0.5),-1.0,1.0); float id=bx+1.0+(top?0.0:3.0);',
      '    vec3 c=id<0.5?vec3(0.45,0.7,1.0):id<1.5?vec3(0.9,0.95,1.0):id<2.5?vec3(0.4,1.0,0.75):id<3.5?vec3(0.5,0.6,1.0):id<4.5?vec3(1.0,0.5,0.85):vec3(0.5,0.6,1.0);',
      '    alb=vec3(0.12,0.13,0.18)+c*0.06; met=0.5; rgh=0.45; float yy=abs(p.y)-0.15;',
      '    float fr=smoothstep(0.012,0.004,abs(abs(yy)-0.085))*step(0.14,p.z); emi=c*fr*(0.35+0.5*uA.y*(0.5+0.5*sin(uT*(2.0+id)+id))); }',
      '  else { alb=vec3(0.2,0.6,0.35); met=0.5; rgh=0.4; alb*=1.0-0.4*smoothstep(0.01,0.0,abs(length(p.xy-vec2(0.82,-0.15))-0.07)); emi=vec3(0.3,1.0,0.5)*0.08; }',
      '}',
      'vec3 bg(vec3 rd){ return studioBg(rd,uC.x,uA.w); }'
    ].join('\n'),
    parts: [
      { n: '1', name: 'Rigid body', at: [-0.55, 0.4, -0.05], text: 'The unmanned teaching model’s hull. Everything else sits inside it.' },
      { n: '2', name: 'Heated antenna', at: [1.52, 0.04, 0.0], text: 'One at each end of the rigid body.' },
      { n: '3', name: 'Attitude command and control', at: [-0.5, 0.15, 0.17], cut: true, text: 'Attitude command and control.' },
      { n: '4', name: 'Main MCU', at: [0.0, 0.15, 0.17], cut: true, text: 'The main controller.' },
      { n: '5', name: 'Propulsive system', at: [0.5, 0.15, 0.17], cut: true, text: 'The propulsive system block.' },
      { n: '6', name: 'ESS AC buss', at: [-0.75, -0.15, 0.17], cut: true, text: 'The essential AC bus.' },
      { n: '7', name: 'Bouyancy system', at: [-0.25, -0.15, 0.17], cut: true, text: 'The block that makes the oscillatory wave.' },
      { n: '8', name: 'ESS DC buss', at: [0.25, -0.15, 0.17], cut: true, text: 'The essential DC bus.' },
      { n: '9', name: 'Battery', at: [0.82, -0.15, 0.16], cut: true, text: 'Feeds the DC bus.' },
      { n: '10', name: 'Vacuum bubble', at: [0.2, 0.9, 0.0], cut: true, text: 'The edge of the region the air has been pushed out of. The drawing plots the pressure across it: low inside, a pressure front at the edge, ambient outside.' },
      { n: '11', name: 'Air pushed away', at: [-1.0, 1.05, 0.0], text: '“Air pushed away by HV LF AC oscillatory wave.”' }
    ],
    steps: [
      { d: 4, label: 'Antennas heat', text: 'The heated antenna at each end of the rigid body comes up to temperature.' },
      { d: 5, label: 'Oscillatory wave', text: 'A double-pulsed, high-voltage, low-frequency AC oscillatory wave runs out from the body and pushes the air away.' },
      { d: 5, label: 'Vacuum bubble', text: 'That leaves a bubble of lower pressure round the body. Its edge breathes with every pulse, with a pressure front where the air is shoved back.' },
      { d: 6, label: 'Buoyancy', text: 'With less air inside the bubble than outside it, the model is buoyant.' }
    ],
    levels: function (tt, total) {
      var k = 1 - smooth(total - 0.9, total - 0.1, tt), lift = smooth(14.5, 16.5, tt) * k;
      return { A: [smooth(0.3, 2.5, tt) * k, smooth(4, 6, tt) * k, smooth(9, 11, tt) * k, lift], B: [0, 0, 0], rate: [lift * 0.7, 0, 0, 0] };
    },
    rest: { A: [1, 1, 1, 0], B: [0, 0, 0], rate: [0, 0, 0, 0] }
  };
})();
