function lookupFirebaseUser_(idToken) {
  var token = String(idToken || '').trim();
  if (!token) throw appError_('FIREBASE_TOKEN_REQUIRED', 'Falta la credencial de Firebase.', 401);
  var apiKey = requiredProperty_('FIREBASE_WEB_API_KEY');
  var response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: token }),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = parseJson_(response.getContentText(), {});
  if (status < 200 || status >= 300 || !body.users || !body.users.length) {
    throw appError_('FIREBASE_REJECTED', 'Firebase no pudo validar esta identidad.', 401);
  }
  var user = body.users[0];
  return {
    uid: String(user.localId || ''),
    email: normalizeEmail_(user.email),
    emailVerified: user.emailVerified === true
  };
}

function authorizedUserByFirebase_(firebaseUser) {
  var user = findRow_('Usuarios', 'UID_Firebase', firebaseUser.uid);
  if (!user) throw appError_('USER_NOT_AUTHORIZED', 'La cuenta existe, pero no está autorizada en Maderarte.', 403);
  if (normalizeEmail_(user.Email) !== firebaseUser.email) throw appError_('IDENTITY_MISMATCH', 'La identidad no coincide con el usuario autorizado.', 403);
  if (normalizeCode_(user.Estado) !== 'ACTIVO') throw appError_('USER_INACTIVE', 'El acceso a Maderarte está suspendido o desactivado.', 403);
  return user;
}

function createSession_(user, payload, proxyMeta) {
  if(upPolicy_(upKey_(user.Email)))requirePermission_({permissions:getUserPermissions_(user)},'app.access');
  var persistent = payload && payload.persistent === true;
  var createdAt = now_();
  var expiresAt = new Date(createdAt.getTime() + (persistent ? MADERARTE_APP.PERSISTENT_SESSION_DAYS * 86400000 : MADERARTE_APP.SESSION_HOURS * 3600000));
  var token = randomToken_();
  var device = payload && payload.device && typeof payload.device === 'object' ? payload.device : {};
  var sessionId = 'SES-' + Utilities.getUuid().toUpperCase();
  appendObject_('Sesiones', {
    Sesion_ID: sessionId,
    Token_Hash: sha256_(token),
    UID_Firebase: user.UID_Firebase,
    Email: normalizeEmail_(user.Email),
    Nombre_Usuario: user.Nombre_Completo,
    Rol: normalizeCode_(user.Rol),
    Sede_Principal: normalizeCode_(user.Sede_Principal),
    Sedes_Permitidas: String(user.Sedes_Permitidas || ''),
    Dispositivo_ID: String(device.id || '').slice(0, 120),
    Dispositivo: String(device.name || '').slice(0, 160),
    Plataforma: String(device.platform || '').slice(0, 80),
    Navegador: String(device.browser || '').slice(0, 80),
    IP_Hash: String(proxyMeta && proxyMeta.ipHash || '').slice(0, 128),
    Creada_En: createdAt,
    Ultima_Actividad: createdAt,
    Expira_En: expiresAt,
    Estado: 'ACTIVA',
    Cerrada_En: '',
    Motivo_Cierre: '',
    Version_App: MADERARTE_APP.VERSION
  });
  updateObject_('Usuarios', user._row, {
    Ultimo_Acceso: createdAt,
    Ultimo_Dispositivo: String(device.name || '').slice(0, 160)
  });
  return {
    sessionToken: token,
    profile: publicProfile_(user),
    permissions: getUserPermissions_(user),
    expiresAt: expiresAt.toISOString(),
    persistent: persistent
  };
}

function login_(payload, proxyMeta) {
  verifySchema_();
  var firebaseUser = lookupFirebaseUser_(payload && payload.firebaseIdToken);
  var user = authorizedUserByFirebase_(firebaseUser);
  return createSession_(user, payload || {}, proxyMeta || {});
}

function closeSessionRow_(row, reason, status) {
  updateObject_('Sesiones', row._row, {
    Estado: status || 'CERRADA',
    Cerrada_En: now_(),
    Motivo_Cierre: String(reason || 'Cierre de sesión').slice(0, 240)
  });
}

