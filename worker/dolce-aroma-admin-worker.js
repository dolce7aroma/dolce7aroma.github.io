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
const ALLOWED_ORIGIN = 'https://dolce7aroma.github.io';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
Distrito: ${record.distrito}
Dirección: ${record.direccion}
Referencia: ${record.referencia || '-'}
Método de pago: ${record.metodoPago || '-'}${regaladoPor}

Productos:
${itemsText}

Subtotal: S/ ${record.subtotal}
Total: S/ ${record.total}`;
}

// Pedido enviado por un CLIENTE (no requiere ADMIN_KEY — es público, pero no toca el repo,
// solo dispara avisos por correo/Telegram si esos secretos están configurados y lo guarda
// en KV si el binding ORDERS está enlazado).
async function handleSubmitOrder(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { nombre, telefono, distrito, direccion, referencia, items, subtotal, total, metodoPago, esRegalo } = body;
  if (!nombre || !telefono || !distrito || !direccion) {
    return json({ ok: false, error: 'Faltan datos del pedido' }, 400);
  }
  if (!Array.isArray(items) || !items.length) {
    return json({ ok: false, error: 'El pedido no tiene productos' }, 400);
  }

  const orderId = generateOrderId();
  const record = {
    id: orderId, nombre, telefono, distrito, direccion, referencia,
    items, subtotal, total, metodoPago: metodoPago || null, esRegalo: !!esRegalo,
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
  const { orderId, token, email, amount } = body;
  if (!env.CULQI_SECRET_KEY) return json({ ok: false, error: 'El cobro con tarjeta no está activado todavía.' }, 400);
  if (!token || !email || !amount) return json({ ok: false, error: 'Faltan datos del pago' }, 400);

  try {
    const res = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
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

export default {
  async fetch(request, env) {
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
    return json({ ok: false, error: 'Ruta no encontrada' }, 404);
  },
};
