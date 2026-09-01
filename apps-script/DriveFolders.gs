var MONTH_NAMES_ = ['01_Enero', '02_Febrero', '03_Marzo', '04_Abril', '05_Mayo', '06_Junio', '07_Julio', '08_Agosto', '09_Septiembre', '10_Octubre', '11_Noviembre', '12_Diciembre'];

function sanitizeFolderName_(value) {
  return String(value || '').trim().replace(/[\\/:*?"<>|#%{}~&]/g, ' ').replace(/\s+/g, ' ').slice(0, 120) || 'SIN_NOMBRE';
}

function getOrCreateFolder_(parent, name) {
  var iterator = parent.getFoldersByName(name);
  return iterator.hasNext() ? iterator.next() : parent.createFolder(name);
}

function ensureOrderFolders_(dateValue, clientDocument, clientName, orderNumber) {
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue || now_());
  if (isNaN(date.getTime())) date = now_();
  var root = getDocumentsRoot_();
  var yearFolder = getOrCreateFolder_(root, String(date.getFullYear()));
  var monthFolder = getOrCreateFolder_(yearFolder, MONTH_NAMES_[date.getMonth()]);
  var clientFolderName = sanitizeFolderName_(clientDocument) + ' - ' + sanitizeFolderName_(clientName).toUpperCase();
  var clientFolder = getOrCreateFolder_(monthFolder, clientFolderName);
  getOrCreateFolder_(clientFolder, '00_COTIZACIONES');
  var orderFolder = getOrCreateFolder_(clientFolder, sanitizeFolderName_(orderNumber));
  return {
    clientFolder: clientFolder,
    orderFolder: orderFolder,
    orderDocuments: getOrCreateFolder_(orderFolder, '01_ORDEN_DE_PEDIDO'),
    payments: getOrCreateFolder_(orderFolder, '02_RECIBOS_Y_ABONOS'),
    remissions: getOrCreateFolder_(orderFolder, '03_REMISIONES'),
    supports: getOrCreateFolder_(orderFolder, '04_SOPORTES')
  };
}
