// Questionnaire du hub /aide-creation-site-web/ : région, ancienneté, projet. Le dernier clic mène à la page de la région.
// Les données viennent de window.AIDES (écrit dans la page par aides-src/generer.js).
(function () {
  var D = window.AIDES;
  var vue = document.getElementById('vue');
  var etapesEl = document.getElementById('etapes');
  if (!D || !vue || !etapesEl) return;

  var CREATION = [
    { id: 'avant', titre: 'En préparation', detail: 'Création à venir' },
    { id: 'moins6', titre: 'Moins de 6 mois', detail: 'Tout juste lancée' },
    { id: 'moins2', titre: '6 mois à 2 ans', detail: 'Activité en démarrage' },
    { id: 'plus2', titre: 'Plus de 2 ans', detail: 'Activité installée' }
  ];
  var BESOINS = [
    { id: 'site', titre: 'Site vitrine' },
    { id: 'outil', titre: 'Outil sur mesure' },
    { id: 'boutique', titre: 'Boutique en ligne' },
    { id: 'ia', titre: 'Automatisation & IA' }
  ];
  var etat = { etape: 1, region: null, creation: null, besoin: null };

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function regionDe(nom) { return D.regions.filter(function (r) { return r.nom === nom; })[0]; }
  function reponses() { return [etat.region, etat.creation, etat.besoin]; }

  // Les réponses restent en mémoire de l'onglet : on peut revenir en arrière et modifier un choix sans les perdre
  function sauver() { try { sessionStorage.setItem('aides-reponses', JSON.stringify({ region: etat.region, creation: etat.creation, besoin: etat.besoin })); } catch (e) {} }
  function relire() {
    try {
      var r = JSON.parse(sessionStorage.getItem('aides-reponses') || 'null');
      if (r && regionDe(r.region)) { etat.region = r.region; etat.creation = r.creation; etat.besoin = r.besoin; }
    } catch (e) {}
  }

  // Historique : chaque étape est une entrée de l'historique (même adresse, sans #), le bouton Retour du navigateur revient donc à l'étape précédente
  function memoriser(remplacer) {
    var s = { az: 1, etape: etat.etape };
    if (remplacer) history.replaceState(s, '', location.pathname + location.search);
    else history.pushState(s, '', location.pathname + location.search);
  }
  window.addEventListener('popstate', function (e) {
    etat.etape = e.state && e.state.az ? e.state.etape : 1;
    rendre();
  });

  function rendreEtapes() {
    var noms = ['Région', 'Création', 'Besoin'];
    var rep = reponses();
    var coche = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
    etapesEl.innerHTML = noms.map(function (n, i) {
      var num = i + 1;
      var fait = !!rep[i] && etat.etape !== num;
      var classe = etat.etape === num ? 'actif' : (fait ? 'fait' : '');
      var accessible = num === 1 || !!rep[num - 2];
      var trait = num < noms.length ? '<span class="qs-trait ' + (rep[i] ? 'fait' : '') + '"></span>' : '';
      return '<button class="qs-etape ' + classe + '"' + (accessible ? '' : ' disabled') + ' data-etape="' + num + '" aria-label="Étape ' + num + ' : ' + n + '"' + (etat.etape === num ? ' aria-current="step"' : '') + '><span class="qs-rond">' + (fait ? coche : num) + '</span>' + n + '</button>' + trait;
    }).join('');
    Array.prototype.forEach.call(etapesEl.querySelectorAll('.qs-etape:not(:disabled)'), function (b) {
      b.onclick = function () { aller(Number(b.dataset.etape)); };
    });
  }

  function aller(n) { etat.etape = n; sauver(); memoriser(false); rendre(); }

  function bouton(valeur, texte, detail, choisi) {
    return '<button data-v="' + esc(valeur) + '"' + (choisi ? ' class="choisi" aria-pressed="true"' : '') + '>' + texte + (detail ? '<small>' + detail + '</small>' : '') + '</button>';
  }

  function rendre() {
    rendreEtapes();
    if (etat.etape === 1) {
      vue.innerHTML = '<p class="qs-question">Dans quelle région se trouve votre entreprise ?</p><div class="qs-choix">' +
        D.regions.map(function (r) { return bouton(r.nom, esc(r.nom), '', r.nom === etat.region); }).join('') + '</div>';
      Array.prototype.forEach.call(vue.querySelectorAll('button[data-v]'), function (b) { b.onclick = function () { etat.region = b.dataset.v; aller(2); }; });
    } else if (etat.etape === 2) {
      vue.innerHTML = '<p class="qs-question">Où en est votre entreprise ?</p><div class="qs-choix">' +
        CREATION.map(function (c) { return bouton(c.id, c.titre, c.detail, c.id === etat.creation); }).join('') +
        '</div><button class="qs-retour" id="retour">← Changer de région</button>';
      Array.prototype.forEach.call(vue.querySelectorAll('button[data-v]'), function (b) { b.onclick = function () { etat.creation = b.dataset.v; aller(3); }; });
      document.getElementById('retour').onclick = function () { aller(1); };
    } else {
      vue.innerHTML = '<p class="qs-question">Quel site ou quel outil souhaitez-vous ?</p><div class="qs-choix">' +
        BESOINS.map(function (b) { return bouton(b.id, b.titre, '', b.id === etat.besoin); }).join('') +
        '</div><button class="qs-retour" id="retour">← Retour</button>';
      Array.prototype.forEach.call(vue.querySelectorAll('button[data-v]'), function (b) {
        b.onclick = function () {
          etat.besoin = b.dataset.v;
          sauver(); // le retour depuis la page de la région retrouve les trois réponses
          b.classList.add('choisi');
          location.href = '/aide-creation-site-web/' + regionDe(etat.region).slug + '/';
        };
      });
      document.getElementById('retour').onclick = function () { aller(2); };
    }
  }

  // Retour sur le hub (bouton Retour depuis une page région, rechargement) : on retrouve les réponses données
  relire();
  etat.etape = history.state && history.state.az ? history.state.etape : 1;
  if (!(history.state && history.state.az)) memoriser(true);
  rendre();
})();
