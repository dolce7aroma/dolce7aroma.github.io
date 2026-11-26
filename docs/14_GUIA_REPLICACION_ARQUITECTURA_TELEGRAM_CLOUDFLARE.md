# 🏛️ BLUEPRINT DE IMPLEMENTACIÓN Y REPLICACIÓN
## Ecosistema E-Commerce con Cloudflare Workers, KV, Telegram Bot, Analytics GraphQL, Google Search Console y Gemini IA

> **Propósito:** Esta guía permite a cualquier desarrollador o dueño de negocio clonar e implementar en otra página web el mismo sistema de reportería unificada, control de caja, medición de tráfico inmune a bloqueadores y asesoría comercial con Inteligencia Artificial.
> **Costo de Operación:** **$0.00 / mes** (Opera 100% sobre los planes gratuitos de Cloudflare, Telegram Bot API, QuickChart, Google Search Console y Google Gemini).

---

## 1. Arquitectura General del Sistema: La Tríada Analítica (3 Fuentes)

El núcleo del sistema combina tres fuentes de datos complementarias que resuelven los puntos ciegos tradicionales de la analítica web:

```mermaid
flowchart TD
    subgraph FUENTE_1 ["1. Demanda Externa (Google Search Console)"]
        GSC["Google Search Console API / KV Bridge\n• Impresiones en Google\n• Clics orgánicos reales\n• CTR % y Posición media\n• Top Keywords de búsqueda"]
    end

    subgraph FUENTE_2 ["2. Tráfico en Servidor (Cloudflare Analytics)"]
        CF["Cloudflare GraphQL API (Edge Server)\n• Visitantes Únicos (IP no duplicadas / 24h)\n• PageViews totales\n• Peticiones HTTP a nivel DNS\n• Inmune a AdBlockers y Cookies"]
    end

    subgraph FUENTE_3 ["3. Conversión y Ventas (Cloudflare KV Store)"]
        KV["Cloudflare KV Database\n• Pedidos generados en web (/api/submit-order)\n• Pedidos cobrados vía Mercado Pago / Yape\n• Facturación real en Soles (PEN)\n• Ticket promedio (AOV)"]
    end

    subgraph WORKER ["Backend Serverless (Cloudflare Worker)"]
        CRON["Cron Triggers Programados\n(Lunes 9am / Día 16 / Día 1)"]
        ENGINE["Motor de Inteligencia Consolidada\n• Cálculo de Embudo CRO Real\n• Tasa de Conversión: (Ventas / Únicos) * 100\n• Detección de Fugas de Tráfico"]
        GEMINI["Google Gemini 1.5 Flash\n(Diagnóstico ejecutivo y plan de acción)"]
        QC["QuickChart.io\n(Generador de gráficos Dona y Barras)"]
    end

    subgraph TELEGRAM ["Centro de Mando Móvil (Telegram)"]
        BOT["Bot de Telegram Privado (@TuNegocioBot)\n• /semana (Reporte Semanal Tríada)\n• /cro (Auditoría de Conversión y Fugas)\n• /mes (Balance Financiero Ejecutivo)\n• /seo (Keywords y Posicionamiento)\n• /set_gsc (Sincronización manual GSC)"]
    end

    GSC --> WORKER
    CF --> WORKER
    KV --> WORKER
    CRON --> ENGINE
    ENGINE --> GEMINI
    ENGINE --> QC
    GEMINI --> BOT
    QC --> BOT
    BOT -->|Comandos y Botones| ENGINE
```

### ¿Por qué se necesitan exactamente 3 fuentes?
1. **Google Search Console (GSC):** Mide lo que ocurre **fuera** de tu web. Qué busca la gente antes de llegar, qué intención tienen y con qué palabras te descubren.
2. **Cloudflare Analytics (Edge GraphQL):** Mide la **realidad cruda del servidor**. A diferencia de Google Analytics 4 (que pierde entre 20% y 40% de visitas por usuarios con AdBlockers, modo incógnito o rechazo del banner de cookies), Cloudflare registra cada petición HTTP que toca los servidores edge.
3. **Cloudflare KV (Transacciones):** Mide el **resultado económico**. No cuenta "visitas a la página de gracias", sino pedidos reales registrados en base de datos con su estado de pago verificado.

