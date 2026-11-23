const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const authorDateMeta = `
<meta name="author" content="JNxConsulting" />
<meta property="article:author" content="JNxConsulting" />
<meta name="twitter:creator" content="JNxConsulting" />
<meta name="date" content="2024-01-01" />
<meta property="article:published_time" content="2024-01-01T00:00:00Z" />
<meta property="og:article:published_time" content="2024-01-01T00:00:00Z" />
<meta property="article:modified_time" content="2026-11-23T00:00:00Z" />
<meta property="og:article:modified_time" content="2026-11-23T00:00:00Z" />
<meta name="publish_date" property="og:publish_date" content="2024-01-01T00:00:00Z" />
`;

const files = ['index.html', 'catalogo.html', 'faq.html', 'navidad.html'];

files.forEach(file => {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return;
  
  let html = fs.readFileSync(filePath, 'utf8');
  
  // Remove any previous author/date tags if exists to prevent duplication
  html = html.replace(/<meta name="author"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta property="article:author"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta name="twitter:creator"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta name="date"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta property="article:published_time"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta property="og:article:published_time"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta property="article:modified_time"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta property="og:article:modified_time"[^>]*>\r?\n?/gi, '');
  html = html.replace(/<meta name="publish_date"[^>]*>\r?\n?/gi, '');

  // Ensure twitter:image is present before script or head
  if (file === 'catalogo.html' && !html.includes('<meta name="twitter:image"')) {
    html = html.replace(
      '<meta name="twitter:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml (S/ 15), 50ml y 110ml con delivery gratis en Lima y recojo en SMP." />',
      '<meta name="twitter:description" content="Explora nuestro catálogo completo de perfumes inspirados con fijación real de 8 a 12h. Frascos de 10ml (S/ 15), 50ml y 110ml con delivery gratis en Lima y recojo en SMP." />\n<meta name="twitter:image" content="https://dolce7aroma.com/assets/og-cover-dolce7aroma.jpg?v=20261123" />'
    );
  }

  // Insert authorDateMeta right after <meta name="description" ... />
  const descRegex = /(<meta name="description" content="[^"]*" \/>)/;
  if (descRegex.test(html)) {
    html = html.replace(descRegex, `$1${authorDateMeta}`);
  } else {
    html = html.replace('<link rel="canonical"', `${authorDateMeta}\n<link rel="canonical"`);
  }

  // Also in index.html schema.org, add author and dates
  if (file === 'index.html' && !html.includes('"datePublished": "2024-01-01"')) {
    html = html.replace(
      '"priceRange": "S/ 15 - S/ 175",',
      `"priceRange": "S/ 15 - S/ 175",\n  "datePublished": "2024-01-01",\n  "dateModified": "2026-11-23",\n  "author": {\n    "@type": "Organization",\n    "name": "JNxConsulting"\n  },`
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Updated author and 2024 date metadata in ${file}`);
});
