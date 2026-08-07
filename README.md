# 🌸 Dolce Aroma — Manual de uso

## ⚠️ MUY IMPORTANTE — No abras los HTML con doble clic

Si abres los archivos haciendo doble clic (URL empieza con `file://`), el navegador **bloquea la carga del catálogo** por seguridad y verás la página vacía o con la foto genérica. Tienes 2 opciones:

### A) Para probar local mientras editas

Abre una terminal en la carpeta del proyecto y ejecuta UNA de estas:

```bash
# Si tienes Python instalado:
python -m http.server 8000

# Si tienes Node.js:
npx serve .
```

Luego en el navegador entra a: **http://localhost:8000/**

### B) Para la web pública — GitHub Pages

Todo el repo se publica solo, con solo hacer `git push` a la rama `main` (o publicar desde el Admin, ver más abajo). La estructura se ve así:

```
dolce7aroma.github.io/  (tu repo)
├── index.html                          ← redirige a Inicio
├── catalogo.html                       ← alias corto (sin espacios) que redirige al Catálogo,
│                                          usado en los links que se comparten por WhatsApp
├── Dolce Aroma - Inicio.html
├── Dolce Aroma - Catalogo.html
├── perfumes-gestion-da7.html           ← ADMIN PRIVADO (solo por URL directa)
├── faq.html
├── robots.txt / sitemap.xml            ← SEO
├── wrangler.toml                       ← configuración del Worker (Cloudflare)
├── README.md
├── worker/
│   └── dolce-aroma-admin-worker.js     ← backend del Admin y del checkout (Cloudflare Worker)
├── assets/
│   ├── shop.js                         ← catálogo, carrito, ofertas, checkout completo
│   ├── site-modals.js                  ← modales Contacto/Envíos/Legales + botón flotante WhatsApp
│   ├── pago-yape.jpg                   ← QR de pago (Yape)
│   ├── logo-perfumes.png / logo-boutique.png / logo-white.png
│   ├── perfume-10ml.jpg / 50ml / 110ml.jpg   ← imágenes genéricas (fallback)
│   └── perfumes/                       ← TUS FOTOS de los perfumes (.jpg)
└── data/
    ├── productos.json                  ← INVENTARIO PÚBLICO (esto es lo que lee la web)
    ├── perfumes.json                   ← respaldo / fallback (mismo contenido)
    ├── plantilla-perfumes.csv          ← plantilla para carga masiva
    ├── zonas-envio.json                ← zonas con envío gratis (editable desde Admin → Envíos)
    └── pago.json                       ← nombre a mostrar en el pago por Yape (Admin → Pago)
```

## 🔐 Acceso al Admin

El botón Admin **ya no es visible** en los menús del sitio. Solo puedes acceder por URL directa:

```
https://dolce7aroma.github.io/perfumes-gestion-da7.html
```

Guárdalo en tus favoritos.

---

## ✅ Cómo publicar cambios (catálogo, envíos, pago)

Desde que se conectó el Worker de Cloudflare, el Admin **publica de verdad** — ya no hace falta exportar un JSON y subirlo a mano:

```
1. Editas en el Admin (foto, precio, stock, zonas de envío, nombre de Yape, etc.)
            ↓
2. Clic en el botón "Publicar cambios" (o "Publicar cambios de envío" / "de pago"
   según la pestaña)
            ↓
3. Te pide confirmar tu contraseña de Admin
            ↓
4. El Worker escribe el cambio directo en el repo de GitHub
            ↓
5. La web pública lo muestra casi al instante (sin caché de por medio)
```

- **Fotos**: al soltar una imagen en el formulario de un perfume, se publica recién al hacer clic en **Guardar** (así el nombre del archivo usa el nombre ya confirmado del perfume). Si la foto no se pudo publicar (sin conexión, sesión vencida, etc.), el perfume **no se guarda** — hay que reintentar. Esto evita que quede un perfume publicado con la foto genérica sin que te des cuenta.
- **Exportar productos.json** sigue existiendo como respaldo manual, por si alguna vez el Worker no está disponible.

> 💡 **Tip:** Mientras pruebas en local, los cambios se ven al instante porque el navegador lee tu localStorage. La web pública en cambio siempre lee lo que esté publicado en el repo — necesitas el botón "Publicar cambios" (o el reemplazo manual de `data/productos.json`) para que se refleje ahí.

---

## 🛒 Cómo funciona el checkout (pedido del cliente)

El botón "Hacer pedido por WhatsApp" del carrito fue reemplazado por un flujo completo:

