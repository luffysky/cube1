import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTES,SONG_SECONDS,BEAT,judge,makeState,start,tap,advance} from '../../dist/games/beat-overdrive/engine.mjs';
test('original fixed chart has notes across four lanes and finishes within song',()=>{
 assert.equal(NOTES.length,48);assert.equal(new Set(NOTES.map(x=>x.lane)).size,4);
 assert.ok(NOTES.at(-1).at<SONG_SECONDS);assert.equal(BEAT,.5);
});
test('perfect/good/miss thresholds are strict',()=>{
 assert.equal(judge(.07).grade,'perfect');
 assert.equal(judge(.12).grade,'good');
 assert.equal(judge(.2).grade,'miss');
});
test('valid lane taps score, duplicate notes cannot be farmed',()=>{
 const s=start(makeState()),n=NOTES[0];
 assert.equal(tap(s,n.lane,n.at),true);assert.equal(s.combo,1);
 assert.equal(tap(s,n.lane,n.at),false);assert.equal(s.combo,0);
});
test('pause and invalid lanes cannot earn score',()=>{
 const s=makeState();
 assert.equal(tap(s,0,2),false);
 start(s);assert.equal(tap(s,-1,2),false);
 assert.equal(tap(s,5,2),false);assert.equal(s.score,0);
});
test('timeout ends session and restart clears score and input history',()=>{
 const s=start(makeState());advance(s,32); // dt limited to .1
 assert.ok(s.elapsed<=.1);s.elapsed=SONG_SECONDS-.05;advance(s,.1);
 assert.equal(s.over,true);assert.equal(s.active,false);
 start(s);assert.equal(s.over,false);assert.equal(s.hits.length,0);
});

test('start does not wait for a mobile audio context to resume', async () => {
 const {readFileSync}=await import('node:fs');
 const vm=await import('node:vm');
 const elements=new Map();
 const element=()=>({style:{},value:'0',addEventListener(name,handler){this[name]=handler;},append(){}});
 const document={
  querySelector:()=>element(),querySelectorAll:()=>[],createElement:element,addEventListener(){},
  getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
 };
 let started=false;
 const source=readFileSync(new URL('../../dist/games/beat-overdrive/game.mjs',import.meta.url),'utf8');
 vm.runInNewContext(source.replace(/^import .*\n/,''),{
  document,window:{AudioContext:class {resume(){return new Promise(()=>{});}},addEventListener(){}},
  requestAnimationFrame(){},performance:{now:()=>0},NOTES:[],makeState:()=>({}),start(){started=true;},
 });
 elements.get('start').click();
 assert.equal(started,true);
 assert.match(elements.get('status').textContent,/跟住節拍/);
});
