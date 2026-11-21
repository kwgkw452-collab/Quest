"use strict";
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f';
function snapshot(source){
 const q=[],rules=[],pools=[],c={QuestionDatabase:{register(x){q.push(x);}},CommunicativeJudgeRuleData:rules,LotteryPoolData:pools,LotteryEngine:{init(){}}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);

 return JSON.stringify({q,rules,pools},(key,value)=>typeof value==='function'?value.toString():value);
}
for(const story of ['s005','s007']){
 const p='data/'+story+'-communication.js';
 const original=cp.execFileSync('git',['show',base+':'+p],{cwd:root,encoding:'utf8'});
 // No S005/S007 Communication data changes are adopted in this scope.
 assert.equal(snapshot(fs.readFileSync(path.join(root,p),'utf8')),snapshot(original),story+' data must remain identical to Production');
}
console.log('PASS S005/S007 Goal/model/hints2-3/rules/pools unchanged; including first hints');
