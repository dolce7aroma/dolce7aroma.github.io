/**
 * Dolce Aroma — Worker de publicación del panel Admin
 * ────────────────────────────────────────────────────
 * Qué hace: recibe fotos y el catálogo desde perfumes-gestion-da7.html y los
 * commitea directo al repo de GitHub, para que el Admin publique de verdad
 * (hoy solo guardaba en el navegador local).
 *
 * CÓMO INSTALARLO (una sola vez, sin terminal ni npm):
 *   1. Entra a dash.cloudflare.com → Workers & Pages → Create → Create Worker.
 *   2. Ponle un nombre (ej. "dolce-aroma-admin") y créalo.
 *   3. Abre "Edit code", borra el contenido de ejemplo y pega ESTE archivo completo.
 *   4. Guarda y despliega ("Deploy").
 *   5. Ve a Settings → Variables and Secrets de este Worker y agrega DOS secretos:
 *        GITHUB_TOKEN → un Personal Access Token de GitHub (fine-grained),
 *                        con acceso SOLO al repo dolce7aroma.github.io y
 *                        permiso "Contents: Read and write".
 *        ADMIN_KEY    → tu contraseña de Admin EN TEXTO PLANO (ej. "MiClave123"),
 *                        NO el hash largo que aparece en ADMIN_PASSWORD_HASH dentro
 *                        de perfumes-gestion-da7.html. Ese hash es público (cualquiera
 *                        puede verlo con "ver código fuente"); si lo usaras acá, cualquiera
 *                        podría publicar en tu repo sin saber la contraseña real.
 *   6. Copia la URL pública del Worker (algo como
 *        https://dolce-aroma-admin.TU-SUBDOMINIO.workers.dev )
 *      y pégala en perfumes-gestion-da7.html en la constante API_BASE.
 *
 * SECRETOS OPCIONALES (para los avisos de pedidos nuevos — el sitio funciona
 * igual sin ellos, simplemente no llega el aviso automático hasta que los cargues):
 *   RESEND_API_KEY   → API key de resend.com (capa gratis) para mandar el correo.
 *   ORDER_EMAIL_TO   → tu correo, donde querés recibir el aviso de cada pedido.
 *   ORDER_EMAIL_FROM → (opcional) remitente verificado en Resend; si no lo pones,
 *                       usa el de pruebas de Resend.
 *   TELEGRAM_BOT_TOKEN → token del bot que crees con @BotFather en Telegram.
 *   TELEGRAM_CHAT_ID   → el chat donde el bot te manda los avisos (el tuyo).
 *
 * ALMACENAMIENTO DE PEDIDOS (opcional, pero recomendado):
 *   Sin esto, los pedidos SOLO viajan por el correo/Telegram del momento — si
 *   ninguno está configurado (o falla), el pedido se pierde. Con un KV
 *   namespace enlazado, cada pedido queda guardado con un número de
 *   referencia y se puede ver/actualizar su estado desde la pestaña
 *   "Pedidos" del Admin.
 *   1. Cloudflare dashboard → Workers & Pages → KV → Create a namespace
 *      (ej. nómbralo "dolce-aroma-pedidos").
 *   2. Copia el ID del namespace creado.
 *   3. Pídele a Claude que lo agregue a wrangler.toml así:
 *        [[kv_namespaces]]
 *        binding = "ORDERS"
 *        id = "EL_ID_QUE_COPIASTE"
 *   4. Se despliega solo al hacer push. Sin este paso, el sitio sigue
 *      funcionando igual, solo que los pedidos no quedan guardados.
 *
 * PAGO CON TARJETA (Culqi — opcional):
 *   Sin CULQI_SECRET_KEY, la tarjeta de pago del checkout muestra "Próximamente"
 *   y este endpoint no hace nada. Para activarlo:
 *   1. Crea cuenta en culqi.com y saca tus llaves (Desarrollo → Llaves API).
 *   2. La llave PÚBLICA (pk_test_... o pk_live_...) va en el Admin → pestaña
 *      "Pago" → campo "Llave pública de Culqi" — esa NO es secreta, se publica
 *      igual que el resto del catálogo.
 *   3. La llave SECRETA (sk_test_... o sk_live_...) va SOLO en Cloudflare →
 *      este Worker → Settings → Variables and Secrets → CULQI_SECRET_KEY
 *      (tipo "Secreto"). Nunca en el código ni en wrangler.toml.
 *   4. Para cobrar de verdad (llaves *_live_*) necesitas RUC — sin él, Culqi
 *      solo permite modo prueba (*_test_*), que funciona igual mientras tanto.
 */

const REPO_OWNER = 'dolce7aroma';
const REPO_NAME = 'dolce7aroma.github.io';
const BRANCH = 'main';
const ALLOWED_ORIGINS = new Set([
  'https://dolce7aroma.com',
  'https://www.dolce7aroma.com',
  'https://dolce7aroma.github.io'
]);
let currentOrigin = 'https://dolce7aroma.com';

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function checkRateLimit(ip, env) {
  if (!ip || !env.ORDERS) return true;
  const key = `rl:${ip}`;
  let count = 0;
  try {
    const v = await env.ORDERS.get(key);
    if (v) count = parseInt(v, 10);
    if (count >= 5) return false;
    await env.ORDERS.put(key, (count + 1).toString(), { expirationTtl: 3600 });
  } catch(e) {}
  return true;
}

const TRIO_TIERS = {
  110: { perTrio: () => 30 },
  50:  { perTrio: () => 15 },
  10:  { perTrio: () => 10 }
};
const DUO_TIERS = {
  110: { amount: 30 },
  50:  { amount: 10 }
};

function calculateCartTotal(items, catalog) {
  if(!catalog || !catalog.perfumes) return 0;
  const groups = {};
  items.forEach(it => {
    const p = catalog.perfumes.find(x => (x.id === it.id) || (x.name === it.name));
    if(!p) return;
    const sz = p.sizes?.find(s => s.ml === it.ml);
    if(!sz) return;
    groups[it.ml] = groups[it.ml] || [];
    for(let i=0; i<it.qty; i++) {
      let price = sz.price || 0;
      if(it.premium && p.frascoPremium?.disponible) price += p.frascoPremium.precio;
      groups[it.ml].push(price);
    }
  });

  let subtotal = Object.values(groups).reduce((s,arr)=> s + arr.reduce((a,b)=>a+b,0), 0);
  let totalDiscount = 0;

  Object.entries(groups).forEach(([mlStr, prices]) => {
    const ml = +mlStr;
    const trioTier = TRIO_TIERS[ml];
    const duoTier = DUO_TIERS[ml];
    const sorted = prices.slice().sort((a,b)=>a-b);
    const n = sorted.length;

    let trios = trioTier ? Math.floor(n / 3) : 0;
    let resto = n - trios * 3;
    if(resto === 1 && trios > 0 && duoTier){ trios -= 1; resto += 3; }
    const duos = duoTier ? Math.floor(resto / 2) : 0;

    let idx = 0;
    for(let t=0;t<trios;t++){ totalDiscount += trioTier.perTrio(sorted[idx]); idx += 3; }
    for(let d=0;d<duos;d++){ totalDiscount += duoTier.amount; idx += 2; }
  });
  return subtotal - totalDiscount;
}

