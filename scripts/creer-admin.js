// Crée (ou promeut) un administrateur : node scripts/creer-admin.js <e-mail>
// Le mot de passe est saisi au clavier (masqué), 12 caractères minimum. Utilise la base du fichier .env.local / .env.
require('../src/env').chargerTout();
const base = require('../src/base');
const { preparerSchema } = require('../src/schema');
const { creerAdmin, normaliserEmail } = require('../src/utilisateurs');

function saisirMasque(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const entree = process.stdin;
    let texte = '';
    if (entree.isTTY) entree.setRawMode(true);
    entree.resume();
    entree.setEncoding('utf8');
    const lire = (c) => {
      for (const car of c) {
        if (car === '\u0003') process.exit(130);
        if (car === '\r' || car === '\n') {
          if (entree.isTTY) entree.setRawMode(false);
          entree.pause(); entree.off('data', lire);
          process.stdout.write('\n');
          return resolve(texte);
        }
        if (car === '\u007f' || car === '\b') texte = texte.slice(0, -1);
        else texte += car;
      }
    };
    entree.on('data', lire);
  });
}

(async () => {
  const email = normaliserEmail(process.argv[2]);
  if (!email) { console.error('Usage : node scripts/creer-admin.js <e-mail>'); process.exit(1); }
  if (!base.estConfiguree()) { console.error('Base non configurée (DB_NAME, DB_USER, DB_PASS dans .env).'); process.exit(1); }
  const mdp = await saisirMasque('Mot de passe (12 caractères minimum) : ');
  if (mdp.length < 12) { console.error('Mot de passe trop court.'); process.exit(1); }
  await preparerSchema(base.pool());
  const id = await creerAdmin(base.pool(), email, mdp);
  console.log(`Administrateur ${email} prêt (id ${id}).`);
  await base.pool().end();
})().catch((e) => { console.error('Erreur :', e.message); process.exit(1); });
