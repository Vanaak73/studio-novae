// Page Contact et devis : onglets, récapitulatif en direct, présélection du service (?service=slug) et envoi.
(function () {
  var MAIL = 'contact@studionovae.org';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  if (!$('#form-devis')) return;

  // ---- Onglets
  function selectionner(quel) {
    $('#t-devis').setAttribute('aria-selected', String(quel === 'devis'));
    $('#t-question').setAttribute('aria-selected', String(quel === 'question'));
    $('#v-devis').hidden = quel !== 'devis';
    $('#v-question').hidden = quel !== 'question';
  }
  $('#t-devis').addEventListener('click', function () { selectionner('devis'); });
  $('#t-question').addEventListener('click', function () { selectionner('question'); });
  if (location.hash === '#question') selectionner('question');

  // ---- Récapitulatif en direct
  function services() { return $$('#services-choix input:checked').map(function (i) { return i.value; }); }
  function maj() {
    var set = function (id, txt, vide) { var el = $(id); el.textContent = txt || vide; el.classList.toggle('vide', !txt); };
    set('#r-services', services().join(', '), 'À choisir');
    var b = $('#besoin').value.trim();
    set('#r-besoin', b.length > 90 ? b.slice(0, 90) + '…' : b, 'À décrire');
    set('#r-delai', $('#delai').value, 'À préciser');
    set('#r-aide', $('#aide').checked ? 'Oui, à étudier avec vous' : '', 'Facultatif');
  }
  $('#form-devis').addEventListener('input', maj);
  $('#form-devis').addEventListener('change', maj);

  // ---- Service présélectionné par les boutons « Demander un devis » des pages de service (?service=site-vitrine)
  var slug = new URLSearchParams(location.search).get('service');
  if (slug) {
    $$('#services-choix input').forEach(function (i) { i.checked = i.getAttribute('data-slug') === slug; });
  }
  maj();

  // ---- Envoi : POST /api/contact (la demande est enregistrée sur le serveur et envoyée par e-mail à Studio Novae)
  var ouverture = Date.now();
  function mailValide(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function erreur(id, texte, champ) {
    var e = $(id); e.textContent = texte; e.hidden = false;
    if (champ) champ.focus();
  }
  // Fenêtre de confirmation (popup du site, dans les couleurs du site) : Échap, clic sur le fond ou bouton « Fermer » pour la fermer.
  function confirmation(titre, texte) {
    var racine = document.querySelector('.mq') || document.body;
    var precedent = document.activeElement;
    var fond = document.createElement('div');
    fond.className = 'popup-fond';
    var boite = document.createElement('div');
    boite.className = 'popup';
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-modal', 'true');
    boite.setAttribute('aria-labelledby', 'popup-titre');
    boite.setAttribute('aria-describedby', 'popup-texte');
    var coche = document.createElement('span');
    coche.className = 'popup-coche';
    coche.setAttribute('aria-hidden', 'true');
    coche.textContent = '✓';
    var h = document.createElement('h2');
    h.id = 'popup-titre';
    h.textContent = titre;
    var p = document.createElement('p');
    p.id = 'popup-texte';
    p.textContent = texte;
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn btn-devis';
    bouton.textContent = 'Fermer';
    boite.appendChild(coche); boite.appendChild(h); boite.appendChild(p); boite.appendChild(bouton);
    fond.appendChild(boite);
    function fermer() {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = '';
      if (fond.parentNode) fond.parentNode.removeChild(fond);
      if (precedent && precedent.focus) precedent.focus();
    }
    function touche(e) {
      if (e.key === 'Escape') fermer();
      else if (e.key === 'Tab') { e.preventDefault(); bouton.focus(); } // un seul élément actif : le focus reste dans la fenêtre
    }
    bouton.addEventListener('click', fermer);
    fond.addEventListener('click', function (e) { if (e.target === fond) fermer(); });
    document.addEventListener('keydown', touche);
    document.body.style.overflow = 'hidden';
    racine.appendChild(fond);
    bouton.focus();
  }
  function envoyer(formulaire, idOk, idErreur, donnees, apres) {
    var bouton = formulaire.querySelector('button[type=submit]');
    var libelle = bouton.textContent;
    $(idErreur).hidden = true; $(idOk).hidden = true;
    bouton.disabled = true; bouton.textContent = 'Envoi en cours…';
    donnees.site = formulaire.querySelector('input[name=site]').value;
    donnees.delaiRemplissage = Date.now() - ouverture;
    var repli = ' Vous pouvez aussi nous écrire à ' + MAIL + '.';
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(donnees) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.ok, message: j.erreur }; }, function () { return { ok: false }; }); })
      .then(function (res) {
        if (res.ok) {
          formulaire.reset();
          confirmation('Message envoyé', 'Merci, votre message a bien été envoyé. Nous vous répondons par e-mail très rapidement.');
          if (apres) apres();
        } else {
          erreur(idErreur, (res.message || 'L’envoi n’a pas abouti.') + repli);
        }
      })
      .catch(function () { erreur(idErreur, 'Impossible de joindre le serveur.' + repli); })
      .then(function () { bouton.disabled = false; bouton.textContent = libelle; });
  }

  $('#form-devis').addEventListener('submit', function (e) {
    e.preventDefault();
    $('#ok-devis').hidden = true;
    var svc = services(), besoin = $('#besoin').value.trim(), nom = $('#nom').value.trim(), mail = $('#mail').value.trim();
    if (!svc.length) return erreur('#erreur-devis', 'Choisissez au moins un service.', $('#services-choix input'));
    if (!besoin) return erreur('#erreur-devis', 'Décrivez votre activité et ce que vous attendez.', $('#besoin'));
    if (!nom) return erreur('#erreur-devis', 'Indiquez votre nom.', $('#nom'));
    if (!mailValide(mail)) return erreur('#erreur-devis', 'Indiquez une adresse e-mail valide.', $('#mail'));
    envoyer(this, '#ok-devis', '#erreur-devis', {
      type: 'devis', services: svc, besoin: besoin, delai: $('#delai').value, aide: $('#aide').checked, nom: nom, mail: mail, tel: $('#tel').value.trim()
    }, maj);
  });

  $('#form-question').addEventListener('submit', function (e) {
    e.preventDefault();
    $('#ok-question').hidden = true;
    var nom = $('#q-nom').value.trim(), mail = $('#q-mail').value.trim(), message = $('#q-message').value.trim();
    if (!nom) return erreur('#erreur-question', 'Indiquez votre nom.', $('#q-nom'));
    if (!mailValide(mail)) return erreur('#erreur-question', 'Indiquez une adresse e-mail valide.', $('#q-mail'));
    if (!message) return erreur('#erreur-question', 'Écrivez votre message.', $('#q-message'));
    envoyer(this, '#ok-question', '#erreur-question', { type: 'question', nom: nom, mail: mail, message: message });
  });
})();
