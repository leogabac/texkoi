var lines = [];
function inspect(label, getObject) {
  var object;
  try { object = getObject(); }
  catch (error) { lines.push(label + ': ' + String(error)); return; }
  if (!object) { lines.push(label + ': unavailable'); return; }
  lines.push('[' + label + ']');
  ['Version', 'Build', 'StartNewUndoEntry', 'UndoRecord', 'BeginUndoGroup', 'EndUndoGroup', 'BeginTransaction', 'EndTransaction', 'Run', 'SetUndoText'].forEach(function (name) {
    try {
      var value = object[name];
      lines.push(name + ': ' + typeof value + ((name === 'Version' || name === 'Build') ? ' = ' + String(value) : ''));
      if (name === 'UndoRecord' && value) {
        ['StartCustomRecord', 'EndCustomRecord'].forEach(function (method) { lines.push('  ' + method + ': ' + typeof value[method]); });
      }
    } catch (error) { lines.push(name + ': inaccessible (' + String(error) + ')'); }
  });
}
inspect('Application', function () { return Application; });
inspect('wps', function () { return wps; });
inspect('wps.WppApplication()', function () { return wps.WppApplication(); });
inspect('Application.ActivePresentation', function () { return Application.ActivePresentation; });
document.getElementById('report').value = lines.join('\n');

try {
  var diagnosticSlide = Application.ActiveWindow.View.Slide;
  lines.push('\nCurrent slide shape count: ' + diagnosticSlide.Shapes.Count);
  for (var i = 1; i <= diagnosticSlide.Shapes.Count; i++) {
    var diagnosticShape = diagnosticSlide.Shapes.Item(i);
    lines.push('  id=' + diagnosticShape.Id + ' name=' + diagnosticShape.Name);
  }
} catch (error) { lines.push('Slide inspection: ' + String(error)); }
document.getElementById('report').value = lines.join('\n');
function pasteProbe(replace) {
  var replacement;
  var originalDeleted = false;
  try {
    var app = probeApp();
    var original = selectedEquation();
    var slide = app.ActiveWindow.View.Slide;
    original.Copy();
    app.StartNewUndoEntry();
    replacement = slide.Shapes.Paste().Item(1);
    // Deliberately no sizing, tag changes or selection calls: isolate native paste/delete.
    if (replace) { original.Delete(); originalDeleted = true; }
    app.StartNewUndoEntry();
  } catch (error) {
    if (replacement && !originalDeleted) { try { replacement.Delete(); } catch (_) {} }
    document.getElementById('report').value += '\nProbe error: ' + String(error);
    return;
  }
  window.close();
}
document.getElementById('paste').onclick = function () { pasteProbe(false); };
document.getElementById('replace').onclick = function () { pasteProbe(true); };
