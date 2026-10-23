const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(require('path').join(__dirname, '../addin/history.js'), 'utf8');
function scenario(mode) {
 const states = {before:{v:'before'}, after:{v:'after'}, middle:{v:'middle'}, other:{v:'other'}};
 let current=states.after, calls=0;
 const memory=new Map();
 const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const app={PluginStorage:storage,CommandBars:{GetEnabledMso:()=>true,ExecuteMso(command){
  calls++;
  if(mode==='unexpected'){current=states.other;return;}
  if(mode==='atomic'){current=command==='Undo'?states.before:states.after;return;}
  current=command==='Undo'?(current===states.after?states.middle:states.before):(current===states.before?states.middle:states.after);
 }}};
 const ctx={probeApp:()=>app,console};vm.createContext(ctx);vm.runInContext(code,ctx);
 ctx.deckState=()=>current;
 storage.setItem(ctx.historyKey,JSON.stringify({...states,phase:'applied'}));
 if(mode==='changed'){
  current=states.other;
  assert.throws(()=>ctx.equationHistory(false));assert.equal(calls,0);return;
 }
 if(mode==='unexpected'){
  assert.throws(()=>ctx.equationHistory(false));assert.equal(calls,1);assert(!memory.has(ctx.historyKey));return;
 }
 ctx.equationHistory(false);assert.equal(current,states.before);
 ctx.equationHistory(true);assert.equal(current,states.after);
 assert.equal(calls,mode==='atomic'?2:4);
}
for(const mode of ['paired','atomic','changed','unexpected'])scenario(mode);
console.log('Guarded history: paired/atomic undo-redo, changed-state refusal and intermediate-state stop passed');
