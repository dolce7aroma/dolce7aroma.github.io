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
  const STORAGE_CATALOG = 'dolce-aroma-perfumes-v1'; // (compat: edits del admin)
  const STORAGE_CART    = 'dolce-aroma-cart-v1';
  const CATALOG_URLS    = ['data/productos.json', 'data/perfumes.json'];

  const FAMILY_LABEL = {floral:'Floral', oriental:'Oriental', amaderado:'Amaderado', citrico:'Cítrico', chipre:'Chipre', aromatico:'Aromático', frutal:'Frutal'};
  const TAG_LABEL    = {'mas-vendido':'Más vendido','nuevo':'Nuevo','edicion-limitada':'Edición limitada','agotado':'Agotado'};
  const GENDER_LABEL = {mujer:'Mujer', hombre:'Hombre', unisex:'Unisex'};
  const ICON_SHARE = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>`;

  let catalog = [];
  let cart = [];   // [{id, ml, qty}]

  // ─── Carga catálogo ───
  async function loadCatalog(){
    // Prioridad: edits locales del admin → productos.json → perfumes.json
    try{
      const raw = localStorage.getItem(STORAGE_CATALOG);
      if(raw){ const d = JSON.parse(raw); if(Array.isArray(d.perfumes) && d.perfumes.length){ catalog = d.perfumes; return; } }
    }catch(e){}
    for(const u of CATALOG_URLS){
      try{
        const r = await fetch(u, {cache:'no-cache'});
        if(!r.ok) continue;
        const j = await r.json();
        if(Array.isArray(j.perfumes) && j.perfumes.length){ catalog = j.perfumes; return; }
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
  //   50 ml : trío -S/ 15 plano (Trío Esencial) · dúo -S/ 19 plano (Dúo Esencial)
  //   10 ml : trío -S/ 10 plano (Trío Pocket) · sin oferta de dúo
  const TRIO_TIERS = {
    110: { label: 'Trío Premium · 110 ml', perTrio: (cheapest) => Math.round(cheapest * 0.5) },
    50:  { label: 'Trío Esencial · 50 ml',  perTrio: () => 15 },
    10:  { label: 'Trío Pocket · 10 ml',    perTrio: () => 10 }
  };
  const DUO_TIERS = {
    110: { label: 'Dúo Premium · 110 ml', amount: 30 },
    50:  { label: 'Dúo Esencial · 50 ml',  amount: 19 }
  };
  function computeOffers(){
    const groups = {}; // ml -> [unit price, ...]
    cart.forEach(it => {
      const p = catalog.find(x => x.id === it.id);
      const sz = p?.sizes?.find(s => s.ml === it.ml);
      if(!sz) return;
      groups[it.ml] = groups[it.ml] || [];
      for(let i=0;i<it.qty;i++) groups[it.ml].push(sz.price||0);
    });
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
  function addToCart(item){
    const ex = cart.find(c=>c.id===item.id && c.ml===item.ml);
    if(ex) ex.qty += item.qty || 1;
    else cart.push({id:item.id, ml:item.ml, qty:item.qty||1});
    saveCart();
    bumpCount();
    showToast(buildAddToast(item.ml));
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
  function removeFromCart(id, ml){ cart = cart.filter(c => !(c.id===id && c.ml===ml)); saveCart(); renderCart(); }
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
      .da-btn-icon{flex:0 0 auto;width:52px;padding:16px 0}
      .da-close{position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;background:#f6f4ef;border:0;cursor:pointer;display:grid;place-items:center;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,0.15)}
      .da-close svg{width:16px;height:16px;stroke:#3c2f47;fill:none;stroke-width:1.8}

      .da-cart{position:fixed;top:0;right:-460px;width:440px;max-width:100vw;height:100vh;background:#f6f4ef;z-index:100;display:flex;flex-direction:column;transition:right .3s cubic-bezier(.2,.7,.2,1);box-shadow:-30px 0 80px -20px rgba(0,0,0,0.3)}
      .da-cart.open{right:0}
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
        .da-cart{width:100vw;right:-100vw}
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
          <h3>Tu <em style="color:#a8895a;font-style:italic">bolsa</em></h3>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="da-close" id="da-cart-share" style="position:static;box-shadow:none;background:transparent" title="Compartir bolsa">${ICON_SHARE}</button>
            <button class="da-close" id="da-cart-close" style="position:static;box-shadow:none;background:transparent"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
          </div>
        </div>
        <div class="da-cart-list" id="da-cart-list"></div>
        <div class="da-cart-foot" id="da-cart-foot"></div>
      </aside>
      <div class="da-toast" id="da-toast"></div>
    `);
    document.getElementById('da-bd').addEventListener('click', ()=>{ closeModal(); closeCart(); });
    document.getElementById('da-cart-close').addEventListener('click', closeCart);
    document.getElementById('da-cart-share').addEventListener('click', shareCart);
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
        <div>
          <div class="insp">Inspirado en · ${escapeHtml(p.inspiration||'Atelier')}</div>
          <h2>${escapeHtml(p.name)}</h2>
          <div class="sub">
            <span><i class="d"></i>${FAMILY_LABEL[p.family]||p.family||''}</span>
            <span><i class="d"></i>${GENDER_LABEL[p.gender]||p.gender||''}</span>
            ${p.intensity ? `<span><i class="d"></i>${p.intensity}</span>`:''}
          </div>
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
          <button class="da-btn da-btn-ghost da-btn-icon" id="da-share" title="Compartir este perfume">${ICON_SHARE}</button>
          <button class="da-btn da-btn-wa" id="da-buy-wa" title="Pedir solo este por WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.8.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
          </button>
        </div>
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
      const msg = buildWhatsAppMessage([{id:p.id, ml:targetMl, qty}], true);
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });
    document.getElementById('da-share').addEventListener('click', ()=> shareProduct(p));

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
  function openCart(){ renderCart(); document.getElementById('da-bd').classList.add('open'); document.getElementById('da-cart').classList.add('open'); }
  function closeCart(){
    document.getElementById('da-cart')?.classList.remove('open');
    if(!document.getElementById('da-modal')?.classList.contains('open')){
      document.getElementById('da-bd')?.classList.remove('open');
    }
  }
  function renderCart(){
    const list = document.getElementById('da-cart-list');
    const foot = document.getElementById('da-cart-foot');
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
      <button class="da-btn da-btn-wa" style="width:100%" id="da-checkout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5-.6-1.4-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2 0 1.3 1 2.6 1.1 2.8.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
        Hacer pedido por WhatsApp
      </button>
      <button class="da-btn da-btn-ghost" style="width:100%;margin-top:8px" id="da-clear">Vaciar bolsa</button>
    `;
    document.getElementById('da-checkout').addEventListener('click', ()=>{
      const msg = buildWhatsAppMessage(cart, false);
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    });
    document.getElementById('da-clear').addEventListener('click', ()=>{
      if(confirm('¿Vaciar la bolsa?')){ cart=[]; saveCart(); renderCart(); }
    });
    document.getElementById('da-keep-shopping')?.addEventListener('click', closeCart);
  }

  // ─── WhatsApp ───
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
    const base = location.origin + location.pathname.substring(0, location.pathname.lastIndexOf('/')+1);
    const qs = new URLSearchParams(params).toString();
    return base + 'Dolce%20Aroma%20-%20Catalogo.html' + (qs ? '?' + qs : '');
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
    const lines = ['Mi bolsa en Dolce Aroma:'];
    cart.forEach(it => {
      const p = catalog.find(x=>x.id===it.id);
      if(!p) return;
      lines.push(`• ${p.name} (${it.ml} ml) ×${it.qty}`);
    });
    lines.push(`Total: S/ ${offers.total}`);
    const text = lines.join('\n');
    const url = buildShareUrl();
    if(navigator.share){
      try{ await navigator.share({ title: 'Mi bolsa Dolce Aroma', text, url }); }catch(e){ /* el usuario canceló */ }
    } else {
      shareViaClipboard(`${text}\n${url}`);
    }
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
      await loadCatalog();
      loadCart();
      refreshBadges();
      document.querySelectorAll('[data-cart-open]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); openCart(); }));
      if(opts?.onReady) opts.onReady(catalog);
      // Link compartido (?p=id) → abre directo el detalle de ese perfume
      const sharedId = new URLSearchParams(location.search).get('p');
      if(sharedId && catalog.find(x=>x.id===sharedId)) openDetail(sharedId);
    },
    getCatalog: () => catalog,
    openDetail,
    openCart,
    addToCart,
    resolvePhoto,
    constants: { FAMILY_LABEL, TAG_LABEL, GENDER_LABEL, WHATSAPP_NUMBER }
  };
})();
