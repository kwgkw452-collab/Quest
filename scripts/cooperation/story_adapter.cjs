'use strict';
// Candidate JSON only. Reference engine is byte-pinned, never loaded from candidate.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const ref=path.resolve(__dirname,'../../tests/cooperation/v5-reference');
const pins={'schema.cjs':'a9288d63509133fe893e9cd87496dffd6f40f5a8','judge.cjs':'d8458575ee46359db312eeedfc5eddd457148a19','communication.cjs':'52e256fc23d1c7ece2ee820229985b93a2c06be4','runner.cjs':'b75673627e82f3e41f89f0d94018eb813b760e23','vocabulary-battle.cjs':'fdffb69e8e30579455625c5c383debc7fec63166'};
for(const [file,hash] of Object.entries(pins)){
 const b=fs.readFileSync(path.join(ref,file));
 if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==hash)throw Error('REFERENCE_CHANGED:'+file);
}
const {validate}=require(path.join(ref,'schema.cjs'));
const {judge}=require(path.join(ref,'judge.cjs'));
const {createRunner}=require(path.join(ref,'runner.cjs'));
// JSON object member order is not semantic; arrays remain ordered.
const canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
async function check(pack,spec){
 const errors=validate(pack);
 if(errors.length)return errors;
 if(!/^S(?:00[89]|0[1-9][0-9]|100)$/.test(pack.id))errors.push('STORY_SCOPE');
 if(!same(pack,spec.pack))errors.push('PINNED_STORY_MISMATCH');
 if(errors.length)return errors;
 const questions=pack.challenges||{};
 for(const [id,q] of Object.entries(questions)){
  if(!/[\u3040-\u30ff\u3400-\u9fff]/.test(q.goalJa)||!/[a-z]/i.test(q.modelEn)||q.hints.some(h=>!/[\u3040-\u30ff\u3400-\u9fff]/.test(h)))errors.push('COMMUNICATION_LANGUAGE:'+id);
  const cases=spec.judgeCases[id]||[];
  if(!['ACCEPT','REJECT','UNKNOWN'].every(d=>cases.some(c=>c.decision===d)))errors.push('JUDGE_CASES:'+id);
  for(const c of cases)if(judge(q.rule||{accept:q.accept},c.text).decision!==c.decision)errors.push('JUDGE:'+id+':'+c.decision);
  if(judge(q.rule||{accept:q.accept},q.modelEn).decision!=='ACCEPT')errors.push('MODEL:'+id);
 }
 if(errors.length)return errors;
 let utterance='',seen=[],scenes=[];
 const runner=createRunner(pack,{recognize:async()=>({status:'final',text:utterance}),onEvent:e=>{if(e.type==='scene')scenes.push(e.asset);}});
 for(let n=0;n<500;n++){
  const e=await runner.advance();
  if(e.type==='end'){
   if(!same(seen,Object.keys(questions))||!same(scenes,spec.sceneAssets||spec.assets))errors.push('FLOW_COVERAGE');
   return errors;
  }
  if(e.type==='challenge'){
   seen.push(e.id);
   if(e.view.supportStage!==0||!same(e.view.actions,['talk','support','return']))errors.push('QUESTION_RESET');
   for(const stage of [1,2,3,3])if(runner.support().view.supportStage!==stage)errors.push('SUPPORT_STAGE');
   for(const d of ['REJECT','UNKNOWN']){
    utterance=spec.judgeCases[e.id].find(c=>c.decision===d).text;
    const r=await runner.talk();
    if(r.type!==(d==='REJECT'?'rejected':'unknown')||runner.state().question.supportStage!==3)errors.push('RETRY:'+d);
   }
   utterance=questions[e.id].modelEn;
   if((await runner.talk()).type!=='accepted')return [...errors,'NOT_ACCEPTED'];
  }else if(e.type!=='line')return [...errors,'UNSUPPORTED_FLOW:'+e.type];
 }
 return [...errors,'NO_END'];
}
if(require.main===module){
 (async()=>{const {pack,spec}=JSON.parse(fs.readFileSync(0,'utf8'));const errors=await check(pack,spec);process.stdout.write(JSON.stringify(errors));})().catch(()=>{process.exitCode=2;});
}
module.exports={check};
