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
