# Arquitectura

## Objetivo

Maderarte App es una aplicación HTML multipágina, rápida en computador y celular, con una arquitectura equivalente a los patrones estables de HomeEasy y una base comercial totalmente independiente.

## Flujo

```text
Navegador
  ├── HTML + CSS + JavaScript
  ├── Firebase Authentication
  └── /api/maderarte
          ↓
Cloudflare Worker + Static Assets
  ├── sirve public/ sin ejecutar código dinámico
  ├── ejecuta el Worker primero solo para /api/maderarte
  ├── valida origen y tamaño
  ├── administra cookie de sesión HttpOnly
  └── reenvía a Apps Script
          ↓
Google Apps Script
  ├── autentica sesión
  ├── aplica permisos
  ├── lee y escribe Google Sheets
  ├── organiza Google Drive
  ├── genera documentos
  └── registra auditoría
```

## Decisión de despliegue

Cloudflare integra actualmente la creación de aplicaciones nuevas en Workers. Maderarte usa Workers con Static Assets porque permite publicar los HTML de `public/` y ejecutar la API en el mismo origen, sin cambiar la arquitectura multipágina ni introducir un framework.

- `worker/index.js` es la entrada de ejecución.
- `functions/api/maderarte.js` mantiene la lógica de la frontera API.
- `wrangler.toml` apunta `assets.directory` a `./public`.
- Solo `/api/maderarte` ejecuta primero el Worker.
- Las rutas estáticas conservan los nombres `.html`.
- `_headers`, `_redirects` y `404.html` permanecen dentro de `public/`.

## Identidad y autorización

Firebase Authentication identifica a la persona con la misma cuenta que puede usar en HomeEasy. El acceso a Maderarte depende además de que esa persona exista y esté activa en `Usuarios` de `Base de Datos Maderarte App`.

HomeEasy y Maderarte no comparten roles, permisos, sesiones ni datos comerciales.

## Sesión

1. El navegador inicia sesión contra Firebase mediante su API REST.
2. Envía el ID token a `/api/maderarte`.
3. Apps Script valida la identidad y la autorización en el Sheet.
4. Apps Script emite un token opaco y guarda únicamente su hash.
5. Cloudflare conserva el token real en una cookie `HttpOnly`, `Secure` y `SameSite=Strict`.
6. Cada pantalla valida la sesión y los permisos antes de cargar información.
7. Un fallo transitorio puede usar temporalmente el perfil no sensible almacenado, pero nunca habilita una escritura sin validación del backend.

## Datos

- Sheet oficial: `Base de Datos Maderarte App`.
- Drive oficial: `MADERARTE APP`.
- Las columnas se resuelven por encabezado, no por posición fija.
- Toda escritura futura utilizará `Request_ID` y `LockService`.
- El repositorio contiene estructura y lógica, nunca registros comerciales.

## Frontend

- `public/*.html`: pantallas.
- `public/css/`: sistema visual compartido.
- `public/js/core/`: configuración, API, sesión, autenticación, permisos y shell.
- `public/js/pages/`: lógica específica de cada pantalla.
- `worker/index.js`: entrada del Worker y entrega de archivos estáticos.
- `functions/api/maderarte.js`: frontera segura de `/api/maderarte`.

## Backend

- `apps-script/Config.gs`: propiedades privadas y respuestas comunes.
- `apps-script/Schema.gs`: contrato exacto de hojas y roles iniciales.
- `apps-script/SheetHelpers.gs`: acceso por encabezados.
- `apps-script/DriveFolders.gs`: año, mes, cliente y OP.
- `apps-script/Auth.gs`: Firebase, autorización y sesiones.
- `apps-script/Orders.gs`: consultas de órdenes y expedientes.
- `apps-script/Router.gs`: acciones públicas del Web App.

## Dominio

El primer control visual se realiza en un subdominio temporal `workers.dev`. El dominio final previsto es `app.maderartepopayan.com`. Antes de mover o delegar DNS se debe inventariar la página pública, correo y registros actuales para no interrumpir servicios existentes.

## WhatsApp

La integración futura utilizará el VPS actual de Hetzner. HomeEasy y Maderarte compartirán la máquina, pero Maderarte tendrá WAHA, Bridge, sesión, número, token, almacenamiento, dominio y registros propios.
