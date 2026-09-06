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
- La versión vigente de HomeEasy en `alejoherrera05-del/Homeeasy` es el molde funcional, de experiencia y de navegación para cualquier flujo que ya exista allí. No se trata como inspiración abstracta.
- Antes de diseñar o implementar un módulo de Maderarte que tenga equivalente en HomeEasy, se debe inspeccionar primero la pantalla vigente de HomeEasy y portar su composición, jerarquía, estados, interacción, microinteracciones, navegación y comportamiento responsive. Solo se adaptan marca Maderarte, campos/reglas comerciales y backend independiente.
- No inventar un shell, tabla, formulario, modal o flujo alternativo cuando HomeEasy ya resolvió el mismo caso, salvo que el propietario apruebe explícitamente la diferencia.
- HomeEasy nunca es fuente de clientes, órdenes, abonos, documentos, secretos, URLs privadas, credenciales, logos, mascota ni identidad comercial para Maderarte.
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

GitHub es la fuente visible y operativa del desarrollo. El entorno local o temporal puede utilizarse para editar, ejecutar pruebas y levantar previews, pero nunca debe convertirse en un estado de trabajo oculto o en una fuente paralela de verdad.

Reglas obligatorias para cualquier tarea de código o diseño:

1. Antes de la primera modificación, actualizar desde `origin/main` y confirmar el commit base real.
2. Crear una rama de trabajo con nombre descriptivo.
3. Publicar esa rama en GitHub inmediatamente. No empezar una tarea relevante sobre una rama que solo exista localmente.
4. Después del primer avance coherente, hacer commit y push y abrir el Pull Request hacia `main` temprano. El PR es el espacio vivo de revisión; no debe aparecer únicamente al final.
5. Continuar trabajando sobre esa misma rama remota y hacer push después de cada avance coherente o checkpoint visual/funcional. No acumular cambios útiles únicamente en local mientras se reporta progreso.
6. Antes de pedir revisión, mostrar una pantalla, afirmar que algo quedó listo o entregar una etapa, el estado correspondiente debe existir en GitHub y se deben informar como mínimo: rama, commit SHA y número del PR.
7. Por indicación explícita del propietario del 5 de septiembre de 2026, la revisión de los cambios solicitados se realiza directamente en `https://app.maderartepopayan.com`, también desde su celular. No exigir una revisión adicional en una URL de preview.
8. Conservar rama remota, PR y pruebas antes de publicar. Después de comprobar los cambios solicitados, fusionar el PR hacia `main` para que Cloudflare actualice el dominio habitual; verificar el despliegue antes de informar que ya está disponible.
9. La instrucción del propietario autoriza publicar las correcciones solicitadas de esta etapa de preparación antes de su revisión visual, sin pedir otra confirmación para cada merge. La revisión visual se hace después en el dominio habitual. Publicar no equivale a declarar terminada o estable la fase; los límites de escritura comercial y las verificaciones siguen vigentes.
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
pruebas
   ↓
merge a main / publicación Cloudflare
   ↓
revisión del propietario en app.maderartepopayan.com
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
- La navegación entre módulos protegidos debe ser cache-first como en la app de referencia: si existe una sesión local vigente, el módulo se abre inmediatamente y la revalidación se hace silenciosamente en segundo plano. No bloquear cada cambio de página con una validación remota.
- Si no existe una sesión cacheada y la validación tarda más de ~220 ms, usar una cubierta de apertura centrada, sobria y de marca. Nunca dejar textos técnicos de “Validando sesión” escritos estáticamente dentro de los HTML protegidos.
- Una pantalla con experiencia propia en la referencia puede ser standalone. No forzarla dentro de un sidebar o shell universal solo por uniformidad técnica.

### Referencia permanente de experiencia

Maderarte es una marca y aplicación independiente, pero la app operativa ya aprobada sirve como camino probado para estructura y comportamiento. Antes de inventar un patrón nuevo, revisar cómo resuelve la app de referencia una interacción equivalente y portarla cuando corresponda.

Reglas visuales derivadas de esa referencia:

- Usar tipografía del sistema tipo Apple: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`; en Windows usar `Segoe UI Variable` / `Segoe UI` como sustituto natural. No distribuir archivos de SF Pro.
- Evitar pesos tipográficos pesados. La interfaz normalmente debe moverse entre 400, 500 y 600/650; reservar pesos superiores solo para casos excepcionales.
- No reducir el tamaño de letra para hacer caber más información. La lectura y el aire visual tienen prioridad.
- Las acciones principales deben tener respuesta táctil/visual discreta al presionar.
- Cuando una opción abre subcategorías o acciones secundarias, usar fondo oscurecido/desenfocado + ventana/bottom sheet que emerge desde la parte inferior. La entrada debe animarse desde `translateY(100%)` a `translateY(0)` con una curva elástica suave cercana a `0.4s cubic-bezier(.175,.885,.32,1.1)`.
- En móvil el bottom sheet ocupa el ancho completo, respeta `safe-area-inset-bottom` y puede cerrarse tocando fuera o mediante un control accesible.
- El footer debe mostrar marca/sello, nombre del sistema y **versión real de la app + año** cuando corresponda. Nunca inventar un número de versión visual diferente al código.
- En el Inicio de Maderarte evitar un header de marca grande o pesado. La identidad debe integrarse de forma editorial y sutil dentro del hero/banner.
- Las acciones superiores del Inicio deben sentirse ligeras: controles circulares independientes para notificaciones y perfil, con profundidad mínima y sin convertirlos en una barra pesada.
- Evitar dobles cajas, bordes repetidos y sombras fuertes. Los grupos del Inicio deben parecer listas limpias tipo Settings: título de sección fuera de la superficie y una sola tarjeta/lista interior.
- Copiar patrones de interacción y lógica, nunca colores, textos, marca, logos, mascota o identidad comercial de HomeEasy.
- En documentos para cliente (Cotización, Orden de pedido y Recibo de caja), usar como base la arquitectura documental probada de HomeEasy: franja superior de marca, datos corporativos integrados, número/fecha con jerarquía inmediata y cuerpo claro. Maderarte puede mejorar proporciones, tipografía, color y profundidad visual, pero no reinventar la estructura sin necesidad.
- Los degradés de documentos deben ser muy sutiles y funcionar como profundidad/luz, no como decoración protagonista ni como fondos pastel.
- El asesor **no aparece en el encabezado** de Cotización, Orden de pedido ni Recibo de caja. En esos tres documentos se firma al final con una firma tipográfica que muestra **únicamente el nombre del asesor**, sin cargo, etiqueta ni texto adicional.

## Operación comercial confirmada

La aclaración del propietario del 5 de septiembre de 2026 prevalece sobre checkpoints anteriores: pedidos mixtos con disponibilidad por mueble (disponible, solicitar a fábrica o por definir), acuerdo por mueble (entrega hoy, separado o entrega posterior), sin separado global; recogida, envío y fechas en observaciones; distribución opcional de abonos; abono de importe libre acordado, sin 30% obligatorio; varios medios de pago con notas internas excluidas del documento del cliente; segundo teléfono opcional. Consultar `docs/BUSINESS_RULES.md` antes de tocar estos flujos. No asociar automáticamente pagos con fabricación o entrega.

## Estado de escritura

La fundación v0.2.0 es de lectura. No habilitar creación o edición comercial hasta que autenticación, permisos, consecutivos, Drive, idempotencia y auditoría tengan pruebas específicas.

## Validación

Antes de cada entrega:

```bash
npm ci
npm test
```

No declarar estable una fase si el chequeo falla, hay errores de consola o no fue revisada en móvil.
