(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lucioles : uniquement dans le hero
  if (!reduced) {
    var colors = ['var(--dot-teal)', 'var(--dot-mauve)', 'var(--dot-red)'];
    var seed = 7;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var span = function (min, max) { return Math.round(min + rnd() * (max - min)); };
    var box = document.createElement('div');
    box.className = 'fireflies';
    box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 18; i++) {
      var dot = document.createElement('span');
      var vars = {
        '--x': span(3, 97) + '%', '--y': span(8, 92) + '%',
        '--size': span(3, 5) + 'px',
        '--dur': (18 + rnd() * 9).toFixed(1) + 's',
        '--delay': (rnd() * 7).toFixed(1) + 's',
        '--tx': span(-65, 65) + 'px', '--ty': span(-55, 55) + 'px',
        '--tx2': span(-40, 40) + 'px', '--ty2': span(-50, 50) + 'px',
        '--tx3': span(-45, 45) + 'px', '--ty3': span(-40, 40) + 'px',
        '--color': colors[i % 3]
      };
      Object.keys(vars).forEach(function (k) { dot.style.setProperty(k, vars[k]); });
      box.appendChild(dot);
    }
    var hero = document.querySelector('.hero, .page-hero');
    if (hero) hero.appendChild(box);
  }

  // Parallaxe de l'image d'en-tête
  var layers = document.querySelectorAll('.parallax-layer');
  var touch = window.matchMedia('(hover: none)').matches;
  if (layers.length && !reduced && !touch) {
    var ticking = false;
    var update = function () {
      layers.forEach(function (layer) {
        var max = -parseFloat(window.getComputedStyle(layer).top) || 0;
        layer.style.transform = 'translateY(' + Math.min(window.scrollY * 0.35, max) + 'px)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  // Rangées à saisir à la souris, avec petits points de position (au doigt, le défilement reste natif)
  document.querySelectorAll('[data-glisser]').forEach(function (track) {
    var dots = track.parentNode.querySelector('.dots');
    var pressed = false, dragging = false, startX = 0, startScroll = 0;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      pressed = true; dragging = false; startX = e.clientX; startScroll = track.scrollLeft;
    });
    track.addEventListener('pointermove', function (e) {
      if (!pressed) return;
      var dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        track.dataset.glisse = '1';
        if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
      }
      if (dragging) track.scrollLeft = startScroll - dx;
    });
    function release(e) {
      if (!pressed) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      delete track.dataset.glisse;
      if (track.releasePointerCapture) track.releasePointerCapture(e.pointerId);
      var block = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
      track.addEventListener('click', block, { capture: true, once: true });
      setTimeout(function () { track.removeEventListener('click', block, true); }, 0);
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    if (!dots) return;
    var count = track.children.length;
    for (var i = 0; i < count; i++) dots.appendChild(document.createElement('i'));
    var raf = null;
    function sync() {
      raf = null;
      var travel = track.scrollWidth - track.clientWidth;
      dots.hidden = travel <= 1;
      var active = travel <= 0 || count <= 1 ? 0 : Math.round((track.scrollLeft / travel) * (count - 1));
      for (var k = 0; k < dots.children.length; k++) dots.children[k].className = k === active ? 'on' : '';
    }
    track.addEventListener('scroll', function () { if (raf === null) raf = requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });
})();
