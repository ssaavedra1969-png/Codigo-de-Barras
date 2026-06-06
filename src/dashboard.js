import { db } from './firebase.js';
import { formatMoney, formatDate, escHtml } from './utils.js';
import { toastError } from './toast.js';
import { exportToExcel } from './admin.js';

let charts = {};

function destroyCharts() {
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};
}

export async function loadDashboard() {
  destroyCharts();
  document.getElementById('dashContent').innerHTML =
    '<div style="display:flex;justify-content:center;padding:60px 0;"><div class="spinner"></div></div>';

  try {
    const [prodSnap, scanSnap, salesSnap] = await Promise.all([
      db.collection('productos').get(),
      db.collection('scans').orderBy('timestamp', 'desc').limit(50).get(),
      db.collection('ventas').orderBy('timestamp', 'desc').limit(20).get()
    ]);

    const products = [];
    prodSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

    const scans = [];
    scanSnap.forEach(d => scans.push({ id: d.id, ...d.data() }));

    const sales = [];
    salesSnap.forEach(d => sales.push({ id: d.id, ...d.data() }));

    renderStats(products, scans, sales);
    renderFamiliaChart(products);
    renderStockChart(products);
    renderScansTable(scans);
    renderSalesTable(sales);
  } catch (err) {
    document.getElementById('dashContent').innerHTML =
      `<div style="text-align:center;padding:60px;color:var(--red);">Error al cargar dashboard: ${err.message}</div>`;
  }
}

function renderStats(products, scans, sales) {
  const activeProducts = products.filter(p => p.active !== false);
  const totalValue = activeProducts.reduce((sum, p) => sum + (p.cantidad || 0) * (p.costo || 0), 0);
  const lowStock = activeProducts.filter(p => (p.cantidad || 0) <= 3);
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);

  document.getElementById('dashContent').innerHTML = `
    <div class="dash-stats">
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:var(--accent-dim);color:var(--accent);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="dash-stat-body">
          <span class="dash-stat-value">${activeProducts.length}</span>
          <span class="dash-stat-label">Productos activos</span>
        </div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:var(--green-bg);color:var(--green);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="dash-stat-body">
          <span class="dash-stat-value">${formatMoney(totalValue)}</span>
          <span class="dash-stat-label">Valor total (costo)</span>
        </div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:var(--red-bg);color:var(--red);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="dash-stat-body">
          <span class="dash-stat-value ${lowStock.length ? 'dash-stat-danger' : ''}">${lowStock.length}</span>
          <span class="dash-stat-label">Stock bajo (≤3)</span>
        </div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:rgba(136,187,255,0.1);color:#88bbff;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="dash-stat-body">
          <span class="dash-stat-value">${formatMoney(totalSales)}</span>
          <span class="dash-stat-label">Ventas (últimas)</span>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-card" id="familiaChartCard">
        <div class="dash-card-header">
          <h3>Productos por Familia</h3>
        </div>
        <div class="dash-chart-wrapper">
          <canvas id="familiaChart"></canvas>
        </div>
      </div>
      <div class="dash-card" id="stockChartCard">
        <div class="dash-card-header">
          <h3>Stock por Producto (Top 15)</h3>
        </div>
        <div class="dash-chart-wrapper">
          <canvas id="stockChart"></canvas>
        </div>
      </div>
    </div>

    <div class="dash-card">
      <div class="dash-card-header" style="justify-content:space-between;">
        <h3>Últimos escaneos</h3>
      </div>
      <div id="dashScansTable"></div>
    </div>

    <div class="dash-card">
      <div class="dash-card-header" style="justify-content:space-between;">
        <h3>Últimas ventas</h3>
      </div>
      <div id="dashSalesTable"></div>
    </div>

    <div style="display:flex;justify-content:center;gap:12px;margin:24px 0 12px;flex-wrap:wrap;">
      <button class="btn btn-outline" onclick="window.exportToExcel?.()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exportar productos a Excel
      </button>
    </div>
  `;

  window.exportToExcel = exportToExcel;
}

function renderFamiliaChart(products) {
  const canvas = document.getElementById('familiaChart');
  if (!canvas) return;

  const active = products.filter(p => p.active !== false);
  const familias = {};
  active.forEach(p => {
    const f = p.familia || 'Sin categoría';
    familias[f] = (familias[f] || 0) + 1;
  });

  const colors = [
    '#ffd700', '#ff4466', '#22dd88', '#3b82f6', '#ffaa00',
    '#ff66cc', '#44ddff', '#aa88ff', '#ff8844', '#66ffaa'
  ];

  import('chart.js').then(({ Chart, ArcElement, Tooltip, Legend }) => {
    Chart.register(ArcElement, Tooltip, Legend);
    charts.familia = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(familias),
        datasets: [{
          data: Object.values(familias),
          backgroundColor: colors.slice(0, Object.keys(familias).length),
          borderColor: '#0d0d14',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#88889a', font: { size: 11, family: "'Inter', sans-serif" }, padding: 12 }
          }
        }
      }
    });
  }).catch(() => {});
}

function renderStockChart(products) {
  const canvas = document.getElementById('stockChart');
  if (!canvas) return;

  const active = products.filter(p => p.active !== false && (p.cantidad || 0) > 0);
  const sorted = active.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0)).slice(0, 15);

  import('chart.js').then(({ Chart, BarElement, CategoryScale, LinearScale, Tooltip }) => {
    Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);
    charts.stock = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(p => (p.articulo || p.id).length > 20 ? (p.articulo || p.id).slice(0, 20) + '…' : (p.articulo || p.id)),
        datasets: [{
          label: 'Stock',
          data: sorted.map(p => p.cantidad || 0),
          backgroundColor: sorted.map(p => (p.cantidad || 0) <= 3 ? '#ff446688' : '#ffd70088'),
          borderColor: sorted.map(p => (p.cantidad || 0) <= 3 ? '#ff4466' : '#ffd700'),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a4a5a', font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: '#88889a', font: { size: 10 } } }
        }
      }
    });
  }).catch(() => {});
}

function renderScansTable(scans) {
  const container = document.getElementById('dashScansTable');
  if (!container) return;
  if (!scans.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">Todavía no hay escaneos registrados</div>';
    return;
  }
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead><tr><th>Código</th><th>Artículo</th><th>Fecha</th></tr></thead>
        <tbody>${scans.slice(0, 10).map(s =>
          `<tr><td style="font-family:var(--mono);font-size:0.75rem;">${escHtml(s.codigo || '—')}</td><td>${escHtml(s.articulo || '—')}</td><td style="font-size:0.75rem;color:var(--text-muted);">${formatDate(s.timestamp)}</td></tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
}

function renderSalesTable(sales) {
  const container = document.getElementById('dashSalesTable');
  if (!container) return;
  if (!sales.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">Todavía no hay ventas registradas</div>';
    return;
  }
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="admin-table">
        <thead><tr><th>Artículo</th><th>Cant.</th><th>Total</th><th>Fecha</th></tr></thead>
        <tbody>${sales.slice(0, 10).map(s =>
          `<tr><td>${escHtml(s.articulo || s.codigo || '—')}</td><td>${s.cantidad || 0}</td><td style="font-weight:600;">${formatMoney(s.total)}</td><td style="font-size:0.75rem;color:var(--text-muted);">${formatDate(s.timestamp)}</td></tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
}

export function initDashboard() {
  window.loadDashboard = loadDashboard;
}
