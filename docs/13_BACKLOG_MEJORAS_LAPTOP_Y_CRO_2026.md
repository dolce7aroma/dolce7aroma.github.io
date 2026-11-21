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
| **4** | En laptop, el footer/drawer inferior del carrito ocupa mucho alto y tapa los productos. | UI / Responsive | ✅ RESUELTO |
| **5** | Ajuste de curva de descuento 110ml: Primero S/ 15 y luego S/ 30 (temporal hasta 2027). | Precios / Promos | ✅ RESUELTO |
| **6** | Bolsa flotante visible en todo tipo de ventana (incluso si no está maximizada). | UI / Accesibilidad | ✅ RESUELTO |
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

---

## 🛠️ Detalle de Resolución: Punto 4 (Optimización de Altura del Carrito en Computadora)

### Solución Implementada:
1. **Reducción de Altura del Pie del Carrito (`.da-cart-foot`):**
   * Se unificaron los botones secundarios apilados en una sola línea horizontal sutil: `+ Seguir comprando · Vaciar bolsa`, eliminando más de 80px de altura vertical innecesaria.
   * Se compactaron los paddings verticales de `20px` a `12px` y se redujo el tamaño del total de `34px` a `26px`.
   * La caja de ofertas (`da-trio-hint`) ahora tiene un padding estilizado de `10px 14px` con altura máxima controlada (`max-height: 150px` con scroll interno si hay más de 3 niveles de oferta), evitando que crezca indefinidamente.
2. **Duplicación del Área Visible de Productos:**
   * La altura útil de la lista de productos (`.da-cart-list`) aumentó de apenas ~220px a más de **450px**, permitiendo visualizar de 3 a 4 perfumes seleccionados en simultáneo en cualquier laptop sin necesidad de scroll forzado.
   * Se ajustó el tamaño de miniatura de producto a 60px x 60px para una vista proporcionada y elegante.
3. **Ancho Ampliado en Desktop/Laptop:**
   * Se incrementó el ancho del panel lateral de 440px a **480px** en pantallas de escritorio, brindando espacio horizontal para que los nombres de los perfumes y los descuentos respiren sin saltos de línea excesivos.
4. **Cache-Buster v8:** Desplegado en `index.html`, `catalogo.html`, `faq.html` y `navidad.html`.

---

## 🛠️ Detalle de Resolución: Feedback Tablet & Delivery Gratis en Totales $\ge \text{S/ } 100$

### Diagnóstico de la Causa Raíz
* En la prueba en tablet (captura con total S/ 200/220), al completarse todas las ofertas pendientes de volumen (`offers.progress.length === 0`), la caja `progressHtml` desaparecía.
* No existía un distintivo permanente ni una línea de costo de envío en los totales (`.da-totals`), por lo que un cliente que alcanzaba S/ 100 o más no veía ninguna confirmación de **DELIVERY GRATIS** en el paso 1 ni en el paso 2.
* Además, el cálculo del tag `qualifiesFreeDelivery` se mostraba en sugerencias incluso cuando el carrito ya superaba los S/ 100.

### Solución Implementada
1. **Línea de Envío en Totales (`.da-totals`):**
   * Si `total >= 100`: Muestra `🚚 Envío: ¡GRATIS!*` en verde esmeralda (sin etiqueta técnica "Zona A").
   * Si `total >= 50`: Muestra `Envío: Por calcular en paso 2`.
   * Si `total < 50`: Muestra `Modalidad: Recojo SMP gratis`.
2. **Tarjeta de Estado de Entrega (`.da-delivery-status`):**
   * Siempre visible antes del botón de Continuar.
   * Si califica a delivery gratis: `🎉 🚚 ¡Tu compra tiene DELIVERY GRATIS*! (Válido en SMP, Los Olivos, San Miguel, Lince, Miraflores, San Isidro, Surquillo y más distritos de Lima y Callao. En zonas periféricas, ¡súper descuento en courier!)`.
   * Si falta para delivery gratis: `🚚 Agrega S/ [100 - total] más para DELIVERY GRATIS*`.
   * Si es menor a S/ 50: `🏬 Recojo GRATIS en Tienda SMP`.
