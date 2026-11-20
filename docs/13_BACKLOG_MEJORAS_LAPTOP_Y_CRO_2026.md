# 📋 BACKLOG DE OBSERVACIONES Y MEJORAS — EXPERIENCIA LAPTOP & CRO (2026)
**Dolce 7 Aroma** — Registrado el 20 de Noviembre de 2026

---

## 📌 Resumen Ejecutivo de Observaciones

Este documento consolida las 12 observaciones identificadas en la prueba de escritorio/laptop para proceder con su resolución ordenada y sistemática **1 por 1**.

| # | Observación del Dueño | Categoría | Estado |
| :---: | :--- | :---: | :---: |
| **1** | Inicio no tiene botón para ir a nuestra filosofía, familias olfativas, etc. | UX / Navegación | ✅ RESUELTO |
| **2** | Al añadir a la bolsa no debería forzar la apertura si el cliente quiere seguir comprando. | UX / Carrito | ✅ RESUELTO |
| **3** | En recomendación de Dúo Esencial (al llegar a S/ 100) debe mostrar "Delivery GRATIS". | CRO / Incentivo | ✅ RESUELTO |
| **4** | En laptop, el footer/drawer inferior del carrito ocupa mucho alto y tapa los productos. | UI / Responsive | ⏳ Pendiente |
| **5** | Ajuste de curva de descuento 110ml: Primero S/ 15 y luego S/ 30 (temporal hasta 2027). | Precios / Promos | ⏳ Pendiente |
| **6** | Bolsa flotante visible en todo tipo de ventana (incluso si no está maximizada). | UI / Accesibilidad | ⏳ Pendiente |
| **7** | Sincronización del video del perfume flotando en el home. | Visual / Rendimiento | ⏳ Pendiente |
| **8** | Banner de campaña navideña debe estar en lugar TOP (inmediatamente visible). | Marketing / Hero | ⏳ Pendiente |
| **9** | Desglose visible de "Descuento por promociones: -S/ XX" cuando hay varios descuentos. | Checkout / Transparencia | ⏳ Pendiente |
| **10** | Bandeja/caja de sugerencias "¿Qué perfume buscas?" para capturar demanda insatisfecha. | Conversión / Feedback | ⏳ Pendiente |
| **11** | Mensaje de envío a Lima no coherente con el Delivery Gratis en compras mayores a S/ 100. | Logística / Copy | ✅ RESUELTO |
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

---

## 🛠️ Detalle de Resolución: Punto 1 (Menú de Secciones de Inicio)

### Solución Implementada:
1. **Botón de Líneas junto a Inicio:** Se añadió un botón estilizado con el icono de 3 líneas (`☰`) al lado de la opción **Inicio** en el menú de navegación de laptop/desktop (`nav.top`).
2. **Desplegable de Secciones (Dropdown):** Al pasar el ratón o hacer clic en el botón de líneas, se despliega un menú flotante de diseño refinado con acceso directo a:
   - 🌿 **Nuestra Filosofía:** Maceración controlada y esencias de Francia (`#filosofia`).
   - 🌸 **Familias Olfativas:** Clasificación olfativa (`#familias`).
   - ⭐ **Los Más Pedidos:** Catálogo de fragancias insignias (`#perfumes`).
   - 🎁 **Ofertas & Promos:** Combos Dúo y Tríos (`#ofertas`).
   - 🏬 **Boutique & Punto SMP:** Dirección y recojo en Bazar Shirley (`#boutique`).
3. **Persistencia e Integridad:** Los demás elementos de la barra de navegación (`Perfumes`, `Ofertas`, `Boutique`, `FAQ`, `Seguimiento`, `Contacto`, `Bolsa`) continúan operando con total normalidad.
4. **Anclaje:** Se agregó el identificador `id="familias"` a la sección de notas olfativas para permitir el scroll suave automático.
5. **Consistencia de Marca:** Se actualizó el texto del lede del Hero a **Dolce 7 Aroma**.

---

## 🛠️ Detalle de Resolución: Punto 2 (Adición a la Bolsa Sin Fricción)

### Solución Implementada:
1. **Flujo de Compra Continuo:** Se removió la invocación obligatoria a `openCart()` al pulsar "Agregar a la bolsa" en el modal de detalle del producto (`assets/shop.js`). El cliente ahora permanece en la misma pantalla navegando libremente.
2. **Toast con Botón de Acción Directa:** Se potenció la notificación flotante inferior (`.da-toast`), la cual ahora muestra el mensaje de confirmación del aroma y ahorro disponible acompañado de un botón estilizado `[VER BOLSA →]` por si el cliente desea abrir el carrito de inmediato.
3. **Animación en Cabecera:** Al agregar un perfume, el contador `Bolsa (X)` en la barra superior ejecuta su micro-animación `bumpCount()`, brindando retroalimentación visual inmediata.
4. **Cache-Buster v6:** Se actualizó la etiqueta de importación de `shop.js` a `?v=20261120_v6` en todos los archivos HTML para forzar la carga inmediata en los navegadores de los clientes.

---

## 🛠️ Detalle de Resolución: Puntos 3 y 11 (Delivery Gratis Inteligente y Coherencia en Envíos)

### Solución Implementada:
1. **Motor de Proyección Dinámica (Punto 3):**
   * En `assets/shop.js`, la función `computeOffers` evalúa matemáticamente en tiempo real si al completar una oferta recomendada el total proyectado de la bolsa alcanza o supera los **S/ 100**.
   * Si califica, el mensaje añade de forma dinámica: `+ 🚚 ¡Delivery GRATIS*!`.
   * En frascos de 50 ml (Dúo Esencial: S/ 100) y de 110 ml (Dúo Premium: S/ 150), se incentiva al cliente con el doble beneficio: ahorro en soles + envío gratis.
   * Se agregó la aclaración elegante al pie de la caja de ofertas: `*Delivery gratis desde S/ 100 en Zona A (SMP, Los Olivos, San Miguel, Lince, Miraflores, San Isidro, Surquillo y más). En zonas periféricas, ¡súper descuento en courier!`.

2. **Zonificación Oficial de Envíos en Lima (Punto 11):**
   * **Zona A (100% GRATIS en compras $\ge \text{S/ } 100$):** San Martín de Porres (SMP), Los Olivos, Lima (Cercado), Breña, Jesús María, Lince, Pueblo Libre, San Miguel, Magdalena del Mar, San Isidro, Miraflores, Surquillo, San Borja, Barranco, Bellavista, La Perla.
   * **Zona B (Zonas Periféricas con Súper Descuento):** Rímac, San Juan de Lurigancho, San Juan de Miraflores, Villa María del Triunfo, Villa El Salvador, Chorrillos, La Molina, Ate, Santa Anita, Comas, Carabayllo, etc. Al cliente que compra $\ge \text{S/ } 100$ se le comunica con orgullo que Dolce 7 Aroma asume más del 50% de la tarifa de courier a su domicilio.
   * **San Martín de Porres:** Mensaje dual destacando Recojo GRATIS (S/ 0.00) en Tienda Bazar Shirley y Delivery a Domicilio GRATIS al superar S/ 100.
   * **Provincias:** Despacho por agencia con pago en destino y embalaje protegido gratis.
   * **Incentivo de Ticket Promedio (AOV):** Si el cliente de Zona A tiene entre S/ 50 y S/ 99, el sistema le muestra el monto exacto faltante para activar su Delivery Gratis.
3. **Cache-Buster v7:** Desplegado en `index.html`, `catalogo.html`, `faq.html` y `navidad.html`.
