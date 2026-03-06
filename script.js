const menuButtons = document.querySelectorAll('.menu__btn');
const formCards = document.querySelectorAll('.form-card');
const NEW_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzWAfXJihIAH2UwUfbpYUR5HjnAbb6rvisJZ5YTK2gRQjzXmehO5yzilcEUOHSSazfwdw/exec';
const APPS_SCRIPT_URL = NEW_APPS_SCRIPT_URL;

menuButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        menuButtons.forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');

        const targetId = btn.dataset.target;
        formCards.forEach((card) => {
            card.classList.toggle('active', card.id === targetId);
        });
    });
});
const forms = document.querySelectorAll('form[data-action]');
const productTableBody = document.getElementById('product-table-body');
const productDatalist = document.getElementById('productos-datalist');
const refreshProductsBtn = document.querySelector('.refresh-products');
const productSearchInput = document.getElementById('product-search');
const tipoInventario = document.querySelector('#inventario select[name="tipo"]');
const sedeInventario = document.querySelector('#inventario select[name="sede"]');
const productLinesContainer = document.getElementById('product-lines-container');
const addProductLineBtn = document.querySelector('.add-product-line');
const confirmModal = document.getElementById('confirm-modal');
const confirmSummaryGrid = document.getElementById('confirm-summary-grid');
const confirmProductsBody = document.getElementById('confirm-products-body');
const confirmAgreement = document.getElementById('confirm-agreement');
const confirmAgreementText = document.getElementById('confirm-agreement-text');
const confirmSendBtn = document.getElementById('confirm-send');
const confirmBackBtn = document.getElementById('confirm-back');
const closeConfirmButtons = document.querySelectorAll('[data-close-confirm]');
const state = {
    products: [],
    productFilter: '',
    pendingInventorySubmission: null,
};

const DEMO_PRODUCTS = [
    { codigo: 'SKU-001', descripcion: 'Producto demo 1', unidad: 'UND' },
    { codigo: 'SKU-002', descripcion: 'Producto demo 2', unidad: 'PAQ' },
];

forms.forEach((form) => {
    form.addEventListener('submit', handleSubmit);
});

refreshProductsBtn?.addEventListener('click', () => fetchProducts());
productSearchInput?.addEventListener('input', (event) => {
    state.productFilter = event.target.value.trim().toLowerCase();
    renderProducts();
});

fetchProducts();

tipoInventario?.addEventListener('change', syncSedeWithTipo);
syncSedeWithTipo();

addProductLineBtn?.addEventListener('click', () => addProductLine());
if (productLinesContainer && !productLinesContainer.children.length) {
    addProductLine();
}

confirmAgreement?.addEventListener('change', () => {
    if (confirmSendBtn) {
        confirmSendBtn.disabled = !confirmAgreement.checked;
    }
});

confirmBackBtn?.addEventListener('click', closeConfirmModal);
closeConfirmButtons.forEach((button) => {
    button.addEventListener('click', closeConfirmModal);
});

confirmSendBtn?.addEventListener('click', async () => {
    if (!state.pendingInventorySubmission || !confirmAgreement?.checked) {
        return;
    }
    await submitInventoryWithConfirmation();
});

