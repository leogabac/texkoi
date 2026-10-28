const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../addin/editor.js'), 'utf8');
async function check(fail, edit = true, recoverSettings = false) {
  let settingsRequests = 0;
  const controls = {};
  for (const id of ['source', 'render', 'insert', 'status', 'format', 'size', 'preview', 'error-details', 'error-log', 'preamble', 'preamble-origin', 'preamble-open', 'preamble-reload']) {
    controls[id] = {value: id === 'size' ? '28' : id === 'format' ? 'svg' : 'x', appendChild() {}, focus() {}};
  }
  const tags = {TEXKOI_SIZE_PT: '28', TEXKOI_FORMAT: 'SVG', TEXKOI_NATURAL_WIDTH: '20', TEXKOI_NATURAL_HEIGHT: '10'};
  let originalDeleted = false, replacementDeleted = false, closed = false, stagingClosed = false;
  const savedPreamble = '\\usepackage{amsmath,amssymb}\n% saved snapshot\n';
  const defaultPreamble = '\\usepackage{amsmath,amssymb}\n% current user settings\n';
  let copied, pasted, boundaries = 0, activated = false, remembered = false;
  const original = {Id: 1, Width: 112, Height: 56, Left: 40, Top: 60, Rotation: 15, ZOrderPosition: 1,
    source: '\\alpha', preamble: savedPreamble, Delete() { if (fail === 'delete') throw Error('delete failed'); originalDeleted = true; }};
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
      if (fail === 'preamble') pasted.preamble = undefined;
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
    readPreamble(shape, required) { if (required && shape.preamble === undefined) throw Error('lost preamble'); return shape.preamble; },
    storePreamble(shape, text) {shape.preamble = text;},
    readTag: (shape, key) => tags[key] || '', storeSource(shape, source) {shape.source = source;},
    fetch: async (url, options) => {
      if (url === 'settings') {
        settingsRequests++;
        if (fail === 'settings' || (recoverSettings && settingsRequests === 1)) return {ok:false,json:async () => ({error:'Unknown TeXKoi setting: bad_key'})};
        return {ok:true,json:async () => ({default_size_pt:36,default_format:'png',preamble:defaultPreamble})};
      }
      const submitted = JSON.parse(options.body);
      assert.equal(submitted.preamble, edit ? savedPreamble : defaultPreamble);
      assert.equal(submitted.format, edit ? 'svg' : 'png');
      if (fail === 'network') throw new TypeError('Failed to fetch');
      return {status: fail === 'authorization' ? 403 : 200, ok: fail !== 'compile', json: async () => {
        if (fail === 'response') throw new SyntaxError('Not JSON');
        return fail === 'compile' ? {error:'invalid TeX'} : {path:'/tmp/new.svg',url:'/renders/new.svg',width:30,height:10,format:submitted.format,preamble:submitted.preamble};
      }};
    }};
  vm.createContext(context); vm.runInContext(code, context);
  await context.editorReady;
  await context.runAction(true);
  if (fail) {
    assert(!originalDeleted); assert(!closed);
    assert.equal(replacementDeleted, ['source', 'preamble', 'geometry', 'delete'].includes(fail));
  } else {
    assert.equal(originalDeleted, edit); assert(closed);
    assert.equal(pasted.Width, edit ? 168 : 108); assert.equal(pasted.Height, edit ? 56 : 36);
    assert.equal(pasted.Left, edit ? 40 : 100); assert.equal(pasted.Top, edit ? 60 : 150);
    assert.equal(pasted.source, edit ? '\\alpha' : 'x');
    assert.equal(pasted.preamble, edit ? savedPreamble : defaultPreamble);
    assert.equal(staging.PageSetup.SlideWidth, page.SlideWidth);
    assert.equal(boundaries, 2);
  }
  assert.equal(remembered, !fail && edit);
  assert.equal(stagingClosed, !['compile','network','authorization','response','settings'].includes(fail));
  if (fail === 'network') assert(controls.status.textContent.includes('Cannot reach TeXKoi Companion'));
  if (fail === 'authorization') assert(controls.status.textContent.includes('Restart WPS'));
  if (fail === 'response') assert(controls.status.textContent.includes('unexpected response'));
  assert(!controls.source.disabled, 'Source remains editable after errors');
  if (recoverSettings) assert.equal(settingsRequests,2);
  if (fail === 'settings') assert(controls.status.textContent.includes('Unknown TeXKoi setting'));
}
(async () => {
  await check(); await check(null, false); await check(null, false, true); await check('settings', false);
  for (const fail of ['compile', 'network', 'authorization', 'response', 'metadata', 'copy', 'paste', 'geometry', 'source', 'preamble', 'delete']) await check(fail);
  console.log('Staged insertion/update, geometry/source fidelity, cleanup and failure preservation checks passed');
})().catch(error => {console.error(error); process.exit(1);});