function validateSessionToken_(token, touch) {
  var rawToken = String(token || '').trim();
  if (!rawToken) throw appError_('NO_SESSION', 'Debes iniciar sesión.', 401);
  var row = findRow_('Sesiones', 'Token_Hash', sha256_(rawToken));
  if (!row) throw appError_('NO_SESSION', 'La sesión no existe.', 401);
  if (normalizeCode_(row.Estado) !== 'ACTIVA') throw appError_('SESSION_REVOKED', 'La sesión ya no está activa.', 401);
  var expiresAt = row.Expira_En instanceof Date ? row.Expira_En : new Date(row.Expira_En);
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    closeSessionRow_(row, 'Sesión vencida', 'VENCIDA');
    throw appError_('SESSION_EXPIRED', 'La sesión venció. Inicia sesión nuevamente.', 401);
  }
  var user = findRow_('Usuarios', 'UID_Firebase', row.UID_Firebase);
  if (!user || normalizeCode_(user.Estado) !== 'ACTIVO') {
    closeSessionRow_(row, 'Usuario inactivo', 'REVOCADA');
    throw appError_('USER_INACTIVE', 'El usuario ya no tiene acceso a Maderarte.', 403);
  }
  var permissions = getUserPermissions_(user);
  if(upPolicy_(upKey_(user.Email)))requirePermission_({permissions:permissions},'app.access');
  if (touch !== false) {
    var lastActivity = row.Ultima_Actividad instanceof Date ? row.Ultima_Actividad.getTime() : new Date(row.Ultima_Actividad).getTime();
    if (!isFinite(lastActivity) || Date.now() - lastActivity > 300000) {
      updateObject_('Sesiones', row._row, { Ultima_Actividad: now_() });
      updateObject_('Usuarios', user._row, { Ultimo_Acceso: now_(), Ultimo_Dispositivo: row.Dispositivo || '' });
    }
  }
  return {
    sessionRow: row,
    user: user,
    profile: publicProfile_(user),
    permissions: permissions,
    expiresAt: expiresAt.toISOString(),
    persistent: false
  };
}

function validateSession_(sessionToken) {
  var session = validateSessionToken_(sessionToken, true);
  return {
    profile: session.profile,
    permissions: session.permissions,
    expiresAt: session.expiresAt,
    persistent: false
  };
}

function logout_(sessionToken) {
  var rawToken = String(sessionToken || '').trim();
  if (!rawToken) return { closed: true };
  var row = findRow_('Sesiones', 'Token_Hash', sha256_(rawToken));
  if (row && normalizeCode_(row.Estado) === 'ACTIVA') closeSessionRow_(row, 'Cierre solicitado por el usuario', 'CERRADA');
  return { closed: true };
}

function invitationByToken_(token) {
  var rawToken = String(token || '').trim();
  if (!rawToken) throw appError_('INVITATION_TOKEN_REQUIRED', 'Falta el token de invitación.', 400);
  var invitation = findRow_('Invitaciones', 'Token_Hash', sha256_(rawToken));
  if (!invitation) throw appError_('INVITATION_NOT_FOUND', 'La invitación no existe.', 404);
  if (normalizeCode_(invitation.Estado) !== 'PENDIENTE') throw appError_('INVITATION_UNAVAILABLE', 'La invitación ya fue usada, venció o fue revocada.', 409);
  var expiresAt = invitation.Expira_En instanceof Date ? invitation.Expira_En : new Date(invitation.Expira_En);
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    updateObject_('Invitaciones', invitation._row, { Estado: 'VENCIDA' });
    throw appError_('INVITATION_EXPIRED', 'La invitación venció.', 410);
  }
  return invitation;
}

function validateInvitation_(payload) {
  var invitation = invitationByToken_(payload && payload.token);
  return {
    email: normalizeEmail_(invitation.Email),
    name: String(invitation.Nombre_Completo || ''),
    role: normalizeCode_(invitation.Rol),
    mainBranch: normalizeCode_(invitation.Sede_Principal),
    branches: String(invitation.Sedes_Permitidas || '').split(',').map(function(item) { return normalizeCode_(item); }).filter(Boolean),
    expiresAt: iso_(invitation.Expira_En)
  };
}

