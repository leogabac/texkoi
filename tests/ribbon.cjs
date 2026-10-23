const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../addin/main.js'), 'utf8');
let selection, listeners = 0, activations = 0, pending = new Map(), sequence = 0;
const app = {ApiEvent: {AddApiEventListener(name, callback) {assert.equal(name, 'WindowSelectionChange');listeners++;}},
  ActiveWindow: {get Selection() {return selection;}}};
const ctx = {console, Application: app, setTimeout(fn, delay) {assert(delay >= 16 && delay <= 96);pending.set(++sequence, fn);return sequence;}, clearTimeout(id) {pending.delete(id);}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const ribbon = {ActivateTab(id) {assert.equal(id, 'texkoiTab');activations++;}};
ctx.OnAddinLoad(ribbon);ctx.OnAddinLoad(ribbon);assert.equal(listeners,1);
function select(tag) {
 selection = {Type:2, ShapeRange:{Count:1,Item(){return {Tags:{Count:tag?1:0,Name(){return 'TEXKOI_SOURCE_HEX'},Value(){return '0045'}}}}}};
 ctx.OnEquationSelectionChange();
}
function flush() {const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn());}
select(true);assert.equal(activations,1);flush();assert.equal(activations,7);
select(false);flush();assert.equal(activations,7);
select(true);select(false);flush();assert.equal(activations,8);
selection={Type:0};ctx.OnEquationSelectionChange();flush();assert.equal(activations,8);
console.log('Ribbon listener deduplication, equation activation, and changed/non-equation selection checks passed');
