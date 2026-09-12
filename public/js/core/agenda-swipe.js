// Direct manipulation for agenda rows. Mutations remain owned by the page.
export function attachAgendaSwipe(row, { enabled, remove, reduced = () => false }) {
  const front = row.querySelector('.ag-event-surface');
  const action = row.querySelector('[data-delete]');
  if (!front || !action) return () => {};
  let x = 0, velocity = 0, frame = 0, pointer = null, suppress = false, disposed = false;
  const paint = () => { front.style.transform = `translateX(${x}px)`; };
  const expose = open => {
    row.classList.toggle('ag-revealed', open);
    action.tabIndex = open ? 0 : -1;
    action.setAttribute('aria-hidden', String(!open));
  };
  function settle(target) {
    cancelAnimationFrame(frame);
    expose(target < 0);
    if (reduced()) { x = target; velocity = 0; paint(); return; }
    let last = performance.now();
    function tick(now) {
      if (disposed) return;
      const dt = Math.min((now - last) / 1000, .025); last = now;
      velocity += ((target - x) * 520 - velocity * 46) * dt;
      x += velocity * dt; paint();
      if (Math.abs(x - target) < .3 && Math.abs(velocity) < 3) { x = target; velocity = 0; paint(); frame = 0; }
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  function down(e) {
    if (!enabled() || pointer || e.isPrimary === false || !['touch', 'pen'].includes(e.pointerType) || e.clientX < 24 || e.target.closest('.ag-check')) return;
    cancelAnimationFrame(frame);
    pointer = { id:e.pointerId, startX:e.clientX, startY:e.clientY, origin:x, lastX:e.clientX, time:e.timeStamp, axis:'' };
    velocity = 0; suppress = false;
  }
  function move(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX-pointer.startX, dy = e.clientY-pointer.startY;
    if (!pointer.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx)) { pointer = null; settle(0); return; }
      pointer.axis = 'x'; front.setPointerCapture?.(e.pointerId); suppress = true;
    }
    const raw = pointer.origin + dx;
    x = raw > 0 ? raw / (1 + raw / 24) : Math.max(-row.getBoundingClientRect().width, raw);
    velocity = (e.clientX-pointer.lastX) / Math.max(1,e.timeStamp-pointer.time) * 1000;
    pointer.lastX=e.clientX; pointer.time=e.timeStamp;
    expose(x < -10); paint();
    row.classList.toggle('ag-delete-ready', -x > row.getBoundingClientRect().width * .65);
  }
  function end(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dragging=pointer.axis==='x'; pointer=null;
    if(front.hasPointerCapture?.(e.pointerId))front.releasePointerCapture(e.pointerId);
    row.classList.remove('ag-delete-ready');
    if (!dragging) { settle(0); return; }
    const width=row.getBoundingClientRect().width;
    if (-x > width*.65 && velocity <= 0 && enabled()) { settle(-88); remove(); }
    else settle(x + Math.max(-40,Math.min(40,velocity*.08)) < -44 ? -88 : 0);
  }
  function cancel() { pointer=null; row.classList.remove('ag-delete-ready'); settle(0); }
  function click(e) {
    if (suppress && e.detail !== 0) { e.preventDefault(); e.stopImmediatePropagation(); suppress=false; return; }
    if (x < -5) { e.preventDefault(); e.stopImmediatePropagation(); settle(0); }
  }
  function key(e) { if(e.key==='Escape') { settle(0); front.querySelector('[data-open]')?.focus(); } }
  front.addEventListener('pointerdown',down); front.addEventListener('pointermove',move);
  front.addEventListener('pointerup',end); front.addEventListener('pointercancel',cancel);
  front.addEventListener('click',click,true); row.addEventListener('keydown',key);
  expose(false);
  return () => { disposed=true; cancelAnimationFrame(frame); };
}
