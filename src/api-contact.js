// API de la page Contact : POST /api/contact. Valide la demande, l'enregistre sur le serveur (base MySQL si elle est configurée, src/base.js, et
// fichier demandes.jsonl), puis envoie un e-mail à contact@studionovae.org (src/courriel.js) en arrière-plan. La demande n'est jamais perdue :
// si la base ou l'e-mail échoue, elle reste dans le fichier.
// DATA_DIR : dossier des demandes (défaut : data/ à la racine du projet). Sur un hébergement dont le disque est effacé à chaque mise en ligne
// (Render gratuit), pointer DATA_DIR vers un disque persistant.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MAIL } = require('./site');
const { LIBELLES } = require('./pages/contact');
const courriel = require('./courriel');
const base = require('./base');

const DOSSIER = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FICHIER = path.join(DOSSIER, 'demandes.jsonl');
const TAILLE_MAX = 20 * 1024;
const DELAIS = ['Dès que possible', 'Dans les 3 mois', "Dans l'année", 'Je me renseigne'];
const SERVICES_VALIDES = Object.values(LIBELLES);

// Limite par adresse IP : 6 envois acceptés par heure (les demandes refusées pour une erreur de saisie ne comptent pas).
const historique = new Map();
const recents = (ip) => (historique.get(ip) || []).filter((t) => Date.now() - t < 3600 * 1000);
const limiteAtteinte = (ip) => recents(ip).length >= 6;
function compter(ip) {
  historique.set(ip, [...recents(ip), Date.now()]);
  if (historique.size > 5000) historique.clear();
}

const texte = (v, max) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '');

function reponse(res, code, corps) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(corps));
}

// Vérifie et nettoie la demande ; renvoie { demande } ou { erreur }.
function valider(corps) {
  if (!corps || typeof corps !== 'object') return { erreur: 'Demande invalide.' };
  const type = corps.type === 'question' ? 'question' : 'devis';
  const nom = texte(corps.nom, 100);
  const mail = texte(corps.mail, 200);
  if (!nom) return { erreur: 'Indiquez votre nom.' };
  if (!courriel.adresseValide(mail)) return { erreur: 'Indiquez une adresse e-mail valide.' };
  if (type === 'question') {
    const message = texte(corps.message, 4000);
    if (!message) return { erreur: 'Écrivez votre message.' };
    return { demande: { type, nom, mail, message } };
  }
  const services = Array.isArray(corps.services) ? corps.services.filter((s) => SERVICES_VALIDES.includes(s)) : [];
  if (!services.length) return { erreur: 'Choisissez au moins un service.' };
  const besoin = texte(corps.besoin, 4000);
  if (!besoin) return { erreur: 'Décrivez votre activité et ce que vous attendez.' };
  const delai = DELAIS.includes(corps.delai) ? corps.delai : '';
  return { demande: { type, nom, mail, tel: texte(corps.tel, 40), services: [...new Set(services)], besoin, delai, aide: corps.aide === true } };
}

function composerCourriel(d) {
  if (d.type === 'question') {
    return { sujet: `Question de ${d.nom}`, texte: ['Nouvelle question reçue sur studionovae.org', '', d.message, '', `Nom : ${d.nom}`, `E-mail : ${d.mail}`].join('\n') };
  }
  return {
    sujet: `Demande de devis : ${d.services.join(', ')} (${d.nom})`,
    texte: [
      'Nouvelle demande de devis reçue sur studionovae.org', '',
      `Services : ${d.services.join(', ')}`, '',
      'Besoin :', d.besoin, '',
      `Démarrage souhaité : ${d.delai || 'non précisé'}`,
      `Aides au financement : ${d.aide ? 'oui, à étudier avec le client' : 'non demandé'}`, '',
      `Nom : ${d.nom}`, `E-mail : ${d.mail}`, `Téléphone : ${d.tel || 'non indiqué'}`,
    ].join('\n'),
  };
}

function enregistrer(ligne) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.appendFileSync(FICHIER, JSON.stringify(ligne) + '\n', 'utf8');
}

