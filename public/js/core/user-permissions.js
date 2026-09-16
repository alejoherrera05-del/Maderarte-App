import {escapeHtml as esc} from './format.js';

export function permissionPicker(container,{groups,dependencies,selected,allowed=null}){
  const keys=groups.flatMap(g=>g.items.map(i=>i[0]));
  const values=new Set(selected.filter(p=>keys.includes(p)));
  container.innerHTML=groups.map(g=>`<fieldset class="access-group ${g.sensitive?'access-sensitive':''}"><legend>${esc(g.title)}</legend>${g.items.map(([key,label])=>`<label class="access-option"><span>${esc(label)}</span><input type="checkbox" data-access="${esc(key)}" ${values.has(key)?'checked':''} ${allowed&&!allowed.includes(key)?'disabled':''}></label>`).join('')}</fieldset>`).join('')+'<p class="team-hint" data-access-note role="status">Los permisos relacionados se ajustan juntos.</p>';
  function enable(key){for(const dep of dependencies[key]||[])enable(dep);values.add(key);}
  function disable(key){values.delete(key);for(const k of keys)if((dependencies[k]||[]).includes(key))disable(k);}
  container.querySelectorAll('[data-access]').forEach(input=>input.onchange=()=>{
    if(input.checked)enable(input.dataset.access);else disable(input.dataset.access);
    container.querySelectorAll('[data-access]').forEach(n=>n.checked=values.has(n.dataset.access));
    container.querySelector('[data-access-note]').textContent=values.has('app.access')?'Solo las casillas marcadas estarán autorizadas.':'Sin «Entrar a Maddy», esta persona no podrá acceder.';
  });
  return ()=>[...values].sort();
}

export function editUserAccess({user,team,session,openDialog,request,reload}){
  const allowed=session.permissions.includes('*')?null:session.permissions;
  const labels=Object.fromEntries(team.permissionGroups.flatMap(g=>g.items));
  const initial=user.permissions.includes('*')?Object.keys(labels):user.permissions;
  openDialog('Permisos de '+user.name,`<p class="team-hint">${esc(user.email)} · ${esc(user.branches.join(' · '))}</p><p class="access-intro">Autoriza lo que esta persona puede hacer.</p><div id="access-picker"></div><div id="access-review" hidden></div><p id="access-feedback" role="status"></p><div class="team-actions access-footer"><button type="button" class="cfg-submit" id="access-next">Revisar cambios</button></div>`);
  const $=id=>document.getElementById(id),read=permissionPicker($('access-picker'),{groups:team.permissionGroups,dependencies:team.permissionDependencies,selected:initial,allowed});
  $('access-next').onclick=()=>{
    const next=read(),added=next.filter(p=>!initial.includes(p)),removed=initial.filter(p=>!next.includes(p));
    if(!added.length&&!removed.length&&user.customAccess){$('access-feedback').textContent='No hay cambios para guardar.';return;}
    const list=a=>a.length?`<ul>${a.map(p=>`<li>${esc(labels[p]||p)}</li>`).join('')}</ul>`:'<p>Ninguno.</p>';
    $('access-review').innerHTML=`<h3>Confirmar accesos</h3><strong>Autorizar</strong>${list(added)}<strong>Retirar</strong>${list(removed)}<p class="team-hint">Se guardará una lista individual. Los cambios futuros del rol no ampliarán estos accesos.</p><div class="team-actions"><button class="cfg-copy-button" id="access-back">Editar</button><button class="cfg-submit" id="access-save">Guardar permisos</button></div>`;
    $('access-picker').hidden=true;$('access-next').hidden=true;$('access-review').hidden=false;
    $('access-back').onclick=()=>{$('access-review').hidden=true;$('access-picker').hidden=false;$('access-next').hidden=false;};
    $('access-save').onclick=async()=>{
      $('access-save').disabled=true;$('access-back').disabled=true;$('cfg-detail-close').disabled=true;$('access-feedback').textContent='Guardando permisos…';
      const dialog=document.getElementById('cfg-detail'),prevent=e=>e.preventDefault();dialog?.addEventListener('cancel',prevent);if(dialog)dialog.dataset.saving='true';
      try{await request('USUARIO_PERMISOS_GUARDAR',{email:user.email,permissions:next,revision:user.accessRevision});$('access-feedback').textContent='Permisos guardados. Se aplican en la siguiente solicitud.';await reload();$('access-save').textContent='Guardado';}
      catch(e){$('access-feedback').textContent=e.message+' Cierra y vuelve a abrir la ficha para comprobar el resultado.';}
      finally{$('cfg-detail-close').disabled=false;dialog?.removeEventListener('cancel',prevent);if(dialog)delete dialog.dataset.saving;}
    };
  };
}
