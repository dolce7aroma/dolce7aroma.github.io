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

Sube TODOS los archivos a tu repo de GitHub. La estructura debe verse así:

```
dolce7aroma.github.io/  (tu repo)
├── index.html
├── Dolce Aroma - Inicio.html
├── Dolce Aroma - Catalogo.html
├── perfumes-gestion-da7.html       ← ADMIN PRIVADO (solo por URL directa)
├── faq.html
├── README.md
├── assets/
│   ├── shop.js                       ← lógica del carrito y modal
│   ├── site-modals.js                ← modales Contacto/Envíos/Legales
│   ├── logo-perfumes.png
│   ├── logo-boutique.png
│   ├── logo-white.png
│   ├── perfume-10ml.jpg / 50ml / 110ml.jpg   ← imágenes genéricas (fallback)
│   └── perfumes/                     ← TUS FOTOS de los perfumes
│       ├── Sauvage.jpg
│       ├── Aventus.jpg
│       └── ... (una por perfume)
└── data/
    ├── productos.json                ← INVENTARIO PÚBLICO (esto es lo que lee la web)
    ├── perfumes.json                 ← respaldo / fallback (mismo contenido)
    └── plantilla-perfumes.csv        ← plantilla para carga masiva
```

## 🔐 Acceso al Admin

El botón Admin **ya no es visible** en los menús del sitio. Solo puedes acceder por URL directa:

```
https://dolce7aroma.github.io/perfumes-gestion-da7.html
```

Guárdalo en tus favoritos.

---

## 🔄 Flujo completo para actualizar tu catálogo

```
1. Editas en Admin (foto, precio, stock, destacado, etc.)
            ↓
2. Los cambios se guardan en localStorage del navegador
            ↓
3. Click en "Exportar productos.json" → descarga productos.json
            ↓
4. Reemplaza el archivo data/productos.json en tu repo GitHub
            ↓
5. La web pública muestra los cambios (puede tardar 1-2 min)
```

> 💡 **Tip:** Mientras pruebas en local, los cambios se ven al instante porque el navegador lee tu localStorage. Pero la web pública NO ve tu localStorage — necesita `data/productos.json` actualizado en el repo.

---

## 🔐 Contraseña del Admin

Para cambiarla hay que actualizarla en **dos lugares** (si tenés el Worker de publicación configurado — ver más abajo):

**1. El candado del panel** (`perfumes-gestion-da7.html`): en la consola del navegador (F12), ejecuta:

```js
await crypto.subtle.digest('SHA-256', new TextEncoder().encode('MI_NUEVA_CLAVE'))
  .then(b => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))
```

Copia el hash resultante y pégalo en `perfumes-gestion-da7.html`, en la constante `ADMIN_PASSWORD_HASH`.

**2. El Worker** (si publicás fotos/catálogo automáticamente): en Cloudflare → tu Worker → Configuración → Variables y secretos → editá `ADMIN_KEY` y poné la contraseña **en texto plano** (no el hash del paso 1). Estos dos valores son intencionalmente distintos: el hash es público (cualquiera puede verlo con "ver código fuente" de la página), mientras que `ADMIN_KEY` en Cloudflare es privado y es lo único que realmente protege que alguien pueda escribir en tu repo.

Si cambiás uno sin el otro, el candado de la página y la publicación real quedan con contraseñas distintas — asegurate de actualizar ambos con la misma clave.

> ⚠️ El candado de la página (paso 1) es solo del lado del cliente: oculta el panel a visitantes casuales, pero cualquiera que sepa mirar el código fuente puede verlo. La protección real contra escrituras no autorizadas al repo es el secreto `ADMIN_KEY` del Worker (paso 2), que nunca se expone en el HTML.

---

## 📸 Cómo cambiar la foto del Hero (la grande arriba)

La foto grande del Hero usa automáticamente **la foto del primer perfume destacado** (`featured: true`) en tu catálogo. Para cambiarla:

1. Ve al Admin
2. Encuentra el perfume cuya foto quieres en el Hero
3. Asegúrate de que esté marcado como **★ Destacado**
4. Ese perfume debe ser el primero en tu lista de destacados (puedes reordenar dejando solo ese marcado, agregando los demás después)
5. Exporta `productos.json` y súbelo

---

## 📁 Cómo organizar las fotos de los perfumes

Pon todas las imágenes en `assets/perfumes/`. El nombre del archivo debe coincidir **exactamente** (con mayúsculas, espacios, tildes) con lo que aparece en la columna `photo` del CSV o en el campo "Foto" del Admin.

Ejemplos:
- Si en el JSON dice `"photo": "assets/perfumes/Sauvage.jpg"` → debe existir `assets/perfumes/Sauvage.jpg`
- GitHub Pages es **case-sensitive** (distingue entre Sauvage.jpg y sauvage.jpg)

**Recomendaciones:**
- Mínimo 800×800 px, idealmente 1200×1200 px
- Formato JPG (más liviano) o PNG (si necesitas transparencia)
- Peso < 300 KB por foto

---

## 🛠️ Botones del Admin — qué hace cada uno

| Botón | Qué hace |
|---|---|
| **Plantilla CSV** | Descarga un Excel/CSV vacío con las columnas correctas |
| **Carga masiva** | Sube un CSV lleno para agregar/reemplazar muchos perfumes a la vez |
| **Importar JSON** | Restaura el catálogo desde un archivo `.json` que exportaste antes (útil como respaldo) |
| **Exportar productos.json** | Descarga el inventario actual como `productos.json` — este es el archivo que va al repo |
| **Nuevo perfume** | Crea un perfume nuevo desde cero |

> 📌 **El archivo `productos.json` no se "abre"** como un Word o Excel. Es un archivo de datos que el sitio lee automáticamente. Solo lo necesitas para reemplazar el que está en `data/productos.json` de tu repo GitHub.

---

## ✅ Checklist rápida antes de publicar

- [ ] La contraseña del Admin ya NO es `1234`
- [ ] Todas las fotos de los perfumes están en `assets/perfumes/`
- [ ] `data/productos.json` tiene tu catálogo completo y actualizado
- [ ] Probaste localmente con `python -m http.server 8000`
- [ ] La página se ve correctamente en móvil
- [ ] El botón de WhatsApp lleva a tu número correcto (`+51 930 122 014`)
- [ ] Los perfumes destacados son los que quieres mostrar en el Inicio

---

## 🐛 Solución de problemas

| Problema | Solución |
|---|---|
| Las fotos no cargan | Verifica que el nombre del archivo en `productos.json` coincida EXACTAMENTE con el archivo en `assets/perfumes/` (incluyendo mayúsculas y tildes) |
| Solo veo 8 perfumes en la web | Tu `data/productos.json` en el repo está desactualizado. Re-expórtalo desde Admin y súbelo |
| El catálogo no carga, página vacía | Estás abriendo el HTML con doble clic. Usa `python -m http.server 8000` |
| El modal "Ver detalle" no se cierra bien | Recarga la página (Ctrl+F5). Si persiste, limpia el caché del navegador |
| Admin no pide contraseña | Limpia el caché o usa modo incógnito |
| No puedo deslizar los botones del modal en móvil | Ya corregido en la última versión — actualiza tus archivos |
