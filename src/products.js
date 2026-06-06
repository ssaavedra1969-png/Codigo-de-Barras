import { db, storage, firebase } from './firebase.js';
import { formatMoney, escHtml, showElement } from './utils.js';
import { toastSuccess, toastError } from './toast.js';

let currentEditId = null;
let productsCache = [];
let saving = false;
let currentPage = 1;
const PAGE_SIZE = 50;
let currentFilter = '';

export function getCurrentEditId() {
  return currentEditId;
}

export function setCurrentEditId(id) {
  currentEditId = id;
}

export async function loadProducts() {
  const snapshot = await db.collection('productos').orderBy('articulo').get();
  productsCache = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.active !== false) {
      productsCache.push({ id: doc.id, ...data });
    }
  });
  return productsCache;
}

export async function loadAllProducts() {
  const snapshot = await db.collection('productos').orderBy('articulo').get();
  productsCache = [];
  snapshot.forEach(doc => {
    productsCache.push({ id: doc.id, ...doc.data() });
  });
  return productsCache;
}

export function getFilteredProducts(filter) {
  const q = (filter || '').toLowerCase().trim();
  currentFilter = q;
  if (!q) return productsCache;
  return productsCache.filter(p =>
    p.articulo?.toLowerCase().includes(q) ||
    p.id?.includes(q)
  );
}

export function renderProductsTable(filter) {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = renderSkeletonRows();

  loadProducts().then(products => {
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No hay productos. Agregá el primero.</td></tr>';
      updatePagination(0);
      return;
    }

    const filtered = getFilteredProducts(filter);
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Sin resultados para "${filter}"</td></tr>`;
      updatePagination(0);
      return;
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = page.map(p => {
      const stockClass = (p.cantidad !== undefined && p.cantidad <= 3) ? 'stock-low' : 'stock-ok';
      return `<tr>
        <td style="font-family:monospace;font-size:0.8rem;">${escHtml(p.id)}</td>
        <td><strong>${escHtml(p.articulo || '—')}</strong></td>
        <td>${escHtml(p.color || '—')}</td>
        <td>${escHtml(p.talle || '—')}</td>
        <td><span class="stock-badge ${stockClass}">${p.cantidad !== undefined ? p.cantidad : '—'}</span></td>
        <td style="font-weight:600;">${formatMoney(p.venta)}</td>
        <td>${escHtml(p.familia || '—')}</td>
        <td>${p.cantidad > 0 ? `<button class="action-btn sell-btn" onclick="window.sellProduct('${p.id}')">Vender</button>` : ''}</td>
        <td class="table-actions">
          <button class="action-btn" onclick="window.editProduct('${p.id}')">Editar</button>
          <button class="action-btn danger" onclick="window.deleteProduct('${p.id}')">Eliminar</button>
        </td>
      </tr>`;
    }).join('');

    updatePagination(filtered.length, totalPages, currentPage);
  }).catch(err => {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">Error: ${err.message}</td></tr>`;
  });
}

function renderSkeletonRows() {
  return Array.from({ length: 5 }, () =>
    `<tr>${Array.from({ length: 9 }, () =>
      '<td><div class="skeleton-cell"></div></td>'
    ).join('')}</tr>`
  ).join('');
}

function updatePagination(total, totalPages, page) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (!total || total <= PAGE_SIZE) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  const showing = `Mostrando ${Math.min(PAGE_SIZE, total)} de ${total} productos`;
  let html = `<span class="pagination-info">${showing}</span><div class="pagination-controls">`;
  html += `<button class="page-btn" onclick="window.goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹ Anterior</button>`;
  html += `<span class="page-current">Página ${page} de ${totalPages}</span>`;
  html += `<button class="page-btn" onclick="window.goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Siguiente ›</button>`;
  html += '</div>';
  container.innerHTML = html;
}

export function goToPage(p) {
  currentPage = Math.max(1, p);
  renderProductsTable(currentFilter);
}

function showProductForm(isEdit) {
  saving = false;
  const btn = document.getElementById('formSubmitBtn');
  btn.disabled = false;
  btn.textContent = isEdit ? 'Actualizar' : 'Guardar';
  document.getElementById('modalTitle').textContent = isEdit ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('productModal').style.display = 'flex';
}

export function fillForm(id, data) {
  currentEditId = id;
  document.getElementById('formProductId').value = id;
  document.getElementById('formCode').value = id;
  document.getElementById('formCode').readOnly = true;
  document.getElementById('formArticulo').value = data.articulo || '';
  document.getElementById('formDesc').value = data.descripcion || '';
  document.getElementById('formColor').value = data.color || '';
  document.getElementById('formSize').value = data.talle || '';
  document.getElementById('formCantidad').value = data.cantidad || '';
  document.getElementById('formCosto').value = data.costo || '';
  document.getElementById('formVenta').value = data.venta || '';
  document.getElementById('formFamilia').value = data.familia || '';
  showProductForm(true);
}

export function editProduct(id) {
  db.collection('productos').doc(id).get().then(doc => {
    if (doc.exists) fillForm(doc.id, doc.data());
  });
}

