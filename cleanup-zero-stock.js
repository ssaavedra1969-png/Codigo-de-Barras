/**
 * cleanup-zero-stock.js — Elimina productos con cantidad = 0
 *
 * Uso: node cleanup-zero-stock.js
 */

const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

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
const COLLECTION = 'productos';

async function main() {
  console.log('🔍 Buscando productos con cantidad = 0...\n');

  const snapshot = await db.collection(COLLECTION).where('cantidad', '==', 0).get();

  if (snapshot.empty) {
    console.log('✅ No hay productos con cantidad = 0');
    process.exit(0);
  }

  console.log(`📦 ${snapshot.size} productos encontrados para eliminar\n`);

  let deleted = 0;
  let errors = 0;

  // Borrar de a lotes de 500 (límite de batch de Firestore)
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 500);

    for (const doc of chunk) {
      batch.delete(doc.ref);
    }

    try {
      await batch.commit();
      deleted += chunk.length;
      process.stdout.write(`\r  🗑️  ${deleted}/${docs.length} eliminados`);
    } catch (e) {
      errors += chunk.length;
      console.error(`\n  ❌ Error en lote ${i}: ${e.message}`);
    }
  }

  console.log(`\n\n📦 Resultado: ${deleted} eliminados, ${errors} errores`);
  process.exit(0);
}

main().catch(e => {
  console.error('💥 Error fatal:', e);
  process.exit(1);
});
