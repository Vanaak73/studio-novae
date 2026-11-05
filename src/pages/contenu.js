// Pages de contenu (à propos, services) : mêmes blocs, décrits par des données dans src/contenu/*.json.
const fs = require('fs');
const path = require('path');
const { DOMAINE, MAIL, DEVIS, esc, SERVICES, urlService, devisPour } = require('../site');
const { page } = require('../layout');

const lire = (nom) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contenu', nom), 'utf8'));

const hero = (c) => {
  const style = `--img:url('${c.img}')${c.pos ? `;--pos:${c.pos}` : ''}`;
  return `    <section class="page-hero">
      <div class="hero-bg parallax-layer" style="${style}"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <p class="eyebrow-pill">${c.pill}</p>
        <h1>${c.h1}</h1>
        <p class="hero-intro">${c.intro}</p>
      </div>
    </section>`;
};

const entete = (s) => `      <div class="section-heading">
        <p class="eyebrow">${s.eyebrow}</p>
        <h2>${s.h2}</h2>
      </div>`;

function section(s, autres) {
  if (s.cta) {
    return `    <section class="page-cta">
      <p class="eyebrow">${s.cta.eyebrow}</p>
      <h2>${s.cta.h2}</h2>
      <a class="contact-link" href="mailto:${MAIL}">${MAIL}</a>
    </section>`;
  }
  const classe = s.voirAussi ? s.classe : ['page-section', s.classe].filter(Boolean).join(' ');
  const id = s.id ? ` id="${s.id}"` : '';
  const corps = s.voirAussi
    ? `      <div class="see-also">${autres.map((x) => `<a href="${urlService(x.slug)}">${esc(x.nom)}</a>`).join('')}</div>`
    : `      ${s.corps}`;
  return `    <section class="${classe}"${id}>\n${entete(s)}\n${corps}\n    </section>`;
}

function rendre(c, { url, jsonld, autres }) {
  const image = c.img;
  return page({
    meta: { titre: c.titre, description: c.description, url, jsonld, ogImage: c.og },
    main: [hero({ ...c, img: image }), ...c.sections.map((s) => section(s, autres))].join('\n\n'),
  });
}

// ---- Pages de service : gabarit de la maquette bleu nuit (hero court, sections alternées, appel final) ----
const texteSimple = (h) => h.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const titreSection = (h) => texteSimple(h).replace(/\.$/, '');

