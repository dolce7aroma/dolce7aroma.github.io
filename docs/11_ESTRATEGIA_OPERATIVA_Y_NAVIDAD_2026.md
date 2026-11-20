# 🏛️ Estrategia Operativa, Filosofía de Maceración y Campaña 2026 — Dolce 7 Aroma

**Fecha de Creación:** Noviembre 2026  
**Propósito:** Documento raíz oficial que consolida la verdad operativa del negocio, la diferenciación por maceración, el modelo de inventario, y la estrategia de conversión para ventas de alto margen (50 ml y 110 ml).

---

## 1. Filosofía de Producto: Maceración Controlada vs. Perfumes al Instante

### 1.1. La Verdad del Perfume (Ventaja Competitiva)
El mercado tradicional de perfumes de equivalencia suele mezclar esencias y alcohol frente al cliente en cuestión de minutos. Esta práctica genera:
- Olor inicial predominantemente alcohólico y punzante.
- Poca o nula fijación en piel y tela (se evapora en 1 o 2 horas).
- Inestabilidad química de la fragancia.

**El Estándar Dolce 7 Aroma:**
- **Esencias importadas de Francia (Grasse)** formuladas con materias primas de alta graduación.
- **Maceración en ambiente controlado:** Las fragancias reposan durante semanas en temperatura y oscuridad controlada para permitir que las moléculas de los aceites esenciales se fusionen químicamente con el alcohol desodorizado y los fijadores.
- **Resultado:** Proyección, estela y duración prolongada (8 a 12+ horas en piel, días en prendas de vestir).
- **Narrativa Comercial:** "No vendemos perfumes improvisados al instante; entregamos fragancias maduradas con tiempo para máxima fijación."

---

## 2. Modelo de Inventario y Operativa de Tienda vs. Web

Para maximizar la rentabilidad y evitar capital inmovilizado, la distribución física y digital opera bajo dos dinámicas complementarias:

| Presentación | Ubicación Principal | Modalidad de Venta | Enfoque de Margen |
| :--- | :--- | :--- | :--- |
| **10 ml Pocket (S/ 20)** | **Tienda física (Bazar Shirley · SMP)** | **Stock perenne inmediato** | Producto gancho / probador portátil. Permite al cliente oler, convencerse y comprar en el mostrador. Trío x 3 por S/ 50. |
| **50 ml Esencial (S/ 55)** | **A demanda (Web / WhatsApp)** | **Bajo pedido** (Recojo coordinado 5-10h o Delivery) | **Alto margen y rotación.** Ideal para uso diario o regalo personal. Dúo S/ 100 · Trío S/ 150. |
| **110 ml Premium (S/ 90)** | **A demanda (Web / WhatsApp)** | **Bajo pedido** (Recojo coordinado 5-10h o Delivery) | **Máximo margen y ticket promedio.** Incluye atomizador 10ml + 2 probadores de cortesía. Dúo S/ 150 · Trío S/ 225. |

---

## 3. Política de Empaque y Presentación para Regalos

1. **Bolsa de Regalo Dolce Aroma (GRATIS · S/ 0):**
   - Se ofrece como beneficio de cortesía en el carrito para todas las compras destinadas a regalo (Navidad, Amigo Secreto, cumpleaños).
   - Elimina la necesidad de cajas rígidas complejas o costosas de conseguir.
2. **Presentación de Frascos de 50 ml y 110 ml:**
   - Tienen base sólida y altura perfecta para lucir erguidos y elegantes dentro de la bolsa con papel de protección.
3. **Presentación de Frascos de 10 ml (Trío Pocket):**
   - Para evitar que queden sueltos o desordenados en el fondo, se agrupan en bolsitas internas o lazo de sujeción antes de colocarse en la bolsa principal.

---

## 4. Arquitectura de Sistemas y Optimización de Conversión (CRO)

### 4.1. Diagnóstico del Embudo (Datos Reales de Telegram Bot)
- **Atracción:** Clientes interesados llegan a la web mediante Google Search y Google Business Profile.
- **Interés en Combos:** El 57% de los usuarios arma carritos con modalidad Trío.
- **Fricción Detectada:** Fuga en el paso 3 (transición manual a WhatsApp para pagar con Yape).

### 4.2. Medidas de Eliminación de Fricción en el Checkout
1. **Copiar número de Yape con 1 toque:** El cliente no debe memorizar el número (`930 122 014`).
2. **Botón directo a WhatsApp:** Genera el mensaje con todos los ítems, totales, empaque de regalo y código de pedido (#DA-XXXX) con un solo clic.
3. **Resiliencia / Fallback:** Si la conexión con Cloudflare Worker tarda, el carrito salta automáticamente al enlace de WhatsApp con el pedido prellenado para garantizar que **ninguna venta se pierda**.
4. **Telemetría Activa:**
   - **Microsoft Clarity (`zg3pjt0bq4`):** Grabación visual de sesiones y mapas de calor.
   - **Cloudflare KV (`ORDERS`):** Persistencia serverless de pedidos.
   - **Telegram Bot (`dolce7aroma-pedidos-bot`):** Alertas push instantáneas al administrador.
