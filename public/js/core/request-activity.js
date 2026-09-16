// Shared by every import of api.js, including callers with a version query.
let active = 0;
export function beginRequest() {
  active += 1;
  let finished = false;
  return () => { if (!finished) { finished = true; active -= 1; } };
}
export function hasActiveRequests() { return active > 0; }
