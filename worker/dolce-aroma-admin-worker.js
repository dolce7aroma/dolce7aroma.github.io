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
const ALLOWED_CONFIG_FILES = ['data/zonas-envio.json', 'data/pago.json'];

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

// Pedido enviado por un CLIENTE (no requiere ADMIN_KEY — es público, pero no toca el repo,
// solo dispara avisos por correo/Telegram si esos secretos están configurados y lo guarda
// en KV si el binding ORDERS está enlazado).
async function handleSubmitOrder(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: 'JSON inválido' }, 400);

  const { nombre, telefono, distrito, direccion, referencia, items, subtotal, total, metodoPago } = body;
  if (!nombre || !telefono || !distrito || !direccion) {
    return json({ ok: false, error: 'Faltan datos del pedido' }, 400);
  }
  if (!Array.isArray(items) || !items.length) {
    return json({ ok: false, error: 'El pedido no tiene productos' }, 400);
  }

  const orderId = generateOrderId();
  const itemsText = items.map(it => `- ${it.name} (${it.ml} ml) x${it.qty} — S/ ${it.subtotal}`).join('\n');
  const summary = `🌸 Nuevo pedido — Dolce Aroma

Pedido: #${orderId}
Cliente: ${nombre}
Teléfono: ${telefono}
Distrito: ${distrito}
Dirección: ${direccion}
Referencia: ${referencia || '-'}
Método de pago: ${metodoPago || '-'}

Productos:
${itemsText}

Subtotal: S/ ${subtotal}
Total: S/ ${total}`;

  if (env.ORDERS) {
    try {
      const record = {
        id: orderId, nombre, telefono, distrito, direccion, referencia,
        items, subtotal, total, metodoPago: metodoPago || null,
        estado: 'nuevo', creadoEn: new Date().toISOString(),
      };
      await env.ORDERS.put(`order:${orderId}`, JSON.stringify(record));
    } catch (e) { /* si falla el guardado, igual seguimos con los avisos */ }
  }

  const notified = { email: false, telegram: false };

  if (env.RESEND_API_KEY && env.ORDER_EMAIL_TO) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.ORDER_EMAIL_FROM || 'Dolce Aroma <onboarding@resend.dev>',
          to: [env.ORDER_EMAIL_TO],
          subject: `Nuevo pedido de ${nombre}`,
          text: summary,
        }),
      });
      notified.email = res.ok;
    } catch (e) { /* el correo es best-effort, no bloquea la respuesta */ }
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: summary }),
      });
      notified.telegram = res.ok;
    } catch (e) { /* Telegram también es best-effort */ }
  }

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/upload-photo') {
      return handleUploadPhoto(request, env);
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
    return json({ ok: false, error: 'Ruta no encontrada' }, 404);
  },
};
