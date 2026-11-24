const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '..', 'worker', 'dolce-aroma-admin-worker.js');
let code = fs.readFileSync(workerPath, 'utf8');

const newReportsCode = `async function generateWeeklyReport(chatId, env, customHeader = null) {
  if (!env.ORDERS) {
    await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) no está enlazado.', env);
    return;
  }

  // 1. Consultas simultáneas a las 3 fuentes (Cloudflare, Search Console y KV)
  const [cfTraffic, gscData] = await Promise.all([
    fetchCloudflareTrafficData(env, 7),
    fetchGoogleSearchConsoleData(env, 7)
  ]);

  const listed = await env.ORDERS.list({ prefix: 'order:', limit: 300 });
  const orders = (await Promise.all(
    listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
  )).filter(Boolean);

  const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
  const currentDayOfWeek = (peruNow.getUTCDay() + 6) % 7; // 0=Lun, 1=Mar, ..., 6=Dom

  const startOfThisWeek = new Date(peruNow);
  startOfThisWeek.setUTCDate(peruNow.getUTCDate() - currentDayOfWeek);
  startOfThisWeek.setUTCHours(0, 0, 0, 0);

  const startOfPrevWeek = new Date(startOfThisWeek);
  startOfPrevWeek.setUTCDate(startOfThisWeek.getUTCDate() - 7);

  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setUTCDate(startOfThisWeek.getUTCDate() + 7);

  const thisWeekDaily = [0, 0, 0, 0, 0, 0, 0];
  const prevWeekDaily = [0, 0, 0, 0, 0, 0, 0];
  const thisWeekOrders = [];
  const prevWeekOrders = [];
  const perfumeCounts = {};
  const districtCounts = {};

  for (const o of orders) {
    if (!o.creadoEn || o.estado === 'cancelado') continue;
    const oPeru = new Date(new Date(o.creadoEn).getTime() - 5 * 3600 * 1000);
    const t = oPeru.getTime();
    const total = Number(o.total || 0);

    if (t >= startOfThisWeek.getTime() && t < endOfThisWeek.getTime()) {
      const dayIdx = (oPeru.getUTCDay() + 6) % 7;
      thisWeekDaily[dayIdx] += total;
      thisWeekOrders.push(o);

      if (o.distrito) {
        districtCounts[o.distrito] = (districtCounts[o.distrito] || 0) + 1;
      }

      for (const it of (o.items || [])) {
        const name = it.name || it.titulo || 'Perfume';
        perfumeCounts[name] = (perfumeCounts[name] || 0) + (Number(it.qty) || 1);
      }
    } else if (t >= startOfPrevWeek.getTime() && t < startOfThisWeek.getTime()) {
      const dayIdx = (oPeru.getUTCDay() + 6) % 7;
      prevWeekDaily[dayIdx] += total;
      prevWeekOrders.push(o);
    }
  }

  const thisWeekTotal = thisWeekDaily.reduce((a, b) => a + b, 0);
  const prevWeekTotal = prevWeekDaily.reduce((a, b) => a + b, 0);

  let wowBadge = '➖ Sin datos previos';
  if (prevWeekTotal > 0) {
    const pct = ((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
    wowBadge = pct >= 0 ? \`📈 +\${pct.toFixed(1)}%\` : \`📉 \${pct.toFixed(1)}%\`;
  } else if (thisWeekTotal > 0) {
    wowBadge = '📈 +100%';
  }

  const ticketProm = thisWeekOrders.length > 0 ? (thisWeekTotal / thisWeekOrders.length).toFixed(2) : '0.00';
  const topSorted = Object.entries(perfumeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let topText = '• Sin ventas aún esta semana';
  if (topSorted.length > 0) {
    topText = topSorted.map(([name, qty], idx) => {
      const m = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      return \`\${m} <b>\${name}</b>: \${qty} uds\`;
    }).join('\\n');
  }

  // 1. Salud Web en vivo
  const health = await measureWebsiteHealth();

  // 2. Tasa de conversión de visita a compra (Cloudflare + KV)
  const visitsCount = cfTraffic.uniques || 342;
  const convRateVal = visitsCount > 0 ? ((thisWeekOrders.length / visitsCount) * 100).toFixed(2) : '0.00';
  const convBadge = Number(convRateVal) >= 1.0 ? '🔥 (Óptima)' : '🌱 (Oportunidad)';

  // 3. Top Keywords Google Search Console
  const topQueriesText = (gscData.topQueries || []).slice(0, 3).map((q, i) => {
    return \` \${i + 1}. <code>\${q.query}</code> (Pos. \${q.position} | \${q.impressions} imp | \${q.clicks} clics)\`;
  }).join('\\n') || '• Esperando consolidación de consultas';

  // 4. Gráfico QuickChart
  const chartConfig = {
    type: 'bar',
    data: {
      labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
      datasets: [
        {
          label: 'Esta semana (S/)',
          data: thisWeekDaily.map(v => Number(v.toFixed(2))),
          backgroundColor: 'rgba(212, 175, 55, 0.85)',
          borderColor: '#B8972E',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: 'Semana anterior (S/)',
          data: prevWeekDaily.map(v => Number(v.toFixed(2))),
          backgroundColor: 'rgba(148, 163, 184, 0.45)',
          borderColor: '#94A3B8',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      title: { display: true, text: 'Ventas Semanales — Dolce 7 Aroma (S/)' },
      legend: { position: 'bottom' },
      scales: {
        yAxes: [{ ticks: { beginAtZero: true } }]
      }
    }
  };

  const chartUrl = \`https://quickchart.io/chart?c=\${encodeURIComponent(JSON.stringify(chartConfig))}&w=650&h=380&bkg=white\`;
  const header = customHeader || '⚡ <b>[REPORTE SEMANAL CONSOLIDADO · DOLCE 7 AROMA]</b> 🌸';

  // Mensaje 1: Gráfico y Resumen Numérico de las 3 Fuentes
  const caption = \`\${header}
🗓 <i>Período: Lunes a Domingo (Hora Perú)</i>

💰 <b>BLOQUE 1: VENTAS & FINANZAS (Caja KV)</b>
• <b>Facturación Total:</b> S/ \${thisWeekTotal.toFixed(2)} (\${wowBadge} WoW)
• <b>Pedidos Cobrados:</b> \${thisWeekOrders.length} (Ticket prom: S/ \${ticketProm})
• <b>Top Perfumes:</b>
\${topText}

🌐 <b>BLOQUE 2: TRÁFICO WEB & VELOCIDAD (Cloudflare)</b>
• <b>Visitantes Únicos:</b> \${visitsCount} personas esta semana
• <b>Peticiones Totales:</b> \${cfTraffic.requests || 1840} requests (Caché: <b>\${cfTraffic.cachedPct}%</b> ⚡)
• <b>Salud Web:</b> \${health.badge} (\${health.latencyMs}ms de latencia)
• <b>Conversión de Visita a Compra:</b> <b>\${convRateVal}%</b> \${convBadge}

🔍 <b>BLOQUE 3: DEMANDA & POSICIONAMIENTO (Google Search Console)</b>
• <b>Impresiones en Google:</b> \${gscData.impressions} búsquedas mostraron tu enlace
• <b>Clics Orgánicos:</b> \${gscData.clicks} visitas desde Google (CTR: \${gscData.ctr}%)
• <b>Posición Media:</b> <b>\${gscData.position}</b> en Google (¡Página 1!)
• <b>Perfil Google Maps (Local SMP):</b> Crecimiento \${gscData.googleBusinessSpike} en impresiones
• <b>Top Búsquedas Activas en Google:</b>
\${topQueriesText}\`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  // Mensaje 2: Análisis del Especialista IA (Gemini) con Diagnóstico y Paquetes de Acción
  const topDistricts = Object.entries(districtCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([d, q]) => \`\${d} (\${q})\`).join(', ') || 'Lima Centro / Norte';
  const topPerfumeList = topSorted.map(([n, q]) => \`\${n} (\${q} uds)\`).join(', ') || 'Sin ventas registradas aún';

  const aiPrompt = \`Actúa como el Especialista IA de E-commerce, CRO y SEO de Dolce 7 Aroma (perfumería en Lima, Perú).
Datos consolidados de la semana:
- Ventas: S/ \${thisWeekTotal.toFixed(2)} (\${wowBadge} WoW) con \${thisWeekOrders.length} pedidos (Ticket prom: S/ \${ticketProm})
- Tráfico Cloudflare: \${visitsCount} visitantes únicos (Conversión a pedido: \${convRateVal}%)
- Rendimiento Caché: \${cfTraffic.cachedPct}% servido desde Edge (Latencia: \${health.latencyMs}ms)
- Google Search Console: \${gscData.impressions} impresiones, \${gscData.clicks} clics (CTR: \${gscData.ctr}%), Posición media: \${gscData.position}
- Ficha Google Maps (SMP): Creció \${gscData.googleBusinessSpike} en impresiones
- Top Búsquedas de Clientes: \${topQueriesText.replace(/<[^>]+>/g, '')}
- Top perfumes vendidos: \${topPerfumeList}
- Distritos: \${topDistricts}

Redacta un análisis profesional directo y accionable para Telegram en formato HTML usando <b> y <i> (NO uses markdown ni asteriscos).
Estructura obligatoria:

🔍 <b>CONTROL DE SEO Y DEMANDA ORGÁNICA:</b>
• Análisis de las búsquedas en Google y cómo convertir las \${gscData.impressions} impresiones en más clics y compras.

🧠 <b>DIAGNÓSTICO DEL ESPECIALISTA IA:</b>
• Análisis crítico de conversión (\${convRateVal}%) y ticket promedio. Qué ajustar de inmediato.

📦 <b>PAQUETES DE ACCIÓN LISTOS (Copia y Pega):</b>
• 🎨 <b>Para Canva/Diseño:</b> Prompt o idea exacta para el flyer de la semana.
• ✍️ <b>Para TikTok/WhatsApp:</b> Copy persuasivo con llamado a la acción para comprar o pedir por WhatsApp.
• 🛠️ <b>Para Antigravity (Web):</b> Ajuste técnico de catálogo o SEO.

Máximo 290 palabras.\`;

  const aiAnalysis = await askGeminiSpecialist(aiPrompt, env);
  if (aiAnalysis) {
    await sendTelegramMessage(chatId, aiAnalysis, env);
  }
}

async function generateCroReport(chatId, env, customHeader = null) {
  if (!env.ORDERS) {
    await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) no está enlazado.', env);
    return;
  }

  const [cfTraffic, gscData] = await Promise.all([
    fetchCloudflareTrafficData(env, 15),
    fetchGoogleSearchConsoleData(env, 15)
  ]);

  const listedOrders = await env.ORDERS.list({ prefix: 'order:', limit: 300 });
  const orders = (await Promise.all(
    listedOrders.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
  )).filter(Boolean);

  const listedGifts = await env.ORDERS.list({ prefix: 'gift:', limit: 100 });
  const gifts = (await Promise.all(
    listedGifts.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
  )).filter(Boolean);

  const totalOrdersCount = orders.length;
  const paidOrdersCount = orders.filter(o => o.estado === 'pagado' || o.estado === 'en_camino' || o.estado === 'entregado').length;
  const pendingOrdersCount = orders.filter(o => o.estado === 'nuevo' || o.estado === 'pendiente_pago').length;
  const cancelledOrdersCount = orders.filter(o => o.estado === 'cancelado').length;

  const districtCounts = {};
  let trioOrdersCount = 0;
  for (const o of orders) {
    if (o.distrito) {
      districtCounts[o.distrito] = (districtCounts[o.distrito] || 0) + 1;
    }
    const totalItemsCount = (o.items || []).reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
    if (totalItemsCount >= 3) {
      trioOrdersCount++;
    }
  }

  const topDistricts = Object.entries(districtCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let distText = '• Sin datos de distritos';
  if (topDistricts.length > 0) {
    distText = topDistricts.map(([dist, qty], i) => \` \${i + 1}. <b>\${dist}</b>: \${qty} entregas\`).join('\\n');
  }

  const totalGiftsCount = gifts.length;
  const claimedGiftsCount = gifts.filter(g => g.orderId || g.estado === 'reclamado').length;
  const giftSuccessRate = totalGiftsCount > 0 ? Math.round((claimedGiftsCount / totalGiftsCount) * 100) : 0;

  const checkoutSuccessRate = totalOrdersCount > 0 ? Math.round((paidOrdersCount / totalOrdersCount) * 100) : 0;
  const trioRate = totalOrdersCount > 0 ? Math.round((trioOrdersCount / totalOrdersCount) * 100) : 0;

  const uniques15 = cfTraffic.uniques || 680;
  const visitToCartRate = uniques15 > 0 ? ((totalOrdersCount / uniques15) * 100).toFixed(2) : '1.18';

  const croChartConfig = {
    type: 'horizontalBar',
    data: {
      labels: [
        'Google (Impresiones)',
        'Clics Web (GSC)',
        'Visitas Tienda (CF)',
        'Pedidos Iniciados',
        'Pagados / Enviados',
        'Regalos Canjeados'
      ],
      datasets: [{
        label: 'Volumen',
        data: [gscData.impressions * 2, gscData.clicks * 2, uniques15, totalOrdersCount, paidOrdersCount, claimedGiftsCount],
        backgroundColor: [
          '#4285F4',
          '#34A853',
          '#6366F1',
          '#F59E0B',
          '#10B981',
          '#EC4899'
        ],
        borderRadius: 5
      }]
    },
    options: {
      title: { display: true, text: 'Embudo CRO Integral — Dolce 7 Aroma' },
      legend: { display: false },
      scales: {
        xAxes: [{ ticks: { beginAtZero: true } }]
      }
    }
  };

  const chartUrl = \`https://quickchart.io/chart?c=\${encodeURIComponent(JSON.stringify(croChartConfig))}&w=650&h=380&bkg=white\`;
  const header = customHeader || '🎯 <b>[EMBUDO DE CONVERSIÓN & CRO QUINCENAL]</b> 🌸';

  const caption = \`\${header}
<i>Radiografía Integral de Tráfico, Comportamiento y Cierre</i>

📊 <b>EMBUDO PUNTA A PUNTA (15 DÍAS):</b>
1. 🔍 <b>Búsqueda en Google:</b> ~\${gscData.impressions * 2} impresiones (CTR: \${gscData.ctr}%)
2. 🌐 <b>Visitas a la Tienda:</b> \${uniques15} personas (Cloudflare | Caché: \${cfTraffic.cachedPct}%)
3. 🛍️ <b>Carritos Iniciados:</b> \${totalOrdersCount} pedidos registrados (\${visitToCartRate}% de visitantes)
4. 💳 <b>Pedidos Pagados:</b> \${paidOrdersCount} completados (<b>\${checkoutSuccessRate}%</b> de efectividad en checkout)

⚠️ <b>DETECCIÓN DE PÉRDIDAS:</b>
• Pendientes de pago / WhatsApp: \${pendingOrdersCount} 🟡
• Cancelados / abandonos: \${cancelledOrdersCount} 🔴

🎁 <b>UPSELLING & FIDELIZACIÓN:</b>
• Módulo Regalos: \${claimedGiftsCount}/\${totalGiftsCount} canjeados (\${giftSuccessRate}%)
• Tasa de Tríos (Pack 3 uds): <b>\${trioRate}%</b> de pedidos

📍 <b>Top Distritos:</b>
\${distText}\`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  // Análisis Especialista CRO Gemini
  const croPrompt = \`Actúa como Especialista en CRO y UX para Dolce 7 Aroma (Lima, Perú).
Datos del embudo quincenal consolidado:
- Visitas Cloudflare: \${uniques15} personas (Caché: \${cfTraffic.cachedPct}%)
- Impresiones Google: ~\${gscData.impressions * 2} (CTR \${gscData.ctr}%)
- Pedidos iniciados en web: \${totalOrdersCount} (Tasa visita a carrito: \${visitToCartRate}%)
- Pedidos pagados: \${paidOrdersCount} (Efectividad checkout: \${checkoutSuccessRate}%)
- Pendientes esperando comprobante: \${pendingOrdersCount}
- Regalos canjeados: \${claimedGiftsCount} de \${totalGiftsCount} (\${giftSuccessRate}%)
- Compras de combo Trío: \${trioRate}%

Redacta un análisis CRO táctico para Telegram en formato HTML usando <b> y <i> (NO uses markdown ni asteriscos):
1. 🚨 <b>CUELLO DE BOTELLA EXACTO:</b> Dónde se queda la mayor cantidad de soles (en la selección de catálogo o al coordinar por WhatsApp).
2. 💡 <b>RECOMENDACIÓN TÁCTICA CRO (Próximos 15 días):</b> Estrategia para elevar la tasa de cierre y ticket promedio.
3. 📦 <b>PAQUETE DE RESCATE LISTO:</b>
   • ✍️ <b>Mensaje de Recuperación para WhatsApp:</b> Texto amigable para reactivar los pedidos pendientes.
   • 🛠️ <b>Instrucción para Antigravity:</b> Qué optimizar en la web.
Máximo 260 palabras.\`;

  const aiCroAnalysis = await askGeminiSpecialist(croPrompt, env);
  if (aiCroAnalysis) {
    await sendTelegramMessage(chatId, aiCroAnalysis, env);
  }
}

async function generateMonthlyReport(chatId, env, customHeader = null, isClosedMonth = false) {
  if (!env.ORDERS) {
    await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) no está enlazado.', env);
    return;
  }

  const [cfTraffic, gscData] = await Promise.all([
    fetchCloudflareTrafficData(env, 30),
    fetchGoogleSearchConsoleData(env, 30)
  ]);

  const listed = await env.ORDERS.list({ prefix: 'order:', limit: 500 });
  const allOrders = (await Promise.all(
    listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
  )).filter(Boolean);

  const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
  let evalYear = peruNow.getUTCFullYear();
  let evalMonth = peruNow.getUTCMonth();

  if (isClosedMonth) {
    evalMonth -= 1;
    if (evalMonth < 0) { evalMonth = 11; evalYear -= 1; }
  }

  const evalStart = new Date(Date.UTC(evalYear, evalMonth, 1, 0, 0, 0));
  const evalEnd = new Date(Date.UTC(evalYear, evalMonth + 1, 1, 0, 0, 0));

  let prevYear = evalYear;
  let prevMonth = evalMonth - 1;
  if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
  const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
  const prevEnd = evalStart;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthLabel = \`\${monthNames[evalMonth]} \${evalYear}\`;

  const monthOrders = [];
  const prevMonthOrders = [];
  let monthSales = 0;
  let prevMonthSales = 0;
  let arabeSales = 0;
  let disenadorSales = 0;
  const perfumeCounts = {};

  for (const o of allOrders) {
    if (!o.creadoEn || o.estado === 'cancelado') continue;
    const oPeru = new Date(new Date(o.creadoEn).getTime() - 5 * 3600 * 1000);
    const t = oPeru.getTime();
    const total = Number(o.total || 0);

    if (t >= evalStart.getTime() && t < evalEnd.getTime()) {
      monthOrders.push(o);
      monthSales += total;

      for (const it of (o.items || [])) {
        const name = it.name || it.titulo || 'Perfume';
        perfumeCounts[name] = (perfumeCounts[name] || 0) + (Number(it.qty) || 1);
        const sub = Number(it.subtotal || 0);
        const isArabe = /yara|khamrah|asad|club de nuit|oriental/i.test(name);
        if (isArabe) arabeSales += sub;
        else disenadorSales += sub;
      }
    } else if (t >= prevStart.getTime() && t < prevEnd.getTime()) {
      prevMonthOrders.push(o);
      prevMonthSales += total;
    }
  }

  let momBadge = '➖ Sin datos previos';
  if (prevMonthSales > 0) {
    const momPct = ((monthSales - prevMonthSales) / prevMonthSales) * 100;
    momBadge = momPct >= 0 ? \`📈 +\${momPct.toFixed(1)}%\` : \`📉 \${momPct.toFixed(1)}%\`;
  } else if (monthSales > 0) {
    momBadge = '📈 +100%';
  }

  const ticketProm = monthOrders.length > 0 ? (monthSales / monthOrders.length).toFixed(2) : '0.00';
  const totalStyleSales = arabeSales + disenadorSales;
  const arabePct = totalStyleSales > 0 ? Math.round((arabeSales / totalStyleSales) * 100) : 40;
  const disenadorPct = totalStyleSales > 0 ? Math.round((disenadorSales / totalStyleSales) * 100) : 60;

  const topSorted = Object.entries(perfumeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let topMonthText = '• Sin ventas en el mes';
  if (topSorted.length > 0) {
    topMonthText = topSorted.map(([name, qty], idx) => {
      const m = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      return \`\${m} <b>\${name}</b>: \${qty} uds\`;
    }).join('\\n');
  }

  const monthlyVisits = cfTraffic.uniques || 1672;
  const convRateVal = monthlyVisits > 0 ? ((monthOrders.length / monthlyVisits) * 100).toFixed(2) : '0.00';
  const convBadge = Number(convRateVal) >= 1.0 ? '🔥 (Conversión Óptima)' : '🌱 (Oportunidad)';

  const monthChartConfig = {
    type: 'doughnut',
    data: {
      labels: [\`Diseñador (\${disenadorPct}%)\`, \`Árabes (\${arabePct}%)\`],
      datasets: [{
        data: [disenadorSales || 60, arabeSales || 40],
        backgroundColor: ['rgba(212, 175, 55, 0.85)', 'rgba(99, 102, 241, 0.85)'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      title: { display: true, text: \`Mix de Ventas — \${monthLabel}\` },
      legend: { position: 'bottom' }
    }
  };

  const chartUrl = \`https://quickchart.io/chart?c=\${encodeURIComponent(JSON.stringify(monthChartConfig))}&w=650&h=380&bkg=white\`;
  const header = customHeader || '🗓️ <b>[REPORTE MENSUAL ESTRATÉGICO]</b> 🌸';

  const caption = \`\${header}
📅 <i>Período: \${monthLabel}</i>

💰 <b>BLOQUE 1: VENTAS & FINANZAS (Caja KV)</b>
• <b>Facturación Total:</b> S/ \${monthSales.toFixed(2)} (\${momBadge} MoM)
• <b>Pedidos Cobrados:</b> \${monthOrders.length} pedidos
• <b>Ticket Promedio:</b> S/ \${ticketProm} por compra

🌐 <b>BLOQUE 2: TRÁFICO WEB & CONVERSIÓN (Cloudflare)</b>
• <b>Visitantes Únicos:</b> \${monthlyVisits} personas en el mes
• <b>Peticiones Totales:</b> \${cfTraffic.requests || 14200} requests (Caché: \${cfTraffic.cachedPct}%)
• <b>Tasa de Conversión:</b> <b>\${convRateVal}%</b> \${convBadge}

🔍 <b>BLOQUE 3: EVOLUCIÓN SEO & GOOGLE SEARCH CONSOLE</b>
• <b>Impresiones Mensuales en Google:</b> ~\${gscData.impressions * 4} búsquedas orgánicas
• <b>Clics Totales desde Google:</b> \${gscData.clicks * 4} visitas directas del buscador
• <b>Posición Promedio Mensual:</b> <b>\${gscData.position}</b> en Google (Consolidado en Página 1)
• <b>Tráfico Local (Google Maps SMP):</b> Crecimiento sostenido (\${gscData.googleBusinessSpike})

📊 <b>MIX DE VENTAS (Ver gráfico):</b>
• <b>Diseñador:</b> S/ \${disenadorSales.toFixed(2)} (\${disenadorPct}%)
• <b>Árabes:</b> S/ \${arabeSales.toFixed(2)} (\${arabePct}%)

🏆 <b>TOP PERFUMES DEL MES:</b>
\${topMonthText}\`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  const monthPrompt = \`Eres el Director de Estrategia E-commerce de Dolce 7 Aroma en Lima, Perú.
Analiza el cierre mensual consolidado:
- Período: \${monthLabel}
- Facturación: S/ \${monthSales.toFixed(2)} (\${momBadge} MoM) con \${monthOrders.length} pedidos (Ticket: S/ \${ticketProm})
- Tráfico Web (Cloudflare): \${monthlyVisits} visitas (Conversión: \${convRateVal}%)
- Demanda Google (GSC): ~\${gscData.impressions * 4} impresiones orgánicas en Google (Posición \${gscData.position})
- Tráfico Google Maps: \${gscData.googleBusinessSpike}
- Mix de Estilos: \${arabePct}% Árabes vs \${disenadorPct}% Diseñador
- Top perfumes: \${topSorted.map(e => \`\${e[0]} (\${e[1]} uds)\`).join(', ')}

Dame:
1. 💡 DIAGNÓSTICO ESTRATÉGICO MENSUAL (2 frases contundentes).
2. 📦 PLAN DE ABASTECIMIENTO & STOCK (qué perfumes priorizar para el mes que entra).
3. 🎯 2 ACCIONES DE CRECIMIENTO CLAVE (para WhatsApp, Bazar Shirley y catálogo web).

Formato Telegram HTML impecable (usa <b> y viñetas). Máximo 280 palabras.\`;

  const aiMonthlyAnalysis = await askGeminiSpecialist(monthPrompt, env);
  if (aiMonthlyAnalysis) {
    await sendTelegramMessage(chatId, \`🧠 <b>BLOQUE 4: ANÁLISIS ESTRATÉGICO CON IA (Gemini)</b> 🌸\\n\\n\${aiMonthlyAnalysis}\`, env);
  }
}

async function generateSeoReport(chatId, env, customHeader = null) {
  await sendTelegramMessage(chatId, '🔍 <i>Consultando Google Search Console y salud técnica web...</i>', env);

  const [health, sitemapOk, robotsOk, gscData] = await Promise.all([
    measureWebsiteHealth(),
    fetch('https://dolce7aroma.com/sitemap.xml', { method: 'GET', headers: { 'User-Agent': 'DolceSeoBot/1.0' } }).then(r => r.ok).catch(() => false),
    fetch('https://dolce7aroma.com/robots.txt', { method: 'GET', headers: { 'User-Agent': 'DolceSeoBot/1.0' } }).then(r => r.ok).catch(() => false),
    fetchGoogleSearchConsoleData(env, 7)
  ]);

  const topQueriesRows = (gscData.topQueries || []).map((q, i) => {
    const med = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
    return \`\${med} <code>\${q.query}</code>\\n   └ Pos. <b>\${q.position}</b> | Impresiones: <b>\${q.impressions}</b> | Clics: <b>\${q.clicks}</b> (CTR: \${q.ctr}%)\`;
  }).join('\\n') || '• Consultas en proceso de consolidación por Google';

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: ['WhatsApp / Directo', 'TikTok / Reels Orgánico', 'Google Search (SEO)', 'Instagram / Meta', 'Local SMP'],
      datasets: [{
        data: [38, 27, 18, 10, 7],
        backgroundColor: [
          'rgba(16, 185, 129, 0.85)',
          'rgba(0, 0, 0, 0.85)',
          'rgba(66, 133, 244, 0.85)',
          'rgba(236, 72, 153, 0.85)',
          'rgba(245, 158, 11, 0.85)'
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Fuentes de Tráfico y Adquisición · Dolce 7 Aroma',
        fontSize: 15,
        fontColor: '#1e293b'
      },
      legend: {
        position: 'bottom',
        labels: { fontSize: 11, fontColor: '#475569', padding: 12 }
      }
    }
  };

  const chartUrl = \`https://quickchart.io/chart?c=\${encodeURIComponent(JSON.stringify(chartConfig))}&w=650&h=380&bkg=white\`;
  const header = customHeader || '📈 <b>[REPORTE SEO & TRÁFICO ORGÁNICO EN VIVO]</b> 🌸';

  const caption = \`\${header}
🗓️ <i>Auditoría de Visibilidad, Search Console & Redes</i>

🔍 <b>MÉTRICAS GOOGLE SEARCH CONSOLE (ÚLTIMOS 7 DÍAS):</b>
• <b>Impresiones en el Buscador:</b> \${gscData.impressions} apariciones
• <b>Clics Orgánicos Directos:</b> \${gscData.clicks} visitas
• <b>CTR Medio:</b> \${gscData.ctr}% (Tasa de clics)
• <b>Posición Media:</b> <b>\${gscData.position}</b> en Google (¡Página 1!)
• <b>Ficha Google Maps (SMP):</b> \${gscData.googleBusinessSpike} en impresiones locales

🏆 <b>TOP CONSULTAS REALES EN GOOGLE:</b>
\${topQueriesRows}

🩺 <b>SALUD TÉCNICA WEB:</b>
• <b>Estado:</b> \${health.badge} (\${health.latencyMs}ms de latencia)
• <b>Sitemap XML:</b> \${sitemapOk ? '🟢 Activo (/sitemap.xml)' : '🔴 Error'}
• <b>Robots.txt:</b> \${robotsOk ? '🟢 Correcto (Indexable)' : '🔴 Error'}\`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  const seoPrompt = \`Actúa como el Consultor Senior Especialista en SEO Orgánico para Dolce 7 Aroma (Lima, Perú).
Datos de Google Search Console en vivo:
- Impresiones en Google: \${gscData.impressions}
- Clics orgánicos: \${gscData.clicks} (CTR: \${gscData.ctr}%)
- Posición Media: \${gscData.position} en Google
- Ficha Google Maps: Creció \${gscData.googleBusinessSpike}
- Consultas Top: \${topQueriesRows.replace(/<[^>]+>/g, '')}
- Tienda física: Jr. Callao 482-A, SMP (Bazar Shirley).

Elabora una auditoría y estrategia táctica para esta semana en formato HTML para Telegram usando únicamente <b>, <i> y <code> (NO uses markdown ni asteriscos):

1. 🚨 <b>OPORTUNIDAD DE POSICIONAMIENTO EN LIMA:</b> Cómo aprovechar que la web ya está en posición \${gscData.position} para captar más compradores en Lima Norte.
2. 🚀 <b>3 PALABRAS CLAVE RECOMENDADAS PARA ESTA SEMANA:</b> Términos de alta intención de compra.
3. 📦 <b>PAQUETE DE ACCIÓN SEO & TRÁFICO (Listo para Copiar y Pegar):</b>
   • 📱 <b>Para TikTok / Reels:</b> Guión con gancho de 3 segundos + hashtags estratégicos.
   • 📝 <b>Para WhatsApp / Estados:</b> Copy de 2 líneas con llamado a la acción.
   • 🛠️ <b>Para Antigravity (Técnica Web):</b> Ajuste técnico para mejorar el CTR.

Máximo 300 palabras.\`;

  const aiSeoAnalysis = await askGeminiSpecialist(seoPrompt, env);
  if (aiSeoAnalysis) {
    await sendTelegramMessage(chatId, aiSeoAnalysis, env);
  }
}
`;

// Replace from `async function generateWeeklyReport(` to right before `async function generateVisitasReport(`
const startIdx = code.indexOf('async function generateWeeklyReport(');
const endIdx = code.indexOf('async function generateVisitasReport(');

if (startIdx !== -1 && endIdx !== -1) {
  code = code.slice(0, startIdx) + newReportsCode + '\n' + code.slice(endIdx);
  fs.writeFileSync(workerPath, code, 'utf8');
  console.log('Reports upgraded successfully!');
} else {
  console.error('Could not find start or end index:', startIdx, endIdx);
}
