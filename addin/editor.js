var rendered = null;
var sourceBox = document.getElementById('source');
var renderButton = document.getElementById('render');
var insertButton = document.getElementById('insert');
var statusBox = document.getElementById('status');
var formatBox = document.getElementById('format');
var sizeBox = document.getElementById('size');
function setBusy(busy) {
  [renderButton, insertButton, sourceBox, formatBox, sizeBox].forEach(function (control) {
    control.disabled = busy;
  });
}
async function runAction(insert) {
  setBusy(true);
  statusBox.textContent = 'Rendering…';
  try {
    var size = Number(sizeBox.value);
    if (!isFinite(size) || size < 6 || size > 144) throw new Error('Choose a size between 6 and 144 pt.');
    var source = sourceBox.value;
    var response = await fetch('/render', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-TexKoi': 'render'}, body: JSON.stringify({source: source, format: formatBox.value})});
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Rendering failed');
    rendered = {source: source, result: result};
    var image = document.createElement('img');
    image.src = result.url;
    image.alt = 'Rendered equation';
    var preview = document.getElementById('preview');
    preview.textContent = '';
    preview.appendChild(image);
    if (!insert) { statusBox.textContent = 'Preview ready.'; return; }
    insertRendered(size);
  } catch (error) { statusBox.textContent = error.message; }
  finally { setBusy(false); }
}
renderButton.onclick = function () { return runAction(false); };
insertButton.onclick = function () { return runAction(true); };
function insertRendered(size) {
  var shape;
  try {
    var slide = probeApp().ActiveWindow.View.Slide;
    var result = rendered.result;
    var scale = size / 10;
    // The TeX document uses a 10-point base; scale both dimensions together.
    shape = slide.Shapes.AddPicture(result.path, 0, -1, 100, 150, result.width * scale, result.height * scale);
    storeSource(shape, rendered.source);
    shape.Tags.Add('TEXKOI_SIZE_PT', String(size));
    shape.Tags.Add('TEXKOI_FORMAT', result.format);
    shape.Select();
    statusBox.textContent = 'Equation inserted.';
  } catch (error) {
    if (shape) { try { shape.Delete(); } catch (_) {} }
    throw new Error('Insertion failed: ' + (error.message || error));
  }
  // Closing is separate from insertion: a close failure must not delete the equation.
  try { window.close(); }
  catch (error) { statusBox.textContent = 'Equation inserted. You can close this window.'; }
}
