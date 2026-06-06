export function formatMoney(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function showElement(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

export function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parseNum(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number' && !isNaN(v)) return v;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function parseIntNum(v) {
  return Math.round(parseNum(v));
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
