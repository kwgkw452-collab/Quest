const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dir='./prototype/common-engine-v2-audiofree';
const {createCommunication}=require(dir+'/communication.cjs'),{createRunner}=require(dir+'/runner.cjs');
function load(ref,id){let qs=[];let ctx={QuestionDatabase:{register:q=>qs.push(q)},CommunicativeJudgeRuleData:[],LotteryPoolData:[],LotteryEngine:{init(){}}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('sources/'+ref+'/'+id.toLowerCase()+'.js','utf8'),ctx);return qs}
(async()=>{let rows=[];for(let id of ['S005','S006','S007']){
const p=require(dir+'/stories/'+id+'/story.json'), old=load('bfdb08666f3a9b12b4d9ff13483ab14d13c7638f',id),base=load('b1429931385b74f5eac7e15ba94cfee3b67c6bbc',id);
for(const [key,q] of Object.entries(p.challenges)){
let source=old.find(x=>x.id===key),b=base.find(x=>x.id===key);let c=createCommunication(q,{recognize:async()=>({status:'final',text:q.modelEn})});let stages=[c.view().supportStage,...Array.from({length:4},()=>c.support().supportStage)];let accepted=(await c.speak()).type;
let fresh=createCommunication(q,{recognize:async()=>({status:'final',text:'xyzzy'})});let feedback=(await fresh.speak()).view;
rows.push({key,stages,accepted,english:/[A-Za-z]+/.test(q.hints[0]),stage1:source?source.picoSupport[0]===q.hints[0]:null,stage23:b?JSON.stringify(b.picoSupport.slice(1))===JSON.stringify(q.hints.slice(1)):null,goal:b?b.prompt===q.goalJa:null,model:b?b.communicative.expectedUtterance===q.modelEn:null,feedbackLayout:feedback.layoutMode,feedback:feedback.feedbackJa});
}}
console.log(JSON.stringify(rows,null,2))
})()