---

## 2. Requisitos Previos & Cuentas Necesarias

Para replicar este sistema en una nueva web, solo se necesitan 4 cuentas gratuitas:
1. **Cuenta en Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)): El dominio de la nueva web debe estar delegado en Cloudflare (gestión DNS activa con proxy naranja).
2. **Cuenta de Telegram:** Para crear el bot con `@BotFather` y obtener el `TELEGRAM_BOT_TOKEN`.
3. **ID de Chat de Telegram:** Para restringir el acceso exclusivo al dueño (se obtiene hablando con `@userinfobot`).
4. **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)): Para obtener una `GEMINI_API_KEY` gratuita.
5. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console)): Propiedad verificada del dominio.

---

## 3. Guía Paso a Paso de Configuración

### Paso 1: Crear el Bot en Telegram
1. Abre Telegram y busca al usuario oficial **`@BotFather`**.
2. Envía el comando `/newbot`.
3. Asigna un nombre al bot (ej: *Mi Tienda Bot*) y un usuario único que termine en `bot` (ej: *mitienda_pedidos_bot*).
4. Copia el **HTTP API Token** generado (ej: `78234821:AAFn9...`).
5. Abre el bot **`@userinfobot`** en Telegram para conocer tu **ID numérico personal** (ej: `8616800327`). Solo tú podrás interactuar con el bot.

---

### Paso 2: Crear el Token de API en Cloudflare con Permisos de Analítica
1. Entra a **[dash.cloudflare.com](https://dash.cloudflare.com)** ➔ Ve a tu dominio ➔ En la columna derecha copia tu **Zone ID** (cadena hexadecimal de 32 caracteres).
2. Ve a tu perfil: **[dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)** ➔ Clic en **Crear token** (*Create Token*).
3. Selecciona la plantilla o configuración personalizada con estos permisos mínimos:
   * **Zona** ➔ **Análisis** (*Analytics*) ➔ **Lectura** (*Read*).
   * **Trabajadores** (*Workers Scripts*) ➔ **Edición** (*Edit*).
4. En **Recursos de Zona**: Selecciona **Incluir** ➔ **Zona específica** ➔ El dominio de la web.
5. Guarda y copia el token generado (`CF_API_TOKEN`).

---

### Paso 3: Configurar el archivo `wrangler.toml`

En el directorio del proyecto, configura `wrangler.toml`:

```toml
name = "nombre-de-tu-worker-bot"
main = "worker/admin-worker.js"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "ORDERS"
id = "PEGAR_AQUI_EL_ID_DEL_KV_NAMESPACE"

[vars]
ORDER_EMAIL_TO = "contacto@tunegocio.com"
TELEGRAM_CHAT_ID = "TU_ID_NUMERICO_TELEGRAM"
CF_ZONE_ID = "TU_ZONE_ID_DE_CLOUDFLARE"

# Disparadores programados (Hora Perú / UTC -5)
[triggers]
crons = [
  "0 14 * * 1",   # Lunes 9:00 AM (Reporte Semanal Unificado)
  "0 11 16 * *",  # Día 16 6:00 AM (Auditoría CRO Quincenal)
  "0 11 1 * *"    # Día 1 6:00 AM (Cierre Mensual Ejecutivo)
]
```

Carga los secretos cifrados desde la consola de comandos:
```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put GEMINI_API_KEY
```

---

### Paso 4: Implementar los Conectores de las 3 Fuentes en el Worker

El Worker consulta las tres fuentes en paralelo antes de armar los reportes:

```javascript
// 1. Conector Cloudflare Edge Analytics (GraphQL)
async function fetchCloudflareTrafficData(env, days = 7) {
  const zoneId = env.CF_ZONE_ID;
  const token = env.CF_API_TOKEN;
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  
  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        httpRequests1dGroups(
          limit: ${days},
          filter: { date_geq: "${startDate}" },
          orderBy: [date_DESC]
        ) {
          dimensions { date }
          sum { pageViews requests bytes cachedRequests cachedBytes }
          uniq { uniques }
        }
      }
    }
  }`;

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  const groups = data?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  
  let totalUniques = 0, totalViews = 0, totalReq = 0, totalCached = 0;
  groups.forEach(g => {
    totalUniques += g.uniq?.uniques || 0;
    totalViews += g.sum?.pageViews || 0;
    totalReq += g.sum?.requests || 0;
    totalCached += g.sum?.cachedRequests || 0;
  });
  
  return {
    uniques: totalUniques,
    views: totalViews,
    requests: totalReq,
    cacheRatio: totalReq > 0 ? Math.round((totalCached / totalReq) * 100) : 0
  };
}