// Convertit les sections d'un service (HTML décrit dans services.json) en blocs du gabarit.
function blocsDepuis(c) {
  const blocs = [];
  let appel = null;
  for (const sec of c.sections) {
    if (sec.cta) { appel = texteSimple(sec.cta.h2); continue; }
    if (sec.voirAussi) { blocs.push({ type: 'puces', h2: titreSection(sec.h2) }); continue; }
    const corps = sec.corps || '';
    if (corps.trim().startsWith('<form')) { blocs.push({ type: 'brut', h2: titreSection(sec.h2), html: corps.trim() }); continue; }
    const colonnes = [...((corps.match(/<div class="two-col">([\s\S]*?)<\/div>/) || [, ''])[1]).matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    const cartes = [...corps.matchAll(/<div class="card"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/div>/g)].map((m) => ({ h3: m[1], p: m[2] }));
    if (!colonnes.length && !cartes.length) throw new Error(`Section de service non reconnue : ${sec.h2}`);
    blocs.push({ type: 'texte', h2: titreSection(sec.h2), colonnes, cartes });
  }
  return { blocs, appel };
}

const liste = (l) => (l ? `
            <ul>
${l.map((x) => `              <li>${esc(x)}</li>`).join('\n')}
            </ul>` : '');

const carte = (i) => `          <article class="formule${i.phare ? ' phare' : ''}">
            <h3>${i.phare || i.liste ? esc(i.h3) : i.h3}</h3>
            <p>${i.p}</p>${liste(i.liste)}
          </article>`;

function corpsBloc(b, autres) {
  switch (b.type) {
    case 'formules': return `        <div class="formules">
${b.items.map(carte).join('\n')}
        </div>`;
    case 'etapes': return `        <div class="etapes trois">
${b.items.map((i) => `          <div class="etape"><h3>${esc(i.h3)}</h3><p>${i.p}</p></div>`).join('\n')}
        </div>`;
    case 'puces': return `        <div class="suite">${autres.map((x) => `<a class="puce" href="${urlService(x.slug)}">${esc(x.nom)}</a>`).join('')}</div>`;
    case 'brut': return `        ${b.html}`;
    case 'texte': return [
      b.colonnes.length ? `        <div class="colonnes">
${b.colonnes.map((p) => `          <p>${p}</p>`).join('\n')}
        </div>` : '',
      b.cartes.length ? `        <div class="formules${b.cartes.length === 3 ? ' trois' : ''}">
${b.cartes.map(carte).join('\n')}
        </div>` : '',
    ].filter(Boolean).join('\n');
    default: throw new Error(`Bloc inconnu : ${b.type}`);
  }
}

function rendreService(s, c, { url, jsonld, autres }) {
  const vitrine = s.slug === 'site-vitrine' ? lire('service-vitrine.json') : null;
  const { blocs, appel } = vitrine ? { blocs: vitrine.blocs, appel: vitrine.appel } : blocsDepuis(c);
  const h1 = vitrine ? vitrine.h1 : texteSimple(c.h1).replace(/\.$/, '');
  const chapo = vitrine ? vitrine.chapo : c.intro;
  const hero = `    <section class="hero hero-court" style="background-image:url('/assets/images/${s.tuile.img}')">
      <div class="c">
        <p class="fil"><a href="/#services">Services</a> › ${esc(s.nom)}</p>
        <h1>${esc(h1)}</h1>
        <p class="chapo">${chapo}</p>
        <div class="actions"><a class="btn btn-devis" href="${devisPour(s.nom)}">Demander un devis pour ${s.devis}</a></div>
      </div>
    </section>`;
  const sections = blocs.map((b, i) => `    <section class="section${i % 2 ? ' blanc' : ''}">
      <div class="c">
        <div class="tete-section"><h2>${esc(b.h2)}</h2></div>
${corpsBloc(b, autres)}
      </div>
    </section>`);
  if (appel) sections.push(`    <section class="section sombre">
      <div class="c appel">
        <div><h2>${esc(appel)}</h2></div>
        <div class="droite"><div class="actions" style="margin:0"><a class="btn btn-devis" href="${devisPour(s.nom)}">Demander un devis</a></div></div>
      </div>
    </section>`);
  return page({
    meta: { titre: c.titre, description: c.description, url, jsonld, ogImage: c.og, feuilles: ['maquette.css'] },
    classeCorps: 'page-service',
    main: ['    <div class="mq">', hero, '', sections.join('\n\n'), '    </div>'].join('\n'),
  });
}

// Retourne [{ url, html }] pour « À propos » et chaque service.
function pagesContenu() {
  const resultat = [];

  const apropos = lire('a-propos.json');
  const urlApropos = '/a-propos';
  resultat.push({
    url: urlApropos,
    html: rendre(apropos, {
      url: urlApropos,
      jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: apropos.titre, url: DOMAINE + urlApropos, isPartOf: { '@type': 'WebSite', name: 'Studio Novae', url: `${DOMAINE}/` } },
    }),
  });

  const services = lire('services.json');
  for (const s of SERVICES) {
    const c = services[s.slug];
    if (!c) throw new Error(`Contenu manquant pour le service ${s.slug}`);
    const url = urlService(s.slug);
    resultat.push({
      url,
      html: rendreService(s, c, {
        url,
        autres: SERVICES.filter((x) => x.slug !== s.slug),
        jsonld: { '@context': 'https://schema.org', '@type': 'Service', name: c.nomSchema || s.nom, description: c.description, url: DOMAINE + url, provider: { '@type': 'Organization', name: 'Studio Novae', url: `${DOMAINE}/` }, areaServed: 'FR' },
      }),
    });
  }
  return resultat;
}

module.exports = { pagesContenu };