function calculateShippingCost(provincia, distrito, zonas) {
  if (!zonas || !zonas.distritosLima) return 0;
  if (provincia && provincia !== 'Lima' && provincia !== 'Callao') return 0;
  if (!distrito || distrito === '-') return 0;
  const n = (distrito||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const d = zonas.distritosLima.find(z => (z.nombre||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() === n);
  return d ? (d.costo || 0) : 0;
}



function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': currentOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Vary': 'Origin',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// Solo letras/números/espacios/guiones + acentos comunes en español, y extensión de imagen conocida.
function sanitizeFilename(name) {
  if (typeof name !== 'string') return null;
  const base = name.split('/').pop().split('\\').pop().trim();
  if (!base || base === '.' || base === '..') return null;
  if (!/^[\w À-ſ.-]+\.(jpe?g|png|webp)$/i.test(base)) return null;
  return base;
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function contentsUrl(path, query) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function githubRequest(path, query, init, env) {
  return fetch(contentsUrl(path, query), {
    ...init,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'dolce-aroma-admin-worker',
      'Content-Type': 'application/json',
      ...((init && init.headers) || {}),
    },
  });
}

async function getFileSha(path, env) {
  const res = await githubRequest(path, { ref: BRANCH }, { method: 'GET' }, env);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}`);
  const data = await res.json();
  return data.sha || null;
}

async function putFile(path, base64Content, message, env) {
  const sha = await getFileSha(path, env);
  const body = { message, content: base64Content, branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await githubRequest(path, null, { method: 'PUT', body: JSON.stringify(body) }, env);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${errText}`);
  }
  return res.json();
}

