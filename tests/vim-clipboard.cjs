const assert=require('assert'),fs=require('fs'),vm=require('vm');
function element(value='') { return {value,selectionStart:0,selectionEnd:0,listeners:{},setAttribute(){},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},setRangeText(t,a,b){this.value=this.value.slice(0,a)+t+this.value.slice(b);this.selectionStart=this.selectionEnd=a+t.length;},addEventListener(n,f){(this.listeners[n] ||= []).push(f);},dispatchEvent(e){for(const f of this.listeners[e.type]||[])f(e);},focus(){document.activeElement=this;}}; }
const source=element('alpha beta\nsecond'),preamble=element(),toggle=element(),mode=element();
const document={activeElement:source,getElementById:id=>({source,preamble,'vim-toggle':toggle,'vim-mode':mode}[id])};
let text='',rejectRead=false, pendingRead=null, status='';
const api={writeText: value=>{text=value;return Promise.resolve();},readText:()=>rejectRead?Promise.reject(Error('denied')):pendingRead?pendingRead:Promise.resolve(text)};
let fallbackText = null;
const context={document,setTimeout,clearTimeout,navigator:{clipboard:api},fetch:(url)=>Promise.resolve(url === 'settings' ? {ok:true,json:()=>Promise.resolve({vim_mode:false})} : fallbackText === null ? {ok:false} : {ok:true,json:()=>Promise.resolve({text:fallbackText})}),showStatus:m=>{status=m;},Event:function(type){this.type=type;}};
vm.runInNewContext(fs.readFileSync('addin/vim.js','utf8'),context);
function key(k) {source.dispatchEvent({type:'keydown',key:k,preventDefault(){},stopPropagation(){}});}
function tick(){return new Promise(resolve=>setImmediate(resolve));}
(async()=>{
 toggle.dispatchEvent({type:'click'});key('y');key('w');assert.equal(text,'alpha ');
 text='external';key('P');await tick();assert.equal(source.value,'externalalpha beta\nsecond');
 key('u');key('p');await tick();assert.equal(source.value,'aexternallpha beta\nsecond');
 key('u');key('y');key('y');assert.equal(text,'alpha beta\n');key('P');await tick();assert.equal(source.value,'alpha beta\nalpha beta\nsecond');
 key('u');key('p');await tick();assert.equal(source.value,'alpha beta\nalpha beta\nsecond');
 key('u');rejectRead=true; fallbackText='external fallback'; key('p');await tick();assert.equal(source.value,'aexternal fallbacklpha beta\nsecond');
 key('u'); fallbackText=null; status=''; key('p');await tick();assert.match(status,/local register/);
 key('u'); rejectRead=false;let complete;pendingRead=new Promise(r=>{complete=r;});key('p');key('l');complete('later');await tick();assert.equal(source.value,'alpha beta\nsecond');assert.match(status,/Paste cancelled/);
 console.log('Vim system clipboard writes, external paste, linewise paste, denial and delayed-paste safety passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
