// Read-only proposal. Merely loading/deploying this file never grants access.
// Roles.Permisos_JSON remains the sole source used by authentication.
var OPERATIONAL_ROLE_PROPOSAL_ = Object.freeze({
  PROPIETARIO: ['*'],
  ADMINISTRADOR: ['app.access','perfil.read','config.read','users.manage','clientes.read','clientes.create','cotizaciones.read','cotizaciones.create','cotizaciones.update.all','ordenes.read','ordenes.create','ordenes.update.all','abonos.read','abonos.create','remisiones.read','remisiones.create','produccion.read','produccion.update','agenda.read','agenda.update','ajustes.create'],
  VENDEDOR: ['app.access','perfil.read','clientes.read','clientes.create','cotizaciones.read','cotizaciones.create','ordenes.read','ordenes.create','ordenes.update.own','abonos.read','abonos.create'],
  BODEGA_LOGISTICA: ['app.access','perfil.read','ordenes.read','produccion.read','produccion.update','remisiones.read','remisiones.create'],
  CONSULTA: ['app.access','perfil.read','clientes.read','cotizaciones.read','ordenes.read']
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
