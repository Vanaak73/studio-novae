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
    for (var i = 0; i < 28; i++) { // les 4 dernières renforcent le quart haut-gauche
      var dot = document.createElement('span');
      // Temps de trajet propre à chaque luciole : 24 s ± 0,5 s × X (X entier de -24 à 24, soit 12 à 36 s).
      // Les déplacements des cycles courts sont réduits en proportion (jamais plus rapides que le cycle de 22,5 s) ; ceux des cycles longs restent inchangés.
      var dur = 24 + 0.5 * Math.round(-24 + rnd() * 48);
      var f = Math.min(1, dur / 22.5);
      var vars = {
        '--x': (i < 24 ? span(3, 97) : span(3, 48)) + '%', '--y': (i < 24 ? span(8, 92) : span(8, 48)) + '%',
        '--size': span(4, 8) + 'px',
        '--dur': dur.toFixed(1) + 's',
        '--delay': '-' + (dur * (0.2 + rnd() * 0.6)).toFixed(1) + 's', // départ en cours de cycle : visibles dès le chargement
        '--pulse': (1.6 + rnd() * 3.4).toFixed(1) + 's', '--pulse-delay': (-rnd() * 5).toFixed(1) + 's',
        '--tx': span(-65 * f, 65 * f) + 'px', '--ty': span(-55 * f, 55 * f) + 'px',
        '--tx2': span(-40 * f, 40 * f) + 'px', '--ty2': span(-50 * f, 50 * f) + 'px',
        '--tx3': span(-45 * f, 45 * f) + 'px', '--ty3': span(-40 * f, 40 * f) + 'px',
        '--color': colors[i % 3]
      };
      Object.keys(vars).forEach(function (k) { dot.style.setProperty(k, vars[k]); });
      box.appendChild(dot);
    }
    var hero = document.querySelector('.hero, .page-hero');
    if (hero) hero.appendChild(box);
  }

  // Titre de l'accueil : il se déchiffre. Chaque lettre défile en caractères de code (bleu lumineux), puis se fixe sur la vraie lettre, de gauche à droite, avec une brève lueur.
  // Pas d'effet pour « réduire les animations » ni pour les robots (le titre est alors affiché tel quel). Le texte complet reste dans aria-label ; lettres décoratives.
  var titreDc = document.querySelector('.accueil .hero h1');
  if (titreDc) {
    var robotDc = /bot|crawl|spider|slurp|lighthouse|pagespeed|facebookexternalhit/i.test(navigator.userAgent);
    if (reduced || robotDc) {
      titreDc.classList.add('dc-pret');
    } else {
      titreDc.setAttribute('aria-label', titreDc.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      var lettresDc = [];
      var decouperDc = function (noeud) {
        Array.prototype.slice.call(noeud.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.tagName !== 'BR') { decouperDc(n); return; }
          if (n.nodeType !== 3) return;
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var mot = document.createElement('span');
            mot.className = 'dc-mot';
            mot.setAttribute('aria-hidden', 'true');
            part.split('').forEach(function (c) {
              var l = document.createElement('span');
              l.className = 'dc-l';
              l.textContent = c;
              mot.appendChild(l);
              lettresDc.push({ el: l, c: c });
            });
            frag.appendChild(mot);
          });
          noeud.replaceChild(frag, n);
        });
      };
      decouperDc(titreDc);
      // Déroulé : 1 s d'attente, un curseur clignote (CLIGNOTEMENTS_DEBUT fois ; aucune fois sur téléphone), puis les lettres sont déchiffrées UNE À UNE (le curseur avance), enfin le curseur clignote (CLIGNOTEMENTS_FIN fois) et disparaît.
      // Sur téléphone (650 px et moins), le déroulé est deux fois plus rapide : attente, clignotements et lettres deux fois plus courts, 2 clignotements finaux au lieu de 5.
      var tel = window.matchMedia('(max-width: 650px)').matches;
      var ATTENTE = tel ? 500 : 1000, CLIGNOTE_ON = tel ? 440 : 880, CLIGNOTE_OFF = tel ? 440 : 880, PAR_LETTRE = tel ? 45 : 90, CLIGNOTEMENTS_DEBUT = tel ? 0 : 1, CLIGNOTEMENTS_FIN = tel ? 2 : 5;
      var lancerDc = function () {
        // Largeur de chaque lettre figée avant l'effet : le titre ne bouge pas.
        lettresDc.forEach(function (l) { l.w = l.el.getBoundingClientRect().width; });
        lettresDc.forEach(function (l) { l.el.style.width = l.w + 'px'; l.el.classList.add('dc-cache'); });
        // Position de la ligne de base dans une lettre : le curseur est calé dessus (du haut des capitales au bas des queues), pas sur la boîte de ligne.
        var sonde = document.createElement('span');
        sonde.style.cssText = 'display:inline-block;width:0;height:0';
        lettresDc[0].el.appendChild(sonde);
        var base = sonde.getBoundingClientRect().top - lettresDc[0].el.getBoundingClientRect().top;
        lettresDc[0].el.removeChild(sonde);
        var taille = parseFloat(window.getComputedStyle(titreDc).fontSize);
        var curseur = document.createElement('span');
        curseur.className = 'dc-curseur';
        curseur.setAttribute('aria-hidden', 'true');
        titreDc.appendChild(curseur);
        titreDc.classList.add('dc-pret');
        var glyphes = '01<>/{}[]#$%&*+=?'.split('');
        var n = lettresDc.length, debutLettres = ATTENTE + CLIGNOTEMENTS_DEBUT * (CLIGNOTE_ON + CLIGNOTE_OFF), finLettres = debutLettres + n * PAR_LETTRE;
        var posee = -1, reglee = -1;
        var placer = function (l, apres) {
          var r = l.el.getBoundingClientRect(), h = titreDc.getBoundingClientRect();
          curseur.style.left = (r.left - h.left + (apres ? r.width : 0)) + 'px';
          curseur.style.top = (r.top - h.top + base - 0.76 * taille) + 'px';
          curseur.style.height = (0.88 * taille) + 'px';
        };
        // Clignote nb fois à partir de t = 0 : allumé, éteint, allumé, éteint… ; renvoie true si le curseur est allumé.
        var clignote = function (t, nb) {
          var cycle = CLIGNOTE_ON + CLIGNOTE_OFF;
          return t >= 0 && t < nb * cycle && (t % cycle) < CLIGNOTE_ON;
        };
        var t0 = performance.now();
        var image = function (now) {
          var t = now - t0, on = false;
          if (t < debutLettres) {
            if (t >= ATTENTE) { if (reglee !== 0) { placer(lettresDc[0], false); reglee = 0; } on = clignote(t - ATTENTE, CLIGNOTEMENTS_DEBUT); }
          } else if (t < finLettres) {
            var k = Math.floor((t - debutLettres) / PAR_LETTRE);
            if (k !== posee) {
              if (posee >= 0) { var p = lettresDc[posee]; p.el.textContent = p.c; p.el.classList.remove('dc-brouille'); }
              var l = lettresDc[k];
              l.el.classList.remove('dc-cache'); l.el.classList.add('dc-brouille');
              placer(l, false); posee = k;
            }
            if (Math.floor((t - debutLettres) / 30) !== lettresDc[k].tic) {
              lettresDc[k].tic = Math.floor((t - debutLettres) / 30);
              lettresDc[k].el.textContent = glyphes[Math.floor(Math.random() * glyphes.length)];
            }
            on = true;
          } else {
            if (posee !== n - 1 || lettresDc[n - 1].el.classList.contains('dc-brouille')) {
              var d = lettresDc[n - 1]; d.el.textContent = d.c; d.el.classList.remove('dc-brouille'); posee = n - 1;
              placer(d, true);
            }
            on = clignote(t - finLettres, CLIGNOTEMENTS_FIN);
            if (t - finLettres >= CLIGNOTEMENTS_FIN * (CLIGNOTE_ON + CLIGNOTE_OFF)) { curseur.parentNode.removeChild(curseur); return; }
          }
          curseur.classList.toggle('dc-on', on);
          window.requestAnimationFrame(image);
        };
        window.requestAnimationFrame(image);
      };
      // Les polices viennent d'une feuille Google Fonts chargée en différé : document.fonts.ready répond avant qu'elle soit appliquée. La largeur de chaque lettre
      // serait alors mesurée avec la police de repli, puis figée : les lettres de Space Grotesk se retrouveraient collées ou irrégulièrement espacées.
      // On attend donc la feuille, puis la police elle-même (2,5 s au plus : au-delà, le titre démarre quand même).
      var attendrePolice = function () {
        return new Promise(function (resolve) {
          var fini = false;
          var fin = function () { if (!fini) { fini = true; resolve(); } };
          setTimeout(fin, 2500);
          var apresFeuille = function () {
            if (!document.fonts || !document.fonts.load) { fin(); return; }
            Promise.all([document.fonts.load('300 1em "Space Grotesk"'), document.fonts.load('500 1em "Space Grotesk"')])
              .then(function () { return document.fonts.ready; }).then(fin, fin);
          };
          var feuille = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
          var attendre = function () {
            if (fini) return;
            if (feuille.rel === 'stylesheet' && feuille.sheet) apresFeuille(); else setTimeout(attendre, 50); // d'abord « preload », puis « stylesheet »
          };
          if (feuille) attendre(); else apresFeuille();
        });
      };
      attendrePolice().then(lancerDc);
    }
  }

  // En-tête : fixe en haut tant que l'image d'accueil est visible, puis il se cache en descendant et réapparaît en remontant
  var entete = document.querySelector(".site-header");
  if (entete) {
    var accueil = document.querySelector(".hero, .page-hero");
    var dernier = window.scrollY, attente = false;
    var majEntete = function () {
      var y = window.scrollY;
      var finAccueil = accueil ? accueil.offsetTop + accueil.offsetHeight : 0;
      if (y <= Math.max(0, finAccueil - entete.offsetHeight)) {
        // Sur l'image d'accueil : l'en-tête reste visible, avec son fond bleu nuit translucide dès le premier défilement
        entete.classList.remove("cache");
        entete.classList.toggle("plein", y > 2);
      } else if (y < dernier - 2) {
        entete.classList.remove("cache");
        entete.classList.add("plein");
      } else if (y > dernier + 2) {
        entete.classList.add("cache");
      }
      dernier = y; attente = false;
    };
    window.addEventListener("scroll", function () {
      if (!attente) { window.requestAnimationFrame(majEntete); attente = true; }
    }, { passive: true });
    entete.addEventListener("focusin", function () { entete.classList.remove("cache"); });
    majEntete();
    // Rechargement (F5) ou retour dans l'historique : la position de défilement est restaurée après le premier calcul.
    // Sous l'accueil, l'en-tête est visible avec son fond ; ensuite le comportement normal reprend.
    var resynchroniserEntete = function () {
      var y = window.scrollY;
      dernier = y;
      var finAccueil = accueil ? accueil.offsetTop + accueil.offsetHeight : 0;
      if (y <= Math.max(0, finAccueil - entete.offsetHeight)) {
        entete.classList.remove("cache");
        entete.classList.toggle("plein", y > 2);
      } else {
        entete.classList.remove("cache");
        entete.classList.add("plein");
      }
    };
    window.addEventListener("load", function () { resynchroniserEntete(); setTimeout(resynchroniserEntete, 250); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) resynchroniserEntete(); });
  }

  // Relais des boutons « Demander un devis » : dès que celui de l'accroche atteint la position de celui de l'en-tête, on bascule
  var boutonEntete = document.querySelector(".nav-devis");
  var boutonAccroche = document.querySelector(".hero-actions .btn-devis");
  if (boutonEntete && boutonAccroche) {
    var racine = document.documentElement;
    var relaisEnAttente = false;
    var majRelais = function () {
      relaisEnAttente = false;
      if (window.getComputedStyle(boutonEntete).display === "none") { racine.classList.remove("devis-haut"); return; }
      var haut = boutonEntete.getBoundingClientRect().top;
      var bas = boutonAccroche.getBoundingClientRect().top;
      racine.classList.toggle("devis-haut", bas <= haut);
    };
    var planifierRelais = function () { if (!relaisEnAttente) { relaisEnAttente = true; window.requestAnimationFrame(majRelais); } };
    window.addEventListener("scroll", planifierRelais, { passive: true });
    window.addEventListener("resize", planifierRelais);
    window.addEventListener("load", planifierRelais);
    majRelais();
  } else if (boutonEntete && (document.body.classList.contains("page-service") || document.body.classList.contains("page-contact"))) {
    // Pages de service et page Contact : le bouton de l'en-tête est toujours visible (celui du héros reste en plus sur les pages de service)
    document.documentElement.classList.add("devis-haut");
  }

  // Parallaxe de l'image d'en-tête
  var layers = document.querySelectorAll('.parallax-layer');
  if (layers.length && !reduced) {
    var ticking = false;
    var update = function () {
      layers.forEach(function (layer) {
        var max = -parseFloat(window.getComputedStyle(layer).top) || 0;
        layer.style.transform = 'translateY(' + Math.max(0, Math.min(window.scrollY * 0.35, max)) + 'px)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  // Apparition au défilement : chaque bloc des sections (hors héros) se révèle une fois, quand il entre à l'écran.
  // Les éléments d'une grille ou d'une rangée arrivent l'un après l'autre, colonne par colonne.
  // Pas d'animation pour les robots (Google, Bing…) ni pour une fenêtre démesurée (rendu des robots : plusieurs milliers de pixels de haut) :
  // tout le contenu y reste visible, sans attendre un défilement qui n'aura jamais lieu.
  var robot = /bot|crawl|spider|slurp|lighthouse|pagespeed|facebookexternalhit/i.test(navigator.userAgent) || window.innerHeight > 3000;
  if (!reduced && !robot && 'IntersectionObserver' in window) {
    var groupes = '.tuiles, .etapes, .formules, .appel, .see-also, .suite, .colonnes';
    var cibles = [];
    var ajouter = function (el, delai) { cibles.push({ el: el, delai: delai }); };
    document.querySelectorAll('main section').forEach(function (section) {
      if (section.matches('.hero, .page-hero')) return;
      var racine = section.querySelector(':scope > .c, :scope > .zone-tuiles') || section;
      Array.prototype.forEach.call(racine.children, function (bloc) {
        if (!bloc.matches(groupes)) { ajouter(bloc, 0); return; }
        var enfants = Array.prototype.slice.call(bloc.children);
        if (!enfants.length) return;
        var colonnes = enfants.filter(function (e) { return e.offsetTop === enfants[0].offsetTop; }).length;
        enfants.forEach(function (e, i) { ajouter(e, (i % Math.max(colonnes, 1)) * 0.1); });
      });
    });

    var fin = function (el) {
      el.classList.remove('rv', 'vu');
      el.style.removeProperty('--rv-delai');
    };
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        // Un bloc déjà passé (page rechargée plus bas) apparaît sans attendre
        if (!entree.isIntersecting && entree.boundingClientRect.top >= 0) return;
        var el = entree.target;
        observateur.unobserve(el);
        var delai = parseFloat(el.dataset.rvDelai) || 0;
        el.style.setProperty('--rv-delai', delai + 's');
        el.classList.add('vu');
        // À la fin de la transition, le bloc retrouve ses propres transitions (survols des tuiles, etc.)
        var termine = false;
        var nettoyer = function () { if (!termine) { termine = true; fin(el); } };
        el.addEventListener('transitionend', function (e) { if (e.propertyName === 'transform' && e.target === el) nettoyer(); });
        setTimeout(nettoyer, (delai + 0.7) * 1000 + 400);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    cibles.forEach(function (c) {
      c.el.classList.add('rv');
      c.el.dataset.rvDelai = c.delai;
      observateur.observe(c.el);
    });
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

// Liens d'ancre (#services, #top…) : la page défile jusqu'à la section, l'adresse reste propre (jamais de # dans l'URL)
(function () {
  var propre = function () { history.replaceState(null, '', location.pathname + location.search); };
  var aller = function (id) {
    var cible = id ? document.getElementById(id) : null;
    if (cible) cible.scrollIntoView(); else window.scrollTo(0, 0);
    propre();
  };
  // Arrivée sur une page avec une ancre (depuis une autre page) : on défile puis on nettoie l'adresse
  if (location.hash) {
    var id = decodeURIComponent(location.hash.slice(1));
    window.addEventListener('load', function () { setTimeout(function () { aller(id === 'top' ? '' : id); }, 0); });
  }
  // Ancre saisie dans l'adresse de la page déjà ouverte
  window.addEventListener('hashchange', function () { if (location.hash) { var h = decodeURIComponent(location.hash.slice(1)); aller(h === 'top' ? '' : h); } });
  // Clic sur une ancre de la page courante
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (!u.hash || u.origin !== location.origin || u.pathname !== location.pathname) return;
    e.preventDefault();
    var id = decodeURIComponent(u.hash.slice(1));
    aller(id === 'top' ? '' : id);
  });
})();

// Menu burger (650 px et moins) : le bouton de l'en-tête ouvre le panneau plein écran, la croix, la touche Échap ou un clic sur un lien le ferment.
(function () {
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('menu-mobile');
  if (!burger || !menu) return;
  var racine = document.documentElement;
  var fermer = menu.querySelector('.menu-fermer');
  menu.setAttribute('tabindex', '-1');
  var ouvert = function () { return menu.classList.contains('ouvert'); };
  var ouvrir = function () {
    menu.classList.add('ouvert');
    racine.classList.add('menu-ouvert');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fermer le menu');
    menu.focus(); // le panneau reçoit le focus (Tab passe ensuite d'un lien à l'autre, sans cadre sur la croix)
  };
  var clore = function (rendreFocus) {
    menu.classList.remove('ouvert');
    racine.classList.remove('menu-ouvert');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    if (rendreFocus) burger.focus();
  };
  burger.addEventListener('click', function () { if (ouvert()) clore(true); else ouvrir(); });
  if (fermer) fermer.addEventListener('click', function () { clore(true); });
  menu.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) clore(false); // un lien vers une ancre de la page courante se défile ensuite normalement
  });
  document.addEventListener('keydown', function (e) {
    if (!ouvert()) return;
    if (e.key === 'Escape') { clore(true); return; }
    if (e.key !== 'Tab') return;
    // le focus reste dans le panneau tant qu'il est ouvert
    var cibles = Array.prototype.slice.call(menu.querySelectorAll('a[href], button')).filter(function (c) { return c.offsetParent !== null; });
    if (!cibles.length) return;
    var premier = cibles[0], dernier = cibles[cibles.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  });
  // si la fenêtre devient plus large que le téléphone, le panneau se ferme
  window.addEventListener('resize', function () { if (ouvert() && window.innerWidth > 650) clore(false); });
})();