async function handleUploadPhoto(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { key, filename, imageBase64 } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);

  const safeName = sanitizeFilename(filename);
  if (!safeName) {
    return json({ ok: false, error: 'Nombre de archivo no válido (usa letras, números, espacios, guiones y termina en .jpg/.png/.webp)' }, 400);
  }
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return json({ ok: false, error: 'Falta la imagen' }, 400);
  }
  const raw = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  if (raw.length > 6_000_000) {
    return json({ ok: false, error: 'La imagen es muy pesada (máx. ~4MB). Comprímela e intenta de nuevo.' }, 400);
  }

  try {
    await putFile(`assets/perfumes/${safeName}`, raw, `Admin: subir foto ${safeName}`, env);
    return json({ ok: true, path: `assets/perfumes/${safeName}` });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// Igual que handleUploadPhoto, pero para las imágenes de los anuncios del carrusel
// del hero (Inicio) — se guardan aparte, en assets/anuncios/, para no mezclarlas
// con las fotos de producto.
async function handleUploadAnuncioPhoto(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { key, filename, imageBase64 } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);

  const safeName = sanitizeFilename(filename);
  if (!safeName) {
    return json({ ok: false, error: 'Nombre de archivo no válido (usa letras, números, espacios, guiones y termina en .jpg/.png/.webp)' }, 400);
  }
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return json({ ok: false, error: 'Falta la imagen' }, 400);
  }
  const raw = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  if (raw.length > 6_000_000) {
    return json({ ok: false, error: 'La imagen es muy pesada (máx. ~4MB). Comprímela e intenta de nuevo.' }, 400);
  }

  try {
    await putFile(`assets/anuncios/${safeName}`, raw, `Admin: subir imagen de anuncio ${safeName}`, env);
    return json({ ok: true, path: `assets/anuncios/${safeName}` });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

async function handleDeletePhoto(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { key, filename } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);

  const safeName = sanitizeFilename(filename);
  if (!safeName) return json({ ok: false, error: 'Nombre de archivo no válido' }, 400);

  const path = `assets/perfumes/${safeName}`;
  try {
    const sha = await getFileSha(path, env);
    if (!sha) return json({ ok: true, note: 'El archivo ya no existía en el repo' });
    const res = await githubRequest(path, null, {
      method: 'DELETE',
      body: JSON.stringify({ message: `Admin: borrar foto ${safeName}`, sha, branch: BRANCH }),
    }, env);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub DELETE ${path} → ${res.status}: ${errText}`);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

async function handleSaveCatalog(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { key, productos } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);
  if (!productos || !Array.isArray(productos.perfumes)) {
    return json({ ok: false, error: 'Formato de catálogo inválido (falta "perfumes")' }, 400);
  }

  try {
    const content = utf8ToBase64(JSON.stringify(productos, null, 2));
    await putFile('data/productos.json', content, 'Admin: actualizar catálogo', env);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// Lista blanca de archivos de configuración que el Admin puede publicar (fuera del catálogo/fotos).
const ALLOWED_CONFIG_FILES = ['data/zonas-envio.json', 'data/pago.json', 'data/anuncios-hero.json'];

async function handleSaveConfig(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { key, file, config } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);
  if (!ALLOWED_CONFIG_FILES.includes(file)) return json({ ok: false, error: 'Archivo no permitido' }, 400);
  if (!config || typeof config !== 'object') return json({ ok: false, error: 'Config inválida' }, 400);

  try {
    const content = utf8ToBase64(JSON.stringify(config, null, 2));
    await putFile(file, content, `Admin: actualizar ${file}`, env);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// Genera un número de pedido corto y legible (ej. DA-M2X7A3) a partir de la hora actual + azar.
function generateOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `DA-${t.slice(-5)}${r}`;
}

const ORDER_STATUSES = ['nuevo', 'pagado', 'en_camino', 'entregado', 'cancelado'];

// Avisa al dueño del negocio (vos) por correo y/o Telegram — best-effort, nunca bloquea
// la respuesta al cliente. Compartido entre pedidos normales y regalos ya resueltos.
async function notifyOwner(subject, summary, env) {
  const notified = { email: false, telegram: false };
  if (env.RESEND_API_KEY && env.ORDER_EMAIL_TO) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.ORDER_EMAIL_FROM || 'Dolce Aroma <onboarding@resend.dev>',
          to: [env.ORDER_EMAIL_TO],
          subject,
          text: summary,
        }),
      });
      notified.email = res.ok;
    } catch (e) { /* best-effort */ }
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: summary }),
      });
      notified.telegram = res.ok;
    } catch (e) { /* best-effort */ }
  }
  return notified;
}

function orderSummaryText(record) {
  const itemsText = record.items.map(it => `- ${it.name} (${it.ml} ml) x${it.qty}${it.premium ? ' + frasco premium' : ''} — S/ ${it.subtotal}`).join('\n');
  const regaladoPor = record.esRegalo && record.compradorTelefono
    ? `\nRegalado por: ${record.compradorNombre || '(sin nombre)'} · WhatsApp ${record.compradorTelefono}` : '';
  return `${record.esRegalo ? '🎁' : '🌸'} Nuevo pedido${record.esRegalo ? ' (REGALO)' : ''} — Dolce Aroma

Pedido: #${record.id}
Cliente: ${record.nombre}
Teléfono: ${record.telefono}
Provincia: ${record.provincia || 'Lima'}
Distrito: ${record.distrito}
Dirección: ${record.direccion}
Referencia: ${record.referencia || '-'}
Método de pago: ${record.metodoPago || '-'}${regaladoPor}

Productos:
${itemsText}

Subtotal: S/ ${record.subtotal}
Envío: S/ ${record.envio || 0}
Total: S/ ${record.total}`;
}

// Pedido enviado por un CLIENTE (no requiere ADMIN_KEY — es público, pero no toca el repo,
// solo dispara avisos por correo/Telegram si esos secretos están configurados y lo guarda
// en KV si el binding ORDERS está enlazado).
async function handleSubmitOrder(request, env) {
  const ip = request.headers.get('cf-connecting-ip');
  if (!(await checkRateLimit(ip, env))) {
    return json({ ok: false, error: 'Demasiados pedidos. Por favor, intenta de nuevo en una hora.' }, 429);
  }

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { provincia, nombre, telefono, distrito, direccion, referencia, items, metodoPago, esRegalo } = body;
  if (!nombre || !telefono || !distrito || !direccion) {
    return json({ ok: false, error: 'Faltan datos del pedido' }, 400);
  }
  if (!Array.isArray(items) || !items.length) {
    return json({ ok: false, error: 'El pedido no tiene productos' }, 400);
  }

  const catalog = await fetchJSON('https://dolce7aroma.com/data/productos.json')
               || await fetchJSON('https://dolce7aroma.github.io/data/productos.json');
  const zonas = await fetchJSON('https://dolce7aroma.com/data/zonas-envio.json')
             || await fetchJSON('https://dolce7aroma.github.io/data/zonas-envio.json');
  
  if(!catalog || !zonas) {
    return json({ ok: false, error: 'Error interno conectando con el catálogo. Intenta más tarde.' }, 502);
  }

  const realSubtotal = calculateCartTotal(items, catalog);
  const realShipping = 0; // Se coordina luego
  const realTotal = realSubtotal;

  const orderId = generateOrderId();
  const record = {
    id: orderId, nombre, telefono, provincia: provincia || 'Lima', distrito, direccion, referencia,
    items, subtotal: realSubtotal, envio: realShipping, total: realTotal, metodoPago: metodoPago || null, esRegalo: !!esRegalo,
    estado: 'nuevo', creadoEn: new Date().toISOString(),
  };

  if (env.ORDERS) {
    try { await env.ORDERS.put(`order:${orderId}`, JSON.stringify(record)); }
    catch (e) { /* si falla el guardado, igual seguimos con los avisos */ }
  }

  const notified = await notifyOwner(`Nuevo pedido de ${nombre}`, orderSummaryText(record), env);
  return json({ ok: true, orderId, notified });
}

// Lista los pedidos guardados en KV (más nuevos primero). Requiere ADMIN_KEY.
async function handleListOrders(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);
  const { key } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);
  if (!env.ORDERS) return json({ ok: false, error: 'Aún no configuraste el almacenamiento de pedidos (KV) en Cloudflare.' }, 400);

  try {
    const listed = await env.ORDERS.list({ prefix: 'order:', limit: 500 });
    const orders = (await Promise.all(
      listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
    )).filter(Boolean);
    orders.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
    return json({ ok: true, orders });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// Actualiza el estado de un pedido (nuevo/pagado/en_camino/entregado/cancelado). Requiere ADMIN_KEY.
async function handleUpdateOrderStatus(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);
  const { key, orderId, estado } = body;
  if (key !== env.ADMIN_KEY) return json({ ok: false, error: 'Contraseña incorrecta' }, 401);
  if (!env.ORDERS) return json({ ok: false, error: 'Aún no configuraste el almacenamiento de pedidos (KV) en Cloudflare.' }, 400);
  if (!orderId) return json({ ok: false, error: 'Falta el número de pedido' }, 400);
  if (!ORDER_STATUSES.includes(estado)) return json({ ok: false, error: 'Estado no válido' }, 400);

  try {
    const raw = await env.ORDERS.get(`order:${orderId}`);
    if (!raw) return json({ ok: false, error: 'Pedido no encontrado' }, 404);
    const record = JSON.parse(raw);
    record.estado = estado;
    record.actualizadoEn = new Date().toISOString();
    await env.ORDERS.put(`order:${orderId}`, JSON.stringify(record));
    return json({ ok: true, order: record });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// ─── Regalar un perfume ───
// Un "regalo" vive aparte de los pedidos (gift:<id> en vez de order:<id>) mientras está
// sin resolver — recién se convierte en un pedido real (visible en la pestaña Pedidos)
// cuando las DOS cosas son ciertas: alguien lo pagó Y la persona regalada ya eligió.
// Si el comprador entrega el regalo a sí mismo, no pasa por acá — usa /api/submit-order
// directo (con esRegalo:true), porque no hay nada que "elegir" del otro lado.
function generateGiftId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `RG-${t.slice(-5)}${r}`;
}

// Días de vigencia de un link de regalo sin resolver (debe coincidir con GIFT_EXPIRY_DAYS
// en assets/shop.js, que se usa solo para mostrar el aviso al comprador).
const GIFT_EXPIRY_DAYS = 15;

// No hay Cron Trigger configurado, así que la expiración es "perezosa": recién se detecta
// y se persiste (estado:'expirado') la próxima vez que alguien accede al link. Un regalo ya
// convertido en pedido (orderId) nunca expira, sin importar cuánto tiempo pasó.
function isGiftExpired(record) {
  if (record.orderId) return false;
  const created = new Date(record.creadoEn).getTime();
  if (!created) return false;
  return (Date.now() - created) > GIFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

// Si el regalo venció y todavía no se había marcado, lo marca 'expirado' y lo guarda.
// Devuelve true si el regalo está (o queda) expirado — el llamador debe cortar ahí.
async function markExpiredIfNeeded(record, env) {
  if (record.estado === 'expirado') return true;
  if (!isGiftExpired(record)) return false;
  record.estado = 'expirado';
  try { await env.ORDERS.put(`gift:${record.id}`, JSON.stringify(record)); } catch (e) { /* best-effort */ }
  return true;
}

// Si el regalo ya está pagado Y ya fue elegido, lo convierte en un pedido real y avisa.
// Devuelve el orderId si lo convirtió, o null si todavía falta algo.
async function promoteGiftIfComplete(record, env) {
  if (!record.pagado || !record.elegido || record.orderId) return record.orderId || null;
  const chosen = record.items[record.eleccionIndex];
  const orderId = generateOrderId();
  const order = {
    id: orderId,
    nombre: record.direccion.nombre, telefono: record.direccion.telefono,
    distrito: record.direccion.distrito, direccion: record.direccion.direccion,
    referencia: record.direccion.referencia || '',
    items: [chosen], subtotal: record.total, total: record.total,
    metodoPago: record.metodoPago || null, esRegalo: true,
    compradorNombre: record.compradorNombre || '', compradorTelefono: record.compradorTelefono || '',
    estado: 'pagado', creadoEn: new Date().toISOString(),
  };
  if (env.ORDERS) {
    try { await env.ORDERS.put(`order:${orderId}`, JSON.stringify(order)); } catch (e) { /* sigue igual */ }
  }
  await notifyOwner(`Regalo pagado y elegido — ${order.nombre}`, orderSummaryText(order), env);
  record.orderId = orderId;
  record.estado = 'convertido';
  return orderId;
}

// El comprador arma la lista curada. Pública — sin ADMIN_KEY, cualquier cliente arma un regalo.
async function handleCreateGift(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);
  const { items, compradorTelefono, compradorNombre, total } = body;
  if (!Array.isArray(items) || !items.length) return json({ ok: false, error: 'Elige al menos un perfume para el regalo' }, 400);
  if (!compradorTelefono) return json({ ok: false, error: 'Falta tu WhatsApp para avisarte' }, 400);
  if (!env.ORDERS) return json({ ok: false, error: 'Aún no está activo el guardado de regalos (falta el KV en Cloudflare).' }, 400);

  const giftId = generateGiftId();
  const record = {
    id: giftId, tipo: 'regalo',
    items, compradorTelefono, compradorNombre: compradorNombre || '', total: total || 0,
    direccion: null, eleccionIndex: null,
    pagado: false, elegido: false, orderId: null,
    estado: 'pendiente_eleccion', creadoEn: new Date().toISOString(),
  };
  try {
    await env.ORDERS.put(`gift:${giftId}`, JSON.stringify(record));
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
  return json({ ok: true, giftId });
}

// La persona regalada (o el propio comprador, para ver el estado) carga el regalo. Pública.
// No devuelve el teléfono del comprador salvo que se pida explícitamente (para armar el link de aviso).
async function handleGetGift(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.giftId) return json({ ok: false, error: 'Falta el ID del regalo' }, 400);
  if (!env.ORDERS) return json({ ok: false, error: 'No disponible' }, 400);
  try {
    const raw = await env.ORDERS.get(`gift:${body.giftId}`);
    if (!raw) return json({ ok: false, error: 'Este link de regalo no existe o ya expiró' }, 404);
    const record = JSON.parse(raw);
    if (await markExpiredIfNeeded(record, env)) {
      return json({ ok: false, error: 'Este link de regalo ya expiró' }, 410);
    }
    return json({
      ok: true,
      gift: {
        id: record.id, items: record.items, total: record.total,
        estado: record.estado, elegido: record.elegido, pagado: record.pagado,
        compradorTelefono: record.compradorTelefono,
      },
    });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// La persona regalada elige su perfume (y, si hace falta, deja su dirección). Pública.
async function handleClaimGift(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.giftId) return json({ ok: false, error: 'Falta el ID del regalo' }, 400);
  const { giftId, eleccionIndex, nombre, telefono, distrito, direccion, referencia } = body;
  if (!env.ORDERS) return json({ ok: false, error: 'No disponible' }, 400);

  try {
    const raw = await env.ORDERS.get(`gift:${giftId}`);
    if (!raw) return json({ ok: false, error: 'Este link de regalo no existe o ya expiró' }, 404);
    const record = JSON.parse(raw);
    if (await markExpiredIfNeeded(record, env)) {
      return json({ ok: false, error: 'Este link de regalo ya expiró' }, 410);
    }
    if (record.elegido) return json({ ok: false, error: 'Este regalo ya fue elegido antes' }, 400);
    if (typeof eleccionIndex !== 'number' || !record.items[eleccionIndex]) {
      return json({ ok: false, error: 'Elige un perfume válido' }, 400);
    }
    if (!record.direccion) {
      if (!nombre || !telefono || !distrito || !direccion) {
        return json({ ok: false, error: 'Faltan tus datos de entrega' }, 400);
      }
      record.direccion = { nombre, telefono, distrito, direccion, referencia: referencia || '' };
    }
    record.eleccionIndex = eleccionIndex;
    record.elegido = true;
    record.estado = record.pagado ? 'convertido' : 'pendiente_pago';
    record.actualizadoEn = new Date().toISOString();

    const orderId = await promoteGiftIfComplete(record, env);
    await env.ORDERS.put(`gift:${giftId}`, JSON.stringify(record));
    return json({ ok: true, orderId, compradorTelefono: record.compradorTelefono });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// El comprador confirma que ya pagó (Yape) — mismo nivel de confianza que un pedido normal:
// no hay verificación automática, vos confirmás por WhatsApp igual que siempre. Pública.
async function handleMarkGiftPaid(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.giftId) return json({ ok: false, error: 'Falta el ID del regalo' }, 400);
  if (!env.ORDERS) return json({ ok: false, error: 'No disponible' }, 400);

  try {
    const raw = await env.ORDERS.get(`gift:${body.giftId}`);
    if (!raw) return json({ ok: false, error: 'Este link de regalo no existe o ya expiró' }, 404);
    const record = JSON.parse(raw);
    if (await markExpiredIfNeeded(record, env)) {
      return json({ ok: false, error: 'Este link de regalo ya expiró' }, 410);
    }
    record.pagado = true;
    record.estado = record.elegido ? 'convertido' : 'pendiente_eleccion';
    record.actualizadoEn = new Date().toISOString();
    const orderId = await promoteGiftIfComplete(record, env);
    await env.ORDERS.put(`gift:${body.giftId}`, JSON.stringify(record));
    return json({ ok: true, orderId });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// Cobra la tarjeta tokenizada por Culqi.js y, si sale bien, marca el pedido como "pagado".
// Pública (el cliente la llama al pagar), pero solo hace algo si CULQI_SECRET_KEY está configurado.
async function handleChargeCulqi(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);
  const { orderId, token, email } = body;
  if (!env.CULQI_SECRET_KEY) return json({ ok: false, error: 'El cobro con tarjeta no está activado todavía.' }, 400);
  if (!token || !email || !orderId) return json({ ok: false, error: 'Faltan datos del pago' }, 400);

  try {
    const rawOrder = env.ORDERS ? await env.ORDERS.get(`order:${orderId}`) : null;
    if (!rawOrder) return json({ ok: false, error: 'Pedido no encontrado para cobrar' }, 404);
    const orderRecord = JSON.parse(rawOrder);
    const calculatedAmount = Math.round(orderRecord.total * 100);

    const res = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: calculatedAmount,
        currency_code: 'PEN',
        email,
        source_id: token,
        description: orderId ? `Pedido Dolce Aroma #${orderId}` : 'Pedido Dolce Aroma',
      }),
    });
    const charge = await res.json().catch(() => null);
    if (!res.ok || !charge) {
      return json({ ok: false, error: charge?.user_message || charge?.merchant_message || 'El banco rechazó el pago' }, 402);
    }

    if (orderId && env.ORDERS) {
      try {
        const raw = await env.ORDERS.get(`order:${orderId}`);
        if (raw) {
          const record = JSON.parse(raw);
          record.estado = 'pagado';
          record.actualizadoEn = new Date().toISOString();
          record.culqiChargeId = charge.id;
          await env.ORDERS.put(`order:${orderId}`, JSON.stringify(record));
        }
      } catch (e) { /* el cobro ya se hizo; si esto falla solo no se actualiza el estado */ }
    }

    return json({ ok: true, chargeId: charge.id });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 502);
  }
}

