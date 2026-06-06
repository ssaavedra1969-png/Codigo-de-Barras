import { db, firebase } from './firebase.js';
import { formatMoney, escHtml, showElement } from './utils.js';
import { toastError, toastSuccess, toast } from './toast.js';

let conteoMap = new Map();
let productCache = new Map();
let cameraScanner = null;
let cameraActive = false;
let scanCooldown = new Map();
const COOLDOWN_MS = 2000;
let beepCtx = null;

function initAudio() {
  if (!beepCtx) {
    beepCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (beepCtx.state === 'suspended') {
    beepCtx.resume();
  }
}

function playBeep() {
  try {
    initAudio();
    const osc = beepCtx.createOscillator();
    const gain = beepCtx.createGain();
    osc.connect(gain);
    gain.connect(beepCtx.destination);
    osc.frequency.value = 2200;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, beepCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, beepCtx.currentTime + 0.15);
    osc.start(beepCtx.currentTime);
    osc.stop(beepCtx.currentTime + 0.15);
  } catch (e) {}
}

export function initConteo() {
  window.conteoAdd = conteoAdd;
  window.conteoFinalizar = conteoFinalizar;
  window.conteoExportCSV = conteoExportCSV;
  window.conteoReiniciar = conteoReiniciar;

  document.getElementById('conteoInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) {
        conteoAddCode(code);
        e.target.value = '';
      }
    }
  });
}

export async function conteoAdd() {
  initAudio();
  const input = document.getElementById('conteoInput');
  const code = input.value.trim();
  if (!code) return;
  input.value = '';
  await conteoAddCode(code);
}

export async function conteoAddCode(code) {
  const now = Date.now();
  const last = scanCooldown.get(code);
  if (last && now - last < COOLDOWN_MS) return;
  scanCooldown.set(code, now);

  playBeep();

  if (conteoMap.has(code)) {
    const c = conteoMap.get(code);
    c.count++;
    conteoMap.set(code, c);
    renderConteoList();
    updateStats();
    return;
  }

  let data = productCache.get(code);
  if (!data) {
    try {
      const doc = await db.collection('productos').doc(code).get();
      if (doc.exists) {
        data = doc.data();
        if (data.active === false) data = null;
        else productCache.set(code, data);
      }
    } catch (e) {}
  }

  conteoMap.set(code, {
    articulo: data?.articulo || '—',
    familia: data?.familia || '—',
    stock: data?.cantidad ?? '—',
    count: 1,
  });

  renderConteoList();
  updateStats();
}

