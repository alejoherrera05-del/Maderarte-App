// Editor-only, read-only diagnostic. Never logs credentials or user identity.
function diagnosticarIdentidadEnsayo() {
  var s = osState_();
  if (!s) return console.log('SIN_PRUEBA');
  var children = osList_("'" + s.containerId + "' in parents and trashed = false");
  var result = {id:s.id,stage:s.stage,sheetId:s.sheetId,sheetCreationSent:s.sheetCreationSent,
    resources:[s.containerId,s.rootId].concat(children.map(function(f){return f.id;})).filter(function(id,i,a){return a.indexOf(id)===i;}).map(function(id){
      var m=osMeta_(id);
      return {id:m.id,name:m.name,mime:m.mimeType,parents:m.parents,trashed:m.trashed,marker:m.appProperties||{}};
    })};
  console.log(JSON.stringify(result));
}

// Manual repair of an interrupted native-file creation, before any seeding.
// Requires the exact reserved folder, creation window and an empty spreadsheet.
function repararIdentidadHojaVaciaEnsayo() {
  return osLock_(function() {
    osProductionClosed_();
    var s=osState_();
    if(!s || s.stage!=='PREPARANDO' || s.sheetId || !s.sheetCreationSent) throw Error('El ensayo no admite esta reparación.');
    osExpect_(osMeta_(s.containerId),s,'container',s.parentId);
    osExpect_(osMeta_(s.rootId),s,'root',s.containerId);
    var candidates=osList_("'"+s.containerId+"' in parents and trashed = false and mimeType='application/vnd.google-apps.spreadsheet'");
    if(candidates.length!==1) throw Error('Se requiere una única hoja candidata.');
    var m=JSON.parse(mdDrive_('drive/v3/files/'+encodeURIComponent(candidates[0].id)+'?fields=id,name,mimeType,parents,trashed,appProperties,createdTime,ownedByMe').getContentText());
    var age=Date.parse(m.createdTime)-Date.parse(s.createdAt);
    if(m.id===osProperty_('SPREADSHEET_ID') || m.trashed || m.name!==s.sheetName || m.mimeType!=='application/vnd.google-apps.spreadsheet'
      || m.parents.length!==1 || m.parents[0]!==s.containerId || Object.keys(m.appProperties||{}).length
      || !Number.isFinite(age) || age<0 || age>120000
      || m.ownedByMe!==true) throw Error('La identidad candidata no cumple las comprobaciones.');
    var ss=SpreadsheetApp.openById(m.id),tabs=ss.getSheets();
    if(ss.getName()!==s.sheetName || tabs.length!==1 || tabs[0].getLastRow() || tabs[0].getLastColumn()) throw Error('La hoja debe seguir completamente vacía.');
    mdDrive_('drive/v3/files/'+encodeURIComponent(m.id)+'?fields=id',{method:'patch',contentType:'application/json',payload:JSON.stringify({appProperties:osMarker_(s,'sheet')})});
    osExpect_(osMeta_(m.id),s,'sheet',s.containerId);
    console.log('Identidad de la hoja vacía confirmada. Retoma la preparación desde la app.');
  });
}