function validateInvitationInput_(payload) {
  var name = String(payload && payload.name || '').trim().slice(0, 160);
  var email = normalizeEmail_(payload && payload.email);
  var role = normalizeCode_(payload && payload.role);
  var mainBranch = normalizeCode_(payload && payload.mainBranch);
  var branches = Array.isArray(payload && payload.branches) ? payload.branches.map(normalizeCode_).filter(Boolean) : [];
  if (!name) throw appError_('NAME_REQUIRED', 'Escribe el nombre completo.', 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError_('EMAIL_INVALID', 'El correo no es válido.', 400);
  if (['ADMINISTRADOR', 'VENDEDOR', 'BODEGA_LOGISTICA', 'CONSULTA'].indexOf(role) === -1) throw appError_('ROLE_INVALID', 'El rol no está permitido.', 400);
  if (['MP', 'TP'].indexOf(mainBranch) === -1) throw appError_('BRANCH_INVALID', 'La sede principal no es válida.', 400);
  branches = branches.filter(function(value, index, array) { return ['MP', 'TP'].indexOf(value) !== -1 && array.indexOf(value) === index; });
  if (branches.indexOf(mainBranch) === -1) branches.unshift(mainBranch);
  return { name: name, email: email, role: role, mainBranch: mainBranch, branches: branches, permissions: payload && payload.permissions };
}

function createInvitation_(payload, session) {
  requirePermission_(session, 'users.manage');
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw appError_('SYSTEM_BUSY','Hay otra invitación en proceso. Consulta el equipo antes de reintentar.',409);
  try {
  var input = validateInvitationInput_(payload || {});
  validateTeamGrant_(input,session);
  var selected=input.permissions===undefined?upLegacy_(input.role).filter(function(p){return upKeys_().indexOf(p)!==-1;}):upInput_(input.permissions);upGrant_(selected,session);
  var baseUrl = requiredProperty_('APP_BASE_URL').replace(/\/$/, '');
  var existingUser = findRow_('Usuarios', 'Email', input.email);
  if(existingUser&&normalizeCode_(existingUser.Rol)==='PROPIETARIO')throw appError_('OWNER_PROTECTED','La cuenta propietaria no se modifica mediante invitaciones.',403);
  if (existingUser && normalizeCode_(existingUser.Estado) === 'ACTIVO') throw appError_('USER_ALREADY_ACTIVE', 'Ese correo ya tiene acceso activo.', 409);
  if(existingUser)throw appError_('USER_ALREADY_EXISTS','Esta persona ya está en Equipo. Revisa sus permisos y reactiva su cuenta desde la ficha.',409);
  var pending = listRows_('Invitaciones').filter(function(row) {
    return normalizeEmail_(row.Email) === input.email && normalizeCode_(row.Estado) === 'PENDIENTE' && new Date(row.Expira_En).getTime() > Date.now();
  })[0];
  if (pending) throw appError_('INVITATION_ALREADY_PENDING', 'Ya existe una invitación vigente para ese correo.', 409);

  var rawToken = randomToken_();
  var createdAt = now_();
  var expiresAt = new Date(createdAt.getTime() + MADERARTE_APP.INVITATION_DAYS * 86400000);
  var invitationId = 'INV-' + Utilities.getUuid().toUpperCase();
  var invitationRecord = {
    Invitacion_ID: invitationId,
    Token_Hash: sha256_(rawToken),
    Email: input.email,
    Nombre_Completo: input.name,
    Rol: input.role,
    Sede_Principal: input.mainBranch,
    Sedes_Permitidas: input.branches.join(','),
    Estado: 'PENDIENTE',
    Expira_En: expiresAt,
    Creada_Por: session.profile.uid,
    Creada_En: createdAt,
    Usada_Por_UID: '',
    Usada_En: '',
    Revocada_Por: '',
    Revocada_En: '',
    Motivo_Revocacion: ''
  };
  orderAtomicBatch_([orderAppendRequest_('Invitaciones',[invitationRecord])].concat(upWrite_('INV_ACCESS_V1_'+invitationId,selected,session)));
  return {
    invitationId: invitationId,
    activationUrl: baseUrl + '/activar-cuenta.html?token=' + encodeURIComponent(rawToken),
    expiresAt: expiresAt.toISOString()
  };
  } finally {lock.releaseLock();}
}

function activateInvitation_(payload, proxyMeta) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw appError_('SYSTEM_BUSY', 'El sistema está procesando otra activación. Inténtalo de nuevo.', 409);
  try {
    var invitation = invitationByToken_(payload && payload.token);
    var firebaseUser = lookupFirebaseUser_(payload && payload.firebaseIdToken);
    if (firebaseUser.email !== normalizeEmail_(invitation.Email)) throw appError_('INVITATION_EMAIL_MISMATCH', 'La cuenta de Firebase no coincide con la invitación.', 403);

    var byUid = findRow_('Usuarios', 'UID_Firebase', firebaseUser.uid);
    var byEmail = findRow_('Usuarios', 'Email', firebaseUser.email);
    if(byEmail&&normalizeCode_(byEmail.Rol)==='PROPIETARIO')throw appError_('OWNER_PROTECTED','La cuenta propietaria no se modifica mediante invitaciones.',403);
    if(byEmail&&normalizeCode_(byEmail.Estado)==='ACTIVO')throw appError_('USER_ALREADY_ACTIVE','La cuenta ya tiene acceso. Inicia sesión.',409);
    if(byEmail)throw appError_('USER_ALREADY_EXISTS','Esta cuenta debe reactivarse desde Equipo. Solicita la revisión de su acceso.',409);
    var issuer=findRow_('Usuarios','UID_Firebase',invitation.Creada_Por);
    if(!issuer||normalizeCode_(issuer.Estado)!=='ACTIVO')throw appError_('INVITATION_UNAVAILABLE','Quien creó la invitación ya no tiene acceso activo.',403);
    validateTeamGrant_(validateInvitationInput_({name:invitation.Nombre_Completo,email:invitation.Email,role:invitation.Rol,mainBranch:invitation.Sede_Principal,branches:String(invitation.Sedes_Permitidas||'').split(','),permissions:(upPolicy_('INV_ACCESS_V1_'+invitation.Invitacion_ID)||{}).permissions}),{profile:publicProfile_(issuer),permissions:getUserPermissions_(issuer)});
    if (byUid && normalizeEmail_(byUid.Email) !== firebaseUser.email) throw appError_('UID_ALREADY_LINKED', 'La identidad ya está vinculada a otro usuario.', 409);
    if (byEmail && byEmail.UID_Firebase && String(byEmail.UID_Firebase) !== firebaseUser.uid) throw appError_('EMAIL_ALREADY_LINKED', 'El correo ya está vinculado a otra identidad.', 409);

    var granted=upPolicy_('INV_ACCESS_V1_'+invitation.Invitacion_ID);
    if(granted){upGrant_(granted.permissions,{profile:publicProfile_(issuer),permissions:getUserPermissions_(issuer)});orderAtomicBatch_(upWrite_(upKey_(firebaseUser.email),granted.permissions,{profile:publicProfile_(issuer)}));}
    var activatedAt = now_();
    var userPatch = {
      UID_Firebase: firebaseUser.uid,
      Email: firebaseUser.email,
      Nombre_Completo: invitation.Nombre_Completo,
      Rol: invitation.Rol,
      Sede_Principal: invitation.Sede_Principal,
      Sedes_Permitidas: invitation.Sedes_Permitidas,
      Estado: 'ACTIVO',
      Fecha_Invitacion: invitation.Creada_En,
      Fecha_Activacion: activatedAt,
      Creado_Por: invitation.Creada_Por,
      Fecha_Registro: byEmail ? byEmail.Fecha_Registro || activatedAt : activatedAt
    };
    var user;
    if (byEmail) {
      updateObject_('Usuarios', byEmail._row, userPatch);
      user = findRow_('Usuarios', 'Email', firebaseUser.email);
    } else {
      appendObject_('Usuarios', userPatch);
      user = findRow_('Usuarios', 'Email', firebaseUser.email);
    }
    updateObject_('Invitaciones', invitation._row, {
      Estado: 'USADA',
      Usada_Por_UID: firebaseUser.uid,
      Usada_En: activatedAt
    });
    return createSession_(user, payload || {}, proxyMeta || {});
  } finally {
    lock.releaseLock();
  }
}

