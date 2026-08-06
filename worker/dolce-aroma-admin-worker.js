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
 *        ADMIN_KEY    → la misma contraseña que usas para entrar al Admin.
 *   6. Copia la URL pública del Worker (algo como
 *        https://dolce-aroma-admin.TU-SUBDOMINIO.workers.dev )
 *      y pégala en perfumes-gestion-da7.html en la constante API_BASE.
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
    return json({ ok: false, error: 'Ruta no encontrada' }, 404);
  },
};
