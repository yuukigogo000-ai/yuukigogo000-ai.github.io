import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {deflateRawSync} from 'node:zlib';

const read = f => fs.readFileSync(new URL('../band/' + f, import.meta.url), 'utf8');
globalThis.localStorage = {getItem:()=>null, setItem(){}};
globalThis.window = {addEventListener(){}};
globalThis.document = {addEventListener(){}};
const asModule = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const storeUrl = asModule(read('store.js'));
const share = await import(asModule(read('share.js').replace('"./store.js"', JSON.stringify(storeUrl))));
const source = read('app.js');
const begin = source.indexOf('function applyStateHook() {');
const end = source.indexOf('\nfunction bindSetlistBar()', begin);
assert(begin >= 0 && end > begin);
const hook = source.slice(begin, end);
function fixture(host, state) {
  const sl = {items:[{id:'item',songId:'song'}], targetMin:30};
  vm.runInNewContext(hook+'\napplyStateHook();', {location:{hostname:host,search:'?state='+state},URLSearchParams,activeSetlist:()=>sl,renderAll(){},uid:()=> 'new-id'});
  return sl;
}
test('public origins cannot modify setlists through state links',()=>{
  for(const host of ['yuukigogo000-ai.github.io','bandhub.example','localhost.example','127.0.0.2'])
    for(const state of ['empty','long','over']) {
      const s=fixture(host,state); assert.equal(s.items.length,1); assert.equal(s.targetMin,30);
    }
});
test('development fixtures remain explicitly local',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]']) assert.equal(fixture(host,'empty').items.length,0);
});
const compact={n:'Synthetic setlist',t:30,g:15,m:90,s:[['Synthetic song',120,'C','',180,3,0,'memo','']]};
const payload=(x,compressed)=> (compressed?'1.':'0.')+(compressed?deflateRawSync(Buffer.from(JSON.stringify(x))):Buffer.from(JSON.stringify(x))).toString('base64url');
test('normal compressed and plain shared links preserve contents',async()=>{
  for(const c of [true,false]) {const decoded=await share.decodeShare(payload(compact,c));assert.equal(decoded.name,compact.n);assert.equal(decoded.rows[0].song.title,'Synthetic song');}
});
test('large expanded, large plain and malformed inputs are rejected',async()=>{
  const big={...compact,n:'X'.repeat(2*1024*1024+1)};
  for(const p of [payload(big,true),payload(big,false),'1.invalid','2.e30',null]) await assert.rejects(()=>share.decodeShare(p));
});
test('cache activation removes only old BANDHUB caches',async()=>{
  let task;const handlers={};const keys=new Set(['setlism-v2','setlism-v3-security-20261013','other-app']);
  vm.runInNewContext(read('sw.js'), {self:{addEventListener:(k,f)=>handlers[k]=f,clients:{claim:async()=>{}}},caches:{keys:async()=>[...keys],delete:async k=>keys.delete(k)}});
  handlers.activate({waitUntil:p=>task=p});await task;
  assert.deepEqual([...keys],['setlism-v3-security-20261013','other-app']);
});
