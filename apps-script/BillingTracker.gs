// Operational follow-up for invoices already issued in FacturaTech.
// This ledger does not issue tax documents and the monthly amount is a minimum
// planning target, never a cap or a determination of tax obligations.
var BILLING_HEADERS_=['Factura_ID','Fecha_Emision','Sede','Prefijo','Numero','CUFE','Valor_Total','Estado','OPs_JSON','Cliente','Notas','Fuente','Registrado_Por','Fecha_Registro','Request_ID'];
var BILLING_DEFAULTS_=Object.freeze({minimumMonthly:20000000,minimumWeekly:2,warningDays:5,urgentDays:8});

function billingSession_(context,write){
  var s=validateSessionToken_(context.sessionToken,false);
  requirePermission_(s,'ordenes.read');
  requirePermission_(s,write?'facturacion.manage':'facturacion.read');
  return s;
}
function billingSheet_(create){
  var book=getSpreadsheet_(),sheet=book.getSheetByName('Facturacion_Electronica');
  if(!sheet&&create){sheet=book.insertSheet('Facturacion_Electronica');sheet.getRange(1,1,1,BILLING_HEADERS_.length).setValues([BILLING_HEADERS_]);SpreadsheetApp.flush();}
  if(sheet){var h=getHeaders_(sheet);if(h.join('|')!==BILLING_HEADERS_.join('|'))throw appError_('BILLING_SCHEMA','El control de facturación requiere revisión.',503);}
  return sheet;
}
function billingRows_(){return billingSheet_(false)?listRows_('Facturacion_Electronica'):[];}
function billingPositiveInteger_(value,field){var n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw appError_('BILLING_INPUT','Revisa '+field+'.',400);return n;}
function billingConfigInteger_(key,fallback){var n=Number(getConfigValue_(key,String(fallback)));return Number.isSafeInteger(n)&&n>0?n:fallback;}
function billingConfig_(){
  var c={minimumMonthly:billingConfigInteger_('FACTURACION_META_MINIMA_MENSUAL',BILLING_DEFAULTS_.minimumMonthly),minimumWeekly:billingConfigInteger_('FACTURACION_MINIMO_SEMANAL',BILLING_DEFAULTS_.minimumWeekly),warningDays:billingConfigInteger_('FACTURACION_AVISO_DIAS',BILLING_DEFAULTS_.warningDays),urgentDays:billingConfigInteger_('FACTURACION_ALERTA_DIAS',BILLING_DEFAULTS_.urgentDays)};
  if(c.warningDays>=c.urgentDays)c.warningDays=Math.max(1,c.urgentDays-1);return c;
}
function billingToday_(){return Utilities.formatDate(now_(),MADERARTE_APP.TIMEZONE,'yyyy-MM-dd');}
function billingDayNumber_(iso){var p=String(iso||'').split('-').map(Number);return p.length===3?Math.floor(Date.UTC(p[0],p[1]-1,p[2])/86400000):NaN;}
function billingWeek_(today){var p=today.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2])),day=d.getUTCDay()||7,start=new Date(d.getTime()-(day-1)*86400000),end=new Date(start.getTime()+6*86400000);return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};}
function billingMonthDays_(today){var p=today.split('-').map(Number);return new Date(Date.UTC(p[0],p[1],0)).getUTCDate();}
function billingOps_(row){var ops=parseJson_(row.OPs_JSON,[]);return Array.isArray(ops)?ops.map(String).filter(Boolean):[];}
function billingView_(row){return {id:String(row.Factura_ID||''),date:valueDateIso_(row.Fecha_Emision).slice(0,10),branch:normalizeCode_(row.Sede),prefix:String(row.Prefijo||''),number:String(row.Numero||''),cufe:String(row.CUFE||''),amount:Number(row.Valor_Total||0),status:normalizeCode_(row.Estado),orders:billingOps_(row),client:String(row.Cliente||''),notes:String(row.Notas||''),source:String(row.Fuente||''),registeredAt:valueDateIso_(row.Fecha_Registro)};}
function billingSummary_(payload,context){
  var s=billingSession_(context,false),config=billingConfig_(),today=billingToday_(),month=today.slice(0,7),week=billingWeek_(today),rows=billingRows_(),linked={};
  var invoices=rows.map(billingView_).filter(function(x){return x.status==='FIRMADA'&&orderBranchReadable_(s,x.branch);});
  invoices.forEach(function(x){x.orders.forEach(function(n){linked[n]=true;});});
  var monthly=invoices.filter(function(x){return x.date.slice(0,7)===month;}),weekly=invoices.filter(function(x){return x.date>=week.from&&x.date<=week.to;}),monthlyTotal=monthly.reduce(function(a,x){return a+x.amount;},0);
  if(!Number.isSafeInteger(monthlyTotal))throw appError_('BILLING_INTEGRITY','El total de facturación requiere revisión.',409);
  var recent=invoices.slice().sort(function(a,b){return b.date.localeCompare(a.date)||b.number.localeCompare(a.number);}),last=recent[0]||null,daysSince=last?Math.max(0,billingDayNumber_(today)-billingDayNumber_(last.date)):null;
  var level='ok',message='El ritmo de facturación está al día.';
  if(daysSince===null){level='urgent';message='Aún no hay facturas firmadas registradas en Maddy.';}
  else if(daysSince>=config.urgentDays){level='urgent';message='Ojo: llevas '+daysSince+' días sin registrar una factura firmada.';}
  else if(daysSince>=config.warningDays){level='warning';message='Han pasado '+daysSince+' días desde la última factura firmada.';}
  var weekday=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1,Number(today.slice(8,10)))).getUTCDay()||7;
  if(level==='ok'&&weekday>=4&&weekly.length<config.minimumWeekly){level='warning';message='Esta semana faltan '+(config.minimumWeekly-weekly.length)+' factura(s) para el ritmo mínimo.';}
  var candidates=listRows_('Ordenes_Pedido').filter(function(o){return o.Numero_OP&&orderBranchReadable_(s,o.Sede)&&['ANULADA','ANULADO'].indexOf(normalizeCode_(o.Estado))===-1&&!linked[o.Numero_OP];}).map(function(o){return {number:String(o.Numero_OP),date:valueDateIso_(o.Fecha),branch:normalizeCode_(o.Sede),document:String(o.Cedula_NIT||''),client:String(o.Nombre_Cliente||''),total:Number(o.Valor_Total||0),status:normalizeCode_(o.Estado)};}).sort(function(a,b){return a.date.localeCompare(b.date)||a.number.localeCompare(b.number);}).slice(0,150);
  return {today:today,config:config,alert:{level:level,message:message,daysSince:daysSince},month:{key:month,total:monthlyTotal,count:monthly.length,target:config.minimumMonthly,remaining:Math.max(0,config.minimumMonthly-monthlyTotal),progress:Math.min(100,Math.round(monthlyTotal/config.minimumMonthly*100)),expectedToDate:Math.round(config.minimumMonthly*Number(today.slice(8,10))/billingMonthDays_(today))},week:{from:week.from,to:week.to,count:weekly.length,target:config.minimumWeekly,remaining:Math.max(0,config.minimumWeekly-weekly.length)},last:last,recent:recent.slice(0,20),candidates:candidates,enabled:hasPermission_(s.permissions,'facturacion.manage')&&commercialWritesEnabled_()&&getConfigValue_('MODO_OPERACION','')==='OPERACION',setup:!!billingSheet_(false)};
}
function billingReplay_(id,s,hash){
  var r=mdUnique_(listRows_('Idempotencia'),'Request_ID',id);if(!r)return null;
  if(r.Usuario!==s.profile.uid||r.Tipo_Operacion!=='FACTURACION_REGISTRAR')throw appError_('REQUEST_ID_CONFLICT','El intento pertenece a otra operación.',409);
  var saved=parseJson_(r.Resultado_JSON,null);if(r.Estado!=='CONFIRMADA'||!saved||!saved.result)throw appError_('BILLING_RECOVERY','El intento requiere revisión.',409);
  if(hash&&hash!==saved.fingerprint)throw appError_('REQUEST_CONTENT_CHANGED','Conserva los datos del intento original.',409);
  if(!orderBranchReadable_(s,saved.result.invoice.branch))throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a la sede.',403);return saved.result;
}
function billingStatus_(payload,context){var s=billingSession_(context,false),r=billingReplay_(orderRequestId_(payload.requestId),s,'');return {saved:!!r,result:r};}
function billingRegister_(p,context){
  var s=billingSession_(context,true);if(!commercialWritesEnabled_()||getConfigValue_('MODO_OPERACION','')!=='OPERACION')throw appError_('COMMERCIAL_WRITES_DISABLED','El registro de facturación no está habilitado.',403);
  orderObject_(p,['date','branch','prefix','number','cufe','amount','orders','client','notes','confirmed'],'factura');if(p.confirmed!==true)throw appError_('BILLING_CONFIRMATION','Confirma que la factura ya fue emitida y firmada en FacturaTech.',400);
  var date=agDate_(p.date),today=billingToday_();if(date>today||billingDayNumber_(today)-billingDayNumber_(date)>1830)throw appError_('BILLING_DATE','Revisa la fecha de emisión.',400);
  var branch=normalizeCode_(orderText_(p.branch,'branch',12,true));if(!orderBranchReadable_(s,branch))throw appError_('BRANCH_NOT_ALLOWED','No tienes acceso a la sede.',403);
  var prefix=orderText_(p.prefix,'prefix',20,true).toUpperCase(),number=orderText_(p.number,'number',50,true).toUpperCase(),cufe=orderText_(p.cufe,'cufe',160,true).toLowerCase();
  if(!/^[A-Z0-9-]{1,20}$/.test(prefix)||!/^[A-Z0-9-]{1,50}$/.test(number)||!/^[a-z0-9]{40,160}$/.test(cufe))throw appError_('BILLING_INPUT','Revisa prefijo, número y CUFE.',400);
  var amount=billingPositiveInteger_(p.amount,'el valor total'),ops=Array.isArray(p.orders)?p.orders.map(function(x){return orderText_(x,'orders',120,true);}).sort():[];
  if(ops.length>30||new Set(ops).size!==ops.length)throw appError_('BILLING_SELECTION','Selecciona hasta 30 OP sin repetir.',400);
  var orderRows=listRows_('Ordenes_Pedido'),selected=ops.map(function(n){var o=mdUnique_(orderRows,'Numero_OP',n);if(!o||normalizeCode_(o.Sede)!==branch||!orderBranchReadable_(s,o.Sede))throw appError_('BILLING_SELECTION','Una OP no pertenece a la sede seleccionada.',409);return o;});
  var documents=Array.from(new Set(selected.map(function(o){return String(o.Cedula_NIT||'');})));if(documents.length>1)throw appError_('BILLING_SELECTION','Una factura solo puede agrupar OP del mismo cliente.',400);
  var client=selected.length?String(selected[0].Nombre_Cliente||''):orderText_(p.client,'client',250,true),notes=orderText_(p.notes,'notes',2000,false),id=orderRequestId_(context.requestId),fingerprint=sha256_(JSON.stringify([date,branch,prefix,number,cufe,amount,ops,client,notes])),lock=osOperationLock_();
  if(!lock.tryLock(5000))throw appError_('ORDER_SAVE_BUSY','Hay otro registro guardándose. Reintenta el mismo intento.',503);
  try{
    var replay=billingReplay_(id,s,fingerprint);if(replay){clearConfirmedOrderFence_();return {saved:true,result:replay};}assertNoUnresolvedOrderFence_();
    var existing=billingRows_();if(existing.some(function(r){return normalizeCode_(r.Estado)!=='ANULADA'&&((String(r.Prefijo).toUpperCase()===prefix&&String(r.Numero).toUpperCase()===number)||String(r.CUFE).toLowerCase()===cufe);}))throw appError_('BILLING_DUPLICATE','La factura o su CUFE ya están registrados.',409);
    var used={};existing.filter(function(r){return normalizeCode_(r.Estado)!=='ANULADA';}).forEach(function(r){billingOps_(r).forEach(function(n){used[n]=true;});});if(ops.some(function(n){return used[n];}))throw appError_('BILLING_SELECTION','Una OP ya está vinculada a otra factura.',409);
    billingSheet_(true);var stamp=now_().toISOString(),invoice={id:id,date:date,branch:branch,prefix:prefix,number:number,cufe:cufe,amount:amount,status:'FIRMADA',orders:ops,client:client,notes:notes,source:'MANUAL_FACTURATECH',registeredAt:stamp},result={requestId:id,invoice:invoice};
    var row={Factura_ID:id,Fecha_Emision:date,Sede:branch,Prefijo:prefix,Numero:number,CUFE:cufe,Valor_Total:amount,Estado:'FIRMADA',OPs_JSON:JSON.stringify(ops),Cliente:client,Notas:notes,Fuente:'MANUAL_FACTURATECH',Registrado_Por:s.profile.uid,Fecha_Registro:stamp,Request_ID:id};
    var requests=[orderAppendRequest_('Facturacion_Electronica',[row]),orderAppendRequest_('Auditoria',[{ID:id+'-AUD',Fecha:stamp,Usuario:s.profile.uid,Rol:s.profile.role,Modulo:'FACTURACION',Accion:'REGISTRAR_FACTURA_FIRMADA',Entidad:'FACTURA_ELECTRONICA',Entidad_ID:prefix+'-'+number,Resumen:'Factura firmada registrada por control manual',Estado:'CONFIRMADA',Request_ID:id,Despues_JSON:JSON.stringify(row),Reversible:'NO',Motivo_No_Reversible:'La factura tributaria se administra en FacturaTech.'}]),orderAppendRequest_('Idempotencia',[{Request_ID:id,Fecha:stamp,Tipo_Operacion:'FACTURACION_REGISTRAR',Entidad:'FACTURA_ELECTRONICA',Entidad_ID:prefix+'-'+number,Estado:'CONFIRMADA',Resultado_JSON:JSON.stringify({fingerprint:fingerprint,result:result}),Usuario:s.profile.uid}])];
    SpreadsheetApp.flush();reserveOrderFence_(id,s.profile.uid,fingerprint,'FACTURACION_REGISTRAR');try{orderAtomicBatch_(requests);}catch(e){throw appError_('BILLING_SAVE_UNCERTAIN','Falta confirmar el registro. Consulta el mismo intento antes de repetir.',503);}clearConfirmedOrderFence_();return {saved:true,result:result};
  }finally{lock.releaseLock();}
}
