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

## Flujo obligatorio GitHub-first

GitHub es la fuente visible y operativa del desarrollo. El entorno local o temporal de Codex puede utilizarse para editar, ejecutar pruebas y levantar previews, pero nunca debe convertirse en un estado de trabajo oculto o en una fuente paralela de verdad.

Reglas obligatorias para cualquier tarea de código o diseño:

1. Antes de la primera modificación, actualizar desde `origin/main` y confirmar el commit base real.
2. Crear una rama de trabajo con nombre descriptivo, por ejemplo `codex/etapa-4-1-sistema-visual-index`.
3. Publicar esa rama en GitHub inmediatamente. No empezar una tarea relevante sobre una rama que solo exista localmente.
4. Después del primer avance coherente, hacer commit y push y abrir el Pull Request hacia `main` temprano. El PR es el espacio vivo de revisión; no debe aparecer únicamente al final.
5. Continuar trabajando sobre esa misma rama remota y hacer push después de cada avance coherente o checkpoint visual/funcional. No acumular cambios útiles únicamente en local mientras se reporta progreso.
6. Antes de pedir revisión, mostrar una pantalla, afirmar que algo quedó listo o entregar una etapa, el estado correspondiente debe existir en GitHub y se deben informar como mínimo: rama, commit SHA y número del PR.
7. Si Cloudflare genera Preview URL para la rama o el PR, usar esa URL para la revisión visual antes del merge.
8. `main` debe permanecer estable. Los cambios visuales, funcionales o de arquitectura se revisan desde la rama remota/PR antes de fusionarse, salvo una corrección documental trivial autorizada explícitamente.
9. No hacer merge de una etapa visual si todavía está en revisión del propietario. Mantener el PR abierto y seguir subiendo las correcciones a la misma rama.
10. Si por cualquier motivo existen cambios locales aún no publicados, el siguiente paso obligatorio es commit + push antes de continuar con más desarrollo.

Objetivo de este flujo:

```text
origin/main
   ↓
rama remota en GitHub
   ↓
primer commit visible
   ↓
PR abierto temprano
   ↓
commits + push continuos
   ↓
Preview Cloudflare / revisión
   ↓
pruebas
   ↓
aprobación
   ↓
merge a main
```

No usar ZIPs, copias locales antiguas ni ramas locales sin publicar como fuente del estado actual del proyecto.

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

### Referencia permanente de experiencia: HomeEasy

Maderarte es una marca y aplicación independiente, pero su estándar de interacción debe aprender de la versión vigente de HomeEasy que el propietario ya aprobó. Antes de inventar un patrón nuevo, revisar cómo resuelve HomeEasy una interacción equivalente y conservar lo que funcione mejor en claridad, tactilidad y jerarquía.

Reglas visuales derivadas de esa referencia:

- Usar tipografía del sistema tipo Apple: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`; en Windows usar `Segoe UI Variable` / `Segoe UI` como sustituto natural. No distribuir archivos de SF Pro.
- Evitar pesos tipográficos pesados. La interfaz normalmente debe moverse entre 400, 500 y 600; reservar pesos superiores solo para casos excepcionales.
- No reducir el tamaño de letra para hacer caber más información. La lectura y el aire visual tienen prioridad.
- Las acciones principales deben tener respuesta táctil/visual discreta al presionar.
- Cuando una opción abre subcategorías o acciones secundarias, usar el patrón de HomeEasy: fondo oscurecido y desenfocado + ventana/bottom sheet que emerge desde la parte inferior. La entrada debe animarse desde `translateY(100%)` a `translateY(0)` con una curva elástica suave cercana a `0.4s cubic-bezier(.175,.885,.32,1.1)`.
- En móvil el bottom sheet ocupa el ancho completo, respeta `safe-area-inset-bottom` y puede cerrarse tocando fuera o mediante un control accesible.
- El footer debe seguir el patrón operativo de HomeEasy: marca/sello, nombre del sistema y **versión real de la app + año**. Nunca inventar un número de versión visual diferente al código.
- Copiar patrones de interacción y lógica, nunca colores, textos, marca, logos, mascota o identidad comercial de HomeEasy.

## Estado de escritura

La fundación v0.2.0 es de lectura. No habilitar creación o edición comercial hasta que autenticación, permisos, consecutivos, Drive, idempotencia y auditoría tengan pruebas específicas.

## Validación

Antes de cada entrega:

```bash
npm ci
npm test
```

No declarar estable una fase si el chequeo falla, hay errores de consola o no fue revisada en móvil.
