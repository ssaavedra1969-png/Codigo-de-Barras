/**
 * sync-stock.js — Sincroniza Stock.xlsx con Firebase Firestore
 *
 * Uso: node sync-stock.js
 * Opcional: node sync-stock.js "C:\ruta\otro\archivo.xlsx"
 */

const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ─── Firebase Config ──────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDQ194tU-Yxal7BmGaTiyC2O-Yk8f4cINE",
  authDomain: "second-hub-479314-r4.firebaseapp.com",
  projectId: "second-hub-479314-r4",
  storageBucket: "second-hub-479314-r4.firebasestorage.app",
  messagingSenderId: "812806159022",
  appId: "1:812806159022:web:f0b04dfb5ffc12188d8b3f",
  measurementId: "G-L09F980YS6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const EXCEL_PATH = process.argv[2] || path.join(__dirname, 'stock', 'Stock.xlsx');
const COLLECTION = 'productos';
const CONCURRENCY = 5;
const RESUME_FILE = path.join(__dirname, 'sync-resume.txt');

// ─── Leer Excel ───────────────────────────────────────
function readExcel(filePath) {
  console.log(`📂 Leyendo: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`📊 ${rows.length} filas encontradas\n`);
  return rows;
}

// ─── Preparar docs ────────────────────────────────────
function buildDocs(rows) {
  const docs = [];
  for (const row of rows) {
    const code = String(row['Artículo'] || '').trim();
    if (!code) continue;

    const paddedCode = code.padStart(8, '0');
    const data = {
      articulo: String(row['Descripción'] || '').trim(),
      descripcion: String(row['Descripción'] || '').trim(),
      color: String(row['Color'] || '').trim(),
      talle: String(row['Talle'] || '').trim(),
      cantidad: parseAndCleanInt(row['Cantidad']),
      costo: parseAndCleanFloat(row['Costo']),
      venta: parseAndCleanFloat(row['Venta']),
      familia: String(row['Familia'] || '').trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    docs.push({ code: paddedCode, data });
  }
  return docs;
}

// ─── Resume helpers ────────────────────────────────────
function getLastWritten() {
  try {
    return fs.readFileSync(RESUME_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

function saveLastWritten(code) {
  fs.writeFileSync(RESUME_FILE, code, 'utf8');
}

function clearResume() {
  try { fs.unlinkSync(RESUME_FILE); } catch {}
}

// ─── Sincronizar en lotes con backoff ──────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncProducts(docs, startIndex) {
  const total = docs.length;
  let ok = 0;
  let err = 0;

  for (let i = startIndex; i < total; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(({ code, data }) =>
        db.collection(COLLECTION).doc(code).set(data, { merge: true })
      )
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const code = batch[j].code;
      if (r.status === 'fulfilled') {
        ok++;
        saveLastWritten(code);
      } else {
        const msg = r.reason?.message || '';
        err++;
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          console.log(`\n  ⏸️  Cuota excedida en ${code}. Esperando 60s...`);
          saveLastWritten(code);
          await sleep(60000);
          // reintentar este batch
          i -= CONCURRENCY;
          break;
        } else {
          console.error(`\n  ❌ Error ${code}: ${msg}`);
        }
      }
    }

    process.stdout.write(`\r  🔄 ${Math.min(i + CONCURRENCY, total)}/${total} (${ok} ok, ${err} err)`);
  }

  return { ok, err };
}

// ─── Helpers numéricos ────────────────────────────────
function parseAndCleanInt(val) {
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).replace(/\./g, '').replace(/,/g, '');
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

function parseAndCleanFloat(val) {
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).trim();
  const normalized = str.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// ─── Main ─────────────────────────────────────────────
async function main() {
  console.log('🚀 CB GLAMOURS — Sync de Stock a Firebase\n');

  const rows = readExcel(EXCEL_PATH);
  if (!rows.length) {
    console.log('⚠️  El Excel está vacío, no hay nada que sincronizar.');
    process.exit(0);
  }

  const docs = buildDocs(rows);
  console.log(`📝 ${docs.length} documentos para sincronizar (${rows.length - docs.length} saltados por código vacío)\n`);

  // Reanudar desde donde quedó
  const lastCode = getLastWritten();
  let startIndex = 0;
  if (lastCode) {
    const found = docs.findIndex(d => d.code === lastCode);
    if (found >= 0) startIndex = found + 1;
    console.log(`🔁 Reanudando desde código ${lastCode} (índice ${startIndex})`);
  }

  if (startIndex >= docs.length) {
    console.log('✅ Todos los productos ya fueron sincronizados previamente.');
    clearResume();
    process.exit(0);
  }

  const { ok, err } = await syncProducts(docs, startIndex);

  console.log(`\n\n📦 Resultado: ${ok} productos sincronizados, ${err} errores`);
  if (err === 0) clearResume();

  console.log('✅ Sincronización finalizada');
  process.exit(0);
}

main().catch((e) => {
  console.error('💥 Error fatal:', e);
  process.exit(1);
});
