// Lecture de la boîte contact@studionovae.org par IMAP (bibliothèque imapflow).
// Réglages (variables d'environnement) : IMAP_HOST (défaut imap.hostinger.com), IMAP_PORT (993), IMAP_USER et IMAP_PASS
// (défaut : SMTP_USER et SMTP_PASS, la même boîte). Sans identifiants, la relève est désactivée.
const LOT_MAX = 100; // messages relevés par passage : le reste est repris à la minute suivante

function configuration(env = process.env) {
  return {
    host: env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(env.IMAP_PORT) || 993,
    user: env.IMAP_USER || env.SMTP_USER || '',
    pass: env.IMAP_PASS || env.SMTP_PASS || '',
  };
}
const estConfiguree = (cfg = configuration()) => Boolean(cfg.user && cfg.pass);

function client(cfg) {
  const { ImapFlow } = require('imapflow');
  return new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.port === 993, auth: { user: cfg.user, pass: cfg.pass }, logger: false, socketTimeout: 30000 });
}

// Nouveaux messages de la boîte de réception dont l'UID dépasse depuisUid : { messages: [{ uid, brut: Buffer }] (du plus ancien au plus récent),
// uidValidity (numéro de numérotation de la boîte), reinitialise }. Si la boîte a changé de numérotation (uidValidity différent de celui connu),
// tous les messages sont relus depuis le début (reinitialise = true) : les doublons sont écartés par leur Message-ID.
async function lireNouveaux(cfg, depuisUid, uidValidityConnue) {
  const imap = client(cfg);
  imap.on('error', () => {}); // les erreurs de connexion remontent par les appels ci-dessous
  await imap.connect();
  try {
    const verrou = await imap.getMailboxLock('INBOX');
    try {
      const uidValidity = String(imap.mailbox.uidValidity);
      const reinitialise = uidValidityConnue !== undefined && String(uidValidityConnue) !== uidValidity;
      const depuis = reinitialise ? 0 : depuisUid;
      const uids = (await imap.search({ uid: `${depuis + 1}:*` }, { uid: true })) || [];
      const voulus = uids.filter((u) => u > depuis).sort((a, b) => a - b).slice(0, LOT_MAX); // « N:* » renvoie toujours au moins le dernier message
      const messages = [];
      if (voulus.length) {
        for await (const m of imap.fetch(voulus.join(','), { uid: true, source: true }, { uid: true })) messages.push({ uid: m.uid, brut: m.source });
      }
      return { messages: messages.sort((a, b) => a.uid - b.uid), uidValidity, reinitialise };
    } finally { verrou.release(); }
  } finally { await imap.logout().catch(() => {}); }
}

// Dossier des messages envoyés (usage spécial \Sent, sinon « Sent »).
async function dossierEnvoyes(imap) {
  const boites = await imap.list();
  const trouve = boites.find((b) => b.specialUse === '\\Sent') || boites.find((b) => /^(INBOX\.)?sent$/i.test(b.path));
  return trouve ? trouve.path : 'Sent';
}

// Copie un message envoyé dans le dossier « Envoyés » de la boîte, marqué lu.
async function copierEnvoyes(cfg, brut) {
  const imap = client(cfg);
  imap.on('error', () => {});
  await imap.connect();
  try { await imap.append(await dossierEnvoyes(imap), Buffer.from(brut, 'utf8'), ['\\Seen']); }
  finally { await imap.logout().catch(() => {}); }
}

module.exports = { configuration, estConfiguree, lireNouveaux, copierEnvoyes, LOT_MAX };
