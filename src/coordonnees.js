// Coordonnées d'un utilisateur : le type est un texte libre côté base, mais chaque type connu a sa règle de contrôle (ici).
// Ajouter un type = ajouter une ligne dans TYPES. Une valeur refusée ou un type inconnu n'est jamais enregistré.
const sansControle = (t) => !/[\u0000-\u001f\u007f]/.test(t);

function url(valeur, domaines) {
  const t = String(valeur || '').trim();
  if (t.length > 300 || !sansControle(t)) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
  if (domaines && !domaines.some((d) => u.hostname === d || u.hostname.endsWith('.' + d))) return null;
  return t;
}

// Identifiant de réseau social (avec ou sans @), ou adresse de profil sur le bon domaine.
function reseau(domaines, avecArobase) {
  return (valeur) => {
    const t = String(valeur || '').trim();
    const identifiant = t.replace(/^@/, '');
    if (/^[A-Za-z0-9._-]{1,60}$/.test(identifiant)) return avecArobase ? '@' + identifiant : identifiant;
    return url(t, domaines);
  };
}

const TYPES = {
  telephone(valeur) {
    const t = String(valeur || '').trim();
    if (!/^\+?[\d\s.()-]{6,25}$/.test(t)) return null;
    const chiffres = t.replace(/\D/g, '');
    if (t.startsWith('+')) return chiffres.length >= 8 && chiffres.length <= 15 ? '+' + chiffres : null;
    if (/^0\d{9}$/.test(chiffres)) return '+33' + chiffres.slice(1);
    return chiffres.length >= 8 && chiffres.length <= 15 ? chiffres : null;
  },
  url_site: (valeur) => url(valeur),
  adresse(valeur) {
    const t = String(valeur || '').replace(/\s+/g, ' ').trim();
    return t && t.length <= 200 && sansControle(t) ? t : null;
  },
  instagram: reseau(['instagram.com'], true),
  facebook: reseau(['facebook.com', 'fb.com'], false),
  linkedin: reseau(['linkedin.com'], false),
};

async function ajouterCoordonnee(db, utilisateurId, type, valeur) {
  if (!Object.prototype.hasOwnProperty.call(TYPES, type)) throw new Error('Type de coordonnée inconnu');
  const propre = TYPES[type](valeur);
  if (propre === null) throw new Error('Valeur refusée pour ' + type);
  const [r] = await db.query('INSERT INTO coordonnee (utilisateur_id, type, valeur) VALUES (?, ?, ?)', [utilisateurId, type, propre]);
  return r.insertId;
}

async function lireCoordonnees(db, utilisateurId) {
  const [lignes] = await db.query('SELECT id, type, valeur FROM coordonnee WHERE utilisateur_id = ? ORDER BY id', [utilisateurId]);
  return lignes;
}

module.exports = { TYPES, ajouterCoordonnee, lireCoordonnees };
