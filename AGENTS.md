# AGENTS.md — Maderarte App

## Lectura obligatoria

Antes de trabajar revisa:

1. `docs/ARCHITECTURE.md`
2. `docs/SHEET_SCHEMA.md`
3. `docs/BUSINESS_RULES.md`
4. `docs/AUTH_AND_PERMISSIONS.md`
5. `docs/DRIVE_STRUCTURE.md`
6. `docs/PUBLIC_REPOSITORY_RULES.md`
7. `docs/IMPLEMENTATION_PLAN.md`
8. `docs/CLOUDFLARE_DEPLOYMENT.md`

## Decisiones no negociables

- Este proyecto no modifica ni comparte datos con `alejoherrera05-del/Maderarte`.
- Los registros comerciales empiezan en cero y solo nacen desde Maderarte App.
- La hoja oficial se llama `Base de Datos Maderarte App`.
- La raíz documental se llama `MADERARTE APP`.
- HomeEasy es referencia de interacción, arquitectura y estabilidad; nunca fuente de clientes, órdenes, abonos o documentos.
- La OP es el expediente central. Abonos, remisiones y documentos comerciales siempre referencian una OP.
- Firebase identifica a la persona. Maderarte decide autorización, rol, sede y permisos.
- El navegador nunca llama directamente a Apps Script; usa `/api/maderarte`.
- Google Sheets y Drive son la fuente operativa. No introducir Firestore, SQL, D1 o Drizzle.
- No existe registro público de usuarios.
- No guardar datos comerciales, PDFs, hojas, respaldos, tokens, contraseñas, claves ni `.env` en Git.
- No distribuir archivos de fuentes. `MADERARTE` se presenta con el recurso gráfico aprobado o una cadena tipográfica segura.
- No redibujar el logo ni usar imágenes generadas como identidad.
- El VPS actual podrá alojar WhatsApp de Maderarte, con componentes y credenciales separados de HomeEasy.

## Despliegue Cloudflare

- La aplicación nueva se despliega con Cloudflare Workers y Static Assets, no con Pages.
- `worker/index.js` es la entrada del Worker.
- `public/` contiene los archivos estáticos.
- `functions/api/maderarte.js` conserva la lógica de la API y es importado por el Worker.
- `wrangler.toml` debe mantener `main`, `[assets]`, el binding `ASSETS` y las rutas `/api/maderarte` en `run_worker_first`.
- No reintroducir `pages_build_output_dir`.
- El primer despliegue visual no configura secretos ni habilita escrituras comerciales.

## Frontend

- HTML multipágina dentro de `public/`.
- CSS compartido en `public/css/`.
- Núcleo JavaScript en `public/js/core/`.
- Código específico por pantalla en `public/js/pages/`.
- Una sola capa API, de autenticación y de sesión.
- Sin CSS o JavaScript de negocio inline.
- Interfaz en español, tema claro principal, textos legibles y sin scroll horizontal.

## Estado de escritura

La fundación v0.2.0 es de lectura. No habilitar creación o edición comercial hasta que autenticación, permisos, consecutivos, Drive, idempotencia y auditoría tengan pruebas específicas.

## Validación

Antes de cada entrega:

```bash
npm ci
npm test
```

No declarar estable una fase si el chequeo falla, hay errores de consola o no fue revisada en móvil.
