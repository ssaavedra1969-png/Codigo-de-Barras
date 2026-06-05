// ==================== STATE ====================
let currentEditId = null;
let productsCache = [];
let scanTimeout = null;
let cameraScanner = null;
let cameraActive = false;
let cameraStarting = false;
let saving = false;

// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  if (tab !== 'scan') stopCamera();
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.mobile-tab[data-tab="${tab}"]`)?.classList.add('active');
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
  document.addEventListener('click', () => input.focus());
});

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
        currentEditId = code;
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
  document.getElementById('resultBarcode').textContent = id;
  document.getElementById('resultArticulo').textContent = data.articulo || '—';
  document.getElementById('resultColor').textContent = data.color || '—';
  document.getElementById('resultSize').textContent = data.talle || '—';
  document.getElementById('resultCantidad').textContent =
    data.cantidad !== undefined ? data.cantidad : '—';
  document.getElementById('resultCosto').textContent =
    data.costo ? `$${Number(data.costo).toLocaleString('es-AR')}` : '—';
  document.getElementById('resultPrice').textContent =
    data.venta ? `$${Number(data.venta).toLocaleString('es-AR')}` : '—';
  document.getElementById('resultFamilia').textContent = data.familia || '—';
  document.getElementById('resultDesc').textContent = data.descripcion || '';
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
  stopCamera();
  showElement('scanResult', false);
  showElement('scanError', false);
  showElement('scanEmpty', true);
  document.getElementById('barcodeInput').focus();
}

// ==================== CAMERA SCANNER ====================
let cameraTimeout = null;

function toggleCamera() {
  if (cameraStarting) return;
  if (cameraActive) { stopCamera(); return; }
  startCamera();
}

function startCamera() {
  const reader = document.getElementById('cameraReader');
  const btn = document.getElementById('cameraBtn');

  if (typeof Html5Qrcode === 'undefined') {
    alert('Error: La librería de escaneo no se cargó. Verificá tu conexión a internet.');
    return;
  }

  showElement('scanResult', false);
  showElement('scanError', false);

  reader.style.display = 'flex';
  btn.innerHTML = 'Detener';
  btn.classList.add('active');
  cameraActive = true;
  cameraStarting = true;

  // Auto-close after 30s if no code detected
  cameraTimeout = setTimeout(() => {
    if (cameraActive) {
      stopCamera();
      alert('No se detectó ningún código. Asegurate de que el código esté bien iluminado y enfocado.');
    }
  }, 30000);

  const scanner = new Html5Qrcode('cameraView');
  cameraScanner = scanner;

  scanner.start(
    { facingMode: 'environment' },
    { fps: 15, qrbox: { width: 250, height: 100 } },
    (decodedText) => {
      clearTimeout(cameraTimeout);
      stopCamera();
      lookupBarcode(decodedText);
    },
    () => {}
  ).then(() => {
    cameraStarting = false;
  }).catch((err) => {
    cameraStarting = false;
    clearTimeout(cameraTimeout);
    const msg = err.message || String(err);
    if (msg.includes('NotAllowedError') || msg.includes('permission')) {
      stopCamera();
      alert('Permiso de cámara denegado. Permití el acceso a la cámara desde la configuración del navegador.');
    } else if (msg.includes('NotFoundError')) {
      stopCamera();
      alert('No se encontró ninguna cámara en este dispositivo.');
    } else if (msg.includes('gUM') || msg.includes('getUserMedia')) {
      stopCamera();
      alert('La cámara no está disponible. Usá el código manual.');
    }
  });
}

function stopCamera() {
  clearTimeout(cameraTimeout);
  cameraActive = false;
  cameraStarting = false;
  const s = cameraScanner;
  cameraScanner = null;
  if (s) {
    try { s.stop().catch(() => {}); } catch (e) {}
    try { s.clear().catch(() => {}); } catch (e) {}
  }
  document.getElementById('cameraReader').style.display = 'none';
  document.getElementById('cameraView').innerHTML = '';
  const btn = document.getElementById('cameraBtn');
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Cámara';
  btn.classList.remove('active');
}

// ==================== CREATE FROM SCAN ====================
function newProductFromScan() {
  const code = currentEditId || document.getElementById('resultBarcode').textContent;
  if (!code || code === '—') return;
  // Open form with barcode prefilled
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
  showProductForm();
  switchTab('products');
}

// ==================== CRUD: READ ALL ====================
function loadProducts() {
  return db.collection('productos').orderBy('articulo').get()
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
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Cargando...</td></tr>';

  loadProducts().then(products => {
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No hay productos. Agregá el primero.</td></tr>';
      return;
    }
    const q = (filter || '').toLowerCase();
    const filtered = q
      ? products.filter(p => p.articulo?.toLowerCase().includes(q) || p.id?.includes(q))
      : products;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Sin resultados para "${q}"</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const stockClass = (p.cantidad !== undefined && p.cantidad <= 3) ? 'stock-low' : 'stock-ok';
      return `<tr>
        <td style="font-family:monospace;font-size:0.8rem;">${p.id}</td>
        <td><strong>${escHtml(p.articulo || '—')}</strong></td>
        <td>${escHtml(p.color || '—')}</td>
        <td>${escHtml(p.talle || '—')}</td>
        <td><span class="stock-badge ${stockClass}">${p.cantidad !== undefined ? p.cantidad : '—'}</span></td>
        <td style="font-weight:600;">${p.venta ? '$' + Number(p.venta).toLocaleString('es-AR') : '—'}</td>
        <td>${escHtml(p.familia || '—')}</td>
        <td class="table-actions">
          <button class="action-btn" onclick="editProduct('${p.id}')">Editar</button>
          <button class="action-btn danger" onclick="deleteProduct('${p.id}')">Eliminar</button>
        </td>
      </tr>`;
    }).join('');
  }).catch(err => {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Error: ${err.message}</td></tr>`;
  });
}

