# Apps Script — Maderarte App v0.2.0

Este código se instala en un proyecto nuevo de Google Apps Script. No se reutiliza el Cerebro de HomeEasy ni el proyecto anterior de Maderarte.

## Propiedades privadas obligatorias

Configura en **Configuración del proyecto → Propiedades del script**:

- `SPREADSHEET_ID`: ID de `Base de Datos Maderarte App`.
- `DRIVE_DOCUMENTS_ROOT_ID`: ID de `02_DOCUMENTOS_CLIENTES`.
- `FIREBASE_WEB_API_KEY`: API key web del proyecto Firebase compartido para identidad.
- `PROXY_TOKEN`: secreto largo y aleatorio, igual al secreto de Cloudflare.
- `APP_BASE_URL`: URL pública final de Maderarte App, sin `/` al final.
- `MODO_OPERACION`: `PREPARACION` durante esta fase.

## Despliegue

1. Crea un proyecto de Apps Script vacío.
2. Copia todos los `.gs` y `appsscript.json`.
3. Ejecuta `verificarBaseCero()` una vez para autorizar permisos y comprobar los encabezados.
4. Despliega como aplicación web ejecutada por el propietario y con acceso para cualquier usuario con el enlace.
5. Guarda la URL `/exec` únicamente en el secreto `MADERARTE_APPS_SCRIPT_URL` de Cloudflare.

Apps Script rechaza solicitudes que no incluyan el `PROXY_TOKEN`. El navegador nunca conoce ese secreto ni la URL privada del Web App.

## Estado funcional

- Autenticación Firebase compartida solo como identidad.
- Autorización, roles y sesiones propias de Maderarte.
- Invitaciones de usuarios.
- Dashboard, órdenes y expediente de OP en lectura.
- Escrituras comerciales deshabilitadas.
