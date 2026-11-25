(() => {
  'use strict';

  const FALLBACK_CATEGORIES = Array.isArray(window.STORE_CATEGORIES) ? window.STORE_CATEGORIES : [];
  const FALLBACK_PRODUCTS = Array.isArray(window.STORE_PRODUCTS) ? window.STORE_PRODUCTS : [];

  const IMAGE_PRESETS = [
    { label: 'DeMillus / Lingerie Renda', path: 'assets/images/demillus-lingerie.jpg' },
    { label: 'Romance / Cetim & Pijama', path: 'assets/images/romance-sleepwear.jpg' },
    { label: 'Dicorpo / Conforto Seamless', path: 'assets/images/dicorpo-conforto.jpg' },
    { label: 'Perfume Importado Original', path: 'assets/images/perfume-importado.jpg' },
    { label: 'Roupas Fitness', path: 'assets/images/fitness-wear.jpg' },
    { label: 'Collection Store (Marca Própria)', path: 'assets/images/collection-store.jpg' },
    { label: 'Acessórios Ouro 18k', path: 'assets/images/acessorios-ouro.jpg' },
    { label: 'Bolsas Estruturadas', path: 'assets/images/bolsas-couro.jpg' },
    { label: 'Sexshop Discreto', path: 'assets/images/sexshop-discreto.jpg' },
    { label: 'iPhone Apple Original', path: 'assets/images/iphone-apple.jpg' }
  ];

  const state = {
    categories: [],
    products: [],
    uploadedImages: new Map(), // path -> { filename, contentBase64, dataUrl }
    pendingChanges: 0,
    editingId: '',
    search: '',
    filterCategory: 'all',
    cloudStatus: { mode: 'local', githubConfigured: false }
  };

  const els = {
    envPill: document.getElementById('env-status-pill'),
    btnOpenPublish: document.getElementById('btn-open-publish'),
    pendingBadge: document.getElementById('pending-count-badge'),
    statTotal: document.getElementById('stat-total'),
    statActive: document.getElementById('stat-active'),
    statPaused: document.getElementById('stat-paused'),
    statImages: document.getElementById('stat-images'),
    adminSearch: document.getElementById('admin-search'),
    adminFilterCat: document.getElementById('admin-filter-category'),
    productList: document.getElementById('admin-product-list'),
    btnNewProduct: document.getElementById('btn-new-product'),
    btnResetEditor: document.getElementById('btn-reset-editor'),
    editorForm: document.getElementById('product-editor-form'),
    editorHeading: document.getElementById('editor-heading'),
    editorSubheading: document.getElementById('editor-subheading'),
    editModeId: document.getElementById('edit-mode-id'),
    prodCategory: document.getElementById('prod-category'),
    prodBrand: document.getElementById('prod-brand'),
    prodName: document.getElementById('prod-name'),
    prodTag: document.getElementById('prod-tag'),
    prodVariantLabel: document.getElementById('prod-variant-label'),
    prodDescription: document.getElementById('prod-description'),
    prodImagePreview: document.getElementById('prod-image-preview'),
    prodImageFile: document.getElementById('prod-image-file'),
    prodImagePreset: document.getElementById('prod-image-preset'),
    prodImagePathLabel: document.getElementById('prod-image-path-label'),
    variantsEditorList: document.getElementById('variants-editor-list'),
    btnAddVariant: document.getElementById('btn-add-variant'),
    prodActive: document.getElementById('prod-active'),
    btnExportJson: document.getElementById('btn-export-json'),
    publishModal: document.getElementById('publish-modal'),
    btnClosePublish: document.getElementById('btn-close-publish'),
    btnCancelPublish: document.getElementById('btn-cancel-publish'),
    btnConfirmPublish: document.getElementById('btn-confirm-publish'),
    commitMsgInput: document.getElementById('commit-message-input'),
    publishResultBox: document.getElementById('publish-result-box'),
    publishModalDesc: document.getElementById('publish-modal-desc'),
    toastStack: document.getElementById('toast-stack')
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  function formatBRL(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
  }

  function resolvePreviewSrc(imagePath) {
    if (!imagePath) return '../assets/images/collection-store.jpg';
    const queued = state.uploadedImages.get(imagePath);
    if (queued) return queued.dataUrl;
    if (/^(https?:|data:|\/)/i.test(imagePath)) return imagePath;
    return `../${imagePath}`;
  }

  function showToast(msg) {
    const div = document.createElement('div');
    div.className = 'toast-msg';
    div.textContent = msg;
    els.toastStack.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  function markPendingChange() {
    state.pendingChanges += 1;
    updateStats();
  }

  function updateStats() {
    const total = state.products.length;
    const active = state.products.filter((p) => p.active !== false).length;
    const paused = total - active;

    els.statTotal.textContent = String(total);
    els.statActive.textContent = String(active);
    els.statPaused.textContent = String(paused);
    els.statImages.textContent = String(state.uploadedImages.size);
    els.pendingBadge.textContent = String(state.pendingChanges);
  }

  async function detectEnvironment() {
    state.cloudStatus = { mode: 'demo', configured: false };
    els.envPill.textContent = 'Modo Demonstração • Exportar Catálogo';
  }

  async function loadInitialCatalog() {
    try {
      const res = await fetch('../data/catalog.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories) && Array.isArray(data.products)) {
          state.categories = data.categories;
          state.products = data.products.map((p) => ({ active: true, ...p }));
          return;
        }
      }
    } catch {
      // fallback local
    }

    state.categories = FALLBACK_CATEGORIES;
    state.products = FALLBACK_PRODUCTS.map((p) => ({ active: true, ...p }));
  }

  function populateCategorySelects() {
    const deptCategories = state.categories.filter((c) => c.id !== 'all');
    const optionsHtml = deptCategories
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join('');

    els.prodCategory.innerHTML = optionsHtml;
    els.adminFilterCat.innerHTML = `<option value="all">Todas as categorias (${state.products.length})</option>${optionsHtml}`;

    els.prodImagePreset.innerHTML = '<option value="">Ou escolher imagem padrão da loja...</option>' +
      IMAGE_PRESETS.map((item) => `<option value="${escapeHtml(item.path)}">${escapeHtml(item.label)}</option>`).join('');
  }

  function renderProductList() {
    const q = state.search.trim().toLowerCase();
    const filtered = state.products.filter((p) => {
      if (state.filterCategory !== 'all' && p.category !== state.filterCategory) return false;
      if (!q) return true;
      return `${p.name} ${p.brand} ${p.category} ${p.tag}`.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      els.productList.innerHTML = '<p style="color: var(--muted); text-align: center; padding: 2rem;">Nenhum produto encontrado neste filtro.</p>';
      return;
    }

    els.productList.innerHTML = filtered.map((p) => {
      const minPrice = p.variants.reduce((min, v) => Math.min(min, Number(v.price) || 0), Infinity);
      const catObj = state.categories.find((c) => c.id === p.category);
      const isActive = p.active !== false;
      const isEditing = state.editingId === p.id;

      return `
        <article class="prod-row ${isActive ? '' : 'is-paused'} ${isEditing ? 'is-editing' : ''}">
          <img class="prod-row__img" src="${escapeHtml(resolvePreviewSrc(p.image))}" alt="${escapeHtml(p.name)}" />
          <div>
            <h3 class="prod-row__title">${escapeHtml(p.name)}</h3>
            <span class="prod-row__meta">${escapeHtml(p.brand)} • ${escapeHtml(catObj ? catObj.name : p.category)} • ${p.variants.length} opção(ões)</span>
            <span class="prod-row__price">${isActive ? 'Ativo' : 'Pausado'} • A partir de ${formatBRL(minPrice)}</span>
          </div>
          <div class="prod-row__actions">
            <button type="button" class="mini-btn" data-action="edit" data-id="${escapeHtml(p.id)}">Editar</button>
            <button type="button" class="mini-btn" data-action="toggle" data-id="${escapeHtml(p.id)}">${isActive ? 'Pausar' : 'Ativar'}</button>
            <button type="button" class="mini-btn" data-action="duplicate" data-id="${escapeHtml(p.id)}">Duplicar</button>
            <button type="button" class="mini-btn mini-btn--danger" data-action="delete" data-id="${escapeHtml(p.id)}">Excluir</button>
          </div>
        </article>
      `;
    }).join('');
  }

  /* ========================================================================
     Editor Form & Image Compression
     ======================================================================== */
  function addVariantRow(label = '', price = '') {
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.innerHTML = `
      <input type="text" class="var-label" placeholder="Ex: M • Bordô ou 100 ml" value="${escapeHtml(label)}" required />
      <input type="number" class="var-price" placeholder="Preço" step="0.01" min="0" value="${escapeHtml(price)}" required />
      <button type="button" class="mini-btn mini-btn--danger btn-del-var" aria-label="Remover variação">&times;</button>
    `;
    row.querySelector('.btn-del-var').addEventListener('click', () => {
      if (els.variantsEditorList.children.length <= 1) {
        showToast('O produto precisa ter pelo menos 1 variação com preço.');
        return;
      }
      row.remove();
    });
    els.variantsEditorList.appendChild(row);
  }

  function setEditorImage(path) {
    const finalPath = path || 'assets/images/collection-store.jpg';
    els.prodImagePathLabel.textContent = finalPath;
    els.prodImagePreview.src = resolvePreviewSrc(finalPath);
  }

  function resetEditor() {
    state.editingId = '';
    els.editModeId.value = '';
    els.editorHeading.textContent = 'Novo Produto';
    els.editorSubheading.textContent = 'Adicione um item ao catálogo e salve no rascunho.';
    els.editorForm.reset();
    els.prodActive.checked = true;
    els.prodTag.value = 'Novidade';
    els.prodVariantLabel.value = 'Tamanho / Opção';

    const firstDept = state.categories.find((c) => c.id !== 'all');
    if (firstDept) {
      els.prodCategory.value = firstDept.id;
      setEditorImage(firstDept.image);
    }

    els.variantsEditorList.innerHTML = '';
    addVariantRow('Padrão', '99.90');
    renderProductList();
  }

  function loadProductIntoEditor(productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;

    state.editingId = product.id;
    els.editModeId.value = product.id;
    els.editorHeading.textContent = `Editando: ${product.name}`;
    els.editorSubheading.textContent = 'Faça as alterações desejadas e salve no rascunho.';
    els.prodCategory.value = product.category;
    els.prodBrand.value = product.brand;
    els.prodName.value = product.name;
    els.prodTag.value = product.tag || '';
    els.prodVariantLabel.value = product.variantLabel || 'Opção';
    els.prodDescription.value = product.description || '';
    els.prodActive.checked = product.active !== false;

    setEditorImage(product.image);
    els.prodImagePreset.value = IMAGE_PRESETS.some((x) => x.path === product.image) ? product.image : '';

    els.variantsEditorList.innerHTML = '';
    product.variants.forEach((v) => addVariantRow(v.label, Number(v.price).toFixed(2)));
    renderProductList();
  }

  function compressImageToJpeg(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
        img.onload = () => {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          const base64 = dataUrl.split(',')[1];
          resolve({ dataUrl, base64 });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ========================================================================
     Save Draft, Publish & Export
     ======================================================================== */
  function handleEditorSubmit(e) {
    e.preventDefault();

    const category = els.prodCategory.value;
    const brand = els.prodBrand.value.trim();
    const name = els.prodName.value.trim();
    const tag = els.prodTag.value.trim() || 'Novidade';
    const variantLabel = els.prodVariantLabel.value.trim() || 'Opção';
    const description = els.prodDescription.value.trim();
    const image = els.prodImagePathLabel.textContent.trim() || 'assets/images/collection-store.jpg';
    const active = els.prodActive.checked;

    const variantRows = [...els.variantsEditorList.querySelectorAll('.variant-row')];
    const variants = variantRows.map((row) => ({
      label: row.querySelector('.var-label').value.trim(),
      price: Number(Number(row.querySelector('.var-price').value).toFixed(2))
    })).filter((v) => v.label && Number.isFinite(v.price) && v.price >= 0);

    if (!name || !brand || variants.length === 0) {
      showToast('Preencha marca, nome e pelo menos 1 variação com preço.');
      return;
    }

    const existingId = els.editModeId.value.trim();
    if (existingId) {
      const idx = state.products.findIndex((p) => p.id === existingId);
      if (idx >= 0) {
        state.products[idx] = {
          ...state.products[idx],
          active,
          category,
          brand,
          name,
          description,
          tag,
          image,
          variantLabel,
          variants
        };
        showToast(`Produto "${name}" atualizado no rascunho.`);
      }
    } else {
      let newId = `${slugify(category)}-${slugify(name)}` || `item-${Date.now()}`;
      if (state.products.some((p) => p.id === newId)) {
        newId = `${newId}-${Date.now().toString().slice(-4)}`;
      }
      state.products.unshift({
        active,
        id: newId,
        category,
        brand,
        name,
        description,
        tag,
        image,
        variantLabel,
        variants
      });
      showToast(`Produto "${name}" adicionado ao rascunho.`);
      resetEditor();
    }

    markPendingChange();
    populateCategorySelects();
    renderProductList();
  }

  function downloadCatalogBackup() {
    const payload = {
      categories: state.categories,
      products: state.products
    };
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup do catálogo baixado.');
  }

  function publishCatalogUpdates() {
    els.publishResultBox.hidden = false;
    els.publishResultBox.classList.remove('is-error');
    downloadCatalogBackup();
    state.pendingChanges = 0;
    updateStats();
    els.publishResultBox.innerHTML = `
      <strong>Catálogo exportado com sucesso!</strong><br />
      Nesta versão demonstrativa pública, o catálogo atualizado é exportado localmente em JSON sem integração com repositório privado.
    `;
  }

  /* ========================================================================
     Events & Init
     ======================================================================== */
  function bindEvents() {
    els.adminSearch.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderProductList();
    });

    els.adminFilterCat.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderProductList();
    });

    els.btnNewProduct.addEventListener('click', resetEditor);
    els.btnResetEditor.addEventListener('click', resetEditor);
    els.btnAddVariant.addEventListener('click', () => addVariantRow('', ''));
    els.editorForm.addEventListener('submit', handleEditorSubmit);
    els.btnExportJson.addEventListener('click', downloadCatalogBackup);

    els.prodCategory.addEventListener('change', (e) => {
      if (!state.editingId) {
        const dept = state.categories.find((c) => c.id === e.target.value);
        if (dept && dept.image) {
          setEditorImage(dept.image);
        }
      }
    });

    els.prodImagePreset.addEventListener('change', (e) => {
      if (e.target.value) {
        setEditorImage(e.target.value);
      }
    });

    els.prodImageFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const { dataUrl, base64 } = await compressImageToJpeg(file);
        const baseName = slugify(els.prodName.value || file.name.replace(/\.[^.]+$/, '')) || 'produto';
        const filename = `${baseName}-${Date.now().toString().slice(-6)}.jpg`;
        const relativePath = `assets/images/produtos/${filename}`;

        state.uploadedImages.set(relativePath, {
          filename,
          contentBase64: base64,
          dataUrl
        });
        setEditorImage(relativePath);
        updateStats();
        showToast('Foto preparada para publicação.');
      } catch (err) {
        showToast(err.message);
      }
    });

    els.productList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const idx = state.products.findIndex((p) => p.id === id);
      if (idx < 0) return;

      if (action === 'edit') {
        loadProductIntoEditor(id);
      } else if (action === 'toggle') {
        state.products[idx].active = state.products[idx].active === false;
        markPendingChange();
        renderProductList();
        showToast(state.products[idx].active ? 'Produto ativado na vitrine.' : 'Produto pausado da vitrine.');
      } else if (action === 'duplicate') {
        const copy = JSON.parse(JSON.stringify(state.products[idx]));
        copy.id = `${copy.id}-copia-${Date.now().toString().slice(-4)}`;
        copy.name = `${copy.name} (Cópia)`;
        state.products.splice(idx + 1, 0, copy);
        markPendingChange();
        populateCategorySelects();
        renderProductList();
        loadProductIntoEditor(copy.id);
        showToast('Produto duplicado! Edite e salve no rascunho.');
      } else if (action === 'delete') {
        if (!window.confirm(`Remover "${state.products[idx].name}" do catálogo?`)) return;
        state.products.splice(idx, 1);
        if (state.editingId === id) resetEditor();
        markPendingChange();
        populateCategorySelects();
        renderProductList();
        showToast('Produto removido do rascunho.');
      }
    });

    els.btnOpenPublish.addEventListener('click', () => {
      els.publishResultBox.hidden = true;
      els.publishModal.classList.add('is-open');
    });
    els.btnClosePublish.addEventListener('click', () => els.publishModal.classList.remove('is-open'));
    els.btnCancelPublish.addEventListener('click', () => els.publishModal.classList.remove('is-open'));
    els.btnConfirmPublish.addEventListener('click', publishCatalogUpdates);
  }

  async function init() {
    await Promise.all([detectEnvironment(), loadInitialCatalog()]);
    populateCategorySelects();
    updateStats();
    resetEditor();
    bindEvents();
  }

  init();
})();
