// Individual allowlists, stored privately in Configuracion. Empty lists deny access.
// Legacy accounts inherit their role until explicitly saved; owner is protected.
var USER_PERMISSION_GROUPS_ = [
  {title:'Acceso',items:[['app.access','Entrar a Maddy'],['perfil.read','Consultar su perfil']]},
  {title:'Clientes',items:[['clientes.read','Consultar clientes'],['clientes.create','Crear clientes']]},
  {title:'Cotizaciones',items:[['cotizaciones.read','Consultar cotizaciones'],['cotizaciones.create','Crear cotizaciones'],['cotizaciones.update.all','Completar documentos de otros asesores']]},
  {title:'Órdenes de pedido',items:[['ordenes.read','Consultar órdenes'],['ordenes.create','Crear órdenes'],['ordenes.update.own','Actualizar documentos propios'],['ordenes.update.all','Completar documentos de otros asesores']]},
  {title:'Abonos',items:[['abonos.read','Consultar abonos'],['abonos.create','Registrar abonos']]},
  {title:'Entregas y producción',items:[['remisiones.read','Consultar remisiones'],['remisiones.create','Registrar remisiones'],['produccion.read','Consultar producción'],['produccion.update','Actualizar producción']]},
  {title:'Agenda y garantías',items:[['agenda.read','Consultar agenda y garantías'],['agenda.update','Gestionar agenda y garantías']]},
  {title:'Acciones delicadas',sensitive:true,items:[['ajustes.desistir','Retirar muebles de una orden'],['ajustes.retornar','Registrar devolución de un mueble'],['ajustes.transferir','Trasladar saldo a otra orden'],['ajustes.devolver','Registrar devolución de dinero'],['recaudos.read','Consultar ingresos por sede'],['recaudos.receive','Confirmar efectivo recibido'],['config.read','Consultar configuración'],['users.manage','Administrar equipo y sus accesos']]}
];
var USER_PERMISSION_DEPS_ = {
  'clientes.create':['clientes.read'],'cotizaciones.create':['cotizaciones.read','clientes.read','clientes.create'],
  'cotizaciones.update.all':['cotizaciones.read','cotizaciones.create'],'ordenes.create':['ordenes.read','clientes.read','clientes.create'],
  'ordenes.update.own':['ordenes.read'],'ordenes.update.all':['ordenes.read'],
  'abonos.create':['abonos.read','ordenes.read'],'remisiones.create':['remisiones.read','ordenes.read'],
  'produccion.update':['produccion.read','ordenes.read'],'agenda.update':['agenda.read','ordenes.read'],
  'ajustes.desistir':['ordenes.read','abonos.read'],'ajustes.retornar':['ordenes.read','abonos.read'],
  'ajustes.transferir':['ordenes.read','abonos.read'],'ajustes.devolver':['ordenes.read','abonos.read'],
  'recaudos.read':['ordenes.read','abonos.read'],'recaudos.receive':['recaudos.read'],'users.manage':['config.read']
};
function upKeys_(){return USER_PERMISSION_GROUPS_.reduce(function(a,g){return a.concat(g.items.map(function(i){return i[0];}));},[]);}
function upLegacy_(role){
  var p=getRolePermissions_(role).slice();if(p.indexOf('*')!==-1)return p;
  if(p.indexOf('ajustes.create')!==-1)p=p.concat(['ajustes.desistir','ajustes.retornar','ajustes.transferir','ajustes.devolver']);
  if(normalizeCode_(role)==='ADMINISTRADOR')p=p.concat(['recaudos.read','recaudos.receive']);
  return p.filter(function(v,i,a){return a.indexOf(v)===i;});
}
function upKey_(email){return 'USER_ACCESS_V1_'+sha256_(normalizeEmail_(email));}
function upPolicy_(key){
  var rows=listRows_('Configuracion').filter(function(r){return r.Clave===key;});
  if(rows.length>1)throw appError_('ACCESS_CONFIGURATION','Los accesos requieren revisión.',503);
  if(!rows.length)return null;
  var p=parseJson_(rows[0].Valor,null);
  if(!p||p.version!==1||!Array.isArray(p.permissions)||p.permissions.some(function(k){return upKeys_().indexOf(k)===-1;}))throw appError_('ACCESS_CONFIGURATION','Los accesos requieren revisión.',503);
  return p;
}
function getUserPermissions_(user){
  if(normalizeCode_(user.Rol)==='PROPIETARIO')return getRolePermissions_(user.Rol);
  var policy=upPolicy_(upKey_(user.Email));return policy?policy.permissions.slice():upLegacy_(user.Rol);
}
function upRevision_(u){return sha256_(JSON.stringify([u.UID_Firebase,u.Email,u.Rol,u.Estado,u.Sedes_Permitidas,upPolicy_(upKey_(u.Email)),getUserPermissions_(u)]));}
function upInput_(permissions){
  if(!Array.isArray(permissions)||permissions.length>upKeys_().length||permissions.some(function(p){return typeof p!=='string'||upKeys_().indexOf(p)===-1;}))throw appError_('PERMISSIONS_INVALID','Revisa las casillas de permisos.',400);
  var p=permissions.filter(function(v,i,a){return a.indexOf(v)===i;}).sort();
  p.forEach(function(k){(USER_PERMISSION_DEPS_[k]||[]).forEach(function(d){if(p.indexOf(d)===-1)throw appError_('PERMISSION_DEPENDENCY','El permiso '+k+' necesita '+d+'.',400);});});
  return p;
}
function upGrant_(permissions,session){
  requirePermission_(session,'users.manage');
  if(session.profile.role!=='PROPIETARIO'&&permissions.some(function(p){return !hasPermission_(session.permissions,p);}))throw appError_('PERMISSION_DENIED','Solo puedes autorizar accesos que tú tienes.',403);
}
function upWrite_(key,permissions,session){
  var old=findRow_('Configuracion','Clave',key),p={version:1,permissions:permissions},patch={Valor:JSON.stringify(p),Tipo:'JSON',Categoria:'ACCESOS_INDIVIDUALES',Descripcion:'Permisos individuales autorizados',Privada:'SI',Actualizada_Por:session.profile.uid,Actualizada_En:now_().toISOString()};
  return old?orderUpdateRequests_('Configuracion',old._row,patch):[orderAppendRequest_('Configuracion',[Object.assign({Clave:key},patch)])];
}
function upSave_(payload,context){
  var lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw appError_('ACCESS_BUSY','Hay otro cambio en curso. Reintenta.',409);
  try{
    if(typeof osActive_==='function'&&osActive_())throw appError_('PERMISSION_DENIED','Los accesos se administran fuera del ensayo.',403);
    var session=validateSessionToken_(context.sessionToken,false);requirePermission_(session,'users.manage');
    var email=normalizeEmail_(payload.email),matches=listRows_('Usuarios').filter(function(u){return normalizeEmail_(u.Email)===email;});
    if(matches.length!==1)throw appError_('USER_NOT_FOUND','No se encontró una única persona.',404);
    var user=matches[0];
    if(normalizeCode_(user.Rol)==='PROPIETARIO'||user.UID_Firebase===session.profile.uid)throw appError_('OWNER_PROTECTED','No puedes modificar tu propio acceso ni la cuenta propietaria.',403);
    if(session.profile.role!=='PROPIETARIO'&&String(user.Sedes_Permitidas||'').split(',').some(function(b){return session.profile.branches.indexOf(normalizeCode_(b))===-1;}))throw appError_('BRANCH_NOT_ALLOWED','Esta persona tiene sedes fuera de tu alcance.',403);
    var next=upInput_(payload.permissions);upGrant_(next,session);
    // Also prevent a delegated manager from taking over a stronger account.
    if(session.profile.role!=='PROPIETARIO')upGrant_(getUserPermissions_(user),session);
    var current=getUserPermissions_(user),key=upKey_(email),policy=upPolicy_(key);
    if(policy&&JSON.stringify(policy.permissions)===JSON.stringify(next))return {saved:true,unchanged:true,permissions:next,revision:upRevision_(user)};
    if(payload.revision!==upRevision_(user))throw appError_('ACCESS_CHANGED','Los accesos cambiaron. Abre de nuevo la ficha antes de guardar.',409);
    var requests=upWrite_(key,next,session),id='ACCESS-'+Utilities.getUuid();
    requests.push(orderAppendRequest_('Auditoria',[{ID:id,Fecha:now_().toISOString(),Usuario:session.profile.uid,Rol:session.profile.role,Modulo:'EQUIPO',Accion:'PERMISOS_INDIVIDUALES',Entidad:'USUARIO',Entidad_ID:user.UID_Firebase,Resumen:'Actualización de accesos individuales',Estado:'CONFIRMADA',Antes_JSON:JSON.stringify(current),Despues_JSON:JSON.stringify(next),Request_ID:String(context.requestId||id),Reversible:'NO',Motivo_No_Reversible:'Revisar y guardar una nueva autorización.'}]));
    orderAtomicBatch_(requests);return {saved:true,permissions:next,revision:upRevision_(user)};
  }finally{lock.releaseLock();}
}
