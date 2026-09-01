var REQUIRED_HEADERS = Object.freeze({
  Clientes: ['Cedula_NIT', 'Tipo_Documento', 'Nombre_Completo', 'Telefono', 'Telefono_Alterno', 'Email', 'Direccion', 'Ciudad', 'Sede_Origen', 'Notas', 'URL_Carpeta_Cliente', 'Fecha_Registro', 'Ultima_Compra', 'Estado'],
  Usuarios: ['UID_Firebase', 'Email', 'Nombre_Completo', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Estado', 'Fecha_Invitacion', 'Fecha_Activacion', 'Ultimo_Acceso', 'Ultimo_Dispositivo', 'Creado_Por', 'Fecha_Registro'],
  Roles: ['Rol', 'Descripcion', 'Permisos_JSON', 'Activo', 'Protegido', 'Actualizado_Por', 'Actualizado_En'],
  Configuracion: ['Clave', 'Valor', 'Tipo', 'Categoria', 'Descripcion', 'Privada', 'Actualizada_Por', 'Actualizada_En'],
  Sedes: ['Sede_ID', 'Nombre', 'Prefijo_OP', 'Prefijo_Cotizacion', 'Prefijo_Recibo', 'Prefijo_Remision', 'Direccion', 'Telefono', 'Estado', 'Siguiente_OP', 'Siguiente_Cotizacion', 'Siguiente_Recibo', 'Siguiente_Remision', 'Actualizado_En'],
  Invitaciones: ['Invitacion_ID', 'Token_Hash', 'Email', 'Nombre_Completo', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Estado', 'Expira_En', 'Creada_Por', 'Creada_En', 'Usada_Por_UID', 'Usada_En', 'Revocada_Por', 'Revocada_En', 'Motivo_Revocacion'],
  Sesiones: ['Sesion_ID', 'Token_Hash', 'UID_Firebase', 'Email', 'Nombre_Usuario', 'Rol', 'Sede_Principal', 'Sedes_Permitidas', 'Dispositivo_ID', 'Dispositivo', 'Plataforma', 'Navegador', 'IP_Hash', 'Creada_En', 'Ultima_Actividad', 'Expira_En', 'Estado', 'Cerrada_En', 'Motivo_Cierre', 'Version_App'],
  Cotizaciones: ['Numero_Cotizacion', 'Fecha', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Telefono', 'Direccion', 'Descripcion_Items', 'Observaciones', 'Subtotal', 'Descuento', 'Total_Cotizado', 'Vigencia_Dias', 'Tiempo_Entrega', 'Condiciones_Pago', 'Estado', 'Convertida_OP', 'URL_PDF_Cotizacion', 'URL_Carpeta_Cliente', 'URL_Carpeta_Mes', 'Items_JSON', 'Firma_Usuario', 'Creado_Por', 'Fecha_Registro', 'Actualizado_Por', 'Actualizado_En'],
  Ordenes_Pedido: ['Fecha', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Telefono', 'Direccion_Entrega', 'Descripcion_Detallada', 'Observaciones', 'Valor_Total', 'Abonado_Total', 'Saldo_Pendiente', 'Modalidad_Venta', 'Estado', 'Estado_Produccion', 'Fecha_Entrega_Estimada', 'Responsable', 'Cotizacion_Origen', 'URL_PDF_OP', 'URL_Carpeta_Cliente', 'URL_Carpeta_OP', 'Ultimo_Abono', 'Fecha_Ultimo_Abono', 'Comentarios_Abonos', 'Items_JSON', 'Creado_Por', 'Fecha_Registro', 'Actualizado_Por', 'Actualizado_En', 'Anulacion_ID', 'Request_ID'],
  Orden_Items: ['Item_ID', 'Numero_OP', 'Posicion', 'Descripcion', 'Categoria', 'Referencia', 'Cantidad', 'Unidad', 'Valor_Unitario', 'Subtotal', 'Color_Tela', 'Color_Madera', 'Medidas', 'Especificaciones', 'Cantidad_Entregada', 'Cantidad_Pendiente', 'Estado_Item', 'URL_Foto', 'Fecha_Registro', 'Actualizado_En'],
  Produccion: ['Produccion_ID', 'Numero_OP', 'Item_ID', 'Sede', 'Estado_Produccion', 'Fecha_Paso_Fabrica', 'Fecha_Inicio', 'Fecha_Lista', 'Fecha_Completada', 'Responsable', 'Taller_Proveedor', 'Observaciones', 'Actualizado_Por', 'Actualizado_En'],
  Abonos: ['Numero_Recibo', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Fecha_Pago', 'Valor_Abono', 'Medio_Pago', 'Referencia', 'Comentario', 'Saldo_Anterior', 'Saldo_Nuevo', 'URL_PDF_Recibo', 'URL_Soporte_Pago', 'URL_Carpeta_Cliente', 'Registrado_Por', 'Fecha_Registro', 'Estado_Registro', 'Afecta_Saldo', 'Anulacion_ID', 'Request_ID'],
  Remisiones: ['Numero_Remision', 'Numero_OP', 'Sede', 'Cedula_NIT', 'Nombre_Cliente', 'Fecha_Remision', 'Persona_Recibe', 'Observaciones', 'Estado', 'URL_PDF_Remision', 'URL_Carpeta_Cliente', 'Responsable', 'Fecha_Registro', 'Anulacion_ID', 'Request_ID'],
  Remision_Items: ['Remision_Item_ID', 'Numero_Remision', 'Numero_OP', 'Item_ID', 'Descripcion', 'Cantidad_Entregada', 'Unidad', 'Observaciones', 'Fecha_Registro'],
  Agenda: ['ID', 'Fecha', 'Hora', 'Categoria', 'Titulo', 'Cliente', 'Numero_OP', 'Sede', 'Referencia_Notas', 'Estado', 'Responsable', 'Fecha_Registro'],
  Documentos: ['ID_Documento', 'Tipo_Documento', 'Numero_Relacionado', 'Cedula_NIT', 'Nombre_Cliente', 'Nombre_Archivo', 'URL', 'File_ID', 'Mime_Type', 'Version', 'Activo', 'Fecha_Emision', 'Fecha_Registro', 'Operador', 'Hash_SHA256', 'Request_ID'],
  Auditoria: ['ID', 'Fecha', 'Usuario', 'Rol', 'Dispositivo_ID', 'Dispositivo', 'Plataforma', 'Navegador', 'Pagina', 'Modulo', 'Accion', 'Entidad', 'Entidad_ID', 'Resumen', 'Estado', 'Request_ID', 'Antes_JSON', 'Despues_JSON', 'Cambios_JSON', 'Error', 'Reversible', 'Motivo_No_Reversible', 'Revertida', 'Revertida_Por', 'Revertida_En', 'Operacion_Relacionada_ID'],
  Anulaciones: ['Anulacion_ID', 'Fecha', 'Tipo_Entidad', 'Entidad_ID', 'Motivo', 'Solicitada_Por', 'Aprobada_Por', 'Estado', 'Antes_JSON', 'Consecuencias_JSON', 'Reversible', 'Revertida', 'Revertida_Por', 'Revertida_En', 'Request_ID'],
  Versiones_Documentos: ['Version_ID', 'Tipo_Documento', 'Numero_Relacionado', 'Version', 'Activo', 'URL', 'File_ID', 'Nombre_Archivo', 'Fecha_Generacion', 'Generado_Por', 'Hash_SHA256', 'Documento_Anterior_ID', 'Motivo_Nueva_Version', 'Request_ID'],
  Lotes_Numeracion: ['Lote_ID', 'Sede', 'Tipo_Documento', 'Numero_Inicial', 'Numero_Final', 'Siguiente_Numero', 'Estado', 'Fecha_Inicio', 'Fecha_Cierre', 'Creado_Por', 'Fecha_Registro'],
  Registro_Numeros: ['Registro_ID', 'Sede', 'Tipo_Documento', 'Numero', 'Estado', 'Entidad_ID', 'Reservado_En', 'Confirmado_En', 'Usuario', 'Request_ID'],
  Idempotencia: ['Request_ID', 'Fecha', 'Tipo_Operacion', 'Entidad', 'Entidad_ID', 'Estado', 'Resultado_JSON', 'Expira_En', 'Usuario', 'Dispositivo_ID'],
  Catalogos: ['Catalogo', 'Valor', 'Orden', 'Activo', 'Descripcion']
});

var COMMERCIAL_ZERO_SHEETS_ = Object.freeze(['Clientes', 'Cotizaciones', 'Ordenes_Pedido', 'Orden_Items', 'Produccion', 'Abonos', 'Remisiones', 'Remision_Items', 'Agenda', 'Documentos']);
var INITIAL_ROLES_ = Object.freeze(['PROPIETARIO', 'ADMINISTRADOR', 'VENDEDOR', 'BODEGA_LOGISTICA', 'CONSULTA']);
var INITIAL_BRANCHES_ = Object.freeze({ MP: 'Maderarte Principal', TP: 'Maderarte Terraplaza' });

function verifySchema_() {
  Object.keys(REQUIRED_HEADERS).forEach(function(sheetName) {
    var sheet = getSheet_(sheetName);
    var actual = getHeaders_(sheet);
    var expected = REQUIRED_HEADERS[sheetName];
    var exact = actual.length === expected.length && actual.every(function(header, index) { return header === expected[index]; });
    if (!exact) {
      throw appError_('SHEET_SCHEMA_MISMATCH', 'La pestaña ' + sheetName + ' no coincide exactamente con el contrato.', 503, {
        missing: expected.filter(function(header) { return actual.indexOf(header) === -1; }),
        unexpected: actual.filter(function(header) { return expected.indexOf(header) === -1; }),
        orderMismatch: actual.length === expected.length
      });
    }
  });
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

function verifyInitialRoles_() {
  INITIAL_ROLES_.forEach(function(role) {
    var row = findRow_('Roles', 'Rol', role);
    if (!row || normalizeCode_(row.Activo) !== 'SI') throw appError_('ROLE_CONFIGURATION_INVALID', 'Falta el rol activo ' + role + '.', 503);
    var permissions = parseJson_(row.Permisos_JSON, null);
    if (!Array.isArray(permissions) || !permissions.length) throw appError_('ROLE_CONFIGURATION_INVALID', 'El rol ' + role + ' no tiene permisos válidos.', 503);
    if (role === 'PROPIETARIO' && (permissions.indexOf('*') === -1 || normalizeCode_(row.Protegido) !== 'SI')) {
      throw appError_('ROLE_CONFIGURATION_INVALID', 'El rol PROPIETARIO debe conservar permiso total y protección.', 503);
    }
  });
}

function verifyInitialBranches_() {
  Object.keys(INITIAL_BRANCHES_).forEach(function(branchId) {
    var row = findRow_('Sedes', 'Sede_ID', branchId);
    if (!row || String(row.Nombre || '').trim() !== INITIAL_BRANCHES_[branchId] || normalizeCode_(row.Estado) !== 'ACTIVA') {
      throw appError_('BRANCH_CONFIGURATION_INVALID', 'La sede ' + branchId + ' no coincide con la configuración inicial.', 503);
    }
  });
}

function verifyOwner_() {
  var owners = listRows_('Usuarios').filter(function(row) {
    return normalizeCode_(row.Rol) === 'PROPIETARIO' && normalizeCode_(row.Estado) === 'ACTIVO';
  });
  var linked = owners.filter(function(row) { return String(row.UID_Firebase || '').trim() && normalizeEmail_(row.Email); });
  if (!linked.length) throw appError_('OWNER_NOT_READY', 'No existe un propietario activo con identidad vinculada.', 503);
  return linked.length;
}

function verifyCommercialBaseZero_() {
  var counts = {};
  COMMERCIAL_ZERO_SHEETS_.forEach(function(sheetName) { counts[sheetName] = countRows_(sheetName); });
  var populated = Object.keys(counts).filter(function(sheetName) { return counts[sheetName] !== 0; });
  if (populated.length) throw appError_('COMMERCIAL_BASE_NOT_ZERO', 'La base comercial contiene registros y no puede aprobarse como base cero.', 409, { sheets: populated });
  return counts;
}

function verificarBaseCero() {
  var spreadsheet = getSpreadsheet_();
  if (String(spreadsheet.getName() || '').trim() !== MADERARTE_APP.SPREADSHEET_NAME) {
    throw appError_('SPREADSHEET_NAME_MISMATCH', 'La propiedad SPREADSHEET_ID no apunta a la base oficial de Maderarte.', 503);
  }
  verifySchema_();
  if (MADERARTE_APP.COMMERCIAL_WRITES !== false) throw appError_('COMMERCIAL_WRITES_ENABLED', 'Las escrituras comerciales deben permanecer deshabilitadas.', 503);
  if (normalizeCode_(getConfigValue_('MODO_OPERACION', '')) !== 'PREPARACION') {
    throw appError_('OPERATION_MODE_INVALID', 'MODO_OPERACION debe permanecer en PREPARACION.', 503);
  }
  verifyInitialRoles_();
  verifyInitialBranches_();
  var ownerCount = verifyOwner_();
  var documentsRoot = getDocumentsRoot_();
  if (String(documentsRoot.getName() || '').trim() !== '02_DOCUMENTOS_CLIENTES') {
    throw appError_('DRIVE_ROOT_MISMATCH', 'DRIVE_DOCUMENTS_ROOT_ID no apunta a 02_DOCUMENTOS_CLIENTES.', 503);
  }
  var counts = verifyCommercialBaseZero_();
  var result = {
    ok: true,
    version: MADERARTE_APP.VERSION,
    spreadsheet: MADERARTE_APP.SPREADSHEET_NAME,
    sheetsVerified: Object.keys(REQUIRED_HEADERS).length,
    ownerCount: ownerCount,
    branches: Object.keys(INITIAL_BRANCHES_),
    commercialWrites: false,
    mode: 'PREPARACION',
    commercialCounts: counts,
    documentsRoot: '02_DOCUMENTOS_CLIENTES'
  };
  Logger.log(JSON.stringify(result));
  return result;
}
