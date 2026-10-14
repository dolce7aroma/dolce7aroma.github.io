# 📝 Bitácora de Versiones (Changelog)

Este documento registra cronológicamente los cambios y nuevas funciones de la plataforma Dolce 7 Aroma.

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
