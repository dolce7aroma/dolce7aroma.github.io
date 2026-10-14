# ⚙️ Arquitectura Técnica y Cálculos

Este documento está diseñado para auditores, ingenieros o agencias externas que necesiten entender o integrarse con el ecosistema de **Dolce 7 Aroma**.

## 1. Patrón Arquitectónico (Headless / API-First)
La tienda opera bajo una arquitectura descentralizada:
- **Frontend (Vista):** Archivos HTML estáticos alojados en GitHub Pages (`index.html`, `catalogo.html`).
- **Base de Datos (Lectura):** Archivos JSON estáticos en el repositorio (`data/productos.json`, `data/pago.json`). El frontend los consume vía `fetch` estándar.
- **Backend (Escritura y Lógica):** Un Cloudflare Worker (`worker/dolce-aroma-admin-worker.js`) que procesa los pedidos y guarda configuraciones interactuando con la API de GitHub.

## 2. API Endpoints (Cloudflare Worker)
Cualquier app externa puede integrarse con estos endpoints:
- `POST /api/save-config`: Actualiza los archivos JSON (requiere `ADMIN_KEY` en el payload).
- `POST /api/upload-photo`: Sube imágenes al directorio `assets/perfumes/`.
- `POST /api/create-gift` / `POST /api/claim-gift`: Flujo de regalos que interactúa con Cloudflare KV.

## 3. Lógica de Negocio y Cálculos (`shop.js`)

### 3.1. Filtro Automático: Árabe vs Diseñador
El sistema no guarda en la base de datos si un perfume es "Árabe" o "Diseñador". Lo calcula al vuelo en el cliente basándose en el campo `inspiration` (Marca).
- **Lista Árabe (`ARABE_BRANDS`):** `Afnan, Lattafa, Bharara, Kayali`.
- **Regla:** Si `inspiration` está en la lista, el estilo es `arabe`. De lo contrario, es `disenador`.

### 3.2. Cálculo del Carrito y Subtotales
- El precio base se extrae del array `sizes` de cada producto (`ml`, `price`).
- **Frasco Premium / Cajas:** Se almacenan como items independientes o modificadores. Su precio se suma en el momento del checkout.
- El costo total a pagar incluye los ítems del carrito + el costo de envío.

### 3.3. Lógica de Envíos (`data/zonas-envio.json`)
- El sistema evalúa el distrito introducido por el cliente contra el JSON de envíos.
- Si el distrito existe en la lista de zonas, el costo de envío es `0` (Envío Gratis).
- De lo contrario, se aplica la tarifa plana a coordinar y se muestra el mensaje configurado en el Administrador.

## 4. Inyección de Datos Dinámicos (`site-modals.js`)
El sitio utiliza etiquetas vacías (`<a href="#" data-contacto="facebook">`) en el HTML. Cuando la página carga, `site-modals.js` intercepta estos elementos y los "hidrata" usando los datos provenientes de `data/pago.json`. Si una red social no existe en el JSON, el botón se oculta automáticamente (`display: none`).
