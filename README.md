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

> ✅ **Estado: activo y probado.** Las alertas por correo y Telegram, y el guardado en KV, ya están configurados y confirmados con pedidos de prueba reales — correo llega a `dolce7aroma@gmail.com` y Telegram al chat personal con el bot "Dolce Aroma Pedidos".

Sin esto el sitio funciona igual, pero el pedido solo viaja por correo/Telegram del momento — si no configuras nada, no queda registro. En Cloudflare → tu Worker → **Settings → Variables and Secrets**, agrega los que quieras usar:

| Secreto | Para qué |
|---|---|
| `RESEND_API_KEY` + `ORDER_EMAIL_TO` | Alerta por correo de cada pedido nuevo (cuenta gratis en resend.com) |
| `ORDER_EMAIL_FROM` | (opcional) remitente verificado en Resend |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Alerta por Telegram (bot creado con @BotFather) |

Y en **Workers & Pages → Storage & Databases → KV**, crea un namespace (ej. `dolce-aroma-pedidos`) y pide que se enlace como binding `ORDERS` en `wrangler.toml` — con eso, los pedidos quedan guardados y aparecen en la pestaña "Pedidos".

> 📧 **Resend — primer correo cae en spam.** Es normal: `onboarding@resend.dev` es un remitente compartido por miles de cuentas, sin reputación previa con tu Gmail. Abre el primer correo y marca **"No es spam"** — los siguientes ya llegan directo a la bandeja de entrada. Solución permanente (opcional, a futuro): verificar un dominio propio en Resend y usar `ORDER_EMAIL_FROM` con ese dominio.
>
> 📲 **Telegram — el bot no necesita el número de Dolce Aroma.** El bot de Telegram no está atado a ningún número de teléfono del negocio; se crea con @BotFather desde cualquier cuenta de Telegram y manda las alertas a quien sea el `TELEGRAM_CHAT_ID`. Lo más simple es usar tu Telegram personal (el que ya tienes instalado) como receptor de las alertas — no hace falta instalar Telegram en el chip 2 ni verificarlo con el número del negocio.
>
> ⚠️ **Las variables de texto (no secretas) se borran solas si solo las agregas desde el dashboard.** `ORDER_EMAIL_TO` y `TELEGRAM_CHAT_ID` viven en `wrangler.toml` (sección `[vars]`), no solo en Cloudflare — cada vez que se publica un cambio al sitio, Cloudflare redespliega el Worker y usa `wrangler.toml` como la lista completa de variables; cualquiera que solo esté en el dashboard y no en ese archivo se borra en ese momento. Si en algún momento necesitas otra variable de texto (no secreta), pídeme agregarla ahí para que no desaparezca. Los secretos reales (`ADMIN_KEY`, `GITHUB_TOKEN`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CULQI_SECRET_KEY`) sí quedan solo en el dashboard de Cloudflare — nunca deben ir en `wrangler.toml`, que es público en el repo.

---

## 🎁 Regalar un perfume (Fase 1)

Botón flotante **"🎁 Regalar"** encima del de WhatsApp, en todas las páginas. Flujo:

1. **Comprador**: elige uno o varios perfumes (y tamaños — cada tamaño de un mismo perfume aparece como una opción separada) de una lista curada, con buscador (busca por nombre o marca, en cualquier orden de palabras) y filtros por género y por marca/diseñador. Si un perfume tiene "Frasco premium" activado en el Admin, puede sumarlo a un precio extra por cada tamaño elegido.
2. Elige si el regalo **se le entrega a él mismo** (llena su dirección ahí mismo y listo, va directo por el checkout normal) o **a otra persona** (deja su nombre y WhatsApp para que le avisen, y elige con dos botones si paga de inmediato o cuando la otra persona elija — el total no cambia en ningún caso, porque el catálogo tiene precios uniformes).
3. Si es para otra persona, se genera un link (`catalogo.html?regalo=<id>`) con un mensaje ya armado y personalizado (usa el nombre del comprador si lo dejó) para compartir por WhatsApp o copiar. El link es válido por **7 días** (`GIFT_EXPIRY_DAYS`, definido tanto en `assets/shop.js` como en el Worker — hay que mantenerlos iguales si se cambia).
4. La persona regalada abre el link, ve solo esa lista curada, elige uno, llena su propia dirección de entrega y confirma.
5. El pedido **solo llega a la pestaña Pedidos una vez que está pagado** — sin excepción, sea que el comprador pagó antes o después de que la otra persona eligiera.
6. Si nadie completa el regalo (falta el pago o la elección) dentro de los 7 días, el link queda **expirado**: la próxima vez que alguien lo abre, el Worker lo detecta y le cambia el estado a `expirado` en KV (no hay Cron Trigger — es una revisión "perezosa" al momento de acceder, no un job en segundo plano). Un regalo ya convertido en pedido nunca expira.

### Frasco premium (Admin → Catálogo → editar perfume)

Nuevo campo "Regalo": casilla "Frasco premium disponible" + precio editable, **por perfume** — no todos lo tienen, y cada uno puede tener un precio distinto. Sin fotos ni variantes múltiples todavía (fase futura).

> 🐛 **Bug corregido (jul/ago 2026):** "Ya pagué, avisar por WhatsApp" era un link `<a target="_blank">` que disparaba el registro del pago (`fetch`) al mismo tiempo que el navegador saltaba a WhatsApp — en celulares, ese cambio de app podía abortar el `fetch` antes de llegar al servidor, y el pago quedaba sin registrar (ni pedido ni alertas). Ahora el clic espera (con un tope de 2.5s) a que el registro del pago termine antes de abrir WhatsApp.

### Limitación real: no hay aviso automático push al comprador

No existe (todavía) una forma de enviarle un WhatsApp a un número arbitrario sin que esa persona lo inicie desde su propio teléfono — ni Resend (sin dominio propio verificado) ni Telegram (necesitaría que el comprador ya tenga chat con nuestro bot) lo permiten para un contacto cualquiera. Por eso, cuando la persona regalada confirma su elección, se le muestra a **ella** un botón de WhatsApp pre-armado para avisarle al comprador — reutiliza el mismo patrón de "click para abrir WhatsApp" que ya usa todo el sitio, solo que en sentido inverso (la persona regalada le escribe al comprador, no al revés).

### Seguimiento automático — pendiente (fast-follow)

Cada regalo se guarda en KV (`gift:<id>`) con su estado y fecha de creación — la data ya está lista para soportarlo. Falta la pieza que "se despierta sola" con el tiempo (un Cloudflare Cron Trigger que revise diario qué regalos llevan mucho sin completarse y le avise al comprador) — no está construida todavía, queda como la primera mejora a sumar después de este lanzamiento.

### Endpoints nuevos del Worker

| Endpoint | Qué hace |
|---|---|
| `POST /api/create-gift` | El comprador guarda su lista curada. Pública. |
| `POST /api/get-gift` | Carga un regalo por su ID (para la persona regalada o para el comprador que vuelve a pagar). Pública. |
| `POST /api/claim-gift` | La persona regalada guarda su elección + dirección. Pública. |
| `POST /api/mark-gift-paid` | El comprador confirma que pagó (mismo nivel de confianza que un pedido normal — sin verificación automática). Pública. |

---

## 💳 Pago con tarjeta (Culqi)

Se activa solo cuando cargas una llave pública de Culqi — sin ella, la tarjeta de pago del checkout muestra "Próximamente" (comportamiento actual, sin riesgo de romper nada).

1. Crea tu cuenta en **[culqi.com](https://culqi.com)** — con DNI alcanza para modo prueba. Para cobrar de verdad (modo producción) necesitas **RUC** (puede ser Persona Natural con Negocio, régimen Nuevo RUS — el más simple, se saca gratis en SUNAT en minutos).
2. En Culqi → Desarrollo → Llaves API, copia:
   - **Llave pública** (`pk_test_...` para pruebas, `pk_live_...` para cobros reales) → pégala en Admin → pestaña **"💳 Pago"** → campo "Llave pública de Culqi" → Publicar. Esta llave no es secreta, está pensada para ir en el código del sitio.
   - **Llave secreta** (`sk_test_...` / `sk_live_...`) → pégala en Cloudflare → tu Worker → Settings → Variables and Secrets → `CULQI_SECRET_KEY` (tipo "Secreto"). Esta NUNCA va en el Admin ni en ningún archivo del repo.
3. Con la llave pública cargada, el checkout muestra un botón real "Pagar con tarjeta" que abre el checkout propio de Culqi (los datos de tarjeta nunca tocan nuestro sitio). Al confirmar el pago, el pedido pasa automáticamente a estado "Pagado" en la pestaña Pedidos.
4. Prueba primero con las llaves `*_test_*` y las [tarjetas de prueba de Culqi](https://culqi.com) antes de pasar a `*_live_*`.

> ⚠️ **Riesgo de contracargos.** A diferencia de Yape (instantáneo e irreversible), un pago con tarjeta puede ser disputado por el banco del cliente días o semanas después (uso no autorizado, fraude, etc.) — si ya entregaste el producto, pierdes ambos. El checkout de Culqi trae verificación 3D Secure por defecto, que traslada gran parte de esa responsabilidad al banco del cliente. Para pedidos grandes, conserva evidencia de entrega (foto, firma, tracking del courier) por si necesitas disputar un contracargo.

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
| **💳 Pago** | Nombre que se muestra en la pantalla de pago por Yape, y la llave pública de Culqi para activar el pago con tarjeta |

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
- [x] Alertas de pedidos (correo + Telegram) y guardado en KV — configurados y probados

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