3. **Paso 2 y WhatsApp Sincronizados:**
   * La línea de envío gratis se refleja en el resumen del formulario.
   * El mensaje pre-armado de WhatsApp incluye el estado exacto del envío según el distrito y monto (`🚚 Envío: ¡GRATIS (S/ 0.00)!*`).
4. **Cache-Buster v10:** Desplegado en `index.html`, `catalogo.html`, `faq.html` y `navidad.html`.

---

## 🛠️ Detalle de Resolución: Punto 5 (Curva de Descuento 110 ml Temporal 2026–2027)

### Causa & Justificación Comercial
* Anteriormente, al llevar 2 frascos de 110 ml el descuento era de S/ 30 directos (pagaban S/ 150), y al llevar 3 frascos el descuento subía a S/ 45 (pagaban S/ 225). La diferencia percibida al pasar de 2 a 3 frascos era de solo S/ 15 adicionales de ahorro, desincentivando la compra del 3er frasco grande y castigando el margen en ventas de solo 2 unidades.

### Solución Implementada:
1. **Dúo Premium (2 frascos de 110 ml):**
   * Descuento ajustado a **S/ 15** (antes S/ 30).
   * Precio total: **S/ 165** (antes S/ 180).
   * Al superar S/ 100, activa automáticamente **🚚 Delivery GRATIS\***.
2. **Trío Premium (3 frascos de 110 ml):**
   * Mantiene el 50% de descuento en el 3er frasco (ahorro total acumulado de **S/ 45**).
   * Precio total: **S/ 225** (antes S/ 270).
   * Crea un salto psicológico de **+S/ 30 de ahorro adicional** al decidir sumar el 3er frasco grande.
3. **Sincronización Web:**
   * Actualizado en el motor del carrito (`DUO_TIERS[110].amount = 15`).
   * Actualizado en la grilla de promociones de `index.html#ofertas` (`2 unidades S/ 165`).
   * Actualizado en los packs de campaña de `navidad.html` (`Dúo Premium S/ 165`).
4. **Cache-Buster v11:** Desplegado en todas las páginas clave.

---

## 🛠️ Detalle de Resolución: Punto 6 (Bolsa Flotante Visible en Todo Tipo de Ventana)

### Causa & Diagnóstico
* En ventanas no maximizadas, laptops en media pantalla, tablets o al hacer scroll profundo en el catálogo, el botón de acceso al carrito solo existía en el navbar superior. El cliente debía desplazarse hasta la cima de la página para consultar su bolsa o ver cuántos perfumes llevaba.

### Solución Implementada:
1. **Botón Flotante de Bolsa (`.da-cart-float`):**
   * Botón permanente en la esquina inferior derecha (`bottom: 20px; right: 20px; z-index: 85`), apilado elegantemente debajo del botón de regalo (`.da-gift-float`, `bottom: 86px`).
   * Diseño boutique de alta gama: Fondo ciruela oscuro (`#3c2f47`), borde dorado tenue, icono de compras (`🛍️`), texto serif (*Bolsa*) y pastilla contadora dorada vinculada a `data-cart-count`.
2. **Interactividad & Animación:**
   * Al agregar perfumes a la bolsa, la pastilla contadora ejecuta automáticamente la animación de rebote sutil (`bumpCount`).
   * Al hacer clic, abre inmediatamente el panel lateral del carrito (`openCart`).
   * Cuando el panel del carrito se abre (`.da-cart.open`), tanto la bolsa flotante como el botón de regalo se desvanecen con opacidad 0 para no obstaculizar la vista ni el cierre del carrito.
3. **Responsive Total:**
   * Adaptado tanto para monitores 4K/Desktop, laptops con ventanas restauradas/no maximizadas, tablets en vertical/horizontal y dispositivos móviles (`max-width: 480px`).
4. **Cache-Buster v12:** Desplegado en `index.html`, `catalogo.html`, `faq.html` y `navidad.html`.



