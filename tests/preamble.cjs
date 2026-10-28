const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../addin/main.js'),'utf8'),ctx);
function shape() {
 const values=new Map();return {values,Tags:{get Count(){return values.size;},Name(i){return [...values.keys()][i-1];},Value(i){return [...values.values()][i-1];},Add(key,value){assert(value.length<=240);values.set(key,value);}}};
}
assert.equal(ctx.readPreamble(shape()), '\\usepackage{amsmath,amssymb}\n');
assert.throws(()=>ctx.readPreamble(shape(),true), /lost its preamble/);
for(const text of ['', '\\usepackage{amsmath,amssymb}\n\\newcommand{\\vect}[1]{\\mathbf{#1}}', '% Unicode 漢字 🐟\n'+'x'.repeat(19000)]) {
 const original=shape();ctx.storePreamble(original,text);
 assert.equal(ctx.readPreamble(original,true),text);
 const pasted=shape();for(const [key,value] of original.values)pasted.Tags.Add(key,value);
 assert.equal(ctx.readPreamble(pasted,true),text);
}
{
 const damaged=shape();ctx.storePreamble(damaged,'x'.repeat(200));damaged.values.delete('TEXKOI_PREAMBLE_0001');
 assert.throws(()=>ctx.readPreamble(damaged,true),/incomplete/);
}
{
 const damaged=shape();ctx.storePreamble(damaged,'x');damaged.values.set('TEXKOI_PREAMBLE_LENGTH','5');
 assert.throws(()=>ctx.readPreamble(damaged,true),/incomplete/);
}
{
 const damaged=shape();ctx.storePreamble(damaged,'x');damaged.values.delete('TEXKOI_PREAMBLE_PARTS');
 assert.throws(()=>ctx.readPreamble(damaged),/incomplete/);
}
assert.throws(()=>ctx.storePreamble(shape(),'x'.repeat(20001)),/Invalid/);
console.log('Preamble snapshots: legacy defaults, UTF-16 chunking, paste round trips, and damaged metadata rejection passed');