```
1. Cliente arma su bolsa y hace clic en "Continuar con el pedido"
            ↓
2. Formulario: Nombre, Teléfono (9 dígitos), Distrito (con autocompletado),
   Dirección, Referencia — y debajo, si el distrito tiene envío gratis, se lo
   muestra automáticamente
            ↓
3. Al confirmar, el pedido se guarda en el Worker (recibe un número de
   referencia tipo #DA-XXXXX) y te llega un aviso por correo (Resend) y/o
   Telegram, si los configuraste (ver abajo)
            ↓
4. El cliente ve una pantalla de confirmación con el QR de Yape y un botón
   "Ya pagué, avisar por WhatsApp" — al tocarlo se abre WhatsApp con un
   mensaje que ya incluye su nombre y el número de pedido, para que sepas
   a cuál corresponde la captura de pago que te manden
```

**No hay ninguna base de datos externa (Excel, Google Sheets, etc.)** — los pedidos se guardan en un almacenamiento de Cloudflare (KV) y se administran desde la pestaña **"🧾 Pedidos"** del Admin, donde puedes ver cada pedido y cambiarle el estado (Nuevo / Pagado / En camino / Entregado / Cancelado).

### Activar el guardado de pedidos y las alertas (opcional, pero recomendado)

Sin esto el sitio funciona igual, pero el pedido solo viaja por correo/Telegram del momento — si no configuras nada, no queda registro. En Cloudflare → tu Worker → **Settings → Variables and Secrets**, agrega los que quieras usar:

| Secreto | Para qué |
|---|---|
| `RESEND_API_KEY` + `ORDER_EMAIL_TO` | Alerta por correo de cada pedido nuevo (cuenta gratis en resend.com) |
| `ORDER_EMAIL_FROM` | (opcional) remitente verificado en Resend |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Alerta por Telegram (bot creado con @BotFather) |

Y en **Workers & Pages → Storage & Databases → KV**, crea un namespace (ej. `dolce-aroma-pedidos`) y pide que se enlace como binding `ORDERS` en `wrangler.toml` — con eso, los pedidos quedan guardados y aparecen en la pestaña "Pedidos".

---

## 🔐 Contraseña del Admin

Para cambiarla hay que actualizarla en **dos lugares**:

**1. El candado del panel** (`perfumes-gestion-da7.html`): en la consola del navegador (F12), ejecuta:

```js
await crypto.subtle.digest('SHA-256', new TextEncoder().encode('MI_NUEVA_CLAVE'))
  .then(b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))
```

Copia el hash resultante y pégalo en `perfumes-gestion-da7.html`, en la constante `ADMIN_PASSWORD_HASH`.

**2. El Worker**: en Cloudflare → tu Worker → Configuración → Variables y secretos → editá `ADMIN_KEY` y poné la contraseña **en texto plano** (no el hash del paso 1). Estos dos valores son intencionalmente distintos: el hash es público (cualquiera puede verlo con "ver código fuente" de la página), mientras que `ADMIN_KEY` en Cloudflare es privado y es lo único que realmente protege que alguien pueda escribir en tu repo o ver tus pedidos.

Si cambiás uno sin el otro, el candado de la página y la publicación real quedan con contraseñas distintas — asegurate de actualizar ambos con la misma clave.

> ⚠️ El candado de la página (paso 1) es solo del lado del cliente: oculta el panel a visitantes casuales, pero cualquiera que sepa mirar el código fuente puede verlo. La protección real es el secreto `ADMIN_KEY` del Worker (paso 2), que nunca se expone en el HTML — por eso, cuando publicás algo, el Admin te vuelve a pedir la contraseña si la sesión se restauró solo por el "recordarme" (que es cosmético).

---

## 📸 Cómo cambiar la foto del Hero (la grande arriba)

La foto grande del Hero usa automáticamente **la foto del primer perfume destacado** (`featured: true`) en tu catálogo. Para cambiarla:

1. Ve al Admin
2. Encuentra el perfume cuya foto quieres en el Hero
3. Asegúrate de que esté marcado como **★ Destacado**
4. Ese perfume debe ser el primero en tu lista de destacados (puedes reordenar dejando solo ese marcado, agregando los demás después)
5. Publica los cambios

---

## 📁 Cómo organizar las fotos de los perfumes

Pon todas las imágenes en `assets/perfumes/` (o súbelas directo desde el formulario del Admin, que las publica solas). El nombre del archivo debe coincidir **exactamente** (con mayúsculas, espacios, tildes) con lo que aparece en la columna `photo` del CSV o en el campo "Foto" del Admin.