// ─── Bot de Telegram Interactivo (Reportería & Comandos) ───

async function sendTelegramMessage(chatId, text, env, extra = {}) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...extra
      }),
    });
    if (!res.ok) {
      // Reintento en texto plano si Telegram rechaza las etiquetas o entidades HTML
      const plainText = (text || '').replace(/<[^>]*>/g, '');
      const retryRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText,
          ...extra
        }),
      });
      return retryRes.ok;
    }
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function sendTelegramPhoto(chatId, photoUrl, caption, env, extra = {}) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: (caption || '').slice(0, 1024),
        parse_mode: 'HTML',
        ...extra
      }),
    });
    if (!res.ok) {
      await sendTelegramMessage(chatId, `${caption}\n\n📊 <a href="${photoUrl}">Ver Gráfico Estadístico</a>`, env);
    }
    return res.ok;
  } catch (e) {
    await sendTelegramMessage(chatId, `${caption}\n\n📊 <a href="${photoUrl}">Ver Gráfico Estadístico</a>`, env);
    return false;
  }
}


function getNextCampaign(now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const peruNow = new Date(now.getTime() - 5 * 3600 * 1000);

  const rawCampaigns = [
    { name: 'San Valentín 💘', month: 2, day: 14, focus: 'Regalos para parejas y Dúos' },
    { name: 'Día de la Mujer 🌸', month: 3, day: 8, focus: 'Fragancias florales/dulces' },
    { name: 'Día de la Madre 👑', month: 5, day: 10, focus: 'Frascos 110ml y perfumes prémium' },
    { name: 'Día del Padre 🎩', month: 6, day: 21, focus: 'Perfumes amaderados y árabes intensos' },
    { name: 'Fiestas Patrias 🇵🇪', month: 7, day: 28, focus: 'Perfumes pocket 10ml para viajes' },
    { name: 'Black Friday / Cyber ⚡', month: 11, day: 27, focus: 'Liquidación de stock y tríos con descuento' },
    { name: 'Navidad & Fin de Año 🎄', month: 12, day: 24, focus: 'Regalos express y preventa anticipada' }
  ];

  let next = null;
  let minDiff = Infinity;

  for (const c of rawCampaigns) {
    let target = new Date(Date.UTC(currentYear, c.month - 1, c.day, 5, 0, 0));
    if (target.getTime() < peruNow.getTime()) {
      target = new Date(Date.UTC(currentYear + 1, c.month - 1, c.day, 5, 0, 0));
    }
    const diffDays = Math.ceil((target.getTime() - peruNow.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < minDiff) {
      minDiff = diffDays;
      next = { ...c, daysLeft: diffDays, targetDate: target.toISOString().slice(0, 10) };
    }
  }
  return next;
}


// ─── Generadores de Reportes Estadísticos & Cron Triggers ───

const ARABE_BRANDS_SET = new Set(['afnan', 'lattafa', 'bharara', 'kayali', 'al haramain', 'rasasi', 'armaf', 'orientica', 'lataffa']);

function isArabeBrand(perfumeName) {
  const lower = (perfumeName || '').toLowerCase();
  for (const b of ARABE_BRANDS_SET) {
    if (lower.includes(b)) return true;
  }
  return false;
}


// ─── Cerebro IA (Especialista Gemini) & Salud Web ───

async function measureWebsiteHealth() {
  const t0 = Date.now();
  try {
    const res = await fetch('https://dolce7aroma.com', { method: 'GET', headers: { 'User-Agent': 'DolceHealthBot/1.0' } });
    const latency = Date.now() - t0;
    const isOk = res.ok;
    return {
      status: res.status,
      latencyMs: latency,
      badge: isOk && latency < 1000 ? '🟢 <b>VERDE</b> (Óptimo)' : isOk ? '🟡 <b>ÁMBAR</b> (Lento)' : '🔴 <b>ROJO</b> (Caída)'
    };
  } catch (e) {
    return { status: 500, latencyMs: 0, badge: '🔴 <b>ROJO</b> (Sin conexión)' };
  }
}

async function askGeminiSpecialist(prompt, env) {
  const apiKey = env.GEMINI_API_KEY || '';
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    if (text) {
      // Limpiar asteriscos de markdown para evitar errores con parse_mode HTML
      text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');
    }
    return text;
  } catch (e) {
    return null;
  }
}

