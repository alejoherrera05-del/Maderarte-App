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
9. `docs/HOMEEASY_PARITY_MAP.md`

## Decisiones no negociables

- Este proyecto no modifica ni comparte datos con `alejoherrera05-del/Maderarte`.
- Los registros comerciales empiezan en cero y solo nacen desde Maderarte App.
- La hoja oficial se llama `Base de Datos Maderarte App`.
- La raíz documental se llama `MADERARTE APP`.
- **HomeEasy `main` es el molde funcional y de experiencia de Maderarte App.** No es solo inspiración visual. Para cualquier módulo equivalente se debe partir de la pantalla HomeEasy vigente indicada en `docs/HOMEEASY_PARITY_MAP.md`.
- HomeEasy nunca es fuente de clientes, órdenes, abonos o documentos de Maderarte.
- La OP es el expediente central. Abonos, remisiones y documentos comerciales siempre referencian una OP.
- Firebase identifica a la persona. Maderarte decide autorización, rol, sede y permisos.
- El navegador nunca llama directamente a Apps Script; usa `/api/maderarte`.
- Google Sheets y Drive son la fuente operativa. No introducir Firestore, SQL, D1 o Drizzle.
- No existe registro público de usuarios.
- No guardar información sensible o comercial en Git.
- No distribuir archivos de fuentes. `MADERARTE` se presenta con el recurso gráfico aprobado o una cadena tipográfica segura.
- No redibujar el logo ni usar imágenes generadas como identidad.
- El VPS actual podrá alojar WhatsApp de Maderarte, con componentes y credenciales separados de HomeEasy.

## Contrato de paridad HomeEasy → Maderarte

1. Si HomeEasy ya resolvió un flujo equivalente, **no diseñar otro desde cero**.
2. Inspeccionar primero la versión vigente del módulo en `alejoherrera05-del/Homeeasy`, rama `main`, incluidos sus overrides CSS/JS actuales.
3. Portar composición, jerarquía, navegación, flujo entre estados, responsive, bottom sheets/popovers, estados de carga/vacío/error, retorno contextual y microinteracciones.
4. Adaptar solamente identidad Maderarte, textos, campos/reglas de negocio, permisos, rutas y backend propio.
5. No copiar datos, URLs privadas, credenciales, PDFs, cachés, Hommy ni identidad HomeEasy.
6. Conservar la arquitectura segura ya aprobada de Maderarte: Cloudflare Worker, `/api/maderarte`, Firebase, sesión propia, Apps Script modular, Sheet y Drive independientes.
7. No crear un shell genérico si la pantalla HomeEasy fuente no funciona así.
8. No sustituir un flujo rico por una tabla CRUD genérica. En particular, Clientes debe conservar el patrón búsqueda → expediente → órdenes/cotizaciones/abonos.
9. Las desviaciones solo se permiten si el propietario las pidió explícitamente o una diferencia real de negocio/schema las exige; deben documentarse en `docs/HOMEEASY_PARITY_MAP.md`.
10. Antes de merge, comparar módulo Maderarte contra su fuente HomeEasy en desktop y móvil.

## Flujo obligatorio GitHub-first

GitHub es la fuente visible y operativa del desarrollo. El entorno local o temporal puede utilizarse para editar, ejecutar pruebas y levantar previews, pero nunca debe convertirse en un estado de trabajo oculto o en una fuente paralela de verdad.

Reglas obligatorias para cualquier tarea de código o diseño:

1. Antes de la primera modificación, actualizar desde `origin/main` y confirmar el commit base real.
2. Crear y publicar una rama de trabajo inmediatamente.
3. Después del primer avance coherente, hacer commit/push y abrir el Pull Request hacia `main` temprano.
4. Continuar trabajando sobre esa misma rama remota y hacer push después de cada checkpoint visual/funcional.
5. Antes de pedir revisión o afirmar que algo quedó listo, el estado correspondiente debe existir en GitHub e indicar rama, commit y PR.
6. Si Cloudflare genera Preview URL, usarla para revisión visual antes del merge.
7. `main` debe permanecer estable. No fusionar una etapa visual mientras siga en revisión del propietario.
8. Si existen cambios locales aún no publicados, el siguiente paso obligatorio es commit + push antes de continuar.

No usar ZIPs, copias locales antiguas ni ramas locales sin publicar como fuente del estado actual del proyecto.

## Despliegue Cloudflare

- La aplicación se despliega con Cloudflare Workers y Static Assets, no con Pages.
- `worker/index.js` es la entrada del Worker.
- `public/` contiene los archivos estáticos.
- `functions/api/maderarte.js` conserva la lógica de la API y es importado por el Worker.
- `wrangler.toml` debe mantener `main`, `[assets]`, el binding `ASSETS` y las rutas `/api/maderarte` en `run_worker_first`.
- No reintroducir `pages_build_output_dir`.

## Frontend

- HTML multipágina dentro de `public/`, igual que el patrón operativo de HomeEasy, pero con assets y backend propios.
- CSS compartido en `public/css/` cuando pueda modularizarse sin cambiar la experiencia fuente.
- Núcleo JavaScript en `public/js/core/`.
- Código específico por pantalla en `public/js/pages/`.
- Una sola capa API, de autenticación y de sesión.
- Interfaz en español, tema claro principal, textos legibles y sin scroll horizontal.
- Tipografía del sistema tipo Apple; en Windows usar `Segoe UI Variable` / `Segoe UI` como sustituto natural.
- Evitar pesos tipográficos pesados y no reducir letra para hacer caber más información.
- Cuando una opción abre subcategorías, conservar el patrón HomeEasy de bottom sheet desde abajo, overlay/blur, safe area y cierre táctil.
- El footer usa versión real de la app + año.
- En el Inicio, mantener las decisiones Maderarte ya aprobadas únicamente donde fueron pedidas explícitamente; la estructura de interacción sigue naciendo de HomeEasy.

## Estado de escritura

La fundación v0.2.0 sigue en modo lectura. No habilitar creación o edición comercial hasta que autenticación, permisos, consecutivos, Drive, idempotencia y auditoría tengan pruebas específicas. Que HomeEasy ya tenga un botón de escritura no autoriza a habilitarlo todavía en Maderarte.

## Validación

Antes de cada entrega:

```bash
npm ci
npm test
```

No declarar estable una fase si el chequeo falla, hay errores de consola o no fue revisada en móvil.