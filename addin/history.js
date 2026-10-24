// Session-only, single-update history. Native Ctrl+Z is deliberately untouched.
var historyKey = (typeof texkoiProfile === 'undefined' ? 'texkoi' : texkoiProfile.id) + '.latest-update';
function historyStorage() { return probeApp().PluginStorage; }
function slideState(slide) {
  var items = [];
  for (var i = 1; i <= slide.Shapes.Count; i++) {
    var shape = slide.Shapes.Item(i);
    var tags = [];
    for (var j = 1; j <= shape.Tags.Count; j++) tags.push([String(shape.Tags.Name(j)), String(shape.Tags.Value(j))]);
    tags.sort(function (a, b) { return a[0].localeCompare(b[0]); });
    items.push({id: shape.Id, name: shape.Name, type: shape.Type,
      left: shape.Left, top: shape.Top, width: shape.Width, height: shape.Height,
      rotation: shape.Rotation, text: shape.HasTextFrame ? String(shape.TextFrame.TextRange.Text) : '', tags: tags});
  }
  items.sort(function (a, b) { return a.id - b.id; });
  return items;
}
function deckState() {
  var presentation = probeApp().ActivePresentation;
  var slides = [];
  for (var i = 1; i <= presentation.Slides.Count; i++) {
    var slide = presentation.Slides.Item(i);
    slides.push({id: slide.SlideID, shapes: slideState(slide)});
  }
  return {name: presentation.FullName, slides: slides};
}
function rememberUpdate(before, after, slideID) {
  var middle = JSON.parse(JSON.stringify(before));
  var oldSlide = middle.slides.filter(function (s) { return s.id === slideID; })[0];
  var newSlide = after.slides.filter(function (s) { return s.id === slideID; })[0];
  newSlide.shapes.forEach(function (shape) {
    if (!oldSlide.shapes.some(function (old) { return old.id === shape.id; })) oldSlide.shapes.push(shape);
  });
  oldSlide.shapes.sort(function (a, b) { return a.id - b.id; });
  historyStorage().setItem(historyKey, JSON.stringify({before: before, after: after, middle: middle, phase: 'applied'}));
}
function sameState(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function equationHistory(redo) {
  var storage = historyStorage();
  var raw = storage.getItem(historyKey);
  if (!raw) throw new Error('No equation update is available in this session.');
  var record = JSON.parse(raw);
  var from = redo ? 'before' : 'after', to = redo ? 'after' : 'before';
  if (record.phase !== (redo ? 'undone' : 'applied') || !sameState(deckState(), record[from])) {
    throw new Error('The presentation no longer matches the recorded update. Use native undo/redo.');
  }
  var command = redo ? 'Redo' : 'Undo';
  var bars = probeApp().CommandBars;
  if (!bars.GetEnabledMso(command)) throw new Error(command + ' is not available.');
  // Invalidate before invoking native commands: a partial or unexpected transition
  // must never leave a second click armed to blindly reverse another edit.
  storage.removeItem(historyKey);
  bars.ExecuteMso(command);
  var current = deckState();
  if (!sameState(current, record[to])) {
    if (!sameState(current, record.middle)) throw new Error('Unexpected undo state; stopped after one command. Use native undo/redo to inspect it.');
    if (!bars.GetEnabledMso(command)) throw new Error('The second ' + command.toLowerCase() + ' is unavailable.');
    bars.ExecuteMso(command);
    if (!sameState(deckState(), record[to])) throw new Error('Unexpected result after two commands. Use native undo/redo to inspect it.');
  }
  record.phase = redo ? 'applied' : 'undone';
  storage.setItem(historyKey, JSON.stringify(record));
}
function OnUndoEquationUpdate() {
  try { equationHistory(false); } catch (error) { alert(error.message || String(error)); }
}
function OnRedoEquationUpdate() {
  try { equationHistory(true); } catch (error) { alert(error.message || String(error)); }
}