function traiter(req, res) {
  if (req.method !== 'POST') return reponse(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (limiteAtteinte(ip)) return reponse(res, 429, { ok: false, erreur: `Trop de demandes envoyées. Réessayez plus tard ou écrivez à ${MAIL}.` });

  let taille = 0;
  const morceaux = [];
  req.on('data', (c) => {
    taille += c.length;
    if (taille > TAILLE_MAX) { reponse(res, 413, { ok: false, erreur: 'Message trop long.' }); req.destroy(); return; }
    morceaux.push(c);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    let corps;
    try { corps = JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { return reponse(res, 400, { ok: false, erreur: 'Demande invalide.' }); }

    // Pièges à robots : champ caché rempli, ou formulaire envoyé en moins de 2 s. On répond « ok » sans rien enregistrer.
    if ((corps && corps.site) || (corps && Number(corps.delaiRemplissage) < 2000)) { compter(ip); return reponse(res, 200, { ok: true }); }

    const { demande, erreur } = valider(corps);
    if (erreur) return reponse(res, 400, { ok: false, erreur });
    compter(ip);

    const id = crypto.randomBytes(6).toString('hex');
    const ligne = { id, recueLe: new Date().toISOString(), ip, ...demande };
    let fichierOk = true;
    try { enregistrer(ligne); } catch (e) { fichierOk = false; console.error('Contact : enregistrement dans le fichier impossible :', e.message); }
    // Base MySQL (si configurée) : en parallèle, son échec est consigné sans bloquer le visiteur tant que le fichier a fonctionné.
    const baseActive = base.estConfiguree();
    const enBase = baseActive ? base.inserer(ligne).then(() => true, (e) => { console.error(`Contact : demande ${id} non enregistrée dans la base :`, e.message); return false; }) : Promise.resolve(false);

    const cfg = courriel.configuration();
    const courrielActif = courriel.estConfigure(cfg);
    if (!courrielActif) console.warn(`Contact : demande ${id} enregistrée, e-mail non envoyé (SMTP_USER / SMTP_PASS non renseignés).`);
    const { sujet, texte: corpsMail } = composerCourriel(demande);
    const envoi = courrielActif ? courriel.envoyer({ sujet, texte: corpsMail, repondreA: demande.mail }, cfg) : Promise.reject(new Error('e-mail non configuré'));
    envoi.catch(() => {}); // le résultat est traité plus bas ; évite une erreur « non gérée » si on répond avant

    const etat = (e, erreurMail) => {
      const statut = e ? 'envoye' : 'echec';
      if (courrielActif) {
        try { enregistrer({ id, courriel: statut, ...(erreurMail ? { erreur: erreurMail.message } : {}), le: new Date().toISOString() }); } catch { /* déjà consigné */ }
        if (baseActive) enBase.then((ok) => { if (ok) base.noterCourriel(id, statut, erreurMail && erreurMail.message).catch((x) => console.error('Contact : statut non noté dans la base :', x.message)); });
      }
    };
    const suivre = () => envoi.then(() => etat(true), (e) => { if (courrielActif) console.error(`Contact : e-mail de la demande ${id} non envoyé :`, e.message); etat(false, e); });

    if (fichierOk) {
      // Demande enregistrée : on répond tout de suite ; la base et l'e-mail finissent en arrière-plan.
      reponse(res, 200, { ok: true });
      suivre();
      return;
    }
    // Le fichier a échoué : la réponse dépend de la base, puis de l'e-mail, pour ne jamais annoncer un succès alors que la demande est perdue.
    enBase.then((ok) => {
      if (ok) { reponse(res, 200, { ok: true }); suivre(); return; }
      envoi.then(() => { reponse(res, 200, { ok: true }); suivre(); }, (e) => {
        console.error(`Contact : demande ${id} perdue (ni fichier, ni base, ni e-mail) :`, e.message);
        reponse(res, 500, { ok: false, erreur: `Envoi impossible pour le moment. Écrivez-nous à ${MAIL}.` });
      });
    });
  });
}

module.exports = { traiter, valider, composerCourriel, FICHIER };
