const assert = require('assert'), fs = require('fs'), vm = require('vm');
function element(value = '') {
  return {value, selectionStart:0, selectionEnd:0, listeners:{}, attributes:{}, textContent:'',
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); },
    setAttribute(key, value) { this.attributes[key] = value; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    setRangeText(text, start, end) { this.value = this.value.slice(0,start) + text + this.value.slice(end); this.selectionStart = this.selectionEnd = start + text.length; },
    dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); },
    focus() { document.activeElement = this; this.dispatchEvent({type:'focus'}); }
  };
}
const source = element('alpha beta\nsecond'), preamble = element('one two');
const toggle = element(), mode = element();
const items = {source,preamble,'vim-toggle':toggle,'vim-mode':mode};
const document = {activeElement:source, getElementById: id => items[id]};
const storage = {};
const localStorage = {getItem: key => storage[key], setItem: (key,value) => storage[key] = value};
const context = {document, localStorage, setTimeout, clearTimeout, fetch: () => Promise.resolve({ok:true,json:() => Promise.resolve({vim_mode:false})}), Event:function(type){this.type=type;}};
vm.runInNewContext(fs.readFileSync('addin/vim.js','utf8'), context);
(async function () {
const tick = () => new Promise(resolve => setImmediate(resolve));
function key(box, key, extra={}) {
  const event={type:'keydown',key,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};
  box.dispatchEvent(event); return event;
}
function insert(box, text) {
  box.dispatchEvent({type:'beforeinput',inputType:'insertText',preventDefault(){}});
  box.setRangeText(text,box.selectionStart,box.selectionEnd); box.dispatchEvent({type:'input'});
}
assert.equal(toggle.textContent, 'Vim: off');
assert.equal(key(source,'i').prevented, undefined);
toggle.dispatchEvent({type:'click'});
assert.equal(mode.textContent,'-- NORMAL --'); assert.equal(source.attributes['data-vim-normal'],'true');
key(source,'w'); assert.equal(source.selectionStart,6);
key(source,'d'); key(source,'w'); assert.equal(source.value,'alpha second');
key(source,'u'); assert.equal(source.value,'alpha beta\nsecond');
key(source,'r',{ctrlKey:true}); assert.equal(source.value,'alpha second');
key(source,'u'); key(source,'0'); key(source,'v'); key(source,'l'); key(source,'y');
assert.equal(source.value,'alpha beta\nsecond');
key(source,'p'); await tick(); assert.equal(source.value,'aallpha beta\nsecond' );

key(source,'u'); key(source,'i'); insert(source,'X');
assert.equal(mode.textContent, '-- INSERT --'); assert.equal(source.attributes['data-vim-normal'],'false'); assert(source.value.startsWith('X'));
const esc = key(source,'Escape'); assert(esc.prevented && esc.stopped); assert.equal(mode.textContent, '-- NORMAL --');
key(source,'u'); assert.equal(source.value, 'alpha beta\nsecond');
preamble.focus(); assert.equal(mode.textContent, '-- NORMAL --');
key(preamble,'d'); key(preamble,'d'); assert.equal(preamble.value,'');
key(preamble,'u'); assert.equal(preamble.value,'one two');
source.focus(); assert.equal(source.value,'alpha beta\nsecond');
key(source,'d'); key(source,'d'); assert.equal(source.value,'second');
key(source,'p'); await tick(); assert.equal(source.value,'second\nalpha beta');
key(source,'u'); key(source,'u'); assert.equal(source.value,'alpha beta\nsecond');
source.value = 'test'; source.setSelectionRange(0,0);
key(source,'i'); insert(source,'A'); insert(source,'B'); insert(source,'C'); key(source,'Escape');
assert.equal(source.value,'ABCtest'); key(source,'u'); assert.equal(source.value,'test');
key(source,'r',{ctrlKey:true}); assert.equal(source.value,'ABCtest'); key(source,'u');
key(source,'0'); key(source,'c'); key(source,'w'); insert(source,'X'); insert(source,'Y'); key(source,'Escape');
assert.equal(source.value,'XY'); key(source,'u'); assert.equal(source.value,'test');
key(source,'o'); insert(source,'N'); insert(source,'Z'); key(source,'Escape');
assert.equal(source.value,'test\nNZ'); key(source,'u'); assert.equal(source.value,'test');
toggle.dispatchEvent({type:'click'});
assert.equal(key(source,'Escape').prevented, undefined);
console.log('Vim modes, motions, operations, visual selection, undo, redo, and field isolation passed.');

})().catch(error => {console.error(error); process.exitCode=1;});
