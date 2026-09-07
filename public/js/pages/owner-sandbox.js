import { guardStandalonePage } from '../core/page-guard.js';
import { apiRequest } from '../core/api.js?v=sandbox-1';
import { SANDBOX_ID, sandboxLink } from '../core/order-sandbox-context.js';

guardStandalonePage({ permission:'config.read', async render({session}) {
  const root=document.getElementById('owner-sandbox'),message=document.getElementById('sandbox-message'),facts=document.getElementById('sandbox-facts'),actions=document.getElementById('sandbox-actions');
  const cleanup=document.getElementById('sandbox-cleanup'),confirmation=document.getElementById('sandbox-confirmation'),clean=document.getElementById('sandbox-clean');
  root.hidden=false;
  if(session.profile.role!=='PROPIETARIO'){message.textContent='Solo la cuenta propietaria puede utilizar este ensayo.';return;}
  let state=null,busy=false;
  const fact=(name,value)=>{const box=document.createElement('div'),label=document.createElement('span'),text=document.createElement('strong');label.textContent=name;text.textContent=String(value);box.append(label,text);facts.append(box);};
  const action=(label,handler,primary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(primary)b.className='os-primary';b.addEventListener('click',handler);actions.append(b);return b;};
  const link=(label,path,external=false)=>{const a=document.createElement('a');a.textContent=label;a.href=path;if(external){a.target='_blank';a.rel='noopener noreferrer';}actions.append(a);};
  function render(s) {
    if(!s?.available || s.id && !SANDBOX_ID.test(s.id))throw new Error('El servidor no confirmó el ensayo.');
    state=s;facts.replaceChildren();actions.replaceChildren();cleanup.hidden=true;
    const labels={SIN_PRUEBA:'Todavía no hay un ensayo. Preparar el espacio no crea una orden.',PREPARANDO:'La preparación no terminó. Retoma el mismo espacio; no se creará otra hoja a ciegas.',ACTIVA:'El espacio está listo. Usa únicamente el pedido y el cliente ficticios de esta prueba.',LIMPIANDO:'La prueba está cerrada para nuevos guardados. Falta confirmar su limpieza.',CERRADA:'Limpieza confirmada. La hoja y los archivos del ensayo están en la papelera; la operación original no se modificó.'};
    message.textContent=labels[s.state]||'Estado no reconocido. No continúes.';
    fact('Estado',s.state);fact('Ventas normales','Deshabilitadas');
    if(s.number)fact('Orden de prueba',s.number);
    if(s.counts){fact('Muebles / pagos ficticios',`${s.counts.items} / ${s.counts.payments}`);fact('Documentación',s.documentStatus||'Sin pedido');}
    if(['SIN_PRUEBA','CERRADA','PREPARANDO'].includes(s.state))action(s.state==='PREPARANDO'?'Retomar preparación':'Preparar espacio de prueba',()=>run('PRUEBA_INICIAR',{confirm:'CREAR PRUEBA AISLADA'}),true);
    if(s.state==='ACTIVA') {
      link(s.number?'Reabrir la orden de prueba':'Abrir formulario de prueba',sandboxLink(s.number?`/orden.html?op=${encodeURIComponent(s.number)}`:'/pedido.html',s.id));
      for(const [label,value,host] of [['Ver hoja de prueba',s.sheetUrl,'docs.google.com'],['Ver carpeta de prueba',s.folderUrl,'drive.google.com']]){
        const u=new URL(value);if(u.protocol==='https:'&&u.hostname===host)link(label,u.href,true);
      }
      if(s.number&&s.documentStatus!=='COMPLETO')link('Recuperar el intento del formulario',sandboxLink('/pedido.html',s.id));
      if(s.canClean)action('Finalizar y limpiar prueba',showCleanup);
    }
    if(s.state==='LIMPIANDO')action('Retomar limpieza',showCleanup);
    action('Actualizar estado',()=>run('PRUEBA_ESTADO'));
  }
  function showCleanup(){cleanup.hidden=false;confirmation.value='';document.getElementById('sandbox-confirmation-text').textContent='LIMPIAR '+state.id;clean.disabled=true;cleanup.scrollIntoView({behavior:'smooth',block:'center'});confirmation.focus({preventScroll:true});}
  async function run(name,payload={}) {
    if(busy)return;busy=true;
    root.querySelectorAll('button').forEach(b=>{b.disabled=true;});
    message.textContent=name==='PRUEBA_INICIAR'?'Preparando la hoja y las carpetas aisladas…':name==='PRUEBA_LIMPIAR'?'Retirando únicamente los archivos de esta prueba y comprobando la papelera…':'Consultando el estado…';
    try {
      const {data}=await apiRequest(name,payload,{timeoutMs:180000});
      if(name==='PRUEBA_LIMPIAR'&&data.cleanupConfirmed===true&&data.id===state?.id){
        const key='maderarte.order-save.v1.'+encodeURIComponent(session.profile.uid)+'.'+data.id;
        try {
          window.localStorage.removeItem(key);window.sessionStorage.removeItem(key);
          window.sessionStorage.removeItem('maderarte.form-draft.v1.'+session.profile.uid+'.order:'+data.id);
        } catch { /* Server cleanup is confirmed; stale keys cannot reopen it. */ }
      }
      render(data);
    } catch(error) {
      message.textContent=error.code==='ACTION_NOT_FOUND'?'Falta actualizar y publicar el Cerebro del modo de prueba. No cambies las banderas de ventas.':error.message;
      actions.replaceChildren();action('Consultar el mismo ensayo',()=>run('PRUEBA_ESTADO'));
    } finally {busy=false;root.querySelectorAll('button').forEach(b=>{b.disabled=false;});clean.disabled=confirmation.value!=='LIMPIAR '+state?.id;}
  }
  confirmation.addEventListener('input',()=>{clean.disabled=busy||confirmation.value!=='LIMPIAR '+state?.id;});
  clean.addEventListener('click',()=>{if(!clean.disabled)void run('PRUEBA_LIMPIAR',{id:state.id,confirm:confirmation.value});});
  document.getElementById('sandbox-cancel').addEventListener('click',()=>{cleanup.hidden=true;});
  await run('PRUEBA_ESTADO');
} });
