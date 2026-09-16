# Actividad en Configuración

Referencia: Homeeasy/main/configuracion.html, blob b318d7731735e6a5a26820f87cf1561af2f72393. Se portan navegación por sección, filtros, lista de actividad y detalle anterior/posterior. Marca, permisos y datos pertenecen a Maddy.

Consulta de solo lectura con permiso explícito auditoria.read (depende de config.read). La casilla dice «Consultar cambios de todas las sedes»; no se concede automáticamente a administradores ni vendedores. El propietario conserva su acceso completo.

ACTIVIDAD_LISTAR pagina de 25 en 25 y filtra fecha Colombia, usuario, módulo, estado y búsqueda. ACTIVIDAD_OBTENER proyecta campos comerciales permitidos; nunca devuelve JSON bruto, tokens, URLs privadas ni identificadores de dispositivos. Los registros antiguos conservan ausencias de antes/después y dispositivo. Los nuevos registros atómicos incluyen dispositivo/navegador de la sesión que realizó la operación; no se infiere el origen de eventos antiguos por el último dispositivo de la persona.

La lista contiene operaciones que ya registran auditoría. No representa todas las consultas ni todos los intentos fallidos. No permite borrar, revertir o editar eventos. Inventario documental y restauraciones son incrementos independientes.
