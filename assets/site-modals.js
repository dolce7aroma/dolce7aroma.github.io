/* ───────────────────────────────────────────────
   Dolce Aroma · Modales compartidos
   Contacto · Envíos · Términos · Privacidad · Cookies
   Uso:
     <a href="#" data-modal="contacto">Contacto</a>
     window.SiteModals.open('contacto')
   ─────────────────────────────────────────────── */
(function(){
  const WA = '51930122014';
  const EMAIL = 'Dolce7aroma@gmail.com';
  const SOCIAL = {
    facebook: 'https://www.facebook.com/dolce7aroma/',
    tiktok:   'https://www.tiktok.com/@dolce7aroma',
    instagram:'https://www.instagram.com/dolce7aroma/',
    mercadolibre:'https://www.mercadolibre.com.pe/pagina/dolce7aroma',
    facebookReviews:'https://www.facebook.com/dolce7aroma/'
  };

  const ICONS = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 22v-8h3l.5-4H13V7.5c0-1 .3-1.8 1.8-1.8H17V2.2c-.4 0-1.6-.2-3-.2-3 0-5 1.8-5 5v3H6v4h3v8h4z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 2 .3 2.4.5.6.3 1.1.6 1.6 1.1.5.5.8 1 1.1 1.6.2.4.4 1.2.5 2.4.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.3 2-.5 2.4-.3.6-.6 1.1-1.1 1.6-.5.5-1 .8-1.6 1.1-.4.2-1.2.4-2.4.5-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-2-.3-2.4-.5-.6-.3-1.1-.6-1.6-1.1-.5-.5-.8-1-1.1-1.6-.2-.4-.4-1.2-.5-2.4C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.3-2 .5-2.4.3-.6.6-1.1 1.1-1.6.5-.5 1-.8 1.6-1.1.4-.2 1.2-.4 2.4-.5C8.4 2.2 8.8 2.2 12 2.2zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8zm4.7-8.7a1 1 0 1 0 0 2.1 1 1 0 0 0 0-2.1z"/></svg>',
    tiktok:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3v3.4a4.5 4.5 0 0 0 4 2v3.5a7.8 7.8 0 0 1-4-1.2v5.6a6.5 6.5 0 1 1-6.5-6.5c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 2.1 2.9V3H16z"/></svg>',
    mercadolibre:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6 2 11c0 2.4 1 4.4 2.7 6L12 22l7.3-5c1.7-1.6 2.7-3.6 2.7-6 0-5-4.5-9-10-9zm0 14a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>',
    whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.8.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>',
    mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  // ───── Estilos ─────
  function injectCSS(){
    if(document.getElementById('sm-style')) return;
    const css = `
      .sm-wa-float{
        position:fixed;right:20px;bottom:20px;z-index:80;
        display:flex;align-items:center;gap:10px;text-decoration:none;
      }
      .sm-wa-float .sm-wa-label{
        background:#fff;color:#1a1620;font-size:13px;font-weight:600;font-family:sans-serif;
        padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,0.18);white-space:nowrap;
      }
      .sm-wa-float .sm-wa-icon{
        width:54px;height:54px;border-radius:50%;background:#25D366;flex-shrink:0;
        display:grid;place-items:center;box-shadow:0 8px 24px rgba(37,211,102,0.5);transition:transform .2s;
      }
      .sm-wa-float:hover .sm-wa-icon{transform:scale(1.06)}
      .sm-wa-float .sm-wa-icon svg{width:28px;height:28px;fill:#fff}
      @media (max-width:480px){
        .sm-wa-float{right:14px;bottom:14px}
        .sm-wa-float .sm-wa-label{font-size:12px;padding:8px 12px}
        .sm-wa-float .sm-wa-icon{width:48px;height:48px}
        .sm-wa-float .sm-wa-icon svg{width:24px;height:24px}
      }
      .sm-bd{position:fixed;inset:0;background:rgba(40,30,55,0.55);backdrop-filter:blur(4px);z-index:130;opacity:0;pointer-events:none;transition:opacity .25s}
      .sm-bd.open{opacity:1;pointer-events:auto}
      .sm-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:140;padding:24px;pointer-events:none;visibility:hidden}
      .sm-modal.open{visibility:visible}
      .sm-card{background:#f6f4ef;border-radius:18px;max-width:640px;width:100%;max-height:calc(100vh - 48px);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 40px 100px -30px rgba(0,0,0,0.4);transform:scale(.96) translateY(10px);opacity:0;transition:all .3s cubic-bezier(.2,.7,.2,1);pointer-events:none}
      .sm-modal.open .sm-card{transform:scale(1) translateY(0);opacity:1;pointer-events:auto}
      .sm-card.wide{max-width:780px}
      .sm-head{padding:24px 28px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
      .sm-head h2{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:32px;color:#3c2f47;letter-spacing:-0.01em;margin:0;line-height:1.05}
      .sm-head h2 em{font-style:italic;color:#a8895a}
      .sm-head .eyebrow{font-size:10.5px;letter-spacing:0.3em;text-transform:uppercase;color:#a8895a;font-weight:500;margin-bottom:6px;display:block}
      .sm-close{flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(60,47,71,0.06);border:0;cursor:pointer;display:grid;place-items:center;transition:all .15s}
      .sm-close:hover{background:#3c2f47;color:#f6f4ef}
      .sm-close svg{width:14px;height:14px;stroke:currentColor}
      .sm-body{padding:0 28px 24px;overflow-y:auto;font-size:14.5px;line-height:1.65;color:#5a4868}
      .sm-body h3{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:20px;color:#3c2f47;margin:18px 0 6px}
      .sm-body p{margin:8px 0}
      .sm-body ul{padding-left:18px;margin:8px 0}
      .sm-body ul li{margin:4px 0}
      .sm-body a{color:#a8895a;text-decoration:underline;text-underline-offset:3px}
      .sm-body a:hover{color:#3c2f47}
      .sm-foot{padding:14px 28px 22px;border-top:1px solid rgba(60,47,71,0.1);display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}

      .sm-contact-row{display:flex;gap:14px;align-items:center;padding:14px 16px;background:#fff;border-radius:12px;margin-bottom:10px;text-decoration:none;color:inherit;transition:transform .2s;border:1px solid rgba(60,47,71,0.08)}
      .sm-contact-row:hover{transform:translateY(-2px);border-color:#a8895a}
      .sm-contact-row .ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;background:#e8e3ed;color:#3c2f47}
      .sm-contact-row.wa .ico{background:#25D366;color:#fff}
      .sm-contact-row .ico svg{width:20px;height:20px}
      .sm-contact-row .l{font-size:10.5px;letter-spacing:0.22em;text-transform:uppercase;color:#5a4868;font-weight:500}
      .sm-contact-row .v{font-family:'Cormorant Garamond',serif;font-size:20px;color:#3c2f47;margin-top:2px}
      .sm-contact-row .arr{margin-left:auto;color:#a8895a}
      .sm-contact-row .arr svg{width:18px;height:18px;stroke:currentColor}

      .sm-social-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
      .sm-social-grid a{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border:1px solid rgba(60,47,71,0.12);border-radius:10px;color:#3c2f47;text-decoration:none;transition:all .2s}
      .sm-social-grid a:hover{background:#3c2f47;color:#f6f4ef;border-color:#3c2f47}
      .sm-social-grid svg{width:22px;height:22px}
      .sm-social-grid .label{font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500}

      .sm-btn{display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:999px;cursor:pointer;border:0;font-size:11.5px;letter-spacing:0.22em;text-transform:uppercase;font-weight:500;text-decoration:none;font-family:inherit;transition:all .2s}
      .sm-btn-primary{background:#3c2f47;color:#f6f4ef}
      .sm-btn-primary:hover{background:#1a1620}
      .sm-btn-wa{background:#25D366;color:#fff}
      .sm-btn-wa:hover{background:#1ebe5a}
      .sm-btn svg{width:14px;height:14px}

      @media (max-width:640px){
        .sm-modal{padding:12px}
        .sm-head{padding:18px 18px 10px}
        .sm-head h2{font-size:26px}
        .sm-body{padding:0 18px 16px;font-size:14px}
        .sm-foot{padding:12px 18px 18px}
        .sm-social-grid{grid-template-columns:repeat(2,1fr)}
      }
    `;
    const s = document.createElement('style');
    s.id = 'sm-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ───── Contenido de los modales ─────
  const MODALS = {
    contacto: {
      title: 'Conversemos por <em>WhatsApp</em>',
      eyebrow: 'Contacto',
      body: () => `
        <p>Estamos pendientes todos los días. Escríbenos para recomendaciones, ofertas del momento o coordinar tu pedido.</p>
        <a class="sm-contact-row wa" href="https://wa.me/${WA}" target="_blank" rel="noopener">
          <span class="ico">${ICONS.whatsapp}</span>
          <span><span class="l">WhatsApp</span><span class="v">+51 930 122 014</span></span>
          <span class="arr">${ICONS.arrow}</span>
        </a>
        <a class="sm-contact-row" href="mailto:${EMAIL}">
          <span class="ico">${ICONS.mail}</span>
          <span><span class="l">Correo</span><span class="v">${EMAIL}</span></span>
          <span class="arr">${ICONS.arrow}</span>
        </a>
        <a class="sm-contact-row" href="Dolce Aroma - Inicio.html#boutique">
          <span class="ico">${ICONS.pin}</span>
          <span><span class="l">Boutique física</span><span class="v">Bazar Sport Shirley · SMP</span></span>
          <span class="arr">${ICONS.arrow}</span>
        </a>
        <h3>Síguenos</h3>
        <div class="sm-social-grid">
          <a href="${SOCIAL.facebook}" target="_blank" rel="noopener">${ICONS.facebook}<span class="label">Facebook</span></a>
          <a href="${SOCIAL.instagram}" target="_blank" rel="noopener">${ICONS.instagram}<span class="label">Instagram</span></a>
          <a href="${SOCIAL.tiktok}" target="_blank" rel="noopener">${ICONS.tiktok}<span class="label">TikTok</span></a>
          <a href="${SOCIAL.mercadolibre}" target="_blank" rel="noopener">${ICONS.mercadolibre}<span class="label">Mercado Libre</span></a>
        </div>
      `
    },

    envios: {
      title: 'Envíos y <em>Delivery</em>',
      eyebrow: 'Política',
      body: () => `
        <p>Realizamos delivery a Lima Norte, Lima Sur y Lima Centro.</p>
        <h3>Cobertura sin costo</h3>
        <p><strong>Delivery gratuito</strong> en Av. Perú (SMP), zonas específicas de San Miguel y áreas próximas al Mercado San Antonio.</p>
        <p>Para otras zonas el costo se cotiza según ubicación — nuestros precios son siempre razonables y por debajo del mercado.</p>
        <h3>Compras grandes</h3>
        <p>En compras mayores a <strong>S/ 150</strong> y de acuerdo a la ubicación aplicamos descuentos en el delivery.</p>
        <h3>Tiempos de entrega</h3>
        <p>Las entregas se realizan previa coordinación y, como máximo, al día siguiente de la confirmación del pedido.</p>
        <h3>Cómo coordinar</h3>
        <p>Escríbenos por WhatsApp al <a href="https://wa.me/${WA}" target="_blank" rel="noopener">+51 930 122 014</a> con tu dirección y te confirmamos el delivery.</p>
      `,
      foot: () => `<a class="sm-btn sm-btn-wa" href="https://wa.me/${WA}" target="_blank" rel="noopener">${ICONS.whatsapp} Coordinar envío</a>`
    },

    terminos: {
      title: '<em>Términos</em> y condiciones',
      eyebrow: 'Legal',
      body: () => `
        <p>Al usar este sitio aceptas las siguientes condiciones:</p>
        <h3>1 · Productos</h3>
        <p>Dolce Aroma comercializa perfumes equivalentes de alta calidad, elaborados con esencias de Grasse, Francia, inspirados en fragancias icónicas. No representamos ni somos distribuidores oficiales de las marcas originales mencionadas a modo de referencia olfativa.</p>
        <h3>2 · Pedidos</h3>
        <p>Los pedidos se confirman vía WhatsApp. La disponibilidad de stock se valida al momento de la coordinación. Los precios están expresados en soles (S/).</p>
        <h3>3 · Devoluciones</h3>
        <p>Por tratarse de productos de higiene personal, no se aceptan devoluciones de frascos abiertos. Si recibes un producto dañado durante el envío, escríbenos en las primeras 24 horas para gestionar el reemplazo.</p>
        <h3>4 · Imágenes</h3>
        <p>Las fotos son referenciales. El envasado puede variar ligeramente.</p>
        <h3>5 · Propiedad intelectual</h3>
        <p>El contenido del sitio (diseño, textos, fotografías propias) es propiedad de Dolce Aroma. Las marcas mencionadas pertenecen a sus respectivos titulares.</p>
      `
    },

    privacidad: {
      title: 'Política de <em>Privacidad</em>',
      eyebrow: 'Legal',
      body: () => `
        <p>Tu privacidad nos importa. Esto es lo que recopilamos y cómo lo usamos:</p>
        <h3>Datos que recopilamos</h3>
        <ul>
          <li>Nombre, número de contacto y dirección de entrega — solo cuando concretas un pedido por WhatsApp.</li>
          <li>Datos anónimos de navegación (Google Analytics) — visitas, páginas vistas, dispositivo.</li>
        </ul>
        <h3>Para qué los usamos</h3>
        <ul>
          <li>Procesar y entregar tu pedido.</li>
          <li>Mejorar el sitio y entender qué fragancias buscan los visitantes.</li>
          <li>Enviarte ofertas (solo si tú nos lo pides).</li>
        </ul>
        <h3>Lo que NO hacemos</h3>
        <ul>
          <li>No vendemos tus datos a terceros.</li>
          <li>No te enviamos spam.</li>
        </ul>
        <h3>Tus derechos</h3>
        <p>Puedes pedirnos eliminar tus datos en cualquier momento escribiendo a <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
      `
    },

    cookies: {
      title: 'Política de <em>Cookies</em>',
      eyebrow: 'Legal',
      body: () => `
        <p>Este sitio usa cookies estrictamente para que funcione mejor.</p>
        <h3>Cookies técnicas</h3>
        <p>Guardan tu bolsa de compras y tus preferencias mientras navegas. No incluyen datos personales.</p>
        <h3>Cookies de análisis</h3>
        <p>Usamos <strong>Google Analytics</strong> para entender qué páginas visitan más y mejorar el sitio. Los datos son anónimos y agregados.</p>
        <h3>Cómo desactivarlas</h3>
        <p>Puedes desactivar las cookies desde la configuración de tu navegador. Algunas funciones (como guardar la bolsa al recargar) pueden no funcionar correctamente.</p>
      `
    },

    'boutique-info': {
      title: 'Bazar Sport <em>Shirley</em>',
      eyebrow: 'Punto de venta',
      body: () => `
        <p>Nuestro punto de venta físico, dentro del Mercado San Antonio, cerca de Av. Perú (SMP). Encontrarás una selección de nuestros más vendidos para hombre y mujer.</p>
        <h3>Cómo llegar</h3>
        <p>Mercado San Antonio · Cerca de Av. Perú · San Martín de Porres, Lima.</p>
        <p>Pregunta por <strong>Tienda Bazar Sport Shirley</strong>.</p>
        <h3>Coordina tu visita</h3>
        <p>Si buscas un perfume específico, escríbenos por WhatsApp antes de venir para asegurarnos de tenerlo en stock.</p>
      `,
      foot: () => `<a class="sm-btn sm-btn-wa" href="https://wa.me/${WA}?text=${encodeURIComponent('Hola, quisiera coordinar una visita a la boutique.')}" target="_blank" rel="noopener">${ICONS.whatsapp} Coordinar visita</a>`
    }
  };

  // ───── Inyectar contenedores ─────
  function injectChrome(){
    if(document.getElementById('sm-bd')) return;
    const waMsg = encodeURIComponent('Hola, tengo una consulta sobre perfumes');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="sm-bd" id="sm-bd"></div>
      <div class="sm-modal" id="sm-modal"><div class="sm-card" id="sm-card"></div></div>
      <a class="sm-wa-float" href="https://wa.me/${WA}?text=${waMsg}" target="_blank" rel="noopener" aria-label="Consulta con un asesor por WhatsApp">
        <span class="sm-wa-label">Consulta con un asesor</span>
        <span class="sm-wa-icon">${ICONS.whatsapp}</span>
      </a>
    `);
    document.getElementById('sm-bd').addEventListener('click', close);
    document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
  }

  function open(id){
    const m = MODALS[id];
    if(!m) return console.warn('SiteModals: id desconocido', id);
    const card = document.getElementById('sm-card');
    card.classList.toggle('wide', !!m.wide);
    const foot = m.foot ? `<div class="sm-foot">${m.foot()}</div>` : '';
    card.innerHTML = `
      <div class="sm-head">
        <div>
          <span class="eyebrow">${m.eyebrow}</span>
          <h2>${m.title}</h2>
        </div>
        <button class="sm-close" id="sm-close-btn" aria-label="Cerrar">${ICONS.close}</button>
      </div>
      <div class="sm-body">${m.body()}</div>
      ${foot}
    `;
    document.getElementById('sm-close-btn').addEventListener('click', close);
    // sub-modales (e.g. desde Contacto → Boutique)
    card.querySelectorAll('[data-modal]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      open(a.dataset.modal);
    }));
    document.getElementById('sm-bd').classList.add('open');
    document.getElementById('sm-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    document.getElementById('sm-modal')?.classList.remove('open');
    document.getElementById('sm-bd')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function wireLinks(){
    document.body.addEventListener('click', e => {
      const t = e.target.closest('[data-modal]');
      if(!t) return;
      e.preventDefault();
      open(t.dataset.modal);
    });
  }

  function boot(){
    injectCSS();
    injectChrome();
    wireLinks();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SiteModals = { open, close, WA, EMAIL, SOCIAL, ICONS };
})();