async function generateWeeklyReport(chatId, env, customHeader = null) {
  if (!env.ORDERS) {
    await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) no está enlazado.', env);
    return;
  }

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
    wowBadge = pct >= 0 ? `📈 +${pct.toFixed(1)}%` : `📉 ${pct.toFixed(1)}%`;
  } else if (thisWeekTotal > 0) {
    wowBadge = '📈 +100%';
  }

  const ticketProm = thisWeekOrders.length > 0 ? (thisWeekTotal / thisWeekOrders.length).toFixed(2) : '0.00';
  const topSorted = Object.entries(perfumeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  let topText = '• Sin ventas aún esta semana';
  if (topSorted.length > 0) {
    topText = topSorted.map(([name, qty], idx) => {
      const m = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
      return `${m} <b>${name}</b>: ${qty} uds`;
    }).join('\n');
  }

  // 1. Salud Web en vivo
  const health = await measureWebsiteHealth();

  // 2. Gráfico QuickChart
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

  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=650&h=380&bkg=white`;
  const header = customHeader || '⚡ <b>[REPORTE SEMANAL · DOLCE 7 AROMA]</b> 🌸';

  // Mensaje 1: Gráfico y Resumen Numérico
  const caption = `${header}
🗓 <i>Lunes a Domingo (Hora Perú)</i>

🩺 <b>Salud Web:</b> ${health.badge} (Latencia: ${health.latencyMs}ms)
💰 <b>Facturación:</b> S/ ${thisWeekTotal.toFixed(2)} (${wowBadge} WoW)
📦 <b>Pedidos:</b> ${thisWeekOrders.length} (Ticket prom: S/ ${ticketProm})

🏆 <b>Top Perfumes de la Semana:</b>
${topText}`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  // Mensaje 2: Análisis del Especialista IA (Gemini) con Diagnóstico y Paquetes de Acción
  const topDistricts = Object.entries(districtCounts).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([d, q]) => `${d} (${q})`).join(', ') || 'Lima Centro / Norte';
  const topPerfumeList = topSorted.map(([n, q]) => `${n} (${q} uds)`).join(', ') || 'Sin ventas registradas aún';

  const aiPrompt = `Actúa como el Especialista IA de E-commerce, CRO y SEO de Dolce 7 Aroma (perfumería en Lima, Perú).
Datos de la semana:
- Facturación: S/ ${thisWeekTotal.toFixed(2)} (${wowBadge} WoW)
- Pedidos: ${thisWeekOrders.length} (Ticket promedio: S/ ${ticketProm})
- Top perfumes vendidos: ${topPerfumeList}
- Distritos con pedidos: ${topDistricts}
- Salud Web: Estado HTTP ${health.status}, Latencia ${health.latencyMs}ms

Redacta un análisis profesional directo y accionable para Telegram en formato HTML usando <b> y <i> (NO uses markdown ni asteriscos).
Estructura obligatoria:

🔍 <b>CONTROL DE SEO Y TENDENCIAS:</b>
• 2 o 3 palabras clave específicas que los clientes buscan en Lima (ej. perfumes árabes, equivalencias Grasse, etc.) y cómo aprovecharlas en la web.

🧠 <b>DIAGNÓSTICO DEL ESPECIALISTA IA:</b>
• Análisis crítico de los números: qué funcionó, riesgos detectados y qué ajustar con urgencia para llegar a una web estable de alto rendimiento.

📦 <b>PAQUETES DE ACCIÓN LISTOS (Copia y Pega):</b>
• 🎨 <b>Para Canva/Diseño:</b> Prompt exacto para crear el banner visual de la semana.
• ✍️ <b>Para TikTok/WhatsApp:</b> Guion o copy corto para historias/estados.
• 🛠️ <b>Para Antigravity (Web):</b> Instrucción técnica o de catálogo para aplicar en la web.

Máximo 280 palabras.`;

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
  const pendingOrdersCount = orders.filter(o => o.estado === 'nuevo').length;
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
    distText = topDistricts.map(([dist, qty], i) => ` ${i + 1}. <b>${dist}</b>: ${qty} entregas`).join('\n');
  }

  const totalGiftsCount = gifts.length;
  const claimedGiftsCount = gifts.filter(g => g.orderId || g.estado === 'reclamado').length;
  const giftSuccessRate = totalGiftsCount > 0 ? Math.round((claimedGiftsCount / totalGiftsCount) * 100) : 0;

  const checkoutSuccessRate = totalOrdersCount > 0 ? Math.round((paidOrdersCount / totalOrdersCount) * 100) : 0;
  const trioRate = totalOrdersCount > 0 ? Math.round((trioOrdersCount / totalOrdersCount) * 100) : 0;

  const croChartConfig = {
    type: 'horizontalBar',
    data: {
      labels: [
        'Pedidos Totales',
        'Pagados / Enviados',
        'Esperando WhatsApp',
        'Cancelados',
        'Regalos Canjeados'
      ],
      datasets: [{
        label: 'Cantidad',
        data: [totalOrdersCount, paidOrdersCount, pendingOrdersCount, cancelledOrdersCount, claimedGiftsCount],
        backgroundColor: [
          '#6366F1',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#EC4899'
        ],
        borderRadius: 5
      }]
    },
    options: {
      title: { display: true, text: 'Embudo CRO & Comportamiento de Checkout' },
      legend: { display: false },
      scales: {
        xAxes: [{ ticks: { beginAtZero: true } }]
      }
    }
  };

  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(croChartConfig))}&w=650&h=380&bkg=white`;
  const header = customHeader || '🎯 <b>[EMBUDO DE CONVERSIÓN & CRO]</b> 🌸';

  const caption = `${header}
<i>Radiografía de Comportamiento y Checkout</i>

📈 <b>Efectividad de Checkout:</b> ${checkoutSuccessRate}%
• Pagados / Completados: ${paidOrdersCount} 🟢
• Pendientes de WhatsApp: ${pendingOrdersCount} 🟡
• Cancelados / Abandonos: ${cancelledOrdersCount} 🔴

🎁 <b>Módulo Regalos:</b> ${claimedGiftsCount}/${totalGiftsCount} canjeados (${giftSuccessRate}%)
🛍️ <b>Tasa de Tríos (Upsell):</b> ${trioRate}% de pedidos

📍 <b>Top Distritos:</b>
${distText}`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);

  // Análisis Especialista CRO Gemini
  const croPrompt = `Actúa como Especialista en CRO (Optimización de Conversión) y UX para Dolce 7 Aroma (tienda de perfumería en Lima, Perú).
Datos del embudo:
- Total pedidos iniciados: ${totalOrdersCount}
- Pedidos completados y pagados: ${paidOrdersCount} (${checkoutSuccessRate}%)
- Pendientes esperando comprobante WhatsApp: ${pendingOrdersCount}
- Cancelados / fuga: ${cancelledOrdersCount}
- Regalos canjeados: ${claimedGiftsCount} de ${totalGiftsCount} (${giftSuccessRate}%)
- Pedidos que compraron combo Trío: ${trioRate}%

Redacta un análisis CRO táctico para Telegram en formato HTML usando <b> y <i> (NO uses markdown ni asteriscos):
1. 🚨 <b>DETECCIÓN DE FRICCIÓN (¿Dónde se fuga el cliente?):</b> Señala el cuello de botella exacto (ej. salto de Yape a WhatsApp o selección de distrito).
2. 💡 <b>RECOMENDACIÓN DE MEJORA CONTINUA (Para los siguientes 15 días):</b> Táctica para elevar el ticket promedio y la tasa de cierre.
3. 📦 <b>PAQUETE CRO LISTO:</b>
   • ✍️ <b>Mensaje de Recuperación para WhatsApp:</b> Texto persuasivo para contactar a los que dejaron el pedido en estado 'nuevo'.
   • 🛠️ <b>Instrucción para Antigravity:</b> Qué cambio hacer en la bolsa de compras o checkout.
Máximo 260 palabras.`;

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

  const listed = await env.ORDERS.list({ prefix: 'order:', limit: 500 });
  const orders = (await Promise.all(
    listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
  )).filter(Boolean);

  const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
  const curYear = peruNow.getUTCFullYear();
  const curMonth = peruNow.getUTCMonth(); // 0-11

  let evalStart, evalEnd, prevStart, prevEnd, monthLabel;

  if (isClosedMonth) {
    // Mes anterior cerrado (1ro al último día del mes previo)
    evalStart = new Date(Date.UTC(curYear, curMonth - 1, 1, 5, 0, 0));
    evalEnd = new Date(Date.UTC(curYear, curMonth, 1, 5, 0, 0));
    prevStart = new Date(Date.UTC(curYear, curMonth - 2, 1, 5, 0, 0));
    prevEnd = evalStart;
    monthLabel = evalStart.toLocaleString('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' });
  } else {
    // Mes en curso acumulado
    evalStart = new Date(Date.UTC(curYear, curMonth, 1, 5, 0, 0));
    evalEnd = new Date(Date.UTC(curYear, curMonth + 1, 1, 5, 0, 0));
    prevStart = new Date(Date.UTC(curYear, curMonth - 1, 1, 5, 0, 0));
    prevEnd = evalStart;
    monthLabel = peruNow.toLocaleString('es-PE', { month: 'long', year: 'numeric', timeZone: 'America/Lima' }) + ' (Acumulado)';
  }

  const monthOrders = [];
  const prevMonthOrders = [];
  let arabeSales = 0;
  let disenadorSales = 0;
  const perfumeCounts = {};

  for (const o of orders) {
    if (!o.creadoEn || o.estado === 'cancelado') continue;
    const t = new Date(o.creadoEn).getTime();
    const total = Number(o.total || 0);

    if (t >= evalStart.getTime() && t < evalEnd.getTime()) {
      monthOrders.push(o);
      for (const it of (o.items || [])) {
        const name = it.name || it.titulo || 'Perfume';
        const sub = Number(it.subtotal || 0) || (Number(it.price || 0) * (Number(it.qty) || 1));
        if (isArabeBrand(name)) {
          arabeSales += sub;
        } else {
          disenadorSales += sub;
        }
        perfumeCounts[name] = (perfumeCounts[name] || 0) + (Number(it.qty) || 1);
      }
    } else if (t >= prevStart.getTime() && t < prevEnd.getTime()) {
      prevMonthOrders.push(o);
    }
  }

  const monthSales = monthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const prevMonthSales = prevMonthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  let momBadge = '➖ Sin datos previos';
  if (prevMonthSales > 0) {
    const pct = ((monthSales - prevMonthSales) / prevMonthSales) * 100;
    momBadge = pct >= 0 ? `📈 +${pct.toFixed(1)}%` : `📉 ${pct.toFixed(1)}%`;
  } else if (monthSales > 0) {
    momBadge = '📈 +100%';
  }

  const ticketProm = monthOrders.length > 0 ? (monthSales / monthOrders.length).toFixed(2) : '0.00';
  const totalCatSales = arabeSales + disenadorSales || 1;
  const arabePct = Math.round((arabeSales / totalCatSales) * 100);
  const disenadorPct = 100 - arabePct;

  const topSorted = Object.entries(perfumeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let topMonthText = '• Sin ventas aún';
  if (topSorted.length > 0) {
    topMonthText = topSorted.map(([name, qty], idx) => ` ${idx + 1}. <b>${name}</b>: ${qty} uds`).join('\n');
  }

  // Gráfico de Dona: Ventas por Estilo
  const monthChartConfig = {
    type: 'doughnut',
    data: {
      labels: [`Árabes (${arabePct}%)`, `Diseñador (${disenadorPct}%)`],
      datasets: [{
        data: [Number(arabeSales.toFixed(2)), Number(disenadorSales.toFixed(2))],
        backgroundColor: ['#D4AF37', '#1E293B'],
        borderWidth: 2
      }]
    },
    options: {
      title: { display: true, text: `Distribución de Ventas por Estilo — ${monthLabel}` },
      legend: { position: 'bottom' }
    }
  };

  const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(monthChartConfig))}&w=650&h=380&bkg=white`;
  const header = customHeader || '🗓️ <b>[REPORTE MENSUAL ESTRATÉGICO]</b> 🌸';

  const caption = `${header}
