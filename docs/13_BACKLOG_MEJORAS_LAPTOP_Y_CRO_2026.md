# 📋 BACKLOG DE OBSERVACIONES Y MEJORAS — EXPERIENCIA LAPTOP & CRO (2026)
**Dolce 7 Aroma** — Registrado el 20 de Noviembre de 2026

---

## 📌 Resumen Ejecutivo de Observaciones

Este documento consolida las 12 observaciones identificadas en la prueba de escritorio/laptop para proceder con su resolución ordenada y sistemática **1 por 1**.

| # | Observación del Dueño | Categoría | Estado |
| :---: | :--- | :---: | :---: |
| **1** | Inicio no tiene botón para ir a nuestra filosofía, familias olfativas, etc. | UX / Navegación | ⏳ Pendiente |
| **2** | Al añadir a la bolsa no debería forzar la apertura si el cliente quiere seguir comprando. | UX / Carrito | ⏳ Pendiente |
| **3** | En recomendación de Dúo Esencial (al llegar a S/ 100) debe mostrar "Delivery GRATIS". | CRO / Incentivo | ⏳ Pendiente |
| **4** | En laptop, el footer/drawer inferior del carrito ocupa mucho alto y tapa los productos. | UI / Responsive | ⏳ Pendiente |
| **5** | Ajuste de curva de descuento 110ml: Primero S/ 15 y luego S/ 30 (temporal hasta 2027). | Precios / Promos | ⏳ Pendiente |
| **6** | Bolsa flotante visible en todo tipo de ventana (incluso si no está maximizada). | UI / Accesibilidad | ⏳ Pendiente |
| **7** | Sincronización del video del perfume flotando en el home. | Visual / Rendimiento | ⏳ Pendiente |
| **8** | Banner de campaña navideña debe estar en lugar TOP (inmediatamente visible). | Marketing / Hero | ⏳ Pendiente |
| **9** | Desglose visible de "Descuento por promociones: -S/ XX" cuando hay varios descuentos. | Checkout / Transparencia | ⏳ Pendiente |
| **10** | Bandeja/caja de sugerencias "¿Qué perfume buscas?" para capturar demanda insatisfecha. | Conversión / Feedback | ⏳ Pendiente |
| **11** | Mensaje de envío a Lima no coherente con el Delivery Gratis en compras mayores a S/ 100. | Logística / Copy | ⏳ Pendiente |
| **12** | **Error al dar Continuar ("No se pudo enviar el pedido. Intenta de nuevo").** | **Core Checkout / API** | **✅ RESUELTO** |

---

## 🛠️ Detalle de Resolución: Punto 12 (Checkout Bloqueado)

### Diagnóstico de la Causa Raíz
* En `assets/shop.js`, la variable `ORDER_API_BASE` apuntaba a la URL antigua `https://dolce7aroma-github-io.cesarfernandezh7.workers.dev/api/submit-order`, la cual arrojaba **Error 404 Not Found**.
* La URL real del Worker activo en Cloudflare es: `https://dolce7aroma-pedidos-bot.cesarfernandezh7.workers.dev`.

### Solución Implementada
1. **Corrección de Endpoint:** Se actualizó `ORDER_API_BASE` en `assets/shop.js` al endpoint activo.
2. **Prueba de Conectividad:** Se envió una petición de prueba al Worker real y respondió:
   `{"ok":true,"orderId":"DA-5K4ZLFA","notified":{"email":true,"telegram":true}}` con código **200 OK**.
3. **Fallback Resiliente:** En caso de cualquier falla de red local, el carrito genera automáticamente un identificador de contingencia `W-XXXXX` y deriva a la pantalla de confirmación por WhatsApp para que **jamás se pierda una venta**.

4. **Resolución de Bloqueo en "ENVIANDO...":** Se detectó que tras responder exitosamente el Worker, una variable no declarada (`cartGift`) en `renderCheckoutConfirm` arrojaba un `ReferenceError` que impedía repintar la vista de éxito. Se declaró `let cartGift = null;` y se blindó toda la confirmación con `try/catch` para garantizar la transición inmediata a la pantalla de confirmación.
5. **Saludo Concierge WhatsApp:** Se actualizó el texto pre-rellenado del enlace en el Worker para que sea un saludo introductorio directo y elegante: `¡Hola [Nombre]! 👋 Te saludamos de Dolce 7 Aroma 🌸 Confirmamos la recepción de tu pedido #[ID] registrado en nuestra web por un total de S/ [Total].`, eliminando preguntas innecesarias y dejándolo listo para disparar el atajo `/yape` de WhatsApp Business.
6. **Cache-Buster v5:** Desplegado en `index.html`, `catalogo.html`, `faq.html` y `navidad.html` (`shop.js?v=20261120_v5`).
