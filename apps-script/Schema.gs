var REQUIRED_HEADERS = Object.freeze({
  Usuarios: ['UID_Firebase', 'Email', 'Nombre_Completo', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Estado', 'Fecha_Invitacion', 'Fecha_Activacion', 'Ultimo_Acceso', 'Ultimo_Dispositivo', 'Creado_Por', 'Fecha_Registro'],
  Invitaciones: ['Invitacion_ID', 'Token_Hash', 'Email', 'Nombre_Completo', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Estado', 'Expira_En', 'Creada_Por', 'Creada_En', 'Usada_Por_UID', 'Usada_En', 'Revocada_Por', 'Revocada_En', 'Motivo_Revocacion'],
  Sesiones: ['Sesion_ID', 'Token_Hash', 'UID_Firebase', 'Email', 'Nombre_Usuario', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Dispositivo_ID', 'Dispositivo', 'Plataforma', 'Navegador', 'IP_Hash', 'Creada_En', 'Ultima_Actividad', 'Expira_En', 'Estado', 'Cerrada_En', 'Motivo_Cierre', 'Version_App'],
  Roles: ['Rol', 'Descripcion', 'Permisos_JSON', 'Activo', 'Protegido'],
  Configuracion: ['Clave', 'Valor', 'Tipo'],
  Sedes: ['Sede_ID', 'Nombre', 'Prefijo_OP', 'Prefijo_Cotizacion', 'Prefijo_Recibo', 'Prefijo_Remision', 'Estado'],
  Ordenes_Pedido: ['Fecha', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Valor_Total', 'Abonado_Total', 'Saldo_Pendiente', 'Estado', 'Estado_Produccion', 'URL_PDF_OP', 'URL_Carpeta_Cliente', 'URL_Carpeta_OP'],
  Orden_Items: ['Item_ID', 'Numero_OP', 'Descripcion', 'Cantidad', 'Unidad', 'Valor_Unitario', 'Subtotal'],
  Abonos: ['Numero_Recibo', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Fecha_Pago', 'Valor_Abono', 'Medio_Pago', 'Comentario', 'Saldo_Anterior', 'Saldo_Nuevo', 'URL_PDF_Recibo', 'URL_Soporte_Pago', 'Estado_Registro'],
  Remisiones: ['Numero_Remision', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Fecha_Remision', 'Persona_Recibe', 'Estado', 'URL_PDF_Remision'],
  Documentos: ['ID_Documento', 'Tipo_Documento', 'Numero_Relacionado', 'Nombre_Archivo', 'URL', 'Activo']
});

function verifySchema_() {
  Object.keys(REQUIRED_HEADERS).forEach(function(sheetName) { assertHeaders_(sheetName, REQUIRED_HEADERS[sheetName]); });
  return true;
}

function getRolePermissions_(role) {
  var row = findRow_('Roles', 'Rol', normalizeCode_(role));
  if (!row || normalizeCode_(row.Activo) !== 'SI') return [];
  var parsed = parseJson_(row.Permisos_JSON, []);
  return Array.isArray(parsed) ? parsed.map(function(item) { return String(item || '').trim(); }).filter(Boolean) : [];
}

function hasPermission_(permissions, permission) {
  if (!permission) return true;
  if (permissions.indexOf('*') !== -1 || permissions.indexOf(permission) !== -1) return true;
  var scope = String(permission).split('.')[0];
  return permissions.indexOf(scope + '.*') !== -1;
}

function requirePermission_(session, permission) {
  if (!hasPermission_(session.permissions || [], permission)) throw appError_('PERMISSION_DENIED', 'Tu cuenta no tiene permiso para esta acción.', 403);
}

function publicProfile_(user) {
  return {
    uid: String(user.UID_Firebase || ''),
    email: normalizeEmail_(user.Email),
    name: String(user.Nombre_Completo || ''),
    role: normalizeCode_(user.Rol),
    status: normalizeCode_(user.Estado),
    mainBranch: normalizeCode_(user.Sede_Principal),
    branches: String(user.Sedes_Permitidas || '').split(',').map(function(item) { return normalizeCode_(item); }).filter(Boolean)
  };
}

function getConfigValue_(key, fallback) {
  var row = findRow_('Configuracion', 'Clave', key);
  return row && String(row.Valor || '').trim() ? String(row.Valor).trim() : fallback;
}

function verificarBaseCero() {
  verifySchema_();
  Logger.log('Base de Datos Maderarte App verificada para v' + MADERARTE_APP.VERSION + '.');
  return true;
}
