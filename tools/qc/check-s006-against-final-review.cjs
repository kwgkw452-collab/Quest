#!/usr/bin/env node
"use strict";
// Independent audit runner. Reads a pinned source snapshot; never edits it.
// Expected text is extracted from the *external Final Review*, not candidate fixtures.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const source=path.resolve(process.argv[2]||""),specPath=path.resolve(process.argv[3]||"");
const spec=fs.readFileSync(specPath,"utf8");
const lines=spec.split("\n").filter(x=>/^\| Q\d+ \|/.test(x));
const split=line=>line.split("|").map(x=>x.trim());
const rows=lines.filter(x=>split(x).length===8).slice(0,10).map(line=>{
 const c=split(line);return {q:+c[1].slice(1),goal:c[3],model:c[4],accept:c[5].split(/\s*／\s*/),hints:[],minor:[],reject:[]};
});
for(const line of lines.filter(x=>split(x).length===6)){const c=split(line);rows[+c[1].slice(1)-1].hints=c.slice(2,5);}
const toleranceSection=spec.split("ここで「許容例」とした不完全な英文は")[1].split("対象の箱が明確な場面では")[0];
for(const line of toleranceSection.split("\n").filter(x=>/^\| Q\d+ \|/.test(x)&&split(x).length===5)){
 const c=split(line),n=+c[1].slice(1);if(!n||!rows[n-1])continue;
 rows[n-1].minor=c[2].split("。")[0].split(/\s*／\s*/);
 rows[n-1].reject=c[3].replace(/（[^）]*）/g,"").split(/\s*／\s*/);
}
if(rows.length!==10||rows.some(x=>x.hints.length!==3||!x.minor.length||!x.reject.length||[...x.minor,...x.reject].some(t=>!/^[A-Za-z]/.test(t))))throw Error("Incomplete Final Review");
// Explicit user-approved amendment supersedes only its listed Final Review fields.
// This content authorization is NOT an independent QA protection baseline.
let amendment=null,amendmentPath=null;
if(process.argv[4]){
 amendmentPath=path.resolve(process.argv[4]);amendment=JSON.parse(fs.readFileSync(amendmentPath,"utf8"));
 if(amendment.status!=="USER_APPROVED_2026_11_21_NOT_INDEPENDENT_QA_BASELINE")throw Error("Unrecognized amendment status");
 const approvedText=fs.readFileSync(path.join(source,amendment.source));
 if(crypto.createHash("sha256").update(approvedText).digest("hex")!==amendment.sourceSHA256)throw Error("Approval source changed");
 for(const row of rows){
  const n=String(row.q),oldModel=row.model;
  if(amendment.goals[n])row.goal=amendment.goals[n];
  if(amendment.models[n])row.model=amendment.models[n];
  if(amendment.hints[n])row.hints=amendment.hints[n];
  row.accept=[...new Set([...row.accept,oldModel,...(amendment.additionalAccept[n]||[])])];
  const superseded=(amendment.supersededRejects||{})[n]||[];
  row.reject=row.reject.filter(t=>!superseded.includes(t));
  row.accept.push(...superseded);
 }
}
const c={console:{log(){},warn(){},error(){}},setTimeout,clearTimeout};c.window=c;vm.createContext(c);
const load=p=>vm.runInContext(fs.readFileSync(path.join(source,p),"utf8"),c,{filename:p});
["data/word-dictionaries.js","data/questions.js","data/lottery-pools.js","data/communicative-judge-rules.js",
"engine/services/speech-normalizer.js","engine/services/lottery-engine.js","engine/services/local-communicative-judge.js",
"engine/services/communicative-judge.js","data/s005-communication.js","data/s006-communication.js","data/s007-communication.js"].forEach(load);
const findings=[],checks=[];
function check(kind,q,expected,actual,label){
 const ok=JSON.stringify(expected)===JSON.stringify(actual);
 const item={kind,q,label,expected,actual,status:ok?"PASS":"FAIL"};checks.push(item);if(!ok)findings.push(item);
}
(async()=>{
 check("registry",null,10,c.QuestionDatabase.all().filter(q=>q.id.startsWith("s006.")).length,"question count");
 check("registry",null,10,c.CommunicativeJudgeRuleData.filter(r=>r.conceptId.startsWith("s006.")).length,"rule count");
 check("registry",null,10,c.LotteryPoolData.filter(r=>r.poolId.startsWith("s006.")).length,"pool count");
 for(const row of rows){
  const q=c.QuestionDatabase.get("s006.communication."+row.q);
  check("text",row.q,row.goal,q.prompt,"Goal");
  check("text",row.q,row.model,q.communicative.expectedUtterance,"model");
  check("text",row.q,row.hints,Array.from(q.picoSupport),"all three hints verbatim");
  check("version",row.q,"s006.mystery.v2."+row.q,q.communicative.conceptId,"conceptId");
  check("version",row.q,q.id+".v2",q.communicative.poolId,"poolId");
  for(const [group,texts,expected] of [["model",[row.model],"ACCEPT"],["natural",row.accept,"ACCEPT"],
     ["minor",row.minor,"ACCEPT"],["explicit-reject",row.reject,"REJECT"],
     ["unknown",["I am not sure.","flibbertigibbet"],"UNKNOWN"]]){
   for(const text of texts){
    const r=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:text,
      acceptedVariants:q.answers,difficulty:"starter",alternatives:expected==="REJECT"?[row.model]:[]});
    check("judge",row.q,expected,r.verdict,group+": "+text);
   }
  }
  // General pronoun/determiner permission in the approved prose, not only examples.
  const proseExamples={1:"Can we help?",2:"What colour is that?",3:"Where is it?",
    4:"Can we see it?",5:"Do you have this?",6:"Look at that, please.",
    7:"Did you see that?",8:"Please wait for us.",9:"Please look for it.",10:"This is it!"};
  const t=proseExamples[row.q];
  const result=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:t,difficulty:"starter"});
  check("prose-policy",row.q,"ACCEPT",result.verdict,t);
 }
 const report={source,specPath,amendmentPath,amendmentStatus:amendment&&amendment.status,specSHA256:crypto.createHash("sha256").update(spec).digest("hex"),
   checks:checks.length,failures:findings.length,findings,details:checks,canonicalQuestions:rows};
 process.stdout.write(JSON.stringify(report,null,2)+"\n");
 process.exitCode=findings.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});

