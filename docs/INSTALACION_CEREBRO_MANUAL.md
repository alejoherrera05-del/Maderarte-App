# Instalar el Cerebro de Maddy copiando y pegando

Este paquete reúne todo el backend vigente de la etapa de lectura (v0.2.0). Incluye autenticación, permisos, sesiones, invitaciones y lectura de clientes, cotizaciones, órdenes y estado del sistema. No habilita guardar ventas, abonos ni remisiones.

El código procede de la rama `etapa-4-paridad-homeeasy`, PR #7, de `alejoherrera05-del/Maderarte-App`. El archivo completo identifica el commit exacto de origen. Pegar el código es el primer paso; la conexión y la estabilidad integrada todavía deben verificarse.

## 1. Pegar el código

1. Abre el proyecto de Apps Script de Maderarte cuyo enlace compartiste. Usa la cuenta propietaria.
2. En **Editor**, abre el archivo inicial `Código.gs` o `Code.gs`. Si no aparece ningún archivo, pulsa **+ → Secuencia de comandos** y llámalo `Codigo`.
3. Abre `Maddy_Cerebro_Completo.txt`, selecciona todo y cópialo. Sustituye el ejemplo inicial `myFunction()` por ese contenido completo.
4. Guarda el proyecto. La última línea debe decir `// FIN DEL CEREBRO COMPLETO`.

Todo el código va en ese único archivo. Los separadores con nombres como `Auth.gs` o `Quotes.gs` son comentarios: no debes crear esos archivos además del completo, porque duplicarías las funciones. Si encuentras código propio ya existente, conserva una copia antes de sustituirlo.

## 2. Pegar el manifiesto

1. Abre **Configuración del proyecto** (engranaje).
2. Activa **Mostrar el archivo de manifiesto appsscript.json en el editor**.
3. Regresa a **Editor**, abre `appsscript.json` y sustituye su contenido por el del archivo `appsscript.json` entregado con este paquete.
4. Guarda. El manifiesto establece el motor V8, la zona horaria de Bogotá y los permisos para Sheets, Drive y conexiones externas.

No pegues el JSON dentro de `Código.gs` ni crees un archivo de secuencia de comandos llamado `appsscript.json`.

## 3. Conectar los recursos privados

En **Configuración del proyecto → Propiedades del script**, conserva los valores correctos si ya existen. Agrega los que falten:

| Propiedad | Valor que corresponde |
| --- | --- |
| `SPREADSHEET_ID` | ID de la hoja oficial **Base de Datos Maderarte App**. Es la parte entre `/d/` y `/edit` de su enlace. |
| `DRIVE_DOCUMENTS_ROOT_ID` | ID de **02_DOCUMENTOS_CLIENTES**, dentro de **MADERARTE APP**. Es la parte después de `/folders/` de su enlace. No es el ID de la carpeta superior. |
| `FIREBASE_WEB_API_KEY` | API key web del proyecto Firebase que ya identifica a los usuarios de esta app. |
| `MADERARTE_PROXY_TOKEN` | El mismo secreto que usa el Worker de Maderarte en Cloudflare. Debe coincidir exactamente en ambos servicios. |
| `MODO_OPERACION` | `PREPARACION` |
| `APP_BASE_URL` | `https://app.maderartepopayan.com`, sin barra al final. |

El modo `PREPARACION` también debe estar en la fila `MODO_OPERACION` de la pestaña **Configuracion** del Sheet: el diagnóstico comprueba esa fila. Las propiedades del script y las filas de la hoja son lugares distintos.

Estos valores no se incluyen en el archivo de código. No pegues contraseñas, tokens ni capturas de sus valores en el chat o en GitHub. Si falta un secreto, hay que configurarlo de forma coordinada; escribir un valor cualquiera en un solo servicio no conectará la app.

## 4. Comprobar la base

1. En el selector de funciones del editor, elige **verificarBaseCero** y pulsa **Ejecutar**.
2. Completa la autorización de Google para este proyecto con la cuenta que tiene acceso a la hoja y a Drive.
3. Revisa el registro de ejecución. Debe terminar sin error y mostrar `ok: true`, `sheetsVerified: 23`, `commercialWrites: false`, `mode: PREPARACION`, sedes `MP` y `TP`, y todos los recuentos comerciales en cero.

La función solo comprueba la base: no crea pestañas, roles, usuarios o ventas, ni borra registros. La hoja debe tener ya las 23 pestañas y el usuario propietario autorizado. Si sale un error, conserva el texto; no elimines datos para forzar el resultado.

Esta comprobación no valida por sí sola la contraseña del usuario, Firebase, el secreto de Cloudflare ni toda la conexión de la app.

## 5. Implementar y enlazar la app

Si el proyecto ya tiene una aplicación web activa: **Implementar → Gestionar implementaciones → seleccionar la aplicación web → Editar → Versión: Nueva versión → Implementar**. Así se conserva su URL.

Si realmente no existe ninguna: **Implementar → Nueva implementación → Aplicación web**. Configura **Ejecutar como: tú / propietario** y **Quién tiene acceso: Cualquier usuario**. Las llamadas operativas siguen protegidas por el secreto del proxy y, según la acción, por sesión y permisos. Conserva la URL que termina en `/exec`.

En Cloudflare, el Worker **maderarte-app** debe tener el secreto `MADERARTE_APPS_SCRIPT_URL` con esa URL y `MADERARTE_PROXY_TOKEN` con el mismo valor que Apps Script. Comprueba también el entorno de revisión que se esté usando. Si actualizaste la implementación existente, su URL no debería cambiar.

Abrir `/exec` puede mostrar `APP_SCRIPT_OK`: solo demuestra que el código responde. Para cerrar la etapa falta ingresar a Maddy con una cuenta autorizada, comprobar la lectura y el seguimiento con la nueva paginación y abrir un documento permitido de Drive, manteniendo la base comercial en cero.

## Errores que orientan el siguiente paso

| Mensaje o código | Qué comprobar |
| --- | --- |
| `CONFIG_MISSING` | Falta la propiedad indicada en Configuración del proyecto. |
| `SPREADSHEET_NAME_MISMATCH` | El ID debe apuntar a la hoja oficial nueva. |
| `DRIVE_ROOT_MISMATCH` | Debe apuntar a `02_DOCUMENTOS_CLIENTES`. |
| `SHEET_MISSING` / `SHEET_SCHEMA_MISMATCH` | Falta una pestaña o sus encabezados no coinciden. |
| `OWNER_NOT_READY` | El propietario debe existir y estar activo, con identidad Firebase. |
| `COMMERCIAL_BASE_NOT_ZERO` | El diagnóstico encontró datos comerciales; revisar, no borrar. |
| `PROXY_REJECTED` | El secreto enviado desde Cloudflare no coincide con el del proyecto. |

## Fuente y reproducción

El paquete se genera desde el repositorio con `node scripts/export-cerebro.mjs` y queda en `dist/cerebro-manual/`. Los nueve módulos originales siguen siendo la fuente editable. La exportación valida la sintaxis conjunta, la presencia de todas sus funciones y la ausencia de funciones duplicadas; no sustituye la prueba en Google.

Referencias oficiales: [manifiesto](https://developers.google.com/apps-script/concepts/manifests), [propiedades](https://developers.google.com/apps-script/guides/properties), [aplicaciones web](https://developers.google.com/apps-script/guides/web), [implementaciones](https://developers.google.com/apps-script/concepts/deployments).
