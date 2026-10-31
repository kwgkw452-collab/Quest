"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/s005-clean-lock.json"), "utf8"));
const c = { console }; c.window = c; vm.createContext(c);
for (const file of ["data/word-dictionaries.js", "data/questions.js", "data/communicative-judge-rules.js", "data/lottery-pools.js", "engine/services/lottery-engine.js", "data/s005-communication.js", "engine/services/speech-normalizer.js", "engine/services/local-communicative-judge.js"]) vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), c);
const questions = c.QuestionDatabase.all().filter(q => q.id.startsWith("s005.communication."));
assert.equal(questions.length, 12);
questions.forEach((q, i) => {
 assert.equal(q.id, "s005.communication." + (i + 1)); assert.equal(q.prompt, lock.prompts[i]);
 assert.equal(q.communicative.expectedUtterance, lock.goals[i]); assert.equal(q.picoSupport.length, 3);
 assert.equal(c.LocalCommunicativeJudge.evaluate({conceptId:q.communicative.conceptId, utterance:lock.goals[i]}, c.CommunicativeJudgeRuleData).verdict, "ACCEPT");
 for (const text of q.answers) assert.equal(c.LocalCommunicativeJudge.evaluate({conceptId:q.communicative.conceptId, utterance:text}, c.CommunicativeJudgeRuleData).verdict, "ACCEPT");
 assert.equal(c.LocalCommunicativeJudge.evaluate({conceptId:q.communicative.conceptId, utterance:"Unrelated weather."}, c.CommunicativeJudgeRuleData).verdict, "UNKNOWN");
});
assert.equal(c.LocalCommunicativeJudge.evaluate({conceptId:"hotel.party.four",utterance:"Three."},c.CommunicativeJudgeRuleData).verdict,"REJECT");
assert.equal(c.LocalCommunicativeJudge.validateRules(c.CommunicativeJudgeRuleData).length,0);
console.log("S005 latest LOCK: PASS (12 goals, four guests, king-size request, shared Judge definitions)");
