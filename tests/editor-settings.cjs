// The existing insertion suite covers saved preamble selection and retrying bad
// settings. This check isolates editing an old equation without any config GET.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const controls={};for(const id of ['source','preamble','preamble-origin','render','insert','status','format','size','error-details','error-log','preamble-open','preamble-reload'])controls[id]={focus(){}};
const legacy='\\usepackage{amsmath,amssymb}\n';
const target={Id:1,Width:100,Height:50,Left:0,Top:0,Rotation:0,ZOrderPosition:1};
const app={ActiveWindow:{Presentation:{},View:{Slide:{}}}};
let requests=0;
const ctx={console,URLSearchParams,document:{getElementById:id=>controls[id],querySelector:()=>({}),addEventListener(){}},
 window:{location:{search:'?mode=edit'}},profileName:()=> 'TeXKoi',probeApp:()=>app,selectedEquation:()=>target,
 readSource:()=> '\\alpha',readPreamble:()=>legacy,readTag:(_,key)=>({TEXKOI_SIZE_PT:'28',TEXKOI_FORMAT:'SVG'}[key]||''),
 fetch:async()=>{requests++;throw Error('Invalid current configuration');}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../addin/editor.js'),'utf8'),ctx);
assert.equal(requests,0);
assert.equal(controls.preamble.value,legacy);
assert.equal(controls.size.value,28);
assert.equal(controls.format.value,'svg');
console.log('Legacy editor keeps built-in preamble and stored size/format without reading current configuration.');
