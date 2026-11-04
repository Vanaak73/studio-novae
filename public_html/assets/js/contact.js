// Page Contact et devis : onglets, récapitulatif en direct, présélection du service (?service=slug) et envoi.
// ENVOI_PAR_SERVEUR = false : la messagerie du visiteur s'ouvre avec le message prêt (mailto), en attendant que la boîte contact@studionovae.org,
// la base MySQL et le fichier .env soient branchés. À passer à true pour envoyer au serveur (POST /api/contact, déjà en place et testé).
(function () {
  var MAIL = 'contact@studionovae.org';
  var ENVOI_PAR_SERVEUR = false;
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
  // Envoi par la messagerie du visiteur : sujet et corps composés à partir des champs.
  function lienMailto(d) {
    var sujet, corps;
    if (d.type === 'question') {
      sujet = 'Question de ' + d.nom;
      corps = ['Bonjour,', '', d.message, '', 'Nom : ' + d.nom, 'E-mail : ' + d.mail].join('\n');
    } else {
      sujet = 'Demande de devis : ' + d.services.join(', ');
      corps = [
        'Bonjour,', '',
        'Je souhaite un devis pour : ' + d.services.join(', '), '',
        'Mon besoin :', d.besoin, '',
        'Démarrage souhaité : ' + (d.delai || 'non précisé'),
        'Aides au financement : ' + (d.aide ? 'oui, à étudier avec vous' : 'non demandé'), '',
        'Nom : ' + d.nom, 'E-mail : ' + d.mail, 'Téléphone : ' + (d.tel || 'non indiqué')
      ].join('\n');
    }
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(corps);
  }
  function envoyer(formulaire, idOk, idErreur, donnees, apres) {
    if (!ENVOI_PAR_SERVEUR) {
      $(idErreur).hidden = true;
      var ouvert = $(idOk);
      ouvert.textContent = 'Votre messagerie s’ouvre avec votre message prêt à envoyer : il suffit de l’envoyer. Si rien ne s’ouvre, copiez votre message et écrivez-nous à ' + MAIL + '.';
      ouvert.hidden = false;
      window.location.href = lienMailto(donnees);
      return;
    }
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
          var ok = $(idOk);
          ok.textContent = 'Merci, votre message est bien parti. Nous vous répondons par e-mail rapidement.';
          ok.hidden = false;
          formulaire.reset();
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
