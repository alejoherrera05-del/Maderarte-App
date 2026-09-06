// The identification field is both the search entry and the client's document.
// All data stays in the current form; persistence belongs to the commercial API.
export function bindClientLookup({ input, list, message, fields, search, load, onSelect = () => {}, delay = 220 }) {
  const doc = input.ownerDocument;
  const view = doc.defaultView;
  const wrap = input.closest('.quote-client-lookup');
  let timer = 0;
  let revision = 0;
  let options = [];
  let active = -1;
  let selectedDocument = '';
  const filled = new Map();
  const documentKey = value => String(value || '').trim().toUpperCase().replace(/[.\s-]/g, '');

  function say(text = '', error = false) {
    message.textContent = text;
    message.classList.toggle('is-error', error);
  }

  function hide() {
    list.hidden = true;
    list.replaceChildren();
    options = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function cancel() {
    revision += 1;
    view.clearTimeout(timer);
    if (input.getAttribute('aria-busy') === 'true') say();
    input.setAttribute('aria-busy', 'false');
    hide();
  }

  function clearPreviousClient() {
    if (!selectedDocument || documentKey(input.value) === selectedDocument) return;
    for (const [key, value] of filled) {
      if (fields[key].value === value) fields[key].value = '';
    }
    filled.clear();
    selectedDocument = '';
  }

  async function select(client, explicit = false) {
    if (explicit) {
      input.value = String(client.document || '');
      clearPreviousClient();
      input.focus({ preventScroll: true });
    }
    cancel();
    const token = revision;
    const query = input.value.trim();
    input.setAttribute('aria-busy', 'true');
    say('Completando los datos del cliente…');
    try {
      const full = await load(String(client.document));
      if (token !== revision || query !== input.value.trim()) return;
      if (!full || documentKey(full.document) !== documentKey(client.document)) {
        throw new Error('No se pudieron cargar los datos del cliente. Vuelve a consultar la cédula.');
      }
      input.value = String(full.document);
      selectedDocument = documentKey(full.document);
      filled.clear();
      for (const [key, field] of Object.entries(fields)) {
        field.value = String(full[key] || '');
        filled.set(key, field.value);
      }
      say('Cliente encontrado. Sus datos están completos en el formulario.');
      onSelect();
    } catch (error) {
      if (token === revision) say(error.message || 'No fue posible cargar el cliente.', true);
    } finally {
      if (token === revision) input.setAttribute('aria-busy', 'false');
    }
  }

  function highlight(index) {
    active = index;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    const option = list.children[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView?.({ block: 'nearest' });
    }
  }

  function render(items) {
    hide();
    options = items;
    items.forEach((client, index) => {
      const option = doc.createElement('button');
      option.type = 'button';
      option.className = 'quote-client-option';
      option.id = `${list.id}-${index}`;
      option.tabIndex = -1;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const copy = doc.createElement('span');
      copy.className = 'quote-client-option-copy';
      const number = doc.createElement('strong');
      number.textContent = String(client.document || '');
      const name = doc.createElement('span');
      name.textContent = String(client.name || 'Sin nombre');
      copy.append(number, name);
      const arrow = doc.createElement('span');
      arrow.textContent = '›';
      arrow.setAttribute('aria-hidden', 'true');
      option.append(copy, arrow);
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => { void select(client, true); });
      list.append(option);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  async function lookup(query, token) {
    input.setAttribute('aria-busy', 'true');
    say('Buscando coincidencias…');
    try {
      const response = await search(query);
      if (token !== revision || query !== input.value.trim()) return;
      const items = Array.isArray(response) ? response : [];
      const exact = items.find(item => documentKey(item.document) === documentKey(query));
      if (exact) {
        await select(exact);
        return;
      }
      if (items.length) {
        render(items);
        say('Selecciona un cliente o continúa escribiendo la cédula.');
      } else {
        hide();
        say('Sin coincidencias. Continúa con los datos del cliente.');
      }
    } catch (error) {
      if (token === revision) {
        hide();
        say(error.message || 'No fue posible consultar clientes. Intenta nuevamente.', true);
      }
    } finally {
      if (token === revision) input.setAttribute('aria-busy', 'false');
    }
  }

  function schedule() {
    cancel();
    clearPreviousClient();
    say();
    const query = input.value.trim();
    if (query.length < 2 || selectedDocument === documentKey(query)) return;
    const token = revision;
    timer = view.setTimeout(() => { void lookup(query, token); }, delay);
  }

  input.addEventListener('input', schedule);
  input.addEventListener('focus', schedule);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancel(); return; }
    if (list.hidden || !options.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      highlight(active < 0 ? (direction > 0 ? 0 : options.length - 1) : (active + direction + options.length) % options.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      void select(options[active], true);
    }
  });
  wrap.addEventListener('focusout', event => {
    if (!wrap.contains(event.relatedTarget)) cancel();
  });
  doc.addEventListener('click', event => { if (!event.composedPath().includes(wrap)) cancel(); });
  for (const [key, field] of Object.entries(fields)) {
    field.addEventListener('input', () => {
      filled.delete(key);
      cancel();
    });
  }
}
