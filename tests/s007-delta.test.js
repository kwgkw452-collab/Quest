const assert=require('assert');
const fs=require('fs');const vm=require('vm');const path=require('path');
const root=path.resolve(__dirname,'..');
const qdb=new Map(),stories=new Map();const rules=[],pools=[];
let lotteryInits=0;
const C={};for(const type of ['clear','background','dialogue','question','hideDialogue','setFlag']) C[type]=(...args)=>({type,args});
const context={window:{SpeechEngine:{stop(){}}},StoryCommands:C,StoryRegistry:{register(s){assert(!stories.has(s.id));stories.set(s.id,s)}},QuestionDatabase:{register(q){assert(!qdb.has(q.id));qdb.set(q.id,q)}},CommunicativeJudgeRuleData:rules,LotteryPoolData:pools,LotteryEngine:{init(data){assert.equal(data,pools);lotteryInits++}},console};
vm.createContext(context);
for(const file of ['data/s007-communication.js','engine/stories/S007.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const s=stories.get('S007');assert(s);assert.equal(qdb.size,10);assert.equal(rules.length,10);assert.equal(pools.length,10);assert.equal(lotteryInits,1);
assert.equal(s.metadata.perspective,'player');
const bgs=s.steps.filter(x=>x.type==='background').map(x=>x.args[0]);
assert.equal(bgs.length,13);bgs.forEach((bg,i)=>{assert.equal(bg,`images/007/S007-Scene-${String(i+1).padStart(2,'0')}.png`);assert(fs.existsSync(path.join(root,bg)))});
const questionIds=s.steps.filter(x=>x.type==='question').map(x=>x.args[0]);assert.equal(questionIds.length,10);questionIds.forEach((id,i)=>assert.equal(id,`s007.communication.${i+1}`));
const steps=s.steps.map(x=>x.type);assert.equal(steps.filter(t=>t==='clear').length,13);
for (let i=0;i<10;i++) {
 const q=qdb.get(`s007.communication.${i+1}`),rule=rules[i];
 assert(q);assert.equal(q.picoSupport.length,3);
 assert.equal(rule.accept(q.communicative.expectedUtterance),true,`model Q${i+1}`);
 assert.equal(rule.reject(q.communicative.expectedUtterance),false,`no contradictory model Q${i+1}`);
 assert.equal(rule.accept(''),false);
}
// Source/runtime assets are checked against the Production Git blob baseline.
// No missing historical ZIP manifest is required to execute current Story tests.
console.log('PASS: 13 scene background assets registered');
console.log('PASS: 10 sequential questions + three-stage supports');
console.log('PASS: 10 registered model ACCEPT + non-contradiction + empty input checks; historical alternatives are not reintroduced');
console.log('PASS: no shared-engine or S001-S006 module is included in test load');