function filterProducts() {
  renderProductsTable(document.getElementById('productSearch').value);
}

// ==================== CRUD: CREATE / UPDATE ====================
function showProductForm(data) {
  saving = false;
  const btn = document.getElementById('formSubmitBtn');
  btn.disabled = false;
  btn.textContent = data ? 'Actualizar' : 'Guardar';
  document.getElementById('modalTitle').textContent = data ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('productModal').style.display = 'flex';
}

function fillForm(id, data) {
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

function editProduct(id) {
  db.collection('productos').doc(id).get().then(doc => {
    if (doc.exists) fillForm(doc.id, doc.data());
  });
}

function saveProduct(e) {
  e.preventDefault();
  if (saving) return;
  const code = document.getElementById('formCode').value.trim();
  if (!code) return alert('El código de barras es obligatorio');

  const data = {
    articulo: document.getElementById('formArticulo').value.trim(),
    descripcion: document.getElementById('formDesc').value.trim(),
    color: document.getElementById('formColor').value.trim(),
    talle: document.getElementById('formSize').value.trim(),
    cantidad: parseInt(document.getElementById('formCantidad').value) || 0,
    costo: parseFloat(document.getElementById('formCosto').value) || 0,
    venta: parseFloat(document.getElementById('formVenta').value) || 0,
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
  }

  db.collection('productos').doc(code).set(data, { merge: true })
    .then(() => {
      closeProductForm();
      renderProductsTable();
      if (document.querySelector('.tab[data-tab="scan"]').classList.contains('active')) {
        lookupBarcode(code);
      }
    })
    .catch(err => alert('Error: ' + err.message))
    .finally(() => {
      saving = false;
      btn.disabled = false;
      btn.textContent = isNew ? 'Guardar' : 'Actualizar';
    });
}

function deleteProduct(id) {
  if (!confirm(`¿Eliminar el producto con código ${id}?`)) return;
  db.collection('productos').doc(id).delete()
    .then(() => renderProductsTable())
    .catch(err => alert('Error: ' + err.message));
}

function closeProductForm(e) {
  if (e && e.target !== document.getElementById('productModal')) return;
  saving = false;
  document.getElementById('productModal').style.display = 'none';
  document.getElementById('productForm').reset();
  document.getElementById('formProductId').value = '';
  document.getElementById('formCode').readOnly = false;
  currentEditId = null;
}

// ==================== EXCEL IMPORT ====================
function importFromExcel() {
  const fileInput = document.getElementById('excelInput');
  const file = fileInput.files[0];
  if (!file) return alert('Seleccioná un archivo Excel primero');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows.length) return alert('El archivo Excel está vacío');

      let imported = 0;
      let errors = 0;
      const total = rows.length;

      rows.forEach((row, index) => {
        const code = String(row['Artículo'] || '').trim();
        if (!code) { errors++; return; }

        const productData = {
          articulo: String(row['Descripción'] || '').trim(),
          descripcion: String(row['Descripción'] || '').trim(),
          color: String(row['Color'] || '').trim(),
          talle: String(row['Talle'] || '').trim(),
          cantidad: parseInt(String(row['Cantidad'] || '0').replace(/[.,]/g, m => m === '.' ? '' : '.')) || 0,
          costo: parseFloat(String(row['Costo'] || '0').replace(/\./g, '').replace(',', '.')) || 0,
          venta: parseFloat(String(row['Venta'] || '0').replace(/\./g, '').replace(',', '.')) || 0,
          familia: String(row['Familia'] || '').trim(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection('productos').doc(code).set(productData, { merge: true })
          .then(() => {
            imported++;
            if (imported + errors === total) {
              fileInput.value = '';
              renderProductsTable();
              alert(`Importación completada: ${imported} productos importados, ${errors} errores`);
            }
          })
          .catch(() => {
            errors++;
            if (imported + errors === total) {
              fileInput.value = '';
              renderProductsTable();
              alert(`Importación completada: ${imported} productos importados, ${errors} errores`);
            }
          });
      });
    } catch (err) {
      alert('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
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
