"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const logs = [];

class Recognition {
  constructor() { Recognition.instances.push(this); }
  start() { if (this.onstart) this.onstart(); }
  stop() { if (this.onend) this.onend(); }
}
Recognition.instances = [];

const c = {
  window: {}, Promise, setTimeout, clearTimeout,
  console: { log(...args) { logs.push(args); }, warn() {}, error() {} },
  SpeechRecognition: Recognition
};
c.window = c;
vm.createContext(c);
vm.runInContext(read("engine/services/speech-normalizer.js"), c);
vm.runInContext(read("engine/services/speech-recognition-adapter.js"), c);

function result(transcript, isFinal, confidence) {
  const alternative = { transcript, confidence };
  const value = [alternative];
  value.isFinal = isFinal;
  return value;
}

(async () => {
  const heard = c.SpeechRecognitionAdapter.listen({
    lang: "en-US", s005TraceQuestionId: "s005.communication.1"
  });
  const recognition = Recognition.instances[0];
  recognition.onresult({ resultIndex: 0, results: [result("No", true, 0.91)] });
  recognition.onend();
  assert.equal(await heard, "No");
  const recognitionResult = logs.find(entry => entry[0] === "[S005 TRACE] recognition-result");
  assert.deepEqual(JSON.parse(JSON.stringify(recognitionResult[1])), {
    questionId: "s005.communication.1", transcript: "No", isFinal: true, confidence: 0.91
  });
  const recognitionEnd = logs.find(entry => entry[0] === "[S005 TRACE] recognition-end");
  assert.equal(recognitionEnd[1].finalText, "No");
  assert.deepEqual(Array.from(recognitionEnd[1].alternatives), ["No"]);

  const failed = c.SpeechRecognitionAdapter.listen({
    lang: "en-US", s005TraceQuestionId: "s005.communication.1"
  });
  const failedRecognition = Recognition.instances[1];
  failedRecognition.onerror({ error: "no-speech" });
  await assert.rejects(failed, /no-speech/);
  const recognitionError = logs.find(entry => entry[0] === "[S005 TRACE] recognition-error");
  assert.equal(recognitionError[1].error, "no-speech");

  const questionManager = read("engine/managers/question-manager.js");
  assert(questionManager.includes('s005Trace(question.id, "judge-start"'));
  assert(questionManager.includes('s005Trace(question.id, "judge-result"'));
  for (const page of ["index.html", "dev.html"]) {
    const html = read(page);
    assert(html.includes("engine/services/speech-recognition-adapter.js"));
    assert(html.includes("engine/managers/question-manager.js?v=s005-rule-real-browser-trace-v1"));
  }
  console.log("S005 Speech Runtime Trace tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
