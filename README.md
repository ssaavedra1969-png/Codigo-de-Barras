# CB GLAMOURS — Sistema de Código de Barras

App web para escanear códigos de barras con pistola USB, consultar productos en Firebase Firestore y gestionar el catálogo.

## Stack

- **GitHub** — repositorio de código
- **Firebase Firestore** — base de datos (plan Spark, gratis)
- **Firebase Storage** — almacenamiento de imágenes
- **Render** — hosting static site (plan gratis, SSL incluido)

## Desarrollo local

```bash
npm install      # Instalar dependencias
npm run dev      # Servidor local con hot reload (puerto 3000)
npm run build    # Build de producción → dist/
npm run preview  # Vista previa del build local
npm run test     # Tests unitarios
npm run sync     # Sincronizar Stock.xlsx → Firebase
```

## Cómo usar

### 1. Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear proyecto → nombre `cb-glamours`
3. Firestore Database → Crear base de datos → modo prueba
4. Storage → Configurar → reglas en modo prueba
5. ⚙ Configuración → Agregar app → Web → copiar `firebaseConfig`
6. Pegar el config en `src/firebase.js`

### 2. Deploy en Render

1. Pushear el repo a GitHub
2. Ir a [dashboard.render.com](https://dashboard.render.com) → New + → Static Site
3. Conectar repo
4. Configurar:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
5. Crear → HTTPS automático

### 3. Agregar productos

- Ir a la pestaña **Productos** → Nuevo
- Ingresar código de barras, nombre, precio, stock
- Escanear con la pistola para ver el resultado

## Controles

| Tecla | Acción |
|---|---|
| Escáner o Enter | Buscar código |
| Ctrl+1 | Pestaña Escanear |
| Ctrl+2 | Pestaña Productos |
| Ctrl+3 | Pestaña Generar |
| Ctrl+4 | Pestaña Dashboard |

## Funcionalidades

- Escaneo manual o por cámara (HTML5 QR)
- CRUD completo de productos
- Importación desde Excel (.xlsx)
- Exportación a Excel
- Generación de códigos de barras (EAN-13, EAN-8, UPC-A, CODE128, CODE39, ITF-14)
- Dashboard con estadísticas y gráficos
- Historial de escaneos y ventas
- Escaneo batch (acumular múltiples productos)
- Subida de imágenes por producto (Firebase Storage)
- Soft delete con confirmación
- Modo offline (Service Worker)
