/* The Blueprint / 3D switch in the page header.
 *
 * Both pages show their exhibits as blueprint sheets in the header's stage band. This puts the
 * current exhibit's 3D working model (pais3d.js + a p3d-*.js scene) in that same band instead.
 *
 *   markup    <div class="viewmode" id="viewmode"> with two buttons, data-viz="bp" and data-viz="3d"
 *   listens   'exhibit' on #hero (the page says which exhibit is showing: hero[data-exhibit])
 *   tells     'heroviz' on #hero, detail '3d' or 'bp', so the page can pause its blueprint drawing
 *   scenes    exhibit "pump" uses scene "tmb-pump" if there is one, else scene "pump"
 */
(function () {
  'use strict';
  var P3 = window.Pais3D, hero = document.getElementById('hero'), stage = document.getElementById('stage'), sw = document.getElementById('viewmode');
  if (!hero || !stage || !sw) return;
  if (!P3 || !P3.ok) { sw.hidden = true; return; }
  var box = null, inst = null, mode = 'bp', inView = true, shown = '';
  function sceneKey() {
    var name = hero.getAttribute('data-exhibit') || '';
    return P3.scenes['tmb-' + name] ? 'tmb-' + name : P3.scenes[name] ? name : null;
  }
  function run() { if (inst) { if (inView && !document.hidden) inst.start(); else inst.stop(); } }
  function mount() {
    var k = mode === '3d' ? sceneKey() : null, viz = k ? '3d' : 'bp';
    if (k !== shown) {
      if (inst) { inst.destroy(); inst = null; }
      shown = k;
      if (k) {
        if (!box) { box = document.createElement('div'); box.className = 'p3d hero3d'; stage.appendChild(box); }
        box.hidden = false;
        stage.removeAttribute('aria-hidden');
        inst = P3.create(box, k, { compact: true });
        if (!inst) { viz = 'bp'; shown = null; }
      }
      if (!shown && box) { box.hidden = true; stage.setAttribute('aria-hidden', 'true'); }
    }
    if (hero.getAttribute('data-viz') !== viz) {
      hero.setAttribute('data-viz', viz);
      hero.dispatchEvent(new CustomEvent('heroviz', { detail: viz }));
    }
    run();
  }
  function set(m, save) {
    mode = m === '3d' ? '3d' : 'bp';
    Array.prototype.forEach.call(sw.querySelectorAll('[data-viz]'), function (b) { b.setAttribute('aria-selected', b.getAttribute('data-viz') === mode ? 'true' : 'false'); });
    mount();
    if (save) { try { localStorage.setItem('hero-viz', mode); } catch (e) { /* private mode */ } }
  }
  sw.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-viz]') : null;
    if (b) set(b.getAttribute('data-viz'), true);
  });
  hero.addEventListener('exhibit', function () { if (mode === '3d') mount(); });
  hero.addEventListener('p3d-fail', function () { sw.hidden = true; set('bp'); });   // no usable WebGL: keep the blueprints
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { inView = en[0].isIntersecting; run(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', run);
  window.addEventListener('resize', function () { if (inst) inst.resize(); });
  window.Hero3D = { set: set, mode: function () { return mode; } };
  var pref = null;
  try { pref = localStorage.getItem('hero-viz'); } catch (e) { /* private mode */ }
  var want = (location.search.match(/[?&]viz=(3d|bp)\b/) || [])[1] || pref;
  hero.setAttribute('data-viz', 'bp');
  if (want === '3d') set('3d');
})();
