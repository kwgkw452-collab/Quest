'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {legacySnapshot,LEGACY_KEY}=require('./legacy-save.cjs');
const {createRunner}=require('./runner.cjs');
const {createSaveStore}=require('./save.cjs');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function storage(){
 const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
function legacy(s){
 const ctx={window:null,localStorage:s,GameConfig:{initialStoryId:'S001',autoSaveStepInterval:0},addEventListener(){}};ctx.window=ctx;
 vm.runInNewContext(read('engine/managers/save-manager.js'),ctx);
 return ctx.SaveManager;
}
for(const id of ['S005','S006','S007']){
 test(id+' old cursor executes corresponding next legacy dialogue, reload and rollback read',async()=>{
  const s=storage(),manager=legacy(s);
  const pack=require('./stories/'+id+'/story.json'),map=require('./stories/'+id+'/legacy-cursors.json');
  const ctx={window:null,StoryRegistry:{register(story){ctx.story=story;}}};ctx.window=ctx;
  for(const file of ['engine/commands/story-commands.js','engine/core/story-compiler.js','engine/stories/'+id+'.js'])vm.runInNewContext(read(file),ctx);
  const source=ctx.StoryCompiler.compile(ctx.story).steps;
  const oldIndex=id==='S005'?3:source.findIndex((x,i)=>i>20&&x.type==='dialogue');
  const first=(step)=>step.type==='sequence'?step.steps.find(x=>x.type==='dialogue'):step;
  const expected=first(source[oldIndex]);
  assert.equal(expected.type,'dialogue');
  manager.setPlayerName('QA fixture');manager.setFlag('unrelated',true);manager.addItem('test',2);
  manager.setProgress(id,oldIndex,{marker:'old state'});
  const raw=s.getItem(LEGACY_KEY),snapshot=legacySnapshot(s,pack,map);
  const store=createSaveStore({storage:s,key:'quest.v2.test.'+id});
  const runner=createRunner(pack,{initialSnapshot:snapshot,storage:store});
  const event=await runner.advance();assert.equal(event.type,'line');assert.equal(event.text,expected.text);assert.equal(event.speaker,expected.speaker||null);
  store.write(runner.snapshot());
  const restored=createRunner(pack,{initialSnapshot:createSaveStore({storage:s,key:'quest.v2.test.'+id}).read()});
  assert.deepEqual(restored.snapshot(),runner.snapshot());
  assert.equal(s.getItem(LEGACY_KEY),raw);
  assert.equal(legacy(s).load().progress.currentStepIndex,oldIndex);
  assert.equal(legacy(s).getData().player.name,'QA fixture');
  assert.equal(legacy(s).getItemCount('test'),2);
  const other=require('./stories/'+(id==='S005'?'S006':'S005')+'/story.json');
  assert.equal(legacySnapshot(s,other,null),null);
  assert.equal(s.getItem(LEGACY_KEY),raw);
 });
}
test('invalid legacy cursor is rejected without writing original',()=>{
 const s=storage(),manager=legacy(s),p=require('./stories/S006/story.json'),mapping=require('./stories/S006/legacy-cursors.json');
 manager.setProgress(p.id,99999);const raw=s.getItem(LEGACY_KEY);
 assert.throws(()=>legacySnapshot(s,p,mapping),/INVALID_LEGACY_CURSOR/);
 assert.equal(s.getItem(LEGACY_KEY),raw);
});
