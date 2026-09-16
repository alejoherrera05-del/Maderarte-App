// Page lifecycle checks complement server authorization; they never grant access.
export function accessFingerprint(session) {
  const p=session?.profile||{};
  return JSON.stringify([p.uid,p.role,p.status,p.mainBranch,[...(p.branches||[])].sort(),[...(session?.permissions||[])].sort()]);
}

export function watchAccess({session,validate,onChanged,onDenied,target=window,doc=document,now=Date.now,intervalMs=60_000}) {
  const original=accessFingerprint(session);
  let pending=false,stopped=false,last=Number(session.validatedAt||0);
  async function check(force=false) {
    if(stopped||pending||doc.visibilityState==='hidden'||(!force&&now()-last<intervalMs))return;
    pending=true;last=now();
    try {
      const fresh=await validate();
      if(stopped||fresh?.offline)return;
      if(accessFingerprint(fresh)!==original){stop();onChanged(fresh);}
    } catch(error) {
      if(!stopped&&!error?.transient){stop();onDenied(error);}
    } finally {pending=false;}
  }
  const resume=()=>void check(),restored=e=>void check(Boolean(e.persisted));
  const rejected=()=>void check(true);
  const timer=target.setInterval(resume,intervalMs);
  target.addEventListener('focus',resume);target.addEventListener('pageshow',restored);doc.addEventListener('visibilitychange',resume);
  target.addEventListener('maddy:access-recheck',rejected);
  function stop(){stopped=true;target.clearInterval(timer);target.removeEventListener('focus',resume);target.removeEventListener('pageshow',restored);doc.removeEventListener('visibilitychange',resume);target.removeEventListener('maddy:access-recheck',rejected);}
  if(session.needsRevalidation)void check(true);
  return stop;
}
