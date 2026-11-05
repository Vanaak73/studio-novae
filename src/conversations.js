// Conversations : une par utilisateur (donc par adresse e-mail). Elle réunit ses demandes de devis et ses e-mails (reçus et envoyés),
// classés par date d'envoi. Toutes les fonctions prennent en premier paramètre db (pool ou connexion mysql2).
// Convention : un message de nature « demande » est une demande de devis ; son champ objet contient le nom donné par le client.
const { trouverOuCreer, normaliserEmail } = require('./utilisateurs');

async function ouvrirConversation(db, email) {
  const utilisateur = await trouverOuCreer(db, email);
  await db.query('INSERT INTO conversation (utilisateur_id) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)', [utilisateur.id]);
  const [lignes] = await db.query('SELECT id FROM conversation WHERE utilisateur_id = ?', [utilisateur.id]);
  return { conversationId: lignes[0].id, utilisateurId: utilisateur.id };
}

// Ajoute un message ; un messageIdEmail déjà connu n'est jamais ajouté deux fois (nouveau = false).
async function ajouterMessage(db, conversationId, m) {
  let id;
  try {
    const [r] = await db.query(
      'INSERT INTO message (conversation_id, sens, nature, demande_id, message_id_email, objet, corps, envoye_le, lu, statut_envoi, erreur, auth_echec) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [conversationId, m.sens, m.nature || 'email', m.demandeId || null, m.messageIdEmail || null, m.objet ? String(m.objet).slice(0, 300) : null,
        m.corps || '', m.envoyeLe, m.lu ? 1 : 0, m.statutEnvoi || 'envoye', m.erreur ? String(m.erreur).slice(0, 300) : null, m.authEchec ? 1 : 0]);
    id = r.insertId;
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY' || !m.messageIdEmail) throw e;
    const [existant] = await db.query('SELECT id FROM message WHERE message_id_email = ?', [m.messageIdEmail]);
    return { id: existant[0].id, nouveau: false };
  }
  await db.query('UPDATE conversation SET dernier_message_le = GREATEST(COALESCE(dernier_message_le, ?), ?) WHERE id = ?', [m.envoyeLe, m.envoyeLe, conversationId]);
  // Un client avec qui Rémi a déjà échangé (demande ou réponse envoyée) réapparaît quand il écrit ; un expéditeur archivé sans échange reste archivé.
  if (m.sens === 'entrant') {
    await db.query(
      'UPDATE conversation SET archivee = 0 WHERE id = ? AND archivee = 1 AND EXISTS (SELECT 1 FROM message WHERE conversation_id = ? AND (sens = "sortant" OR nature = "demande"))',
      [conversationId, conversationId]);
  }
  return { id, nouveau: true };
}

async function ajouterPieceJointe(db, messageId, p) {
  const [r] = await db.query('INSERT INTO piece_jointe (message_id, nom, type_mime, taille, chemin) VALUES (?, ?, ?, ?, ?)',
    [messageId, String(p.nom).slice(0, 255), p.typeMime || null, p.taille, p.chemin]);
  return r.insertId;
}

const REQUETE_LISTE = `SELECT c.id, u.email, c.dernier_message_le AS dernierLe,
  (SELECT m.objet FROM message m WHERE m.conversation_id = c.id AND m.nature = 'demande' ORDER BY m.envoye_le, m.id LIMIT 1) AS nom,
  (SELECT m.corps FROM message m WHERE m.conversation_id = c.id ORDER BY m.envoye_le DESC, m.id DESC LIMIT 1) AS apercu,
  (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.sens = 'entrant' AND m.lu = 0) AS nonLus,
  (SELECT COUNT(*) FROM message m WHERE m.conversation_id = c.id AND m.nature = 'demande') AS nbDemandes
  FROM conversation c JOIN utilisateur u ON u.id = c.utilisateur_id`;