function setStatus(action, message = '', type = 'info') {
    const el = document.querySelector(`.form-status[data-status="${action}"]`);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('success', 'error');
    if (type === 'success') {
        el.classList.add('success');
    }
    if (type === 'error') {
        el.classList.add('error');
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const action = form.dataset.action;

    let productos = [];
    if (action === 'inventario') {
        try {
            productos = collectProductLines();
        } catch (collectError) {
            setStatus(action, collectError.message, 'error');
            return;
        }
        if (!productos.length) {
            setStatus(action, 'Agregue al menos un producto con cantidad mayor a cero.', 'error');
            return;
        }
        const productosInput = form.querySelector('#productosPayload');
        if (productosInput) {
            productosInput.value = JSON.stringify(productos);
        }

        const formData = collectFormDataIncludingDisabled(form);
        const payload = Object.fromEntries(formData.entries());
        openConfirmModal(form, payload, productos);
        return;
    }

    const formData = collectFormDataIncludingDisabled(form);
    const payload = Object.fromEntries(formData.entries());

    await submitFormPayload(form, action, payload);
}

async function submitInventoryWithConfirmation() {
    const pending = state.pendingInventorySubmission;
    if (!pending) return;

    closeConfirmModal();
    await submitFormPayload(pending.form, pending.action, pending.payload);
}

async function submitFormPayload(form, action, payload) {

    setStatus(action, 'Enviando datos...', 'info');
    toggleFormDisabled(form, true);

    try {
        const response = await sendToAppsScript({ action, data: payload });
        const message = response?.message || 'Datos registrados con éxito.';
        setStatus(action, message, 'success');
        if (action === 'inventario') {
            resetInventoryForm(form);
        } else {
            form.reset();
        }

    } catch (error) {
        setStatus(action, error.message, 'error');
    } finally {
        toggleFormDisabled(form, false);
        if (action === 'inventario') {
            syncSedeWithTipo();
        }
    }
}

function openConfirmModal(form, payload, productos) {
    if (!confirmModal || !confirmSummaryGrid || !confirmProductsBody || !confirmAgreementText) {
        return;
    }

    state.pendingInventorySubmission = {
        form,
        action: 'inventario',
        payload,
    };

    const summaryItems = [
        { label: 'Fecha', value: payload.fecha || '-' },
        { label: 'Hora', value: payload.hora || '-' },
        { label: 'Sede', value: payload.sede || '-' },
        { label: 'Responsable entrega', value: payload.responsable || '-' },
        { label: 'Modo', value: payload.tipo || '-' },
    ];

    confirmSummaryGrid.innerHTML = summaryItems
        .map(
            (item) => `
                <article class="confirm-summary-item">
                    <span>${item.label}</span>
                    <strong>${item.value}</strong>
                </article>
            `,
        )
        .join('');

    confirmProductsBody.innerHTML = productos
        .map(
            (item) => `
                <tr>
                    <td>${item.codigo || '-'}</td>
                    <td>${item.descripcion || '-'}</td>
                    <td>${item.unidad || '-'}</td>
                    <td>${item.cantidad ?? '-'}</td>
                </tr>
            `,
        )
        .join('');

    const responsable = (payload.responsable || 'responsable').toUpperCase();
    confirmAgreementText.textContent = `Yo, ${responsable}, estoy de acuerdo con estos productos y cantidades.`;

    if (confirmAgreement) {
        confirmAgreement.checked = false;
    }
    if (confirmSendBtn) {
        confirmSendBtn.disabled = true;
    }

    confirmModal.hidden = false;
    document.body.classList.add('modal-open');
}

function closeConfirmModal() {
    if (!confirmModal) return;
    confirmModal.hidden = true;
    document.body.classList.remove('modal-open');
    state.pendingInventorySubmission = null;
}

function collectFormDataIncludingDisabled(form) {
    const temporarilyEnabled = [];
    form.querySelectorAll('[name]:disabled').forEach((element) => {
        temporarilyEnabled.push(element);
        element.disabled = false;
    });
    const formData = new FormData(form);
    temporarilyEnabled.forEach((element) => {
        element.disabled = true;
    });
    return formData;
}

async function sendToAppsScript(body) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
        throw new Error('Actualice NEW_APPS_SCRIPT_URL con la URL del Web App de Apps Script.');
    }

    const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'No se pudo conectar con Apps Script.');
    }

    return response.json();
}

function toggleFormDisabled(form, shouldDisable) {
    Array.from(form.elements).forEach((element) => {
        element.disabled = shouldDisable && element.type !== 'hidden';
    });
}

async function fetchProducts(options = {}) {
    const { silent = false } = options;
    if (!productTableBody || !productDatalist) return;

    if (!silent) {
        setStatus('productList', 'Sincronizando productos...', 'info');
    }

    try {
        if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
            renderProducts(DEMO_PRODUCTS);
            throw new Error('Usando lista de demostración. Configure NEW_APPS_SCRIPT_URL para obtener datos reales.');
        }
        const fullUrl = `${APPS_SCRIPT_URL}?action=getProducts`;
        console.log('[Productos] GET', fullUrl);
        const response = await fetch(fullUrl);
        console.log('[Productos] Status', response.status, response.statusText);
        if (!response.ok) {
            throw new Error('No se pudieron obtener los productos.');
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            console.error('[Productos] Error parseando JSON', parseErr);
            throw new Error('Respuesta inválida del servidor (JSON).');
        }
        const products = Array.isArray(data?.records) ? data.records : [];
        state.products = products;
        updateProductDatalist(products);
        renderProducts();

        if (!silent) {
            setStatus('productList', 'Catálogo actualizado.', 'success');
        }
    } catch (error) {
        console.error('[Productos] Fetch error', error);
        if (!APPS_SCRIPT_URL.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
            renderProducts([]);
            updateProductDatalist([]);
        }
        if (!silent) {
            setStatus('productList', error.message, 'error');
        }
    }
}

