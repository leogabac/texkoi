const assert = require('assert'), fs = require('fs'), vm = require('vm');
function element() { return {value:'',selectionStart:0,selectionEnd:0,listeners:{},addEventListener(n,f){this.listeners[n]=f;},setAttribute(){},setSelectionRange(){},focus(){},dispatchEvent(){}}; }
async function run(toggled) {
  const source=element(), preamble=element(), toggle=element(), mode=element();
  const items={source,preamble,'vim-toggle':toggle,'vim-mode':mode};
  let resolve;
  const response = new Promise(r => {resolve=r;});
  const document={activeElement:source,getElementById:id=>items[id]};
  const context={document, fetch:()=>response, Event:function(type){this.type=type;}};
  vm.runInNewContext(fs.readFileSync('addin/vim.js','utf8'),context);
  if (toggled) { toggle.listeners.click(); toggle.listeners.click(); }
  resolve({ok:true,json:()=>Promise.resolve({vim_mode:true})});
  await new Promise(r=>setImmediate(r));
  assert.equal(toggle.textContent,toggled?'Vim: off':'Vim: on');
  if (!toggled) assert.equal(mode.textContent,'-- NORMAL --');
}
Promise.all([run(false),run(true)]).then(()=>console.log('Vim configured default and in-flight toggle precedence passed.')).catch(e=>{console.error(e);process.exitCode=1;});
