# Permisos individuales

Configuración → Equipo → persona → Editar permisos. Las casillas se agrupan por módulo y las acciones delicadas se distinguen. Antes de guardar se revisan los permisos añadidos y retirados. Las invitaciones nuevas también guardan una lista explícita; cambiar de sede no reinicia sus casillas.

El rol es una plantilla inicial. Las personas existentes mantienen sus permisos efectivos hasta que se guarde su lista. La cuenta propietaria está protegida. Un gestor no puede cambiar su propio acceso, conceder permisos superiores a los suyos, modificar personas más privilegiadas ni actuar fuera de sus sedes.

Las listas versionadas viven como claves privadas `USER_ACCESS_V1_<hash de correo>` en Configuracion; no se amplía el esquema. Ausencia de lista conserva el rol existente; lista vacía impide acceder; JSON inválido bloquea el acceso y exige revisión. Una lista explícita no hereda nuevos permisos del rol.

Cada solicitud revalida la lista desde la base. El guardado usa ScriptLock, revisión del estado previo y una operación atómica de lista + auditoría. Repetir exactamente un guardado confirmado no duplica la auditoría. No se cambia el rol, sede, identidad o información comercial.

Las invitaciones fijan su lista en la misma operación atómica que crea el enlace. La activación vuelve a revisar el alcance actual del emisor y transfiere esa lista a la persona antes de activar su acceso. No se crean cuentas reales durante QA.

Recaudos separa consultar ingresos de confirmar efectivo. Los ajustes separan desistimiento, retorno de producto, traslado y devolución de dinero. Las cuentas antiguas conservan esos accesos derivados de su configuración previa; una lista individual requiere cada autorización explícita.

Referencia visual: Homeeasy/configuracion.html vigente, navegación por secciones, filas de opciones y diálogo de detalle. Se conserva la composición de Configuración Maddy y se incorporan casillas accesibles y revisión previa, sin copiar marca ni datos de HomeEasy.