async function listerConversations(db, filtre = 'toutes', inclureArchivees = false) {
  const [lignes] = await db.query(`${REQUETE_LISTE} ${inclureArchivees ? '' : 'WHERE c.archivee = 0'} ORDER BY c.dernier_message_le DESC, c.id DESC`);
  return lignes
    .map((l) => ({
      id: l.id, email: l.email, nom: l.nom || null, dernierLe: l.dernierLe,
      apercu: String(l.apercu || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      nonLus: Number(l.nonLus), nbDemandes: Number(l.nbDemandes), sansDemande: Number(l.nbDemandes) === 0,
    }))
    .filter((l) => (filtre === 'non_lues' ? l.nonLus > 0 : filtre === 'devis' ? l.nbDemandes > 0 : true));
}

async function lireConversation(db, id) {
  const [conv] = await db.query('SELECT c.id, c.archivee, c.dernier_message_le AS dernierLe, u.id AS utilisateurId, u.email, u.statut FROM conversation c JOIN utilisateur u ON u.id = c.utilisateur_id WHERE c.id = ?', [id]);
  if (!conv[0]) return null;
  const [messages] = await db.query(
    'SELECT id, sens, nature, demande_id AS demandeId, message_id_email AS messageIdEmail, objet, corps, envoye_le AS envoyeLe, lu, statut_envoi AS statutEnvoi, erreur, auth_echec AS authEchec FROM message WHERE conversation_id = ? ORDER BY envoye_le, id', [id]);
  const [pieces] = messages.length
    ? await db.query('SELECT id, message_id AS messageId, nom, type_mime AS typeMime, taille FROM piece_jointe WHERE message_id IN (?) ORDER BY id', [messages.map((m) => m.id)])
    : [[]];
  const [coordonnees] = await db.query('SELECT id, type, valeur FROM coordonnee WHERE utilisateur_id = ? ORDER BY id', [conv[0].utilisateurId]);
  return {
    conversation: { id: conv[0].id, archivee: !!conv[0].archivee, dernierLe: conv[0].dernierLe },
    utilisateur: { id: conv[0].utilisateurId, email: conv[0].email, statut: conv[0].statut },
    coordonnees,
    messages: messages.map((m) => ({ ...m, lu: !!m.lu, authEchec: !!m.authEchec, piecesJointes: pieces.filter((p) => p.messageId === m.id).map(({ id: pid, nom, taille, typeMime }) => ({ id: pid, nom, taille, typeMime })) })),
  };
}

async function marquerLu(db, conversationId) {
  await db.query('UPDATE message SET lu = 1 WHERE conversation_id = ? AND lu = 0', [conversationId]);
}

async function archiver(db, conversationId, valeur) {
  await db.query('UPDATE conversation SET archivee = ? WHERE id = ?', [valeur ? 1 : 0, conversationId]);
}

// Résumé texte d'une demande de la page Contact. Accepte la ligne du fichier (recueLe, services en liste) comme la ligne de la table (recue_le, services en texte).
function resumerDemande(d) {
  const services = Array.isArray(d.services) ? d.services.join(', ') : d.services;
  if (d.type === 'question') return String(d.message || '');
  return [
    `Services : ${services || 'non précisé'}`,
    `Besoin : ${d.besoin || ''}`,
    `Démarrage souhaité : ${d.delai || 'non précisé'}`,
    `Aides au financement : ${d.aide ? 'oui, à étudier avec le client' : 'non demandé'}`,
    `Téléphone : ${d.tel || 'non indiqué'}`,
  ].join('\n');
}

// Rattache une demande de la page Contact à la conversation de son adresse e-mail. Une demande déjà rattachée n'est jamais dupliquée.
// Une « question » est un e-mail entrant ordinaire ; seul un devis est de nature « demande ».
async function rattacherDemande(db, d, { lu = false } = {}) {
  const email = normaliserEmail(d.mail);
  if (!email) throw new Error('Demande sans adresse e-mail valide');
  const { conversationId } = await ouvrirConversation(db, email);
  const [deja] = await db.query('SELECT id FROM message WHERE conversation_id = ? AND demande_id = ?', [conversationId, d.id]);
  if (deja[0]) return { id: deja[0].id, nouveau: false };
  const recueLe = new Date(d.recueLe || d.recue_le);
  const devis = d.type !== 'question';
  return ajouterMessage(db, conversationId, {
    sens: 'entrant', nature: devis ? 'demande' : 'email', demandeId: d.id,
    objet: devis ? d.nom : `Question de ${d.nom}`, corps: resumerDemande(d), envoyeLe: recueLe, lu,
  });
}

// Rattrapage : rattache les demandes déjà enregistrées (table demandes, si elle existe), marquées lues. Renvoie le nombre de demandes ajoutées.
async function rattacherDemandesExistantes(db) {
  const [existe] = await db.query('SHOW TABLES LIKE "demandes"');
  if (!existe.length) return 0;
  const [lignes] = await db.query('SELECT * FROM demandes ORDER BY recue_le');
  let ajoutees = 0;
  for (const l of lignes) {
    try { if ((await rattacherDemande(db, l, { lu: true })).nouveau) ajoutees++; } catch { /* adresse invalide : ignorée */ }
  }
  return ajoutees;
}

// ---- Aides pour les réponses depuis l'administration

async function lireMessage(db, messageId) {
  const [l] = await db.query('SELECT id, conversation_id AS conversationId, sens, nature, objet, corps, statut_envoi AS statutEnvoi FROM message WHERE id = ?', [messageId]);
  return l[0] || null;
}

// Met à jour le résultat d'un envoi : statut, Message-ID obtenu, erreur éventuelle.
async function majEnvoi(db, messageId, { statutEnvoi, messageIdEmail = null, erreur = null, envoyeLe = null }) {
  await db.query('UPDATE message SET statut_envoi = ?, message_id_email = COALESCE(?, message_id_email), erreur = ?, envoye_le = COALESCE(?, envoye_le) WHERE id = ?',
    [statutEnvoi, messageIdEmail, erreur ? String(erreur).slice(0, 300) : null, envoyeLe, messageId]);
  if (envoyeLe) await db.query('UPDATE conversation SET dernier_message_le = GREATEST(COALESCE(dernier_message_le, ?), ?) WHERE id = (SELECT conversation_id FROM message WHERE id = ?)', [envoyeLe, envoyeLe, messageId]);
}

// Éléments d'une réponse : objet « Re: … », Message-ID du dernier message reçu, références (jusqu'à 6 identifiants précédents).
async function contexteReponse(db, conversationId) {
  const [lignes] = await db.query('SELECT sens, message_id_email AS messageIdEmail FROM message WHERE conversation_id = ? AND message_id_email IS NOT NULL ORDER BY envoye_le, id', [conversationId]);
  const dernierEntrant = [...lignes].reverse().find((l) => l.sens === 'entrant');
  const [objets] = await db.query('SELECT objet FROM message WHERE conversation_id = ? AND sens = "entrant" AND nature = "email" AND objet IS NOT NULL AND objet <> "" ORDER BY envoye_le DESC, id DESC LIMIT 1', [conversationId]);
  const sujetDeBase = objets[0] ? objets[0].objet.replace(/^(\s*re\s*:\s*)+/i, '').trim() : 'Votre demande de devis';
  return {
    sujet: `Re: ${sujetDeBase}`,
    enReponseA: dernierEntrant ? dernierEntrant.messageIdEmail : null,
    references: lignes.map((l) => l.messageIdEmail).slice(-6),
  };
}

// Pièce jointe avec la conversation à laquelle elle appartient.
async function lirePieceJointe(db, id) {
  const [l] = await db.query('SELECT p.id, p.nom, p.type_mime AS typeMime, p.taille, p.chemin, m.conversation_id AS conversationId FROM piece_jointe p JOIN message m ON m.id = p.message_id WHERE p.id = ?', [id]);
  return l[0] || null;
}

async function piecesDuMessage(db, messageId) {
  const [l] = await db.query('SELECT id, nom, type_mime AS typeMime, taille, chemin FROM piece_jointe WHERE message_id = ? ORDER BY id', [messageId]);
  return l;
}

module.exports = { lireMessage, majEnvoi, contexteReponse, lirePieceJointe, piecesDuMessage, ouvrirConversation, ajouterMessage, ajouterPieceJointe, listerConversations, lireConversation, marquerLu, archiver, rattacherDemande, rattacherDemandesExistantes, resumerDemande };
