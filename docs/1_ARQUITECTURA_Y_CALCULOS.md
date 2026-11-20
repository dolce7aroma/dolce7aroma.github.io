# ⚙️ Arquitectura Técnica, Base de Datos y Cálculos

Este documento está diseñado para auditores, desarrolladores e integradores que necesiten comprender la arquitectura, el modelo de datos y las reglas de negocio del ecosistema **Dolce 7 Aroma**.

---

## 1. Patrón Arquitectónico (Headless Edge / Cloudflare Sovereign)

La plataforma opera bajo una arquitectura descentralizada de **máximo rendimiento y soberanía operativa**:

```mermaid
flowchart TD
    subgraph ClientLayer["Capa Cliente (Navegador)"]
        Store["Tienda Web (GitHub Pages / CDN)"]
        TrackModal["Modal de Seguimiento (/api/track-order)"]
        AdminWeb["Panel Admin (perfumes-gestion-da7.html)"]
    end

    subgraph EdgeLayer["Capa Serverless (Cloudflare)"]
        Worker["Cloudflare Worker (dolce-aroma-admin-worker.js)"]
        KV_Orders["Cloudflare KV: ORDERS (order:ORD-XXXX)"]
        KV_Gifts["Cloudflare KV: GIFTS (gift:D7A-XXXX)"]
        KV_Reviews["Cloudflare KV: REVIEWS (config:reviews)"]
    end

    subgraph ExternalLayer["Capa de Persistencia & Servicios"]
        GH_API["GitHub API (data/productos.json, data/pago.json)"]
        Resend["Resend API (Email Confirmación Pago)"]
        TG["Telegram Bot API (Alertas Push)"]
        Sheets["Google Sheets / KeysControl PRO (Webhook Asíncrono)"]
    end

    Store -->|Checkout POST /api/submit-order| Worker
    TrackModal -->|POST /api/track-order (Auth: ID + Tlf)| Worker
    AdminWeb -->|GET/POST /api/reviews, /api/update-order-status| Worker
    Worker --> KV_Orders
    Worker --> KV_Gifts
    Worker --> KV_Reviews
    Worker -->|Descuento de stock en estado 'pagado'| GH_API
    Worker -->|Recibo electrónico al cliente| Resend
    Worker -->|Notificación instantánea admin| TG
    Worker -.->|Respaldo asíncrono no bloqueante| Sheets
```

### 1.1. Principio de Autonomía de Datos (Soberanía Web)
- **Base de Datos Nativa Primaria:** Cloudflare KV (`ORDERS`, `GIFTS`, `config:reviews`).
- **Independencia Total:** La tienda y el panel de administración operan al 100% sin depender de Google Workspace, Google Drive o Google Apps Script.
- **Redundancia Cruzada (Zero Data Loss):** Cada pedido se envía en paralelo como respaldo asíncrono a Google Sheets. Si Google experimenta caídas o saturación de cuotas, el Cloudflare Worker registra el pedido localmente en KV y la tienda nunca interrumpe sus ventas.

---

## 2. API Endpoints Oficiales (Cloudflare Worker)

### 2.1. Endpoints Públicos de Tienda
- `POST /api/submit-order`: Registra un nuevo pedido en Cloudflare KV (`order:ORD-XXXX`), captura datos del cliente (nombre, teléfono, email, distrito, dirección, referencia, notas, método de pago, ítems y totales). Dispara alerta por Telegram y respaldo a Google Sheets.
- `POST /api/track-order`: Consulta en vivo del estado de un pedido para el cliente.
  - **Autenticación sin contraseña:** Requiere `orderId` + los últimos 9 dígitos de `telefono`.
  - **Respuesta:** Sanitizada (sin exponer datos sensibles): `estado`, `guia_courier`, `creadoEn`, `actualizadoEn`, `items_resumen`, `total`, `distrito`, `direccion`.
- `GET /api/reviews`: Retorna el listado público de testimonios y valoraciones almacenadas en KV (`config:reviews`).
- `POST /api/create-gift` / `POST /api/claim-gift`: Flujo de tarjetas y perfumes de regalo temporales (15 días de vigencia).

### 2.2. Endpoints Administrativos y de Integración (Protegidos)
- `POST /api/update-order-status`: Modifica el estado logístico de un pedido en KV (`nuevo`, `pagado`, `en_camino`, `entregado`, `cancelado`) y asigna `guia_courier`.
  - **Trigger en `pagado`:** Ejecuta descuento atómico de stock en `data/productos.json` mediante GitHub API y envía recibo por correo electrónico al cliente vía Resend.
  - **Seguridad:** Requiere encabezado `Authorization: Bearer <ADMIN_KEY>`.
