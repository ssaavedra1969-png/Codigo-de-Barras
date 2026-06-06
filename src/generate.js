import { db, firebase } from './firebase.js';
import { toastError, toastSuccess } from './toast.js';
import JsBarcode from 'jsbarcode';

const FORMATS = [
  { value: 'EAN13', label: 'EAN-13 (13 dígitos)' },
  { value: 'EAN8', label: 'EAN-8 (8 dígitos)' },
  { value: 'UPC', label: 'UPC-A (12 dígitos)' },
  { value: 'CODE128', label: 'CODE128 (variable)' },
  { value: 'CODE39', label: 'CODE39 (variable)' },
  { value: 'ITF', label: 'ITF-14 (variable)' },
];

let existingCodes = new Set();
let saving = false;

export function initGenerate() {
  const select = document.getElementById('genFormat');
  if (select) {
    select.innerHTML = FORMATS.map(f =>
      `<option value="${f.value}">${f.label}</option>`
    ).join('');
  }

  db.collection('productos').get().then(snapshot => {
    existingCodes = new Set();
    snapshot.forEach(doc => existingCodes.add(doc.id));
  }).catch(() => {});

  window.generateBarcode = generateBarcode;
  window.printBarcode = printBarcode;
  window.downloadBarcode = downloadBarcode;
  window.generateUniqueCode = generateUniqueCode;
  window.saveGeneratedProduct = saveGeneratedProduct;
}

export function generateUniqueCode() {
  const format = document.getElementById('genFormat')?.value || 'EAN13';
  let len, prefix;
  if (format === 'EAN13') { len = 13; prefix = '779'; }
  else if (format === 'EAN8') { len = 8; prefix = '77'; }
  else if (format === 'UPC') { len = 12; prefix = '7'; }
  else { len = 10; prefix = '9'; }

  for (let attempt = 0; attempt < 100; attempt++) {
    let code = prefix;
    for (let i = prefix.length; i < len; i++) {
      code += Math.floor(Math.random() * 10);
    }
    if (!existingCodes.has(code)) {
      document.getElementById('genCode').value = code;
      toastSuccess('Código único generado');
      return;
    }
  }
  toastError('No se pudo generar un código único, intentá de nuevo');
}

export function generateBarcode() {
  const code = document.getElementById('genCode').value.trim();
  const format = document.getElementById('genFormat')?.value || 'EAN13';

  if (!code) return toastError('Ingresá un código de barras');

  let validLen = true;
  if (format === 'EAN13') validLen = /^\d{12,13}$/.test(code);
  else if (format === 'EAN8') validLen = /^\d{7,8}$/.test(code);
  else if (format === 'UPC') validLen = /^\d{11,12}$/.test(code);

  if (!validLen) {
    toastError(`El código no tiene la longitud correcta para formato ${format}`);
    return;
  }

  try {
    JsBarcode('#barcodeSvg', code, {
      format,
      width: format === 'CODE128' ? 1.2 : 2,
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
    const existing = container.querySelector('.gen-label-text');
    if (existing) existing.remove();

    document.getElementById('genResult').style.display = 'flex';
  } catch (e) {
    toastError('Error generando código: ' + e.message);
  }
}

export async function saveGeneratedProduct() {
  if (saving) return;

  const code = document.getElementById('genCode').value.trim();
  if (!code) return toastError('Ingresá o generá un código de barras primero');
  if (code.length < 3) return toastError('El código debe tener al menos 3 caracteres');

  if (existingCodes.has(code)) {
    return toastError('Ese código ya existe en la base de datos');
  }

  saving = true;
  const btn = document.getElementById('genSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const data = {
    articulo: document.getElementById('genName').value.trim(),
    descripcion: document.getElementById('genDesc').value.trim(),
    color: document.getElementById('genColor').value.trim(),
    talle: document.getElementById('genSize').value.trim(),
    cantidad: parseInt(document.getElementById('genCantidad').value) || 0,
    costo: parseFloat(document.getElementById('genCosto').value) || 0,
    venta: parseFloat(document.getElementById('genVenta').value) || 0,
    familia: document.getElementById('genFamilia').value,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    active: true
  };

  try {
    await db.collection('productos').doc(code).set(data);
    existingCodes.add(code);
    toastSuccess('Producto guardado correctamente');
    generateBarcode();
  } catch (err) {
    console.error('saveGeneratedProduct error:', err);
    const msg = err.message || '';
    if (msg.includes('permission') || msg.includes('Missing or insufficient')) {
      toastError('Error de permisos: Firebase no permite escribir. Revisá las reglas de Firestore en la consola.');
    } else {
      toastError('Error al guardar: ' + err.message);
    }
  } finally {
    saving = false;
    btn.disabled = false;
    btn.textContent = 'Guardar producto';
  }
}

export function printBarcode() {
  const container = document.getElementById('barcodeContainer');
  if (!container?.querySelector('svg')?.innerHTML) return toastError('Generá un código primero');
  const style = `
    <style>
      body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; padding:40px; background:#fff; }
      svg { max-width:100%; height:auto; }
      @media print { body { padding:0; } }
    </style>
  `;
  const content = container.innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`<html><head>${style}</head><body>${content}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadBarcode() {
  const svg = document.getElementById('barcodeSvg');
  if (!svg?.innerHTML) return toastError('Generá un código primero');
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
    link.download = `barcode-${document.getElementById('genCode')?.value || 'label'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}
