# 📊 Plan de Inteligencia Comercial y Reportería Automatizada — Dolce 7 Aroma

**Fecha de Creación:** Noviembre 2026  
**Ecosistema:** Cloudflare Workers + KV (`ORDERS`) + Telegram Bot + Gemini API + QuickChart.io + Google Analytics 4 (`G-YXYWYS5LCJ`)  
**Propósito:** Monitoreo continuo, control de salud web, optimización de conversión (CRO), posicionamiento orgánico (SEO) y alertas tempranas de campañas masivas de venta.

---

## 1. Convivencia y Separación de Entornos

> ⚠️ **REGLA DE ORO PARA ASISTENTES Y AGENTES IA:**  
> Este sistema opera exclusivamente en el backend (`worker/dolce-aroma-admin-worker.js`, `wrangler.toml` y servicios externos vía API).  
> **NO MODIFICAR** archivos del frontend (`index.html`, `catalogo.html`, `assets/`, `data/productos.json`) bajo este plan a menos que se solicite explícitamente, para evitar sobreescribir auditorías web activas en paralelo.

---

## 2. Matriz de Roles y Derivación de Tareas entre IAs

Para mantener la eficiencia operativa, cada tarea debe ser ejecutada por la herramienta o IA idónea:

| Tarea / Especialidad | IA / Herramienta Responsable | Flujo de Trabajo |
| :--- | :--- | :--- |
| **Monitoreo, Diagnóstico y Reportería** | **Gemini (integrado en Worker/Telegram)** | **Automático.** Procesa la data en crudo y emite el informe con semáforos a Telegram. |
| **Arquitectura Web, Código y APIs** | **Antigravity (Asistente de Desarrollo)** | **En Sesión.** Edición de workers, endpoints, automatizaciones y bases de datos KV. |
| **Diseño Visual (Banners, Stories, Reels)** | **Canva Magic / Midjourney / DALL-E 3** | **Manual por el usuario.** El bot provee el *Prompt Gráfico* exacto para generar el arte publicitario. |
| **Copywriting (Guiones de TikTok, WhatsApp)** | **ChatGPT / Claude / Gemini Web** | **Manual por el usuario.** El bot redacta el copy persuasivo listo para copiar y pegar. |

---

## 3. Jerarquía y Definición de Reportes

### A. ⚡ Reporte Semanal (Lunes 8:00 AM)
* **Ventana:** Lunes a Domingo de la semana previa.
* **Foco:** Salud técnica del sitio, detección de anomalías operativas y tendencias SEO tácticas.
* **Métricas Recopiladas:**
  * Facturación semanal y número de pedidos (comparativa WoW: semana actual vs. anterior).
  * Ticket promedio y productos más vendidos.
  * Tiempos de carga móvil y tasa de disponibilidad.
  * Palabras clave emergentes en Google Search Console.
  * Fuentes de tráfico principales (Top 3: TikTok, Instagram, Directo, etc.).
* **Entregable Visual:** Gráfico de barras de ventas diarias comparadas contra la semana previa.

### B. 🌓 Reporte Quincenal (Día 16 de cada mes, 6:00 AM)
* **Ventana:** Días 1 al 15 del mes calendario.
* **Foco:** Optimización de Conversión (CRO), comportamiento del usuario y efectividad de canales.
* **Métricas Recopiladas:**
  * Embudo de conversión detallado (Visitas → Catálogo → Carrito/Regalo → Checkout → WhatsApp).
  * Rendimiento de banners activos en el Hero.
  * Calidad de canales de adquisición (Tráfico vs. Ventas reales por red social).
  * Búsquedas dentro de la web sin resultados (demanda insatisfecha).
* **Entregable Visual:** Gráfico de embudo (funnel) con porcentaje de abandono en cada etapa.

### C. 🗓️ Reporte Mensual (Día 1 del mes nuevo, 6:00 AM)
* **Ventana:** Mes completo consolidado (días 1 al 28/30/31) + acumulado anual.
* **Foco:** Dirección estratégica de negocio, posicionamiento SEO macro y salud financiera.
* **Métricas Recopiladas:**
  * Facturación neta y evolución MoM (Mes sobre Mes).
  * Ranking medio en Google e impresiones orgánicas.
  * Rotación de catálogo: perfumes estrella vs. perfumes sin rotación (stock dormido).
  * Tasa de clientes recurrentes.
  * Plan de optimización y preguntas estratégicas generadas para el nuevo mes.
