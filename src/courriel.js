// Envoi d'un e-mail par SMTP, sans dépendance (modules Node tls / net). Utilisé par la page Contact (src/api-contact.js).
// Réglages par variables d'environnement : SMTP_HOST (défaut smtp.hostinger.com), SMTP_PORT (défaut 465, connexion chiffrée),
// SMTP_USER et SMTP_PASS (identifiants de la boîte d'envoi), MAIL_TO (destinataire, défaut contact@studionovae.org).
// Sans SMTP_USER / SMTP_PASS, l'envoi est désactivé : les demandes restent enregistrées sur le serveur.
const tls = require('tls');
const net = require('net');
const os = require('os');
const crypto = require('crypto');

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

// Nom de fichier sûr pour un en-tête : ni retour à la ligne, ni guillemets, ni séparateurs de dossier.
const nomSur = (n) => sansRetour(String(n || 'fichier')).replace(/["\\/<>:*?|]+/g, '_').slice(0, 120) || 'fichier';
const parametreNom = (n) => (/^[ -~]*$/.test(n) ? `filename="${n}"` : `filename*=UTF-8''${encodeURIComponent(n)}`);
const identifiantMessage = (domaine) => `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${domaine}>`;

// Message complet (en-têtes + corps en base64), avec protection contre l'injection d'en-têtes.
// Réponse à un client : enReponseA (Message-ID du message auquel on répond), references (liste de Message-ID), pieces ([{nom, typeMime, contenu: Buffer}]).
function construireMessage({ de, a, repondreA, sujet, texte, html, domaine = 'studionovae.org', enReponseA, references, pieces, messageId }) {
  if (!adresseValide(a)) throw new Error('Destinataire invalide'); // adresseValide refuse aussi tout espace ou retour à la ligne
  const lignes = [
    `From: ${entete('Studio Novae')} <${de}>`,
    `To: <${a}>`,
  ];
  if (repondreA && adresseValide(repondreA)) lignes.push(`Reply-To: <${sansRetour(repondreA)}>`);
  const id = messageId ? sansRetour(messageId) : identifiantMessage(domaine);
  lignes.push(
    `Subject: ${entete(sansRetour(sujet))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${id}`,
  );
  if (enReponseA) lignes.push(`In-Reply-To: ${sansRetour(enReponseA)}`);
  if (references && references.length) lignes.push(`References: ${references.map(sansRetour).join(' ')}`);
  lignes.push('MIME-Version: 1.0');
  const nouvelleFrontiere = () => 'novae-' + crypto.randomBytes(12).toString('hex');
  const partieTexte = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lignes(texte)];
  // Corps : texte seul, ou texte puis HTML (multipart/alternative : la messagerie affiche la dernière version qu'elle sait lire, le HTML).
  let corps = partieTexte;
  if (html) {
    const alternative = nouvelleFrontiere();
    corps = [`Content-Type: multipart/alternative; boundary="${alternative}"`, '', `--${alternative}`, ...partieTexte,
      `--${alternative}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lignes(html), `--${alternative}--`];
  }
  if (!pieces || !pieces.length) {
    lignes.push(...corps);
    return lignes.join('\r\n');
  }
  const frontiere = nouvelleFrontiere();
  lignes.push(`Content-Type: multipart/mixed; boundary="${frontiere}"`, '', `--${frontiere}`, ...corps);
  for (const p of pieces) {
    const nom = nomSur(p.nom);
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(p.typeMime || '') ? p.typeMime : 'application/octet-stream';
    lignes.push(`--${frontiere}`, `Content-Type: ${type}`, 'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${parametreNom(nom)}`, '',
      p.contenu.toString('base64').replace(/(.{76})/g, '$1\r\n'));
  }
  lignes.push(`--${frontiere}--`, '');
  return lignes.join('\r\n');
}

// ---- Mail de réponse à un client (gabarit validé par Rémi le 2026-11-05)
// En-tête bleu nuit (logo + ligne de métier) puis trait vert vif ; corps = texte écrit dans l'administration ; signature avec trait vertical ;
// pied de page à deux lignes. Le logo reprend celui de l'accueil (STUDIO · NOVAE, gras 700, interlettrage 0.04em, point vert vif) : la police
// Space Grotesk n'est pas chargée par les messageries, elles affichent Helvetica ou Arial avec les mêmes proportions.
const { esc } = require('./site');
const METIER = 'Développement web, automatisation, marketing digital et conseil';
const POLICE_MAIL = "'Helvetica Neue',Helvetica,Arial,sans-serif";

function htmlReponse(texte) {
  const paragraphes = String(texte).replace(/\r\n/g, '\n').trim().split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br />')}</p>`).join('\n          ');
  const lien = 'color:#2447c4;text-decoration:none';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>Studio Novae</title>
</head>
<body style="margin:0;padding:0;background:#eef1f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f9">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;font-family:${POLICE_MAIL};font-size:15px;line-height:1.6;color:#0b1330">
      <tr><td bgcolor="#0a1230" style="background:#0a1230;padding:22px 28px;border-radius:12px 12px 0 0">
        <div style="font-family:'Space Grotesk',${POLICE_MAIL};font-size:17.2px;line-height:normal;font-weight:700;letter-spacing:0.04em;color:#ffffff">STUDIO <span style="color:#a8dc5a">·</span> NOVAE</div>
        <div style="font-size:12px;line-height:1.5;color:#a9b4d6;margin-top:4px">${METIER}</div>
      </td></tr>
      <tr><td bgcolor="#a8dc5a" style="background:#a8dc5a;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
      <tr><td style="padding:28px 28px 10px">
          ${paragraphes}
        <div style="margin-top:22px;border-left:4px solid #d5dbec;padding-left:14px">
          <div style="font-weight:700">Rémi</div>
          <div style="color:#4a5576;font-size:13px">Studio Novae · <a href="https://studionovae.org" style="${lien}">studionovae.org</a></div>
        </div>
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid #d5dbec;font-size:12px;line-height:1.7;color:#4a5576">
        ${METIER}<br /><a href="https://studionovae.org" style="${lien}">studionovae.org</a> · <a href="mailto:contact@studionovae.org" style="${lien}">contact@studionovae.org</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

// Version texte du même mail (messageries sans HTML) : le message, puis la signature.
const texteReponse = (texte) => `${String(texte).replace(/\r\n/g, '\n').trim()}\n\n-- \nRémi\nStudio Novae · https://studionovae.org\n${METIER}\ncontact@studionovae.org\n`;

// Mail de réponse complet à partir du texte écrit dans l'administration : { texte, html }.
const reponseClient = (texte) => ({ texte: texteReponse(texte), html: htmlReponse(texte) });

// Dialogue SMTP : renvoie une promesse résolue quand le serveur a accepté le message.
// Sans « a », le message part vers cfg.destinataire (page Contact) ; avec « a », vers ce destinataire (réponse à un client).
// Renvoie { messageId, brut } : le Message-ID posé dans l'en-tête et le message complet (pour la copie dans « Envoyés »).
function envoyer({ sujet, texte, html, repondreA, a, enReponseA, references, pieces }, cfg = configuration()) {
  return new Promise((resolve, reject) => {
    const de = cfg.utilisateur || cfg.destinataire;
    const destinataire = a || cfg.destinataire;
    const messageId = identifiantMessage('studionovae.org');
    const brut = construireMessage({ de, a: destinataire, repondreA, sujet, texte, html, enReponseA, references, pieces, messageId }); // refuse un destinataire invalide avant toute connexion
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
      await dire(`RCPT TO:<${destinataire}>`, ['250', '251']);
      await dire('DATA', ['354']);
      await dire(brut + '\r\n.', ['250']);
      socket.write('QUIT\r\n');
      socket.end();
    })().then(() => resolve({ messageId, brut }), (e) => { socket.destroy(); reject(e); });
  });
}

module.exports = { envoyer, construireMessage, htmlReponse, reponseClient, configuration, estConfigure, adresseValide, sansRetour };
