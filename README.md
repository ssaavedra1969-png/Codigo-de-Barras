# CB GLAMOURS — Sistema de Código de Barras

App web para escanear códigos de barras con pistola USB, consultar productos en Firebase Firestore y gestionar el catálogo.

## Stack

- **GitHub** — repositorio de código
- **Firebase Firestore** — base de datos (plan Spark, gratis)
- **Render** — hosting static site (plan gratis, SSL incluido)

## Cómo usar

### 1. Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear proyecto → nombre `cb-glamours`
3. Firestore Database → Crear base de datos → modo prueba
4. ⚙ Configuración → Agregar app → Web → copiar `firebaseConfig`
5. Pegar el config en `firebase-config.js`

### 2. Deploy en Render

1. Pushear este repo a GitHub
2. Ir a [dashboard.render.com](https://dashboard.render.com) → New + → Static Site
3. Conectar repo → Build Command: vacío → Publish Directory: `.`
4. Crear → HTTPS automático

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
