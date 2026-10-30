import test from 'node:test';
import assert from 'node:assert/strict';
import {flowModel,moveDraft,flowHints,flowSignature} from '../band/flow-model.js';
const sl={gapSec:15,mcSec:60,targetMin:10};
const entry=(id,sec,energy,tuning='E',mc=false)=>({item:{id,mc},song:{title:id,sec,energy,tuning,bpm:200}});
test('time-axis includes MC after last song, gaps only between songs',()=>{
 const m=flowModel(sl,[entry('a',100,4,'E',true),entry('b',200,2,'D',true)]);
 assert.equal(m.total,435);assert.equal(m.songs[1].start,175);assert.equal(m.margin,165);assert.equal(m.switches,1);
 assert.deepEqual(m.segments.map(s=>s.kind),['song','mc','gap','song','mc']);
});
test('missing time and tuning remain unknown, energy never derives from BPM',()=>{
 const m=flowModel(sl,[entry('a',0,null,''),entry('b',100,2)]);
 assert.deepEqual(m.missing,[0]);assert.equal(m.margin,null);assert.equal(m.switches,0);assert.equal(m.unknownTuning,1);assert.equal(m.songs[0].energy,null);
});
test('moving duplicate song occurrences preserves item identity and MC',()=>{
 const e=[entry('a',100,5,'E',true),entry('b',200,2,'D'),entry('c',100,4,'E')];
 const before=flowSignature(sl,e),moved=moveDraft(e,1,1);
 assert.equal(flowSignature(sl,e),before);assert.deepEqual(moved.map(e=>e.item.id),['a','c','b']);assert(moved[0].item.mc);
 assert.equal(flowModel(sl,e).switches,2);assert.equal(flowModel(sl,moved).switches,1);assert.equal(flowModel(sl,e).total,flowModel(sl,moved).total);
 assert.deepEqual(moveDraft(e,0,-1),e);
});
test('goals and transition hints reference actual adjacent songs',()=>{
 const e=[entry('a',100,5,'E'),entry('b',200,1,'D')];
 assert(flowHints(sl,e,'afterglow').some(h=>h.title==='最後の余韻'));
 assert(flowHints(sl,e).some(h=>h.text.includes('15秒')));
 assert(flowHints(sl,e).every(h=>h.index>=0&&h.index<e.length));
 assert.deepEqual(flowHints(sl,[]),[]);
});
