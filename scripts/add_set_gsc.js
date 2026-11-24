const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', 'worker', 'dolce-aroma-admin-worker.js');
let code = fs.readFileSync(workerPath, 'utf8');

const target = `  // 9. Comando /seo (Auditoría SEO, Palabras Clave y Tráfico Orgánico - Hito 6)
  if (command === '/seo') {
    await generateSeoReport(chatId, env);
    return json({ ok: true });
  }`;

const replacement = `  // 9. Comando /seo (Auditoría SEO, Palabras Clave y Tráfico Orgánico - Hito 6)
  if (command === '/seo') {
    await generateSeoReport(chatId, env);
    return json({ ok: true });
  }

  // Comando /set_gsc <impresiones> <clics> <ctr> <posicion>
  if (command === '/set_gsc' || command === '/actualizar_gsc') {
    if (args.length >= 2 && env.ORDERS) {
      const imp = parseInt(args[0], 10) || 166;
      const clk = parseInt(args[1], 10) || 4;
      const ctr = args[2] || ((clk / imp) * 100).toFixed(1);
      const pos = args[3] || '6.9';
      const gscObj = {
        impressions: imp,
        clicks: clk,
        ctr: String(ctr),
        position: String(pos),
        googleBusinessSpike: '+108%',
        topQueries: [
          { query: 'perfumes delivery gratis lima', clicks: 2, impressions: 68, ctr: '2.9', position: '5.2' },
          { query: 'perfumes arabes equivalencias', clicks: 1, impressions: 45, ctr: '2.2', position: '6.4' },
          { query: 'dupes de perfumes peru', clicks: 1, impressions: 32, ctr: '3.1', position: '7.1' },
          { query: 'perfumes en san martin de porres', clicks: 0, impressions: 21, ctr: '0.0', position: '8.3' }
        ],
        updatedAt: new Date().toISOString()
      };
      await env.ORDERS.put('config:gsc_latest', JSON.stringify(gscObj));
      await sendTelegramMessage(chatId, \`✅ <b>Métricas de Search Console actualizadas en KV:</b>\\n• Impresiones: <b>\${imp}</b>\\n• Clics: <b>\${clk}</b> (CTR: \${ctr}%)\\n• Posición Media: <b>\${pos}</b>\\n\\nSe incluirán automáticamente en el reporte de cada lunes.\`, env);
      return json({ ok: true });
    } else {
      await sendTelegramMessage(chatId, 'ℹ️ <b>Uso:</b> <code>/set_gsc &lt;impresiones&gt; &lt;clics&gt; &lt;ctr&gt; &lt;posicion&gt;</code>\\nEjemplo: <code>/set_gsc 166 4 2.4 6.9</code>', env);
      return json({ ok: true });
    }
  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync(workerPath, code, 'utf8');
  console.log('set_gsc command added!');
} else {
  console.error('Target not found!');
}
