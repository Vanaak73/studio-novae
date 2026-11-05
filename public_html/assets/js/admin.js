// Administration : connexion, liste des conversations, fil de discussion, réponse avec pièces jointes facultatives.
// Tout le contenu reçu (e-mails, noms, objets) est inséré avec textContent / nœuds texte : aucune chaîne n'est interprétée comme du HTML.
(() => {
  'use strict';

  const meta = document.querySelector('meta[name="csrf"]');
  const CSRF = meta ? meta.content : '';
  const TAILLE_MAX = 10 * 1024 * 1024;
  const PIECES_MAX = 5;

  // Fabrique d'éléments : h('div', { classe: 'x', 'data-id': 3 }, 'texte', autreElement)
  const h = (balise, attributs = {}, ...enfants) => {
    const e = document.createElement(balise);
    for (const [cle, valeur] of Object.entries(attributs)) {
      if (valeur === false || valeur == null) continue;
      if (cle === 'classe') e.className = valeur;
      else if (cle.startsWith('sur')) e.addEventListener(cle.slice(3), valeur);
      else e.setAttribute(cle, valeur === true ? '' : valeur);
    }
    for (const enfant of enfants.flat(Infinity)) if (enfant != null && enfant !== false) e.append(enfant);
    return e;
  };
  const vider = (e) => { while (e.firstChild) e.removeChild(e.firstChild); };

  async function api(methode, url, corps) {
    const entetes = { Accept: 'application/json' };
    if (corps !== undefined) entetes['Content-Type'] = 'application/json';
    if (methode !== 'GET') entetes['X-CSRF'] = CSRF;
    const reponse = await fetch(url, { method: methode, headers: entetes, body: corps !== undefined ? JSON.stringify(corps) : undefined, credentials: 'same-origin' });
    if (reponse.status === 401 && CSRF) { location.reload(); return { code: 401, json: {} }; }
    let json = {};
    try { json = await reponse.json(); } catch { /* réponse sans JSON */ }
    return { code: reponse.status, json };
  }

  // ---- Connexion
  const formulaire = document.getElementById('connexion');
  if (formulaire) {
    const erreur = document.getElementById('erreur-connexion');
    formulaire.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      erreur.hidden = true;
      const r = await api('POST', '/admin/connexion', { email: formulaire.email.value, mdp: formulaire.mdp.value });
      if (r.code === 200) { location.reload(); return; }
      erreur.textContent = r.json.erreur || 'Connexion impossible pour le moment.';
      erreur.hidden = false;
    });
    return;
  }

  const boutonSortie = document.getElementById('deconnexion');
  if (boutonSortie) boutonSortie.addEventListener('click', async () => { await api('POST', '/admin/deconnexion', {}); location.href = '/admin/'; });

  // ---- Conversations
  const listeEl = document.getElementById('liste-conversations');
  const filEl = document.getElementById('fil');
  const compteEl = document.getElementById('compte-non-lues');
  if (!listeEl || !filEl) return;

  const etat = { filtre: 'toutes', archivees: false, selection: null, conversations: [], messagesAffiches: -1 };
  const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
  const formatCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const memeJour = (a, b) => a.toDateString() === b.toDateString();
  const initiales = (texte) => (String(texte).replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('') || '?').toUpperCase();
  const heureListe = (iso) => { const d = new Date(iso); return memeJour(d, new Date()) ? formatHeure.format(d) : formatCourt.format(d); };
  const tailleLisible = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : o >= 1024 ? `${Math.round(o / 1024)} Ko` : `${o} o`);

  // ---- Liste
  function afficherListe() {
    const toutes = etat.conversations;
    const nonLues = toutes.filter((c) => c.nonLus > 0).length;
    compteEl.textContent = nonLues ? ` · ${nonLues}` : '';
    const visibles = toutes.filter((c) => (etat.filtre === 'non_lues' ? c.nonLus > 0 : etat.filtre === 'devis' ? c.nbDemandes > 0 : true));
    vider(listeEl);
    if (!visibles.length) { listeEl.append(h('p', { classe: 'adm-vide' }, 'Les conversations apparaîtront ici dès le prochain message.')); return; }
    for (const c of visibles) {
      listeEl.append(h('button', { type: 'button', classe: 'adm-conv' + (c.id === etat.selection ? ' actif' : ''), 'aria-current': c.id === etat.selection ? 'true' : false, surclick: () => ouvrir(c.id) },
        h('span', { classe: 'adm-avatar', 'aria-hidden': 'true' }, initiales(c.nom || c.email)),
        h('span', { classe: 'adm-conv-texte' },
          h('b', {}, c.nom || c.email),
          h('small', {}, c.apercu),
          c.sansDemande ? h('span', { classe: 'adm-etiquette' }, 'sans demande') : null),
        h('span', { classe: 'adm-conv-meta' }, h('span', {}, c.dernierLe ? heureListe(c.dernierLe) : ''), c.nonLus ? h('span', { classe: 'adm-badge', 'aria-label': `${c.nonLus} non lu(s)` }, String(c.nonLus)) : null)));
    }
  }

  async function chargerListe() {
    const r = await api('GET', `/admin/api/conversations${etat.archivees ? '?archivees=1' : ''}`);
    if (r.code === 200) { etat.conversations = r.json.conversations || []; afficherListe(); }
  }

  // ---- Fil de discussion
  // Sépare les lignes citées (commençant par « > ») du texte : les citations sont repliées.
  function texteAvecCitations(corps) {
    const blocs = [];
    for (const ligne of String(corps).split('\n')) {
      const citee = /^\s*>/.test(ligne);
      const dernier = blocs[blocs.length - 1];
      if (dernier && dernier.citee === citee) dernier.lignes.push(ligne);
      else blocs.push({ citee, lignes: [ligne] });
    }
    return blocs.map((b) => (b.citee
      ? h('details', { classe: 'adm-citation' }, h('summary', {}, 'Message cité'), h('pre', {}, b.lignes.join('\n')))
      : h('p', { classe: 'adm-texte' }, b.lignes.join('\n').trim())));
  }

  function carteDemande(m) {
    const lignes = String(m.corps).split('\n').map((l) => l.match(/^([^:]+) : (.*)$/)).filter(Boolean);
    return h('article', { classe: 'adm-demande' },
      h('h4', {}, 'Demande de devis · ', formatHeure.format(new Date(m.envoyeLe))),
      h('dl', {}, lignes.map((l) => [h('dt', {}, l[1]), h('dd', {}, l[2])])));
  }

  function bulle(m, conversationId) {
    const piecesJointes = (m.piecesJointes || []).map((p) => h('a', { classe: 'adm-piece', href: `/admin/pieces/${p.id}` }, `${p.nom} (${tailleLisible(p.taille)})`));
    return h('article', { classe: `adm-msg ${m.sens === 'sortant' ? 'moi' : 'client'}` },
      m.sens === 'entrant' && m.objet ? h('small', { classe: 'adm-objet' }, m.objet) : null,
      texteAvecCitations(m.corps),
      piecesJointes.length ? h('div', { classe: 'adm-pieces' }, piecesJointes) : null,
      m.authEchec ? h('p', { classe: 'adm-alerte' }, "L'expéditeur de ce message n'a pas pu être vérifié (SPF ou DKIM). Vérifiez l'adresse avant de répondre.") : null,
      m.statutEnvoi === 'en_attente' ? h('small', { classe: 'adm-statut' }, 'Envoi en cours…') : null,
      m.statutEnvoi === 'echec' ? h('p', { classe: 'adm-alerte' }, `Envoi interrompu : ${m.erreur || 'erreur inconnue'} `, h('button', { type: 'button', classe: 'adm-lien', surclick: async () => { await api('POST', `/admin/api/conversations/${conversationId}/renvoyer/${m.id}`, {}); await ouvrir(conversationId, { garderBrouillon: true }); } }, 'Renvoyer')) : null,
      h('small', { classe: 'adm-heure' }, formatHeure.format(new Date(m.envoyeLe))));
  }

  function afficherMessages(zone, data) {
    vider(zone);
    let jourPrecedent = null;
    for (const m of data.messages) {
      const date = new Date(m.envoyeLe);
      if (!jourPrecedent || !memeJour(jourPrecedent, date)) zone.append(h('span', { classe: 'adm-jour' }, formatJour.format(date)));
      jourPrecedent = date;
      zone.append(m.nature === 'demande' ? carteDemande(m) : bulle(m, data.conversation.id));
    }
    zone.scrollTop = zone.scrollHeight;
  }

  // Pièces jointes facultatives (5 au plus, 10 Mo au total) : liste des fichiers choisis et lecture en base64.
  function gestionPieces(signaler) {
    const choisies = [];
    const saisie = h('input', { type: 'file', multiple: true, hidden: true });
    const liste = h('ul', { classe: 'adm-fichiers' });
    const afficher = () => {
      vider(liste);
      choisies.forEach((f, i) => liste.append(h('li', {}, `${f.name} (${tailleLisible(f.size)}) `, h('button', { type: 'button', classe: 'adm-lien', surclick: () => { choisies.splice(i, 1); afficher(); } }, 'Retirer'))));
    };
    saisie.addEventListener('change', () => {
      for (const f of saisie.files) choisies.push(f);
      saisie.value = '';
      const total = choisies.reduce((s, f) => s + f.size, 0);
      if (choisies.length > PIECES_MAX) { choisies.length = PIECES_MAX; signaler(`${PIECES_MAX} pièces jointes au plus.`); }
      else if (total > TAILLE_MAX) { choisies.pop(); signaler('Les pièces jointes totalisent 10 Mo au plus.'); }
      else signaler('');
      afficher();
    });
    const lireBase64 = (fichier) => new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(String(lecteur.result).split(',')[1] || '');
      lecteur.onerror = () => reject(lecteur.error);
      lecteur.readAsDataURL(fichier);
    });
    return {
      saisie, liste,
      choisir: () => saisie.click(),
      vider: () => { choisies.length = 0; afficher(); },
      lire: async () => { const sortie = []; for (const f of choisies) sortie.push({ nom: f.name, typeMime: f.type || 'application/octet-stream', base64: await lireBase64(f) }); return sortie; },
    };
  }

  function formulaireReponse(data) {
    const zoneTexte = h('textarea', { rows: '3', 'aria-label': 'Votre réponse', placeholder: 'Votre réponse…' });
    const message = h('p', { classe: 'adm-erreur', role: 'alert', hidden: true });
    const signaler = (texte) => { message.textContent = texte; message.hidden = !texte; };
    const pj = gestionPieces(signaler);
    const envoyer = h('button', { type: 'submit', classe: 'adm-bouton' }, 'Envoyer');
    const formulaire = h('form', { classe: 'adm-reponse', novalidate: true },
      zoneTexte, pj.liste, message,
      h('div', { classe: 'adm-reponse-bas' },
        h('button', { type: 'button', classe: 'adm-bouton contour', surclick: pj.choisir }, 'Joindre un fichier'), pj.saisie, envoyer));
    formulaire.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const texte = zoneTexte.value.trim();
      if (!texte) { signaler('Écrivez votre réponse.'); return; }
      envoyer.disabled = true; signaler('');
      try {
        const r = await api('POST', `/admin/api/conversations/${data.conversation.id}/reponse`, { texte, pieces: await pj.lire() });
        if (r.code !== 200) signaler(r.json.erreur || 'Envoi impossible pour le moment.');
        else { zoneTexte.value = ''; pj.vider(); await ouvrir(data.conversation.id); return; }
      } catch { signaler('Envoi impossible pour le moment.'); }
      envoyer.disabled = false;
    });
    return formulaire;
  }

  // ---- Nouveau message : popup d'écriture à une adresse qui n'a pas encore écrit
  function nouveauMessage() {
    const precedent = document.activeElement;
    const message = h('p', { classe: 'adm-erreur', role: 'alert', hidden: true });
    const signaler = (texte) => { message.textContent = texte; message.hidden = !texte; };
    const pj = gestionPieces(signaler);
    const champAdresse = h('input', { type: 'email', autocomplete: 'off', placeholder: 'adresse@exemple.fr', required: true });
    const champObjet = h('input', { type: 'text', maxlength: '300', required: true });
    const champTexte = h('textarea', { rows: '6', required: true });
    const envoyer = h('button', { type: 'submit', classe: 'adm-bouton' }, 'Envoyer');
    const annuler = h('button', { type: 'button', classe: 'adm-bouton contour' }, 'Annuler');
    const fermerBouton = h('button', { type: 'button', classe: 'adm-fermer', 'aria-label': 'Fermer' }, '×');
    const formulaire = h('form', { classe: 'adm-popup', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'adm-popup-titre', novalidate: true },
      h('h3', { id: 'adm-popup-titre' }, 'Nouveau message', fermerBouton),
      h('label', {}, 'À', champAdresse),
      h('label', {}, 'Objet', champObjet),
      h('label', {}, 'Message', champTexte),
      pj.liste, message,
      h('div', { classe: 'adm-popup-bas' },
        h('button', { type: 'button', classe: 'adm-lien', surclick: pj.choisir }, 'Joindre un fichier (facultatif)'), pj.saisie),
      h('div', { classe: 'adm-popup-actions' }, annuler, envoyer));
    const fond = h('div', { classe: 'adm-popup-fond' }, formulaire);

    function fermer() {
      document.removeEventListener('keydown', touche);
      document.body.style.overflow = '';
      fond.remove();
      if (precedent && precedent.focus) precedent.focus();
    }
    function touche(ev) {
      if (ev.key === 'Escape') { fermer(); return; }
      if (ev.key !== 'Tab') return;
      const actifs = Array.from(formulaire.querySelectorAll('input:not([hidden]), textarea, button')).filter((e) => !e.disabled);
      const premier = actifs[0], dernier = actifs[actifs.length - 1];
      if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
      else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
    }
    annuler.addEventListener('click', fermer);
    fermerBouton.addEventListener('click', fermer);
    formulaire.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const adresse = champAdresse.value.trim(), objet = champObjet.value.trim(), texte = champTexte.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) { signaler('Indiquez une adresse e-mail valide.'); champAdresse.focus(); return; }
      if (!objet) { signaler('Indiquez un objet.'); champObjet.focus(); return; }
      if (!texte) { signaler('Écrivez votre message.'); champTexte.focus(); return; }
      envoyer.disabled = true; signaler('');
      try {
        const r = await api('POST', '/admin/api/messages', { a: adresse, objet, texte, pieces: await pj.lire() });
        if (r.json.conversationId) { fermer(); await ouvrir(r.json.conversationId); return; }
        signaler(r.json.erreur || 'Envoi impossible pour le moment.');
      } catch { signaler('Envoi impossible pour le moment.'); }
      envoyer.disabled = false;
    });
    document.addEventListener('keydown', touche);
    document.body.style.overflow = 'hidden';
    document.body.append(fond);
    champAdresse.focus();
  }
  const boutonNouveau = document.getElementById('nouveau-message');
  if (boutonNouveau) boutonNouveau.addEventListener('click', nouveauMessage);

  function afficherFil(data, { garderBrouillon = false } = {}) {
    const brouillon = garderBrouillon ? filEl.querySelector('textarea') : null;
    const texteBrouillon = brouillon ? brouillon.value : '';
    vider(filEl);
    const coordonnees = (data.coordonnees || []).map((c) => `${c.valeur}`).join(' · ');
    const zone = h('div', { classe: 'adm-messages', id: 'messages' });
    filEl.append(
      h('div', { classe: 'adm-fil-tete' },
        h('button', { type: 'button', classe: 'adm-retour', 'aria-label': 'Retour à la liste', surclick: () => { document.body.classList.remove('vue-fil'); } }, '←'),
        h('div', { classe: 'adm-fil-id' }, h('b', {}, data.messages.find((m) => m.nature === 'demande' && m.objet)?.objet || data.utilisateur.email), h('small', {}, [data.utilisateur.email, coordonnees].filter(Boolean).join(' · '))),
        h('button', { type: 'button', classe: 'adm-pastille', surclick: async () => { await api('POST', `/admin/api/conversations/${data.conversation.id}/archiver`, { valeur: !data.conversation.archivee }); etat.selection = null; document.body.classList.remove('vue-fil'); vider(filEl); filEl.append(h('div', { classe: 'adm-vide' }, 'Choisissez une conversation dans la liste.')); await chargerListe(); } }, data.conversation.archivee ? 'Désarchiver' : 'Archiver')),
      zone);
    afficherMessages(zone, data);
    const formulaire = formulaireReponse(data);
    filEl.append(formulaire);
    if (texteBrouillon) formulaire.querySelector('textarea').value = texteBrouillon;
    etat.messagesAffiches = data.messages.length;
  }

  async function ouvrir(id, options = {}) {
    const r = await api('GET', `/admin/api/conversations/${id}`);
    if (r.code !== 200) return;
    etat.selection = id;
    document.body.classList.add('vue-fil');
    afficherFil(r.json, options);
    await chargerListe();
  }

  // ---- Filtres et actualisation
  document.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => {
    etat.filtre = b.dataset.filtre;
    document.querySelectorAll('[data-filtre]').forEach((x) => x.classList.toggle('actif', x === b));
    afficherListe();
  }));
  document.getElementById('archivees').addEventListener('change', (ev) => { etat.archivees = ev.target.checked; chargerListe(); });

  // Actualisation : la liste s'affiche tout de suite, puis la boîte est relevée (à l'ouverture, puis toutes les 15 s tant que la page est visible).
  // Quand une réponse de client arrive, la liste et le fil ouvert se mettent à jour ; le brouillon en cours de saisie est conservé.
  const INTERVALLE_MS = 15000;
  async function actualiser() {
    if (document.visibilityState !== 'visible') return;
    await api('POST', '/admin/api/actualiser', {});
    await chargerListe();
    if (etat.selection) {
      const r = await api('GET', `/admin/api/conversations/${etat.selection}`);
      if (r.code === 200 && r.json.messages.length !== etat.messagesAffiches) afficherFil(r.json, { garderBrouillon: true });
    }
  }
  chargerListe().then(actualiser);
  setInterval(actualiser, INTERVALLE_MS);
  document.addEventListener('visibilitychange', actualiser);
})();
