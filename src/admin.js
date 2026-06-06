import { db, firebase } from './firebase.js';
import { escHtml, parseNum, parseIntNum } from './utils.js';
import { toastSuccess, toastError, toast } from './toast.js';
import * as XLSX from 'xlsx';

let adminLoggedIn = false;
let adminExcelData = null;

export function isAdminLoggedIn() {
  return adminLoggedIn;
}

export function toggleAdmin() {
  if (adminLoggedIn) { doLogout(); return; }
  document.getElementById('adminPass').value = '';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginModal').style.display = 'flex';
  setTimeout(() => document.getElementById('adminPass')?.focus(), 200);
}

export function doLogin(e) {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;
  if (pass !== 'admin123') {
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('adminPass').value = '';
    document.getElementById('adminPass').focus();
    return;
  }
  adminLoggedIn = true;
  document.getElementById('loginModal').style.display = 'none';
  document.getElementById('loginBtn').classList.add('logged-in');
  document.getElementById('adminTab').style.display = '';
  document.getElementById('adminMobileTab').style.display = '';
  document.getElementById('adminProductActions').style.display = '';
  toastSuccess('Sesión iniciada como administrador');
}

export function closeLogin(e) {
  if (e && e.target !== document.getElementById('loginModal')) return;
  document.getElementById('loginModal').style.display = 'none';
}

function doLogout() {
  adminLoggedIn = false;
  document.getElementById('loginBtn').classList.remove('logged-in');
  document.getElementById('adminTab').style.display = 'none';
  document.getElementById('adminMobileTab').style.display = 'none';
  document.getElementById('adminProductActions').style.display = 'none';
  if (document.getElementById('tab-admin')?.classList.contains('active')) {
    const scanTab = document.querySelector('.tab[data-tab="scan"]');
    if (scanTab) scanTab.click();
  }
  toast('Sesión cerrada', 'info');
}

const ADMIN_COLUMNS = {
  articulo: ['Artículo', 'ARTICULO', 'articulo', 'Código', 'CODIGO', 'codigo', 'CÓDIGO'],
  descripcion: ['Descripción', 'DESCRIPCIÓN', 'DESCRIPCION', 'descripcion', 'Descripcion', 'Artículo', 'ARTÍCULO', 'Nombre', 'NOMBRE', 'Producto', 'PRODUCTO'],
  color: ['Color', 'COLOR', 'color'],
  talle: ['Talle', 'TALLE', 'talle', 'Tamaño', 'TAMAÑO', 'tamaño', 'Size', 'SIZE'],
  cantidad: ['Cantidad', 'CANTIDAD', 'cantidad', 'Stock', 'STOCK', 'stock', 'Cant.', 'CANT'],
  costo: ['Costo', 'COSTO', 'costo', 'Precio Costo', 'PRECIO COSTO', 'Costo Unitario'],
  venta: ['Venta', 'VENTA', 'venta', 'Precio Venta', 'PRECIO VENTA', 'Precio', 'PRECIO', 'precio', 'Precio Vta'],
  familia: ['Familia', 'FAMILIA', 'familia', 'Categoría', 'CATEGORÍA', 'CATEGORIA', 'categoria', 'Categoria']
};

function findCol(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const match = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (match) return match;
  }
  for (const name of names) {
    const match = keys.find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (match) return match;
  }
  return null;
}