📅 <i>Período: ${monthLabel}</i>

💰 <b>Facturación Total:</b> S/ ${monthSales.toFixed(2)} (${momBadge} MoM)
📦 <b>Pedidos Totales:</b> ${monthOrders.length} (Ticket prom: S/ ${ticketProm})

📊 <b>Mix de Ventas por Estilo:</b>
• <b>Árabes:</b> S/ ${arabeSales.toFixed(2)} (${arabePct}%)
• <b>Diseñador:</b> S/ ${disenadorSales.toFixed(2)} (${disenadorPct}%)

🏆 <b>Top Perfumes del Mes:</b>
${topMonthText}

🔮 <b>Preguntas Estratégicas para el Negocio:</b>
1. ¿Los perfumes top tienen stock asegurado para las próximas semanas?
2. ¿Qué perfumes de diseñador tuvieron 0 ventas para reemplazarlos en vitrina?`;

  await sendTelegramPhoto(chatId, chartUrl, caption, env);
}

async function handleScheduledReports(event, env) {
  const cron = event?.cron || '';
  const chatId = (env.TELEGRAM_CHAT_ID || '8616800327').split(',')[0].trim();

  // Alerta de campaña si faltan <= 30 días
  const nextCamp = getNextCampaign();
  let campAlert = '';
  if (nextCamp && nextCamp.daysLeft <= 30) {
    campAlert = `\n\n🎯 <b>RECORDATORIO DE CAMPAÑA:</b> Faltan ${nextCamp.daysLeft} días para <b>${nextCamp.name}</b>. Enfoque: ${nextCamp.focus}`;
  }

  // 1) Lunes 8:00 AM Perú (cron: 0 13 * * 1) -> Reporte Semanal
  if (cron === '0 13 * * 1' || cron.includes('* * 1')) {
    await generateWeeklyReport(chatId, env, `⚡ <b>[REPORTE SEMANAL AUTOMÁTICO · LUNES]</b> 🌸${campAlert}`);
    return;
  }

  // 2) Día 16 6:00 AM Perú (cron: 0 11 16 * *) -> Reporte Quincenal CRO
  if (cron === '0 11 16 * *' || cron.includes('16 * *')) {
    await generateCroReport(chatId, env, `🌓 <b>[REPORTE QUINCENAL AUTOMÁTICO · CRO]</b> 🌸${campAlert}`);
    return;
  }

  // 3) Día 1 6:00 AM Perú (cron: 0 11 1 * *) -> Reporte Mensual Estratégico
  if (cron === '0 11 1 * *' || cron.includes('1 * *')) {
    await generateMonthlyReport(chatId, env, `🗓️ <b>[REPORTE MENSUAL AUTOMÁTICO · CIERRE DE MES]</b> 🌸${campAlert}`, true);
    return;
  }

  // Fallback
  await generateWeeklyReport(chatId, env, `⚡ <b>[DISPARADOR AUTOMÁTICO · TEST]</b> 🌸${campAlert}`);
}

async function handleTelegramWebhook(request, env) {
  try {
  const update = await request.json().catch(() => null);
  if (!update) return json({ ok: true });

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return json({ ok: true });

  const chatId = String(msg.chat?.id || '');
  const rawAuthIds = String(env.TELEGRAM_CHAT_ID || '8616800327');
  const authorizedChatIds = rawAuthIds.split(',').map(s => s.trim()).filter(Boolean);
  if (!authorizedChatIds.includes('8616800327')) authorizedChatIds.push('8616800327');

  // Validación estricta de seguridad: solo responde al administrador
  if (!authorizedChatIds.includes(chatId)) {
    await sendTelegramMessage(chatId, `⛔ <b>Acceso Restringido</b>\nEste bot es privado para la administración de Dolce 7 Aroma.\n\n🆔 <b>Tu Chat ID es:</b> <code>${chatId}</code>`, env);
    return json({ ok: true });
  }

  const rawText = (msg.text || '').trim();
  const parts = rawText.split(/\s+/);
  const command = parts[0].toLowerCase().split('@')[0];
  const args = parts.slice(1).map(s => s.toLowerCase());

  // 1. Comando /help o /start
  if (command === '/help' || command === '/ayuda' || command === '/start') {
    const helpMsg = `🌸 <b>DOLCE 7 AROMA — ASISTENTE INTELIGENTE</b> 🌸
