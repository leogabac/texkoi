const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const controls = {};
for (const id of ['source','preamble','preamble-origin','preamble-open','preamble-reload','render','insert','status','format','size','preview','error-details','error-log']) controls[id] = {focus(){}};
const saved = '\\usepackage{amsmath,amssymb}\n% equation snapshot\n';
const current = '\\usepackage{amsmath,amssymb}\n\\newcommand{\\vect}[1]{\\mathbf{#1}}\n';
const target = {Id:1,Width:100,Height:50,Left:1,Top:2,Rotation:0,ZOrderPosition:1};
const app = {ActiveWindow:{Presentation:{},View:{Slide:{}}}};
let sent, error = false;
const ctx = {console,URLSearchParams,document:{getElementById:id=>controls[id],querySelector:()=>({}),addEventListener(){}},
  window:{location:{search:'?mode=edit'}},profileName:()=> 'TeXKoi',probeApp:()=>app,selectedEquation:()=>target,
  readSource:()=> '\\alpha',readPreamble:()=>saved,readTag:(_,key)=>({TEXKOI_SIZE_PT:'28',TEXKOI_FORMAT:'SVG'}[key]||''),
  fetch:async (url,options)=>{
    sent={url,options};
    if(error)return {ok:false,json:async()=>({error:'Cannot read preamble'})};
    if(url==='open-preamble')return {ok:true,json:async()=>({ok:true})};
    return {ok:true,json:async()=>({default_size_pt:64,default_format:'png',preamble:current,preamble_path:'/settings/custom.tex'})};
  }};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../addin/editor.js'),'utf8'),ctx);
(async()=>{
  await controls['preamble-open'].onclick();
  assert.equal(sent.url,'open-preamble');
  assert.equal(sent.options.headers['X-TeXKoi'],'open-preamble');
  assert.equal(sent.options.body,undefined);
  assert.equal(controls.preamble.value,saved);
  assert(controls.status.textContent.includes('After saving'));
  ctx.rendered={};
  await controls['preamble-reload'].onclick();
  assert.equal(controls.preamble.value,current);
  assert.equal(controls.source.value,'\\alpha');
  assert.equal(controls.size.value,28);
  assert.equal(controls.format.value,'svg');
  assert.equal(ctx.editState.preamble,saved);
  assert.equal(controls.preview.className,'preview stale');
  assert(!controls['preamble-open'].disabled && !controls['preamble-reload'].disabled);
  error=true;
  await controls['preamble-reload'].onclick();
  assert.equal(controls.preamble.value,current);
  assert.equal(controls.status.textContent,'Cannot read preamble');
  await controls['preamble-open'].onclick();
  assert.equal(controls.status.textContent,'Cannot read preamble');
  console.log('Preamble open/reload: user snapshot preserved until explicit reload, equation settings preserved, failures retain content.');
})().catch(error=>{console.error(error);process.exit(1);});
