const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code=fs.readFileSync(require('path').join(__dirname, '../addin/editor.js'),'utf8');
async function check(fail) {
 const controls={}; for (const id of ['source','render','insert','status','format','size','preview']) controls[id]={value:'',appendChild(){}};
 const tags={TEXKOI_SIZE_PT:'28', TEXKOI_FORMAT:'SVG',TEXKOI_NATURAL_WIDTH:'20',TEXKOI_NATURAL_HEIGHT:'10'};
 let originalDeleted=false, replacementDeleted=false, closed=false, inserted;
 const original={Id:1,Width:112,Height:56,Left:40,Top:60,Rotation:15,ZOrderPosition:1,Delete(){originalDeleted=true;}};
 const shapes={Count:1,Item(){return original},AddPicture(path,link,embed,left,top,width,height){
   inserted={left,top,width,height}; shapes.Count=2;
   return {ZOrderPosition:2,Tags:{Add(){if(fail==='metadata')throw Error('tag failed')}},Select(){},Delete(){replacementDeleted=true}};
 }};
 const context={console,URLSearchParams,document:{getElementById:id=>controls[id],querySelector:()=>({}),createElement:()=>({})},window:{location:{search:'?mode=edit'},close(){closed=true}},probeApp:()=>({ActiveWindow:{View:{Slide:{Shapes:shapes}}}}),selectedEquation:()=>original,readSource:()=>String.raw`\alpha`,readTag:(s,k)=>tags[k]||'',storeSource(){},fetch:async()=>({ok:fail!=='compile',json:async()=>fail==='compile'?{error:'invalid TeX'}:{path:'/tmp/new.svg',url:'/renders/new.svg',width:30,height:10,format:'svg'}})};
 vm.createContext(context);vm.runInContext(code,context);
 assert.equal(controls.source.value,String.raw`\alpha`); assert.equal(controls.format.value,'svg');
 await context.runAction(true);
 if(fail){assert(!originalDeleted);assert(!closed);assert.equal(replacementDeleted,fail==='metadata');}
 else {assert(originalDeleted);assert(closed);assert.equal(inserted.width,168);assert.equal(inserted.height,56);assert.equal(inserted.left,40);assert.equal(inserted.top,60);}
}
(async()=>{await check();await check('compile');await check('metadata');console.log('Edit restoration, manual scaling, successful replacement, and failure preservation checks passed');})().catch(e=>{console.error(e);process.exit(1)});