<i>Sistema de Control & Reportería Comercial</i>

¡Hola! Aquí tienes los mandos disponibles para gestionar tu negocio:

⚡ <b>COMANDOS OPERATIVOS:</b>
• <b>/resumen</b> — Ventas de hoy, pedidos pendientes y balance general.
• <b>/top</b> — Ranking de los 5 perfumes más vendidos en el sitio.
• <b>/campana</b> — Reloj de campañas comerciales (Usa <code>/campana plan</code> para diseñar la estrategia con IA).

📊 <b>REPORTES & ANÁLISIS:</b>
• <b>/semana</b> — Reporte semanal con gráfico comparativo de barras.
• <b>/cro</b> — Embudo de conversión y checkout.
• <b>/mes</b> — Reporte mensual estratégico con gráfico de categorías.
• <b>/probar_cron</b> — Simula los 3 reportes automáticos programados.
• <b>/seo</b> — Palabras clave y clics orgánicos en Google <i>(Hito 6)</i>.

ℹ️ <b>AYUDA:</b>
• <b>/help</b> — Ver este menú de comandos.

<i>🔒 Modo Seguro: Respuestas exclusivas para tu cuenta administradora.</i>`;
    await sendTelegramMessage(chatId, helpMsg, env);
    return json({ ok: true });
  }

  // 2. Comando /resumen o /hoy
  if (command === '/resumen' || command === '/hoy') {
    if (!env.ORDERS) {
      await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) aún no está enlazado en este Worker.', env);
      return json({ ok: true });
    }

    try {
      const listed = await env.ORDERS.list({ prefix: 'order:', limit: 200 });
      const orders = (await Promise.all(
        listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
      )).filter(Boolean);

      // Calcular fecha de hoy en hora Perú (UTC-5)
      const now = new Date();
      const peruDateStr = new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);

      const ordersToday = orders.filter(o => {
        if (!o.creadoEn) return false;
        const d = new Date(new Date(o.creadoEn).getTime() - 5 * 3600 * 1000);
        return d.toISOString().slice(0, 10) === peruDateStr;
      });

      const salesToday = ordersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const pendingOrders = orders.filter(o => o.estado === 'nuevo');

      const sevenDaysAgo = now.getTime() - 7 * 24 * 3600 * 1000;
      const ordersWeek = orders.filter(o => new Date(o.creadoEn).getTime() >= sevenDaysAgo);
      const salesWeek = ordersWeek.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // Últimos 3 pedidos para visualización rápida
      orders.sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''));
      const recent = orders.slice(0, 3);
      let recentText = '';
      if (recent.length > 0) {
        recentText = '\n\n📋 <b>ÚLTIMOS PEDIDOS REGISTRADOS:</b>\n' + recent.map(o => {
          const stBadge = o.estado === 'nuevo' ? '🟡 Nuevo' : o.estado === 'pagado' ? '🟢 Pagado' : `⚪ ${o.estado}`;
          return `• <b>#${o.id}</b> — ${o.nombre} (S/ ${Number(o.total || 0).toFixed(2)}) · ${stBadge}`;
        }).join('\n');
      }

      const summaryMsg = `⚡ <b>[RESUMEN OPERATIVO · DOLCE 7 AROMA]</b> 🌸
📅 <i>Fecha: ${peruDateStr}</i>

💰 <b>Ventas de Hoy:</b> S/ ${salesToday.toFixed(2)} (${ordersToday.length} pedido${ordersToday.length === 1 ? '' : 's'})
🔔 <b>Pedidos Pendientes:</b> ${pendingOrders.length} por atender
📈 <b>Últimos 7 días:</b> S/ ${salesWeek.toFixed(2)} (${ordersWeek.length} pedidos)${recentText}

<i>💡 Tip: Usa /top para ver qué perfumes están saliendo más.</i>`;

      await sendTelegramMessage(chatId, summaryMsg, env);
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ Error consultando pedidos: ${e.message}`, env);
    }
    return json({ ok: true });
  }

  // 3. Comando /top
  if (command === '/top') {
    if (!env.ORDERS) {
      await sendTelegramMessage(chatId, '⚠️ <b>Alerta:</b> El almacenamiento KV (<code>ORDERS</code>) aún no está enlazado.', env);
      return json({ ok: true });
    }

    try {
      const listed = await env.ORDERS.list({ prefix: 'order:', limit: 200 });
      const orders = (await Promise.all(
        listed.keys.map(k => env.ORDERS.get(k.name).then(v => v ? JSON.parse(v) : null))
      )).filter(Boolean);

      const counts = {};
      for (const o of orders) {
        if (o.estado === 'cancelado') continue;
        for (const it of (o.items || [])) {
          const name = it.name || it.titulo || 'Perfume';
          const size = it.ml ? ` (${it.ml}ml)` : '';
          const key = `${name}${size}`;
          counts[key] = (counts[key] || 0) + (Number(it.qty) || 1);
        }
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      if (sorted.length === 0) {
        await sendTelegramMessage(chatId, '🏆 <b>[TOP PERFUMES]</b>\nAún no hay suficientes ventas registradas para armar el ranking.', env);
        return json({ ok: true });
      }

      let topList = sorted.map(([name, qty], idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
        return `${medal} <b>${name}</b>: ${qty} unidad${qty === 1 ? '' : 'es'}`;
      }).join('\n');

      const topMsg = `🏆 <b>[TOP 5 PERFUMES MÁS VENDIDOS]</b> 🌸
<i>Basado en el historial de pedidos completados en la web:</i>

${topList}

