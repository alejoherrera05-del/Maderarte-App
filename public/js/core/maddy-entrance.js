// A cover only owns presentation; page controllers retain API and save state.
export function createEntrance({ cover, workflow, input, newSearch, onReturn }) {
  const update = () => cover.classList.toggle('is-searching', document.activeElement === input || Boolean(input.value.trim()));
  input.addEventListener('focus', update);
  input.addEventListener('input', update);
  input.addEventListener('blur', () => requestAnimationFrame(update));
  function open() {
    cover.hidden = true;
    workflow.hidden = false;
    input.blur();
    const heading = workflow.querySelector('h1,h2');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll:true }); }
    window.scrollTo({ top:0, behavior:'instant' });
  }
  function close() {
    workflow.hidden = true;
    cover.hidden = false;
    update();
    window.scrollTo({ top:0, behavior:'instant' });
  }
  newSearch?.addEventListener('click', () => { if (onReturn?.() !== false) { close(); input.focus(); } });
  return { open, close, update };
}
