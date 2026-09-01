# Despliegue en Cloudflare

Fecha de decisión: 1 de septiembre de 2026.

## Plataforma elegida

Maderarte App se despliega como **Cloudflare Worker con Static Assets**.

La aplicación continúa siendo HTML multipágina. Cloudflare publica los archivos de `public/` y ejecuta código dinámico únicamente para la ruta `/api/maderarte`.

No se usa Pages para proyectos nuevos y no debe restaurarse `pages_build_output_dir`.

## Archivos responsables

```text
wrangler.toml
worker/index.js
functions/api/maderarte.js
public/
```

- `wrangler.toml` define el nombre, la entrada, la carpeta de archivos estáticos y las rutas de API.
- `worker/index.js` entrega la API al manejador seguro y delega el resto al binding `ASSETS`.
- `functions/api/maderarte.js` valida solicitudes, cookies, origen y comunicación con Apps Script.
- `public/` contiene HTML, CSS, JavaScript, `_headers`, `_redirects` y `404.html`.

## Configuración de Workers Builds

```text
Repositorio: alejoherrera05-del/Maderarte-App
Rama de producción: main
Nombre del proyecto: maderarte-app
Comando de compilación: vacío
Comando de implementación: npx wrangler deploy
Comando para ramas no productivas: npx wrangler versions upload
Ruta del repositorio: /
Cloudflare Access: desactivado durante el control visual
Variables y secretos: ninguno durante el primer despliegue
```

Cloudflare puede crear automáticamente el token de API necesario para Workers Builds. No copiar ese token al repositorio ni compartirlo en mensajes.

## Primera salida esperada

- Despliegue exitoso desde `main`.
- URL temporal bajo `workers.dev`.
- La raíz redirige a `/login.html`.
- Los archivos estáticos cargan sin ejecutar el Worker.
- `GET /api/maderarte` responde `EDGE_OK`.
- Un `POST` que requiera Apps Script responde `API_NOT_CONFIGURED` hasta configurar secretos.
- No se crea ni modifica información comercial.

## Dominio personalizado

El dominio final previsto es:

```text
app.maderartepopayan.com
```

Antes de conectar el dominio se debe:

1. Inventariar los DNS actuales de `maderartepopayan.com`.
2. Confirmar dónde están la página pública y los registros de correo.
3. Evitar cualquier cambio que interrumpa el dominio principal, el catálogo o el correo.
4. Conectar únicamente el subdominio `app` cuando el despliegue temporal esté aprobado.

## Costos

Se mantiene el plan Workers Free. No habilitar Workers Paid, KV, D1, R2, AI ni otro producto con facturación para esta etapa.

## Criterio de aprobación

La publicación visual no se considera terminada hasta comprobar:

- commit desplegado;
- resultado de Workers Builds;
- login y navegación en computador;
- comportamiento en móvil;
- cabeceras de seguridad;
- rutas estáticas y 404;
- API en estado controlado;
- ausencia de secretos y escrituras comerciales.
