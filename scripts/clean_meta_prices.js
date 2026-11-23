const fs = require('fs');

// 1. Update index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Replace descriptions containing (S/ 15)
indexHtml = indexHtml.replace(
  /<meta name="description" content="Perfumes inspirados de alta fijación y dupes de diseñador macerados\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml\. Delivery gratis en Lima y punto de venta en Jr\. Callao 482-A, SMP\." \/>/,
  '<meta name="description" content="Perfumes inspirados de alta fijación y dupes de diseñador macerados con esencias francesas. Frascos de 10ml, 50ml y 110ml. Delivery en Lima y punto de recojo en Jr. Callao 482-A, SMP." />'
);

indexHtml = indexHtml.replace(
  /<meta property="og:description" content="Fragancias maceradas con esencias de Francia y fijación real de 8 a 12 horas\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml\. Delivery gratis en Lima y pagos con Tarjeta o Yape\." \/>/,
  '<meta property="og:description" content="Fragancias finas de inspiración con esencias puras importadas de Francia y fijación real de 8 a 12 horas. Frascos de 10ml, 50ml y 110ml. Delivery en Lima y punto de recojo en SMP." />'
);

indexHtml = indexHtml.replace(
  /<meta name="twitter:description" content="Fragancias maceradas con esencias de Francia y fijación real de 8 a 12 horas\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml\. Delivery gratis en Lima y pagos con Tarjeta o Yape\." \/>/,
  '<meta name="twitter:description" content="Fragancias finas de inspiración con esencias puras importadas de Francia y fijación real de 8 a 12 horas. Frascos de 10ml, 50ml y 110ml. Delivery en Lima y punto de recojo en SMP." />'
);

indexHtml = indexHtml.replace(
  /10ml \(S\/ 15\), 50ml y 110ml con delivery gratis en Lima y punto de recojo en San Martín de Porres\./,
  '10ml, 50ml y 110ml con delivery en Lima y punto de recojo en San Martín de Porres.'
);

indexHtml = indexHtml.replace(/"priceRange": "S\/ 15 - S\/ 175"/, '"priceRange": "S/ 20 - S/ 225"');

// Bump og:image cache buster
indexHtml = indexHtml.replace(/og-cover-dolce7aroma\.jpg\?v=\d+/g, 'og-cover-dolce7aroma.jpg?v=20261123v2');

fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('index.html updated successfully');

// 2. Update catalogo.html
let catalogoHtml = fs.readFileSync('catalogo.html', 'utf8');

catalogoHtml = catalogoHtml.replace(
  /<meta name="description" content="Catálogo completo de perfumes inspirados en diseñador\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml con delivery gratis en Lima y recojo en Jr\. Callao 482-A, SMP\." \/>/,
  '<meta name="description" content="Catálogo completo de perfumes inspirados en diseñador. Frascos de 10ml, 50ml y 110ml con esencias importadas de Francia, delivery en Lima y recojo en Jr. Callao 482-A, SMP." />'
);

catalogoHtml = catalogoHtml.replace(
  /<meta property="og:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml con delivery gratis en Lima y recojo en SMP\." \/>/,
  '<meta property="og:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml, 50ml y 110ml con delivery en Lima y punto de recojo en SMP." />'
);

catalogoHtml = catalogoHtml.replace(
  /<meta name="twitter:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h\. Frascos de 10ml \(S\/ 15\), 50ml y 110ml con delivery gratis en Lima y recojo en SMP\." \/>/,
  '<meta name="twitter:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml, 50ml y 110ml con delivery en Lima y punto de recojo en SMP." />'
);

catalogoHtml = catalogoHtml.replace(/og-cover-dolce7aroma\.jpg\?v=\d+/g, 'og-cover-dolce7aroma.jpg?v=20261123v2');

fs.writeFileSync('catalogo.html', catalogoHtml, 'utf8');
console.log('catalogo.html updated successfully');

// 3. Update navidad.html (add author & date)
let navHtml = fs.readFileSync('navidad.html', 'utf8');
if (!navHtml.includes('name="author"')) {
  const authorTags = `
<meta name="author" content="JNxConsulting" />
<meta property="article:author" content="JNxConsulting" />
<meta name="twitter:creator" content="JNxConsulting" />
<meta name="date" content="2024-01-01" />
<meta property="article:published_time" content="2024-01-01T00:00:00Z" />
<meta property="og:article:published_time" content="2024-01-01T00:00:00Z" />
<meta name="publish_date" property="og:publish_date" content="2024-01-01T00:00:00Z" />`;
  navHtml = navHtml.replace(/<meta name="description" [^>]+>/, `$&${authorTags}`);
  fs.writeFileSync('navidad.html', navHtml, 'utf8');
  console.log('navidad.html author tags added');
}
