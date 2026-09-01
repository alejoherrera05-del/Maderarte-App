# Checkpoint — Etapa 3: Cerebro y login

Fecha de cierre: 1 de septiembre de 2026 (America/Bogota)

## Estado aprobado

La Etapa 3 queda implementada sobre el repositorio oficial `alejoherrera05-del/Maderarte-App`, rama `main`, con el Cerebro privado de Apps Script conectado al Worker `maderarte-app` y con el acceso propietario operativo en `https://app.maderartepopayan.com`.

- Versión de la aplicación: `0.2.0`.
- Commit funcional validado: `ba88b5f379e5b8949bd558edfbd528ddc31221ec`.
- Proyecto independiente de Apps Script: `Maderarte App — Cerebro`.
- Base oficial: `Base de Datos Maderarte App`.
- Modo operativo: `PREPARACION`.
- Escrituras comerciales: deshabilitadas.

No se documentan valores secretos, credenciales, cookies, IDs privados ni la URL completa del Web App de Apps Script.

## Criterios de salida

1. **Apps Script existe:** aprobado. Se creó el proyecto independiente `Maderarte App — Cerebro`.
2. **Código remoto igual al repositorio:** aprobado. Los ocho archivos autorizados de `apps-script/` se instalaron sin cambios funcionales respecto del commit validado.
3. **Propiedades privadas:** aprobado. Las seis propiedades requeridas existen en Script Properties y no están versionadas.
4. **Diagnóstico base cero:** aprobado. `verificarBaseCero()` confirmó 23 pestañas, propietario activo, sedes MP y TP, modo `PREPARACION`, raíz documental correcta y cero registros comerciales.
5. **Web App operativo:** aprobado. El despliegue privado respondió correctamente y rechazó un token de proxy incorrecto.
6. **Secretos de Cloudflare:** aprobado. `MADERARTE_APPS_SCRIPT_URL` y `MADERARTE_PROXY_TOKEN` están almacenados como secretos cifrados.
7. **Borde operativo:** aprobado. `GET /api/maderarte` devuelve `200` y `EDGE_OK`.
8. **Proxy hacia Apps Script:** aprobado. `POST PING` atraviesa Cloudflare y devuelve la versión `0.2.0` del Cerebro.
9. **Login propietario:** aprobado. La cuenta propietaria autorizada accede con rol `PROPIETARIO` y sedes MP y TP.
10. **Sesión HttpOnly:** aprobado. El Worker emite la cookie de sesión con `Secure`, `HttpOnly`, `SameSite=Strict` y alcance `/`; el token no se devuelve al JavaScript público.
11. **Persistencia tras recarga:** aprobado. Las sesiones persistente y temporal sobrevivieron a una recarga completa mientras continuaban vigentes.
12. **Cierre de sesión:** aprobado. El logout limpió la autorización y marcó la sesión como `CERRADA`, con fecha y motivo.
13. **Protección sin sesión:** aprobado. `/perfil.html` redirige a `/login.html?next=/perfil.html` y la API responde `401` con `NO_SESSION` cuando falta la cookie.
14. **Usuario no autorizado o inactivo:** aprobado. Las pruebas ejecutables verifican `USER_NOT_AUTHORIZED`, `IDENTITY_MISMATCH` y `USER_INACTIVE`, todos con rechazo `403` cuando corresponde.
15. **Sin referencias a HomeEasy:** aprobado. La inspección visual, las pruebas del repositorio y las respuestas HTML públicas no contienen referencias visibles a HomeEasy.
16. **Base comercial en cero:** aprobado. `Clientes`, `Cotizaciones`, `Ordenes_Pedido`, `Orden_Items`, `Produccion`, `Abonos`, `Remisiones`, `Remision_Items`, `Agenda` y `Documentos` permanecen en cero.
17. **Escrituras comerciales bloqueadas:** aprobado. `COMMERCIAL_WRITES` permanece en `false` y el diagnóstico lo exige.
18. **Instalación reproducible:** aprobado. `npm ci --prefer-offline --no-audit --no-fund` terminó correctamente.
19. **Pruebas locales:** aprobado. `npm test` terminó correctamente con verificación del proyecto, Cerebro, Function y Worker.
20. **Integración continua:** aprobado. GitHub Actions `Calidad` terminó en `success` sobre el commit funcional de `main`.
21. **Dominio de la aplicación:** aprobado. `https://app.maderartepopayan.com/` responde `200`, entrega HTML y conserva `Cache-Control: no-store`.
22. **Sitio público principal:** aprobado. `https://maderartepopayan.com/` continúa respondiendo `200`; no se modificó su repositorio ni su contenido.
23. **Correo de Zoho intacto:** aprobado por no intervención. No se modificaron DNS, MX, SPF, DKIM, DMARC, cuentas ni configuración de Zoho.

## Evidencia de sesiones

- La primera sesión se creó como persistente y quedó cerrada por solicitud del propietario.
- La segunda sesión se creó sin persistencia extendida y tiene una vigencia de 12 horas.
- La pestaña `Sesiones` almacena `Token_Hash` criptográfico y no contiene una columna para token sin hash.
- Cloudflare nunca expone el token de sesión en el JSON de respuesta.
- Las respuestas de API usan `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.

## Evidencia de calidad

La suite local aprobó:

- estructura, sintaxis y referencias de 73 archivos;
- ausencia de secretos, IDs privados y datos comerciales;
- contrato exacto de 23 pestañas;
- diagnóstico de base cero;
- rechazo de usuarios no autorizados, identidades discordantes y usuarios inactivos;
- comportamiento de Cloudflare Function, Worker y Static Assets;
- ausencia de referencias públicas a HomeEasy.

## Barreras que continúan vigentes

- `COMMERCIAL_WRITES` debe permanecer en `false`.
- `MODO_OPERACION` debe permanecer en `PREPARACION`.
- La URL completa de Apps Script y los tokens nunca se guardan en GitHub ni en este documento.
- Las escrituras de clientes, cotizaciones, órdenes, producción, abonos, remisiones, agenda y documentos siguen bloqueadas.
- No se habilitó WhatsApp.
- No se modificaron DNS, el sitio público de Maderarte ni Zoho.

## Conclusión

La Etapa 3 queda **APROBADA Y CERRADA**: el Cerebro privado está conectado, el login propietario funciona de extremo a extremo, las sesiones están protegidas, los accesos sin autorización son rechazados y la base comercial continúa en cero.

La siguiente etapa podrá habilitar funciones comerciales únicamente mediante una autorización explícita y un nuevo checkpoint que cambie conscientemente `COMMERCIAL_WRITES` y `MODO_OPERACION`.
