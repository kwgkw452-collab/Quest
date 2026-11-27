'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const {validate}=require('../../schema.cjs');
const story=JSON.parse(fs.readFileSync(path.join(__dirname,'story.json'),'utf8'));
test('S008 candidate conforms to V2 schema',()=>assert.deepEqual(validate(story),[]));
test('S008 has six reachable scenes ending without loops',()=>{
 let id=story.entry,visited=new Set();
 while(true){
  assert.ok(story.scenes[id]&&!visited.has(id),'missing or cyclic scene '+id);
  visited.add(id);
  const steps=story.scenes[id].steps;
  assert.ok(steps.length>1);
  const last=steps.at(-1);
  if(last.type==='end')break;
  assert.equal(last.type,'goto');
  id=last.to;
 }
 assert.deepEqual([...visited],story.sceneOrder);
});
test('S008 has five unique communication goals with three supports and no battles',()=>{
 const ids=story.sceneOrder.flatMap(id=>story.scenes[id].steps.filter(x=>x.type==='challenge').map(x=>x.id));
 assert.equal(ids.length,5);
 assert.equal(new Set(ids).size,5);
 for(const id of ids){const c=story.challenges[id];assert.equal(c.hints.length,3);assert.ok(c.rule.accept.includes(c.modelEn));}
 assert.ok(!story.battles);
});
test('S008 candidate does not reference unapproved graphics or audio',()=>{
 for(const scene of Object.values(story.scenes))for(const step of scene.steps){
  assert.ok(!['scene','battle','document'].includes(step.type));
  assert.equal(step.voice,undefined);
 }
});