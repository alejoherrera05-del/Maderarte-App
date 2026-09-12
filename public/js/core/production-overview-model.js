export const productionStages = [
  ['ALL','Todos'],['PENDING','Por solicitar'],['SEPARADO','Separados'],
  ['SOLICITADO','Esperando confirmación'],['CONFIRMADO','Confirmados'],
  ['FABRICACION','En fabricación'],['LISTO','Listos en fábrica'],
  ['TRANSPORTE','En transporte'],['BODEGA','En bodega'],['REVIEW','Por revisar']
];
const sequence=['SOLICITADO','CONFIRMADO','FABRICACION','LISTO','TRANSPORTE','BODEGA'];
export const normalizeSearch=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

// Stage counters describe cumulative milestones, not separate physical units.
// Subtract the largest later milestone; never sum those milestones together.
export function productionBuckets(item) {
  const n=item.quantity, delivered=item.delivered, cancelled=item.cancelled, pending=item.pending;
  if(![n,delivered,cancelled,pending].every(Number.isSafeInteger)||n<1||delivered<0||cancelled<0||pending<0||pending!==n-delivered-cancelled||item.issue||item.tracking?.legacy||(cancelled>0&&!item.adjustmentVerified)) return [{stage:'REVIEW',quantity:Math.max(0,pending||0)}];
  if(!pending)return [];
  if(item.fulfillment==='DISPONIBLE')return [{stage:item.agreement==='SEPARADO'?'SEPARADO':'BODEGA',quantity:pending}];
  if(item.fulfillment!=='PARA_SOLICITAR'||!item.tracking)return [{stage:'REVIEW',quantity:pending}];
  const totals=sequence.map(s=>item.tracking.totals?.[s]??0);
  if(totals.some(v=>!Number.isSafeInteger(v)||v<0||v>n-cancelled))return [{stage:'REVIEW',quantity:pending}];
  const buckets=[];let covered=delivered;
  for(let i=sequence.length-1;i>=0;i--){const quantity=Math.max(0,totals[i]-covered);if(quantity)buckets.unshift({stage:sequence[i],quantity});covered=Math.max(covered,totals[i]);}
  if(n-cancelled-covered>0)buckets.unshift({stage:item.agreement==='SEPARADO'?'SEPARADO':'PENDING',quantity:n-cancelled-covered});
  return buckets;
}

export function prepareProductionEntry(entry) {
  const events=entry.item.tracking?.events||[];
  return {...entry,buckets:productionBuckets(entry.item),providers:[...new Set(events.map(e=>e.provider?.trim()).filter(Boolean))],lastDate:events.map(e=>e.date||'').sort().pop()||''};
}
export function filterProduction(entries,{query='',stage='ALL',provider=''}={}) {
  const needle=normalizeSearch(query);
  return entries.filter(e=>(stage==='ALL'||e.buckets.some(b=>b.stage===stage))&&(!provider||e.providers.includes(provider))&&(!needle||normalizeSearch([e.order.number,e.order.client,e.order.document,e.item.description,...e.providers].join(' ')).includes(needle)));
}

export async function loadProductionOverview(request,onProgress=()=>{}) {
  const entries=new Map();let after='',enabled=false,total=0;
  do {
    const response=await request('PRODUCCION_LISTAR',{after,limit:200}),data=response.data;
    if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total))throw new Error('La consulta de producción está incompleta. Vuelve a actualizar.');
    for(const entry of data.items){if(!entry.key||!entry.order?.number||!entry.item?.id)throw new Error('Faltan datos de un mueble. Vuelve a actualizar.');entries.set(entry.key,prepareProductionEntry(entry));}
    enabled=Boolean(data.productionTrackingEnabled);total=data.total;
    if(data.next&&(!data.items.length||data.next<=after))throw new Error('No se pudo continuar la consulta. Vuelve a actualizar.');
    after=data.next||'';onProgress(entries.size);
  }while(after);
  if(entries.size!==total)throw new Error('Los pedidos cambiaron durante la consulta. Actualiza para ver el listado completo.');
  return {entries:[...entries.values()],enabled};
}


