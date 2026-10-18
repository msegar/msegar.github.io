// build-patients.js - Builds patient-education pages from content/patients/*.md
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');
const QRCode = require('qrcode');

const CONTENT_DIR = path.join(__dirname, '../content/patients');
const OUTPUT_DIR = path.join(__dirname, '../patients');
const TEMPLATE_PATH = path.join(OUTPUT_DIR, 'template.html');
const BASE_URL = 'https://segar.me';
const ASCENSION_URL = 'https://healthcare.ascension.org/find-care/provider/1942703749/matthew-segar';
const SAME_AS = [
  'https://twitter.com/mattsegar',
  'https://linkedin.com/in/matthewsegar',
  'https://scholar.google.com/citations?hl=en&user=S3EnanEAAAAJ',
  ASCENSION_URL
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// JSON for embedding in <script type="application/ld+json">
const ld = obj => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
const inline = s => marked.parseInline(String(s));
const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '');
// Inline SVG QR code for the printed page footer
const qrSvg = text => {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="print-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><path fill="#000" d="${d}"/></svg>`;
};

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const pages = [];

const sources = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md')).map(file => ({
  slug: file.replace('.md', ''),
  ...matter(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'))
}));

sources.forEach(({ slug, data: fm, content }) => {
  const reviewed = fm.reviewed instanceof Date ? fm.reviewed.toISOString().split('T')[0] : String(fm.reviewed);
  const url = slug === 'index' ? `${BASE_URL}/patients/` : `${BASE_URL}/patients/${slug}.html`;
  const faq = fm.faq || [];

  const physician = {
    '@type': ['Person', 'Physician'],
    '@id': `${BASE_URL}/#physician`,
    name: 'Matthew W. Segar, MD',
    url: BASE_URL,
    medicalSpecialty: ['Cardiovascular', 'Cardiac Electrophysiology'],
    sameAs: SAME_AS
  };
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: fm.title,
    description: fm.description,
    url,
    inLanguage: 'en',
    lastReviewed: reviewed,
    reviewedBy: physician,
    author: physician,
    audience: { '@type': 'PeopleAudience', audienceType: 'Patient' },
    isPartOf: { '@type': 'WebSite', name: 'Matt Segar', url: BASE_URL }
  };
  const crumbs = [{ name: 'Home', item: `${BASE_URL}/` }, { name: 'For Patients', item: `${BASE_URL}/patients/` }];
  if (slug !== 'index') crumbs.push({ name: fm.title });
  pageLd.breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c }))
  };
  if (fm.about) pageLd.about = { '@type': 'MedicalCondition', name: fm.about };
  if (fm.citations) pageLd.citation = fm.citations.map(c => plain(c));

  const faqLd = faq.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } }))
  } : null;

  const wide = fm.layout === 'wide';
  const asideHtml = wide ? '' : `<aside class="patient-aside" aria-labelledby="aside-heading">
                <p class="aside-title" id="aside-heading">Make an appointment</p>
                <p>I see patients in Carmel and New Castle, Indiana.</p>
                <ul>
                    <li>Carmel Heart Care: <a href="tel:+13173386666">(317) 338-6666</a></li>
                    <li>New Castle Heart Care: <a href="tel:+17655211461">(765) 521-1461</a></li>
                </ul>
                <a class="button" href="${ASCENSION_URL}?utm_source=segar.me&amp;utm_medium=referral&amp;utm_campaign=patients" rel="noopener">Schedule through Ascension</a>
                <p class="small">Not medical advice. Call 911 for an emergency.</p>
            </aside>`;

  const mobileCallHtml = wide ? '' : '<div class="mobile-call"><img class="headshot headshot-sm" src="../assets/images/headshot-192.webp" alt="" width="40" height="40"><p><strong>Need an appointment?</strong> Call <a href="tel:+13173386666">Carmel (317) 338-6666</a> or <a href="tel:+17655211461">New Castle (765) 521-1461</a>. Emergency: call 911.</p></div>';

  const answerHtml = fm.answer ? `<div class="answer-box"><span class="answer-label">The short answer</span><p>${inline(fm.answer)}</p></div>` : '';
  const faqHtml = faq.length ? `<h2>Common questions</h2>\n<div class="faq">${faq.map(f =>
    `<details><summary>${esc(f.q)}</summary><p>${inline(f.a)}</p></details>`).join('\n')}</div>` : '';
  // Links to the other guides; the index page already lists them all
  const others = slug === 'index' ? [] : sources.filter(p => p.slug !== slug && p.slug !== 'index');
  const relatedHtml = others.length ? `<section class="related-guides" aria-labelledby="related-heading">
                    <h2 id="related-heading">Related guides</h2>
                    <ul>${others.map(p => `
                        <li><a href="${p.slug}.html">${esc(p.data.title)}</a><span>${esc(p.data.description)}</span></li>`).join('')}
                    </ul>
                </section>` : '';
  // Share card from og_image front matter or assets/images/og/<slug>.png; headshot if neither exists
  const ogPath = fm.og_image || `assets/images/og/${slug}.png`;
  const socialHtml = fs.existsSync(path.join(__dirname, '..', ogPath))
    ? `<meta property="og:image" content="${BASE_URL}/${ogPath}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${BASE_URL}/${ogPath}">`
    : `<meta property="og:image" content="${BASE_URL}/assets/images/headshot-og.webp">
    <meta name="twitter:card" content="summary">`;
  const citeHtml = fm.citations ? `<h2>References</h2>\n<ol class="citations">${fm.citations.map(c => `<li>${inline(c)}</li>`).join('\n')}</ol>` : '';

  const html = template
    .replace(/{{title}}/g, esc(fm.title))
    .replace(/{{description}}/g, esc(fm.description))
    .replace(/{{url}}/g, url)
    .replace(/{{reviewed}}/g, reviewed)
    .replace(/{{reviewedDisplay}}/g, new Date(reviewed + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
    .replace(/{{socialImage}}/g, () => socialHtml)
    .replace(/{{pageLd}}/g, () => ld(pageLd))
    .replace(/{{faqLd}}/g, () => faqLd ? `<script type="application/ld+json">\n${ld(faqLd)}\n    </script>` : '')
    .replace(/{{layoutClass}}/g, wide ? 'wide' : 'has-aside')
    .replace(/{{aside}}/g, () => asideHtml)
    .replace(/{{mobileCall}}/g, () => mobileCallHtml)
    .replace(/{{answer}}/g, () => answerHtml)
    .replace(/{{content}}/g, () => marked.parse(content))
    .replace(/{{faq}}/g, () => faqHtml)
    .replace(/{{related}}/g, () => relatedHtml)
    .replace(/{{citations}}/g, () => citeHtml)
    .replace(/{{qr}}/g, () => qrSvg(url))
    .replace(/{{ascensionUrl}}/g, ASCENSION_URL);

  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html);
  pages.push({ slug, reviewed });
  console.log(`Generated: patients/${slug}.html`);
});

module.exports = pages;
