# Maderarte App

Aplicación interna para administrar la operación comercial y documental de Maderarte.

Este repositorio es público y está completamente separado de `alejoherrera05-del/Maderarte`, que continúa siendo la página comercial y el catálogo de la marca.

## Checkpoint vigente — 7 de septiembre de 2026

[**Maddy original: diseño aprobado y guardado comercial completo pendiente**](docs/CHECKPOINT_2026-09-07_VERSION_ORIGINAL.md).

La continuidad se realiza sobre `main` de este repositorio y el dominio habitual `app.maderartepopayan.com`, no sobre la copia de ensayo. Se conserva el formulario y documento aprobados del PR #16, junto con la preparación de guardado de los PR #17 y #18. No se habilitan ventas con este checkpoint: fotos, carpetas, PDF automático y aceptación real de extremo a extremo siguen pendientes. La evidencia de la prueba asistida no sustituye esa aceptación.

## Estado verificado

**Fundación Base Cero v0.2.0**

Los registros comerciales comienzan vacíos. Esta fundación prepara:

- HTML multipágina y responsive.
- Firebase Authentication compartido con HomeEasy únicamente para identidad.
- Usuarios, roles, permisos y sesiones propios de Maderarte.
- Cloudflare Workers con Static Assets en el plan gratuito.
- Google Apps Script como cerebro operativo.
- Google Sheets como base y Google Drive como archivo documental.
- Ledger de órdenes y expediente de OP en modo lectura.

## Fuente operativa

- Hoja oficial: `Base de Datos Maderarte App`.
- Carpeta oficial: `MADERARTE APP`.
- Organización de documentos: año → mes → cliente → OP.
- WhatsApp usará más adelante el VPS actual, con WAHA, Bridge, sesión, número y credenciales exclusivos para Maderarte.

## Reglas esenciales

- La OP es el expediente central de una venta.
- Cada abono es un registro independiente asociado a una OP.
- Los PDFs y soportes viven en Drive; el Sheet conserva enlaces.
- Este repositorio nunca almacena clientes, ventas, PDFs, respaldos ni secretos.
- No existe importación ni traslado de información de sistemas anteriores.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm ci
npm test
npm run dev
```

Vista local sin datos y sin escrituras:

```text
http://localhost:4173/login.html?preview=1
```

## Despliegue previsto

- Repositorio: `alejoherrera05-del/Maderarte-App`.
- Publicación: Cloudflare Workers Free con Static Assets.
- Archivos estáticos: `public/`.
- Entrada del Worker: `worker/index.js`.
- API interna: `functions/api/maderarte.js`, importada por el Worker.
- Comando de despliegue: `npx wrangler deploy`.
- URL temporal: subdominio `workers.dev`.
- Dominio final previsto: `app.maderartepopayan.com`.
- Secretos: variables privadas de Cloudflare y Script Properties de Apps Script.

La interfaz actual de Cloudflare integra la creación de aplicaciones en Workers. No volver a configurar este proyecto como Pages ni restaurar `pages_build_output_dir`.

Lee `AGENTS.md` y `docs/` antes de modificar reglas, autenticación o estructura de datos.
