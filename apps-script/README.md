# Apps Script — Maderarte App v0.2.0

Este código se instala en un proyecto nuevo de Google Apps Script. No se reutiliza el Cerebro de HomeEasy ni el proyecto anterior de Maderarte.

## Estado de esta etapa

- Lectura únicamente.
- Sin clientes, órdenes, abonos ni remisiones de prueba.
- Escrituras comerciales deshabilitadas en `apps-script/Config.gs`.
- El proyecto de Apps Script se crea una sola vez y después GitHub queda como fuente del código.

## Instalación recomendada con Codex y clasp

Desde una copia limpia de este repositorio:

```bash
npm ci
npm test
npx @google/clasp login
npx @google/clasp create-script --title "Maderarte App — Cerebro" --type standalone --rootDir apps-script
npx @google/clasp push
npx @google/clasp open-script
```

`clasp` crea un archivo local `.clasp.json` con el ID del proyecto. Ese archivo y las credenciales `.clasprc.json` están bloqueados por `.gitignore` y nunca deben subirse al repositorio público.

Antes de ejecutar `clasp`, la cuenta de Google debe tener habilitada la API de Google Apps Script en la configuración del usuario.

## Propiedades privadas

Configura en **Configuración del proyecto → Propiedades del script**:

- `SPREADSHEET_ID`: ID de `Base de Datos Maderarte App`.
- `DRIVE_DOCUMENTS_ROOT_ID`: ID de `02_DOCUMENTOS_CLIENTES`.
- `FIREBASE_WEB_API_KEY`: API key web del proyecto Firebase compartido para identidad.
- `MADERARTE_PROXY_TOKEN`: secreto largo y aleatorio, igual al secreto de Cloudflare.
- `MODO_OPERACION`: `PREPARACION` durante esta fase.
- `APP_BASE_URL`: URL pública final de Maderarte App, sin `/` al final. Puede agregarse cuando Cloudflare entregue la URL, pero es obligatoria antes de crear invitaciones.

No escribas estos valores dentro de los archivos `.gs` ni los guardes en GitHub.

## Comprobación antes de desplegar

1. Abre el proyecto con `npx @google/clasp open-script`.
2. Selecciona la función `verificarBaseCero`.
3. Ejecútala una vez.
4. Autoriza únicamente los permisos solicitados para Sheets, Drive y conexiones externas.
5. Confirma que la ejecución termine sin error.

`verificarBaseCero()` revisa los encabezados requeridos y rechaza columnas duplicadas.

## Despliegue como Web App

1. Crea una implementación nueva de tipo **Aplicación web**.
2. Ejecutar como: propietario del proyecto.
3. Acceso: cualquier usuario con el enlace.
4. Conserva la URL terminada en `/exec` fuera de GitHub.
5. Esa URL se guardará únicamente como secreto `MADERARTE_APPS_SCRIPT_URL` en Cloudflare.

Apps Script rechaza solicitudes que no incluyan el `MADERARTE_PROXY_TOKEN`. El navegador nunca conoce ese secreto ni la URL privada del Web App.

## Estado funcional

- Autenticación Firebase compartida solo como identidad.
- Autorización, roles y sesiones propias de Maderarte.
- Invitaciones de usuarios.
- Dashboard, órdenes y expediente de OP en lectura.
- Escrituras comerciales deshabilitadas.
