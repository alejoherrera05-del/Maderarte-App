const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));

function ensure(root){
  let node=root?.querySelector('#np-operation-feedback');
  if(node)return node;
  node=document.createElement('div');
  node.id='np-operation-feedback';
  node.className='np-operation-feedback';
  node.hidden=true;
  node.setAttribute('role','status');
  node.setAttribute('aria-live','polite');
  node.setAttribute('aria-atomic','true');
  node.innerHTML=`<div class="np-operation-card">
    <div class="np-operation-mark" aria-hidden="true"><span class="np-operation-spinner"></span><span class="np-operation-check">✓</span></div>
    <strong class="np-operation-title"></strong>
    <p class="np-operation-detail"></p>
  </div>`;
  root.append(node);
  return node;
}

export function showPayrollProgress(root,{title,detail=''}) {
  const node=ensure(root);
  node.dataset.state='working';
  node.querySelector('.np-operation-title').textContent=title;
  node.querySelector('.np-operation-detail').textContent=detail;
  node.hidden=false;
  requestAnimationFrame(()=>node.classList.add('is-visible'));
  return node;
}

export function hidePayrollFeedback(root){
  const node=root?.querySelector('#np-operation-feedback');
  if(!node)return;
  node.classList.remove('is-visible');
  node.hidden=true;
}

export async function showPayrollSuccess(root,{title,detail='',holdMs=520}){
  const node=ensure(root);
  node.dataset.state='success';
  node.querySelector('.np-operation-title').textContent=title;
  node.querySelector('.np-operation-detail').textContent=detail;
  node.hidden=false;
  node.classList.add('is-visible');
  await wait(reducedMotion()?80:holdMs);
  hidePayrollFeedback(root);
}

const htmlEscape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function payrollLoadingPanel(title,detail='',compact=false){
  return `<div class="np-loading-panel${compact?' is-compact':''}" role="status" aria-live="polite">
    <span class="np-loading-ring" aria-hidden="true"></span>
    <strong>${htmlEscape(title)}</strong>
    ${detail?`<p>${htmlEscape(detail)}</p>`:''}
  </div>`;
}