function listUsers_(session) {
  requirePermission_(session, 'users.manage');
  var items = listRows_('Usuarios').map(function(row) {
    return {
      name: String(row.Nombre_Completo || ''),
      email: normalizeEmail_(row.Email),
      role: normalizeCode_(row.Rol),
      mainBranch: normalizeCode_(row.Sede_Principal),
      branches: String(row.Sedes_Permitidas || '').split(',').map(function(value) { return normalizeCode_(value); }).filter(Boolean),
      status: normalizeCode_(row.Estado),
      lastAccess: valueDateIso_(row.Ultimo_Acceso),
      permissions:getUserPermissions_(row),accessRevision:upRevision_(row),customAccess:!!upPolicy_(upKey_(row.Email)),editable:normalizeCode_(row.Rol)!=='PROPIETARIO'&&row.UID_Firebase!==session.profile.uid&&(session.profile.role==='PROPIETARIO'||String(row.Sedes_Permitidas||'').split(',').every(function(b){return session.profile.branches.indexOf(normalizeCode_(b))!==-1;})&&getUserPermissions_(row).every(function(p){return hasPermission_(session.permissions,p);}))
    };
  }).sort(function(a, b) { return a.name.localeCompare(b.name, 'es'); });
  return { permissionGroups:USER_PERMISSION_GROUPS_,permissionDependencies:USER_PERMISSION_DEPS_, items: items, total: items.length, roles:teamRoles_(session), invitations:listRows_('Invitaciones').filter(function(r){return normalizeCode_(r.Estado)==='PENDIENTE';}).map(function(r){return {id:r.Invitacion_ID,name:r.Nombre_Completo,email:normalizeEmail_(r.Email),role:normalizeCode_(r.Rol),mainBranch:normalizeCode_(r.Sede_Principal),branches:String(r.Sedes_Permitidas||'').split(','),expiresAt:valueDateIso_(r.Expira_En),status:new Date(r.Expira_En).getTime()>Date.now()?'PENDIENTE':'VENCIDA'};}) };
}

