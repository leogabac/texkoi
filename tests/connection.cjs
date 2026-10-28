const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../addin/connection.js'), 'utf8');
function setup(search = '') {
  const controls = {};
  for (const id of ['connection-status','connection-help','connection-retry','connection-close','wps-theme']) controls[id] = {};
  const images = [], timers = new Map(), navigations = [];
  let sequence = 0;
  const context = {console, URL, URLSearchParams, Date,
    document: {getElementById: id => controls[id], querySelector: () => ({})},
    window: {location: {search, replace: url => navigations.push(url)}, close() {}},
    Image: function () {images.push(this);},
    texkoiProfile: {mode:'companion'}, profileName: () => 'TeXKoi',
    editorUrl: query => 'http://127.0.0.1:3901/private/editor.html' + (query || ''),
    setTimeout(fn) {timers.set(++sequence,fn);return sequence;}, clearTimeout(id) {timers.delete(id);}};
  vm.createContext(context);vm.runInContext(code,context);
  return {context, controls, images, timers, navigations};
}
for (const query of ['', '?mode=edit']) {
  const s = setup(query);
  assert(s.controls['wps-theme'].href.startsWith('http://127.0.0.1:3901/private/wps-theme.css?t='));
  assert(s.images[0].src.startsWith('http://127.0.0.1:3901/private/icons/new-equation.png?connection='));
  s.images[0].onload();
  assert.deepEqual(s.navigations, ['http://127.0.0.1:3901/private/editor.html' + query]);
  assert.equal(s.timers.size,0);
}
{
  const s=setup();s.images[0].onerror();
  assert.equal(s.controls['connection-help'].hidden,false);
  assert.equal(s.controls['connection-retry'].disabled,false);
  s.controls['connection-retry'].onclick();s.images[1].onload();
  assert.equal(s.navigations.length,1);
}
{
  const s=setup(), oldCallback=s.images[0].onload;
  [...s.timers.values()][0]();
  assert.equal(s.controls['connection-retry'].disabled,false);
  s.context.checkConnection();oldCallback();
  assert.equal(s.navigations.length,0);
  s.images[1].onload();assert.equal(s.navigations.length,1);
}
console.log('Connection screen: new/edit routing, unreachable/timeout messages, retry and stale callback checks passed');