Ejemplos:
- Si en el JSON dice `"photo": "assets/perfumes/Sauvage.jpg"` → debe existir `assets/perfumes/Sauvage.jpg`
- GitHub Pages es **case-sensitive** (distingue entre Sauvage.jpg y sauvage.jpg)

**Recomendaciones:**
- Mínimo 800×800 px, idealmente 1200×1200 px
- Formato JPG (más liviano) o PNG (si necesitas transparencia)
- Peso < 300 KB por foto

---

## 🛠️ Pestañas del Admin — qué hace cada una

| Pestaña | Qué hace |
|---|---|
| **📊 Dashboard** | Resumen de inventario, alertas de stock, KPIs |
| **📚 Catálogo** | Alta/edición de perfumes, carga masiva CSV, "Publicar cambios" |
| **⭐ Reseñas** | Administra las reseñas del carrusel de Inicio |
| **🚚 Envíos** | Monto mínimo para envío gratis, zonas gratis por distrito (formato `Distrito \| Detalle`), mensaje estándar para zonas sin detalle propio, mensaje para el resto de zonas |
| **🧾 Pedidos** | Lista los pedidos hechos por clientes, con su estado editable (requiere el KV de Cloudflare enlazado — ver arriba) |
| **💳 Pago** | Nombre que se muestra en la pantalla de pago por Yape |

**Botones de Catálogo:**

| Botón | Qué hace |
|---|---|
| **Plantilla CSV** | Descarga un Excel/CSV vacío con las columnas correctas |
| **Carga masiva** | Sube un CSV lleno para agregar/reemplazar muchos perfumes a la vez |
| **Importar JSON** | Restaura el catálogo desde un archivo `.json` que exportaste antes (útil como respaldo) |
| **Exportar productos.json** | Descarga el inventario actual como `productos.json` — respaldo manual, ya no es el paso normal para publicar |
| **Publicar cambios** | Publica el catálogo actual directo al repo, vía el Worker |
| **Nuevo perfume** | Crea un perfume nuevo desde cero |

---

## ✅ Checklist rápida antes de publicar

- [ ] La contraseña del Admin ya NO es `1234`
- [ ] Todas las fotos de los perfumes están en `assets/perfumes/` (ninguna quedó con foto genérica — revisa que no haya `photo: "idb:..."` en el catálogo)
- [ ] `data/productos.json` tiene tu catálogo completo y actualizado
- [ ] Probaste localmente con `python -m http.server 8000`
- [ ] La página se ve correctamente en móvil
- [ ] El botón de WhatsApp (flotante y del carrito) lleva a tu número correcto (`+51 930 122 014`)
- [ ] Los perfumes destacados son los que quieres mostrar en el Inicio
- [ ] Las zonas de envío gratis en Admin → Envíos están al día
- [ ] El nombre de Admin → Pago coincide con el que aparece en tu Yape

---

## 🐛 Solución de problemas

| Problema | Solución |
|---|---|
| Las fotos no cargan | Verifica que el nombre del archivo en `productos.json` coincida EXACTAMENTE con el archivo en `assets/perfumes/` (incluyendo mayúsculas y tildes). Si el perfume tiene `photo: "idb:..."`, la foto solo existía en el navegador donde se subió — hay que volver a subirla |
| Solo veo pocos perfumes en la web | Tu `data/productos.json` en el repo está desactualizado. Publica de nuevo desde el Admin |
| El catálogo no carga, página vacía | Estás abriendo el HTML con doble clic. Usa `python -m http.server 8000` |
| Admin no pide contraseña | Limpia el caché o usa modo incógnito |
| "No se pudo publicar la foto" | Reintenta — el perfume no se guarda hasta que la foto se publique bien, así nunca queda con foto rota en la web pública |
| Un link compartido (bolsa/producto) llega cortado en WhatsApp | Ya corregido — los links usan `catalogo.html` (sin espacios) en vez del nombre real de la página, que sí los tiene |
| No me llegan alertas de pedidos nuevos | Revisa que `RESEND_API_KEY`/`TELEGRAM_BOT_TOKEN` estén configurados en el Worker, y que el KV `ORDERS` esté enlazado si querés verlos en la pestaña Pedidos |
| Cambié algo en Admin → Envíos o Pago y no se ve en la web | Espera unos minutos (propagación de GitHub Pages) o refresca forzado (Ctrl+F5) |
