// Run manually by the project owner after accepting quotation emission.
// This never enables orders, payments, deliveries or production writes.
function activarEmisionCotizaciones() {
  verificarBaseCero();
  prepararDocumentosCotizaciones();
  return qmdLocked_(function() {
    qmdSchema_();
    var quotes = listRows_('Cotizaciones');
    var numbers = listRows_('Registro_Numeros');
    if (quotes.length || numbers.length) throw appError_('QUOTE_ACTIVATION_REVIEW', 'Hay documentos o números registrados. No se reinicia la numeración.', 409);
    var branches = ['MP', 'TP'].map(function(branch) {
      var row = findRow_('Sedes', 'Sede_ID', branch);
      if (!row || normalizeCode_(row.Estado) !== 'ACTIVA' || Number(row.Siguiente_Cotizacion) !== 1) {
        throw appError_('QUOTE_ACTIVATION_REVIEW', 'Revisa el consecutivo inicial de ' + branch + '. No se modificó.', 409);
      }
      return quoteNumber_(row).number;
    });
    getScriptProperties_().setProperties({ QUOTE_WRITES_ENABLED: 'SI', QUOTE_DOCUMENTS_ENABLED: 'SI', QUOTE_OPERATION_ACCEPTED: 'SI' });
    var result = { ok: true, quotationsEnabled: quoteWritesEnabled_(), next: branches, otherCommercialWrites: MADERARTE_APP.COMMERCIAL_WRITES };
    Logger.log(JSON.stringify(result));
    return result;
  });
}
