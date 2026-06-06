import './styles.css';
import { db, firebase } from './firebase.js';
import { showElement } from './utils.js';
import { toastError, toastSuccess, toast } from './toast.js';
import { initScanner, resetScan, lookupBarcode, newProductFromScan } from './scanner.js';
import { initProducts, renderProductsTable, closeProductForm, showNewProductForm, filterProducts, editProduct, deleteProduct } from './products.js';
import { initAdmin, isAdminLoggedIn, toggleAdmin, doLogin, closeLogin, previewExcel, clearAdminFile, importAdminExcel, deleteAllProducts, exportToExcel, importFromExcel } from './admin.js';
import { initGenerate } from './generate.js';
import { initConteo } from './conteo.js';

let saving = false;
let tabHistory = [];

function switchTab(tab, fromPop) {
  if (!fromPop && tabHistory[tabHistory.length - 1] !== tab) {
    tabHistory.push(tab);
    history.pushState({ tab }, '');
  }
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelector(`.mobile-tab[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  if (tab === 'scan') document.getElementById('barcodeInput')?.focus();
  if (tab === 'products') renderProductsTable();
  if (tab === 'admin') import('./admin.js').then(m => m.updateDeleteInfo());
}

window.addEventListener('popstate', () => {
  if (tabHistory.length > 1) {
    tabHistory.pop();
    switchTab(tabHistory[tabHistory.length - 1], true);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  switchTab('scan');
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault();
    const tabs = ['scan', 'products', 'generate', 'conteo'];
    switchTab(tabs[parseInt(e.key) - 1]);
  }
});

initScanner();
initProducts();
initAdmin();
initGenerate();
initConteo();

window.switchTab = switchTab;
window.closeProductForm = closeProductForm;
window.showNewProductForm = showNewProductForm;
window.filterProducts = filterProducts;
window.renderProductsTable = renderProductsTable;
window.exportToExcel = exportToExcel;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.toggleAdmin = toggleAdmin;
window.doLogin = doLogin;
window.closeLogin = closeLogin;
window.previewExcel = previewExcel;
window.clearAdminFile = clearAdminFile;
window.importAdminExcel = importAdminExcel;
window.deleteAllProducts = deleteAllProducts;
window.importFromExcel = importFromExcel;
