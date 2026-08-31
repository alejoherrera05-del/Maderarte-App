# Maderarte App

Aplicación interna para administrar la operación comercial y documental de Maderarte.

Este repositorio es público y está completamente separado de `alejoherrera05-del/Maderarte`, que continúa siendo la página web comercial y el catálogo de la marca.

## Estado actual

**Fundación Base Cero v0.1**

Los registros comerciales comienzan vacíos. La aplicación se conectará únicamente con:

- Google Sheet oficial: `Base de Datos Maderarte App`.
- Google Drive oficial: `MADERARTE APP`.
- Firebase Authentication compartido con HomeEasy para identificar a las personas.
- Roles, permisos y sesiones propios de Maderarte.
- Google Apps Script como cerebro operativo.
- Cloudflare Pages y Pages Functions en el plan gratuito.

## Primer alcance

- Login preparado para Firebase y sesión opaca propia.
- Navegación HTML multipágina, responsive y accesible.
- Centro de operaciones.
- Ledger de órdenes de pedido.
- Expediente de una OP con productos, abonos, comentarios y enlaces.
- Estado del sistema, perfil y permisos.
- Proxy seguro `/api/maderarte` para ocultar Apps Script.
- Base de Apps Script para leer la hoja y organizar Drive por año, mes, cliente y OP.

## Principios

- La orden de pedido es el expediente central de una venta.
- Cada abono es un registro independiente asociado a una OP.
- Los PDFs y soportes viven en Drive; el Sheet conserva sus enlaces.
- El repositorio no almacena clientes, ventas, PDFs, respaldos ni secretos.
- HomeEasy es referencia de funcionamiento y estabilidad, nunca fuente de datos para Maderarte.
- WhatsApp usará más adelante el VPS actual, con contenedores, sesión, número y Bridge exclusivos para Maderarte.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
npm install
npm run check
npm run dev
```

Abrir:

```text
http://localhost:4173/login.html?preview=1
```

La vista `preview=1` funciona únicamente en `localhost` y no crea registros.

## Despliegue previsto

- Repositorio: `alejoherrera05-del/Maderarte-App`.
- Publicación: Cloudflare Pages Free.
- Directorio publicado: `public`.
- API: `functions/api/maderarte.js`.
- Secretos: variables privadas de Cloudflare y Script Properties.

Lee `AGENTS.md` y la carpeta `docs/` antes de modificar reglas comerciales o seguridad.