function validateTeamGrant_(input,session){
  requirePermission_(session,'users.manage');
  var permissions=input.permissions===undefined?upLegacy_(input.role):upInput_(input.permissions);
  if(!getRolePermissions_(input.role).length)throw appError_('ROLE_NOT_ALLOWED','El rol no está activo.',400);
  
  if(session.profile.role!=='PROPIETARIO'){
    if(permissions.some(function(p){return !hasPermission_(session.permissions,p);}))throw appError_('ROLE_NOT_ALLOWED','No puedes invitar con permisos superiores a los tuyos.',403);
    if(input.branches.some(function(b){return (session.profile.branches||[]).indexOf(b)===-1;}))throw appError_('BRANCH_NOT_ALLOWED','Solo puedes invitar a tus sedes autorizadas.',403);
  }
  input.branches.forEach(function(b){var r=findRow_('Sedes','Sede_ID',b);if(!r||normalizeCode_(r.Estado)!=='ACTIVA')throw appError_('BRANCH_INVALID','La sede no está activa.',400);});
}
function teamRoles_(session){
  return ['PROPIETARIO','ADMINISTRADOR','VENDEDOR','BODEGA_LOGISTICA','CONSULTA'].map(function(role){
    var r=findRow_('Roles','Rol',role),permissions=r&&normalizeCode_(r.Activo)==='SI'?upLegacy_(role):[];
    return {role:role,permissions:permissions,active:!!permissions.length,invitable:role!=='PROPIETARIO'&&!!permissions.length&&(session.profile.role==='PROPIETARIO'||permissions.every(function(p){return hasPermission_(session.permissions,p);}))};
  });
}
