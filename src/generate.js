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

export function initGenerate() {
  const select = document.getElementById('genFormat');
  if (select) {
    select.innerHTML = FORMATS.map(f =>
      `<option value="${f.value}">${f.label}</option>`
    ).join('');
  }

  window.generateBarcode = generateBarcode;
  window.printBarcode = printBarcode;
  window.downloadBarcode = downloadBarcode;
}

export function generateBarcode() {
  const code = document.getElementById('genCode').value.trim();
  const name = document.getElementById('genName').value.trim() || '';
  const price = document.getElementById('genPrice').value.trim() || '';
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
    let label = container.querySelector('.gen-label-text');
    if (!label) {
      label = document.createElement('div');
      label.className = 'gen-label-text';
      label.style.cssText = 'text-align:center;padding:8px 0 0;font-family:monospace;font-size:12px;color:#000;';
      container.appendChild(label);
    }
    label.innerHTML = [name, price ? `$${price}` : '', format].filter(Boolean).join(' · ');

    document.getElementById('genResult').style.display = 'flex';
    toastSuccess('Código generado');
  } catch (e) {
    toastError('Error generando código: ' + e.message);
  }
}

export function printBarcode() {
  const svg = document.getElementById('barcodeSvg');
  if (!svg?.innerHTML) return toastError('Generá un código primero');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><style>body{display:flex;justify-content:center;padding:40px;margin:0;}svg{max-width:100%;}</style></head><body>${svg.outerHTML}</body></html>`);
  win.document.close();
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
