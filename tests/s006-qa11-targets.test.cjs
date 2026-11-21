"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, setTimeout, clearTimeout }; c.window = c; vm.createContext(c);
for (const p of ['data/word-dictionaries.js', 'data/questions.js', 'data/lottery-pools.js',
 'data/communicative-judge-rules.js', 'engine/services/speech-normalizer.js',
 'engine/services/lottery-engine.js', 'engine/services/local-communicative-judge.js',
 'engine/services/communicative-judge.js', 'data/s006-communication.js']) {
 vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'), c, {filename:p});
}
// Same noun does not imply the same referent. Rows encode each question's intent.
const rows = [
 [1, 'Can we help?', 'Can you help me?'],
 [2, 'What colour is that?', 'What color is another box?'],
 [3, 'Where can I find another box?', 'The box is here.'],
 [4, 'Could you show us that box?', 'Can I see the other box?'],
 [5, 'Have you got it?', 'Do you have a different box?'],
 [6, 'Look at that, please.', 'Give me the ribbon.'],
 [7, 'Did you see that?', 'Did you see another box?'],
 [8, 'Please wait for us.', "Don't wait!"],
 [9, 'Please look for it.', 'Please find another box.'],
 [10, 'This is it!', 'Here is another box!']
];
const extra = [
 [3,'Where is another box?','ACCEPT'], [3,'Where are the other boxes?','ACCEPT'],
 [9,'Please look for the other box.','REJECT'], [9,'Could you help us find a different box?','REJECT'],
 [10,"Here's another box!",'REJECT'], [10,'We found the other boxes!','REJECT'],
 [10,'This is a different box.','REJECT'],
 [9,'Please find the box.','ACCEPT'], [10,'Here is your box!','ACCEPT'],
 // A mere mention of a box or the word "another" is not a known intent.
 [9,'I dreamed about another box.','UNKNOWN'], [10,'Maybe another day.','UNKNOWN'],
 [3,'Please find another box.','UNKNOWN']
];
(async()=>{
 let checks=0;
 async function check(n,text,expected,alternatives=[]){
  const q=c.QuestionDatabase.get('s006.communication.'+n);
  for (const input of [{}, {alternatives}]) {
   const result=await c.CommunicativeJudge.judge(Object.assign({conceptId:q.communicative.conceptId,
    utterance:text,difficulty:'starter',acceptedVariants:q.answers},input));
   assert.equal(result.verdict,expected,`Q${n} ${JSON.stringify(text)} (alternatives=${!!input.alternatives})`); checks++;
  }
 }
 // Reproduce QA's exact failures first, including a correct ASR alternative.
 await check(9,'Please find another box.','REJECT',['Please look for the box.']);
 await check(10,'Here is another box!','REJECT',['Here is your box!']);
 for(const [n,yes,no] of rows){
  await check(n,yes,'ACCEPT'); await check(n,no,'REJECT');
  await check(n,'I am not sure.','UNKNOWN'); await check(n,'flibbertigibbet','UNKNOWN');
 }
 for(const [n,text,expected] of extra) await check(n,text,expected);
 // Keep the 18 previously reviewed expectations; do not regenerate them from rules.
 const corrections=JSON.parse(fs.readFileSync(path.join(root,'docs/engine-guard/evidence/s006-18-corrections.json')));
 assert.equal(corrections.length,18);
 for(const t of corrections) await check(t.question,t.utterance,t.expected);
 console.log(`QA-11-01: ${checks} verdict checks PASS; Q1-Q10 ACCEPT/REJECT/UNKNOWN and all previous 18 expectations`);
})().catch(e=>{console.error(e);process.exitCode=1;});
