import { safeExternalUrl } from './format.js';

export function documentSources(value, appOrigin = window.location.origin) {
  const external = safeExternalUrl(value);
  if (!external) return { external: '', preview: '' };
  const url = new URL(external);
  if (url.username || url.password) return { external: '', preview: '' };
  if (url.origin === appOrigin) return { external, preview: external };
  if (url.origin !== 'https://drive.google.com') return { external, preview: '' };
  const pathId = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
  const queryId = ['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : '';
  const id = pathId || queryId;
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return { external, preview: '' };
  const preview = new URL(`/file/d/${id}/preview`, url.origin);
  // Resource keys may be necessary even when Drive permissions are correct.
  const resourceKey = url.searchParams.get('resourcekey');
  if (resourceKey) preview.searchParams.set('resourcekey', resourceKey);
  return { external, preview: preview.href };
}
