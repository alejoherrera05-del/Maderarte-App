export function hasPermission(session, permission) {
  if (!permission) return true;
  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;
  const [scope] = String(permission).split('.');
  return permissions.includes(`${scope}.*`);
}

export function canAccessPage(session, requiredPermission) {
  return Boolean(session?.profile?.uid) && hasPermission(session, requiredPermission);
}

export function filterByPermission(elements, session) {
  for (const element of elements) {
    const permission = element.dataset.permission;
    element.hidden = Boolean(permission) && !hasPermission(session, permission);
  }
}
