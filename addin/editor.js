var rendered = null;
var sourceBox = document.getElementById('source');
var renderButton = document.getElementById('render');
var insertButton = document.getElementById('insert');
var statusBox = document.getElementById('status');
var formatBox = document.getElementById('format');
var sizeBox = document.getElementById('size');
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
    var originalSize = Number(readTag(editTarget, 'TEXKOI_SIZE_PT')) || 28;
    var originalFormat = (readTag(editTarget, 'TEXKOI_FORMAT') || 'svg').toLowerCase();
    sizeBox.value = originalSize;
    formatBox.value = originalFormat;
    editState = {
      source: sourceBox.value, size: originalSize, format: originalFormat,
      width: editTarget.Width, height: editTarget.Height,
      left: editTarget.Left, top: editTarget.Top, rotation: editTarget.Rotation,
      z: editTarget.ZOrderPosition, id: editTarget.Id,
      naturalWidth: Number(readTag(editTarget, 'TEXKOI_NATURAL_WIDTH')),
      naturalHeight: Number(readTag(editTarget, 'TEXKOI_NATURAL_HEIGHT'))
    };
    document.querySelector('h1').textContent = 'Edit equation';
    insertButton.textContent = 'Render & update';
  }
} catch (error) {
  initializationError = error;
  statusBox.textContent = error.message || String(error);
  renderButton.disabled = insertButton.disabled = true;
}
async function compileSource(source, format) {
  var response = await fetch('/render', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-TeXKoi': 'render'}, body: JSON.stringify({source: source, format: format})});
  var result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Rendering failed');
  return result;
}
function setBusy(busy) {
  [renderButton, insertButton, sourceBox, formatBox, sizeBox].forEach(function (control) {
    control.disabled = busy;
  });
}
async function runAction(insert) {
  if (initializationError) return;
  setBusy(true);
  statusBox.textContent = 'Rendering…';
  try {
    var size = Number(sizeBox.value);
    if (!isFinite(size) || size < 6 || size > 144) throw new Error('Choose a size between 6 and 144 pt.');
    var source = sourceBox.value;
    var result = await compileSource(source, formatBox.value);
    rendered = {source: source, result: result};
    var image = document.createElement('img');
    image.src = result.url;
    image.alt = 'Rendered equation';
    var preview = document.getElementById('preview');
    preview.textContent = '';
    preview.appendChild(image);
    if (!insert) { statusBox.textContent = 'Preview ready.'; return; }
    if (editState && (!editState.naturalWidth || !editState.naturalHeight)) {
      // Older equations predate natural-size tags; render once to recover their scale.
      var original = await compileSource(editState.source, editState.format);
      editState.naturalWidth = original.width;
      editState.naturalHeight = original.height;
    }
    insertRendered(size);
  } catch (error) { statusBox.textContent = error.message; }
  finally { setBusy(false); }
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
  // Closing is separate from insertion: a close failure must not delete the equation.
  try { window.close(); }
  catch (error) { statusBox.textContent = 'Equation inserted. You can close this window.'; }
}