export function saveProduct(e) {
  e.preventDefault();
  if (saving) return;

  const code = document.getElementById('formCode').value.trim();
  if (!code) return toastError('El código de barras es obligatorio');
  if (code.length < 3) return toastError('El código debe tener al menos 3 caracteres');
  const cantidad = parseInt(document.getElementById('formCantidad').value) || 0;
  if (cantidad < 0) return toastError('La cantidad no puede ser negativa');
  const costo = parseFloat(document.getElementById('formCosto').value) || 0;
  if (costo < 0) return toastError('El costo no puede ser negativo');
  const venta = parseFloat(document.getElementById('formVenta').value) || 0;
  if (venta < 0) return toastError('El precio de venta no puede ser negativo');

  const data = {
    articulo: document.getElementById('formArticulo').value.trim(),
    descripcion: document.getElementById('formDesc').value.trim(),
    color: document.getElementById('formColor').value.trim(),
    talle: document.getElementById('formSize').value.trim(),
    cantidad,
    costo,
    venta,
    familia: document.getElementById('formFamilia').value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  saving = true;
  const btn = document.getElementById('formSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const isNew = !document.getElementById('formProductId').value;

  if (isNew) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.active = true;
  }

  db.collection('productos').doc(code).set(data, { merge: true })
    .then(async () => {
      await uploadProductImages(code);
      closeProductForm();
      renderProductsTable();
      if (document.querySelector('.tab[data-tab="scan"]')?.classList.contains('active')) {
        const { lookupBarcode } = await import('./scanner.js');
        lookupBarcode(code);
      }
      toastSuccess(isNew ? 'Producto creado correctamente' : 'Producto actualizado');
    })
    .catch(err => {
      toastError('Error al guardar: ' + err.message);
    })
    .finally(() => {
      saving = false;
      btn.disabled = false;
      btn.textContent = isNew ? 'Guardar' : 'Actualizar';
    });
}

async function uploadProductImages(code) {
  const input = document.getElementById('formImages');
  if (!input || !input.files || !input.files.length) return;
  const urls = [];
  for (const file of input.files) {
    try {
      const ref = storage.ref(`productos/${code}/${Date.now()}_${file.name}`);
      const snap = await ref.put(file);
      const url = await snap.ref.getDownloadURL();
      urls.push(url);
    } catch (e) {
      console.error('Error uploading image:', e);
    }
  }
  if (urls.length) {
    await db.collection('productos').doc(code).update({
      images: firebase.firestore.FieldValue.arrayUnion(...urls)
    });
  }
}

export function deleteProduct(id) {
  if (!confirm(`¿Eliminar el producto con código ${id}?`)) return;
  db.collection('productos').doc(id).update({
    active: false,
    deletedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    renderProductsTable();
    toastSuccess(`Producto ${id} eliminado`, 6000);
  }).catch(err => toastError('Error: ' + err.message));
}

export function closeProductForm(e) {
  if (e && e.target !== document.getElementById('productModal')) return;
  saving = false;
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
  document.getElementById('formProductId').value = '';
  document.getElementById('formCode').readOnly = false;
  currentEditId = null;
}

export function filterProducts() {
  renderProductsTable(document.getElementById('productSearch').value);
}

export function initProducts() {
  const form = document.getElementById('productForm');
  if (form) form.addEventListener('submit', saveProduct);

  const searchInput = document.getElementById('productSearch');
  if (searchInput) searchInput.addEventListener('input', filterProducts);

  window.editProduct = editProduct;
  window.deleteProduct = deleteProduct;
  window.goToPage = goToPage;
  window.sellProduct = sellProduct;
  window.fillForm = fillForm;
}

export function showNewProductForm() {
  currentEditId = null;
  document.getElementById('formProductId').value = '';
  document.getElementById('formCode').value = '';
  document.getElementById('formCode').readOnly = false;
  document.getElementById('formArticulo').value = '';
  document.getElementById('formDesc').value = '';
  document.getElementById('formColor').value = '';
  document.getElementById('formSize').value = '';
  document.getElementById('formCantidad').value = '';
  document.getElementById('formCosto').value = '';
  document.getElementById('formVenta').value = '';
  document.getElementById('formFamilia').value = '';
  showProductForm(false);
}

export function newProductFromScan() {
  const code = currentEditId || document.getElementById('resultBarcode')?.textContent;
  if (!code || code === '—') return;
  document.getElementById('formProductId').value = '';
  document.getElementById('formCode').value = code;
  document.getElementById('formCode').readOnly = true;
  document.getElementById('formArticulo').value = '';
  document.getElementById('formDesc').value = '';
  document.getElementById('formColor').value = '';
  document.getElementById('formSize').value = '';
  document.getElementById('formCantidad').value = '';
  document.getElementById('formCosto').value = '';
  document.getElementById('formVenta').value = '';
  document.getElementById('formFamilia').value = '';
  showElement('scanResult', false);
  showElement('scanError', false);
  showProductForm(false);
  document.querySelector('.tab[data-tab="products"]')?.click();
}

export async function sellProduct(id) {
  const doc = await db.collection('productos').doc(id).get();
  if (!doc.exists) return toastError('Producto no encontrado');
  const data = doc.data();
  const qty = parseInt(prompt(`Stock actual: ${data.cantidad}\n¿Cuántos querés vender?`, '1'));
  if (!qty || qty <= 0) return;
  if (qty > (data.cantidad || 0)) return toastError('No hay suficiente stock');

  const total = qty * (data.venta || 0);

  await db.collection('productos').doc(id).update({
    cantidad: firebase.firestore.FieldValue.increment(-qty),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('ventas').add({
    codigo: id,
    articulo: data.articulo || '',
    cantidad: qty,
    precioVenta: data.venta || 0,
    total,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  renderProductsTable();
  toastSuccess(`Vendidos ${qty} × ${data.articulo || id} = ${formatMoney(total)}`);
}