function renderProducts(productsOverride) {
    if (!productTableBody || !productDatalist) return;

    const products = Array.isArray(productsOverride) ? productsOverride : getFilteredProducts();

    productTableBody.innerHTML = '';

    if (!products.length) {
        productTableBody.innerHTML = '<tr><td colspan="3">Sin datos disponibles.</td></tr>';
        return;
    }

    const tableFragment = document.createDocumentFragment();

    products.forEach((item) => {
        const { codigo = '', descripcion = '', unidad = '' } = item;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${codigo}</td>
            <td>${descripcion}</td>
            <td>${unidad}</td>
        `;
        tableFragment.appendChild(row);
    });

    productTableBody.appendChild(tableFragment);

    document.querySelectorAll('.product-line').forEach((line) => syncProductLineValues(line));
}

function updateProductDatalist(productsOverride) {
    if (!productDatalist) return;
    productDatalist.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const source = Array.isArray(productsOverride) ? productsOverride : state.products;
    source.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.descripcion;
        option.label = `${item.codigo} · ${item.descripcion} · ${item.unidad}`.trim();
        fragment.appendChild(option);
    });
    productDatalist.appendChild(fragment);
}

function getFilteredProducts() {
    if (!state.productFilter) return state.products;
    return state.products.filter((item) => {
        const searchIn = `${item.codigo || ''} ${item.descripcion || ''}`.toLowerCase();
        return searchIn.includes(state.productFilter);
    });
}

function findProductMatchByValue(value) {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return null;
    return (
        state.products.find((item) => {
            const descripcion = (item.descripcion || '').trim().toLowerCase();
            const codigo = (item.codigo || '').trim().toLowerCase();
            return descripcion === normalized || codigo === normalized;
        }) || null
    );
}

function syncSedeWithTipo() {
    if (!tipoInventario || !sedeInventario) return;
    const isDevoluciones = tipoInventario.value === 'DEVOLUCIONES';
    if (isDevoluciones) {
        sedeInventario.value = 'BELLO CAMPO';
        sedeInventario.disabled = true;
    } else if (sedeInventario.disabled) {
        sedeInventario.disabled = false;
    }
}

function addProductLine(initialData = {}) {
    if (!productLinesContainer) return;
    const line = document.createElement('div');
    line.className = 'product-line';
    line.innerHTML = `
        <label>Producto
            <input type="text" class="product-line__descripcion" list="productos-datalist" placeholder="Seleccione o escriba" required />
        </label>
        <label>Cantidad
            <input type="number" class="product-line__cantidad" min="1" step="1" placeholder="1" required />
        </label>
        <button type="button" class="remove-line" aria-label="Eliminar producto">Eliminar</button>
        <input type="hidden" class="product-line__unidad" />
        <input type="hidden" class="product-line__codigo" />
    `;
    productLinesContainer.appendChild(line);

    const descripcionInput = line.querySelector('.product-line__descripcion');
    const cantidadInput = line.querySelector('.product-line__cantidad');
    const unidadInput = line.querySelector('.product-line__unidad');
    const codigoInput = line.querySelector('.product-line__codigo');

    descripcionInput.addEventListener('change', () => syncProductLineValues(line));
    descripcionInput.addEventListener('blur', () => syncProductLineValues(line));

    if (initialData.descripcion) descripcionInput.value = initialData.descripcion;
    if (initialData.cantidad) cantidadInput.value = initialData.cantidad;
    if (initialData.unidad) unidadInput.value = initialData.unidad;
    if (initialData.codigo) codigoInput.value = initialData.codigo;

    syncProductLineValues(line);

    line.querySelector('.remove-line').addEventListener('click', () => {
        line.remove();
        if (!productLinesContainer.children.length) {
            addProductLine();
        }
    });
}

function syncProductLineValues(line) {
    const descripcionInput = line.querySelector('.product-line__descripcion');
    const unidadInput = line.querySelector('.product-line__unidad');
    const codigoInput = line.querySelector('.product-line__codigo');
    const value = descripcionInput.value.trim();
    if (!value) {
        unidadInput.value = '';
        codigoInput.value = '';
        descripcionInput.setCustomValidity('');
        return;
    }
    const match = findProductMatchByValue(value);
    if (match) {
        descripcionInput.value = match.descripcion;
        unidadInput.value = match.unidad || '';
        codigoInput.value = match.codigo || '';
        descripcionInput.setCustomValidity('');
    } else {
        unidadInput.value = '';
        codigoInput.value = '';
        descripcionInput.setCustomValidity('Seleccione un producto del catálogo.');
    }
}

function collectProductLines() {
    if (!productLinesContainer) return [];
    const lines = [];
    const seenKeys = new Set();
    productLinesContainer.querySelectorAll('.product-line').forEach((line) => {
        const descripcionInput = line.querySelector('.product-line__descripcion');
        const cantidadInput = line.querySelector('.product-line__cantidad');
        const unidadInput = line.querySelector('.product-line__unidad');
        const codigoInput = line.querySelector('.product-line__codigo');

        const descripcion = descripcionInput.value.trim();
        const cantidad = Number.parseInt(cantidadInput.value, 10);

        if (!descripcion || Number.isNaN(cantidad) || cantidad <= 0) {
            return;
        }

        if (!Number.isInteger(cantidad)) {
            throw new Error('Las cantidades deben ser números enteros.');
        }

        const productMatch = findProductMatchByValue(descripcion);
        if (!productMatch) {
            throw new Error(`'${descripcion}' no forma parte del catálogo. Seleccione productos existentes.`);
        }

        const key = (productMatch.codigo || productMatch.descripcion).toLowerCase();
        if (seenKeys.has(key)) {
            throw new Error('No se puede registrar el mismo producto más de una vez.');
        }
        seenKeys.add(key);

        lines.push({
            codigo: productMatch.codigo || '',
            descripcion: productMatch.descripcion,
            unidad: productMatch.unidad || '',
            cantidad,
        });
    });
    return lines;
}

function resetInventoryForm(form) {
    form.reset();
    if (productLinesContainer) {
        productLinesContainer.innerHTML = '';
        addProductLine();
    }
    syncSedeWithTipo();
}
