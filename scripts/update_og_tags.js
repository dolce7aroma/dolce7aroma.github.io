const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 1. Update index.html
const indexPath = path.join(root, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

indexHtml = indexHtml.replace(
  /<meta property="og:title" content="[^"]*" \/>/,
  '<meta property="og:title" content="Dolce 7 Aroma | Perfumes Inspirados & Dupes con Delivery en Lima" />'
);
indexHtml = indexHtml.replace(
  /<meta property="og:description" content="[^"]*" \/>/,
  '<meta property="og:description" content="Fragancias maceradas con esencias de Francia y fijación real de 8 a 12 horas. Frascos de 10ml (S/ 15), 50ml y 110ml. Delivery gratis en Lima y pagos con Tarjeta o Yape." />'
);
indexHtml = indexHtml.replace(
  /<meta property="og:image" content="[^"]*" \/>/,
  '<meta property="og:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
);
indexHtml = indexHtml.replace(
  /<meta name="twitter:title" content="[^"]*" \/>/,
  '<meta name="twitter:title" content="Dolce 7 Aroma | Perfumes Inspirados & Dupes con Delivery en Lima" />'
);
indexHtml = indexHtml.replace(
  /<meta name="twitter:description" content="[^"]*" \/>/,
  '<meta name="twitter:description" content="Fragancias maceradas con esencias de Francia y fijación real de 8 a 12 horas. Frascos de 10ml (S/ 15), 50ml y 110ml. Delivery gratis en Lima y pagos con Tarjeta o Yape." />'
);
indexHtml = indexHtml.replace(
  /<meta name="twitter:image" content="[^"]*" \/>/,
  '<meta name="twitter:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
);

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('Updated index.html Open Graph tags');

// 2. Update catalogo.html
const catPath = path.join(root, 'catalogo.html');
let catHtml = fs.readFileSync(catPath, 'utf8');

catHtml = catHtml.replace(
  /<meta property="og:title" content="[^"]*" \/>/,
  '<meta property="og:title" content="Catálogo Oficial de Perfumes & Dupes de Diseñador | Dolce 7 Aroma" />'
);
catHtml = catHtml.replace(
  /<meta property="og:description" content="[^"]*" \/>/,
  '<meta property="og:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml (S/ 15), 50ml y 110ml con delivery gratis en Lima y recojo en SMP." />'
);
catHtml = catHtml.replace(
  /<meta property="og:image" content="[^"]*" \/>/,
  '<meta property="og:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
);
catHtml = catHtml.replace(
  /<meta name="twitter:title" content="[^"]*" \/>/,
  '<meta name="twitter:title" content="Catálogo Oficial de Perfumes & Dupes de Diseñador | Dolce 7 Aroma" />'
);
catHtml = catHtml.replace(
  /<meta name="twitter:description" content="[^"]*" \/>/,
  '<meta name="twitter:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml (S/ 15), 50ml y 110ml con delivery gratis en Lima y recojo en SMP." />'
);
catHtml = catHtml.replace(
  /<meta name="twitter:image" content="[^"]*" \/>/,
  '<meta name="twitter:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
);

fs.writeFileSync(catPath, catHtml, 'utf8');
console.log('Updated catalogo.html Open Graph tags');

// 3. Update faq.html
const faqPath = path.join(root, 'faq.html');
let faqHtml = fs.readFileSync(faqPath, 'utf8');
faqHtml = faqHtml.replace(
  /<meta property="og:image" content="[^"]*" \/>/,
  '<meta property="og:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
);
fs.writeFileSync(faqPath, faqHtml, 'utf8');
console.log('Updated faq.html Open Graph image');

// 4. Update navidad.html (add OG tags if missing)
const navPath = path.join(root, 'navidad.html');
let navHtml = fs.readFileSync(navPath, 'utf8');
if (!navHtml.includes('og:title')) {
  const ogBlock = `
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Dolce 7 Aroma" />
<meta property="og:url" content="https://dolce7aroma.com/navidad.html" />
<meta property="og:title" content="Especial Campaña Navideña | Dolce 7 Aroma" />
<meta property="og:description" content="Guía de regalos navideños en Lima. Perfumes inspirados con maceración controlada, bolsa de regalo de cortesía y delivery gratis desde S/ 100." />
<meta property="og:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="es_PE" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Especial Campaña Navideña | Dolce 7 Aroma" />
<meta name="twitter:description" content="Guía de regalos navideños en Lima. Perfumes inspirados con maceración controlada, bolsa de regalo de cortesía y delivery gratis desde S/ 100." />
<meta name="twitter:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />
`;
  navHtml = navHtml.replace('<link rel="canonical" href="https://dolce7aroma.com/navidad.html" />', '<link rel="canonical" href="https://dolce7aroma.com/navidad.html" />' + ogBlock);
  fs.writeFileSync(navPath, navHtml, 'utf8');
  console.log('Added Open Graph tags to navidad.html');
}
