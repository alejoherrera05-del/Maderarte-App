import { APP_CONFIG } from './config.js';

const SYSTEM_NAME = String(APP_CONFIG.name || 'Maddy').trim() || 'Maddy';
const COMPANY_NAME = 'Maderarte';

function applyModuleIdentity() {
  const moduleBrand = document.querySelector('.module-brand');
  if (moduleBrand) moduleBrand.setAttribute('aria-label', `${SYSTEM_NAME} · ${COMPANY_NAME}`);

  const moduleLabel = document.querySelector('.module-brand-section')?.textContent?.trim() || '';
  document.querySelectorAll('.module-footer-copy').forEach(copy => {
    const name = copy.querySelector('strong');
    const detail = copy.querySelector('span');
    if (name) name.textContent = SYSTEM_NAME;
    if (detail) detail.textContent = moduleLabel ? `${moduleLabel} · ${COMPANY_NAME}` : `Sistema ${COMPANY_NAME}`;
  });

  if (document.title.includes('Maderarte App')) {
    document.title = document.title.replace('Maderarte App', SYSTEM_NAME);
  }
}

applyModuleIdentity();

const observer = new MutationObserver(() => applyModuleIdentity());
observer.observe(document.documentElement, { childList: true, subtree: true });