- `POST /api/save-reviews`: Actualiza la lista completa de reseñas en KV sin necesidad de hacer commit a Git. Requiere `ADMIN_KEY`.
- `POST /api/save-config`: Actualiza archivos JSON de configuración en el repositorio GitHub (`productos.json`, `pago.json`, `zonas-envio.json`). Requiere `ADMIN_KEY`.
- `POST /api/upload-photo`: Sube imágenes de perfumes a `assets/perfumes/`. Requiere `ADMIN_KEY`.
- `POST /api/external/update-status`: Endpoint puente para ERPs externos (como **KeysControl PRO**).
  - **Seguridad:** Acepta `KEYSCONTROL_API_KEY` o `ADMIN_KEY`.
  - **Campos aceptados:** `{ order_id, nuevo_estado, guia_courier, notas }`.

---

## 3. Lógica de Negocio y Reglas de Inventario

### 3.1. Deducción de Stock Atómica
1. **Creación del Pedido (`nuevo`):** El inventario **NO** se descuenta al momento del checkout. Esto evita bloqueos de stock por carritos abandonados o pagos no completados.
2. **Confirmación de Pago (`pagado`):** Cuando el administrador o el ERP marca el pedido como `pagado`, el Worker:
   - Descarga el archivo actual `data/productos.json` mediante la API de GitHub con su respectivo SHA.
   - Itera sobre los ítems del pedido (desglosando presentaciones `10ml`, `50ml`, `110ml`).
   - Resta las unidades vendidas asegurando que el stock no sea negativo (`Math.max(0, stock - qty)`).
   - Realiza un `PUT` atómico a GitHub con commit automatizado.
   - Si el stock de una presentación llega a 0, la tienda inhabilita esa opción automáticamente.

### 3.2. Filtro Automático: Diseñador vs Árabe (`shop.js`)
El frontend no requiere flags manuales en base de datos. Evalúa dinámicamente la marca en tiempo de ejecución:
- **Lista Árabe (`ARABE_BRANDS`):** `Afnan`, `Lattafa`, `Bharara`, `Kayali`.
- **Regla:** Si `inspiration` coincide con la lista, se clasifica como `arabe`; de lo contrario, como `disenador`.

### 3.3. Tarifario de Envíos y Validación Geográfica
- El cliente selecciona su distrito en el checkout.
- El script contrasta el distrito contra `data/zonas-envio.json`:
  - Si el distrito está listado dentro de la zona de cobertura gratuita, el costo de envío es `S/ 0.00`.
  - Si no está listado, se aplica la tarifa plana a coordinar y se muestra la advertencia logística correspondiente.

---

## 4. Estructura de Datos Homologada (19 Columnas)

Tanto Cloudflare KV como el puente hacia Google Sheets y KeysControl PRO utilizan la siguiente especificación de datos estandarizada:

| # | Campo | Tipo | Descripción |
|---|---|---|---|
| 1 | `order_id` | String | Identificador único (`ORD-17311...`) |
| 2 | `empresa_origen` | String | Identificador de sucursal/empresa (`DOLCE7AROMA`) |
| 3 | `fecha_hora` | ISO String | Timestamp de creación |
| 4 | `cliente_nombre` | String | Nombre y apellido del comprador |
| 5 | `cliente_telefono` | String | Teléfono / WhatsApp de contacto |
| 6 | `cliente_email` | String | Correo electrónico para recibo digital |
| 7 | `distrito` | String | Distrito de entrega (Lima Metropolitana o Provincia) |
| 8 | `direccion` | String | Dirección exacta de entrega |
| 9 | `referencia` | String | Referencia de ubicación |
| 10 | `subtotal` | Float | Subtotal de productos en Soles (S/) |
| 11 | `envio` | Float | Costo de flete aplicado (S/ 0 o tarifa plana) |
| 12 | `total` | Float | Importe total del pedido |
| 13 | `metodo_pago` | String | `yape`, `plin`, `tarjeta`, `efectivo` |
| 14 | `estado` | String | `nuevo`, `pagado`, `en_camino`, `entregado`, `cancelado` |
| 15 | `guia_courier` | String | Código de seguimiento de Olva Courier, Shalom o motorizado |
| 16 | `items_resumen` | String | Resumen legible (ej. "2x Sauvage 50ml, 1x Club de Nuit 10ml") |
| 17 | `items_detalle` | JSON String | Array completo de objetos con ID, nombre, ml, precio unitario y cantidad |
| 18 | `notas` | String | Indicaciones especiales del cliente |
| 19 | `actualizado_en` | ISO String | Timestamp del último cambio de estado logístico |
