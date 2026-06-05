// ==================== STATE ====================
let currentEditId = null;
let productsCache = [];
let scanTimeout = null;

// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'scan') document.getElementById('barcodeInput').focus();
  if (tab === 'products') renderProductsTable();
}

// ==================== BARCODE SCANNER ====================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('barcodeInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const code = input.value.trim();
      if (code) {
        lookupBarcode(code);
        input.value = '';
      }
    }
  });
  // Auto-focus on any click
  document.addEventListener('click', () => input.focus());
});

// Keyboard shortcut: Ctrl+1, Ctrl+2, Ctrl+3 for tabs
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && ['1','2','3'].includes(e.key)) {
    e.preventDefault();
    const tabs = ['scan','products','generate'];
    switchTab(tabs[parseInt(e.key)-1]);
  }
});

// ==================== FIREBASE OPERATIONS ====================
function lookupBarcode(code) {
  showElement('scanEmpty', false);
  showElement('scanResult', false);
  showElement('scanError', false);
  showElement('scanLoading', true);

  db.collection('productos').doc(code).get()
    .then(doc => {
      showElement('scanLoading', false);
      if (doc.exists) {
        showProductResult(doc.id, doc.data());
      } else {
        showElement('scanError', true);
        document.getElementById('scanErrorMsg').textContent =
          `No se encontró ningún producto con el código ${code}`;
      }
    })
    .catch(err => {
      showElement('scanLoading', false);
      showElement('scanError', true);
      document.getElementById('scanErrorMsg').textContent =
        `Error: ${err.message}`;
    });
}

function showProductResult(id, data) {
  showElement('scanResult', true);
  const img = document.getElementById('resultImage');
  if (data.imagen) {
    img.src = data.imagen;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }
  document.getElementById('resultBarcode').textContent = id;
  document.getElementById('resultName').textContent = data.nombre || '—';
  document.getElementById('resultPrice').textContent =
    data.precio ? `$${Number(data.precio).toLocaleString('es-AR')}` : '—';
  document.getElementById('resultStock').textContent =
    data.stock !== undefined ? data.stock : '—';
  document.getElementById('resultSize').textContent = data.talle || '—';
  document.getElementById('resultBrand').textContent = data.marca || '—';
  document.getElementById('resultDesc').textContent = data.descripcion || '';
  document.getElementById('resultCategory').textContent = data.categoria || 'Producto';
  currentEditId = id;
}

function editFromScan() {
  if (!currentEditId) return;
  db.collection('productos').doc(currentEditId).get()
    .then(doc => {
      if (doc.exists) {
        fillForm(doc.id, doc.data());
        switchTab('products');
      }
    });
}

function resetScan() {
  showElement('scanResult', false);
  showElement('scanError', false);
  showElement('scanEmpty', true);
  document.getElementById('barcodeInput').focus();
}

// ==================== CRUD: READ ALL ====================
function loadProducts() {
  return db.collection('productos').orderBy('nombre').get()
    .then(snapshot => {
      productsCache = [];
      snapshot.forEach(doc => {
        productsCache.push({ id: doc.id, ...doc.data() });
      });
      return productsCache;
    });
}

