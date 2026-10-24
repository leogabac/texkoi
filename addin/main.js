function profileName() { return typeof texkoiProfile === 'undefined' ? 'TeXKoi' : texkoiProfile.name; }
function editorUrl(query) {
  var base = typeof texkoiProfile !== 'undefined' && texkoiProfile.editorBase ? texkoiProfile.editorBase : window.location.href;
  return new URL('editor.html' + (query || ''), base).href;
}
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
    try { ribbon.ActivateTab(typeof texkoiProfile === 'undefined' ? 'texkoiTab' : texkoiProfile.tabId); }
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
function probeApp() {
  if (typeof Application !== 'undefined') return Application;
  return wps.WppApplication();
}
function probeError(error) { alert(error.message || String(error)); }

function OnNewEquation() {
  try { probeApp().ShowDialog(editorUrl(), profileName() + ' — New equation', 700, 650, true); queueTeXKoiTab(); }
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
    probeApp().ShowDialog(editorUrl('?mode=edit'), profileName() + ' — Edit equation', 700, 650, true);
    queueTeXKoiTab();
  } catch (error) { alert(error.message || String(error)); }
}

function OnUndoDiagnostics() {
  try {
    probeApp().ShowDialog(new URL('diagnostics.html', window.location.href).href, 'TeXKoi — Undo diagnostics', 700, 600, true);
  } catch (error) { alert(error.message || String(error)); }
}

function GetRibbonImage(control) {
  var icons = {
    newEquation: 'new-equation',
    editEquation: 'edit-equation',
    undoEquationUpdate: 'undo-update',
    redoEquationUpdate: 'redo-update'
  };
  var icon = icons[control.Id];
  // WPS prepends the add-in URL itself; a full URL becomes /http://… and 404s.
  return icon ? 'icons/' + icon + '.png' : '';
}