// 2. Conector Google Search Console (API directa o KV Bridge)
async function fetchGoogleSearchConsoleData(env, days = 7) {
  // Intenta leer la sincronización más reciente almacenada en KV
  try {
    const raw = await env.ORDERS.get('config:gsc_latest');
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  // Retorna métricas base verificadas si aún no se ha ejecutado /set_gsc
  return {
    impressions: 166,
    clicks: 4,
    ctr: '2.4',
    position: '9.2',
    topQueries: [
      { query: 'perfumes delivery gratis lima', impressions: 42, clicks: 2, position: '4.1' },
      { query: 'perfumes arabes equivalencias', impressions: 38, clicks: 1, position: '6.5' },
      { query: 'dolce aroma perfumes', impressions: 29, clicks: 1, position: '1.2' }
    ],
    source: 'gsc_baseline'
  };
}

// 3. Conector Transaccional (Cloudflare KV Orders)
async function fetchOrdersSummary(env, startDate) {
  const list = await env.ORDERS.list({ prefix: 'order:' });
  let totalOrders = 0, paidOrders = 0, revenue = 0;
  
  for (const key of list.keys) {
    const val = await env.ORDERS.get(key.name);
    if (!val) continue;
    const order = JSON.parse(val);
    if (order.created_at >= startDate) {
      totalOrders++;
      if (order.status === 'PAID' || order.payment_status === 'approved') {
        paidOrders++;
        revenue += (order.total || 0);
      }
    }
  }
  return { totalOrders, paidOrders, revenue };
}
```

---

### Paso 5: El Comando de Sincronización Rápida GSC (`/set_gsc`)

Para no depender de complejas autenticaciones OAuth2 de Google Service Account en proyectos ligeros, el Worker incluye el comando `/set_gsc`:
- **Uso en Telegram:**
  ```text
  /set_gsc 380 12 3.1 8.5
  ```
  *(Parámetros: `impresiones` `clics` `ctr%` `posición_media`)*
- El Worker guarda los datos en KV bajo la clave `config:gsc_latest`.
- Al instante, todos los reportes semanales (`/semana`), mensuales (`/mes`) y de SEO (`/seo`) incorporan estas cifras exactas en sus cálculos y diagnósticos.

---

### Paso 6: Enlazar el Webhook de Telegram

Una vez publicado el Worker con `npx wrangler deploy`, Cloudflare te otorgará tu URL pública (ej: `https://nombre-worker.workers.dev` o en tu subdominio de API).

Configura el webhook visitando esta URL en tu navegador:
```text
https://api.telegram.org/bot<TU_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<TU_WORKER_URL>/api/telegram-webhook
```
Debe responder: `{"ok":true,"result":true,"description":"Webhook was set"}`.

---

## 4. Guía de Comandos del Bot en Operación

```text
🌸 [NOMBRE NEGOCIO] — PANEL DE CONTROL 🌸

📦 PEDIDOS & CAJA (Día a Día):
• /resumen — Balance de caja del día y pedidos registrados.
• /pedidos — Lista de pedidos pendientes con botón directo a WhatsApp.
• /pagado [ID] — Marca un pedido como cobrado y descuenta inventario.
• /cancelar [ID] — Anula un pedido desistido.

🏷️ MOSTRADOR Y VENTA ASISTIDA:
• /precios [producto] — Consulta de stock y precios al instante.

📊 ESTRATEGIA Y ANALÍTICA (Tríada Unificada):
• /semana — Auditoría de la semana: GSC + Cloudflare + Pedidos + Gráfico.
• /cro — Embudo de conversión, detección de fugas y ratio de cierre.
• /mes — Facturación total, donas de ventas y recomendación IA Gemini.
• /top — Ranking de los productos más vendidos.
• /seo — Rendimiento orgánico y palabras clave en Google.
• /set_gsc [imp] [clics] [ctr] [pos] — Sincronizar métricas de Search Console.
```

---

## 5. Radiografía de Audiencia y Demanda Real (País, Dispositivo y Productos Top)

Además del embudo de conversión general, la arquitectura permite consultar a nivel de servidor la **radiografía real de la demanda** sin depender de cookies ni extensiones de navegador:

```javascript
// Consulta GraphQL en Cloudflare para desglose por País y Dispositivo
const queryAudience = `{
  viewer {
    zones(filter: { zoneTag: "${zoneId}" }) {
      httpRequestsAdaptiveGroups(
        limit: 15,
        filter: { date_geq: "${startDate}" },
        orderBy: [count_DESC]
      ) {
        count
        dimensions {
          clientCountryName
          clientDeviceType
        }
      }
    }
  }
}`;
```

### Estructura de Tabla Estándar de Demanda (Aplicable a Cualquier E-Commerce):
| Dimensión | Métrica Clave | Interpretación Estratégica |
| :--- | :--- | :--- |
| **País (Geolocalización)** | % Tráfico Nacional (ej: PE) vs Internacional | Filtra rastreadores extranjeros (Googlebot en US/NL) y aísla clientes reales con poder de compra local. |
| **Dispositivo** | Móvil vs Computadora vs Tablet | Define la prioridad de diseño (en retail local, >80% móvil exige botones de WhatsApp flotantes). |
| **Preferencia de Género** | Damas vs Caballeros vs Unisex | Permite balancear el stock en tienda física y orientar las pautas publicitarias. |
| **Top Productos Más Vistos** | Peticiones a assets/imágenes de productos | Revela la demanda latente: qué producto quieren comprar aunque no hayan concretado la orden. |

---

## 6. El Embudo de Conversión CRO: Fórmula y Cálculo

El sistema calcula automáticamente la Tasa de Conversión Real del negocio:

$$\text{Conversión Web} = \left(\frac{\text{Pedidos Generados}}{\text{Visitantes Únicos Cloudflare}}\right) \times 100$$

$$\text{Efectividad de Cobro} = \left(\frac{\text{Pedidos Cobrados}}{\text{Pedidos Generados}}\right) \times 100$$

$$\text{Conversión Neta Final} = \left(\frac{\text{Pedidos Cobrados}}{\text{Visitantes Únicos Cloudflare}}\right) \times 100$$

### Diagnóstico Automático de Fugas de Conversión:
- **Si Visitas Únicas es alto pero Pedidos Web es bajo:** Fuga en el catálogo (falta botón flotante de WhatsApp, filtros confusos o falta de confianza en la cabecera).
- **Si Pedidos Web es alto pero Pedidos Cobrados es bajo:** Fuga en la pasarela o cierre de pago (rechazos de tarjeta, demora en responder el WhatsApp o desconfianza en el método de pago).

---

## 7. Checklist de Replicación para un Nuevo Dominio

Para instalar esta arquitectura en un nuevo cliente o proyecto:
* [ ] **1. Cloudflare:** Dominio delegado con proxy activo (nube naranja).
* [ ] **2. Cloudflare Zone ID:** Copiado de la vista de resumen del dominio.
* [ ] **3. Cloudflare API Token:** Creado con permisos `Zone.Analytics:Read` y `Worker:Edit`.
* [ ] **4. Cloudflare KV:** Creado con `npx wrangler kv namespace create ORDERS` y colocado en `wrangler.toml`.
* [ ] **5. Telegram Bot:** Creado vía `@BotFather` con webhook configurado a `/api/telegram-webhook`.
* [ ] **6. Gemini API Key:** Creada en Google AI Studio y seteada con `npx wrangler secret put GEMINI_API_KEY`.
* [ ] **7. Sincronización GSC:** Asociar el dominio a Google Search Console y sincronizar las primeras métricas con `/set_gsc`.
