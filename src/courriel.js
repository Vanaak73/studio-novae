// Envoi d'un e-mail par SMTP, sans dépendance (modules Node tls / net). Utilisé par la page Contact (src/api-contact.js).
// Réglages par variables d'environnement : SMTP_HOST (défaut smtp.hostinger.com), SMTP_PORT (défaut 465, connexion chiffrée),
// SMTP_USER et SMTP_PASS (identifiants de la boîte d'envoi), MAIL_TO (destinataire, défaut contact@studionovae.org).
// Sans SMTP_USER / SMTP_PASS, l'envoi est désactivé : les demandes restent enregistrées sur le serveur.
const tls = require('tls');
const net = require('net');
const os = require('os');

const sansRetour = (t) => String(t).replace(/[\r\n]+/g, ' ').trim();
const entete = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + Buffer.from(t, 'utf8').toString('base64') + '?=');
const base64Lignes = (t) => Buffer.from(t, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
const adresseValide = (a) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(a);

function configuration(env = process.env) {
  return {
    hote: env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(env.SMTP_PORT) || 465,
    securise: env.SMTP_SECURE !== '0',
    utilisateur: env.SMTP_USER || '',
    motDePasse: env.SMTP_PASS || '',
    destinataire: env.MAIL_TO || 'contact@studionovae.org',
  };
}

const estConfigure = (cfg = configuration()) => Boolean(cfg.utilisateur && cfg.motDePasse);

// Message complet (en-têtes + corps en base64), avec protection contre l'injection d'en-têtes.
function construireMessage({ de, a, repondreA, sujet, texte, domaine = 'studionovae.org' }) {
  const lignes = [
    `From: ${entete('Studio Novae')} <${de}>`,
    `To: <${a}>`,
  ];
  if (repondreA && adresseValide(repondreA)) lignes.push(`Reply-To: <${sansRetour(repondreA)}>`);
  lignes.push(
    `Subject: ${entete(sansRetour(sujet))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${domaine}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lignes(texte),
  );
  return lignes.join('\r\n');
}

// Dialogue SMTP : renvoie une promesse résolue quand le serveur a accepté le message.
function envoyer({ sujet, texte, repondreA }, cfg = configuration()) {
  return new Promise((resolve, reject) => {
    const de = cfg.utilisateur || cfg.destinataire;
    const socket = cfg.securise
      ? tls.connect({ host: cfg.hote, port: cfg.port, servername: cfg.hote })
      : net.connect({ host: cfg.hote, port: cfg.port });
    socket.setEncoding('utf8');
    socket.setTimeout(15000);

    let tampon = '';
    let attente = null;
    const echec = (e) => { if (attente) { const a = attente; attente = null; a.reject(e); } };
    socket.on('error', echec);
    socket.on('timeout', () => { socket.destroy(); echec(new Error('SMTP : délai dépassé')); });
    socket.on('close', () => echec(new Error('SMTP : connexion fermée')));
    const traiter = () => {
      if (!attente) return;
      const lignes = tampon.split('\r\n');
      for (let i = 0; i < lignes.length - 1; i++) {
        if (/^\d{3}( |$)/.test(lignes[i])) {
          const reponse = lignes.slice(0, i + 1).join('\r\n');
          tampon = lignes.slice(i + 1).join('\r\n');
          const a = attente; attente = null; a.resolve(reponse);
          return;
        }
      }
    };
    socket.on('data', (d) => { tampon += d; traiter(); });
    const reponse = () => new Promise((res, rej) => { attente = { resolve: res, reject: rej }; traiter(); });
    const dire = async (commande, codes) => {
      socket.write(commande + '\r\n');
      const r = await reponse();
      if (!codes.includes(r.slice(0, 3))) throw new Error('SMTP : ' + r.slice(0, 120));
    };

    (async () => {
      const accueil = await reponse();
      if (!accueil.startsWith('220')) throw new Error('SMTP : ' + accueil.slice(0, 120));
      await dire('EHLO ' + (os.hostname().replace(/[^\w.-]/g, '') || 'studionovae.org'), ['250']);
      if (cfg.utilisateur) {
        await dire('AUTH LOGIN', ['334']);
        await dire(Buffer.from(cfg.utilisateur).toString('base64'), ['334']);
        await dire(Buffer.from(cfg.motDePasse).toString('base64'), ['235']);
      }
      await dire(`MAIL FROM:<${de}>`, ['250']);
      await dire(`RCPT TO:<${cfg.destinataire}>`, ['250', '251']);
      await dire('DATA', ['354']);
      await dire(construireMessage({ de, a: cfg.destinataire, repondreA, sujet, texte }) + '\r\n.', ['250']);
      socket.write('QUIT\r\n');
      socket.end();
    })().then(resolve, (e) => { socket.destroy(); reject(e); });
  });
}

module.exports = { envoyer, construireMessage, configuration, estConfigure, adresseValide, sansRetour };
