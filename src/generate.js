import { db, firebase } from './firebase.js';
import { toastError, toastSuccess } from './toast.js';
import JsBarcode from 'jsbarcode';

const FAMILY_PREFIX = {
  '47Street': '779001',
  'Alpiste': '779002',
  'Batuk': '779003',
  'Billi': '779004',
  'Clandestin': '779005',
  'Cyr': '779006',
  'Geppeto': '779007',
  'Ibiza': '779008',
  'Isostasia': '779009',
  'Kiech': '779010',
  'Kuguana': '779011',
  'Lana': '779012',
  'Legacy': '779013',
  'Owoko': '779014',
  'Sail': '779015',
};

let existingCodes = new Set();
let saving = false;

function ean13CheckDigit(code12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function initGenerate() {
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
  const familia = document.getElementById('genFamilia').value;
  if (!familia) return toastError('Seleccioná una familia primero');

  const prefix = FAMILY_PREFIX[familia];
  if (!prefix) return toastError('Esa familia no tiene prefijo asignado');

  for (let attempt = 0; attempt < 200; attempt++) {
    let mid = '';
    for (let i = 0; i < 6; i++) {
      mid += Math.floor(Math.random() * 10);
    }
    const code12 = prefix + mid;
    const check = ean13CheckDigit(code12);
    const code = code12 + check;

    if (!existingCodes.has(code)) {
      document.getElementById('genCode').value = code;
      generateBarcode();
      return;
    }
  }
  toastError('No se pudo generar un código único, intentá de nuevo');
}

export function generateBarcode() {
  const code = document.getElementById('genCode').value.trim();

  if (!code) return toastError('Generá un código primero');
  if (!/^\d{13}$/.test(code)) return toastError('El código debe tener 13 dígitos');

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
  if (!code) return toastError('Generá un código de barras primero');
  if (!/^\d{13}$/.test(code)) return toastError('El código debe tener 13 dígitos');

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
