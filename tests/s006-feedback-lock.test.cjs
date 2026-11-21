"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const amendment=JSON.parse(read('specs/approved/s006-communication-v2/20261121-feedback-lock.json'));
assert.equal(crypto.createHash('sha256').update(read(amendment.source)).digest('hex'),amendment.sourceSHA256);
const c={console,setTimeout,clearTimeout};c.window=c;vm.createContext(c);
for(const p of ['data/word-dictionaries.js','data/questions.js','data/lottery-pools.js','data/communicative-judge-rules.js',
 'engine/services/speech-normalizer.js','engine/services/lottery-engine.js','engine/services/local-communicative-judge.js',
 'engine/services/communicative-judge.js','data/s005-communication.js','data/s006-communication.js','data/s007-communication.js'])vm.runInContext(read(p),c,{filename:p});
const rejects=[
 [1,'Help me.'],[1,'Can you help me?'],[1,"Could we not help you?"],
 [2,'What size is the box?'],[2,'What size is the book?'],[2,'What color is another book?'],
 [4,'Open the box.'],[4,'Open the book.'],[4,"Don't show us the book."],
 [6,"Don't look at that."],[6,'Do not look at the'],[6,'Give me the ribbon.'],[6,'Look at the box.'],
 [7,'Is the box on the cart?'],[7,'Did you see another book?'],[7,"Don't see the book."],
 [8,'Go!'],[8,"Don't wait!"],[8,'Hurry up!'],[8,"Don't wait a minute."],
 [9,'Please find another box.'],[9,'Please find another book.'],[9,'Please look for the other books.'],
 [9,"Don't find the book."],[9,'Please look at the book.'],[9,'I found the book.'],
 [10,'Here is another box!'],[10,'This is another box.'],[10,'This is another book.'],
 [10,'Here is another book!'],[10,'This is not your book.'],[10,'Give me your book.']
];
const rescue=[
 [2,'What color is your book?'],[2,'What colour are the books?'],
 [3,'Where is another book?'],[3,'Where are the other books?'],
 [4,'Show me the book.'],[4,'Show us books.'],[5,'Do you have the book?'],[5,'Have you got my books?'],
 [7,'Did you see the book?'],[7,'Did you see the books?'],[7,'Did you saw the book?'],
 [9,'Please find the book.'],[9,'Please look for the books.'],
 [10,'This is your book.'],[10,'Here is your book!']
];
(async()=>{
 let checks=0;
 async function check(n,text,expected){
  const q=c.QuestionDatabase.get('s006.communication.'+n);
  const alternatives=expected==='REJECT'?[q.communicative.expectedUtterance]:[];
  const r=await c.CommunicativeJudge.judge({conceptId:q.communicative.conceptId,utterance:text,
   acceptedVariants:q.answers,difficulty:'starter',alternatives});
  assert.equal(r.verdict,expected,`Q${n}: ${text}`);checks++;
 }
 const goals=['お手伝いしましょうか？','あなたの箱は何色ですか？','ほかの箱はどこにありますか？','その箱を見せてもらえますか？','その箱を持っていますか？','このリボンを見てください。','箱を見ましたか？','ちょっと待ってください！','その箱を見つけてください。','これがあなたの箱です。'];
 const models=['Can I help you?','What color is it?','Where are the other boxes?','Can I see the box?','Do you have the box?','Look at this ribbon.','Did you see the box?','Wait, please!','Please find the box.','This is your box.'];
 for(let n=1;n<=10;n++){
  const q=c.QuestionDatabase.get('s006.communication.'+n);
  assert.equal(q.prompt,goals[n-1]);assert.equal(q.communicative.expectedUtterance,models[n-1]);
  assert.equal(q.picoSupport[2],models[n-1]);
  await check(n,models[n-1],'ACCEPT');
  for(const t of (amendment.additionalAccept[n]||[]))await check(n,t,'ACCEPT');
  // Keep all previous correct ACCEPT cases from the PR #11 snapshot, not regenerated runtime expectations.
  const previous=JSON.parse(cp.execFileSync('git',['show','999c514390a8e0faac7ec846d6c27c0008ae4a99:tests/s006-communication-v2-cases.json'],{cwd:root,encoding:'utf8'}))[n-1];
  for(const t of previous.accept)await check(n,t,'ACCEPT');
  for(const t of ['I am not sure.','flibbertigibbet','There is a book on the shelf.'])await check(n,t,'UNKNOWN');
 }
 for(const [n,t] of rescue)await check(n,t,'ACCEPT');
 for(const [n,t] of rejects)await check(n,t,'REJECT');
 // Q6's incomplete ASR rescue must not leak to other questions or Judge/Speech Core.
 for(const n of [1,2,3,4,5,7,8,9,10])await check(n,'Look at the','UNKNOWN');
 assert.equal(c.SpeechNormalizer.normalize('book'),'book');assert.equal(c.SpeechNormalizer.normalize('books'),'books');
 assert.equal(c.QuestionDatabase.all().filter(q=>q.id.startsWith('s006.')).length,10);
 assert.equal(c.CommunicativeJudgeRuleData.filter(r=>r.conceptId.startsWith('s006.')).length,10);
 assert.equal(c.LotteryPoolData.filter(r=>r.poolId.startsWith('s006.')).length,10);
 const scope=JSON.parse(read('specs/current/engine-guard-v1.json'));
 assert.equal(scope.userApprovedAmendments[0].sha256,crypto.createHash('sha256').update(read(scope.userApprovedAmendments[0].path)).digest('hex'));
 console.log(`S006 feedback LOCK: ${checks} verdict checks PASS; all 10 Goal/model, complete added accepts, previous accepts, ASR/target/intent boundaries`);
})().catch(e=>{console.error(e);process.exitCode=1;});
