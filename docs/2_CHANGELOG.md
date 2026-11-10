# 📝 Bitácora de Versiones (Changelog)

Este documento registra cronológicamente los cambios y nuevas funciones de la plataforma Dolce 7 Aroma.

## [v2.5.0] - Noviembre 2026
### Añadido
- **Fase 4 · Automatización y Sincronización Google Sheets en Tiempo Real:**
  - Integración nativa del Cloudflare Worker con Google Sheets mediante Google Apps Script (`docs/7_AUTOMATIZACION_GOOGLE_SHEETS.md`).
  - Registro automático de cada pedido entrante en una hoja de cálculo en Google Drive (`order_id`, fecha, cliente, teléfono, distrito, productos, total, método de pago y estado logístico).
  - Nuevos comandos administrativos en Telegram: `/sheets` (verificación de estado de enlace) y `/sheets sync` (sincronización forzada de pedidos pendientes desde Cloudflare KV hacia Google Sheets).
  - **Cierre de Fase y Transición de Base de Datos:** Arquitectura de datos inicial dada por concluida; la integración omnicanal de base de datos definitiva se transfiere a evaluación y revisión de compatibilidad con **jnxcontrol** (anteriormente conocido como *KeysControl PRO*).
- **Fase 3 · Guía Maestra Google Business Profile al 200%:**
  - Documentación de configuración exhaustiva antibloqueo en [`docs/9_GUIA_MAESTRA_GOOGLE_BUSINESS_PROFILE_200.md`](9_GUIA_MAESTRA_GOOGLE_BUSINESS_PROFILE_200.md) (registro NAP, atributos comerciales al 100%, catálogo de 6 productos para Maps, preguntas Q&A pre-cargadas y protocolo acelerado para 50+ reseñas de 5 estrellas).
- **Fase 5 · Material POP Mostrador A4 & Guía de Venta Cruzada en Punto Físico:**
  - Plantilla imprimible oficial A4 de 2 caras en [`material-pop-a4.html`](../material-pop-a4.html) lista para portagráfico acrílico de mostrador (Cara 1 / Frontal: Precios S/ 20, S/ 55, S/ 90, gancho de probador gratis con compra de ropa, código QR oficial hacia el catálogo y badges de pago Yape/Plin/Tarjetas/Efectivo; Cara 2 / Posterior: Guía rápida para el personal de caja, libreto en 3 pasos, Top 3 perfumes para damas/varones/unisex y manejo de objeciones express).
  - Manual operativo completo de mostrador y protocolo de recolección de reseñas en Google Maps documentado en [`docs/8_MATERIAL_POP_Y_GUIA_MOSTRADOR_A4.md`](8_MATERIAL_POP_Y_GUIA_MOSTRADOR_A4.md).

## [v2.4.0] - Noviembre 2026
### Añadido
- **Sistema de Inteligencia Comercial & Reportería Automatizada (7 Hitos Completados):**
  - **Bot Interactivo de Telegram:** Comandos administrativos bajo demanda protegidos por Chat ID exclusivo.
  - **Generador de Gráficos Estadísticos:** Integración con QuickChart.io para gráficos de barras (/semana), embudo CRO (/cro), dona de categorías (/mes) y distribución omnicanal (/seo).
  - **Disparadores Automáticos (Cron Triggers):** Informes programados semanales, quincenales y mensuales directamente a Telegram.
  - **Cerebro Especialista IA (Gemini):** Auditorías en vivo de salud web, análisis de cuellos de botella y generación de paquetes de acción para TikTok, WhatsApp y Canva.
  - **Reloj de Campañas de Alta Demanda:** Monitoreo con cuenta regresiva de 30 días para temporadas clave en Perú (Navidad, San Valentín, Día de la Madre) y generador de planes comerciales con IA (/campana plan).
  - **Auditoría SEO & Tráfico Orgánico:** Verificación técnica de sitemap.xml, robots.txt y palabras clave de alta intención transaccional en Lima (/seo).
  - **Módulo de Consulta de Precios y Stock:** Consulta en tiempo real de las 66+ fragancias del catálogo oficial con foto, stock por tamaño y enlaces web (/precios).

## [v2.2.0] - Agosto 2026
### Añadido
- **Arquitectura Limpia de Contactos:** Centralización de las redes sociales, correos y teléfonos. Los enlaces fijos del HTML fueron reemplazados por anclas semánticas (`data-contacto`). `site-modals.js` lee `data/pago.json` e hidrata los enlaces o los oculta si no están configurados.
- Se ha creado la nueva carpeta `/docs/` con el plan estructurado de documentación.

## [v2.1.0] - Julio/Agosto 2026
### Añadido
- **Función "Regalar un Perfume":** Nuevo flujo de compras donde el comprador puede pagar por adelantado y enviar un enlace con vigencia de 15 días a la persona regalada para que elija su aroma.
- **Frasco Premium:** Opción en el administrador para asignar disponibilidad y precio de un frasco premium por perfume.
- **Checkout Dinámico:** Integración de alertas por correo (Resend) y Telegram al recibir un nuevo pedido guardado en Cloudflare KV.
- **Cobro con Tarjeta:** Integración opcional de pasarela **Culqi**. Si se introduce la llave pública, se activa el formulario de tarjeta de crédito (3D Secure).

### Modificado
- Se refactorizaron los filtros en dispositivos móviles (botón unificado a pantalla completa).
- El filtro "Árabe/Diseñador" ahora se calcula automáticamente según la lista de marcas duras (`ARABE_BRANDS`) sin intervención del administrador.

## [v2.0.0] - Lanzamiento Inicial
- Arquitectura basada en GitHub Pages + Cloudflare Worker.
- Catálogo leído directamente desde `productos.json`.
- Integración de Yape con validación visual.
