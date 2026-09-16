// Read-only administrative history. Never return raw audit JSON or credentials.
var activitySession_ = null;
function activityStamp_(row) {
  var source = activitySession_ && activitySession_.sessionRow;
  if (!source) return row;
  var copy = Object.assign({}, row);
  ['Dispositivo', 'Plataforma', 'Navegador'].forEach(function(key) {
    if (!copy[key]) copy[key] = String(source[key] || '').slice(0, 180);
  });
  return copy;
}
function activityAccess_(session) {
  requirePermission_(session, 'config.read');
  requirePermission_(session, 'auditoria.read');
}
function activityText_(value, max) { return String(value == null ? '' : value).slice(0, max || 240); }
function activitySummary_(row, names) {
  var time = new Date(row.Fecha), user = activityText_(row.Usuario);
  return {id:activityText_(row.ID), date:isNaN(time.getTime())?'':time.toISOString(),
    actor:names[user] || (user === 'EDITOR_APPS_SCRIPT' ? 'Administración del servicio' : 'Usuario no identificado'),
    module:activityText_(row.Modulo), action:activityText_(row.Accion), entity:activityText_(row.Entidad),
    reference:row.Entidad==='USUARIO'?(names[String(row.Entidad_ID)]||'Cuenta de usuario'):activityText_(row.Entidad_ID), status:activityText_(row.Estado),
    device:activityText_(row.Dispositivo,180)};
}
function activityNames_() {
  var names = Object.create(null);
  listRows_('Usuarios').forEach(function(u){ names[String(u.UID_Firebase)] = activityText_(u.Nombre_Completo); });
  return names;
}
function activityDay_(value) {
  if (!value) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(new Date(value+'T00:00:00Z').getTime())) throw appError_('ACTIVITY_FILTER','Revisa las fechas.',400);
  return value;
}
function activityList_(p, session) {
  activityAccess_(session);
  var from=activityDay_(p.from), to=activityDay_(p.to), query=activityText_(p.query,120).toLowerCase();
  if (from && to && from>to) throw appError_('ACTIVITY_FILTER','La fecha inicial debe ser anterior a la final.',400);
  var offset=Number(p.offset||0), limit=25;
  if (!Number.isSafeInteger(offset)||offset<0) throw appError_('ACTIVITY_FILTER','Revisa la página solicitada.',400);
  var names=activityNames_(), all=listRows_('Auditoria').filter(function(r){return r.ID;}).map(function(r){return activitySummary_(r,names);});
  var modules=[], actors=[];
  all.forEach(function(r){if(r.module&&modules.indexOf(r.module)<0)modules.push(r.module);if(actors.indexOf(r.actor)<0)actors.push(r.actor);});
  var rows=all.filter(function(r){
    var day=r.date?new Date(new Date(r.date).getTime()-18000000).toISOString().slice(0,10):'';
    return (!from||(day&&day>=from))&&(!to||(day&&day<=to))&&(!p.module||r.module===p.module)&&(!p.actor||r.actor===p.actor)&&(!p.status||r.status===p.status)&&(!query||[r.reference,r.actor,r.module,r.action,r.device].join(' ').toLowerCase().indexOf(query)>=0);
  }).sort(function(a,b){return b.date.localeCompare(a.date)||b.id.localeCompare(a.id);});
  return {items:rows.slice(offset,offset+limit),total:rows.length,offset:offset,hasMore:offset+limit<rows.length,modules:modules.sort(),actors:actors.sort()};
}
// Only known business fields are projected. Unknown and technical fields stay private.
var ACTIVITY_FIELDS_ = {
  number:'Documento', total:'Total', balance:'Saldo', paid:'Abonado', orderNumber:'Orden de pedido',
  title:'Título', date:'Fecha', time:'Hora', category:'Categoría', branch:'Sede', description:'Descripción',
  status:'Estado', Estado:'Estado', Estado_Registro:'Estado', mode:'Modo operativo', permissions:'Permisos',
  Cantidad:'Cantidad', quantity:'Cantidad', stage:'Etapa', Estado_Produccion:'Estado de producción',
  Total_Cotizado:'Total cotizado', Valor_Total:'Valor total', Abonado_Total:'Total abonado', Saldo_Pendiente:'Saldo pendiente',
  Valor_Abono:'Valor del abono', Saldo_Anterior:'Saldo anterior', Saldo_Nuevo:'Saldo nuevo', amount:'Importe',
  Numero_OP:'Orden de pedido', Numero_Recibo:'Recibo', Numero_Remision:'Remisión', Numero_Cotizacion:'Cotización',
  Descripcion:'Descripción', Observaciones:'Observaciones', reason:'Motivo', Sede:'Sede', Fecha:'Fecha', Hora:'Hora',
  Titulo:'Título', Categoria:'Categoría', Medio_Pago:'Medio de pago', Tipo:'Tipo', Diagnostico:'Diagnóstico', Solucion:'Solución',
  Cantidad_Entregada:'Cantidad entregada', Cantidad_Pendiente:'Cantidad pendiente', Estado_Item:'Estado del mueble'
};
function activityFields_(raw) {
  var data=parseJson_(raw,null), result=Object.create(null), count=0;
  function walk(value,path,depth) {
    if (!value||typeof value!=='object'||depth>4||count>=100) return;
    Object.keys(value).slice(0,100).forEach(function(key){
      var v=value[key], next=path?path+'.'+key:key;
      if (Object.prototype.hasOwnProperty.call(ACTIVITY_FIELDS_,key) && (v===null||typeof v!=='object'||key==='permissions'&&Array.isArray(v))) {
        result[next]={label:ACTIVITY_FIELDS_[key],value:activityText_(Array.isArray(v)?v.join(', '):v,1600)}; count++;
      } else if (/^(source|target|before|after|order|payment|items|rows|event|[0-9]+)$/.test(key)) walk(v,next,depth+1);
    });
  }
  walk(data,'',0); return result;
}
function activityDetail_(p,session) {
  activityAccess_(session);
  var id=activityText_(p.id), rows=listRows_('Auditoria').filter(function(r){return String(r.ID)===id;});
  if(!id||rows.length!==1)throw appError_('ACTIVITY_NOT_FOUND','No se encontró un registro único.',404);
  var row=rows[0], result=activitySummary_(row,activityNames_()), before=activityFields_(row.Antes_JSON), after=activityFields_(row.Despues_JSON);
  result.changes=[];
  Object.keys(before).concat(Object.keys(after)).filter(function(k,i,a){return a.indexOf(k)===i;}).forEach(function(k){
    var a=before[k],b=after[k];if(a&&b&&a.value===b.value)return;
    result.changes.push({field:(b||a).label,before:a?a.value:null,after:b?b.value:null});
  });
  result.browser=activityText_(row.Navegador,180);result.platform=activityText_(row.Plataforma,180);
  result.hasBefore=Object.keys(before).length>0;result.hasAfter=Object.keys(after).length>0;
  var ref=String(row.Entidad_ID||'');result.href='';
  if(/^(MP|TP)-OP-\d+$/.test(ref))result.href='/orden.html?op='+encodeURIComponent(ref);
  if(/^(MP|TP)-COT-\d+$/.test(ref))result.href='/cotizacion-ver.html?numero='+encodeURIComponent(ref);
  return result;
}
