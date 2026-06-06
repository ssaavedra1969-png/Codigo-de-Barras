import { db, firebase } from './firebase.js';
import { formatMoney, escHtml, showElement } from './utils.js';
import { toastError, toast } from './toast.js';

let currentEditId = null;
let cameraScanner = null;
let cameraActive = false;
let cameraStarting = false;
let cameraTimeout = null;

export function getCurrentEditId() {
  return currentEditId;
}

function playScanSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* audio not available */ }
}

export function lookupBarcode(code) {
  showElement('scanEmpty', false);
  showElement('scanResult', false);
  showElement('scanError', false);
  showElement('scanLoading', true);

  playScanSound();

  db.collection('productos').doc(code).get()
    .then(doc => {
      showElement('scanLoading', false);
      if (doc.exists) {
        showProductResult(doc.id, doc.data());
        logScan(code, doc.data().articulo || '');
      } else {
        currentEditId = code;
        newProductFromScan();
      }
    })
    .catch(err => {
      showElement('scanLoading', false);
      showElement('scanError', true);
      document.getElementById('scanErrorMsg').textContent = `Error: ${err.message}`;
    });
}

function logScan(code, articulo) {
  db.collection('scans').add({
    codigo: code,
    articulo: articulo || '',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

function showProductResult(id, data) {
  showElement('scanResult', true);
  document.getElementById('resultBarcode').textContent = id;
  document.getElementById('resultArticulo').textContent = data.articulo || '—';
  document.getElementById('resultColor').textContent = data.color || '—';
  document.getElementById('resultSize').textContent = data.talle || '—';
  document.getElementById('resultCantidad').textContent =
    data.cantidad !== undefined ? data.cantidad : '—';
  document.getElementById('resultCosto').textContent = formatMoney(data.costo);
  document.getElementById('resultPrice').textContent = formatMoney(data.venta);
  document.getElementById('resultFamilia').textContent = data.familia || '—';
  document.getElementById('resultDesc').textContent = data.descripcion || '';
  currentEditId = id;

  const sellBtn = document.getElementById('sellFromScanBtn');
  if (sellBtn) {
    sellBtn.style.display = (data.cantidad || 0) > 0 ? '' : 'none';
  }

  renderProductImages(data.images);
}

function renderProductImages(images) {
  const container = document.getElementById('resultImages');
  if (!container) return;
  if (!images || !images.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = images.map(url =>
    `<img src="${escHtml(url)}" class="product-image-thumb" onclick="window.open('${escHtml(url)}','_blank')" loading="lazy">`
  ).join('');
}

export function editFromScan() {
  if (!currentEditId) return;
  db.collection('productos').doc(currentEditId).get()
    .then(doc => {
      if (doc.exists) {
        window.fillForm?.(doc.id, doc.data());
        const tab = document.querySelector('.tab[data-tab="products"]');
        if (tab) tab.click();
      }
    });
}

export function resetScan() {
  stopCamera();
  showElement('scanResult', false);
  showElement('scanError', false);
  showElement('scanEmpty', true);
  document.getElementById('barcodeInput')?.focus();
}

export function toggleCamera() {
  if (cameraStarting) return;
  if (cameraActive) { stopCamera(); return; }
  startCamera();
}

async function startCamera() {
  const reader = document.getElementById('cameraReader');
  const btn = document.getElementById('cameraBtn');

  showElement('scanResult', false);
  showElement('scanError', false);

  reader.style.display = 'flex';
  btn.innerHTML = 'Detener';
  btn.classList.add('active');
  cameraActive = true;
  cameraStarting = true;

  cameraTimeout = setTimeout(() => {
    if (cameraActive) {
      stopCamera();
      toast('No se detectó ningún código. Asegurate de que el código esté bien iluminado y enfocado.', 'warning');
    }
  }, 30000);

  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('cameraView');
    cameraScanner = scanner;
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 250, height: 100 } },
      (decodedText) => {
        clearTimeout(cameraTimeout);
        stopCamera();
        lookupBarcode(decodedText);
      },
      () => {}
    );
    cameraStarting = false;
  } catch (err) {
    cameraStarting = false;
    clearTimeout(cameraTimeout);
    const msg = err.message || String(err);
    if (msg.includes('NotAllowedError') || msg.includes('permission')) {
      stopCamera();
      toastError('Permiso de cámara denegado. Permití el acceso a la cámara desde la configuración del navegador.');
    } else if (msg.includes('NotFoundError')) {
      stopCamera();
      toastError('No se encontró ninguna cámara en este dispositivo.');
    } else if (msg.includes('gUM') || msg.includes('getUserMedia')) {
      stopCamera();
      toastError('La cámara no está disponible. Usá el código manual.');
    } else {
      toastError('Error al iniciar cámara: ' + (err.message || ''));
    }
  }
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
  const reader = document.getElementById('cameraReader');
  if (reader) reader.style.display = 'none';
  const view = document.getElementById('cameraView');
  if (view) view.innerHTML = '';
  const btn = document.getElementById('cameraBtn');
  if (btn) {
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>\n        Cámara';
    btn.classList.remove('active');
  }
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
  window.showNewProductForm?.();
  const tab = document.querySelector('.tab[data-tab="products"]');
  if (tab) tab.click();
}

export function initScanner() {
  const input = document.getElementById('barcodeInput');
  if (input) {
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
  }

  window.toggleCamera = toggleCamera;
  window.resetScan = resetScan;
  window.editFromScan = editFromScan;
  window.lookupBarcode = lookupBarcode;
  window.newProductFromScan = newProductFromScan;
  window.sellFromScan = sellFromScan;
}

export async function sellFromScan() {
  const code = currentEditId || document.getElementById('resultBarcode')?.textContent;
  if (!code || code === '—') return;
  try {
    const { sellProduct } = await import('./products.js');
    await sellProduct(code);
    lookupBarcode(code);
  } catch (err) {
    toastError('Error: ' + (err.message || ''));
  }
}
