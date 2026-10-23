function OnAddinLoad(ribbonUI) { return true; }
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
  try { probeApp().ShowDialog('http://127.0.0.1:3899/editor.html', 'TexKoi — New equation', 700, 600, true); }
  catch (error) { probeError(error); }
}
function storeSource(shape, source) {
  var hex = '';
  for (var i = 0; i < source.length; i++) hex += ('0000' + source.charCodeAt(i).toString(16)).slice(-4);
  shape.Tags.Add('TEXKOI_SOURCE_HEX', hex);
  shape.Tags.Add('TEXKOI_VERSION', '1');
}
