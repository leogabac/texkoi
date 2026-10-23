var rendered = null;
var sourceBox = document.getElementById('source');
var renderButton = document.getElementById('render');
var insertButton = document.getElementById('insert');
var statusBox = document.getElementById('status');
var formatBox = document.getElementById('format');
var sizeBox = document.getElementById('size');
var editTarget = null;
var targetSlide = null;
var editState = null;
var initializationError = null;
try {
  targetSlide = probeApp().ActiveWindow.View.Slide;
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
  try {
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
    shape = slide.Shapes.AddPicture(result.path, 0, -1, editState ? editState.left : 100, editState ? editState.top : 150, width, height);
    storeSource(shape, rendered.source);
    shape.Tags.Add('TEXKOI_SIZE_PT', String(size));
    shape.Tags.Add('TEXKOI_FORMAT', result.format);
    shape.Tags.Add('TEXKOI_NATURAL_WIDTH', String(result.width));
    shape.Tags.Add('TEXKOI_NATURAL_HEIGHT', String(result.height));
    if (editState) {
      shape.Rotation = editState.rotation;
      // Move just above the original; deleting it leaves the replacement at its old layer.
      var moves = slide.Shapes.Count;
      while (shape.ZOrderPosition > editState.z + 1 && moves-- > 0) shape.ZOrder(3);
      if (shape.ZOrderPosition !== editState.z + 1) throw new Error('Could not preserve the equation layer.');
    }
    shape.Select();
    if (editTarget) editTarget.Delete();
    statusBox.textContent = editState ? 'Equation updated.' : 'Equation inserted.';
  } catch (error) {
    if (shape) { try { shape.Delete(); } catch (_) {} }
    throw new Error('Insertion failed: ' + (error.message || error));
  }
  // Closing is separate from insertion: a close failure must not delete the equation.
  try { window.close(); }
  catch (error) { statusBox.textContent = 'Equation inserted. You can close this window.'; }
}
