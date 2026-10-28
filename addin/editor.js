var rendered = null;
var sourceBox = document.getElementById('source');
var preambleBox = document.getElementById('preamble');
var preambleOrigin = document.getElementById('preamble-origin');
var preambleOpen = document.getElementById('preamble-open');
var preambleReload = document.getElementById('preamble-reload');
var settingsLoaded = false;
var renderButton = document.getElementById('render');
var insertButton = document.getElementById('insert');
var statusBox = document.getElementById('status');
var formatBox = document.getElementById('format');
var sizeBox = document.getElementById('size');
var errorDetails = document.getElementById('error-details');
var errorLog = document.getElementById('error-log');
function showStatus(message, error) {
  statusBox.textContent = message;
  statusBox.className = error ? 'error' : '';
  if (errorDetails) { errorDetails.hidden = true; errorDetails.open = false; }
}
function showError(error) {
  var message = error.message || String(error);
  var lines = message.split('\n');
  var texError = lines.filter(function (line) { return /^!/.test(line); })[0];
  if (!texError) {
    var diagnostic = lines.filter(function (line) { return /^(?:\.\/)?equation\.tex:\d+:/.test(line); })[0];
    if (diagnostic) texError = diagnostic.replace(/^(?:\.\/)?equation\.tex:\d+:\s*/, '');
  }
  var location = error.location;
  var prefix = location && (location.section === 'source' || location.section === 'preamble') && location.line > 0 ? (location.section === 'source' ? 'Source' : 'Preamble') + ' line ' + location.line + ': ' : '';
  showStatus(prefix + (texError ? texError.replace(/^!\s*/, '') : (lines.length > 3 ? 'Rendering failed. See compiler details below.' : message)), true);
  if (errorDetails && errorLog && lines.length > 3) {
    errorLog.textContent = message;
    errorDetails.hidden = false;
  }
}
var brand = document.querySelector('.brand');
if (brand) brand.textContent = profileName();
document.title = profileName();
var editTarget = null;
var targetSlide = null;
var targetWindow = null;
var targetPresentation = null;
var editState = null;
var initializationError = null;
try {
  targetWindow = probeApp().ActiveWindow;
  targetPresentation = targetWindow.Presentation;
  targetSlide = targetWindow.View.Slide;
  if (new URLSearchParams(window.location.search).get('mode') === 'edit') {
    editTarget = selectedEquation();
    sourceBox.value = readSource(editTarget);
    preambleBox.value = readPreamble(editTarget);
    preambleOrigin.textContent = 'Saved with this equation. Changes here affect only this equation.';
    settingsLoaded = true;
    var originalSize = Number(readTag(editTarget, 'TEXKOI_SIZE_PT')) || 28;
    var originalFormat = (readTag(editTarget, 'TEXKOI_FORMAT') || 'svg').toLowerCase();
    sizeBox.value = originalSize;
    formatBox.value = originalFormat;
    editState = {
      source: sourceBox.value, preamble: preambleBox.value, size: originalSize, format: originalFormat,
      width: editTarget.Width, height: editTarget.Height,
      left: editTarget.Left, top: editTarget.Top, rotation: editTarget.Rotation,
      z: editTarget.ZOrderPosition, id: editTarget.Id,
      naturalWidth: Number(readTag(editTarget, 'TEXKOI_NATURAL_WIDTH')),
      naturalHeight: Number(readTag(editTarget, 'TEXKOI_NATURAL_HEIGHT'))
    };
    document.querySelector('h1').textContent = 'Edit equation';
    insertButton.textContent = 'Render & update';
    var shortcut = document.querySelector('.shortcut');
    if (shortcut) shortcut.textContent = 'Ctrl+Enter to update';
  }
} catch (error) {
  initializationError = error;
  showError(editTarget ? error : new Error('Open the editor from WPS Presentation with a slide selected.'));
  renderButton.disabled = insertButton.disabled = preambleOpen.disabled = preambleReload.disabled = true;
}
async function compileSource(source, format, preamble) {
  var response;
  try {
    response = await fetch('render', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-TeXKoi': 'render'}, body: JSON.stringify({source: source, format: format, preamble: preamble})});
  } catch (_) {
    throw new Error('Cannot reach TeXKoi Companion. Start it from your application menu, then render again. Your source is still in the editor.');
  }
  if (response.status === 403 || response.status === 404) {
    throw new Error('The installed editor and companion could not connect. Restart WPS to reload TeXKoi, then try again.');
  }
  var result;
  try { result = await response.json(); }
  catch (_) { throw new Error('TeXKoi Companion returned an unexpected response. Restart the companion and try again.'); }
  if (!response.ok) { var failure = new Error(result.error || 'Rendering failed'); failure.location = result.location; throw failure; }
  if (typeof result.preamble !== 'string') throw new Error('The companion needs updating for preamble support. Install TeXKoi again and restart WPS.');
  return result;
}

async function fetchEditorSettings() {
  var response;
  try { response = await fetch('settings'); }
  catch (_) { throw new Error('Cannot load TeXKoi settings. Start the companion and try rendering again.'); }
  var settings;
  try { settings = await response.json(); }
  catch (_) { throw new Error('The companion returned invalid settings. Update TeXKoi and restart WPS.'); }
  if (!response.ok) throw new Error(settings.error || 'Cannot load TeXKoi settings.');
  if (typeof settings.preamble !== 'string' || !['svg', 'png'].includes(settings.default_format) ||
      typeof settings.default_size_pt !== 'number' || !isFinite(settings.default_size_pt) ||
      settings.default_size_pt < 6 || settings.default_size_pt > 144) throw new Error('The companion returned invalid equation defaults.');
  return settings;
}
async function loadEditorSettings() {
  var settings = await fetchEditorSettings();
  sizeBox.value = settings.default_size_pt;
  formatBox.value = settings.default_format;
  preambleBox.value = settings.preamble;
  if (preambleBox.texkoiSync) preambleBox.texkoiSync();
  preambleOrigin.textContent = (settings.preamble_path ? 'Loaded from ' + settings.preamble_path + '. ' : '') + 'Changes here affect only this equation.';
  settingsLoaded = true;
}
function setBusy(busy) {
  [renderButton, insertButton, sourceBox, formatBox, sizeBox, preambleBox, preambleOpen, preambleReload].forEach(function (control) {
    control.disabled = busy;
  });
}
async function openPreambleFile() {
  if (preambleOpen.disabled) return;
  setBusy(true);
  try {
    var response;
    try { response = await fetch('open-preamble', {method: 'POST', headers: {'X-TeXKoi': 'open-preamble'}}); }
    catch (_) { throw new Error('Cannot reach TeXKoi Companion. Start it and try again.'); }
    var result;
    try { result = await response.json(); }
    catch (_) { throw new Error('Could not open the preamble. Restart the companion and try again.'); }
    if (!response.ok) throw new Error(result.error || 'Could not open the preamble.');
    showStatus('Custom preamble opened. After saving, choose Reload file into equation to use your changes.');
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}
async function reloadPreambleFile() {
  if (preambleReload.disabled) return;
  setBusy(true);
  try {
    var settings = await fetchEditorSettings();
    if (!settings.preamble_path) throw new Error('No preamble file is configured. Set preamble_file in settings.json first.');
    if (!settingsLoaded) {
      sizeBox.value = settings.default_size_pt;
      formatBox.value = settings.default_format;
      settingsLoaded = true;
    }
    preambleBox.value = settings.preamble;
  if (preambleBox.texkoiSync) preambleBox.texkoiSync();
    preambleOrigin.textContent = 'Loaded from ' + settings.preamble_path + '. Changes here affect only this equation.';
    markPreviewStale();
    showStatus('Preamble reloaded into this equation.');
  } catch (error) { showError(error); }
  finally { setBusy(false); }
}
preambleOpen.onclick = openPreambleFile;
preambleReload.onclick = reloadPreambleFile;

async function runAction(insert) {
  if (initializationError || renderButton.disabled) return;
  setBusy(true);
  showStatus('Rendering…');
  renderButton.textContent = insert ? 'Render preview' : 'Rendering…';
  var actionLabel = editState ? 'Render & update' : 'Render & insert';
  insertButton.textContent = insert ? 'Rendering…' : actionLabel;
  try {
    if (!settingsLoaded) await loadEditorSettings();
    var size = Number(sizeBox.value);
    if (!isFinite(size) || size < 6 || size > 144) throw new Error('Choose a size between 6 and 144 pt.');
    var source = sourceBox.value;
    var result = await compileSource(source, formatBox.value, preambleBox.value);
    rendered = {source: source, result: result};
    var image = document.createElement('img');
    image.src = result.url;
    image.alt = 'Rendered equation';
    image.style.width = (result.width * size / 10 * 96 / 72) + 'px';
    var preview = document.getElementById('preview');
    preview.textContent = '';
    preview.className = 'preview';
    preview.appendChild(image);
    if (!insert) { showStatus('Preview ready.'); return; }
    if (editState && (!editState.naturalWidth || !editState.naturalHeight)) {
      // Older equations predate natural-size tags; render once to recover their scale.
      var original = await compileSource(editState.source, editState.format, editState.preamble);
      editState.naturalWidth = original.width;
      editState.naturalHeight = original.height;
    }
    insertRendered(size);
  } catch (error) { showError(error); }
  finally {
    setBusy(false);
    renderButton.textContent = 'Render preview';
    insertButton.textContent = actionLabel;
  }
}
renderButton.onclick = function () { return runAction(false); };
insertButton.onclick = function () { return runAction(true); };
function insertRendered(size) {
  var shape;
  var staging = null;
  var undoOpen = false;
  var committed = false;
  var app = probeApp();
  var beforeHistory = null;
  try {
    // History is optional: unsupported diagnostics must not break equation insertion.
    try {
      historyStorage().removeItem(historyKey);
      if (editTarget) beforeHistory = deckState();
    } catch (error) { console.warn('Equation history unavailable:', error); }
    var slide = targetSlide;
    var result = rendered.result;
    var scale = size / 10;
    // The TeX document uses a 10-point base; scale both dimensions together.
    var width = result.width * scale;
    var height = result.height * scale;
    if (editState) {
      var found = false;
      for (var i = 1; i <= slide.Shapes.Count; i++) {
        if (slide.Shapes.Item(i).Id === editState.id) found = true;
      }
      if (!found) throw new Error('The original equation no longer exists. Reopen the editor.');
      width *= editState.width / (editState.naturalWidth * editState.size / 10);
      height *= editState.height / (editState.naturalHeight * editState.size / 10);
    }
    // AddPicture is not reliably undoable in WPS. Prepare the complete object
    // in a separate deck so the target sees only a native paste and deletion.
    staging = app.Presentations.Add(0);
    staging.PageSetup.SlideWidth = targetPresentation.PageSetup.SlideWidth;
    staging.PageSetup.SlideHeight = targetPresentation.PageSetup.SlideHeight;
    var stagingSlide = staging.Slides.Add(1, 12);
    var prepared = stagingSlide.Shapes.AddPicture(result.path, 0, -1,
      editState ? editState.left : 100, editState ? editState.top : 150, width, height);
    storeSource(prepared, rendered.source);
    storePreamble(prepared, result.preamble);
    prepared.Tags.Add('TEXKOI_SIZE_PT', String(size));
    prepared.Tags.Add('TEXKOI_FORMAT', result.format);
    prepared.Tags.Add('TEXKOI_NATURAL_WIDTH', String(result.width));
    prepared.Tags.Add('TEXKOI_NATURAL_HEIGHT', String(result.height));
    if (editState) prepared.Rotation = editState.rotation;
    var preparedLeft = prepared.Left;
    var preparedTop = prepared.Top;
    prepared.Copy();
    // Finish staging before opening the target undo entry. Never mark the user's deck saved.
    staging.Saved = -1;
    staging.Close();
    staging = null;
    targetWindow.Activate();
    // WPS 12.1.2.29183 still records this update as two undo steps despite
    // these boundaries. Observed workaround: Ctrl+Z twice restores the old
    // equation; Ctrl+Y twice restores the update. One undo may show both.
    // Don't automatically double undo: other edits may be on top of the stack.
    // This is a tested workaround for this build, not a guaranteed API contract.
    app.StartNewUndoEntry();
    undoOpen = true;
    shape = slide.Shapes.Paste().Item(1);
    // Check clipboard fidelity before deleting the original, without rewriting tags.
    if (readSource(shape) !== rendered.source) throw new Error('Pasted equation lost its source metadata.');
    if (readPreamble(shape, true) !== result.preamble) throw new Error('Pasted equation lost its preamble metadata.');
    if (Math.abs(shape.Width - width) > 0.1 || Math.abs(shape.Height - height) > 0.1 ||
        Math.abs(shape.Left - preparedLeft) > 0.1 || Math.abs(shape.Top - preparedTop) > 0.1) {
      throw new Error('WPS changed the equation geometry during paste.');
    }
    if (editState) {
      // Move just above the original; deleting it leaves the replacement at its old layer.
      var moves = slide.Shapes.Count;
      while (shape.ZOrderPosition > editState.z + 1 && moves-- > 0) shape.ZOrder(3);
      if (shape.ZOrderPosition !== editState.z + 1) throw new Error('Could not preserve the equation layer.');
    }
    if (editTarget) editTarget.Delete();
    committed = true;
    if (beforeHistory) {
      try { rememberUpdate(beforeHistory, deckState(), targetSlide.SlideID); }
      catch (error) { console.warn('Could not record equation history:', error); }
    }
    statusBox.textContent = editState ? 'Equation updated.' : 'Equation inserted.';
  } catch (error) {
    if (shape && !committed) { try { shape.Delete(); } catch (_) {} }
    throw new Error('Insertion failed: ' + (error.message || error));
  } finally {
    if (undoOpen) {
      try { app.StartNewUndoEntry(); }
      catch (error) { console.warn('Could not finish undo entry:', error); }
    }
    if (staging) {
      try { staging.Saved = -1; staging.Close(); }
      catch (error) { console.warn('Could not close temporary equation presentation:', error); }
    }
  }
  // Selection/ribbon changes happen after the undo entry has finished and must
  // never turn an otherwise successful insertion into a rollback.
  try { shape.Select(); activateTeXKoiTab(); }
  catch (error) { console.warn('Could not focus the TeXKoi equation:', error); }
  // Closing is separate from insertion: a close failure must not delete the equation.
  try { window.close(); }
  catch (error) { statusBox.textContent = 'Equation inserted. You can close this window.'; }
}

function markPreviewStale() {
  if (!rendered) return;
  document.getElementById('preview').className = 'preview stale';
  showStatus('Source, preamble, or format changed. Render again to refresh the preview.');
}
sourceBox.oninput = markPreviewStale;
preambleBox.oninput = markPreviewStale;
formatBox.onchange = markPreviewStale;
document.addEventListener('keydown', function (event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    runAction(!event.shiftKey);
  }
  if (event.key === 'Escape' && !renderButton.disabled) window.close();
});
var editorReady = Promise.resolve();
if (!initializationError && !settingsLoaded) {
  setBusy(true);
  showStatus('Loading equation settings…');
  editorReady = loadEditorSettings().then(function () { showStatus(''); })
    .catch(function (error) { showError(error); })
    .then(function () { setBusy(false); sourceBox.focus(); });
} else if (!initializationError) sourceBox.focus();