export function previewExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('adminFileName').textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
  document.getElementById('adminFileInfo').style.display = 'flex';

  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rows.length) { toastError('El archivo está vacío'); return; }

      const first = rows[0];
      const colArt = findCol(first, ADMIN_COLUMNS.articulo);
      const colDesc = findCol(first, ADMIN_COLUMNS.descripcion);
      const colColor = findCol(first, ADMIN_COLUMNS.color);
      const colTalle = findCol(first, ADMIN_COLUMNS.talle);
      const colCant = findCol(first, ADMIN_COLUMNS.cantidad);
      const colCosto = findCol(first, ADMIN_COLUMNS.costo);
      const colVenta = findCol(first, ADMIN_COLUMNS.venta);
      const colFam = findCol(first, ADMIN_COLUMNS.familia);

      const headers = Object.keys(rows[0]);
      const thead = document.getElementById('adminPreviewHead');
      thead.innerHTML = `<tr>${headers.map(h => {
        const mapped = [colArt, colDesc, colColor, colTalle, colCant, colCosto, colVenta, colFam].includes(h);
        return `<th style="${mapped ? 'color:var(--accent);' : ''}">${escHtml(h)}</th>`;
      }).join('')}</tr>`;

      const preview = rows.slice(0, 10);
      const tbody = document.getElementById('adminPreviewBody');
      tbody.innerHTML = preview.map(row =>
        `<tr>${headers.map(h => {
          const raw = String(row[h] || '');
          let display = escHtml(raw);
          if (h === colCant) display += `<span class="admin-parse"> → ${parseIntNum(raw)}</span>`;
          else if (h === colCosto || h === colVenta) display += `<span class="admin-parse"> → ${parseNum(raw).toFixed(2)}</span>`;
          return `<td>${display}</td>`;
        }).join('')}</tr>`
      ).join('');

      adminExcelData = rows.map(row => ({
        codigo: String(row[colArt] || '').trim(),
        articulo: colDesc ? String(row[colDesc] || '').trim() : '',
        descripcion: colDesc ? String(row[colDesc] || '').trim() : '',
        color: colColor ? String(row[colColor] || '').trim() : '',
        talle: colTalle ? String(row[colTalle] || '').trim() : '',
        cantidad: colCant ? parseIntNum(row[colCant]) : 0,
        costo: colCosto ? parseNum(row[colCosto]) : 0,
        venta: colVenta ? parseNum(row[colVenta]) : 0,
        familia: colFam ? String(row[colFam] || '').trim() : ''
      }));

      document.getElementById('adminRowCount').textContent =
        `Mostrando ${Math.min(10, rows.length)} de ${rows.length} filas`;
      document.getElementById('adminPreview').style.display = 'block';
      document.getElementById('adminActions').style.display = 'flex';
    } catch (err) {
      toastError('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

export function clearAdminFile() {
  adminExcelData = null;
  document.getElementById('adminExcel').value = '';
  document.getElementById('adminFileInfo').style.display = 'none';
  document.getElementById('adminPreview').style.display = 'none';
  document.getElementById('adminActions').style.display = 'none';
}

export function importAdminExcel() {
  if (!adminExcelData || !adminExcelData.length) {
    toastError('Seleccioná un archivo Excel primero');
    return;
  }

  const total = adminExcelData.length;
  let imported = 0;
  let errors = 0;
  let pending = total;

  const btn = document.querySelector('#adminActions .btn');
  btn.disabled = true;
  btn.textContent = 'Importando...';

  adminExcelData.forEach((item) => {
    if (!item.codigo) { errors++; pending--; checkDone(); return; }

    const data = {
      articulo: item.articulo,
      descripcion: item.descripcion,
      color: item.color,
      talle: item.talle,
      cantidad: item.cantidad,
      costo: item.costo,
      venta: item.venta,
      familia: item.familia,
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('productos').doc(item.codigo).set(data, { merge: true })
      .then(() => { imported++; pending--; checkDone(); })
      .catch(() => { errors++; pending--; checkDone(); });
  });

  function checkDone() {
    if (pending > 0) return;
    btn.disabled = false;
    btn.textContent = 'Importar a Firebase';
    import('./products.js').then(({ renderProductsTable, updateDeleteInfo }) => {
      renderProductsTable();
      updateDeleteInfo();
    });
    toastSuccess(`Importación completada: ${imported} productos importados, ${errors} errores`);
  }
}

export function deleteAllProducts() {
  if (!confirm('¿Eliminar TODOS los productos definitivamente? Esta acción no se puede deshacer.')) return;
  import('./products.js').then(({ loadAllProducts, renderProductsTable, updateDeleteInfo }) => {
    loadAllProducts().then(products => {
      if (!products.length) { toastError('No hay productos para eliminar'); return; }
      const total = products.length;
      if (!confirm(`Hay ${total} productos. ¿Eliminarlos todos?`)) return;

      const progress = document.getElementById('adminDeleteProgress');
      const status = document.getElementById('adminDeleteStatus');
      const count = document.getElementById('adminDeleteCount');
      const fill = document.getElementById('adminDeleteFill');
      const btn = document.getElementById('deleteAllBtn');
      btn.disabled = true;
      btn.textContent = 'Eliminando...';
      progress.style.display = 'block';

      let deleted = 0;
      let failed = 0;
      const BATCH_SIZE = 500;

      function deleteBatch(start) {
        const batch = db.batch();
        const slice = products.slice(start, start + BATCH_SIZE);
        if (!slice.length) { done(); return; }
        slice.forEach(p => batch.delete(db.collection('productos').doc(p.id)));
        batch.commit().then(() => {
          deleted += slice.length;
          status.textContent = 'Eliminando...';
          count.textContent = `${deleted} / ${total}`;
          fill.style.width = `${(deleted / total) * 100}%`;
          deleteBatch(start + BATCH_SIZE);
        }).catch(() => {
          failed += slice.length;
          deleted += slice.length;
          deleteBatch(start + BATCH_SIZE);
        });
      }

      function done() {
        btn.disabled = false;
        btn.textContent = 'Eliminar todos los productos';
        progress.style.display = 'none';
        renderProductsTable();
        updateDeleteInfo();
        toastSuccess(`Eliminación completada: ${deleted - failed} eliminados${failed ? `, ${failed} errores` : ''}`);
      }

      deleteBatch(0);
    }).catch(err => toastError('Error: ' + err.message));
  });
}

export function updateDeleteInfo() {
  import('./products.js').then(({ loadProducts }) => {
    loadProducts().then(products => {
      document.getElementById('adminDeleteInfo').textContent =
        products.length ? `Hay ${products.length} productos en la base de datos` : 'No hay productos en la base de datos';
    }).catch(() => {});
  });
}

export function initAdmin() {
  window.toggleAdmin = toggleAdmin;
  window.doLogin = doLogin;
  window.closeLogin = closeLogin;
  window.previewExcel = previewExcel;
  window.clearAdminFile = clearAdminFile;
  window.importAdminExcel = importAdminExcel;
  window.deleteAllProducts = deleteAllProducts;
  window.importFromExcel = importFromExcel;
}

export function importFromExcel() {
  const fileInput = document.getElementById('excelInput');
  const file = fileInput?.files[0];
  if (!file) return toastError('Seleccioná un archivo Excel primero');

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows.length) return toastError('El archivo Excel está vacío');

      let imported = 0;
      let errors = 0;
      const total = rows.length;

      rows.forEach((row) => {
        const code = String(row['Artículo'] || '').trim();
        if (!code) { errors++; checkDone(); return; }

        const productData = {
          articulo: String(row['Descripción'] || '').trim(),
          descripcion: String(row['Descripción'] || '').trim(),
          color: String(row['Color'] || '').trim(),
          talle: String(row['Talle'] || '').trim(),
          cantidad: parseInt(String(row['Cantidad'] || '0').replace(/[.,]/g, m => m === '.' ? '' : '.')) || 0,
          costo: parseFloat(String(row['Costo'] || '0').replace(/\./g, '').replace(',', '.')) || 0,
          venta: parseFloat(String(row['Venta'] || '0').replace(/\./g, '').replace(',', '.')) || 0,
          familia: String(row['Familia'] || '').trim(),
          active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection('productos').doc(code).set(productData, { merge: true })
          .then(() => { imported++; checkDone(); })
          .catch(() => { errors++; checkDone(); });
      });

      function checkDone() {
        if (imported + errors < total) return;
        fileInput.value = '';
        import('./products.js').then(({ renderProductsTable }) => renderProductsTable());
        toastSuccess(`Importación completada: ${imported} productos importados, ${errors} errores`);
      }
    } catch (err) {
      toastError('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

export async function exportToExcel() {
  try {
    const { loadAllProducts } = await import('./products.js');
    const products = await loadAllProducts();
    if (!products.length) return toastError('No hay productos para exportar');

    const wsData = products.map(p => ({
      'Artículo': p.id,
      'Descripción': p.articulo || '',
      'Color': p.color || '',
      'Talle': p.talle || '',
      'Cantidad': p.cantidad || 0,
      'Costo': p.costo || 0,
      'Venta': p.venta || 0,
      'Familia': p.familia || ''
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, `productos-export-${Date.now()}.xlsx`);
    toastSuccess(`${products.length} productos exportados a Excel`);
  } catch (err) {
    toastError('Error al exportar: ' + err.message);
  }
}
