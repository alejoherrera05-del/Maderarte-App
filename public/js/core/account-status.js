import {escapeHtml as esc} from './format.js';

export function editAccountStatus({user,openDialog,request,reload}) {
  const active=user.status==='ACTIVO',label=active?'Desactivar cuenta':'Reactivar cuenta';
  openDialog(label,`<p class="access-intro">${esc(user.name)}</p><p class="team-email">${esc(user.email)}</p><div class="account-impact"><strong>${active?'Se cerrará su acceso a Maddy':'Podrá volver a iniciar sesión'}</strong><p>${active?'Sus sesiones quedarán cerradas y no podrá ingresar. Sus ventas, abonos y demás registros se conservarán.':'Conservará las mismas casillas de permisos y sedes. Tendrá que iniciar sesión de nuevo.'}</p></div><p class="team-hint">${active?'Las invitaciones pendientes para esta cuenta también se cancelarán.':'Si necesita otros permisos, edítalos en su ficha.'}</p><div class="team-actions"><button class="cfg-copy-button" id="account-cancel">Cancelar</button><button class="cfg-submit ${active?'account-danger':''}" id="account-confirm">${label}</button></div><p id="account-feedback" role="status"></p>`);
  const $=id=>document.getElementById(id),dialog=$('cfg-detail');
  $('account-cancel').onclick=()=>dialog.close();
  $('account-confirm').onclick=async()=>{
    const prevent=e=>e.preventDefault();
    dialog.dataset.saving='true';dialog.addEventListener('cancel',prevent);
    $('account-confirm').disabled=true;$('account-cancel').disabled=true;$('cfg-detail-close').disabled=true;
    $('account-feedback').textContent='Guardando cambio…';
    try {
      await request('USUARIO_ESTADO_GUARDAR',{email:user.email,status:active?'INACTIVO':'ACTIVO',revision:user.accessRevision});
      $('account-feedback').textContent=active?'Cuenta desactivada. Su historial se conserva.':'Cuenta reactivada. Ya puede iniciar sesión.';
      $('account-confirm').textContent='Guardado';await reload();
    } catch(error) {
      $('account-feedback').textContent=error.message+' Cierra y abre su ficha para comprobar el estado antes de reintentar.';
    } finally {
      delete dialog.dataset.saving;dialog.removeEventListener('cancel',prevent);$('cfg-detail-close').disabled=false;
    }
  };
}
