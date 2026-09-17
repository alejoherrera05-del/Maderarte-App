const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));

function ensure(){
  let node=document.getElementById('np-operation-feedback');
  if(node)return node;
  node=document.createElement('dialog');
  node.id='np-operation-feedback';
  node.className='np-operation-feedback';
  node.setAttribute('aria-labelledby','np-operation-title');
  node.addEventListener('cancel',event=>event.preventDefault());
  node.innerHTML=`<div class="np-operation-card" role="status" aria-live="polite" aria-atomic="true">
    <div class="np-operation-mark" aria-hidden="true"><span class="np-operation-spinner"></span><span class="np-operation-check">✓</span></div>
    <strong class="np-operation-title" id="np-operation-title"></strong>
    <p class="np-operation-detail"></p>
  </div>`;
  document.body.append(node);
  return node;
}

function open(node){
  if(node.open)return;
  if(typeof node.showModal==='function')node.showModal();
  else node.setAttribute('open','');
}

export function showPayrollProgress(root,{title,detail=''}) {
  const node=ensure();
  node.dataset.state='working';
  node.querySelector('.np-operation-title').textContent=title;
  node.querySelector('.np-operation-detail').textContent=detail;
  open(node);
  requestAnimationFrame(()=>node.classList.add('is-visible'));
  return node;
}

export function hidePayrollFeedback(root){
  const node=document.getElementById('np-operation-feedback');
  if(!node)return;
  node.classList.remove('is-visible');
  if(typeof node.close==='function'&&node.open)node.close();
  else node.removeAttribute('open');
}

export async function showPayrollSuccess(root,{title,detail='',holdMs=520}){
  const node=ensure();
  node.dataset.state='success';
  node.querySelector('.np-operation-title').textContent=title;
  node.querySelector('.np-operation-detail').textContent=detail;
  open(node);
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
