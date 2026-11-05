// Un passage de relève de la boîte, à la main : node scripts/releve-boite.js
// Avec --essai : lecture seule, rien n'est enregistré ; affiche le temps de connexion IMAP et le nombre de messages que la relève trouverait.
require('../src/env').chargerTout();
const base = require('../src/base');
const boite = require('../src/boite');
const releve = require('../src/releve');

(async () => {
  if (!boite.estConfiguree()) { console.error('Boîte non configurée (IMAP_USER / IMAP_PASS, ou SMTP_USER / SMTP_PASS, dans .env).'); process.exit(1); }
  const cfg = boite.configuration();
  const debut = Date.now();
  if (process.argv.includes('--essai')) {
    const { messages } = await boite.lireNouveaux(cfg, 0);
    console.log(`Essai : ${messages.length} message(s) lus en ${Date.now() - debut} ms (connexion, lecture et déconnexion) sur ${cfg.host}:${cfg.port} — rien n'a été enregistré.`);
    return;
  }
  if (!base.estConfiguree()) { console.error('Base non configurée (DB_NAME, DB_USER, DB_PASS dans .env).'); process.exit(1); }
  const { ajoutes } = await releve.passer({ db: base.pool(), preparer: releve.creerPreparateur(base.pool()), adresseBoite: cfg.user, lireNouveaux: (uid, validite) => boite.lireNouveaux(cfg, uid, validite) });
  console.log(`Relève terminée : ${ajoutes} message(s) ajouté(s) en ${Date.now() - debut} ms.`);
  await base.pool().end();
})().catch((e) => { console.error('Erreur :', e.message); process.exit(1); });
