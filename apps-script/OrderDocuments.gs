// Order money is committed once. This module only completes its documentary
// dossier. Every endpoint revalidates identity and the order's branch/owner.
function orderCanReadBranch_(session, branch) {
  return session.permissions.indexOf('*') >= 0 || (Array.isArray(session.profile.branches) && session.profile.branches.indexOf(branch) >= 0);
}
function orderDocumentAccess_(row, session, write) {
  requirePermission_(session, 'ordenes.read');
  if (!row || !orderCanReadBranch_(session, row.Sede)) throw appError_('ORDER_NOT_AVAILABLE', 'No tienes acceso a esta orden.', 403);
  if (write) {
    requirePermission_(session, 'ordenes.create');
    if (['CONFIRMADA', 'EN_PROCESO'].indexOf(row.Estado) < 0) orderDocumentError_('ORDER_NOT_ACTIVE', 'La orden no está activa.');
    if (row.Creado_Por !== session.profile.uid && session.permissions.indexOf('*') < 0 && session.permissions.indexOf('ordenes.update') < 0) throw appError_('PERMISSION_DENIED', 'Solo el responsable o un administrador puede completar estos archivos.', 403);
  }
}
function orderDocumentLocked_(payload, context, write, work) {
  var number = orderText_(payload && payload.number, 'number', 100, true);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) orderDocumentError_('DOCUMENT_BUSY', 'Hay otra actualización en curso. Consulta de nuevo.');
  try {
    var session = validateOrderSession_(context.sessionToken, false);
    var row = findRow_('Ordenes_Pedido', 'Numero_OP', number);
    orderDocumentAccess_(row, session, write);
    if (optionalProperty_('ORDER_SCHEMA_VERSION', '1') !== '3') orderDocumentError_('DOCUMENT_SCHEMA_NOT_READY', 'Falta preparar el archivo documental en el Cerebro.');
    if (write) {
      if (!orderOperationsAllowed_()) throw appError_('COMMERCIAL_WRITES_DISABLED', 'La operación está en preparación.', 403);
      orderDocumentFenceCheck_();
    }
    return work(row, session);
  } finally { lock.releaseLock(); }
}
function orderPhotoPlan_(row) {
  var items = parseJson_(row.Items_JSON, null);
  if (!Array.isArray(items)) orderDocumentError_('DOCUMENT_INTEGRITY', 'No se pudo recuperar el detalle original del pedido.');
  var result = [];
  items.forEach(function(item) {
    (item.photos || []).forEach(function(photo, index) {
      result.push({ key: 'P-' + sha256_(row.Numero_OP + ':' + item.id + ':' + photo.id), itemId: item.id, position: index + 1, name: photo.name, mime: photo.mime, bytes: photo.bytes, sha256: photo.sha256 });
    });
  });
  return result;
}
function orderDocumentSnapshot_(row) {
  var initial = parseJson_(row.Items_JSON, []);
  var stored = orderItems_(row.Numero_OP);
  var items = stored.map(function(item) {
    var original = initial.filter(function(part) { return part.id === item.id; })[0];
    if (!original) orderDocumentError_('DOCUMENT_INTEGRITY', 'El mueble no corresponde al pedido confirmado.');
    return { id: item.id, position: item.position, description: item.description, category: item.category, quantity: item.quantity, unitValue: item.unitValue, subtotal: item.subtotal, fabric: item.fabricColor, wood: item.woodColor, specifications: item.specifications, agreement: item.agreement, fulfillment: item.fulfillment, discount: item.discount, net: item.net, photos: orderPhotoPlan_(row).filter(function(photo) { return photo.itemId === item.id; }) };
  });
  var payments = listRows_('Abonos').filter(function(payment) { return payment.Numero_OP === row.Numero_OP && payment.Request_ID === row.Request_ID && payment.Estado_Registro !== 'ANULADO'; }).map(function(payment) {
    return { number: String(payment.Numero_Recibo), date: valueDateIso_(payment.Fecha_Pago), amount: valueNumber_(payment.Valor_Abono), method: String(payment.Medio_Pago), reference: String(payment.Referencia || ''), comment: String(payment.Comentario || '') };
  });
  var snapshot = { template: ORDER_DOCUMENT_REVISION_, test: orderIsTrial_(), revision: valueNumber_(row.Version) || 1,
    number: String(row.Numero_OP), date: valueDateIso_(row.Fecha), branch: String(row.Sede), advisor: String(row.Responsable || ''),
    client: { document: String(row.Cedula_NIT), name: String(row.Nombre_Cliente), phone: String(row.Telefono), alternatePhone: String(row.Telefono_Alterno || ''), email: String(row.Email || ''), address: String(row.Direccion_Entrega || ''), city: String(row.Ciudad || '') },
    notes: String(row.Observaciones || ''), subtotal: valueNumber_(row.Subtotal), discount: valueNumber_(row.Descuento), total: valueNumber_(row.Valor_Total), paid: payments.reduce(function(sum, payment) { return sum + payment.amount; }, 0), items: items, payments: payments };
  return { snapshot: snapshot, hash: sha256_(JSON.stringify(snapshot)) };
}
function orderPublicArchive_(row) {
  return { key: row.Clave, itemId: row.Item_ID || '', type: row.Tipo, name: row.Nombre, mime: row.Mime, sha256: row.SHA256, bytes: Number(row.Bytes || 0), ready: row.Estado === 'LISTO', fileId: row.File_ID, url: row.Tipo === 'CARPETA' ? 'https://drive.google.com/drive/folders/' + row.File_ID : 'https://drive.google.com/file/d/' + row.File_ID + '/view' };
}
function orderDocumentState_(row) {
  var data = orderDocumentSnapshot_(row);
  var slots = orderArchiveRows_().filter(function(slot) { return slot.Numero_OP === row.Numero_OP && slot.Tipo !== 'CARPETA'; });
  return { complete: row.Estado_Documentos === 'COMPLETO', number: row.Numero_OP, documentStatus: row.Estado_Documentos || 'PENDIENTE', snapshot: data.snapshot, snapshotHash: data.hash, files: slots.map(orderPublicArchive_) };
}
function prepareOrderDocuments_(payload, context) {
  return orderDocumentLocked_(payload, context, true, function(row, session) {
    var folders = orderDocumentFolders_(row, session.profile.uid, { remaining: 2 });
    if (!folders) return { ready: false, complete: false, number: row.Numero_OP, message: 'Preparando las carpetas del pedido…' };
    var photos = orderPhotoPlan_(row);
    var missing = photos.filter(function(photo) { return !orderArchiveRow_(photo.key); });
    if (missing.length) {
      var ids = orderDriveNewIds_(missing.length);
      var values = missing.map(function(photo, index) {
        var extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[photo.mime];
        return { Clave: photo.key, Numero_OP: row.Numero_OP, Item_ID: photo.itemId, Tipo: 'FOTO', File_ID: ids[index], Parent_ID: folders.photos, Nombre: photo.itemId + '-R' + photo.position + '.' + extension, Mime: photo.mime, SHA256: photo.sha256, Bytes: photo.bytes, Estado: 'RESERVADO', Snapshot_SHA256: '', Version: 1, Usuario: session.profile.uid, Creado_En: now_().toISOString() };
      });
      orderDocumentBatch_([orderAppendRequest_(ORDER_ARCHIVE_SHEET_, values)], session.profile.uid, row.Numero_OP);
    }
    return Object.assign({ ready: true }, orderDocumentState_(row));
  });
}
function startOrderFile_(payload, context) {
  return orderDocumentLocked_(payload, context, true, function(row, session) {
    var slot;
    if (payload.photoKey) {
      if (!orderPhotoPlan_(row).some(function(photo) { return photo.key === payload.photoKey; })) orderDocumentError_('DOCUMENT_NOT_AVAILABLE', 'La referencia no pertenece a este mueble.');
      slot = orderArchiveRow_(payload.photoKey);
      if (!slot) orderDocumentError_('DOCUMENT_NOT_READY', 'Prepara primero las carpetas.');
    } else {
      var snapshot = orderDocumentSnapshot_(row);
      if (payload.snapshotHash !== snapshot.hash || payload.template !== ORDER_DOCUMENT_REVISION_) orderDocumentError_('DOCUMENT_SNAPSHOT_CHANGED', 'Los datos cambiaron. Recupera el documento antes de generarlo.');
      var receipt = payload.receipt || '';
      if (receipt && !snapshot.snapshot.payments.some(function(payment) { return payment.number === receipt; })) orderDocumentError_('DOCUMENT_NOT_AVAILABLE', 'El recibo no pertenece al pedido inicial.');
      if (typeof payload.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(payload.sha256) || !Number.isSafeInteger(payload.bytes) || payload.bytes < 100 || payload.bytes > ORDER_MAX_PDF_) orderDocumentError_('DOCUMENT_INPUT_INVALID', 'El PDF excede el límite o no tiene una huella válida.');
      if (orderPhotoPlan_(row).some(function(photo) { var file = orderArchiveRow_(photo.key); return !file || file.Estado !== 'LISTO'; })) orderDocumentError_('DOCUMENT_PHOTOS_PENDING', 'Primero hay que conservar todas las referencias fotográficas.');
      var parent = orderArchiveRow_('FS-' + row.Numero_OP + '-' + (receipt ? 'receipts' : 'pdf'));
      if (!parent || parent.Estado !== 'LISTO') orderDocumentError_('DOCUMENT_NOT_READY', 'Faltan las carpetas del pedido.');
      var key = 'D-' + sha256_(row.Numero_OP + ':' + snapshot.snapshot.revision + ':' + (receipt || 'OP'));
      slot = orderArchiveRow_(key);
      if (slot && slot.Estado === 'LISTO') return { done: true, offset: Number(slot.Bytes), file: orderPublicArchive_(slot) };
      if (slot && payload.restart === true && row.Estado_Documentos !== 'COMPLETO') {
        // Explicit user regeneration only. Old uploads target the old ID and
        // cannot overwrite the replacement or a completed document.
        var nextId = orderDriveNewIds_(1)[0];
        var patch = { File_ID: nextId, SHA256: payload.sha256, Bytes: payload.bytes, Snapshot_SHA256: snapshot.hash, Estado: 'RESERVADO' };
        var changes = orderUpdateRequests_(ORDER_ARCHIVE_SHEET_, slot._row, patch);
        changes.push(orderAppendRequest_('Auditoria', [{ ID: 'DR-' + Utilities.getUuid(), Fecha: now_().toISOString(), Usuario: session.profile.uid, Modulo: 'DOCUMENTOS', Accion: 'REGENERAR_PENDIENTE', Entidad_ID: row.Numero_OP, Antes_JSON: JSON.stringify({ fileId: slot.File_ID }), Despues_JSON: JSON.stringify({ fileId: nextId }), Resumen: 'Reemplazo explícito de carga documental no finalizada; sin movimientos de dinero.' }]));
        orderDocumentBatch_(changes, session.profile.uid, row.Numero_OP);
        getScriptProperties_().deleteProperty(orderUploadSessionKey_(slot));
        slot = orderArchiveRow_(key);
      } else slot = orderArchiveReserve_({ Clave: key, Numero_OP: row.Numero_OP, Item_ID: receipt, Tipo: receipt ? 'RECIBO' : 'OP', Parent_ID: parent.File_ID, Nombre: (receipt || row.Numero_OP) + '-v' + snapshot.snapshot.revision + '.pdf', Mime: 'application/pdf', SHA256: payload.sha256, Bytes: payload.bytes, Snapshot_SHA256: snapshot.hash, Version: snapshot.snapshot.revision, Usuario: session.profile.uid });
    }
    var status = orderUploadOpen_(slot);
    if (status.done) {
      if (!orderFileComplete_(orderDriveMeta_(slot.File_ID), slot)) orderDocumentError_('DOCUMENT_HASH_MISMATCH', 'La huella de Drive no coincide con la referencia.');
      slot = orderArchiveReady_(slot);
    }
    // Resumable session URLs are server credentials: never return them.
    return { done: status.done, offset: status.offset, file: orderPublicArchive_(slot), chunkBytes: ORDER_UPLOAD_CHUNK_ };
  });
}
function uploadOrderFilePart_(payload, context) {
  return orderDocumentLocked_(payload, context, true, function(row) {
    var slot = orderArchiveRow_(String(payload.key || ''));
    if (!slot || slot.Numero_OP !== row.Numero_OP || slot.Tipo === 'CARPETA') orderDocumentError_('DOCUMENT_NOT_AVAILABLE', 'El archivo no pertenece al pedido.');
    if (payload.sha256 !== slot.SHA256) orderDocumentError_('DOCUMENT_CONTENT_CONFLICT', 'El archivo cambió. No se mezclará con otra carga.');
    if (slot.Estado === 'LISTO') return { done: true, offset: Number(slot.Bytes) };
    return orderUploadBytes_(slot, payload.offset, payload.data);
  });
}
function readOrderFilePart_(payload, context) {
  return orderDocumentLocked_(payload, context, false, function(row) {
    var slot = orderArchiveRow_(String(payload.key || ''));
    if (!slot || slot.Numero_OP !== row.Numero_OP || slot.Estado !== 'LISTO' || slot.Tipo === 'CARPETA') orderDocumentError_('DOCUMENT_NOT_AVAILABLE', 'El archivo no está disponible.');
    var offset = payload.offset === undefined ? 0 : payload.offset;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= Number(slot.Bytes)) orderDocumentError_('DOCUMENT_INPUT_INVALID', 'Rango inválido.');
    var end = Math.min(Number(slot.Bytes), offset + ORDER_UPLOAD_CHUNK_) - 1;
    var response = orderDriveResponse_('drive/v3/files/' + slot.File_ID + '?alt=media', { headers: { Range: 'bytes=' + offset + '-' + end } });
    if (![200, 206].includes(response.getResponseCode())) orderDocumentError_('DRIVE_RETRY', 'No se pudo recuperar el archivo privado.');
    var bytes = response.getBlob().getBytes();
    if (bytes.length !== end - offset + 1) orderDocumentError_('DOCUMENT_INTEGRITY', 'Drive devolvió un rango distinto.');
    return { key: slot.Clave, data: Utilities.base64Encode(bytes), offset: offset, nextOffset: end + 1, size: Number(slot.Bytes), sha256: slot.SHA256, mime: slot.Mime, name: slot.Nombre };
  });
}
function finishOrderDocuments_(payload, context) {
  return orderDocumentLocked_(payload, context, true, function(row, session) {
    var state = orderDocumentState_(row);
    if (state.complete) return state;
    if (payload.snapshotHash !== state.snapshotHash) orderDocumentError_('DOCUMENT_SNAPSHOT_CHANGED', 'Recupera los datos confirmados antes de finalizar.');
    var all = orderArchiveRows_();
    var docs = all.filter(function(slot) { return slot.Numero_OP === row.Numero_OP && slot.Tipo !== 'CARPETA'; });
    var expected = orderPhotoPlan_(row).map(function(photo) { return photo.key; }).concat(['OP'].concat(state.snapshot.payments.map(function(payment) { return payment.number; })).map(function(type) { return 'D-' + sha256_(row.Numero_OP + ':' + state.snapshot.revision + ':' + type); }));
    var selected = expected.map(function(key) { return docs.filter(function(slot) { return slot.Clave === key; })[0]; });
    if (selected.some(function(slot) { return !slot || slot.Estado !== 'LISTO'; })) orderDocumentError_('DOCUMENTS_PENDING', 'Todavía faltan archivos del pedido. No se marcará completo.');
    selected.forEach(function(slot) {
      if (slot.Tipo !== 'FOTO' && slot.Snapshot_SHA256 !== state.snapshotHash) orderDocumentError_('DOCUMENT_SNAPSHOT_CHANGED', 'El PDF pertenece a otra revisión de los datos.');
      if (!orderFileComplete_(orderDriveMeta_(slot.File_ID), slot)) orderDocumentError_('DOCUMENT_HASH_MISMATCH', 'Un archivo de Drive no coincide con la versión registrada.');
    });
    var opFolder = orderArchiveRow_('FO-' + row.Numero_OP);
    var clientFolder = opFolder && opFolder.Parent_ID;
    if (!opFolder || !clientFolder) orderDocumentError_('DOCUMENTS_PENDING', 'Falta la carpeta del expediente.');
    var mainPdf = selected.filter(function(slot) { return slot.Tipo === 'OP'; })[0];
    var stamp = now_().toISOString();
    var url = function(id) { return 'https://drive.google.com/file/d/' + id + '/view'; };
    var changes = orderUpdateRequests_('Ordenes_Pedido', row._row, { URL_PDF_OP: url(mainPdf.File_ID), URL_Carpeta_Cliente: 'https://drive.google.com/drive/folders/' + clientFolder, URL_Carpeta_OP: 'https://drive.google.com/drive/folders/' + opFolder.File_ID, Estado_Documentos: 'COMPLETO', Actualizado_Por: session.profile.uid, Actualizado_En: stamp });
    var client = findRow_('Clientes', 'Cedula_NIT', row.Cedula_NIT);
    if (!client) orderDocumentError_('DOCUMENT_INTEGRITY', 'No se encuentra el cliente de la orden.');
    changes = changes.concat(orderUpdateRequests_('Clientes', client._row, { URL_Carpeta_Cliente: 'https://drive.google.com/drive/folders/' + clientFolder }));
    listRows_('Orden_Items').filter(function(item) { return item.Numero_OP === row.Numero_OP; }).forEach(function(item) {
      var first = orderPhotoPlan_(row).filter(function(photo) { return photo.itemId === item.Item_ID; })[0];
      if (first) changes = changes.concat(orderUpdateRequests_('Orden_Items', item._row, { URL_Foto: url(orderArchiveRow_(first.key).File_ID) }));
    });
    listRows_('Abonos').filter(function(payment) { return payment.Numero_OP === row.Numero_OP && payment.Request_ID === row.Request_ID; }).forEach(function(payment) {
      var receipt = selected.filter(function(slot) { return slot.Tipo === 'RECIBO' && slot.Item_ID === payment.Numero_Recibo; })[0];
      if (receipt) changes = changes.concat(orderUpdateRequests_('Abonos', payment._row, { URL_PDF_Recibo: url(receipt.File_ID), URL_Carpeta_Cliente: 'https://drive.google.com/drive/folders/' + clientFolder }));
    });
    var existing = listRows_('Documentos');
    var versions = listRows_('Versiones_Documentos');
    var newDocs = [], newVersions = [];
    selected.forEach(function(slot) {
      var old = existing.filter(function(doc) { return doc.ID_Documento === slot.Clave; });
      if (old.length > 1 || (old.length && (old[0].File_ID !== slot.File_ID || old[0].Hash_SHA256 !== slot.SHA256))) orderDocumentError_('DOCUMENT_INTEGRITY', 'El índice documental contiene una referencia distinta.');
      if (!old.length) newDocs.push({ ID_Documento: slot.Clave, Tipo_Documento: slot.Tipo, Numero_Relacionado: row.Numero_OP, Cedula_NIT: row.Cedula_NIT, Nombre_Cliente: row.Nombre_Cliente, Nombre_Archivo: slot.Nombre, URL: url(slot.File_ID), File_ID: slot.File_ID, Mime_Type: slot.Mime, Version: slot.Version, Activo: 'SI', Fecha_Emision: stamp, Fecha_Registro: stamp, Operador: session.profile.uid, Hash_SHA256: slot.SHA256, Request_ID: row.Request_ID });
      if (slot.Tipo !== 'FOTO' && !versions.some(function(doc) { return doc.Version_ID === 'V-' + slot.Clave; })) newVersions.push({ Version_ID: 'V-' + slot.Clave, Tipo_Documento: slot.Tipo, Numero_Relacionado: row.Numero_OP, Version: slot.Version, Activo: 'SI', URL: url(slot.File_ID), File_ID: slot.File_ID, Nombre_Archivo: slot.Nombre, Fecha_Generacion: stamp, Generado_Por: session.profile.uid, Hash_SHA256: slot.SHA256, Motivo_Nueva_Version: 'Emisión inicial desde datos confirmados; ' + slot.Snapshot_SHA256, Request_ID: row.Request_ID });
    });
    if (newDocs.length) changes.push(orderAppendRequest_('Documentos', newDocs));
    if (newVersions.length) changes.push(orderAppendRequest_('Versiones_Documentos', newVersions));
    changes.push(orderAppendRequest_('Auditoria', [{ ID: 'DA-' + Utilities.getUuid(), Fecha: stamp, Usuario: session.profile.uid, Modulo: 'DOCUMENTOS', Accion: 'ORDEN_DOCUMENTADA', Entidad_ID: row.Numero_OP, Resumen: 'Fotografías, OP y recibos verificados y enlazados. Sin repetir movimientos de dinero.', Estado: 'CONFIRMADA', Request_ID: row.Request_ID, Despues_JSON: JSON.stringify({ snapshot: state.snapshotHash, files: selected.map(function(slot) { return { id: slot.File_ID, sha256: slot.SHA256 }; }) }) }]));
    orderDocumentBatch_(changes, session.profile.uid, row.Numero_OP);
    return orderDocumentState_(findRow_('Ordenes_Pedido', 'Numero_OP', row.Numero_OP));
  });
}
function getOrderDocumentsState_(payload, context) {
  return orderDocumentLocked_(payload, context, false, function(row) { return orderDocumentState_(row); });
}
