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

function connectionUrl(query) {
  return new URL('connection.html' + (query || ''), window.location.href).href;
}

function OnNewEquation() {
  try { probeApp().ShowDialog(connectionUrl(), profileName() + ' — New equation', 700, 650, true); queueTeXKoiTab(); }
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
    probeApp().ShowDialog(connectionUrl('?mode=edit'), profileName() + ' — Edit equation', 700, 650, true);
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

// v0.1.x equations have no preamble snapshot and used this fixed preamble.
var legacyPreamble = '\\usepackage{amsmath,amssymb}\n';
function storePreamble(shape, text) {
  if (typeof text !== 'string' || text.length > 20000) throw new Error('Invalid equation preamble.');
  var hex = '';
  for (var i = 0; i < text.length; i++) hex += ('0000' + text.charCodeAt(i).toString(16)).slice(-4);
  // Keep individual values below common native tag-size limits. UTF-16 hex
  // also protects LaTeX macros from host case/encoding transformations.
  var count = Math.ceil(hex.length / 240);
  for (var j = 0; j < count; j++) shape.Tags.Add('TEXKOI_PREAMBLE_' + ('0000' + j).slice(-4), hex.slice(j * 240, (j + 1) * 240));
  shape.Tags.Add('TEXKOI_PREAMBLE_PARTS', String(count));
  shape.Tags.Add('TEXKOI_PREAMBLE_LENGTH', String(text.length));
}
function readPreamble(shape, requireSnapshot) {
  var tags = {};
  for (var i = 1; i <= shape.Tags.Count; i++) tags[String(shape.Tags.Name(i)).toUpperCase()] = String(shape.Tags.Value(i));
  if (!Object.prototype.hasOwnProperty.call(tags, 'TEXKOI_PREAMBLE_PARTS')) {
    if (Object.keys(tags).some(function (key) { return key.indexOf('TEXKOI_PREAMBLE_') === 0; })) throw new Error('Equation preamble metadata is incomplete.');
    if (requireSnapshot) throw new Error('Pasted equation lost its preamble metadata.');
    return legacyPreamble;
  }
  var parts = tags.TEXKOI_PREAMBLE_PARTS, length = tags.TEXKOI_PREAMBLE_LENGTH;
  if (!/^(0|[1-9][0-9]*)$/.test(parts) || !/^(0|[1-9][0-9]*)$/.test(length) ||
      Number(parts) > 334 || Number(length) > 20000) throw new Error('Equation preamble metadata is damaged.');
  var hex = '';
  for (var j = 0; j < Number(parts); j++) {
    var part = tags['TEXKOI_PREAMBLE_' + ('0000' + j).slice(-4)];
    if (typeof part !== 'string' || !/^(?:[a-fA-F0-9]{4})+$/.test(part) || part.length > 240) throw new Error('Equation preamble metadata is incomplete.');
    hex += part;
  }
  if (hex.length !== Number(length) * 4 || Number(parts) !== Math.ceil(hex.length / 240)) throw new Error('Equation preamble metadata is incomplete.');
  var text = '';
  for (var k = 0; k < hex.length; k += 4) text += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
  return text;
}
