const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlFiles = ['catalogo.html', 'index.html', 'faq.html', 'navidad.html'];
const newVersion = '20261126_v29';

htmlFiles.forEach(f => {
  const filePath = path.join(root, f);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/assets\/shop\.js\?v=[^\s"'>]+/g, `assets/shop.js?v=${newVersion}`);
    content = content.replace(/assets\/site-modals\.js\?v=[^\s"'>]+/g, `assets/site-modals.js?v=${newVersion}`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated cache in ${f} to ${newVersion}`);
  }
});
