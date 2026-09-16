# Acceso del equipo

Configuración → Equipo → persona permite revisar casillas y desactivar o reactivar la cuenta. La confirmación describe el efecto antes de guardar. No cambia los registros comerciales, las sedes ni la lista individual de permisos.

El estado y la revocación de todas las sesiones activas e invitaciones pendientes de esa persona se guardan junto a la auditoría en una operación atómica. Reactivar exige un nuevo ingreso; no revive tokens anteriores. Una invitación no puede reemplazar ni reactivar una persona existente. Propietario, propia cuenta, cuentas superiores y sedes externas quedan protegidos. Una revisión obsoleta se rechaza; una respuesta perdida puede comprobarse reabriendo la ficha sin duplicar el cambio.

Las páginas conservan la apertura desde caché. Mientras están visibles, revalidan cada minuto; al regresar a la pestaña comprueban si corresponde, y una página restaurada por el navegador fuerza la comprobación. Solo hay una petición simultánea por página. Un rechazo de autorización de la API también solicita comprobar la sesión. El servidor sigue aplicando permisos en cada solicitud, incluso antes de que la interfaz detecte el cambio.

Cuando cambian permisos, rol o sedes, un diálogo bloquea las acciones antiguas y pide actualizar explícitamente. No hay recarga silenciosa de formularios. Si la cuenta pierde acceso, se ofrece volver al ingreso. Un fallo transitorio de red no se confunde con desactivación. Sin conexión no es posible garantizar que el navegador conozca una revocación; ninguna escritura se autoriza desde caché.

En primer ingreso se distingue «Ya tengo cuenta» de «Crear mi cuenta», con contraseña actual o nueva y confirmación según la elección. Se muestra la sede asignada. No se cambia una contraseña existente y no hay registro público.

Referencia: Configuración vigente de Homeeasy, commit 0555553, composición por secciones, ficha/modal y confirmación explícita. Se conserva el diseño de Equipo Maddy con sus colores, tamaños accesibles y sheet móvil. El propietario autorizó permisos individuales y este circuito de acceso.

Validación: pruebas backend de estado/sesiones/ámbito/reintentos, pruebas del observador de acceso y aceptación visual 320/390/1440 en GitHub. Transporte sintético para desactivar/reactivar e identidades; no se crean ni suspenden cuentas reales. La revisión en el dominio no equivale a haber activado un nuevo trabajador real.
