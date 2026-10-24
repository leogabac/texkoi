const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../addin/editor.js'), 'utf8');
async function check(fail, edit = true) {
  const controls = {};
  for (const id of ['source', 'render', 'insert', 'status', 'format', 'size', 'preview', 'error-details', 'error-log']) {
    controls[id] = {value: id === 'size' ? '28' : id === 'format' ? 'svg' : 'x', appendChild() {}, focus() {}};
  }
  const tags = {TEXKOI_SIZE_PT: '28', TEXKOI_FORMAT: 'SVG', TEXKOI_NATURAL_WIDTH: '20', TEXKOI_NATURAL_HEIGHT: '10'};
  let originalDeleted = false, replacementDeleted = false, closed = false, stagingClosed = false;
  let copied, pasted, boundaries = 0, activated = false, remembered = false;
  const original = {Id: 1, Width: 112, Height: 56, Left: 40, Top: 60, Rotation: 15, ZOrderPosition: 1,
    source: '\\alpha', Delete() { if (fail === 'delete') throw Error('delete failed'); originalDeleted = true; }};
  function picture(left, top, width, height) {
    return {Left: left, Top: top, Width: width, Height: height,
      Tags: {Add() {if (fail === 'metadata') throw Error('tag failed');}},
      Copy() {if (fail === 'copy') throw Error('copy failed'); copied = this;}};
  }
  const shapes = {Count: edit ? 1 : 0, Item() {return original;},
    AddPicture() {throw Error('Must not call AddPicture on the target');},
    Paste() {
      assert(activated);
      assert(stagingClosed, 'Staging must be closed before target paste');
      if (fail === 'paste') throw Error('paste failed');
      pasted = {...copied, ZOrderPosition: edit ? 2 : 1,
        Select() {}, Delete() {replacementDeleted = true;}};
      if (fail === 'geometry') pasted.Width += 10;
      if (fail === 'source') pasted.source = 'lost';
      this.Count++;
      return {Item() {return pasted;}};
    }};
  const page = {SlideWidth: 960, SlideHeight: 540};
  const targetWindow = {Presentation: {PageSetup: page}, View: {Slide: {Shapes: shapes}}, Activate() {activated = true;}};
  const staging = {PageSetup: {}, Slides: {Add() {return {Shapes: {AddPicture(path, link, embed, left, top, width, height) {
    return picture(left, top, width, height);
  }}};}}, Close() {assert.equal(this.Saved, -1, 'Discard only the staging deck without prompting'); stagingClosed = true;}};
  const app = {ActiveWindow: targetWindow, StartNewUndoEntry() {boundaries++;}, Presentations: {Add(withWindow) {
    assert.equal(withWindow, 0); return staging;
  }}};
  const context = {console, URLSearchParams,
    document: {getElementById: id => controls[id], querySelector: () => ({}), createElement: () => ({style: {}}), addEventListener() {}},
    window: {location: {search: edit ? '?mode=edit' : ''}, close() {closed = true;}},
    profileName: () => 'TeXKoi',
    historyKey: 'test-history', historyStorage: () => ({removeItem() {}}),
    deckState: () => ({}), rememberUpdate() {remembered = true;},
    activateTeXKoiTab() {},
    probeApp: () => app, selectedEquation: () => original, readSource: shape => shape.source,
    readTag: (shape, key) => tags[key] || '', storeSource(shape, source) {shape.source = source;},
    fetch: async () => ({ok: fail !== 'compile', json: async () => fail === 'compile' ? {error: 'invalid TeX'} :
      {path: '/tmp/new.svg', url: '/renders/new.svg', width: 30, height: 10, format: 'svg'}})};
  vm.createContext(context); vm.runInContext(code, context);
  await context.runAction(true);
  if (fail) {
    assert(!originalDeleted); assert(!closed);
    assert.equal(replacementDeleted, ['source', 'geometry', 'delete'].includes(fail));
  } else {
    assert.equal(originalDeleted, edit); assert(closed);
    assert.equal(pasted.Width, edit ? 168 : 84); assert.equal(pasted.Height, edit ? 56 : 28);
    assert.equal(pasted.Left, edit ? 40 : 100); assert.equal(pasted.Top, edit ? 60 : 150);
    assert.equal(pasted.source, edit ? '\\alpha' : 'x');
    assert.equal(staging.PageSetup.SlideWidth, page.SlideWidth);
    assert.equal(boundaries, 2);
  }
  assert.equal(remembered, !fail && edit);
  assert.equal(stagingClosed, fail !== 'compile');
}
(async () => {
  await check(); await check(null, false);
  for (const fail of ['compile', 'metadata', 'copy', 'paste', 'geometry', 'source', 'delete']) await check(fail);
  console.log('Staged insertion/update, geometry/source fidelity, cleanup and failure preservation checks passed');
})().catch(error => {console.error(error); process.exit(1);});
