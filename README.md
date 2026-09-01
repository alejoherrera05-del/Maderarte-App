# Maderarte App

Aplicación interna para administrar la operación comercial y documental de Maderarte.

Este repositorio es público y está completamente separado de `alejoherrera05-del/Maderarte`, que continúa siendo la página comercial y el catálogo de la marca.

## Estado verificado

**Fundación Base Cero v0.2.0**

Los registros comerciales comienzan vacíos. Esta fundación prepara:

- HTML multipágina y responsive.
- Firebase Authentication compartido con HomeEasy únicamente para identidad.
- Usuarios, roles, permisos y sesiones propios de Maderarte.
- Cloudflare Pages y Pages Functions en el plan gratuito.
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
- Publicación: Cloudflare Pages Free.
- Directorio publicado: `public`.
- API: `functions/api/maderarte.js`.
- Secretos: variables privadas de Cloudflare y Script Properties de Apps Script.

Lee `AGENTS.md` y `docs/` antes de modificar reglas, autenticación o estructura de datos.