function renderConteoList() {
  const container = document.getElementById('conteoList');
  if (!conteoMap.size) {
    container.innerHTML = '<div class="conteo-empty">Todavía no se escaneó nada</div>';
    return;
  }

  const groups = {};
  conteoMap.forEach((c, code) => {
    const fam = c.familia || 'Sin familia';
    if (!groups[fam]) groups[fam] = [];
    groups[fam].push({ code, ...c });
  });

  const familias = Object.keys(groups).sort();
  let html = '';
  for (const fam of familias) {
    const items = groups[fam];
    const sub = items.reduce((s, i) => s + i.count, 0);
    html += `<div class="conteo-group">
      <div class="conteo-group-title">${escHtml(fam)} <span class="conteo-group-total">${sub}</span></div>`;
    for (const item of items) {
      const diff = item.stock !== '—' ? item.count - item.stock : 0;
      const diffClass = diff === 0 ? 'conteo-diff-ok' : (diff > 0 ? 'conteo-diff-mas' : 'conteo-diff-menos');
      const diffText = item.stock !== '—' ? (diff > 0 ? `+${diff}` : diff) : '—';
      html += `<div class="conteo-item">
        <div class="conteo-item-info">
          <span class="conteo-item-code">${escHtml(item.code)}</span>
          <span class="conteo-item-art">${escHtml(item.articulo)}</span>
        </div>
        <div class="conteo-item-nums">
          <span class="conteo-item-stock">DB: ${item.stock}</span>
          <span class="conteo-item-count">${item.count}</span>
          <span class="conteo-item-diff ${diffClass}">${diffText}</span>
        </div>
      </div>`;
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

function updateStats() {
  let total = 0;
  let diff = 0;
  conteoMap.forEach(c => {
    total += c.count;
    if (c.stock !== '—') diff += Math.abs(c.count - c.stock);
  });
  document.getElementById('conteoTotal').textContent = total;
  document.getElementById('conteoItems').textContent = conteoMap.size;
  document.getElementById('conteoDiff').textContent = diff;
}

export async function conteoFinalizar() {
  if (!conteoMap.size) return toastError('No hay nada para finalizar');

  let html = '<div class="conteo-modal-content">';
  html += '<h3>Resumen del conteo</h3>';
  html += `<p style="color:var(--text-secondary);margin-bottom:16px;">Total contadas: <strong>${document.getElementById('conteoTotal').textContent}</strong> | Items distintos: <strong>${conteoMap.size}</strong></p>`;

  const grupos = {};
  conteoMap.forEach((c, code) => {
    const fam = c.familia || 'Sin familia';
    if (!grupos[fam]) grupos[fam] = [];
    grupos[fam].push({ code, ...c });
  });

  for (const fam of Object.keys(grupos).sort()) {
    const items = grupos[fam];
    const sub = items.reduce((s, i) => s + i.count, 0);
    html += `<div style="margin-bottom:12px;"><strong style="color:var(--conteo);">${escHtml(fam)}</strong> — ${sub} prendas`;
    for (const item of items) {
      const diff = item.stock !== '—' ? item.count - item.stock : 0;
      const d = item.stock !== '—' ? (diff > 0 ? `+${diff}` : diff) : '—';
      html += `<div style="display:flex;justify-content:space-between;padding:2px 0 2px 12px;font-size:0.85rem;">
        <span>${escHtml(item.code)} ${item.articulo !== '—' ? '· ' + escHtml(item.articulo) : ''}</span>
        <span>DB: ${item.stock} → ${item.count} <strong>(${d})</strong></span>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:flex-start;padding:40px 16px;overflow-y:auto;';
  overlay.innerHTML = `<div class="modal" style="max-width:500px;width:100%;" onclick="event.stopPropagation()">
    ${html}
    <div class="modal-actions" style="border:none;padding:16px 0 0;margin:0;">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
      <button class="btn" onclick="this.closest('.modal-overlay').remove();conteoExportCSV()">Exportar CSV</button>
    </div>
  </div>`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

export function conteoExportCSV() {
  if (!conteoMap.size) return toastError('No hay datos para exportar');

  let csv = 'Código,Artículo,Familia,Stock DB,Contado,Diferencia\n';
  conteoMap.forEach((c, code) => {
    const diff = c.stock !== '—' ? c.count - c.stock : 0;
    csv += `"${code}","${c.articulo}","${c.familia}",${c.stock},${c.count},${diff}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  link.download = `conteo_${ts}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toastSuccess('CSV exportado');
}

export function conteoReiniciar() {
  if (conteoMap.size && !confirm('¿Reiniciar el conteo? Se perderán todos los datos actuales.')) return;
  conteoMap.clear();
  scanCooldown.clear();
  renderConteoList();
  updateStats();
  toast('Conteo reiniciado', 'info');
}

export async function conteoStartCamera() {
  if (cameraActive) return;
  initAudio();
  const view = document.getElementById('conteoView');

  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    const scanner = new Html5Qrcode('conteoView');
    cameraScanner = scanner;
    cameraActive = true;

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 15, qrbox: { width: 250, height: 100 } },
      (decodedText) => {
        conteoAddCode(decodedText);
      },
      () => {}
    );
  } catch (err) {
    cameraActive = false;
    const msg = err.message || '';
    if (msg.includes('permission') || msg.includes('NotAllowed')) {
      toastError('Permiso de cámara denegado');
    } else {
      toastError('Error al iniciar cámara: ' + (err.message || ''));
    }
  }
}

export function conteoStopCamera() {
  const s = cameraScanner;
  cameraScanner = null;
  cameraActive = false;
  if (s) {
    try { s.stop().catch(() => {}); } catch (e) {}
    try { s.clear().catch(() => {}); } catch (e) {}
  }
  const view = document.getElementById('conteoView');
  if (view) view.innerHTML = '<div class="conteo-camera-start"><p>Cámara detenida</p></div>';
}
