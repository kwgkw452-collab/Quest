import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = '5d25a597abe2573f3c7b2277f36d607dfe5e6875';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const source = read('engine/stories/S007.js');
const original = execFileSync('git', ['show', base + ':engine/stories/S007.js'], {cwd:root, encoding:'utf8'});
const storage = new Map();
const ctx = vm.createContext({console, GameConfig:{initialStoryId:'S001'}, localStorage:{getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,v), removeItem:k=>storage.delete(k)}, addEventListener(){}, StoryRegistry:{register(){}}});
ctx.window = ctx;
for (const p of ['engine/commands/story-commands.js','engine/managers/save-manager.js','engine/core/story-engine.js']) vm.runInContext(read(p),ctx,{filename:p});
function load(text) { vm.runInContext(text,ctx); return JSON.parse(JSON.stringify(ctx.S007.steps)); }
const old = load(original), steps = load(source);
const check = async (name, run) => { await run(); console.log('PASS '+name); };
await check('1 syntax, registration and 13 ordered scenes',()=>{
 assert.equal(ctx.S007.id,'S007');
 assert.deepEqual(steps.filter(s=>s.type==='background').map(s=>s.src),Array.from({length:13},(_,i)=>`images/007/S007-Scene-${String(i+1).padStart(2,'0')}.png`));
 assert.equal(ctx.StoryEngine.validate(ctx.S007).length,0);
});
await check('2 Scene 01–11 commands preserved exactly',()=>assert.deepEqual(steps.slice(0,old.length),old));
await check('3 Communication 10 questions and definition unchanged',()=>{
 assert.equal(steps.filter(s=>s.type==='question').length,10);
 assert.deepEqual(steps.filter(s=>s.type==='question'),old.filter(s=>s.type==='question'));
 assert.equal(read('data/s007-communication.js'),execFileSync('git',['show',base+':data/s007-communication.js'],{cwd:root,encoding:'utf8'}));
});
await check('4 confirmed joining conversation and ending',()=>{
 const extra=steps.slice(old.length), dialogue=extra.filter(s=>s.type==='dialogue');
 assert.equal(dialogue.length,18);
 assert.deepEqual(dialogue.slice(0,14).map(s=>s.text),['What will you do next?','We are looking for the Best Thing.',"The Best Thing? What's that?","We don't know yet.",'We travel around the world.','We go to many countries.','We meet many people and animals.','And we see many beautiful places!','Wow! I can take many pictures!','Pictures of people, animals, and places!','Do you want to come with us?','Yes! I want to see the world!','Welcome, Meg!',"Let's go together!"]);
 assert.equal(dialogue.at(-1).text,'Yes! Our new adventure!');
});
await check('5 joining flag persists through existing engine and Save reload',async()=>{
 const flag=steps.find(s=>s.type==='setFlag'&&s.key==='s007.megJoined');
 assert.ok(flag); assert.ok(steps.indexOf(flag)>steps.findIndex(s=>s.text==='Yes! I want to see the world!'));
 assert.ok(steps.indexOf(flag)<steps.findIndex(s=>s.src==='images/007/S007-Scene-13.png'));
 assert.equal(ctx.SaveManager.getFlag(flag.key,false),false);
 await ctx.StoryEngine.runStep(flag,{},0,ctx.S007);
 ctx.SaveManager.load(); assert.equal(ctx.SaveManager.getFlag(flag.key,false),true);
 await ctx.StoryEngine.runStep(flag,{},0,ctx.S007);ctx.SaveManager.load();
 assert.equal(ctx.SaveManager.getFlag(flag.key,false),true);
 assert.equal(ctx.SaveManager.getCompanionIds().length,0);
});
await check('6 PNG assets exist at 1560×720 and original 11 assets unchanged',()=>{
 for(let i=1;i<=13;i++){
 const p=`images/007/S007-Scene-${String(i).padStart(2,'0')}.png`, b=fs.readFileSync(path.join(root,p));
 if(i>=12){ assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),1560);assert.equal(b.readUInt32BE(20),720); }
 else assert.equal(execFileSync('git',['diff',base,'--',p],{cwd:root,encoding:'utf8'}),'');
 }
});
