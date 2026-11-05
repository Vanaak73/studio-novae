// Relève de la boîte : convertit les e-mails reçus et les range dans la conversation de leur expéditeur (src/conversations.js).
// Un seul passage à la fois ; les doublons sont évités par le Message-ID ; l'état (dernier UID relevé) est gardé dans releve-etat.json (DATA_DIR).
// Au tout premier passage, les e-mails déjà présents dans la boîte sont importés « lus » ; ensuite chaque nouvel e-mail est « non lu ».
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pieces = require('./pieces');
const { simpleParser } = require('mailparser');
const { normaliserEmail } = require('./utilisateurs');
const conversations = require('./conversations');
const { preparerSchema } = require('./schema');

const TAILLE_PIECE_MAX = pieces.TAILLE_MAX;
const CORPS_MAX = 500000;     // caractères gardés d'un message reçu
const ECHECS_MAX = 5;         // refus successifs de la base avant d'ignorer un message (consigné)
const echecsParMessage = new Map();
const DOSSIER_DONNEES = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Convertit un e-mail brut en message prêt à ranger. maintenant : date de réception (repli quand la date de l'en-tête manque ou est postérieure à maintenant + 1 h).
async function convertir(brut, maintenant = () => new Date()) {
  const m = await simpleParser(brut);
  const expediteur = m.from && m.from.value && m.from.value[0] ? normaliserEmail(m.from.value[0].address) : '';
  const recu = maintenant();
  // Date de l'en-tête retenue seulement entre 1970 et maintenant + 1 h (la colonne DATETIME de la base refuse le reste).
  const dateValide = m.date instanceof Date && m.date.getTime() >= 0 && m.date.getTime() <= recu.getTime() + 3600 * 1000;
  const authentification = String(m.headers.get('authentication-results') || '');
  // Message-ID absent ou trop long pour la colonne (255) : empreinte du message brut.
  const messageId = m.messageId && m.messageId.length <= 255 ? m.messageId : `<sha256-${crypto.createHash('sha256').update(brut).digest('hex')}@empreinte.studionovae.org>`;
  const corps = String(m.text || '').replace(/\r\n/g, '\n').trim();
  return {
    de: expediteur,
    messageId,
    objet: String(m.subject || '').slice(0, 300),
    corps: corps.length > CORPS_MAX ? `${corps.slice(0, CORPS_MAX)}\n\n[Message tronqué : trop long]` : corps,
    date: dateValide ? m.date : recu,
    authEchec: /\b(spf|dkim|dmarc)=fail\b/i.test(authentification),
    pieces: (m.attachments || []).map((p) => ({ nom: p.filename || 'piece-jointe', typeMime: p.contentType || 'application/octet-stream', contenu: p.content })),
  };
}

function lireEtat(fichier) {
  try { return JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch { return null; }
}

let enCours = false;

// Range un message converti dans la conversation de son expéditeur. Renvoie true si le message est nouveau.
// Les pièces jointes sont (ré)écrites quand le message n'en a aucune en base : une panne entre le message et ses pièces est rattrapée au passage suivant.
async function ranger(deps, recu, premier, dossierPieces) {
  const { conversationId } = await conversations.ouvrirConversation(deps.db, recu.de);
  const gardees = [];
  let corps = recu.corps;
  for (const p of recu.pieces) {
    if (p.contenu.length > TAILLE_PIECE_MAX) corps += `\n\n[Pièce jointe non conservée (trop volumineuse) : ${p.nom}]`;
    else gardees.push(p);
  }
  const r = await conversations.ajouterMessage(deps.db, conversationId, { sens: 'entrant', nature: 'email', messageIdEmail: recu.messageId, objet: recu.objet, corps, envoyeLe: recu.date, lu: premier, authEchec: recu.authEchec });
  if (gardees.length && (r.nouveau || !(await conversations.piecesDuMessage(deps.db, r.id)).length)) {
    for (const p of gardees) {
      const rangee = pieces.ecrirePiece(dossierPieces, recu.date, p.nom, p.contenu);
      await conversations.ajouterPieceJointe(deps.db, r.id, { nom: rangee.nom, typeMime: p.typeMime, taille: p.contenu.length, chemin: rangee.chemin });
    }
  }
  return r.nouveau;
}

// Un passage de relève. deps : { db, lireNouveaux(depuisUid, uidValidityConnue), preparer?, adresseBoite?, dossierPieces, fichierEtat, maintenant }. Renvoie { ajoutes }.
// lireNouveaux renvoie la liste des messages, ou { messages, uidValidity, reinitialise } (reinitialise : la boîte a changé de numérotation, on repart de zéro).
async function passer(deps) {
  if (enCours) return { ajoutes: 0 };
  enCours = true;
  try {
    if (deps.preparer) await deps.preparer(); // tables prêtes (refait à chaque passage : la relève reprend quand la base revient)
    const fichierEtat = deps.fichierEtat || path.join(DOSSIER_DONNEES, 'releve-etat.json');
    const dossierPieces = deps.dossierPieces || pieces.dossierParDefaut();
    const maintenant = deps.maintenant || (() => new Date());
    const adresseBoite = deps.adresseBoite ? normaliserEmail(deps.adresseBoite) : '';
    const etat = lireEtat(fichierEtat);
    const premier = !etat;
    let dernierUid = etat ? Number(etat.dernierUid) || 0 : 0;
    const lu = await deps.lireNouveaux(dernierUid, etat ? etat.uidValidity : undefined); // une erreur ici remonte : rien n'est enregistré
    const messages = Array.isArray(lu) ? lu : lu.messages;
    const uidValidity = Array.isArray(lu) ? (etat ? etat.uidValidity : undefined) : lu.uidValidity;
    if (!Array.isArray(lu) && lu.reinitialise) dernierUid = 0;
    let ajoutes = 0;
    for (const { uid, brut } of messages) {
      let recu;
      try { recu = await convertir(brut, maintenant); } catch (e) { console.error(`Relève : message ${uid} illisible, ignoré :`, e.message); dernierUid = Math.max(dernierUid, uid); continue; }
      // Les e-mails envoyés par la boîte elle-même (notifications du formulaire) ne sont pas des conversations de clients.
      if (recu.de && recu.de !== adresseBoite) {
        const cle = `${uid}|${recu.messageId}`;
        if ((echecsParMessage.get(cle) || 0) >= ECHECS_MAX) {
          console.error(`Relève : message ${uid} (${recu.messageId}) refusé ${ECHECS_MAX} fois par la base, ignoré.`);
        } else {
          try { if (await ranger(deps, recu, premier, dossierPieces)) ajoutes++; echecsParMessage.delete(cle); }
          catch (e) { echecsParMessage.set(cle, (echecsParMessage.get(cle) || 0) + 1); throw e; }
        }
      }
      dernierUid = Math.max(dernierUid, uid);
    }
    fs.mkdirSync(path.dirname(fichierEtat), { recursive: true });
    fs.writeFileSync(fichierEtat, JSON.stringify({ dernierUid, ...(uidValidity !== undefined ? { uidValidity } : {}), majLe: maintenant().toISOString() }));
    return { ajoutes };
  } finally {
    enCours = false;
  }
}

// Préparation de la base avant relève : tables créées si besoin, puis demandes déjà enregistrées rattachées à leur conversation.
// Une panne est retentée au passage suivant ; une fois réussie, plus rien n'est refait.
function creerPreparateur(db) {
  let prete = false;
  return async () => {
    if (prete) return;
    await preparerSchema(db);
    await conversations.rattacherDemandesExistantes(db);
    prete = true;
  };
}

module.exports = { convertir, passer, creerPreparateur, TAILLE_PIECE_MAX };
