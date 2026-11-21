const assert=require('assert');
const fs=require('fs');const vm=require('vm');const path=require('path');
const root=path.resolve(__dirname,'..');
const qdb=new Map(),stories=new Map();const rules=[],pools=[];
let lotteryInits=0;
const C={};for(const type of ['clear','background','dialogue','question','hideDialogue']) C[type]=(...args)=>({type,args});
const context={window:{SpeechEngine:{stop(){}}},StoryCommands:C,StoryRegistry:{register(s){assert(!stories.has(s.id));stories.set(s.id,s)}},QuestionDatabase:{register(q){assert(!qdb.has(q.id));qdb.set(q.id,q)}},CommunicativeJudgeRuleData:rules,LotteryPoolData:pools,LotteryEngine:{init(data){assert.equal(data,pools);lotteryInits++}},console};
vm.createContext(context);
for(const file of ['data/s007-communication.js','engine/stories/S007.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const s=stories.get('S007');assert(s);assert.equal(qdb.size,10);assert.equal(rules.length,10);assert.equal(pools.length,10);assert.equal(lotteryInits,1);
assert.equal(s.metadata.perspective,'player');
const bgs=s.steps.filter(x=>x.type==='background').map(x=>x.args[0]);
assert.equal(bgs.length,11);bgs.forEach((bg,i)=>{assert.equal(bg,`images/007/S007-Scene-${String(i+1).padStart(2,'0')}.png`);assert(fs.existsSync(path.join(root,bg)))});
const questionIds=s.steps.filter(x=>x.type==='question').map(x=>x.args[0]);assert.equal(questionIds.length,10);questionIds.forEach((id,i)=>assert.equal(id,`s007.communication.${i+1}`));
const steps=s.steps.map(x=>x.type);assert.equal(steps.filter(t=>t==='clear').length,11);
const accepted=['Hello!','What are you looking for?','Can you hear the bird?','Look! A baby bird!','Don\'t go near it.','Don\'t worry.','Take your time.','Let\'s wait.','Be quiet, please.','Great picture!'];
const alternate=['Hi','What you looking for?','Do you hear that?','There is a baby bird.','Stay away from the bird.','No worries!','No rush.','We can wait.','Shh!','Nice photo!'];
const rejected=['Goodbye','Where are you?','Can you see it?','There is no bird','Come closer','You should worry','Hurry up','Do not wait','Be loud','Bad picture'];
for(let i=0;i<10;i++){const rule=rules[i],q=qdb.get(`s007.communication.${i+1}`);assert(q);assert.equal(q.picoSupport.length,3);assert.equal(rule.accept(accepted[i]),true,`base Q${i+1}`);assert.equal(rule.accept(alternate[i]),true,`alt Q${i+1}`);assert.equal(rule.accept(rejected[i]),false,`negative Q${i+1}`);assert.equal(rule.reject(rejected[i]),true);assert.equal(rule.accept(''),false);}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json')));assert.equal(manifest.images.length,11);for(const item of manifest.images){assert.equal(item.runtimeSize.join('x'),'1560x720');assert(item.runtimeSha256.length===64)}
console.log('PASS: 11 scene background assets registered');
console.log('PASS: 10 sequential questions + three-stage supports');
console.log('PASS: 10 base ACCEPT + 10 alternate ACCEPT + 10 contrary REJECT + empty input checks');
console.log('PASS: no shared-engine or S001-S006 module is included in test load');
console.log('PASS: 11 source/runtime image SHA256 entries and sizes');
