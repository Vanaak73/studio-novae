// Test du chargement du fichier .env et de l'enregistrement MySQL (src/env.js, src/base.js), sans vraie base : un faux « pool » consigne les requêtes.
//   npm run test:base
const fs = require('fs');
const os = require('os');
const path = require('path');
const env = require('../src/env');
const base = require('../src/base');

let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs++; console.log(`${cond ? '✓' : '✗ ÉCHEC'}  ${nom}${detail ? '  → ' + detail : ''}`); };

// ---- Fichier .env
const analyse = env.analyser(['# commentaire', '', 'DB_NAME=u1_base', 'DB_USER = "u1_user"', "SMTP_PASS='a b#c'", 'VIDE=', 'mauvais ligne', '  MAIL_TO=contact@studionovae.org  '].join('\r\n'));
ok('.env : valeurs simples, guillemets et espaces', analyse.DB_NAME === 'u1_base' && analyse.DB_USER === 'u1_user' && analyse.SMTP_PASS === 'a b#c' && analyse.MAIL_TO === 'contact@studionovae.org');
ok('.env : commentaires et lignes invalides ignorés, valeur vide permise', analyse.VIDE === '' && !('mauvais' in analyse) && Object.keys(analyse).length === 5);

const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'novae-env-'));
const fichier = path.join(dossier, '.env');
fs.writeFileSync(fichier, 'TEST_NOVAE_A=depuis-le-fichier\nTEST_NOVAE_B=depuis-le-fichier\n');
process.env.TEST_NOVAE_B = 'deja-definie';
const lues = env.charger(fichier);
ok('.env : charge les variables absentes', process.env.TEST_NOVAE_A === 'depuis-le-fichier' && lues.includes('TEST_NOVAE_A'));
ok('.env : ne remplace jamais une variable déjà définie', process.env.TEST_NOVAE_B === 'deja-definie' && !lues.includes('TEST_NOVAE_B'));
ok('.env : fichier absent sans erreur', Array.isArray(env.charger(path.join(dossier, 'absent.env'))));

// ---- Configuration de la base
ok('base : désactivée sans mot de passe', !base.estConfiguree(base.configuration({ DB_NAME: 'n', DB_USER: 'u' })));
ok('base : activée avec nom, utilisateur et mot de passe', base.estConfiguree(base.configuration({ DB_NAME: 'n', DB_USER: 'u', DB_PASS: 'p' })));
const cfg = base.configuration({ DB_NAME: 'n', DB_USER: 'u', DB_PASS: 'p' });
ok('base : hôte localhost et port 3306 par défaut', cfg.host === 'localhost' && cfg.port === 3306);

// ---- Requêtes avec un faux pool
(async () => {
  const requetes = [];
  base._remplacerPilote(() => ({
    query: async (sql) => { requetes.push({ type: 'query', sql }); return [[]]; },
    execute: async (sql, params) => { requetes.push({ type: 'execute', sql, params }); return [{ affectedRows: 1 }]; },
  }));
  await base.inserer({ id: 'abc123', recueLe: '2026-11-05T00:10:00.000Z', ip: '::1', type: 'devis', nom: 'Jeanne', mail: 'j@example.fr', tel: '0600000000', services: ['Vidéo UGC', 'Site vitrine'], besoin: 'Un site', delai: 'Dans les 3 mois', aide: true });
  await base.inserer({ id: 'def456', recueLe: '2026-11-05T00:11:00.000Z', ip: '::1', type: 'question', nom: 'Paul', mail: 'p@example.fr', message: 'Une question' });
  await base.noterCourriel('abc123', 'echec', 'connect ECONNREFUSED');

  ok('base : la table est créée une seule fois', requetes.filter((r) => r.type === 'query' && /CREATE TABLE IF NOT EXISTS demandes/.test(r.sql)).length === 1);
  ok('base : table en utf8mb4', /utf8mb4/.test(base.SQL_TABLE));
  const inserts = requetes.filter((r) => r.sql === base.SQL_INSERT);
  ok('base : une insertion par demande, requêtes préparées (aucune valeur dans le SQL)', inserts.length === 2 && !/Jeanne|Vidéo/.test(base.SQL_INSERT));
  const p = inserts[0].params;
  ok('base : paramètres du devis (id, date, type, nom, mail, tel, services, besoin, délai, aides)', p[0] === 'abc123' && p[1] instanceof Date && p[2] === 'devis' && p[3] === 'Jeanne' && p[4] === 'j@example.fr' && p[5] === '0600000000' && p[6] === 'Vidéo UGC, Site vitrine' && p[7] === 'Un site' && p[8] === 'Dans les 3 mois' && p[9] === 1, JSON.stringify(p).slice(0, 120));
  const q = inserts[1].params;
  ok('base : question (message renseigné, champs du devis vides)', q[2] === 'question' && q[10] === 'Une question' && q[6] === null && q[7] === null && q[9] === 0);
  const maj = requetes.find((r) => r.sql === base.SQL_STATUT);
  ok('base : statut de l\'e-mail noté sur la demande', maj && maj.params[0] === 'echec' && maj.params[1] === 'connect ECONNREFUSED' && maj.params[2] === 'abc123');

  // La table n'est pas marquée « prête » si sa création échoue : le prochain envoi réessaie.
  let tentatives = 0;
  base._remplacerPilote(() => ({
    query: async () => { tentatives++; if (tentatives === 1) throw new Error('accès refusé'); return [[]]; },
    execute: async () => [{}],
  }));
  let erreur = null;
  try { await base.inserer({ id: 'x', recueLe: new Date().toISOString(), type: 'question', nom: 'N', mail: 'n@e.fr', message: 'm' }); } catch (e) { erreur = e; }
  await base.inserer({ id: 'y', recueLe: new Date().toISOString(), type: 'question', nom: 'N', mail: 'n@e.fr', message: 'm' });
  ok('base : échec de création de table remonté, puis nouvel essai au prochain envoi', erreur && /accès refusé/.test(erreur.message) && tentatives === 2);

  console.log(echecs ? `\n✗ ${echecs} échec(s)` : '\n✓ .env et base conformes');
  process.exit(echecs ? 1 : 0);
})();
