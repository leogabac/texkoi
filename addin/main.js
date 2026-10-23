var texkoiRibbon = null;
var selectionListenerRegistered = false;
var tabTimers = [];
function OnAddinLoad(ribbonUI) {
  texkoiRibbon = ribbonUI;
  if (!selectionListenerRegistered) {
    probeApp().ApiEvent.AddApiEventListener('WindowSelectionChange', OnEquationSelectionChange);
    selectionListenerRegistered = true;
  }
  return true;
}
function hasSelectedEquation() {
  try {
    var selection = probeApp().ActiveWindow.Selection;
    if (selection.Type !== 2) return false;
    for (var i = 1; i <= selection.ShapeRange.Count; i++) {
      var shape = selection.ShapeRange.Item(i);
      if (readTag(shape, 'TEXKOI_SOURCE_HEX') || readTag(shape, 'IGUANA_PROBE_SOURCE_HEX')) return true;
    }
  } catch (_) {}
  return false;
}
function activateTeXKoiTab() {
  var ribbon = texkoiRibbon || probeApp().ribbonUI;
  if (ribbon) {
    try { ribbon.ActivateTab('texkoiTab'); }
    catch (_) { ribbon.ActivateTab(); }
  }
}
function queueTeXKoiTab() {
  tabTimers.forEach(function (timer) { clearTimeout(timer); });
  tabTimers = [];
  if (!hasSelectedEquation()) return;
  try { activateTeXKoiTab(); }
  catch (error) { console.warn('TeXKoi tab activation failed:', error); }
  // WPS applies Graphics Tools asynchronously, after a zero-delay callback.
  // Cover that short native transition at frame-sized intervals, then stop.
  tabTimers = [16, 32, 48, 64, 80, 96].map(function (delay) {
    return setTimeout(function () {
      if (hasSelectedEquation()) {
        try { activateTeXKoiTab(); }
        catch (error) { console.warn('TeXKoi tab activation failed:', error); }
      }
    }, delay);
  });
}
function OnEquationSelectionChange() { queueTeXKoiTab(); }
function OnHello() { alert('It works! This is a custom JavaScript button in WPS Presentation.'); }
function probeApp() {
  if (typeof Application !== 'undefined') return Application;
  return wps.WppApplication();
}
function probeError(error) { alert('Probe failed: ' + (error.message || String(error))); }
function OnInsertProbe() {
  var shape;
  try {
    var app = probeApp();
    var slide = app.ActiveWindow.View.Slide;
    shape = slide.Shapes.AddPicture('/home/holo/projects/texkoi/addin/assets/equation.png', 0, -1, 100, 150, 320, 90);
    // hex keeps case-sensitive LaTeX intact even if the host uppercases tag values.
    var source = '\\alpha + \\beta = \\Gamma\nE = mc^{2}';
    var hex = '';
    for (var i = 0; i < source.length; i++) hex += ('0000' + source.charCodeAt(i).toString(16)).slice(-4);
    shape.Tags.Add('TEXKOI_SOURCE_HEX', hex);
    shape.Tags.Add('TEXKOI_VERSION', '1');
    shape.Select();
    alert('Inserted an embedded image with attached LaTeX source.\n\nNow save as .pptx, close and reopen the presentation, select this image, and click Read source.');
  } catch (error) { probeError(error); }
}
function OnReadProbe() {
  try {
    var shape = probeApp().ActiveWindow.Selection.ShapeRange.Item(1);
    var tags = shape.Tags;
    var hex = '';
    for (var i = 1; i <= tags.Count; i++) {
      if (['TEXKOI_SOURCE_HEX', 'IGUANA_PROBE_SOURCE_HEX'].indexOf(String(tags.Name(i)).toUpperCase()) !== -1) hex = String(tags.Value(i));
    }
    if (!hex) { alert('No probe source on this object. Select the inserted equation image.'); return; }
    if (!/^(?:[0-9a-fA-F]{4})+$/.test(hex)) throw new Error('Stored source is malformed.');
    var source = '';
    for (var j = 0; j < hex.length; j += 4) source += String.fromCharCode(parseInt(hex.slice(j, j + 4), 16));
    alert('Source recovered from the selected image:\n\n' + source);
  } catch (error) { probeError(error); }
}

function OnNewEquation() {
  try { probeApp().ShowDialog('http://127.0.0.1:3899/editor.html', 'TeXKoi — New equation', 700, 650, true); queueTeXKoiTab(); }
  catch (error) { probeError(error); }
}
function storeSource(shape, source) {
  var hex = '';
  for (var i = 0; i < source.length; i++) hex += ('0000' + source.charCodeAt(i).toString(16)).slice(-4);
  shape.Tags.Add('TEXKOI_SOURCE_HEX', hex);
  shape.Tags.Add('TEXKOI_VERSION', '1');
}

function readTag(shape, name) {
  for (var i = 1; i <= shape.Tags.Count; i++) {
    if (String(shape.Tags.Name(i)).toUpperCase() === name) return String(shape.Tags.Value(i));
  }
  return '';
}
function readSource(shape) {
  var hex = readTag(shape, 'TEXKOI_SOURCE_HEX') || readTag(shape, 'IGUANA_PROBE_SOURCE_HEX');
  if (!hex || !/^(?:[0-9a-fA-F]{4})+$/.test(hex)) throw new Error('Select a TeXKoi equation.');
  var source = '';
  for (var j = 0; j < hex.length; j += 4) source += String.fromCharCode(parseInt(hex.slice(j, j + 4), 16));
  return source;
}
function selectedEquation() {
  var selection = probeApp().ActiveWindow.Selection;
  if (selection.Type !== 2 || selection.ShapeRange.Count !== 1) throw new Error('Select one TeXKoi equation.');
  if (selection.HasChildShapeRange) throw new Error('Ungroup the equation before editing it.');
  var shape = selection.ShapeRange.Item(1);
  readSource(shape);
  return shape;
}
function OnEditEquation() {
  try {
    selectedEquation();
    probeApp().ShowDialog('http://127.0.0.1:3899/editor.html?mode=edit', 'TeXKoi — Edit equation', 700, 650, true);
    queueTeXKoiTab();
  } catch (error) { alert(error.message || String(error)); }
}

function OnUndoDiagnostics() {
  try {
    probeApp().ShowDialog('http://127.0.0.1:3899/diagnostics.html', 'TeXKoi — Undo diagnostics', 700, 600, true);
  } catch (error) { alert(error.message || String(error)); }
}
