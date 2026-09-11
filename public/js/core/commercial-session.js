export function waitForCommercialSession(read, target) {
  const current = read();
  if (current?.profile?.uid) return Promise.resolve(current);
  return new Promise(resolve => {
    const ready = () => {
      const session = read();
      if (!session?.profile?.uid) return;
      target.removeEventListener('maddy:commercial-ready', ready);
      resolve(session);
    };
    target.addEventListener('maddy:commercial-ready', ready);
    ready();
  });
}
