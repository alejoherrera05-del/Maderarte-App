// Read-only proposal. Merely loading/deploying this file never grants access.
// Roles.Permisos_JSON remains the sole source used by authentication.
var OPERATIONAL_ROLE_PROPOSAL_ = Object.freeze({
  PROPIETARIO: ['*'],
  ADMINISTRADOR: ['app.access','perfil.read','config.read','users.manage','clientes.read','clientes.create','cotizaciones.read','cotizaciones.create','cotizaciones.update.all','ordenes.read','ordenes.create','ordenes.update.all','abonos.read','abonos.create','remisiones.read','remisiones.create','produccion.read','produccion.update','agenda.read','agenda.update','ajustes.create'],
  VENDEDOR: ['app.access','perfil.read','clientes.read','clientes.create','cotizaciones.read','cotizaciones.create','ordenes.read','ordenes.create','ordenes.update.own','abonos.read','abonos.create'],
  BODEGA_LOGISTICA: ['app.access','perfil.read','ordenes.read','produccion.read','produccion.update','remisiones.read','remisiones.create'],
  CONSULTA: ['app.access','perfil.read','clientes.read','cotizaciones.read','ordenes.read','abonos.read','remisiones.read']
});
function operationalRoleProposal_(session) {
  requirePermission_(session,'users.manage');
  if(session.profile.role!=='PROPIETARIO')throw appError_('PERMISSION_DENIED','La revisión de roles corresponde al propietario.',403);
  return Object.keys(OPERATIONAL_ROLE_PROPOSAL_).map(function(role){
    var current=getRolePermissions_(role),proposed=OPERATIONAL_ROLE_PROPOSAL_[role].slice();
    return {role:role,current:current,proposed:proposed,
      add:proposed.filter(function(p){return current.indexOf(p)===-1;}),
      remove:current.filter(function(p){return proposed.indexOf(p)===-1;}),
      active:!!current.length,applied:false};
  });
}


// Editor-only migration, deliberately absent from Router.gs. Execute only after
// the owner approves the matrix. Publishing/loading never invokes this function.
function aplicarPermisosOperativosAprobados() {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(10000))throw appError_('ROLE_REVIEW_BUSY','Hay otra operación en curso.',503);
  try {
    if(typeof osActive_==='function'&&osActive_())throw appError_('ROLE_REVIEW_CONTEXT','No se aplica desde un ensayo.',403);
    if(getSpreadsheet_().getName()!==MADERARTE_APP.SPREADSHEET_NAME)throw appError_('ROLE_REVIEW_BASE','La base no es la oficial.',409);
    var email=normalizeEmail_(Session.getEffectiveUser().getEmail());
    var owners=listRows_('Usuarios').filter(function(u){return normalizeEmail_(u.Email)===email&&normalizeCode_(u.Rol)==='PROPIETARIO'&&normalizeCode_(u.Estado)==='ACTIVO';});
    if(!email||owners.length!==1)throw appError_('PERMISSION_DENIED','Ejecuta la revisión desde la cuenta propietaria.',403);
    verifyInitialRoles_();
    var requests=[],changes=[],rows=listRows_('Roles'),stamp=now_().toISOString();
    ['ADMINISTRADOR','VENDEDOR','CONSULTA'].forEach(function(role){
      var matches=rows.filter(function(r){return normalizeCode_(r.Rol)===role;});
      if(matches.length!==1)throw appError_('ROLE_REVIEW_DUPLICATE','Revisa las filas de roles antes de continuar.',409);
      var row=matches[0],before=parseJson_(row.Permisos_JSON,null);
      if(!Array.isArray(before)||before.some(function(p){return typeof p!=='string'||p.indexOf('*')!==-1;}))throw appError_('ROLE_REVIEW_WILDCARD','Revisa los permisos amplios del rol.',409);
      var added=OPERATIONAL_ROLE_PROPOSAL_[role].filter(function(p){return before.indexOf(p)===-1;});
      if(!added.length)return;
      var after=before.concat(added);
      requests=requests.concat(orderUpdateRequests_('Roles',row._row,{Permisos_JSON:JSON.stringify(after),Actualizado_Por:owners[0].UID_Firebase,Actualizado_En:stamp}));
      changes.push({role:role,before:before,after:after,added:added});
    });
    if(requests.length){
      requests.push(orderAppendRequest_('Auditoria',[{ID:Utilities.getUuid(),Fecha:stamp,Usuario:owners[0].UID_Firebase,Rol:'PROPIETARIO',Modulo:'EQUIPO',Accion:'MATRIZ_OPERATIVA_APROBADA',Entidad:'Roles',Entidad_ID:'operational-roles-v1',Resumen:'Ampliación aprobada de roles operativos; usuarios y sedes conservados.',Estado:'CONFIRMADA',Antes_JSON:JSON.stringify(changes.map(function(x){return {role:x.role,permissions:x.before};})),Despues_JSON:JSON.stringify(changes.map(function(x){return {role:x.role,permissions:x.after};})),Cambios_JSON:JSON.stringify(changes.map(function(x){return {role:x.role,added:x.added};}))}]));
      orderAtomicBatch_(requests);
    }
    var result={applied:true,changedRoles:changes.map(function(x){return {role:x.role,added:x.added};}),usersChanged:0,branchesChanged:0};
    Logger.log(JSON.stringify(result));return result;
  } finally {lock.releaseLock();}
}
