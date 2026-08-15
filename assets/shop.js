/* ───────────────────────────────────────────────────────────
   Dolce Aroma · tienda compartida
   - Carga de catálogo (data/productos.json con fallback a perfumes.json y localStorage del admin)
   - Modal "Ver detalle" con selector de tamaño
   - Carrito persistente (localStorage) + checkout por WhatsApp
   Funciones expuestas en window.DA:
     DA.init(opts)         → arranca tras DOMContentLoaded
     DA.openDetail(id)     → abre el modal de un perfume
     DA.addToCart(item)    → agrega {id, ml, qty}
     DA.openCart()         → abre el panel
   ─────────────────────────────────────────────────────────── */
(function(){
  const WHATSAPP_NUMBER = '51930122014'; // +51 930 122 014
  const EMAIL = 'Dolce7aroma@gmail.com';
  const ORDER_API_BASE = 'https://dolce7aroma-github-io.cesarfernandezh7.workers.dev';
  const GIFT_EXPIRY_DAYS = 15; // debe coincidir con GIFT_EXPIRY_DAYS en el Worker
  const GIFT_SIZES = [50, 110]; // solo se regalan estos tamaños (no 10 ml)
  // Clasificación de marcas para el filtro "árabe / diseñador" del armador de regalo.
  // Confirmado con el dueño: Afnan y Lattafa son casas árabes reconocidas; Bharara y Kayali
  // (marcas con estética/perfil árabe aunque de origen estadounidense) también se marcan como
  // árabe. Todo lo demás (incluye nicho: Creed, Initio, Kilian, Maison Francis Kurkdjian,
  // Xerjoff) cae en "diseñador".
  const ARABE_BRANDS = new Set(['Afnan', 'Lattafa', 'Bharara', 'Kayali']);
  function giftEstiloFor(p){ return ARABE_BRANDS.has(p.inspiration) ? 'arabe' : 'disenador'; }
  const STORAGE_CATALOG = 'dolce-aroma-perfumes-v1'; // (compat: edits del admin)
  const STORAGE_CART    = 'dolce-aroma-cart-v1';
  const CATALOG_URLS    = ['data/productos.json', 'data/perfumes.json'];
  const ZONAS_URL       = 'data/zonas-envio.json';
  const PAGO_URL        = 'data/pago.json';

  const FAMILY_LABEL = {floral:'Floral', oriental:'Oriental', amaderado:'Amaderado', citrico:'Cítrico', chipre:'Chipre', aromatico:'Aromático', frutal:'Frutal'};
  const TAG_LABEL    = {'mas-vendido':'Más vendido','nuevo':'Nuevo','edicion-limitada':'Edición limitada','agotado':'Agotado'};
  const GENDER_LABEL = {mujer:'Mujer', hombre:'Hombre', unisex:'Unisex'};
  const ICON_SHARE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>`;
  const ICON_EXPAND = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>`;
  const ICON_COLLAPSE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/></svg>`;

  // Lima Metropolitana + Callao — para el autocompletado de distrito en el formulario de pedido
  const LIMA_DISTRITOS = [
    'Ancón','Ate','Barranco','Breña','Carabayllo','Chaclacayo','Chorrillos','Cieneguilla','Comas',
    'El Agustino','Independencia','Jesús María','La Molina','La Victoria','Lima (Cercado)','Lince',
    'Los Olivos','Lurigancho (Chosica)','Lurín','Magdalena del Mar','Miraflores','Pachacámac','Pucusana',
    'Pueblo Libre','Puente Piedra','Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja',
    'San Isidro','San Juan de Lurigancho','San Juan de Miraflores','San Luis','San Martín de Porres',
    'San Miguel','Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo',
    'Villa El Salvador','Villa María del Triunfo',
    'Callao (Cercado)','Bellavista','Carmen de la Legua Reynoso','La Perla','La Punta','Mi Perú','Ventanilla'
  ];
  function normText(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
  function findZonaMatch(distrito){
    if(!distrito) return null;
    const n = normText(distrito);
    return (zonas.zonasGratis||[]).find(z => z.distrito && normText(z.distrito) === n) || null;
  }

  let catalog = [];
  let cart = [];   // [{id, ml, qty}]
  let zonas = { envioGratisMinimo: 150, zonasGratis: [], notaOtrasZonas: '', mensajeEstandarGratis: '¡Felicidades, tu zona tiene envío gratis!' };
  let pago = { nombreYape: 'Cesar Fernandez', culqiPublicKey: '' };
  let checkoutStep = 'cart'; // 'cart' | 'form' | 'confirm'
  let lastOrder = null; // datos del último pedido confirmado (para el paso de pago)
  let orderForm = { nombre:'', telefono:'', distrito:'', direccion:'', referencia:'' };

  // ─── Regalar un perfume ───
  let giftMode = false;             // true = el panel de la derecha muestra el armador de regalo
  let giftStep = 'armar';           // 'armar' | 'detalles' | 'compartir' | 'pagar'
  let giftList = [];                // [{id, ml, name, price, premium}] — lista curada del comprador
  let giftDraft = { entregaPara: 'regalada', compradorTelefono: '', compradorNombre: '',
    nombre:'', telefono:'', distrito:'', direccion:'', referencia:'' };
  let currentGift = null;           // el regalo cargado vía ?regalo= o ?pagar_regalo=
  let giftClaimStep = 'elegir';     // 'elegir' | 'gracias' (vista de la persona regalada)
  let giftClaimChoice = null;       // índice elegido por la persona regalada

  // ─── Zonas de envío (editable desde el Admin) ───
  async function loadZonas(){
    try{
      const r = await fetch(ZONAS_URL, {cache:'no-cache'});
      if(r.ok){
        const j = await r.json();
        zonas = Object.assign({ envioGratisMinimo:150, zonasGratis:[], notaOtrasZonas:'', mensajeEstandarGratis:'¡Felicidades, tu zona tiene envío gratis!' }, j);
      }
    }catch(e){ /* se mantienen los valores por defecto */ }
  }
  async function loadPago(){
    try{
      const r = await fetch(PAGO_URL, {cache:'no-cache'});
      if(r.ok){
        const j = await r.json();
        pago = Object.assign({ nombreYape:'Cesar Fernandez', culqiPublicKey:'' }, j);
      }
    }catch(e){ /* se mantiene el valor por defecto */ }
  }

  // ─── Carga catálogo ───
  async function loadCatalog(){
    // Prioridad: edits locales del admin → productos.json → perfumes.json
    try{
      const raw = localStorage.getItem(STORAGE_CATALOG);
      if(raw){ const d = JSON.parse(raw); if(Array.isArray(d.perfumes) && d.perfumes.length){ catalog = d.perfumes.filter(p => p.activo !== false); return; } }
    }catch(e){}
    for(const u of CATALOG_URLS){
      try{
        const r = await fetch(u, {cache:'no-cache'});
        if(!r.ok) continue;
        const j = await r.json();
        if(Array.isArray(j.perfumes) && j.perfumes.length){ catalog = j.perfumes.filter(p => p.activo !== false); return; }
      }catch(e){ /* siguiente */ }
    }
    catalog = [];
  }

  // ─── Carrito ───
  function loadCart(){ try{ cart = JSON.parse(localStorage.getItem(STORAGE_CART) || '[]'); }catch(e){ cart = []; } }
  function saveCart(){ localStorage.setItem(STORAGE_CART, JSON.stringify(cart)); refreshBadges(); }
  function cartCount(){ return cart.reduce((s,i)=>s+i.qty,0); }
  function cartSubtotal(){
    return cart.reduce((s,i)=>{
      const p = catalog.find(x=>x.id===i.id);
      const sz = p?.sizes?.find(x=>x.ml===i.ml);
      return s + (sz?.price||0) * i.qty;
    }, 0);
  }
  // ─ Ofertas de trío y dúo ─
  // Varios frascos de la misma presentación → descuento
  //   110 ml: trío -50% sobre el más barato (Trío Premium) · dúo -S/ 30 plano (Dúo Premium)
  //   50 ml : trío -S/ 15 plano (Trío Esencial) · dúo -S/ 10 plano (Dúo Esencial)
  //   10 ml : trío -S/ 10 plano (Trío Pocket) · sin oferta de dúo
  const TRIO_TIERS = {
    110: { label: 'Trío Premium · 110 ml', perTrio: (cheapest) => Math.round(cheapest * 0.5) },
    50:  { label: 'Trío Esencial · 50 ml',  perTrio: () => 15 },
    10:  { label: 'Trío Pocket · 10 ml',    perTrio: () => 10 }
  };
  const DUO_TIERS = {
    110: { label: 'Dúo Premium · 110 ml', amount: 30 },
    50:  { label: 'Dúo Esencial · 50 ml',  amount: 10 }
  };
  // extra: {ml, price} → simula 1 unidad más de ese ml (para proyectar "si sumo 1 más, ¿cuánto ahorro/pago?")
  function computeOffers(extra){
    const groups = {}; // ml -> [unit price, ...]
    cart.forEach(it => {
      const p = catalog.find(x => x.id === it.id);
      const sz = p?.sizes?.find(s => s.ml === it.ml);
      if(!sz) return;
      groups[it.ml] = groups[it.ml] || [];
      for(let i=0;i<it.qty;i++) groups[it.ml].push(sz.price||0);
    });
    if(extra && extra.ml){
      groups[extra.ml] = groups[extra.ml] || [];
      groups[extra.ml].push(extra.price||0);
    }
    const subtotal = Object.values(groups).reduce((s,arr)=> s + arr.reduce((a,b)=>a+b,0), 0);
    const discounts = [];
    const progress = []; // tiers donde aún no se completa la oferta, o donde conviene sumar una más
    Object.entries(groups).forEach(([mlStr, prices]) => {
      const ml = +mlStr;
      const trioTier = TRIO_TIERS[ml];
      const duoTier = DUO_TIERS[ml];
      const sorted = prices.slice().sort((a,b)=>a-b);
      const n = sorted.length;

      let trios = trioTier ? Math.floor(n / 3) : 0;
      let resto = n - trios * 3;
      // Si sobra justo 1 y hay oferta de dúo, soltamos un trío para armar 2 dúos y cubrir más unidades
      if(resto === 1 && trios > 0 && duoTier){ trios -= 1; resto += 3; }
      const duos = duoTier ? Math.floor(resto / 2) : 0;

      let idx = 0, trioAmount = 0, duoAmount = 0;
      for(let t=0;t<trios;t++){ trioAmount += trioTier.perTrio(sorted[idx]); idx += 3; }
      for(let d=0;d<duos;d++){ duoAmount += duoTier.amount; idx += 2; }
      if(trioAmount > 0) discounts.push({ ml, label: trioTier.label, amount: trioAmount, count: trios, kind: 'trio' });
      if(duoAmount > 0) discounts.push({ ml, label: duoTier.label, amount: duoAmount, count: duos, kind: 'duo' });

      const leftover = n - idx;
      if(idx === 0 && leftover > 0 && leftover < 3){
        // nada tiene descuento todavía: falta para el próximo escalón
        if(duoTier) progress.push({ ml, kind: 'duo', label: duoTier.label, missing: 1, amount: duoTier.amount, total: duoTier.amount });
        else if(trioTier){ const amt = trioTier.perTrio(sorted[0]); progress.push({ ml, kind: 'trio', label: trioTier.label, missing: 3 - leftover, amount: amt, total: amt }); }
      } else if(leftover === 1 && idx > 0 && trioTier && !duoTier){
        // quedó 1 unidad suelta tras un trío (solo aplica a tamaños sin dúo, ej. 10 ml)
        const amt = trioTier.perTrio(sorted[n-1]);
        progress.push({ ml, kind: 'trio', label: trioTier.label, missing: 2, amount: amt, total: amt });
      } else if(leftover === 0 && duos === 1 && trios === 0 && trioTier){
        // ya tiene un dúo activo: solo sugerimos subir a trío si de verdad el TOTAL del trío es mayor
        const potentialTrio = trioTier.perTrio(sorted[0]);
        if(potentialTrio > duoAmount){
          // "amount" = lo que ya ahorra hoy con el dúo, "total" = a cuánto sube el ahorro total con el trío
          progress.push({ ml, kind: 'upgrade', label: trioTier.label, missing: 1, amount: duoAmount, total: potentialTrio });
        }
      }
    });
    const totalDiscount = discounts.reduce((a,b)=>a+b.amount, 0);
    return { subtotal, discounts, progress, total: subtotal - totalDiscount, totalDiscount };
  }
  function cartTotal(){ return computeOffers().total; }
  // Precio más bajo disponible del catálogo para un tamaño dado — para estimar "si sumo 1 más de X ml"
  function cheapestPriceForMl(ml){
    let min = null;
    catalog.forEach(p=>{
      const sz = p.sizes?.find(s=>s.ml===ml && s.stock>0 && s.price);
      if(sz && (min===null || sz.price<min)) min = sz.price;
    });
    return min || 0;
  }
  function addToCart(item){
    const ex = cart.find(c=>c.id===item.id && c.ml===item.ml);
    if(ex) ex.qty += item.qty || 1;
    else cart.push({id:item.id, ml:item.ml, qty:item.qty||1});
    saveCart();
    bumpCount();
    showToast(buildAddToast(item.ml));
    const ga4Item = formatGA4Item(item, item.qty || 1);
    trackGA4Event('add_to_cart', { currency: 'PEN', value: ga4Item.price * ga4Item.quantity, items: [ga4Item] });
  }
  // Mensaje del toast: induce a completar la oferta o celebra que ya está activa
  function buildAddToast(ml){
    const offers = computeOffers();
    const hint = offers.progress.find(p => p.ml === ml);
    if(hint){
      if(hint.kind === 'upgrade') return `Agregado · Sumá 1 más de ${ml} ml y tu ahorro sube a S/ ${hint.total}`;
      return `Agregado · Sumá ${hint.missing} más de ${ml} ml y ahorra S/ ${hint.total}`;
    }
    const applied = offers.discounts.find(d => d.ml === ml);
    if(applied) return `Agregado · ¡${applied.label} activo! Ahorras S/ ${applied.amount}`;
    return 'Agregado a la bolsa';
  }
  function removeFromCart(id, ml){ 
    const itemToRemove = cart.find(c => c.id===id && c.ml===ml);
    if (itemToRemove) {
      const ga4Item = formatGA4Item({id, ml}, itemToRemove.qty);
      trackGA4Event('remove_from_cart', { currency: 'PEN', value: ga4Item.price * ga4Item.quantity, items: [ga4Item] });
    }
    cart = cart.filter(c => !(c.id===id && c.ml===ml)); 
    saveCart(); 
    renderCart(); 
  }
  function changeQty(id, ml, d){
    const it = cart.find(c=>c.id===id && c.ml===ml);
    if(!it) return;
    it.qty = Math.max(0, it.qty + d);
    cart = cart.filter(c=>c.qty>0);
    saveCart(); renderCart();
  }

  function refreshBadges(){
    const n = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = n; });
  }
  function bumpCount(){
    document.querySelectorAll('[data-cart-count]').forEach(el=>{
      el.animate([{transform:'scale(1)'},{transform:'scale(1.4)'},{transform:'scale(1)'}],{duration:380,easing:'cubic-bezier(.2,.7,.2,1)'});
    });
  }

  // ─── Analytics (GA4) ───
  function trackGA4Event(eventName, eventParams) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, eventParams);
  }
  function formatGA4Item(item, qty = 1) {
    const p = catalog.find(x => x.id === item.id);
    const sz = p?.sizes?.find(s => s.ml === item.ml);
    return {
      item_id: p ? p.id : item.id,
      item_name: p ? p.name : 'Unknown',
      affiliation: 'Dolce Aroma',
      item_brand: p ? (p.inspiration || 'Dolce Aroma') : '',
      item_category: p ? (p.gender || '') : '',
      price: sz ? (sz.price || 0) : 0,
      quantity: qty,
      item_variant: item.ml + 'ml'
    };
  }

  // ─── UI: estilos inyectados ───
  function injectCSS(){
    if(document.getElementById('da-shop-style')) return;
    const css = `
      .da-bd{position:fixed;inset:0;background:rgba(40,30,55,0.5);backdrop-filter:blur(4px);z-index:90;opacity:0;pointer-events:none;transition:opacity .25s}
      .da-bd.open{opacity:1;pointer-events:auto}
      .da-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:100;padding:24px;pointer-events:none;visibility:hidden}
      .da-modal.open{visibility:visible}
      .da-modal-card{background:#f6f4ef;border-radius:18px;max-width:1020px;width:100%;max-height:calc(100vh - 48px);overflow:hidden;display:grid;grid-template-columns:1fr 1.05fr;box-shadow:0 40px 100px -30px rgba(0,0,0,0.4);transform:scale(.96) translateY(10px);opacity:0;transition:all .3s cubic-bezier(.2,.7,.2,1);pointer-events:none}
      .da-modal.open .da-modal-card{transform:scale(1) translateY(0);opacity:1;pointer-events:auto}
      .da-modal-photo{background:linear-gradient(135deg,#dcd4e0,#bcb0c8);position:relative;display:flex;align-items:center;justify-content:center;min-height:420px;overflow:hidden}
      .da-modal-photo img{width:78%;max-height:78%;object-fit:contain;filter:drop-shadow(0 30px 30px rgba(0,0,0,0.25))}
      .da-modal-photo .badges{position:absolute;top:18px;left:18px;display:flex;gap:6px;flex-wrap:wrap}
      .da-modal-photo .badge{background:#f6f4ef;color:#3c2f47;padding:5px 10px;border-radius:999px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-weight:500}
      .da-modal-body{padding:38px 40px 28px;overflow-y:auto;display:flex;flex-direction:column;gap:18px}
      .da-modal-body .insp{font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#a8895a;font-weight:500;margin-bottom:8px}
      .da-modal-body h2{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:42px;color:#3c2f47;letter-spacing:-0.01em;line-height:1;margin:0}
      .da-modal-body .sub{font-size:13px;color:#5d4c70;display:flex;gap:18px;flex-wrap:wrap;margin-top:4px}
      .da-modal-body .sub span{display:flex;gap:6px;align-items:center}
      .da-modal-body .sub .d{width:6px;height:6px;border-radius:50%;background:#a8895a;display:inline-block}
      .da-modal-body .desc{font-size:14px;color:#5d4c70;line-height:1.7}
      .da-pyramid{display:flex;flex-direction:column;gap:10px;background:#efe9e0;border-radius:12px;padding:18px}
      .da-pyramid h4{font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#3c2f47;font-weight:500;margin:0}
      .da-pyramid .row{display:grid;grid-template-columns:90px 1fr;gap:14px;align-items:start}
      .da-pyramid .row .l{font-family:'Cormorant Garamond',serif;font-style:italic;color:#a8895a;font-size:16px;padding-top:2px}
      .da-pyramid .row .n{font-size:13px;color:#3c2f47;line-height:1.55}
      .da-sizes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:4px}
      .da-size{border:1.5px solid rgba(60,47,71,0.15);background:#fff;border-radius:12px;padding:14px 12px;cursor:pointer;text-align:center;transition:all .2s}
      .da-size:hover{border-color:#a8895a}
      .da-size.active{border-color:#3c2f47;background:#3c2f47;color:#f6f4ef}
      .da-size .ml{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:500}
      .da-size .px{font-size:13px;opacity:.85}
      .da-size.out{opacity:.35;pointer-events:none}
      .da-size.out::after{content:" · agotado";font-size:10px;letter-spacing:0.2em;text-transform:uppercase}
      .da-qty{display:flex;align-items:center;gap:12px;margin-top:8px}
      .da-qty span{font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#5d4c70}
      .da-qty .stp{display:flex;align-items:center;background:#fff;border:1px solid rgba(60,47,71,0.15);border-radius:999px;overflow:hidden}
      .da-qty .stp button{border:0;background:transparent;width:36px;height:36px;font-size:18px;color:#3c2f47;cursor:pointer}
      .da-qty .stp input{border:0;width:46px;text-align:center;font-family:'Cormorant Garamond',serif;font-size:20px;background:transparent;color:#3c2f47}
      .da-cta-row{display:flex;gap:10px;margin-top:auto;padding-top:14px}
      .da-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:16px 22px;border-radius:999px;cursor:pointer;border:0;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;font-weight:500;transition:all .25s;font-family:inherit}
      .da-btn-primary{background:#3c2f47;color:#f6f4ef;flex:1}
      .da-btn-primary:hover{background:#2a2033}
      .da-btn-wa{background:#25D366;color:#fff}
      .da-btn-wa:hover{background:#1ebe5a}
      .da-btn-ghost{background:transparent;color:#3c2f47;border:1px solid rgba(60,47,71,0.2)}
      .da-share-top{
        flex:0 0 auto;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;
        background:#fff;border:1.5px solid rgba(60,47,71,0.15);color:#3c2f47;cursor:pointer;transition:all .2s;
      }
      .da-share-top:hover{border-color:#a8895a;color:#a8895a}
      .da-close{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;background:#f6f4ef;border:0;cursor:pointer;display:grid;place-items:center;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,0.15)}
      .da-close svg{width:16px;height:16px;stroke:#3c2f47;fill:none;stroke-width:1.8}

      .da-cart{position:fixed;top:0;right:0;width:440px;max-width:100vw;height:100vh;background:#f6f4ef;z-index:100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s cubic-bezier(.2,.7,.2,1), width .3s cubic-bezier(.2,.7,.2,1);box-shadow:-30px 0 80px -20px rgba(0,0,0,0.3)}
      .da-cart.open{transform:translateX(0)}
      .da-cart.expanded{width:760px}
      .da-cart-expand{background:transparent}
      .da-cart-expand.active{color:#a8895a}
      .da-cart-head{padding:24px 26px;border-bottom:1px solid rgba(60,47,71,0.1);display:flex;justify-content:space-between;align-items:center}
      .da-cart-head h3{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:28px;color:#3c2f47;margin:0}
      .da-cart-list{flex:1;overflow-y:auto;padding:18px 26px;display:flex;flex-direction:column;gap:14px}
      .da-cart-empty{text-align:center;padding:60px 20px 40px;color:#5d4c70}
      .da-cart-empty .icon{font-size:40px;margin-bottom:14px}
      .da-cart-empty h4{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:22px;color:#3c2f47;margin:0 0 8px}
      .da-empty-links{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:26px}
      .da-empty-chip{
        display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;
        border:1.5px solid rgba(60,47,71,0.18);color:#3c2f47;font-size:11px;letter-spacing:0.14em;
        text-transform:uppercase;text-decoration:none;transition:all .2s;background:#fff;
      }
      .da-empty-chip:hover{border-color:#a8895a;background:#f6e9d8;color:#3c2f47}
      .da-empty-chip.gold{background:#a8895a;border-color:#a8895a;color:#f6f4ef}
      .da-empty-chip.gold:hover{background:#8f7449}
      .da-cart-item{display:grid;grid-template-columns:72px 1fr auto;gap:14px;align-items:center;background:#fff;border-radius:12px;padding:12px}
      .da-cart-item img{width:72px;height:72px;border-radius:8px;object-fit:cover;background:#dcd4e0}
      .da-cart-item .n{font-family:'Cormorant Garamond',serif;font-size:18px;color:#3c2f47;line-height:1.1}
      .da-cart-item .m{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5d4c70;margin-top:3px}
      .da-cart-item .q{display:flex;align-items:center;gap:8px;margin-top:8px}
      .da-cart-item .q button{width:26px;height:26px;border-radius:50%;border:1px solid rgba(60,47,71,0.15);background:transparent;cursor:pointer;color:#3c2f47;font-size:14px}
      .da-cart-item .q span{font-size:13px;min-width:18px;text-align:center}
      .da-cart-item .price{font-family:'Cormorant Garamond',serif;font-size:18px;color:#3c2f47;text-align:right}
      .da-cart-item .rm{display:block;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#a8895a;background:transparent;border:0;cursor:pointer;margin-top:6px}
      .da-cart-foot{padding:20px 26px 26px;border-top:1px solid rgba(60,47,71,0.1);background:#efe9e0}
      .da-cart-total{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
      .da-cart-total span{font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#5d4c70}
      .da-cart-total b{font-family:'Cormorant Garamond',serif;font-size:36px;color:#3c2f47;font-weight:500}

      .da-totals{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
      .da-line{display:flex;justify-content:space-between;align-items:baseline;gap:14px}
      .da-line span{font-size:11.5px;letter-spacing:0.22em;text-transform:uppercase;color:#5d4c70}
      .da-line b{font-family:'Cormorant Garamond',serif;font-size:20px;color:#3c2f47;font-weight:500}
      .da-line-dis span{color:#a8895a;font-weight:500}
      .da-line-dis b{color:#a8895a}
      .da-line-total{padding-top:10px;border-top:1px dashed rgba(60,47,71,0.18);margin-top:4px}
      .da-line-total span{color:#3c2f47;font-weight:500}
      .da-line-total b{font-size:34px}
      .da-trio-hint{
        background:linear-gradient(135deg, rgba(168,137,90,0.22), rgba(207,200,216,0.28));
        border:1.5px solid #a8895a;border-radius:12px;padding:14px 16px;margin-bottom:14px;
        display:flex;flex-direction:column;gap:8px;
        box-shadow:0 6px 20px -8px rgba(168,137,90,0.5);
        animation:da-hint-in .35s cubic-bezier(.2,.7,.2,1);
      }
      @keyframes da-hint-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      .da-trio-note{font-size:11px;color:#3c2f47;line-height:1.5;padding-bottom:8px;border-bottom:1px dashed rgba(168,137,90,0.45)}
      .da-trio-row{display:flex;flex-direction:column;gap:3px}
      .da-trio-row .l{font-size:10.5px;letter-spacing:0.14em;text-transform:uppercase;color:#3c2f47;font-weight:600}
      .da-trio-row .r{font-size:12.5px;color:#5d4c70;line-height:1.4}
      .da-trio-row .r b{font-family:'Cormorant Garamond',serif;font-size:19px;color:#a8895a;font-weight:600;white-space:nowrap}
      .da-keep-shopping{display:block;width:100%;margin-bottom:10px}
      .da-wa-fallback{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:#5d4c70}
      .da-wa-fallback .sep{opacity:.5}
      .da-wa-fallback button{background:none;border:0;padding:0;color:#a8895a;text-decoration:underline;cursor:pointer;font-size:11px;font-family:inherit}
      .da-wa-fallback button:hover{color:#8f7449}

      .da-checkout-head{display:flex;flex-direction:column;gap:10px;margin-bottom:6px}
      .da-back{align-self:flex-start;background:none;border:0;padding:0;color:#a8895a;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer}
      .da-back:hover{color:#8f7449}
      .da-checkout-head h4{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:24px;color:#3c2f47;margin:0}
      .da-order-form{display:flex;flex-direction:column;gap:14px}
      .da-order-form label{display:flex;flex-direction:column;gap:6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5d4c70}
      .da-order-form input{border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;padding:12px 14px;font-size:14px;font-family:inherit;color:#3c2f47;background:#fff}
      .da-order-form input:focus{outline:none;border-color:#a8895a}
      .da-zonas-info{background:#efe9e0;border-radius:12px;padding:14px 16px;font-size:12.5px;color:#5d4c70;line-height:1.6}
      .da-zonas-info .da-zonas-title{font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#3c2f47;font-weight:600;margin-bottom:6px}
      .da-zonas-info .da-zonas-match{color:#3c8f5a}
      .da-zonas-info ul{margin:0 0 8px;padding-left:18px}
      .da-zonas-info p{margin:0;font-style:italic}
      .da-distrito-field{position:relative}
      .da-autocomplete{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;overflow:hidden;z-index:5;box-shadow:0 14px 30px -10px rgba(0,0,0,0.25);max-height:220px;overflow-y:auto}
      .da-autocomplete.open{display:block}
      .da-ac-item{display:block;width:100%;text-align:left;background:#fff;border:0;border-bottom:1px solid rgba(60,47,71,0.08);padding:10px 14px;font-size:13px;color:#3c2f47;cursor:pointer;font-family:inherit;text-transform:none;letter-spacing:normal}
      .da-ac-item:last-child{border-bottom:0}
      .da-ac-item:hover{background:#f6e9d8}
      .da-hint-back{background:none;border:0;padding:0;color:#a8895a;text-decoration:underline;cursor:pointer;font-size:12.5px;font-family:inherit;margin-top:6px;display:inline-block}
      .da-hint-headline{font-family:'Cormorant Garamond',serif;font-size:22px;color:#3c2f47;font-weight:500;margin-bottom:4px;line-height:1.25}
      .da-hint-headline b{font-size:28px;color:#a8895a;font-weight:600}
      .da-confirm-id{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#a8895a;font-weight:600;margin-top:-6px}

      .da-gift-float{
        position:fixed;right:20px;bottom:86px;z-index:80;
        display:flex;align-items:center;gap:10px;text-decoration:none;
      }
      .da-gift-float .da-gift-float-label{
        background:#fff;color:#1a1620;font-size:13px;font-weight:600;font-family:'Jost',sans-serif;
        padding:10px 16px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,0.18);white-space:nowrap;
      }
      .da-gift-float .da-gift-float-icon{
        width:54px;height:54px;border-radius:50%;background:#a8895a;flex-shrink:0;
        display:grid;place-items:center;box-shadow:0 8px 24px rgba(168,137,90,0.5);transition:transform .2s;font-size:24px;
      }
      .da-gift-float:hover .da-gift-float-icon{transform:scale(1.06)}
      @media (max-width:480px){
        .da-gift-float{right:14px;bottom:76px}
        .da-gift-float .da-gift-float-label{font-size:12px;padding:8px 12px}
        .da-gift-float .da-gift-float-icon{width:48px;height:48px;font-size:20px}
      }
      .da-gift-banner{background:linear-gradient(135deg, rgba(168,137,90,0.18), rgba(207,200,216,0.28));border:1.5px solid #a8895a;border-radius:12px;padding:14px 16px;margin-bottom:16px;font-size:13px;color:#3c2f47}
      .da-gift-banner b{color:#a8895a}
      .da-gift-item{background:#fff;border:1.5px solid rgba(60,47,71,0.15);border-radius:12px;padding:12px 14px;margin-bottom:10px}
      .da-gift-item.selected{border-color:#3c2f47}
      .da-gift-item-top{display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:10px}
      .da-gift-item-top input[type=checkbox]{width:18px;height:18px;accent-color:#a8895a;flex:0 0 auto}
      .da-gift-item img{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#dcd4e0;flex:0 0 auto}
      .da-gift-item .n{font-family:'Cormorant Garamond',serif;font-size:17px;color:#3c2f47;line-height:1.1;flex:1}
      .da-gift-item .m{font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#5d4c70}
      .da-gift-item .px{font-size:12.5px;color:#a8895a;font-weight:600;white-space:nowrap}
      .da-gift-sizes{display:flex;flex-wrap:wrap;gap:8px}
      .da-gift-size-chip{border:1.5px solid rgba(60,47,71,0.2);background:#fff;border-radius:999px;padding:8px 14px;font-family:inherit;font-size:12px;color:#3c2f47;cursor:pointer;transition:all .15s;white-space:nowrap}
      .da-gift-size-chip:hover{border-color:#3c2f47}
      .da-gift-size-chip.selected{border-color:#3c2f47;background:#3c2f47;color:#f6f4ef}
      .da-gift-modo-card{display:block;width:100%;text-align:left;background:#fff;border:1.5px solid rgba(60,47,71,0.15);border-radius:12px;padding:16px;cursor:pointer;font-family:inherit;transition:all .15s;margin-bottom:10px}
      .da-gift-modo-card:hover{border-color:#a8895a}
      .da-gift-modo-card.selected{border-color:#3c2f47;background:#efe9e0}
      .da-gift-modo-card b{display:block;font-family:'Cormorant Garamond',serif;font-size:18px;color:#3c2f47;margin-bottom:4px}
      .da-gift-modo-card span{display:block;font-size:12.5px;color:#5d4c70;line-height:1.4}
      .da-gift-premium{margin-left:0;margin-top:8px;font-size:12.5px;color:#3c2f47;display:flex;align-items:center;gap:8px}
      .da-gift-premium input[type=checkbox]{accent-color:#a8895a}
      .da-gift-radio{display:grid;grid-template-columns:56px 1fr auto;gap:12px;align-items:center;background:#fff;border:1.5px solid rgba(60,47,71,0.15);border-radius:12px;padding:12px;margin-bottom:10px;cursor:pointer}
      .da-gift-radio.selected{border-color:#3c2f47;background:#e8e3ed}
      .da-gift-radio img{width:52px;height:52px;border-radius:8px;object-fit:cover;background:#dcd4e0}
      .da-gift-radio .n{font-family:'Cormorant Garamond',serif;font-size:18px;color:#3c2f47;line-height:1.1}
      .da-gift-radio .m{font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:#5d4c70}
      .da-radio-dot{width:20px;height:20px;border-radius:50%;border:2px solid rgba(60,47,71,0.2);display:grid;place-items:center}
      .da-gift-radio.selected .da-radio-dot{border-color:#3c2f47}
      .da-gift-radio.selected .da-radio-dot::after{content:'';width:10px;height:10px;border-radius:50%;background:#3c2f47}
      .da-gift-total{display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px;background:#efe9e0;border-radius:12px;margin:14px 0}
      .da-gift-total span{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#5d4c70}
      .da-gift-total b{font-family:'Cormorant Garamond',serif;font-size:26px;color:#3c2f47}
      .da-gift-link-box{background:#fff;border:1.5px dashed rgba(60,47,71,0.3);border-radius:10px;padding:12px;font-size:12px;color:#5d4c70;word-break:break-all;margin-bottom:14px}
      .da-gift-share-textarea{width:100%;background:#fff;border:1.5px dashed rgba(60,47,71,0.3);border-radius:10px;padding:12px;font-family:inherit;font-size:12.5px;color:#3c2f47;line-height:1.5;resize:vertical;margin-bottom:14px}
      .da-gift-share-textarea:focus{outline:none;border-color:#a8895a}
      .da-gift-toggle-label{font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#5d4c70;font-weight:500;display:block;margin-bottom:8px}

      .da-confirm{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:6px 4px 20px}
      .da-confirm-check{width:56px;height:56px;border-radius:50%;background:#a8895a;color:#fff;display:grid;place-items:center;font-size:26px;margin-bottom:4px}
      .da-confirm h4{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:26px;color:#3c2f47;margin:0}
      .da-confirm > p{font-size:13px;color:#5d4c70;line-height:1.6;margin:0 0 10px}
      .da-pay-card{width:100%;background:#fff;border:1.5px solid rgba(60,47,71,0.12);border-radius:14px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:14px;box-sizing:border-box}
      .da-pay-title{font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#3c2f47;font-weight:600}
      .da-pay-qr{width:100%;max-width:220px;border-radius:10px;border:1px solid rgba(60,47,71,0.1)}
      .da-pay-name{font-family:'Cormorant Garamond',serif;font-size:18px;color:#3c2f47}
      .da-pay-note{font-size:11.5px;color:#5d4c70;line-height:1.5;margin:0}
      .da-pay-soon{opacity:.6}

      .da-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(80px);background:#3c2f47;color:#f6f4ef;padding:14px 24px;border-radius:999px;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;z-index:200;transition:transform .3s cubic-bezier(.2,.7,.2,1);box-shadow:0 14px 40px -10px rgba(0,0,0,0.4)}
      .da-toast.show{transform:translateX(-50%) translateY(0)}

      @media (max-width: 720px){
        .da-modal{padding:12px}
        .da-modal-card{grid-template-columns:1fr;max-height:calc(100vh - 24px);overflow-y:auto;display:block}
        .da-modal-photo{min-height:240px;height:240px}
        .da-modal-photo img{max-height:90%;max-width:90%}
        .da-modal-body{padding:22px 20px 26px;overflow:visible}
        .da-modal-body h2{font-size:30px}
        .da-pyramid .row{grid-template-columns:70px 1fr}
        .da-cta-row{flex-direction:column;gap:8px;position:sticky;bottom:0;background:#f6f4ef;padding-top:14px;padding-bottom:6px;margin-left:-20px;margin-right:-20px;padding-left:20px;padding-right:20px}
        .da-cta-row .da-btn-primary{width:100%}
        .da-cta-row .da-btn-wa{width:100%}
        .da-cart, .da-cart.expanded{width:100vw}
        .da-cart-expand{display:none}
      }
    `;
    const s = document.createElement('style');
    s.id = 'da-shop-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ─── UI: contenedores ───
  function injectChrome(){
    if(document.getElementById('da-bd')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="da-bd" id="da-bd"></div>
      <div class="da-modal" id="da-modal"><div class="da-modal-card" id="da-modal-card"></div></div>
      <aside class="da-cart" id="da-cart" aria-hidden="true">
        <div class="da-cart-head">
          <h3 id="da-cart-title">Tu <em style="color:#a8895a;font-style:italic">bolsa</em></h3>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="da-close da-cart-expand" id="da-cart-expand" style="position:static;box-shadow:none" title="Expandir bolsa">${ICON_EXPAND}</button>
            <button class="da-close" id="da-cart-share" style="position:static;box-shadow:none;background:transparent" title="Compartir bolsa">${ICON_SHARE}</button>
            <button class="da-close" id="da-cart-close" style="position:static;box-shadow:none;background:transparent"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
        </div>
        <div class="da-cart-list" id="da-cart-list"></div>
        <div class="da-cart-foot" id="da-cart-foot"></div>
      </aside>
      <div class="da-toast" id="da-toast"></div>
      <a href="#" class="da-gift-float" id="da-gift-float" aria-label="Regalar un perfume">
        <span class="da-gift-float-label">Regalar</span>
        <span class="da-gift-float-icon">🎁</span>
      </a>
    `);
    document.getElementById('da-bd').addEventListener('click', ()=>{ closeModal(); closeCart(); });
    document.getElementById('da-cart-close').addEventListener('click', closeCart);
    document.getElementById('da-gift-float').addEventListener('click', e => { e.preventDefault(); openGiftBuilder(); });
    document.getElementById('da-cart-share').addEventListener('click', shareCart);
    document.getElementById('da-cart-expand').addEventListener('click', toggleCartExpand);
    document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeModal(); closeCart(); } });
  }

  function showToast(msg){
    const t = document.getElementById('da-toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tt); t._tt = setTimeout(()=>t.classList.remove('show'), 2200);
  }

  // ─── Modal Ver Detalle ───
  let currentDetail = null; // {id, ml}
  function openDetail(id){
    const p = catalog.find(x=>x.id===id);
    if(!p) return;
    // Solo mostramos tamaños con stock > 0
    const sizes = (p.sizes||[]).slice().sort((a,b)=>b.ml-a.ml).filter(s => s.stock > 0 && s.price);
    const firstAvailable = sizes[0];
    currentDetail = { id, ml: firstAvailable?.ml };
    if (firstAvailable) {
      trackGA4Event('view_item', {
        currency: 'PEN',
        value: firstAvailable.price,
        items: [formatGA4Item({id: p.id, ml: firstAvailable.ml}, 1)]
      });
    }

    const card = document.getElementById('da-modal-card');
    const photo = resolvePhoto(p);
    const notesRows = [
      ['Salida', p.notes_top],
      ['Corazón', p.notes_heart],
      ['Fondo', p.notes_base]
    ].filter(([_,n]) => n && n.length).map(([l,n]) => `<div class="row"><div class="l">${l}</div><div class="n">${n.join(' · ')}</div></div>`).join('');

    card.innerHTML = `
      <button class="da-close" id="da-modal-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="da-modal-photo">
        <div class="badges">
          ${p.tag ? `<span class="badge">${TAG_LABEL[p.tag]||p.tag}</span>`:''}
          ${p.featured ? `<span class="badge" style="background:#a8895a;color:#f6f4ef">★ Destacado</span>`:''}
        </div>
        <img src="${photo}" alt="${escapeHtml(p.name)}" onerror="this.style.opacity='.4';this.src='assets/perfume-110ml.jpg'"/>
      </div>
      <div class="da-modal-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
          <div>
            <div class="insp">Inspirado en · ${escapeHtml(p.inspiration||'Atelier')}</div>
            <h2>${escapeHtml(p.name)}</h2>
            <div class="sub">
              <span><i class="d"></i>${FAMILY_LABEL[p.family]||p.family||''}</span>
              <span><i class="d"></i>${GENDER_LABEL[p.gender]||p.gender||''}</span>
              ${p.intensity ? `<span><i class="d"></i>${p.intensity}</span>`:''}
            </div>
          </div>
          <button class="da-share-top" id="da-share" title="Compartir este perfume">${ICON_SHARE}</button>
        </div>
        ${p.description ? `<p class="desc">${escapeHtml(p.description)}</p>`:''}
        ${notesRows ? `<div class="da-pyramid"><h4>Pirámide olfativa</h4>${notesRows}</div>`:''}
        <div>
          <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#5d4c70;margin-bottom:10px">Elige tu tamaño</div>
          ${sizes.length ? `<div class="da-sizes" id="da-sizes">
            ${sizes.map(s => `
              <button class="da-size ${s.ml===currentDetail.ml?'active':''}" data-ml="${s.ml}">
                <div class="ml">${s.ml} ml</div>
                <div class="px">S/ ${s.price}</div>
              </button>`).join('')}
          </div>` : `<div style="padding:14px;background:#f6e3e3;color:#a04848;border-radius:10px;font-size:13px;text-align:center;font-style:italic">Por el momento no contamos con stock. Escríbenos por WhatsApp y te avisamos cuando esté disponible.</div>`}
        </div>
        <div class="da-qty">
          <span>Cantidad</span>
          <div class="stp">
            <button data-q="-1">−</button>
            <input type="text" value="1" id="da-qty-input" readonly />
            <button data-q="+1">+</button>
          </div>
        </div>
        <div class="da-cta-row">
          <button class="da-btn da-btn-primary" id="da-add-cart">Añadir a la bolsa · <span id="da-tot">S/ ${firstAvailable?.price||0}</span></button>
          <button class="da-btn da-btn-wa" id="da-buy-wa" title="Pedir solo este por WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.8.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          </button>
        </div>
        ${waFallbackHtml('da-detail')}
      </div>
    `;
    document.getElementById('da-modal-close').addEventListener('click', closeModal);
    const sizeEl = document.getElementById('da-sizes');
    if(sizeEl) sizeEl.addEventListener('click', e=>{
      const b = e.target.closest('.da-size');
      if(!b) return;
      document.querySelectorAll('#da-sizes .da-size').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      currentDetail.ml = +b.dataset.ml;
      updateTotal();
    });
    document.querySelectorAll('.da-qty .stp button').forEach(btn => btn.addEventListener('click', ()=>{
      const inp = document.getElementById('da-qty-input');
      let v = parseInt(inp.value,10) + parseInt(btn.dataset.q,10);
      inp.value = Math.max(1, Math.min(99, v));
      updateTotal();
    }));
    document.getElementById('da-add-cart').addEventListener('click', ()=>{
      if(!currentDetail.ml){ showToast('Sin stock disponible'); return; }
      const qty = parseInt(document.getElementById('da-qty-input').value,10)||1;
      addToCart({id:currentDetail.id, ml:currentDetail.ml, qty});
      closeModal();
      openCart();
    });
    document.getElementById('da-buy-wa').addEventListener('click', ()=>{
      const qty = parseInt(document.getElementById('da-qty-input').value,10)||1;
      const targetMl = currentDetail.ml || (p.sizes||[]).find(s=>s.price)?.ml || 0;
      const ga4Item = formatGA4Item({id: p.id, ml: targetMl}, qty);
      trackGA4Event('purchase', {
        currency: 'PEN',
        transaction_id: 'wa_fast_' + Date.now(),
        value: ga4Item.price * qty,
        items: [ga4Item]
      });
      const msg = buildWhatsAppMessage([{id:p.id, ml:targetMl, qty}], true);
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });
    document.getElementById('da-share').addEventListener('click', ()=> shareProduct(p));
    wireWaFallback('da-detail', () => {
      const qty = parseInt(document.getElementById('da-qty-input')?.value,10)||1;
      const targetMl = currentDetail.ml || (p.sizes||[]).find(s=>s.price)?.ml || 0;
      return [{id:p.id, ml:targetMl, qty}];
    }, true);

    document.getElementById('da-bd').classList.add('open');
    document.getElementById('da-modal').classList.add('open');
  }
  function updateTotal(){
    if(!currentDetail.ml){ const t=document.getElementById('da-tot'); if(t) t.textContent='—'; return; }
    const p = catalog.find(x=>x.id===currentDetail.id);
    const sz = p?.sizes?.find(s=>s.ml===currentDetail.ml);
    const qtyEl = document.getElementById('da-qty-input');
    const qty = qtyEl ? (parseInt(qtyEl.value,10)||1) : 1;
    document.getElementById('da-tot').textContent = 'S/ ' + ((sz?.price||0)*qty);
  }
  function closeModal(){
    document.getElementById('da-modal')?.classList.remove('open');
    if(!document.getElementById('da-cart')?.classList.contains('open')){
      document.getElementById('da-bd')?.classList.remove('open');
    }
  }

  // ─── Carrito UI ───
  function openCart(){ 
    giftMode = false; renderCart(); 
    document.getElementById('da-bd').classList.add('open'); 
    document.getElementById('da-cart').classList.add('open'); 
    if (cart.length > 0) {
      const offers = computeOffers();
      trackGA4Event('view_cart', { currency: 'PEN', value: offers.total, items: cart.map(c => formatGA4Item(c, c.qty)) });
    }
  }
  function openGiftBuilder(){
    giftRole = 'comprador'; giftMode = true; giftStep = 'armar';
    giftList = []; giftDraft = { entregaPara:'regalada', compradorTelefono:'', compradorNombre:'', nombre:'', telefono:'', distrito:'', direccion:'', referencia:'' };
    giftArmarModo = null; giftTallaMl = null;
    renderCart();
    document.getElementById('da-bd').classList.add('open');
    document.getElementById('da-cart').classList.add('open');
  }
  // Panel más ancho para pedidos con varios productos — útil en pantallas grandes
  function toggleCartExpand(){
    const cart = document.getElementById('da-cart');
    const btn = document.getElementById('da-cart-expand');
    const expanded = cart.classList.toggle('expanded');
    btn.classList.toggle('active', expanded);
    btn.title = expanded ? 'Contraer bolsa' : 'Expandir bolsa';
    btn.innerHTML = expanded ? ICON_COLLAPSE : ICON_EXPAND;
  }
  function closeCart(){
    document.getElementById('da-cart')?.classList.remove('open');
    if(!document.getElementById('da-modal')?.classList.contains('open')){
      document.getElementById('da-bd')?.classList.remove('open');
    }
  }
  function renderCart(){
    const list = document.getElementById('da-cart-list');
    const foot = document.getElementById('da-cart-foot');
    const title = document.getElementById('da-cart-title');
    if(title){
      if(giftMode && giftRole === 'regalada') title.innerHTML = '🎁 <em style="color:#a8895a;font-style:italic">Tu regalo</em>';
      else if(giftMode) title.innerHTML = 'Arma tu <em style="color:#a8895a;font-style:italic">regalo</em>';
      else title.innerHTML = 'Tu <em style="color:#a8895a;font-style:italic">bolsa</em>';
    }
    if(giftMode) return renderGiftFlow(list, foot);
    if(checkoutStep === 'form') return renderCheckoutForm(list, foot);
    if(checkoutStep === 'confirm') return renderCheckoutConfirm(list, foot);
    return renderCartStep(list, foot);
  }
  function renderCartStep(list, foot){
    if(cart.length === 0){
      list.innerHTML = `<div class="da-cart-empty">
        <div class="icon">🛍️</div>
        <h4>Tu bolsa está vacía</h4>
        <p style="font-size:13px">Explora la colección y elige tus aromas favoritos.</p>
        <div class="da-empty-links">
          <a class="da-empty-chip gold" href="Dolce Aroma - Inicio.html#ofertas">🎁 Ver ofertas</a>
          <a class="da-empty-chip" href="Dolce Aroma - Catalogo.html?gender=mujer">Perfumes mujer</a>
          <a class="da-empty-chip" href="Dolce Aroma - Catalogo.html?gender=hombre">Perfumes hombre</a>
          <a class="da-empty-chip" href="Dolce Aroma - Catalogo.html?tag=mas-vendido">Más vendidos</a>
        </div>
      </div>`;
      foot.innerHTML = '';
      return;
    }
    list.innerHTML = cart.map(it => {
      const p = catalog.find(x=>x.id===it.id);
      if(!p) return '';
      const sz = p.sizes.find(s=>s.ml===it.ml) || {};
      const photo = resolvePhoto(p);
      return `
        <div class="da-cart-item">
          <img src="${photo}" alt="" onerror="this.src='assets/perfume-110ml.jpg'"/>
          <div>
            <div class="n">${escapeHtml(p.name)}</div>
            <div class="m">${it.ml} ml · ${escapeHtml(p.inspiration||'')}</div>
            <div class="q">
              <button data-act="dec" data-id="${it.id}" data-ml="${it.ml}">−</button>
              <span>${it.qty}</span>
              <button data-act="inc" data-id="${it.id}" data-ml="${it.ml}">+</button>
            </div>
          </div>
          <div>
            <div class="price">S/ ${(sz.price||0)*it.qty}</div>
            <button class="rm" data-act="rm" data-id="${it.id}" data-ml="${it.ml}">Quitar</button>
          </div>
        </div>`;
    }).join('');
    list.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', ()=>{
      const id = b.dataset.id; const ml = +b.dataset.ml;
      if(b.dataset.act==='inc') changeQty(id, ml, +1);
      if(b.dataset.act==='dec') changeQty(id, ml, -1);
      if(b.dataset.act==='rm')  removeFromCart(id, ml);
    }));
    const offers = computeOffers();
    const hasDiscount = offers.discounts.length > 0;
    const progressHtml = offers.progress.length
      ? `<div class="da-trio-hint">
           <div class="da-trio-note">✨ Sumá cualquier perfume de la colección en ese tamaño — no hace falta que sea el mismo.</div>
           ${offers.progress.map(p => {
             const msg = p.kind === 'upgrade'
               ? `Sumá 1 más → tu ahorro sube a <b>S/ ${p.total}</b>`
               : `Sumá ${p.missing} más → ahorra <b>S/ ${p.total}</b>`;
             return `<div class="da-trio-row"><span class="l">${p.label}</span><span class="r">${msg}</span></div>`;
           }).join('')}
         </div>`
      : '';
    const keepShoppingHtml = offers.progress.length
      ? `<button class="da-btn da-btn-ghost da-keep-shopping" id="da-keep-shopping">+ Seguir comprando</button>`
      : '';
    const subtotalRow = `<div class="da-line"><span>Subtotal</span><b>S/ ${offers.subtotal}</b></div>`;
    const discountRows = offers.discounts.map(d =>
      `<div class="da-line da-line-dis"><span>${d.label} · ×${d.count}</span><b>− S/ ${d.amount}</b></div>`
    ).join('');
    foot.innerHTML = `
      <div class="da-totals">
        ${subtotalRow}
        ${discountRows}
        <div class="da-line da-line-total"><span>Total</span><b>S/ ${offers.total}</b></div>
      </div>
      ${progressHtml}
      ${keepShoppingHtml}
      <button class="da-btn da-btn-primary" style="width:100%" id="da-checkout">Continuar con el pedido</button>
      <button class="da-btn da-btn-ghost" style="width:100%;margin-top:8px" id="da-clear">Vaciar bolsa</button>
    `;
    document.getElementById('da-checkout').addEventListener('click', ()=>{
      checkoutStep = 'form';
      renderCart();
      const offers = computeOffers();
      trackGA4Event('begin_checkout', { currency: 'PEN', value: offers.total, items: cart.map(c => formatGA4Item(c, c.qty)) });
    });
    document.getElementById('da-clear').addEventListener('click', ()=>{
      if(confirm('¿Vaciar la bolsa?')){ cart=[]; saveCart(); renderCart(); }
    });
    document.getElementById('da-keep-shopping')?.addEventListener('click', closeCart);
  }

  // ─── Paso 2: formulario de datos de entrega ───
  function renderCheckoutForm(list, foot){
    const offers = computeOffers();
    list.innerHTML = `
      <div class="da-checkout-head">
        <button class="da-back" type="button" id="da-form-back">← Volver a la bolsa</button>
        <h4>Tus datos de entrega</h4>
      </div>
      <form id="da-order-form" class="da-order-form" novalidate>
        <label>Nombre completo
          <input type="text" id="of-nombre" required value="${escapeHtml(orderForm.nombre)}" placeholder="Ej. María Torres"/>
        </label>
        <label>Teléfono / WhatsApp
          <input type="tel" id="of-telefono" required inputmode="numeric" value="${escapeHtml(orderForm.telefono)}" placeholder="Ej. 987654321"/>
        </label>
        <label class="da-distrito-field">Distrito
          <input type="text" id="of-distrito" required autocomplete="off" value="${escapeHtml(orderForm.distrito)}" placeholder="Escribe para buscar tu distrito"/>
          <div class="da-autocomplete" id="of-distrito-list"></div>
        </label>
        <label>Dirección
          <input type="text" id="of-direccion" required value="${escapeHtml(orderForm.direccion)}" placeholder="Calle, número, referencia de edificio"/>
        </label>
        <label>Referencia (opcional)
          <input type="text" id="of-referencia" value="${escapeHtml(orderForm.referencia)}" placeholder="Ej. cerca al parque, casa azul"/>
        </label>
        <div class="da-zonas-info" id="da-zonas-info"></div>
        <button type="submit" class="da-btn da-btn-primary" style="width:100%" id="da-form-submit">Continuar</button>
      </form>
    `;
    renderZonasInfo(orderForm.distrito);
    const missedOfferHtml = renderMissedOfferHint(offers);
    foot.innerHTML = `
      <div class="da-totals">
        <div class="da-line da-line-total"><span>Total del pedido</span><b>S/ ${offers.total}</b></div>
      </div>
      ${missedOfferHtml}
    `;
    document.getElementById('da-form-back').addEventListener('click', ()=>{
      checkoutStep = 'cart';
      renderCart();
    });
    document.getElementById('da-hint-back')?.addEventListener('click', ()=>{
      checkoutStep = 'cart';
      renderCart();
    });
    ['nombre','direccion','referencia'].forEach(f=>{
      document.getElementById('of-'+f).addEventListener('input', e=>{ orderForm[f] = e.target.value; });
    });
    document.getElementById('of-telefono').addEventListener('input', e=>{
      // Últimos 9 dígitos: si pegan un número con +51 u otro prefijo, igual queda el celular correcto.
      const digits = e.target.value.replace(/\D/g,'').slice(-9);
      e.target.value = digits;
      orderForm.telefono = digits;
    });
    wireDistritoAutocomplete();
    document.getElementById('da-order-form').addEventListener('submit', onSubmitOrderForm);
  }

  // Sugerencias de distrito mientras el usuario escribe (tipo M → todos los distritos con M)
  function wireDistritoAutocomplete(){
    const input = document.getElementById('of-distrito');
    const list = document.getElementById('of-distrito-list');
    function closeList(){ list.innerHTML=''; list.classList.remove('open'); }
    function openList(matches){
      list.innerHTML = matches.map(d => `<button type="button" class="da-ac-item" data-d="${escapeHtml(d)}">${escapeHtml(d)}</button>`).join('');
      list.classList.toggle('open', matches.length>0);
    }
    input.addEventListener('input', ()=>{
      orderForm.distrito = input.value;
      const q = normText(input.value);
      if(!q){ closeList(); renderZonasInfo(''); return; }
      const matches = LIMA_DISTRITOS.filter(d => normText(d).includes(q)).slice(0,8);
      openList(matches);
      renderZonasInfo(input.value);
    });
    input.addEventListener('focus', ()=>{ if(input.value) input.dispatchEvent(new Event('input')); });
    list.addEventListener('click', e=>{
      const b = e.target.closest('.da-ac-item');
      if(!b) return;
      input.value = b.dataset.d;
      orderForm.distrito = b.dataset.d;
      closeList();
      renderZonasInfo(input.value);
    });
    document.addEventListener('click', e=>{
      if(!e.target.closest('.da-distrito-field')) closeList();
    }, { once:true });
  }

  // Info de envío: general por defecto, o específica en cuanto el distrito coincide con una zona gratis
  function renderZonasInfo(distrito){
    const box = document.getElementById('da-zonas-info');
    if(!box) return;
    const match = findZonaMatch(distrito);
    if(match){
      const mensaje = match.detalle || zonas.mensajeEstandarGratis || '';
      box.innerHTML = `
        <div class="da-zonas-title da-zonas-match">🎉 ¡Envío gratis a ${escapeHtml(match.distrito)}!</div>
        ${mensaje ? `<p>${escapeHtml(mensaje)}</p>` : ''}
      `;
      return;
    }
    box.innerHTML = `
      <div class="da-zonas-title">🚚 Envío gratis${zonas.envioGratisMinimo ? ` desde S/ ${zonas.envioGratisMinimo}` : ''}</div>
      ${zonas.zonasGratis?.length ? `<ul>${zonas.zonasGratis.map(z=>`<li>${escapeHtml(z.distrito || '')}${z.distrito && z.detalle ? ' — ' : ''}${escapeHtml(z.detalle||'')}</li>`).join('')}</ul>` : ''}
      ${zonas.notaOtrasZonas ? `<p>${escapeHtml(zonas.notaOtrasZonas)}</p>` : ''}
    `;
  }

  // Recuerda al cliente, en el paso de pago, si le falta poco para un descuento aún sin aprovechar,
  // mostrando el ahorro Y el total que le quedaría si suma esa unidad (no solo el número de descuento suelto).
  function renderMissedOfferHint(offers){
    if(!offers.progress.length) return '';
    const p = offers.progress[0];
    if(p.missing !== 1) return ''; // solo mostramos la proyección cuando falta exactamente 1 (dato confiable)
    const addPrice = cheapestPriceForMl(p.ml);
    const ahorroActual = p.kind === 'upgrade' ? p.amount : 0;
    return `<div class="da-trio-hint" style="margin-bottom:14px">
      <div class="da-hint-headline">🎉 Ahorra <b>S/ ${p.total}</b> con ${p.label}</div>
      <div class="da-trio-row">
        <span class="r">Sumá 1 más de ${p.ml} ml (desde S/ ${addPrice}) para activarlo — tu ahorro pasaría de S/ ${ahorroActual} a S/ ${p.total}.</span>
      </div>
      <button type="button" class="da-hint-back" id="da-hint-back">volver a la bolsa</button>
    </div>`;
  }

  async function onSubmitOrderForm(e){
    e.preventDefault();
    const nombre = document.getElementById('of-nombre').value.trim();
    const telefono = document.getElementById('of-telefono').value.trim();
    const distrito = document.getElementById('of-distrito').value.trim();
    const direccion = document.getElementById('of-direccion').value.trim();
    const referencia = document.getElementById('of-referencia').value.trim();
    if(!nombre || !telefono || !distrito || !direccion){
      showToast('Completa los campos obligatorios');
      return;
    }
    orderForm = { nombre, telefono, distrito, direccion, referencia };
    const offers = computeOffers();
    const items = cart.map(it=>{
      const p = catalog.find(x=>x.id===it.id);
      const sz = p?.sizes?.find(s=>s.ml===it.ml);
      return { name: p?.name || it.id, ml: it.ml, qty: it.qty, subtotal: (sz?.price||0)*it.qty };
    });
    const btn = document.getElementById('da-form-submit');
    btn.disabled = true; btn.textContent = 'Enviando...';
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/submit-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, distrito, direccion, referencia, items, subtotal: offers.subtotal, total: offers.total })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!r.ok || !data.ok) throw new Error(data.error || 'No se pudo registrar el pedido');
      lastOrder = { orderId: data.orderId || null, nombre, telefono, distrito, direccion, referencia, items, subtotal: offers.subtotal, total: offers.total };
      trackGA4Event('add_shipping_info', {
        currency: 'PEN',
        value: offers.total,
        items: cart.map(c => formatGA4Item(c, c.qty))
      });
      checkoutStep = 'confirm';
      renderCart();
    }catch(err){
      showToast('No se pudo enviar el pedido. Intenta de nuevo.');
      btn.disabled = false; btn.textContent = 'Continuar';
    }
  }

  // ─── Paso 3: confirmación + pago ───
  function renderCheckoutConfirm(list, foot){
    if(!lastOrder){ checkoutStep = 'cart'; return renderCart(); }
    const orderTag = lastOrder.orderId ? ` #${lastOrder.orderId}` : '';
    const waMsg = `Buenos días, soy ${lastOrder.nombre}. Estoy realizando el pago de mi pedido${orderTag}, adjunto la constancia 🧾`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    const tarjetaHtml = pago.culqiPublicKey
      ? `<div class="da-pay-card" id="da-pay-card-tarjeta">
           <div class="da-pay-title">Tarjeta de crédito / débito</div>
           <p class="da-pay-note">Pago seguro procesado por Culqi — tus datos de tarjeta nunca pasan por nuestro sitio.</p>
           <button class="da-btn da-btn-primary" style="width:100%" id="da-pay-culqi">Pagar S/ ${lastOrder.total} con tarjeta</button>
         </div>`
      : `<div class="da-pay-card da-pay-soon">
           <div class="da-pay-title">Tarjeta de crédito / débito</div>
           <p class="da-pay-note">Próximamente 🚧 — por ahora paga con Yape o coordina con nosotros por WhatsApp.</p>
         </div>`;
    list.innerHTML = `
      <div class="da-confirm">
        <div class="da-confirm-check">✓</div>
        <h4>¡Pedido registrado!</h4>
        ${lastOrder.orderId ? `<div class="da-confirm-id">Pedido #${lastOrder.orderId}</div>` : ''}
        <p>Guardamos tu pedido y ya nos llegó la notificación. Elige cómo quieres pagar para coordinar tu entrega:</p>

        <div class="da-pay-card">
          <div class="da-pay-title">Yape</div>
          <img src="assets/pago-yape.jpg" alt="Código QR para pagar por Yape" class="da-pay-qr"/>
          <div class="da-pay-name">${escapeHtml(pago.nombreYape)}</div>
          <a class="da-btn da-btn-wa" style="width:100%" href="${waUrl}" target="_blank" rel="noopener" id="da-pay-wa">
            Ya pagué, avisar por WhatsApp
          </a>
          <p class="da-pay-note">Al abrirse WhatsApp, adjunta la captura de tu pago como segundo mensaje.</p>
        </div>

        ${tarjetaHtml}

        <button class="da-btn da-btn-ghost" style="width:100%;margin-top:6px" id="da-confirm-close">Seguir comprando</button>
      </div>
    `;
    foot.innerHTML = '';
    if(pago.culqiPublicKey) document.getElementById('da-pay-culqi')?.addEventListener('click', payWithCulqi);
    document.getElementById('da-pay-wa')?.addEventListener('click', ()=>{
      if(lastOrder) {
        trackGA4Event('purchase', {
          currency: 'PEN',
          transaction_id: lastOrder.orderId || 'wa_' + Date.now(),
          value: lastOrder.total,
          items: cart.map(c => formatGA4Item(c, c.qty))
        });
      }
    });
    document.getElementById('da-confirm-close').addEventListener('click', ()=>{
      cart = []; saveCart();
      checkoutStep = 'cart'; lastOrder = null;
      closeCart();
    });
  }

  // ─── Pago con tarjeta (Culqi) ───
  // Se activa solo si Admin → Pago tiene cargada una llave pública (pago.culqiPublicKey).
  // Sin ella, la tarjeta de pago muestra "Próximamente" y este código no se ejecuta nunca.
  let culqiScriptLoaded = false;
  function loadCulqiScript(){
    return new Promise((resolve, reject) => {
      if(culqiScriptLoaded || window.Culqi){ resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://checkout.culqi.com/js/v4';
      s.onload = () => { culqiScriptLoaded = true; resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar Culqi'));
      document.head.appendChild(s);
    });
  }
  async function payWithCulqi(){
    if(!lastOrder) return;
    const btn = document.getElementById('da-pay-culqi');
    try{
      if(btn){ btn.disabled = true; btn.textContent = 'Cargando pasarela…'; }
      await loadCulqiScript();
      window.Culqi.publicKey = pago.culqiPublicKey;
      window.Culqi.settings({
        title: 'Dolce Aroma',
        currency: 'PEN',
        amount: Math.round(lastOrder.total * 100), // Culqi espera céntimos
        order: lastOrder.orderId || undefined,
      });
      window.Culqi.open();
      if(btn){ btn.disabled = false; btn.textContent = `Pagar S/ ${lastOrder.total} con tarjeta`; }
    }catch(e){
      showToast('No se pudo abrir la pasarela de pago. Intenta de nuevo.');
      if(btn){ btn.disabled = false; btn.textContent = `Pagar S/ ${lastOrder.total} con tarjeta`; }
    }
  }
  // Culqi.js llama a esta función global cuando el cliente termina de ingresar la tarjeta.
  window.culqi = async function(){
    if(!window.Culqi || !window.Culqi.token){
      if(window.Culqi && window.Culqi.error) showToast(window.Culqi.error.user_message || 'No se pudo procesar el pago');
      return;
    }
    const token = window.Culqi.token.id;
    const email = window.Culqi.token.email; // Culqi lo pide dentro de su propio formulario, no hace falta pedirlo en el nuestro
    showToast('Procesando tu pago…');
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/charge-culqi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: lastOrder?.orderId, token, email, amount: Math.round((lastOrder?.total||0) * 100) })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!r.ok || !data.ok) throw new Error(data.error || 'Pago rechazado');
      showToast('¡Pago confirmado! Gracias por tu compra 🌸');
      trackGA4Event('purchase', {
        currency: 'PEN',
        transaction_id: lastOrder?.orderId || 'culqi_' + Date.now(),
        value: lastOrder?.total || 0,
        items: cart.map(c => formatGA4Item(c, c.qty))
      });
      const card = document.getElementById('da-pay-card-tarjeta');
      if(card) card.innerHTML = `<div class="da-pay-title">✓ Pago confirmado</div><p class="da-pay-note">Ya registramos tu pago. Coordinamos la entrega por WhatsApp.</p>`;
    }catch(e){
      showToast('El pago no se pudo confirmar: ' + e.message);
    }
  };

  // ─── Regalar un perfume (Fase 1) ───
  let giftRole = 'comprador'; // 'comprador' (arma/paga) | 'regalada' (elige, vía ?regalo=)
  let giftClaimResult = null; // { orderId } una vez que la persona regalada confirma
  let giftFilterText = '', giftFilterGender = '', giftFilterBrand = '', giftFilterEstilo = '';
  let giftArmarModo = null; // null (sin elegir) | 'curada' (arma lista puntual) | 'talla' (solo tamaño, ella elige el perfume)
  let giftTallaMl = null;   // tamaño elegido en modo 'talla'
  let giftClaimFilterText = ''; // buscador dentro de la pantalla de la persona regalada, solo si hay muchas opciones

  function giftItemPhoto(it){
    const p = catalog.find(x=>x.id===it.id);
    return p ? resolvePhoto(p) : 'assets/perfume-110ml.jpg';
  }

  function renderGiftFlow(list, foot){
    if(giftRole === 'regalada') return renderGiftClaim(list, foot);
    if(giftStep === 'detalles') return renderGiftDetalles(list, foot);
    if(giftStep === 'compartir') return renderGiftCompartir(list, foot);
    if(giftStep === 'pagar') return renderGiftPagar(list, foot);
    return renderGiftArmar(list, foot);
  }

  // Precio "estándar" de un tamaño: el más frecuente entre los perfumes con ese ml en
  // stock. Como casi todo el catálogo tiene precios uniformes por tamaño (con un par de
  // excepciones puntuales, ej. los frascos originales de Bleu/Invictus), esto excluye
  // esas excepciones automáticamente sin tener que mantener una lista a mano.
  function standardPriceForMl(ml){
    const prices = catalog.flatMap(p => (p.sizes||[]).filter(s=>s.ml===ml && s.stock>0 && s.price).map(s=>s.price));
    if(!prices.length) return 0;
    const counts = {};
    prices.forEach(pr => counts[pr] = (counts[pr]||0) + 1);
    return +Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  }
  // Tamaños disponibles para el modo "solo tamaño", de mayor a menor ml.
  function giftTallaSizes(){
    const mls = [...new Set(catalog.flatMap(p => (p.sizes||[]).filter(s=>s.stock>0 && s.price && GIFT_SIZES.includes(s.ml)).map(s=>s.ml)))];
    return mls.sort((a,b)=>b-a).map(ml => ({ ml, price: standardPriceForMl(ml) }));
  }
  // Arma la lista de "opciones" para el modo talla: TODO el catálogo con ese tamaño al
  // precio estándar — la persona regalada elige cuál de todos esos quiere.
  function buildTallaGiftList(ml){
    const price = standardPriceForMl(ml);
    return catalog
      .filter(p => (p.sizes||[]).some(s=>s.ml===ml && s.stock>0 && s.price===price))
      .map(p => ({ id: p.id, ml, name: p.name, inspiration: p.inspiration || '', price, premium: false, premiumPrecio: 0 }));
  }
  // Total de referencia mientras arma la lista (paso 1). En modo talla es el precio fijo
  // del tamaño elegido; en modo curada es la suma de lo agregado hasta ahora — es solo una
  // referencia mientras arma, no necesariamente lo que se termina cobrando si el regalo es
  // "para otra persona" (ver computeGiftForOtherTotal): la persona regalada se queda con
  // UNA sola de las opciones curadas, no con todas.
  function computeGiftArmarTotal(){
    if(giftArmarModo === 'talla') return giftTallaMl ? standardPriceForMl(giftTallaMl) : 0;
    return giftList.reduce((s,it)=> s + it.price + (it.premium ? it.premiumPrecio : 0), 0);
  }
  // Total REAL a cobrar cuando el regalo es para otra persona: en talla es el precio fijo
  // del tamaño (todas las opciones cuestan lo mismo, por construcción); en curada, como solo
  // se entrega UNA de las opciones ofrecidas, se cobra la más cara del grupo — nunca menos
  // de lo que podría terminar costando, y nunca la suma de opciones que no se van a entregar.
  function computeGiftForOtherTotal(){
    if(giftArmarModo === 'talla') return giftTallaMl ? standardPriceForMl(giftTallaMl) : 0;
    if(!giftList.length) return 0;
    return Math.max(...giftList.map(it => it.price + (it.premium ? it.premiumPrecio : 0)));
  }

  // Paso 1 (comprador): elige el modo (perfumes puntuales o solo tamaño), y luego arma
  // la lista de opciones para que la persona elija.
  function renderGiftArmar(list, foot){
    if(giftArmarModo === null) return renderGiftArmarModo(list, foot);
    if(giftArmarModo === 'talla') return renderGiftArmarTalla(list, foot);
    return renderGiftArmarCurada(list, foot);
  }
  function renderGiftArmarModo(list, foot){
    list.innerHTML = `
      <div class="da-gift-banner">🎁 ¿Cómo quieres armar el regalo?</div>
      <button type="button" class="da-gift-modo-card" id="gift-modo-curada">
        <b>Yo los elijo</b>
        <span>Selecciona los perfumes que deseas regalarle.</span>
      </button>
      <button type="button" class="da-gift-modo-card" id="gift-modo-talla">
        <b>Ella/Él los elige</b>
        <span>Dale la alternativa de elegir el perfume que más le guste, de todo nuestro catálogo en ese tamaño.</span>
      </button>
    `;
    foot.innerHTML = `<button class="da-btn da-btn-ghost" style="width:100%" id="da-gift-cancel">Cancelar</button>`;
    document.getElementById('da-gift-cancel').addEventListener('click', ()=>{ giftMode = false; renderCart(); });
    document.getElementById('gift-modo-curada').addEventListener('click', ()=>{ giftArmarModo = 'curada'; renderCart(); });
    document.getElementById('gift-modo-talla').addEventListener('click', ()=>{ giftArmarModo = 'talla'; renderCart(); });
  }
  function renderGiftArmarTalla(list, foot){
    const sizes = giftTallaSizes();
    list.innerHTML = `
      <button class="da-back" type="button" id="da-gift-modo-back">← Cambiar modo</button>
      <div class="da-gift-banner">🎁 Elige solo el tamaño del frasco que quieres regalar — la persona va a elegir el perfume que más le guste, de todo nuestro catálogo en ese tamaño.</div>
      ${sizes.map(s => `
        <button type="button" class="da-gift-modo-card ${giftTallaMl===s.ml?'selected':''}" data-ml="${s.ml}">
          <b>${s.ml} ml</b>
          <span>S/ ${s.price}</span>
        </button>`).join('')}
    `;
    document.getElementById('da-gift-modo-back').addEventListener('click', ()=>{ giftArmarModo = null; giftTallaMl = null; giftList = []; renderCart(); });
    list.querySelectorAll('.da-gift-modo-card[data-ml]').forEach(card => card.addEventListener('click', ()=>{
      giftTallaMl = +card.dataset.ml;
      giftList = buildTallaGiftList(giftTallaMl);
      renderCart();
    }));
    renderGiftArmarFoot(foot);
  }
  function renderGiftArmarCurada(list, foot){
    const brands = [...new Set(catalog.map(p=>p.inspiration).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    list.innerHTML = `
      <button class="da-back" type="button" id="da-gift-modo-back">← Cambiar modo</button>
      <div class="da-gift-banner">🎁 Arma un regalo — selecciona el perfume que quieres regalar (disponible en 50 ml y 110 ml).</div>
      <input type="text" id="gift-filter" placeholder="Buscar por nombre o marca..." style="width:100%;padding:10px 14px;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;margin-bottom:10px;font-family:inherit;font-size:13px;color:#3c2f47"/>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <select id="gift-filter-gender" style="flex:1 1 110px;padding:10px 8px;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;font-family:inherit;font-size:12.5px;color:#3c2f47;background:#fff">
          <option value="">Todos los géneros</option>
          <option value="mujer">Mujer</option>
          <option value="hombre">Hombre</option>
          <option value="unisex">Unisex</option>
        </select>
        <select id="gift-filter-estilo" style="flex:1 1 110px;padding:10px 8px;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;font-family:inherit;font-size:12.5px;color:#3c2f47;background:#fff">
          <option value="">Todos los estilos</option>
          <option value="arabe">Árabe</option>
          <option value="disenador">Diseñador</option>
        </select>
        <select id="gift-filter-brand" style="flex:1 1 110px;padding:10px 8px;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;font-family:inherit;font-size:12.5px;color:#3c2f47;background:#fff">
          <option value="">Todas las marcas</option>
          ${brands.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('')}
        </select>
      </div>
      <div id="gift-catalog-list"></div>
    `;
    renderGiftCatalogList();
    renderGiftArmarFoot(foot);
    document.getElementById('da-gift-modo-back').addEventListener('click', ()=>{ giftArmarModo = null; giftList = []; renderCart(); });
    document.getElementById('gift-filter').value = giftFilterText;
    document.getElementById('gift-filter-gender').value = giftFilterGender;
    document.getElementById('gift-filter-estilo').value = giftFilterEstilo;
    document.getElementById('gift-filter-brand').value = giftFilterBrand;
    document.getElementById('gift-filter').addEventListener('input', e => { giftFilterText = e.target.value; renderGiftCatalogList(); });
    document.getElementById('gift-filter-gender').addEventListener('change', e => { giftFilterGender = e.target.value; renderGiftCatalogList(); });
    document.getElementById('gift-filter-estilo').addEventListener('change', e => { giftFilterEstilo = e.target.value; renderGiftCatalogList(); });
    document.getElementById('gift-filter-brand').addEventListener('change', e => { giftFilterBrand = e.target.value; renderGiftCatalogList(); });
  }
  function renderGiftArmarFoot(foot){
    const total = computeGiftArmarTotal();
    const isTalla = giftArmarModo === 'talla';
    const canNext = isTalla ? !!giftTallaMl : giftList.length > 0;
    const label = isTalla
      ? (giftTallaMl ? `Regalo de ${giftTallaMl} ml` : 'Elige un tamaño')
      : (giftList.length ? giftList[0].name : 'Elige un perfume');
    foot.innerHTML = `
      <div class="da-gift-total"><span>${label}</span><b>S/ ${total}</b></div>
      <button class="da-btn da-btn-ghost" style="width:100%;margin-bottom:8px" id="da-gift-cancel">Cancelar</button>
      <button class="da-btn da-btn-primary" style="width:100%" id="da-gift-next" ${canNext ? '' : 'disabled'}>Siguiente</button>
    `;
    document.getElementById('da-gift-cancel').addEventListener('click', ()=>{ giftMode = false; renderCart(); });
    document.getElementById('da-gift-next').addEventListener('click', ()=>{
      if(!canNext) return;
      giftStep = 'detalles'; renderCart();
    });
  }
  // Coincide si CADA palabra escrita aparece en algún lado (nombre o marca), en cualquier orden
  function matchesGiftSearch(p, words){
    if(!words.length) return true;
    const haystack = normText(`${p.name} ${p.inspiration||''}`);
    return words.every(w => haystack.includes(w));
  }
  function renderGiftCatalogList(){
    const box = document.getElementById('gift-catalog-list');
    if(!box) return;
    const words = normText(giftFilterText).split(/\s+/).filter(Boolean);
    const items = catalog.filter(p =>
      (p.sizes||[]).some(s=>s.stock>0 && s.price && GIFT_SIZES.includes(s.ml)) &&
      matchesGiftSearch(p, words) &&
      (!giftFilterGender || p.gender === giftFilterGender) &&
      (!giftFilterEstilo || giftEstiloFor(p) === giftFilterEstilo) &&
      (!giftFilterBrand || p.inspiration === giftFilterBrand)
    );
    if(!items.length){
      box.innerHTML = `<p style="text-align:center;color:#5d4c70;font-size:13px;padding:20px 0">No encontramos perfumes con esos filtros.</p>`;
      return;
    }
    box.innerHTML = items.map(p => {
      const sizes = (p.sizes||[]).filter(s=>s.stock>0 && s.price && GIFT_SIZES.includes(s.ml)).sort((a,b)=>b.ml-a.ml);
      const hasPremium = !!p.frascoPremium?.disponible;
      return `
        <div class="da-gift-item" data-pid="${p.id}">
          <div class="da-gift-item-top" style="cursor:default">
            <img src="${resolvePhoto(p)}" alt="" onerror="this.style.visibility='hidden'"/>
            <span class="n" style="flex:1">${escapeHtml(p.name)}</span>
          </div>
          <div class="da-gift-sizes">
            ${sizes.map(sz => {
              const inList = giftList.find(g=>g.id===p.id && g.ml===sz.ml);
              return `<button type="button" class="da-gift-size-chip ${inList?'selected':''}" data-id="${p.id}" data-ml="${sz.ml}" data-name="${escapeHtml(p.name)}" data-inspiration="${escapeHtml(p.inspiration||'')}" data-price="${sz.price}">${sz.ml} ml · S/ ${sz.price}</button>`;
            }).join('')}
          </div>
          ${hasPremium ? sizes.map(sz => {
            const inList = giftList.find(g=>g.id===p.id && g.ml===sz.ml);
            return `<label class="da-gift-premium" data-premium-row="${p.id}:${sz.ml}" style="display:${inList?'flex':'none'}">
              <input type="checkbox" data-premium-for="${p.id}:${sz.ml}" ${inList?.premium?'checked':''}>
              Agregar frasco premium (${sz.ml} ml) <b style="color:#a8895a">+ S/ ${p.frascoPremium.precio}</b>
            </label>`;
          }).join('') : ''}
        </div>`;
    }).join('');
    // Selección única: por ahora solo se regala UN perfume por link (mientras se valida
    // cómo entregar cada regalo), así que elegir uno reemplaza cualquier elección anterior.
    box.querySelectorAll('.da-gift-size-chip').forEach(chip => chip.addEventListener('click', ()=>{
      const id = chip.dataset.id, ml = +chip.dataset.ml;
      const exists = giftList.find(g=>g.id===id && g.ml===ml);
      giftList = exists ? [] : [{ id, ml, name: chip.dataset.name, inspiration: chip.dataset.inspiration || '', price: +chip.dataset.price, premium:false, premiumPrecio: catalog.find(x=>x.id===id)?.frascoPremium?.precio||0 }];
      renderGiftCatalogList();
      renderGiftArmarFoot(document.getElementById('da-cart-foot'));
    }));
    box.querySelectorAll('input[data-premium-for]').forEach(cb => cb.addEventListener('change', e=>{
      const [id, mlStr] = e.target.dataset.premiumFor.split(':'); const ml = +mlStr;
      const g = giftList.find(x=>x.id===id && x.ml===ml);
      if(g) g.premium = e.target.checked;
      renderGiftArmarFoot(document.getElementById('da-cart-foot'));
    }));
  }

  // Paso 2 (comprador): ¿para quién es la entrega? + contacto / dirección según corresponda
  function renderGiftDetalles(list, foot){
    // En modo "talla" no tiene sentido entregárselo al propio comprador: la gracia es que
    // la otra persona elija el perfume entre todo el catálogo de ese tamaño.
    if(giftArmarModo === 'talla') giftDraft.entregaPara = 'regalada';
    const isComprador = giftDraft.entregaPara === 'comprador';
    list.innerHTML = `
      <div class="da-checkout-head">
        <button class="da-back" type="button" id="da-gift-back">← Volver a elegir ${giftArmarModo === 'talla' ? 'el tamaño' : 'perfumes'}</button>
        <h4>Datos del regalo</h4>
      </div>
      ${giftArmarModo === 'talla' ? '' : `
      <div style="margin-bottom:18px">
        <span class="da-gift-toggle-label">¿Se te entregará el regalo a ti?</span>
        <div style="display:flex;gap:10px">
          <button type="button" class="da-btn ${isComprador?'da-btn-primary':'da-btn-ghost'}" id="gift-entrega-si" style="flex:1">Sí, a mí</button>
          <button type="button" class="da-btn ${!isComprador?'da-btn-primary':'da-btn-ghost'}" id="gift-entrega-no" style="flex:1">No, a otra persona</button>
        </div>
      </div>`}
      <div id="gift-detalles-body" class="da-order-form"></div>
      <button class="da-btn da-btn-primary" style="width:100%;margin-top:14px;flex:none" id="da-gift-submit">${isComprador ? 'Continuar' : 'Generar link de regalo'}</button>
    `;
    foot.innerHTML = '';
    renderGiftDetallesBody();
    document.getElementById('da-gift-back').addEventListener('click', ()=>{ giftStep = 'armar'; renderCart(); });
    document.getElementById('gift-entrega-si')?.addEventListener('click', ()=>{ giftDraft.entregaPara = 'comprador'; renderGiftDetalles(list, foot); });
    document.getElementById('gift-entrega-no')?.addEventListener('click', ()=>{ giftDraft.entregaPara = 'regalada'; renderGiftDetalles(list, foot); });
    document.getElementById('da-gift-submit').addEventListener('click', ()=>{
      if(giftDraft.entregaPara === 'comprador') submitGiftSelf(); else submitGiftForOther();
    });
  }
  function renderGiftDetallesBody(){
    const body = document.getElementById('gift-detalles-body');
    if(!body) return;
    if(giftDraft.entregaPara === 'comprador'){
      body.innerHTML = `
        <label>Nombre completo
          <input type="text" id="gof-nombre" value="${escapeHtml(giftDraft.nombre)}" placeholder="Tu nombre"/>
        </label>
        <label>Teléfono / WhatsApp
          <input type="tel" id="gof-telefono" inputmode="numeric" value="${escapeHtml(giftDraft.telefono)}" placeholder="987654321"/>
        </label>
        <label>Distrito
          <input type="text" id="gof-distrito" value="${escapeHtml(giftDraft.distrito)}" placeholder="Tu distrito"/>
        </label>
        <label>Dirección
          <input type="text" id="gof-direccion" value="${escapeHtml(giftDraft.direccion)}" placeholder="Calle, número, referencia"/>
        </label>
        <label>Referencia (opcional)
          <input type="text" id="gof-referencia" value="${escapeHtml(giftDraft.referencia)}" placeholder="Ej. cerca al parque"/>
        </label>
      `;
      document.getElementById('gof-telefono').addEventListener('input', e=>{ e.target.value = e.target.value.replace(/\D/g,'').slice(-9); });
    } else {
      body.innerHTML = `
        <label>Tu nombre
          <input type="text" id="gof-comprador-nombre" value="${escapeHtml(giftDraft.compradorNombre)}" placeholder="Ej. María"/>
        </label>
        <label>Tu WhatsApp
          <input type="tel" id="gof-comprador-tel" inputmode="numeric" value="${escapeHtml(giftDraft.compradorTelefono)}" placeholder="987654321"/>
        </label>
        <p class="da-pay-note" style="margin-top:-8px">Para avisarte cuando confirmen los perfumes de tu regalo.</p>
        <p class="da-pay-note">A continuación pagas tu regalo — el link para compartir se genera justo después.</p>
        <p class="da-pay-note">El link de tu regalo será válido por ${GIFT_EXPIRY_DAYS} días.</p>
      `;
      document.getElementById('gof-comprador-tel').addEventListener('input', e=>{ e.target.value = e.target.value.replace(/\D/g,'').slice(-9); });
    }
  }

  // Envío directo: el regalo es para el propio comprador → reusa el checkout normal
  async function submitGiftSelf(){
    const nombre = document.getElementById('gof-nombre').value.trim();
    const telefono = document.getElementById('gof-telefono').value.trim();
    const distrito = document.getElementById('gof-distrito').value.trim();
    const direccion = document.getElementById('gof-direccion').value.trim();
    const referencia = document.getElementById('gof-referencia').value.trim();
    if(!nombre || !telefono || !distrito || !direccion){ showToast('Completa los campos obligatorios'); return; }
    giftDraft = { ...giftDraft, nombre, telefono, distrito, direccion, referencia };
    const items = giftList.map(g => ({ name: g.name, ml: g.ml, qty: 1, premium: g.premium, subtotal: g.price + (g.premium ? g.premiumPrecio : 0) }));
    const total = items.reduce((s,it)=>s+it.subtotal, 0);
    const btn = document.getElementById('da-gift-submit');
    if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/submit-order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, distrito, direccion, referencia, items, subtotal: total, total, esRegalo: true })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!r.ok || !data.ok) throw new Error(data.error || 'No se pudo registrar el regalo');
      giftMode = false;
      lastOrder = { orderId: data.orderId || null, nombre, telefono, distrito, direccion, referencia, items, subtotal: total, total };
      checkoutStep = 'confirm';
      renderCart();
    }catch(e){
      showToast('No se pudo enviar el regalo. Intenta de nuevo.');
      if(btn){ btn.disabled = false; btn.textContent = 'Continuar'; }
    }
  }

  // Regalo para otra persona: crea el regalo y pasa a compartir o a pagar, según elija
  async function submitGiftForOther(){
    const compradorNombre = document.getElementById('gof-comprador-nombre').value.trim();
    const compradorTelefono = document.getElementById('gof-comprador-tel').value.trim();
    if(!compradorTelefono){ showToast('Déjanos tu WhatsApp para avisarte'); return; }
    giftDraft = { ...giftDraft, compradorNombre, compradorTelefono };
    const items = giftList.map(g => ({ id: g.id, ml: g.ml, name: g.name, inspiration: g.inspiration || '', qty: 1, premium: g.premium, subtotal: g.price + (g.premium ? g.premiumPrecio : 0) }));
    const total = computeGiftForOtherTotal();
    const btn = document.getElementById('da-gift-submit');
    if(btn){ btn.disabled = true; btn.textContent = 'Generando...'; }
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/create-gift`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, compradorTelefono, compradorNombre, total })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!r.ok || !data.ok) throw new Error(data.error || 'No se pudo generar el regalo');
      currentGift = { id: data.giftId, items, total, compradorTelefono, compradorNombre, elegido: false, pagado: false };
      trackGA4Event('begin_checkout', {
        currency: 'PEN',
        value: total,
        items: items.map(c => formatGA4Item(c, c.qty))
      });
      giftStep = 'pagar'; // el pago es obligatorio antes de compartir el link
      renderCart();
    }catch(e){
      showToast('No se pudo generar el link de regalo. Intenta de nuevo.');
      if(btn){ btn.disabled = false; btn.textContent = 'Generar link de regalo'; }
    }
  }

  // Arma el texto que se comparte con la persona regalada — personalizado si el
  // comprador dejó su nombre, y con un tono que emocione en vez de sonar a link genérico.
  function buildGiftShareMessage(g, url){
    const quien = g.compradorNombre ? `${escapeHtml(g.compradorNombre)} te preparó` : 'Te preparé';
    const n = g.items.length;
    let linea2;
    if(giftArmarModo === 'talla'){
      const ml = g.items[0]?.ml || '';
      linea2 = `Elegí un perfume de ${ml} ml para ti — entra y elige el que más te guste entre todo nuestro catálogo 🌸`;
    } else if(n > 1){
      linea2 = `Elegí ${n} perfumes para ti — entra, elige el que más te enamore y en pocos días lo tienes contigo 🌸`;
    } else {
      linea2 = `Elegí un perfume para ti — entra, confírmalo y en pocos días lo tienes contigo 🌸`;
    }
    return [
      `🎁✨ ¡${quien} un regalo!`,
      '',
      linea2,
      '',
      `👉 ELIGE tu perfume de regalo: ${url}`,
      '',
      `Válido por ${GIFT_EXPIRY_DAYS} días · Dolce Aroma`,
    ].join('\n');
  }
  // Paso 3a (comprador): compartir el link generado con la persona regalada
  function renderGiftCompartir(list, foot){
    const url = buildShareUrl({ regalo: currentGift.id });
    const shareMsg = buildGiftShareMessage(currentGift, url);
    list.innerHTML = `
      <div class="da-confirm">
        <div class="da-confirm-check">✓</div>
        <h4>¡Regalo pagado y listo!</h4>
        <div class="da-confirm-id">Regalo #${currentGift.id}</div>
        <p>Comparte este mensaje con la persona a quien quieres regalarle — puedes editarlo o agregarle algo tuyo antes de enviarlo.</p>
        <textarea id="gift-share-text" class="da-gift-share-textarea" rows="7">${escapeHtml(shareMsg)}</textarea>
        <button class="da-btn da-btn-primary" style="width:100%;margin-bottom:8px;flex:none" id="gift-share-btn">Compartir</button>
        <button class="da-btn da-btn-ghost" style="width:100%" id="gift-copy-btn">Copiar mensaje</button>
        <p class="da-pay-note" style="margin-top:10px">Este link es válido por ${GIFT_EXPIRY_DAYS} días. Ya está pagado — en cuanto la persona elija, nos llega directo a nosotros para coordinar la entrega.</p>
        <button class="da-btn da-btn-ghost" style="width:100%;margin-top:14px" id="da-gift-close">Listo, cerrar</button>
      </div>
    `;
    foot.innerHTML = '';
    const getText = () => document.getElementById('gift-share-text').value;
    document.getElementById('gift-share-btn').addEventListener('click', async ()=>{
      const text = getText();
      if(navigator.share){ try{ await navigator.share({ title: '🎁 Tienes un regalo', text }); }catch(e){ /* canceló */ } }
      else shareViaClipboard(text);
    });
    document.getElementById('gift-copy-btn').addEventListener('click', ()=> shareViaClipboard(getText()));
    document.getElementById('da-gift-close').addEventListener('click', ()=>{ giftMode = false; closeCart(); });
  }

  // Paso 3b (comprador): pagar el regalo (ahora, o al volver desde el link ?pagar_regalo=)
  function renderGiftPagar(list, foot){
    const g = currentGift;
    const orderTag = ` #${g.id}`;
    const waMsg = `Buenos días, estoy pagando el regalo${orderTag}, adjunto la constancia 🧾`;
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    list.innerHTML = `
      <div class="da-confirm">
        <div class="da-confirm-check">✓</div>
        <h4>Paga tu regalo</h4>
        <div class="da-confirm-id">Regalo #${g.id}</div>
        <p>Total: <b>S/ ${g.total}</b>${g.elegido ? ' · la persona regalada ya eligió' : ' · en cuanto pagues, te damos el link para compartir'}</p>
        <div class="da-pay-card">
          <div class="da-pay-title">Yape</div>
          <img src="assets/pago-yape.jpg" alt="Código QR para pagar por Yape" class="da-pay-qr"/>
          <div class="da-pay-name">${escapeHtml(pago.nombreYape)}</div>
          <a class="da-btn da-btn-wa" style="width:100%" href="${waUrl}" target="_blank" rel="noopener" id="da-gift-pay-wa">Ya pagué, avisar por WhatsApp</a>
          <p class="da-pay-note">Al abrirse WhatsApp, adjunta la captura de tu pago como segundo mensaje.</p>
        </div>
      </div>
    `;
    foot.innerHTML = '';
    document.getElementById('da-gift-pay-wa').addEventListener('click', (e)=>{
      trackGA4Event('purchase', {
        currency: 'PEN',
        transaction_id: g.id || 'gift_wa_' + Date.now(),
        value: g.total,
        items: g.items.map(c => formatGA4Item(c, c.qty))
      });
      // No dejamos que el navegador salte a WhatsApp ANTES de que el registro del pago
      // llegue al servidor: en móvil, el cambio a la app de WhatsApp puede abortar un
      // fetch que todavía está en camino, y el pago nunca queda registrado (bug real
      // reportado: "pagué" pero no se creó el pedido ni salió la alerta).
      e.preventDefault();
      withTimeout(markGiftPaid(g.id), 2500).finally(()=>{
        // El pago es obligatorio antes de compartir: recién ahora mostramos el link.
        // Si por algún motivo ya habían elegido antes de pagar, no hay nada que compartir.
        if(!g.elegido){ giftStep = 'compartir'; renderCart(); }
        window.open(waUrl, '_blank', 'noopener');
      });
    });
  }
  function withTimeout(promise, ms){
    return Promise.race([promise, new Promise(res=>setTimeout(res, ms))]);
  }
  async function markGiftPaid(giftId){
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/mark-gift-paid`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftId }), keepalive: true
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(data.ok){ if(currentGift) currentGift.pagado = true; showToast('¡Pago registrado, gracias!'); }
    }catch(e){ /* best-effort: igual se abre WhatsApp para avisar */ }
  }

  // Entrada del comprador que vuelve a pagar un regalo pendiente (?pagar_regalo=id)
  async function openGiftPayLink(giftId){
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/get-gift`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftId })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!data.ok){ showToast(data.error || 'No encontramos ese regalo'); return; }
      currentGift = data.gift;
      giftRole = 'comprador'; giftMode = true; giftStep = 'pagar';
      renderCart();
      document.getElementById('da-bd').classList.add('open');
      document.getElementById('da-cart').classList.add('open');
    }catch(e){ showToast('No se pudo cargar el regalo'); }
  }

  // ─── Entrada de la persona regalada (?regalo=id) ───
  async function openGiftClaim(giftId){
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/get-gift`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ giftId })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!data.ok){ showToast(data.error || 'Este link de regalo no existe o ya expiró'); return; }
      currentGift = data.gift;
      giftClaimStep = data.gift.elegido ? 'gracias' : 'elegir';
      giftClaimChoice = null; giftClaimResult = null; giftClaimFilterText = '';
      giftRole = 'regalada'; giftMode = true;
      renderCart();
      document.getElementById('da-bd').classList.add('open');
      document.getElementById('da-cart').classList.add('open');
    }catch(e){ showToast('No se pudo cargar el regalo'); }
  }
  function renderGiftClaim(list, foot){
    const g = currentGift;
    if(giftClaimStep === 'gracias'){
      const compradorTel = g.compradorTelefono;
      const orderId = giftClaimResult?.orderId;
      const msg = orderId
        ? `¡Hola! Ya elegí mi regalo 🎁 (pedido #${orderId}). ¡Gracias!`
        : `¡Hola! Ya elegí mi regalo 🎁 — falta pagarlo para coordinar el envío. Aquí puedes hacerlo: ${buildShareUrl({ pagar_regalo: g.id })}`;
      const waUrl = compradorTel ? `https://wa.me/51${compradorTel}?text=${encodeURIComponent(msg)}` : null;
      list.innerHTML = `
        <div class="da-confirm">
          <div class="da-confirm-check">✓</div>
          <h4>¡Ya elegiste tu regalo!</h4>
          <p>${orderId ? 'Ya está todo pagado — pronto coordinamos la entrega contigo.' : 'Avísale a quien te lo regaló para que complete el pago.'}</p>
          ${waUrl ? `<a class="da-btn da-btn-wa" style="width:100%" href="${waUrl}" target="_blank" rel="noopener">Avisar por WhatsApp</a>` : ''}
        </div>`;
      foot.innerHTML = '';
      return;
    }
    const showFilter = g.items.length > 6;
    list.innerHTML = `
      <div class="da-gift-banner">🎁 <b>¡Es un regalo para ti!</b> Elige el que más te guste.</div>
      ${showFilter ? `<input type="text" id="gift-claim-filter" placeholder="Buscar por nombre o marca..." style="width:100%;padding:10px 14px;border:1.5px solid rgba(60,47,71,0.15);border-radius:10px;margin-bottom:12px;font-family:inherit;font-size:13px;color:#3c2f47"/>` : ''}
      <div id="gift-claim-options"></div>
      <div id="gift-claim-address" class="da-order-form" style="margin-top:16px"></div>
      <button class="da-btn da-btn-primary" style="width:100%;margin-top:14px;flex:none" id="gift-claim-confirm" disabled>Confirmar mi elección</button>
    `;
    foot.innerHTML = '';
    renderGiftClaimOptions();
    if(showFilter){
      const filterInput = document.getElementById('gift-claim-filter');
      filterInput.value = giftClaimFilterText;
      filterInput.addEventListener('input', e=>{ giftClaimFilterText = e.target.value; renderGiftClaimOptions(); });
    }
    renderGiftClaimAddressAndButton();
  }
  // Lista de opciones de la persona regalada — separado para poder re-renderizar solo esto
  // al buscar, sin perder lo que ya escribió en la dirección más abajo.
  function renderGiftClaimOptions(){
    const g = currentGift;
    const box = document.getElementById('gift-claim-options');
    if(!box) return;
    const words = normText(giftClaimFilterText).split(/\s+/).filter(Boolean);
    const visible = g.items
      .map((it,i)=>({ it, i }))
      .filter(({it}) => !words.length || words.every(w => normText(`${it.name} ${it.inspiration||''}`).includes(w)));
    if(!visible.length){
      box.innerHTML = `<p style="text-align:center;color:#5d4c70;font-size:13px;padding:16px 0">No encontramos nada con esa búsqueda.</p>`;
      return;
    }
    box.innerHTML = visible.map(({it,i})=>`
      <div class="da-gift-radio ${giftClaimChoice===i?'selected':''}" data-idx="${i}">
        <img src="${giftItemPhoto(it)}" alt="" onerror="this.style.visibility='hidden'"/>
        <div><div class="n">${escapeHtml(it.name)}</div><div class="m">${it.ml} ml${it.inspiration ? ' · '+escapeHtml(it.inspiration) : ''}${it.premium?' · frasco premium incluido':''}</div></div>
        <div class="da-radio-dot"></div>
      </div>`).join('');
    box.querySelectorAll('.da-gift-radio').forEach(row => row.addEventListener('click', ()=>{
      giftClaimChoice = +row.dataset.idx;
      box.querySelectorAll('.da-gift-radio').forEach(r=>r.classList.remove('selected'));
      row.classList.add('selected');
      renderGiftClaimAddressAndButton();
    }));
  }
  function renderGiftClaimAddressAndButton(){
    const addrBox = document.getElementById('gift-claim-address');
    const btn = document.getElementById('gift-claim-confirm');
    if(!addrBox || !btn) return;
    if(giftClaimChoice === null){ btn.disabled = true; return; }
    if(!addrBox.dataset.rendered){
      addrBox.dataset.rendered = '1';
      addrBox.innerHTML = `
        <label>Tu nombre
          <input type="text" id="gcf-nombre" placeholder="Tu nombre completo"/>
        </label>
        <label>Tu WhatsApp
          <input type="tel" id="gcf-telefono" inputmode="numeric" placeholder="987654321"/>
        </label>
        <label>Distrito
          <input type="text" id="gcf-distrito" placeholder="Tu distrito"/>
        </label>
        <label>Dirección
          <input type="text" id="gcf-direccion" placeholder="Calle, número, referencia"/>
        </label>
        <label>Referencia (opcional)
          <input type="text" id="gcf-referencia" placeholder="Ej. cerca al parque"/>
        </label>
      `;
      document.getElementById('gcf-telefono').addEventListener('input', e=>{ e.target.value = e.target.value.replace(/\D/g,'').slice(-9); });
    }
    btn.disabled = false;
    btn.onclick = claimGift;
  }
  async function claimGift(){
    if(giftClaimChoice === null) return;
    const nombre = document.getElementById('gcf-nombre').value.trim();
    const telefono = document.getElementById('gcf-telefono').value.trim();
    const distrito = document.getElementById('gcf-distrito').value.trim();
    const direccion = document.getElementById('gcf-direccion').value.trim();
    const referencia = document.getElementById('gcf-referencia').value.trim();
    if(!nombre || !telefono || !distrito || !direccion){ showToast('Completa tus datos de entrega'); return; }
    const btn = document.getElementById('gift-claim-confirm');
    if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
    try{
      const r = await fetch(`${ORDER_API_BASE}/api/claim-gift`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ giftId: currentGift.id, eleccionIndex: giftClaimChoice, nombre, telefono, distrito, direccion, referencia })
      });
      const data = await r.json().catch(()=>({ok:false}));
      if(!r.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar tu elección');
      currentGift.compradorTelefono = data.compradorTelefono || currentGift.compradorTelefono;
      giftClaimResult = { orderId: data.orderId };
      giftClaimStep = 'gracias';
      renderCart();
    }catch(e){
      showToast('No se pudo guardar tu elección: ' + e.message);
      if(btn){ btn.disabled = false; btn.textContent = 'Confirmar mi elección'; }
    }
  }

  // ─── WhatsApp ───
  // Respaldo para quien no tiene WhatsApp instalado/logueado en ese dispositivo (ej. tablets):
  // deja copiar el pedido o mandarlo por correo, para que el pedido nunca quede sin salida.
  function waFallbackHtml(idPrefix){
    return `<div class="da-wa-fallback">
      <span>¿No tenés WhatsApp acá?</span>
      <button type="button" id="${idPrefix}-copy">Copiar pedido</button>
      <span class="sep">·</span>
      <button type="button" id="${idPrefix}-mail">Enviar por correo</button>
    </div>`;
  }
  function wireWaFallback(idPrefix, getItems, single){
    const copyBtn = document.getElementById(`${idPrefix}-copy`);
    const mailBtn = document.getElementById(`${idPrefix}-mail`);
    if(copyBtn) copyBtn.addEventListener('click', async ()=>{
      const items = getItems();
      if(!items.length){ showToast('Tu bolsa está vacía'); return; }
      const text = `${buildWhatsAppMessage(items, single)}\n\nEnvialo a: +51 930 122 014 (WhatsApp o SMS) o ${EMAIL}`;
      try{ await navigator.clipboard.writeText(text); showToast('Pedido copiado — pegalo donde puedas escribirnos'); }
      catch(e){ showToast('No se pudo copiar el pedido'); }
    });
    if(mailBtn) mailBtn.addEventListener('click', ()=>{
      const items = getItems();
      if(!items.length){ showToast('Tu bolsa está vacía'); return; }
      const body = encodeURIComponent(buildWhatsAppMessage(items, single));
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Pedido Dolce Aroma')}&body=${body}`;
    });
  }
  function buildWhatsAppMessage(items, single){
    const lines = [];
    lines.push('Hola Dolce Aroma 👋,');
    lines.push(single ? 'Quisiera pedir este perfume:' : 'Quisiera hacer este pedido:');
    lines.push('');
    let subtotal = 0;
    items.forEach((it,i) => {
      const p = catalog.find(x=>x.id===it.id);
      if(!p) return;
      const sz = p.sizes.find(s=>s.ml===it.ml) || {};
      const sub = (sz.price||0)*it.qty;
      subtotal += sub;
      lines.push(`${i+1}. *${p.name}* — ${it.ml} ml`);
      lines.push(`   Cantidad: ${it.qty} · Subtotal: S/ ${sub}`);
    });
    lines.push('');
    if(!single){
      const offers = computeOffers();
      if(offers.discounts.length){
        lines.push(`Subtotal: S/ ${offers.subtotal}`);
        offers.discounts.forEach(d => {
          lines.push(`Oferta ${d.label} (×${d.count}): − S/ ${d.amount}`);
        });
        lines.push(`*Total con ofertas: S/ ${offers.total}*`);
      } else {
        lines.push(`*Total estimado: S/ ${subtotal}*`);
      }
    } else {
      lines.push(`*Total estimado: S/ ${subtotal}*`);
    }
    lines.push('');
    lines.push('¿Está disponible? Quedo atento(a). ¡Gracias!');
    return lines.join('\n');
  }

  // ─── Compartir ───
  function buildShareUrl(params){
    // Usa el alias sin espacios (catalogo.html) — algunas apps (WhatsApp entre otras) decodifican
    // %20 a espacio antes de enviar el mensaje, y el espacio literal corta el link a la mitad.
    const base = location.origin + location.pathname.substring(0, location.pathname.lastIndexOf('/')+1);
    const qs = new URLSearchParams(params).toString();
    return base + 'catalogo.html' + (qs ? '?' + qs : '');
  }
  async function shareViaClipboard(text){
    try{ await navigator.clipboard.writeText(text); showToast('Enlace copiado'); }
    catch(e){ showToast('No se pudo copiar el enlace'); }
  }
  async function shareProduct(p){
    const sz = (p.sizes||[]).find(s=>s.stock>0 && s.price) || (p.sizes||[]).find(s=>s.price) || {};
    const url = buildShareUrl({ p: p.id });
    const text = `${p.name} — inspirado en ${p.inspiration||'Atelier'}. Desde S/ ${sz.price||''} en Dolce Aroma.`;
    if(navigator.share){
      try{ await navigator.share({ title: p.name, text, url }); }catch(e){ /* el usuario canceló */ }
    } else {
      shareViaClipboard(`${text} ${url}`);
    }
  }
  async function shareCart(){
    if(cart.length === 0){ showToast('Tu bolsa está vacía'); return; }
    const offers = computeOffers();
    const lines = ['Mi bolsa en Dolce Aroma (abrí el link para agregarla a la tuya):'];
    cart.forEach(it => {
      const p = catalog.find(x=>x.id===it.id);
      if(!p) return;
      lines.push(`• ${p.name} (${it.ml} ml) ×${it.qty}`);
    });
    lines.push(`Total: S/ ${offers.total}`);
    const text = lines.join('\n');
    const cartParam = cart.map(it => `${it.id}:${it.ml}:${it.qty}`).join(',');
    const url = buildShareUrl({ cart: cartParam });
    if(navigator.share){
      try{ await navigator.share({ title: 'Mi bolsa Dolce Aroma', text, url }); }catch(e){ /* el usuario canceló */ }
    } else {
      shareViaClipboard(`${text}\n${url}`);
    }
  }
  // Carga en la bolsa actual los perfumes de un link compartido (?cart=id:ml:qty,...), sumando sin borrar lo que ya había.
  function loadSharedCart(raw){
    const items = raw.split(',').map(s => {
      const [id, ml, qty] = s.split(':');
      return { id, ml:+ml, qty:+qty };
    }).filter(it => it.id && it.ml>0 && it.qty>0 && catalog.find(x=>x.id===it.id));
    if(!items.length) return;
    items.forEach(it => {
      const ex = cart.find(c=>c.id===it.id && c.ml===it.ml);
      if(ex) ex.qty += it.qty; else cart.push({id:it.id, ml:it.ml, qty:it.qty});
    });
    saveCart();
    showToast(`Se agregaron ${items.length} perfume${items.length===1?'':'s'} de la bolsa compartida`);
    openCart();
  }

  // ─── Helpers ───
  function resolvePhoto(p){
    if(!p.photo) return 'assets/perfume-110ml.jpg';
    if(p.photo.startsWith('idb:') || p.photo.startsWith('data:')) return 'assets/perfume-110ml.jpg';
    if(p.photo.startsWith('assets/') || p.photo.startsWith('http')) return p.photo;
    return 'assets/perfumes/' + p.photo;
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ─── API pública ───
  window.DA = {
    async init(opts){
      injectCSS();
      injectChrome();
      await Promise.all([loadCatalog(), loadZonas(), loadPago()]);
      loadCart();
      refreshBadges();
      document.querySelectorAll('[data-cart-open]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openCart(); }));
      if(opts?.onReady) opts.onReady(catalog);
      const shareParams = new URLSearchParams(location.search);
      // Link compartido (?p=id) → abre directo el detalle de ese perfume
      const sharedId = shareParams.get('p');
      if(sharedId && catalog.find(x=>x.id===sharedId)) openDetail(sharedId);
      // Link de bolsa compartida (?cart=id:ml:qty,...) → suma esos perfumes a la bolsa actual
      const sharedCart = shareParams.get('cart');
      if(sharedCart) loadSharedCart(sharedCart);
      // Link de regalo (?regalo=id) → la persona regalada elige su perfume
      const giftId = shareParams.get('regalo');
      if(giftId) openGiftClaim(giftId);
      // Link para que el comprador vuelva a pagar un regalo (?pagar_regalo=id)
      const payGiftId = shareParams.get('pagar_regalo');
      if(payGiftId) openGiftPayLink(payGiftId);
    },
    getCatalog: () => catalog,
    openDetail,
    openCart,
    openGiftBuilder,
    addToCart,
    resolvePhoto,
    estiloFor: giftEstiloFor,
    constants: { FAMILY_LABEL, TAG_LABEL, GENDER_LABEL, WHATSAPP_NUMBER }
  };
})();
