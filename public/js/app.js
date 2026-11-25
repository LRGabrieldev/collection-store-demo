(() => {
  'use strict';

  const STORAGE_ITEMS_KEY = 'collection_store_order_items_v1';
  const STORAGE_CUSTOMER_KEY = 'collection_store_customer_v1';

  let CATEGORIES = Array.isArray(window.STORE_CATEGORIES) ? window.STORE_CATEGORIES : [];
  let PRODUCTS = (Array.isArray(window.STORE_PRODUCTS) ? window.STORE_PRODUCTS : []).filter((p) => p.active !== false);
  const CONFIG = window.STORE_CONFIG || {};

  const state = {
    activeCategory: 'all',
    searchQuery: '',
    sortBy: 'featured',
    selectedVariants: {},
    orderItems: loadOrderItems(),
    customer: loadCustomer()
  };

  function initDefaultVariants() {
    PRODUCTS.forEach((product) => {
      if (state.selectedVariants[product.id] === undefined) {
        state.selectedVariants[product.id] = 0;
      }
    });
  }

  initDefaultVariants();

  // DOM References
  const els = {
    scrollProgress: document.getElementById('scroll-progress'),
    siteHeader: document.getElementById('site-header'),
    mainNav: document.getElementById('main-nav'),
    mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
    headerOrderBtn: document.getElementById('header-order-btn'),
    headerOrderCount: document.getElementById('header-order-count'),
    heroTiltFrame: document.getElementById('hero-tilt-frame'),
    heroLiveStatus: document.getElementById('hero-live-status'),
    departmentsGrid: document.getElementById('departments-grid'),
    categoryTabs: document.getElementById('category-tabs'),
    catalogSearch: document.getElementById('catalog-search'),
    catalogSort: document.getElementById('catalog-sort'),
    catalogCount: document.getElementById('catalog-count'),
    contextAssurance: document.getElementById('context-assurance'),
    productsGrid: document.getElementById('products-grid'),
    bgForm: document.getElementById('background-order-form'),
    bgHiddenFields: document.getElementById('bg-form-hidden-fields'),
    bgSerializedOrder: document.getElementById('bg-serialized-order'),
    formItemsCount: document.getElementById('form-items-count'),
    checkoutItemsList: document.getElementById('checkout-items-list'),
    summaryTotalUnits: document.getElementById('summary-total-units'),
    summaryTotalPrice: document.getElementById('summary-total-price'),
    customerName: document.getElementById('customer-name'),
    customerPhone: document.getElementById('customer-phone'),
    deliveryMethod: document.getElementById('delivery-method'),
    paymentMethod: document.getElementById('payment-method'),
    orderNotes: document.getElementById('order-notes'),
    waMessagePreview: document.getElementById('wa-message-preview'),
    btnClearOrder: document.getElementById('btn-clear-order'),
    btnCopyOrder: document.getElementById('btn-copy-order'),
    floatingCartBar: document.getElementById('floating-cart-bar'),
    floatingCountText: document.getElementById('floating-count-text'),
    floatingTotalText: document.getElementById('floating-total-text'),
    floatingOpenDrawer: document.getElementById('floating-open-drawer'),
    floatingFinishWa: document.getElementById('floating-finish-wa'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    orderDrawer: document.getElementById('order-drawer'),
    drawerCloseBtn: document.getElementById('drawer-close-btn'),
    drawerItemsList: document.getElementById('drawer-items-list'),
    drawerTotalPrice: document.getElementById('drawer-total-price'),
    drawerGoWhatsapp: document.getElementById('drawer-go-whatsapp'),
    drawerGoForm: document.getElementById('drawer-go-form'),
    waConfirmModal: document.getElementById('whatsapp-confirm-modal'),
    waModalClose: document.getElementById('wa-modal-close'),
    waDirectLink: document.getElementById('wa-direct-link'),
    waModalCopy: document.getElementById('wa-modal-copy'),
    currentYear: document.getElementById('current-year'),
    toastContainer: document.getElementById('toast-container')
  };

  /* ========================================================================
     Formatting & Helpers
     ======================================================================== */
  function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value) || 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizePhoneDigits(raw) {
    return String(raw || '').replace(/\D/g, '');
  }

  function getActiveWhatsappNumber() {
    const clean = sanitizePhoneDigits(CONFIG.whatsappNumber || '5500900000000');
    return clean.length <= 11 ? `55${clean}` : clean;
  }

  function makeItemKey(productId, variantLabel) {
    return `${productId}__${variantLabel}`;
  }

  /* ========================================================================
     Local Storage Persistence
     ======================================================================== */
  function loadOrderItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_ITEMS_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveOrderItems() {
    try {
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(state.orderItems));
    } catch {
      // Ignora erro caso storage esteja indisponível
    }
  }

  function loadCustomer() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_CUSTOMER_KEY));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveCustomer() {
    try {
      localStorage.setItem(STORAGE_CUSTOMER_KEY, JSON.stringify(state.customer));
    } catch {
      // Ignora erro caso storage esteja indisponível
    }
  }

  /* ========================================================================
     Toast Notifications
     ======================================================================== */
  function showToast(message) {
    if (!els.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `<span style="color: var(--gold-light);">✦</span><span>${escapeHtml(message)}</span>`;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 2800);
  }

  /* ========================================================================
     Render Departments Bento & Category Filter Tabs
     ======================================================================== */
  function renderDepartments() {
    const departments = CATEGORIES.filter((cat) => cat.id !== 'all');
    els.departmentsGrid.innerHTML = departments.map((dept) => `
      <button type="button" class="dept-card" data-category="${escapeHtml(dept.id)}" aria-label="Filtrar por ${escapeHtml(dept.name)}">
        <img class="dept-card__img" src="${escapeHtml(dept.image)}" alt="${escapeHtml(dept.name)}" loading="lazy" />
        <div class="dept-card__overlay"></div>
        <div class="dept-card__body">
          <span class="dept-card__badge">${escapeHtml(dept.badge)}</span>
          <h3 class="dept-card__title">${escapeHtml(dept.name)}</h3>
          <p class="dept-card__sub">${escapeHtml(dept.subtitle)}</p>
        </div>
      </button>
    `).join('');
  }

  function renderCategoryTabs() {
    els.categoryTabs.innerHTML = CATEGORIES.map((cat) => {
      const count = cat.id === 'all'
        ? PRODUCTS.length
        : PRODUCTS.filter((p) => p.category === cat.id).length;
      const isActive = state.activeCategory === cat.id;
      return `
        <button
          type="button"
          role="tab"
          aria-selected="${isActive}"
          class="category-tab ${isActive ? 'is-active' : ''}"
          data-category="${escapeHtml(cat.id)}"
        >
          <span>${escapeHtml(cat.shortName)}</span>
          <span class="category-tab__count">(${count})</span>
        </button>
      `;
    }).join('');
  }

  function updateContextAssurance() {
    const messages = {
      perfumes: {
        title: 'Perfumes Importados 100% Originais',
        text: 'Fragrâncias lacradas com procedência garantida e excelente fixação. Selecione sua volumetria desejada.'
      },
      sexshop: {
        title: 'Compra & Entrega 100% Discreta',
        text: 'Seus itens de bem-estar íntimo são preparados em embalagem neutra sem identificação de loja ou produto.'
      },
      iphone: {
        title: 'iPhones Originais Novos & Seminovos',
        text: 'Aparelhos revisados com garantia da loja e bateria 94%+ nos seminovos, ou lacrados Anatel com 1 ano Apple.'
      },
      'marca-propria': {
        title: 'Marca Própria Collection Store',
        text: 'Peças autorais exclusivas com modelagem impecável e tecidos selecionados.'
      }
    };

    const info = messages[state.activeCategory];
    if (!info) {
      els.contextAssurance.classList.remove('is-visible');
      els.contextAssurance.innerHTML = '';
      return;
    }

    els.contextAssurance.innerHTML = `
      <div>
        <strong>${escapeHtml(info.title)}:</strong>
        <span>${escapeHtml(info.text)}</span>
      </div>
    `;
    els.contextAssurance.classList.add('is-visible');
  }

  /* ========================================================================
     Product Filtering, Sorting & Rendering
     ======================================================================== */
  function getFilteredProducts() {
    const query = state.searchQuery.trim().toLowerCase();

    const filtered = PRODUCTS.filter((product) => {
      const matchesCat = state.activeCategory === 'all' || product.category === state.activeCategory;
      if (!matchesCat) return false;
      if (!query) return true;

      const haystack = [
        product.name,
        product.brand,
        product.description,
        product.tag,
        product.category,
        ...product.variants.map((v) => v.label)
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    });

    const sorted = [...filtered];
    if (state.sortBy === 'price-asc') {
      sorted.sort((a, b) => a.variants[0].price - b.variants[0].price);
    } else if (state.sortBy === 'price-desc') {
      sorted.sort((a, b) => b.variants[0].price - a.variants[0].price);
    } else if (state.sortBy === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    return sorted;
  }

  function findOrderItemQty(productId, variantLabel) {
    const key = makeItemKey(productId, variantLabel);
    const found = state.orderItems.find((item) => item.key === key);
    return found ? found.qty : 0;
  }

  function renderProducts() {
    const list = getFilteredProducts();
    els.catalogCount.textContent = `Exibindo ${list.length} ${list.length === 1 ? 'item' : 'itens'}`;

    if (list.length === 0) {
      els.productsGrid.innerHTML = `
        <div class="empty-catalog">
          <h3 style="font-family: var(--font-display); font-size: 1.7rem; margin: 0 0 0.5rem;">Nenhum item encontrado</h3>
          <p style="color: var(--ink-muted); margin: 0 0 1rem;">Tente limpar a busca ou visualizar todos os departamentos.</p>
          <button type="button" class="btn btn--gold btn-sm" id="reset-filters-btn">Mostrar Todos os Itens</button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-filters-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.activeCategory = 'all';
          state.searchQuery = '';
          els.catalogSearch.value = '';
          renderCategoryTabs();
          updateContextAssurance();
          renderProducts();
        });
      }
      return;
    }

    els.productsGrid.innerHTML = list.map((product, index) => {
      const activeVariantIdx = state.selectedVariants[product.id] || 0;
      const activeVariant = product.variants[activeVariantIdx] || product.variants[0];
      const currentQty = findOrderItemQty(product.id, activeVariant.label);
      const totalSelectedForProduct = state.orderItems
        .filter((item) => item.productId === product.id)
        .reduce((acc, item) => acc + item.qty, 0);

      const variantsHtml = product.variants.map((variant, vIdx) => `
        <button
          type="button"
          class="variant-chip ${vIdx === activeVariantIdx ? 'is-active' : ''}"
          data-action="select-variant"
          data-product-id="${escapeHtml(product.id)}"
          data-variant-index="${vIdx}"
        >
          ${escapeHtml(variant.label)}
        </button>
      `).join('');

      const actionHtml = currentQty > 0
        ? `
          <div class="qty-control-inline" aria-label="Controle de quantidade">
            <button type="button" class="qty-btn" data-action="decrement" data-product-id="${escapeHtml(product.id)}" aria-label="Diminuir quantidade">−</button>
            <span class="qty-value">${currentQty}</span>
            <button type="button" class="qty-btn" data-action="increment" data-product-id="${escapeHtml(product.id)}" aria-label="Aumentar quantidade">+</button>
          </div>
        `
        : `
          <button type="button" class="btn-add-item" data-action="add-item" data-product-id="${escapeHtml(product.id)}">
            <span>+ Selecionar Item</span>
          </button>
        `;

      return `
        <article class="product-card ${totalSelectedForProduct > 0 ? 'is-selected' : ''}" style="animation-delay: ${Math.min(index * 45, 360)}ms">
          <div class="product-card__media">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
            <div class="product-card__badges">
              <span class="product-tag">${escapeHtml(product.tag)}</span>
              ${totalSelectedForProduct > 0
                ? `<span class="product-selected-pill">No formulário (${totalSelectedForProduct})</span>`
                : ''}
            </div>
          </div>

          <div class="product-card__body">
            <span class="product-card__brand">${escapeHtml(product.brand)}</span>
            <h3 class="product-card__title">${escapeHtml(product.name)}</h3>
            <p class="product-card__desc">${escapeHtml(product.description)}</p>

            <div class="variant-group">
              <span class="variant-group__label">${escapeHtml(product.variantLabel)}</span>
              <div class="variant-chips">${variantsHtml}</div>
            </div>

            <div class="product-card__footer">
              <div class="product-price">
                <span class="product-price__label">Valor</span>
                <span class="product-price__value">${formatBRL(activeVariant.price)}</span>
              </div>
              ${actionHtml}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  /* ========================================================================
     Order Management & Background Form Generation
     ======================================================================== */
  function addOrUpdateItem(productId, delta) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;

    const vIdx = state.selectedVariants[product.id] || 0;
    const variant = product.variants[vIdx] || product.variants[0];
    const key = makeItemKey(product.id, variant.label);

    const existingIdx = state.orderItems.findIndex((item) => item.key === key);
    if (existingIdx >= 0) {
      const nextQty = state.orderItems[existingIdx].qty + delta;
      if (nextQty <= 0) {
        state.orderItems.splice(existingIdx, 1);
      } else {
        state.orderItems[existingIdx].qty = nextQty;
      }
    } else if (delta > 0) {
      state.orderItems.push({
        key,
        productId: product.id,
        category: product.category,
        brand: product.brand,
        name: product.name,
        variantLabel: variant.label,
        price: variant.price,
        qty: delta,
        image: product.image
      });
      showToast(`Adicionado ao formulário: ${product.name}`);
      triggerHeaderBump();
    }

    saveOrderItems();
    renderProducts();
    syncOrderEverywhere();
  }

  function updateItemQtyByKey(key, delta) {
    const idx = state.orderItems.findIndex((item) => item.key === key);
    if (idx < 0) return;

    const nextQty = state.orderItems[idx].qty + delta;
    if (nextQty <= 0) {
      state.orderItems.splice(idx, 1);
    } else {
      state.orderItems[idx].qty = nextQty;
    }

    saveOrderItems();
    renderProducts();
    syncOrderEverywhere();
  }

  function removeItemByKey(key) {
    state.orderItems = state.orderItems.filter((item) => item.key !== key);
    saveOrderItems();
    renderProducts();
    syncOrderEverywhere();
  }

  function clearAllItems() {
    if (state.orderItems.length === 0) return;
    state.orderItems = [];
    saveOrderItems();
    renderProducts();
    syncOrderEverywhere();
    showToast('Formulário de itens limpo.');
  }

  function triggerHeaderBump() {
    els.headerOrderBtn.classList.remove('is-bumping');
    void els.headerOrderBtn.offsetWidth;
    els.headerOrderBtn.classList.add('is-bumping');
  }

  function getOrderTotals() {
    return state.orderItems.reduce(
      (acc, item) => {
        acc.units += item.qty;
        acc.total += item.price * item.qty;
        return acc;
      },
      { units: 0, total: 0 }
    );
  }

  function buildWhatsAppMessage() {
    if (state.orderItems.length === 0) {
      return '';
    }

    const totals = getOrderTotals();
    const lines = [
      `Olá! Gostaria de finalizar meu pedido na *${CONFIG.storeName || 'Collection Store'}*:`,
      '',
      '*ITENS SELECIONADOS:*'
    ];

    state.orderItems.forEach((item, index) => {
      const subtotal = item.price * item.qty;
      lines.push(`${index + 1}. *${item.name}* (${item.brand})`);
      lines.push(`   • Opção: ${item.variantLabel}`);
      lines.push(`   • Qtd: ${item.qty}x ${formatBRL(item.price)} = *${formatBRL(subtotal)}*`);
    });

    lines.push('');
    lines.push(`*Total de peças/itens:* ${totals.units}`);
    lines.push(`*Valor total estimado:* ${formatBRL(totals.total)}`);

    const cName = (els.customerName.value || '').trim();
    const cPhone = (els.customerPhone.value || '').trim();
    const delivery = els.deliveryMethod.value;
    const payment = els.paymentMethod.value;
    const notes = (els.orderNotes.value || '').trim();

    lines.push('');
    lines.push('*DADOS DO PEDIDO:*');
    if (cName) lines.push(`• Nome: ${cName}`);
    if (cPhone) lines.push(`• WhatsApp: ${cPhone}`);
    lines.push(`• Recebimento: ${delivery}`);
    lines.push(`• Pagamento: ${payment}`);
    if (notes) lines.push(`• Observações: ${notes}`);

    const hasDiscreet = state.orderItems.some((item) =>
      ['sexshop', 'demillus', 'romance', 'dicorpo'].includes(item.category)
    );
    if (hasDiscreet) {
      lines.push('');
      lines.push('_Solicito embalagem discreta sem identificação externa._');
    }

    return lines.join('\n');
  }

  function syncBackgroundFormFields(totals, message) {
    // Cria e sincroniza os inputs ocultos reais dentro do <form id="background-order-form">
    const fragment = document.createDocumentFragment();

    state.orderItems.forEach((item, idx) => {
      const fields = {
        id: item.productId,
        marca: item.brand,
        produto: item.name,
        variacao: item.variantLabel,
        quantidade: item.qty,
        preco_unitario: item.price.toFixed(2),
        subtotal: (item.price * item.qty).toFixed(2)
      };

      Object.entries(fields).forEach(([fieldKey, val]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `itens[${idx}][${fieldKey}]`;
        input.value = String(val);
        fragment.appendChild(input);
      });
    });

    const totalUnitsInput = document.createElement('input');
    totalUnitsInput.type = 'hidden';
    totalUnitsInput.name = 'resumo[total_unidades]';
    totalUnitsInput.value = String(totals.units);
    fragment.appendChild(totalUnitsInput);

    const totalValueInput = document.createElement('input');
    totalValueInput.type = 'hidden';
    totalValueInput.name = 'resumo[valor_total]';
    totalValueInput.value = totals.total.toFixed(2);
    fragment.appendChild(totalValueInput);

    els.bgHiddenFields.innerHTML = '';
    els.bgHiddenFields.appendChild(fragment);
    els.bgSerializedOrder.value = message;
  }

  function renderSelectedItemsList(containerEl) {
    if (!containerEl) return;

    if (state.orderItems.length === 0) {
      containerEl.innerHTML = `
        <div class="selected-empty">
          <p style="margin: 0 0 0.85rem; color: var(--ink-muted); font-size: 0.9rem;">
            Nenhum item selecionado ainda. Escolha peças no catálogo para preencher este formulário automaticamente.
          </p>
          <a href="#catalogo" class="btn btn--gold btn-sm">Ir para o Catálogo</a>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = state.orderItems.map((item) => `
      <div class="selected-item-row">
        <img class="selected-item-row__img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
        <div class="selected-item-row__info">
          <h4>${escapeHtml(item.name)}</h4>
          <span class="selected-item-row__meta">${escapeHtml(item.brand)} • ${escapeHtml(item.variantLabel)}</span>
          <span class="selected-item-row__unit">${formatBRL(item.price * item.qty)}</span>
        </div>
        <div class="selected-item-row__actions">
          <div class="mini-stepper">
            <button type="button" data-cart-action="dec" data-key="${escapeHtml(item.key)}" aria-label="Diminuir">−</button>
            <span style="font-size: 0.82rem; font-weight: 700; min-width: 18px; text-align: center;">${item.qty}</span>
            <button type="button" data-cart-action="inc" data-key="${escapeHtml(item.key)}" aria-label="Aumentar">+</button>
          </div>
          <button type="button" class="btn-remove-item" data-cart-action="remove" data-key="${escapeHtml(item.key)}">Remover</button>
        </div>
      </div>
    `).join('');
  }

  function syncOrderEverywhere() {
    const totals = getOrderTotals();
    const message = buildWhatsAppMessage();

    syncBackgroundFormFields(totals, message);

    els.headerOrderCount.textContent = String(totals.units);
    els.headerOrderBtn.classList.toggle('has-items', totals.units > 0);
    els.formItemsCount.textContent = String(totals.units);
    els.summaryTotalUnits.textContent = `${totals.units} ${totals.units === 1 ? 'unidade' : 'unidades'}`;
    els.summaryTotalPrice.textContent = formatBRL(totals.total);
    els.drawerTotalPrice.textContent = formatBRL(totals.total);

    els.heroLiveStatus.textContent = totals.units > 0
      ? `${totals.units} ${totals.units === 1 ? 'item selecionado' : 'itens selecionados'} • ${formatBRL(totals.total)}`
      : 'Pronto para selecionar';

    els.floatingCountText.textContent = `${totals.units} ${totals.units === 1 ? 'item no formulário' : 'itens no formulário'}`;
    els.floatingTotalText.textContent = formatBRL(totals.total);
    els.floatingCartBar.classList.toggle('is-visible', totals.units > 0);

    els.waMessagePreview.textContent = message ||
      'Selecione ao menos 1 item no catálogo para gerar automaticamente sua lista de compra aqui.';

    renderSelectedItemsList(els.checkoutItemsList);
    renderSelectedItemsList(els.drawerItemsList);
  }

  /* ========================================================================
     WhatsApp Submission & Clipboard
     ======================================================================== */
  async function copyTextSilently(text) {
    if (!text || !navigator.clipboard || !navigator.clipboard.writeText) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function finalizeToWhatsApp() {
    if (state.orderItems.length === 0) {
      showToast('Selecione ao menos 1 item no catálogo antes de finalizar.');
      const catalogSection = document.getElementById('catalogo');
      if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    const message = buildWhatsAppMessage();
    const waNumber = getActiveWhatsappNumber();
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    els.waDirectLink.href = waUrl;
    void copyTextSilently(message);

    const popup = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!popup && window.location) {
      window.location.assign(waUrl);
    } else {
      showToast('Redirecionando para o WhatsApp da loja...');
    }
  }

  /* ========================================================================
     Drawer & Modals
     ======================================================================== */
  function openDrawer() {
    els.drawerBackdrop.classList.add('is-open');
    els.orderDrawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    els.drawerBackdrop.classList.remove('is-open');
    els.orderDrawer.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('is-open');
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('is-open');
  }

  function jumpToCategory(categoryId) {
    state.activeCategory = categoryId;
    renderCategoryTabs();
    updateContextAssurance();
    renderProducts();
    const target = document.getElementById('catalogo');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ========================================================================
     Scroll Effects, 3D Hero Tilt & IntersectionObserver
     ======================================================================== */
  function setupScrollEffects() {
    const onScroll = () => {
      const y = window.scrollY;
      els.siteHeader.classList.toggle('is-scrolled', y > 36);

      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, (y / docHeight) * 100) : 0;
      els.scrollProgress.style.width = `${progress}%`;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const revealItems = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }

    // Subtle 3D tilt on Hero Frame
    if (els.heroTiltFrame && window.matchMedia('(pointer: fine)').matches) {
      els.heroTiltFrame.addEventListener('mousemove', (e) => {
        const rect = els.heroTiltFrame.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        els.heroTiltFrame.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
      });
      els.heroTiltFrame.addEventListener('mouseleave', () => {
        els.heroTiltFrame.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg)';
      });
    }
  }

  /* ========================================================================
     Event Listeners
     ======================================================================== */
  function bindEvents() {
    // Mobile nav toggle
    els.mobileMenuToggle.addEventListener('click', () => {
      const isOpen = els.mainNav.classList.toggle('is-open');
      els.mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    els.mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        els.mainNav.classList.remove('is-open');
        els.mobileMenuToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Departments click
    els.departmentsGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.dept-card');
      if (!card) return;
      jumpToCategory(card.dataset.category);
    });

    // Spotlight & Footer quick jump buttons
    document.addEventListener('click', (e) => {
      const jumper = e.target.closest('.js-jump-category');
      if (!jumper) return;
      e.preventDefault();
      jumpToCategory(jumper.dataset.category);
    });

    // Category tabs
    els.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.category-tab');
      if (!tab) return;
      state.activeCategory = tab.dataset.category;
      renderCategoryTabs();
      updateContextAssurance();
      renderProducts();
    });

    // Search & sort
    els.catalogSearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderProducts();
    });

    els.catalogSort.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      renderProducts();
    });

    // Product Grid Delegated Actions
    els.productsGrid.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const productId = target.dataset.productId;

      if (action === 'select-variant') {
        state.selectedVariants[productId] = Number(target.dataset.variantIndex) || 0;
        renderProducts();
      } else if (action === 'add-item' || action === 'increment') {
        addOrUpdateItem(productId, 1);
      } else if (action === 'decrement') {
        addOrUpdateItem(productId, -1);
      }
    });

    // Checkout & Drawer Delegated Item Steppers
    const handleOrderListClick = (e) => {
      const btn = e.target.closest('[data-cart-action]');
      if (!btn) return;
      const action = btn.dataset.cartAction;
      const key = btn.dataset.key;
      if (action === 'inc') updateItemQtyByKey(key, 1);
      if (action === 'dec') updateItemQtyByKey(key, -1);
      if (action === 'remove') removeItemByKey(key);
    };

    els.checkoutItemsList.addEventListener('click', handleOrderListClick);
    els.drawerItemsList.addEventListener('click', handleOrderListClick);

    // Form field live sync
    const customerInputs = [
      { el: els.customerName, key: 'name' },
      { el: els.customerPhone, key: 'phone' },
      { el: els.deliveryMethod, key: 'delivery' },
      { el: els.paymentMethod, key: 'payment' },
      { el: els.orderNotes, key: 'notes' }
    ];

    customerInputs.forEach(({ el, key }) => {
      if (state.customer[key]) {
        el.value = state.customer[key];
      }
      const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventName, () => {
        state.customer[key] = el.value;
        saveCustomer();
        syncOrderEverywhere();
      });
    });

    // Submit real background form -> WhatsApp
    els.bgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      finalizeToWhatsApp();
    });

    els.floatingFinishWa.addEventListener('click', finalizeToWhatsApp);
    els.drawerGoWhatsapp.addEventListener('click', () => {
      closeDrawer();
      finalizeToWhatsApp();
    });

    els.btnClearOrder.addEventListener('click', clearAllItems);

    els.btnCopyOrder.addEventListener('click', async () => {
      const msg = buildWhatsAppMessage();
      if (!msg) {
        showToast('Selecione itens antes de copiar a lista.');
        return;
      }
      const ok = await copyTextSilently(msg);
      showToast(ok ? 'Lista do pedido copiada!' : 'Não foi possível copiar automaticamente.');
    });

    // Drawer triggers
    els.headerOrderBtn.addEventListener('click', openDrawer);
    els.floatingOpenDrawer.addEventListener('click', openDrawer);
    els.drawerCloseBtn.addEventListener('click', closeDrawer);
    els.drawerBackdrop.addEventListener('click', closeDrawer);
    els.drawerGoForm.addEventListener('click', () => {
      closeDrawer();
      const target = document.getElementById('finalizar-pedido');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });

    // WhatsApp Confirmation Modal
    els.waModalClose.addEventListener('click', () => closeModal(els.waConfirmModal));
    els.waConfirmModal.addEventListener('click', (e) => {
      if (e.target === els.waConfirmModal) closeModal(els.waConfirmModal);
    });
    els.waModalCopy.addEventListener('click', async () => {
      const ok = await copyTextSilently(buildWhatsAppMessage());
      showToast(ok ? 'Mensagem copiada para a área de transferência!' : 'Use o botão verde para abrir no WhatsApp.');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        closeModal(els.waConfirmModal);
      }
    });
  }

  /* ========================================================================
     Init & Dynamic JSON Catalog Sync
     ======================================================================== */
  async function loadLiveCatalogJson() {
    if (typeof fetch !== 'function') return;
    try {
      const response = await fetch('data/catalog.json', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.categories) && Array.isArray(data.products)) {
        CATEGORIES = data.categories;
        PRODUCTS = data.products.filter((p) => p && p.active !== false);
        initDefaultVariants();
        renderDepartments();
        renderCategoryTabs();
        updateContextAssurance();
        renderProducts();
      }
    } catch {
      // Mantém fallback estático de js/catalog.js caso offline ou file://
    }
  }

  function init() {
    if (els.currentYear) {
      els.currentYear.textContent = String(new Date().getFullYear());
    }
    renderDepartments();
    renderCategoryTabs();
    updateContextAssurance();
    renderProducts();
    bindEvents();
    syncOrderEverywhere();
    setupScrollEffects();
    void loadLiveCatalogJson();
  }

  init();
})();
