const currentUrl = new URL(window.location.href);
const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(currentUrl.hostname);

export const APP_CONFIG = Object.freeze({
  name: 'Maderarte App',
  version: '0.2.0',
  environment: 'preparacion',
  apiPath: '/api/maderarte',
  requestTimeoutMs: 18_000,
  sessionCacheKey: 'MADERARTE_APP_SESSION_SNAPSHOT_V1',
  deviceIdKey: 'MADERARTE_APP_DEVICE_ID_V1',
  themeKey: 'MADERARTE_APP_THEME_V1',
  loginPath: '/login.html',
  homePath: '/index.html',
  activationPath: '/activar-cuenta.html',
  preview: Object.freeze({
    enabled: isLocalHost && currentUrl.searchParams.get('preview') === '1',
    localOnly: true
  }),
  firebase: Object.freeze({
    apiKey: 'AIzaSyCc-kiqZ3WxpulA_fKEgNuSNLI2ofCL7eY',
    projectId: 'homeeasy-auth'
  })
});

export function withPreview(path) {
  if (!APP_CONFIG.preview.enabled) return path;
  const url = new URL(path, window.location.origin);
  url.searchParams.set('preview', '1');
  return `${url.pathname}${url.search}${url.hash}`;
}