<i>💡 Usa estos perfumes para el carrusel de inicio y ofertas destacadas.</i>`;

      await sendTelegramMessage(chatId, topMsg, env);
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ Error consultando el top: ${e.message}`, env);
    }
    return json({ ok: true });
  }

  // 4. Comando /campana (Director de Campañas de Alta Demanda con IA)
  if (command === '/campana') {
    const next = getNextCampaign();
    if (!next) {
      await sendTelegramMessage(chatId, '🎯 <b>[CAMPAÑAS COMERCIALES]</b>\nNo hay campañas programadas próximamente.', env);
      return json({ ok: true });
    }

    const forcePlan = args.includes('plan') || args.includes('ia') || args.includes('ahora');
    const isAlertActive = next.daysLeft <= 30;

    const alertStatus = isAlertActive
      ? '🚨 <b>¡ALERTA DE CAMPAÑA ACTIVADA!</b> Quedan 30 días o menos para la fecha clave. El plan comercial debe ejecutarse ahora.'
      : '⏳ <b>Estado:</b> En espera de la ventana de 30 días. <i>(Tip: Escribe <code>/campana plan</code> si quieres que la IA diseñe la estrategia anticipada hoy mismo).</i>';

    const campMsg = `🎯 <b>[RELOJ DE CAMPAÑAS COMERCIALES]</b> 🌸

📅 <b>Próxima Fecha Clave:</b> ${next.name}
🗓️ <b>Día Central:</b> ${next.targetDate}
⏱️ <b>Faltan:</b> ${next.daysLeft} días

🎯 <b>Enfoque Comercial Sugerido:</b>
${next.focus}

${alertStatus}`;

    await sendTelegramMessage(chatId, campMsg, env);

    // Si faltan <= 30 días O si el usuario pide ver el plan anticipado con '/campana plan'
    if (isAlertActive || forcePlan) {
      await sendTelegramMessage(chatId, `🧠 <i>El Director Especialista IA está elaborando el Plan Comercial para ${next.name}...</i>`, env);

      const campPrompt = `Actúa como el Director Especialista en Campañas Comerciales de Dolce 7 Aroma (tienda de perfumería árabe y equivalente en Lima, Perú).
Estamos preparando la campaña para: ${next.name} (Día central: ${next.targetDate}, faltan ${next.daysLeft} días).
Enfoque principal: ${next.focus}.

Diseña el Plan Estratégico de Campaña en formato HTML para Telegram usando <b> y <i> (NO uses markdown ni asteriscos):

1. 🎯 <b>OBJETIVO & PROMOCIÓN ESTRELLA:</b> Propón una oferta atractiva y rentable (ej. Trío/Dúo festivo, caja de regalo prémium o decant 10ml de cortesía).
2. 🏆 <b>TOP 3 PERFUMES A IMPULSAR:</b> Fragancias ideales para esta temporada (marcas como Lattafa, Afnan o diseñador) y por qué son el regalo perfecto.
3. 📅 <b>CRONOGRAMA DE EJECUCIÓN (3 Hitos Clave):</b>
   • Hito 1 (Día 1-10): Qué preparar en diseño, fotos y vitrina.
   • Hito 2 (Día 11-20): Activación de preventa por redes y WhatsApp.
   • Hito 3 (Día 21-30): Estrategia de entrega rápida express de última hora en Lima.
4. 📦 <b>PAQUETES LISTOS PARA ACCIÓN:</b>
   • 🎨 <b>Para Canva/Diseño:</b> Prompt exacto para crear el banner del carrusel web y post de Instagram.
   • ✍️ <b>Para WhatsApp / Redes:</b> Copy persuasivo de preventa para estados que genere urgencia.
   • 🛠️ <b>Para Antigravity (Web):</b> Instrucción técnica para la web (banners hero, modal de regalo o banners de oferta).

Máximo 320 palabras.`;

      const aiPlan = await askGeminiSpecialist(campPrompt, env);
      if (aiPlan) {
        await sendTelegramMessage(chatId, aiPlan, env);
      }
    }

    return json({ ok: true });
  }


  // 5. Comando /semana
  if (command === '/semana') {
    await generateWeeklyReport(chatId, env);
    return json({ ok: true });
  }

  // 6. Comando /cro
  if (command === '/cro') {
    await generateCroReport(chatId, env);
    return json({ ok: true });
  }

  // 7. Comando /mes
  if (command === '/mes') {
    await generateMonthlyReport(chatId, env);
    return json({ ok: true });
  }

  // 8. Comando /probar_cron (Simulación de envíos automáticos)
  if (command === '/probar_cron' || command === '/test_cron') {
    await sendTelegramMessage(chatId, '⏰ <b>Simulando los 3 envíos automáticos programados...</b>', env);
    await generateWeeklyReport(chatId, env, '⚡ <b>[CRON SIMULADO: Lunes 8:00 AM]</b> 🌸');
    await generateCroReport(chatId, env, '🌓 <b>[CRON SIMULADO: Día 16 6:00 AM]</b> 🌸');
    await generateMonthlyReport(chatId, env, '🗓️ <b>[CRON SIMULADO: Día 1 6:00 AM]</b> 🌸', false);
    return json({ ok: true });
  }

  // 9. Placeholder para SEO (Hito 6)
  if (command === '/seo') {
    await sendTelegramMessage(chatId, '📈 El comando <b>/seo</b> se conectará a Google Search Console en el Hito 6. ¡Muy pronto activo!', env);
    return json({ ok: true });
  }


  // 6. Mensaje desconocido
  await sendTelegramMessage(chatId, '❓ Comando no reconocido.\nEscribe <b>/help</b> para ver la lista de comandos disponibles.', env);
  return json({ ok: true });

  } catch (err) {
    console.error('Telegram webhook error:', err);
    try {
      const chatId = String(env.TELEGRAM_CHAT_ID || '8616800327');
      await sendTelegramMessage(chatId, `⚠️ <b>Error en procesamiento:</b> ${err.message}`, env);
    } catch (_) {}
    return json({ ok: true });
  }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      currentOrigin = origin;
    } else {
      currentOrigin = 'https://dolce7aroma.com';
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/upload-photo') {
      return handleUploadPhoto(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/upload-anuncio-photo') {
      return handleUploadAnuncioPhoto(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/delete-photo') {
      return handleDeletePhoto(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/save-catalog') {
      return handleSaveCatalog(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/save-config') {
      return handleSaveConfig(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/submit-order') {
      return handleSubmitOrder(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/list-orders') {
      return handleListOrders(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/update-order-status') {
      return handleUpdateOrderStatus(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/charge-culqi') {
      return handleChargeCulqi(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/create-gift') {
      return handleCreateGift(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/get-gift') {
      return handleGetGift(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/claim-gift') {
      return handleClaimGift(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/mark-gift-paid') {
      return handleMarkGiftPaid(request, env);
    }
    if (url.pathname === '/api/debug-telegram') {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado en secretos' });
      const [webhookRes, meRes] = await Promise.all([
        fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
        fetch(`https://api.telegram.org/bot${token}/getMe`)
      ]);
      const webhookInfo = await webhookRes.json().catch(() => null);
      const me = await meRes.json().catch(() => null);

      const testChatId = env.TELEGRAM_CHAT_ID || '8616800327';
      const pingRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: testChatId,
          text: '🩺 <b>Test de Conexión:</b> Bot reactivado y respondiendo exitosamente en Dolce 7 Aroma.',
          parse_mode: 'HTML'
        })
      });
      const ping = await pingRes.json().catch(() => null);

      return json({ ok: true, me, webhookInfo, ping });
    }
    if (url.pathname === '/api/setup-webhook') {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) return json({ ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado en secretos' });
      const webhookUrl = 'https://dolce7aroma-pedidos-bot.cesarfernandezh7.workers.dev/api/telegram-webhook';
      const setupRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`);
      const setupData = await setupRes.json().catch(() => null);
      return json({ ok: true, setup: setupData, webhookUrl });
    }
    if (url.pathname === '/api/telegram-webhook') {
      if (request.method === 'POST') {
        return handleTelegramWebhook(request, env);
      }
      if (request.method === 'GET') {
        return json({ ok: true, status: 'Telegram webhook listening' });
      }
    }
    return json({ ok: false, error: 'Ruta no encontrada' }, 404);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduledReports(event, env));
  },
};
