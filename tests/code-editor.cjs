const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
function element() {
  return {children: [], listeners: {}, style: {}, scrollTop: 0, scrollLeft: 0,
    selectionStart: 0, selectionEnd: 0, value: '',
    setAttribute() {}, insertBefore(child) { this.children.push(child); },
    appendChild(child) { this.children.push(child); },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    dispatchEvent(event) { if (this.listeners[event.type]) this.listeners[event.type](event); },
    setRangeText(text, start, end, mode) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      this.selectionStart = mode === 'select' ? start : start + text.length;
      this.selectionEnd = start + text.length;
    }};
}
const source = element(), preamble = element();
source.value = '\\alpha{a}\n% comment'; source.selectionStart = 7;
source.parentNode = element(); preamble.parentNode = element();
const document = {createElement: element, getElementById: id => id === 'source' ? source : preamble};
const context = {document, Event: function(type) { this.type = type; }};
vm.runInNewContext(fs.readFileSync('addin/code-editor.js', 'utf8'), context);
const wrapper = source.parentNode.children[0];
assert.equal(wrapper.children[0].textContent, '1\n2');
assert.match(wrapper.children[1].innerHTML, /tex-command/);
assert.match(wrapper.children[1].innerHTML, /tex-comment/);
assert.match(wrapper.children[1].innerHTML, /tex-match/);
source.texkoiBlockCursor = true; source.texkoiSync();
assert.match(wrapper.children[1].innerHTML, /vim-block-cursor/);
source.selectionStart = source.value.length; source.texkoiSync();
assert.match(wrapper.children[1].innerHTML, /vim-block-cursor/);
source.texkoiBlockCursor = false; source.texkoiSync();
assert.doesNotMatch(wrapper.children[1].innerHTML, /vim-block-cursor/);
source.value = 'a\nb'; source.selectionStart = 0; source.selectionEnd = 3;
source.listeners.keydown({key:'Tab', preventDefault() {}});
assert.equal(source.value, '  a\n  b');
source.listeners.keydown({key:'Tab', shiftKey:true, preventDefault() {}});
assert.equal(source.value, 'a\nb');
console.log('Code editor line numbers, highlighting, bracket matching and indentation passed.');
