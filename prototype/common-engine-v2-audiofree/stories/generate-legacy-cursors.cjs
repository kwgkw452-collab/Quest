'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function mapStory(id){
 const ctx={window:null,StoryRegistry:{register(s){ctx.story=s;}}};ctx.window=ctx;
 for(const file of ['engine/commands/story-commands.js','engine/core/story-compiler.js','engine/stories/'+id+'.js'])vm.runInNewContext(read(file),ctx);
 const original=JSON.parse(JSON.stringify(ctx.StoryCompiler.compile(ctx.story).steps));
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,id,'story.json'),'utf8'));
 const steps=pack.sceneOrder.flatMap(scene=>pack.scenes[scene].steps.map((step,index)=>({scene,index,step}))).filter(x=>!['goto','end'].includes(x.step.type));
 const flat=s=>s.type==='sequence'?s.steps.flatMap(flat):[s];
 function normalize(s){
  if(s.type==='background')return {type:'scene',asset:s.src};
  if(s.type==='dialogue')return {type:'line',speaker:s.speaker||null,text:s.text};
  if(s.type==='question')return {type:'challenge',id:s.questionId};
  if(s.type==='s006EndingLetter')return {type:'document',id:'endingLetter'};
  if(s.type==='setFlag')return {type:s.type,key:s.key,value:s.value};
  return {type:s.type};
 }
 function newShape(s){
  if(s.type==='line')return {type:s.type,speaker:s.speaker||null,text:s.text};
  if(s.type==='scene')return {type:s.type,asset:s.asset};
  if(['challenge','document'].includes(s.type))return {type:s.type,id:s.id};
  if(s.type==='setFlag')return {type:s.type,key:s.key,value:s.value};
  return {type:s.type};
 }
 let n=0;
 const cursors=original.map(s=>{
  const {scene,index}=steps[n];
  for(const child of flat(s)){
   // Existing conversion omits clear immediately before a new full-frame background.
   if(child.type==='clear'&&steps[n]?.step.type==='scene')continue;
   assert.deepEqual(newShape(steps[n++].step),normalize(child),id+' command mismatch');
  }
  return {scene,index};
 });
 assert.equal(n,steps.length);
 const last=pack.sceneOrder.at(-1);
 const end=pack.scenes[last].steps.findIndex(s=>s.type==='end');
 assert(end>=0);cursors.push({scene:last,index:end});
 return {storyId:id,cursors};
}
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.json'),'utf8'));
for(const entry of catalog.stories){
 const result=JSON.stringify(mapStory(entry.id),null,2)+'\n';
 const dest=path.join(__dirname,entry.id,'legacy-cursors.json');
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(dest,'utf8'),result);
 else fs.writeFileSync(dest,result);
}
