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
    permissions: getRolePermissions_(user.Rol),
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
  var permissions = getRolePermissions_(user.Rol);
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
  return { name: name, email: email, role: role, mainBranch: mainBranch, branches: branches };
}

function createInvitation_(payload, session) {
  requirePermission_(session, 'users.manage');
  var input = validateInvitationInput_(payload || {});
  var existingUser = findRow_('Usuarios', 'Email', input.email);
  if (existingUser && normalizeCode_(existingUser.Estado) === 'ACTIVO') throw appError_('USER_ALREADY_ACTIVE', 'Ese correo ya tiene acceso activo.', 409);
  var pending = listRows_('Invitaciones').filter(function(row) {
    return normalizeEmail_(row.Email) === input.email && normalizeCode_(row.Estado) === 'PENDIENTE' && new Date(row.Expira_En).getTime() > Date.now();
  })[0];
  if (pending) throw appError_('INVITATION_ALREADY_PENDING', 'Ya existe una invitación vigente para ese correo.', 409);

  var rawToken = randomToken_();
  var createdAt = now_();
  var expiresAt = new Date(createdAt.getTime() + MADERARTE_APP.INVITATION_DAYS * 86400000);
  var invitationId = 'INV-' + Utilities.getUuid().toUpperCase();
  appendObject_('Invitaciones', {
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
  });
  var baseUrl = requiredProperty_('APP_BASE_URL').replace(/\/$/, '');
  return {
    invitationId: invitationId,
    activationUrl: baseUrl + '/activar-cuenta.html?token=' + encodeURIComponent(rawToken),
    expiresAt: expiresAt.toISOString()
  };
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
    if (byUid && normalizeEmail_(byUid.Email) !== firebaseUser.email) throw appError_('UID_ALREADY_LINKED', 'La identidad ya está vinculada a otro usuario.', 409);
    if (byEmail && byEmail.UID_Firebase && String(byEmail.UID_Firebase) !== firebaseUser.uid) throw appError_('EMAIL_ALREADY_LINKED', 'El correo ya está vinculado a otra identidad.', 409);

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
      lastAccess: valueDateIso_(row.Ultimo_Acceso)
    };
  }).sort(function(a, b) { return a.name.localeCompare(b.name, 'es'); });
  return { items: items, total: items.length };
}
