import { APP_CONFIG } from '../core/config.js';
import { getDeviceMetadata } from '../core/session.js';
import { escapeHtml, dateTime } from '../core/format.js';
import { guardPage } from '../core/page-guard.js';
import { bindLogout } from '../core/shell.js';

function keyValue(label, value) {
  return `<div class="key-value"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || '—'))}</strong></div>`;
}

guardPage({
  permission: 'perfil.read',
  activeKey: 'perfil',
  title: 'Mi perfil',
  subtitle: 'Cuenta, permisos y dispositivo actual.',
  async render({ session, content }) {
    const device = getDeviceMetadata();
    content.innerHTML = `<section class="page"><div class="page-header"><div class="page-heading"><h1>${escapeHtml(session.profile.name || 'Mi cuenta')}</h1><p>La identidad proviene de Firebase; el rol y los permisos pertenecen exclusivamente a Maderarte.</p></div><div class="page-actions"><button class="button secondary" id="logout-button" type="button">Cerrar sesión</button></div></div>
      ${session.offline ? '<div class="inline-alert"><strong>!</strong><span>La app está mostrando el perfil guardado porque no pudo revalidar la sesión. Las operaciones permanecen bloqueadas.</span></div>' : ''}
      <div class="content-grid"><section class="card panel"><div class="panel-header"><h2>Cuenta Maderarte</h2></div><div class="key-value-grid">${keyValue('Nombre', session.profile.name)}${keyValue('Correo', session.profile.email)}${keyValue('Rol', session.profile.role)}${keyValue('Estado', session.profile.status)}${keyValue('Sede principal', session.profile.mainBranch)}${keyValue('Sedes permitidas', session.profile.branches.join(', '))}${keyValue('Vigencia de sesión', dateTime(session.expiresAt))}${keyValue('Versión de app', APP_CONFIG.version)}</div></section>
      <aside class="stack"><section class="card panel"><div class="panel-header"><h2>Este dispositivo</h2></div><div class="key-value-grid">${keyValue('Nombre', device.name)}${keyValue('Identificador', device.id)}${keyValue('Plataforma', device.platform)}${keyValue('Navegador', device.browser)}</div></section><section class="card panel"><div class="panel-header"><h2>Apariencia</h2></div><p>Usa el botón ◐ de la barra superior para alternar entre tema claro y oscuro.</p></section></aside></div></section>`;
    bindLogout();
  }
});