function renderProductsTable(filter) {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando...</td></tr>';

  loadProducts().then(products => {
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay productos. Agregá el primero.</td></tr>';
      return;
    }
    const q = (filter || '').toLowerCase();
    const filtered = q
      ? products.filter(p => p.nombre?.toLowerCase().includes(q) || p.id?.includes(q))
      : products;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Sin resultados para "${q}"</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const stockClass = (p.stock !== undefined && p.stock <= 3) ? 'stock-low' : 'stock-ok';
      return `<tr>
        <td style="font-family:monospace;font-size:0.8rem;">${p.id}</td>
        <td><strong>${escHtml(p.nombre || '—')}</strong></td>
        <td style="font-weight:600;">${p.precio ? '$' + Number(p.precio).toLocaleString('es-AR') : '—'}</td>
        <td><span class="stock-badge ${stockClass}">${p.stock !== undefined ? p.stock : '—'}</span></td>
        <td>${escHtml(p.talle || '—')}</td>
        <td style="display:flex;gap:4px;">
          <button class="action-btn" onclick="editProduct('${p.id}')">Editar</button>
          <button class="action-btn danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </td>
      </tr>`;
    }).join('');
  }).catch(err => {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${err.message}</td></tr>`;
  });
}

function filterProducts() {
  renderProductsTable(document.getElementById('productSearch').value);
}

// ==================== CRUD: CREATE / UPDATE ====================
function showProductForm(data) {
  document.getElementById('modalTitle').textContent = data ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('formSubmitBtn').textContent = data ? 'Actualizar' : 'Guardar';
  document.getElementById('productModal').style.display = 'flex';
}

function fillForm(id, data) {
  currentEditId = id;
  document.getElementById('formProductId').value = id;
  document.getElementById('formCode').value = id;
  document.getElementById('formCode').readOnly = true;
  document.getElementById('formName').value = data.nombre || '';
  document.getElementById('formPrice').value = data.precio || '';
  document.getElementById('formStock').value = data.stock || '';
  document.getElementById('formSize').value = data.talle || '';
  document.getElementById('formCategory').value = data.categoria || '';
  document.getElementById('formBrand').value = data.marca || '';
  document.getElementById('formImage').value = data.imagen || '';
  document.getElementById('formDesc').value = data.descripcion || '';
  previewFormImage();
  showProductForm(true);
}

function editProduct(id) {
  db.collection('productos').doc(id).get().then(doc => {
    if (doc.exists) fillForm(doc.id, doc.data());
  });
}

function saveProduct(e) {
  e.preventDefault();
  const code = document.getElementById('formCode').value.trim();
  if (!code) return alert('El código de barras es obligatorio');

  const data = {
    nombre: document.getElementById('formName').value.trim(),
    precio: parseFloat(document.getElementById('formPrice').value) || 0,
    stock: parseInt(document.getElementById('formStock').value) || 0,
    talle: document.getElementById('formSize').value.trim(),
    categoria: document.getElementById('formCategory').value,
    marca: document.getElementById('formBrand').value.trim(),
    imagen: document.getElementById('formImage').value.trim(),
    descripcion: document.getElementById('formDesc').value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const isNew = !document.getElementById('formProductId').value;

  if (isNew) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  db.collection('productos').doc(code).set(data, { merge: true })
    .then(() => {
      closeProductForm();
      renderProductsTable();
      if (document.querySelector('.tab[data-tab="scan"]').classList.contains('active')) {
        lookupBarcode(code);
      }
    })
    .catch(err => alert('Error: ' + err.message));
}

function deleteProduct(id) {
  if (!confirm(`¿Eliminar el producto con código ${id}?`)) return;
  db.collection('productos').doc(id).delete()
    .then(() => renderProductsTable())
    .catch(err => alert('Error: ' + err.message));
}

function closeProductForm(e) {
  if (e && e.target !== document.getElementById('productModal')) return;
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
  document.getElementById('formProductId').value = '';
  document.getElementById('formCode').readOnly = false;
  document.getElementById('formImagePreview').style.display = 'none';
  currentEditId = null;
}

function previewFormImage() {
  const url = document.getElementById('formImage').value.trim();
  const preview = document.getElementById('formImagePreview');
  if (url) {
    preview.src = url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

// ==================== BARCODE GENERATOR ====================
function generateBarcode() {
  const code = document.getElementById('genCode').value.trim();
  const name = document.getElementById('genName').value.trim() || '';
  const price = document.getElementById('genPrice').value.trim() || '';

  if (!code) return alert('Ingresá un código de barras');

  try {
    JsBarcode('#barcodeSvg', code, {
      format: 'EAN13',
      width: 2,
      height: 80,
      displayValue: true,
      fontSize: 16,
      font: 'monospace',
      textMargin: 6,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
      flat: true
    });

    // Add text label below
    const container = document.getElementById('barcodeContainer');
    let label = container.querySelector('.gen-label-text');
    if (!label) {
      label = document.createElement('div');
      label.className = 'gen-label-text';
      label.style.cssText = 'text-align:center;padding:8px 0 0;font-family:monospace;font-size:12px;color:#000;';
      container.appendChild(label);
    }
    label.innerHTML = [name, price ? `$${price}` : ''].filter(Boolean).join(' · ');

    document.getElementById('genResult').style.display = 'flex';
  } catch(e) {
    alert('Error generando código: ' + e.message);
  }
}

function printBarcode() {
  const svg = document.getElementById('barcodeSvg');
  if (!svg.innerHTML) return alert('Generá un código primero');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><style>body{display:flex;justify-content:center;padding:40px;margin:0;}svg{max-width:100%;}</style></head><body>${svg.outerHTML}</body></html>`);
  win.document.close();
  win.print();
}

function downloadBarcode() {
  const svg = document.getElementById('barcodeSvg');
  if (!svg.innerHTML) return alert('Generá un código primero');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgData = new XMLSerializer().serializeToString(svg);
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const link = document.createElement('a');
    link.download = `barcode-${document.getElementById('genCode').value || 'label'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// ==================== HELPERS ====================
function showElement(id, show) {
  document.getElementById(id).style.display = show ? '' : 'none';
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