* **Entregable Visual:** Gráfico de dona (ventas por categoría) y curva de crecimiento orgánico en Google.

---

## 4. Reloj de Campañas de Temporada (Alertas 30 Días Antes)

El sistema activa una alerta proactiva exactamente **30 días antes** de cada pico de ventas comercial en Perú:

| Evento Comercial | Fecha Central | Fecha de Alerta (Disparador) | Foco Comercial |
| :--- | :--- | :--- | :--- |
| **San Valentín** | 14 de Febrero | **14 de Enero** | Módulo "Regalar", Dúos de pareja. |
| **Día de la Mujer** | 8 de Marzo | **8 de Febrero** | Fragancias florales/dulces, packs. |
| **Día de la Madre** | 2do dom. Mayo | **10 de Abril** | Frascos de 110 ml, perfumes prémium. |
| **Día del Padre** | 3er dom. Junio | **15 de Mayo** | Amaderados, árabes intensos. |
| **Fiestas Patrias** | 28 de Julio | **28 de Junio** | Perfumes pocket 10 ml para viajes. |
| **Cyber / Black Friday** | Noviembre | **15 de Octubre** | Liquidación de stock lento, ofertas por tríos. |
| **Navidad y Año Nuevo** | 24-31 Diciembre | **24 de Noviembre** | Regalos corporativos, preventa anticipada. |

---

## 5. Especificación de Comandos de Telegram

El bot implementa un Webhook en Cloudflare Worker que procesa comandos bajo validación estricta de `TELEGRAM_CHAT_ID`:

* `/help` o `/ayuda`: Lista y explicación de todos los comandos disponibles.
* `/resumen`: Estado operativo al instante (pedidos nuevos en KV, ventas de hoy y stock crítico).
* `/semana`: Genera en tiempo real el reporte semanal con su gráfico de barras.
* `/cro`: Radiografía del embudo de conversión y tasa de abandono en checkout.
* `/seo`: Palabras clave en tendencia y clics orgánicos en Google.
* `/top`: Ranking de los perfumes más vendidos y los más visitados.
* `/campana`: Días restantes para la siguiente fecha clave y checklist de hitos.

### Formato de Títulos Visibles (Estandarización)
* `🚨 [ALERTA CRÍTICA · WEB]`
* `⚡ [REPORTE SEMANAL · LUNES]`
* `🌓 [REPORTE QUINCENAL · CRO]`
* `🗓️ [REPORTE MENSUAL · ESTRATEGIA]`
* `🎯 [CAMPAÑA COMERCIAL · ALERTA 30 DÍAS]`

---

## 6. Matriz de Seguimiento de Hitos

| Hito | Actividad / Entregable | Estado |
| :---: | :--- | :---: |
| **HITO 1** | **Estructura del Bot y Comandos Telegram (`/help`, `/resumen`, `/top`, `/campana`):**<br>Configuración de Webhook en Worker (`POST /api/telegram-webhook`), validación estricta de `TELEGRAM_CHAT_ID` y respuestas interactivas desde KV. | 🟢 Completado en Código (Pendiente Deploy y Vinculación) |
| **HITO 2** | **Generador de Gráficos Estadísticos (QuickChart API):**<br>Funciones para generar gráficos PNG de barras, embudos y donas y enviarlos vía Telegram. | ⏳ Pendiente |
| **HITO 3** | **Automatización Periódica (Cron Triggers):**<br>Disparadores programados (Lunes 8am, Día 16 y Día 1) en Cloudflare Worker. | ⏳ Pendiente |
| **HITO 4** | **Integración del Especialista IA (Gemini API):**<br>Prompting especializado para diagnóstico, semáforos y generación de paquetes para otras IAs. | ⏳ Pendiente |
| **HITO 5** | **Reloj de Campañas de Alta Demanda:**<br>Automatización de notificaciones 30 días antes con plan de acción comercial. | ⏳ Pendiente |
| **HITO 6** | **Conexión Google Analytics 4 & Search Console:**<br>Consumo de APIs de Google para métricas de tráfico y SEO orgánico. | ⏳ Pendiente |
| **HITO 7** | **Módulo de Consulta de Precios y Ofertas (`/precios`):**<br>Consulta en tiempo real del catálogo y promociones vigentes. | ⏳ Pendiente |
