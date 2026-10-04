"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(read(file)).digest("hex");

const css = read("css/style.css");
assert(css.includes("--dialog-control-font-size: 14px"));
assert(css.includes("--dialog-control-min-height: 32px"));
assert(css.includes("--dialog-speaker-font-size: 13px"));
assert(css.includes("--speech-status-font-size: 12px"));
assert(css.includes("--dialog-control-font-size: 13px"));
assert(css.includes("--dialog-control-min-height: 28px"));
assert(css.includes("font-size: var(--dialog-speaker-font-size)"));
assert(css.includes("font-size: var(--speech-status-font-size)"));
assert(css.includes("min-height: var(--dialog-control-min-height)"));
assert(!css.includes("min-width: 110px"));

const dialogManager = read("engine/managers/dialog-manager.js");
assert(dialogManager.includes("function showSpeechStatus(speaker, goal, status)"));
assert(dialogManager.includes("showSpeechStatus: showSpeechStatus"));
assert(read("engine/presenters/communicative-question-presenter.js").includes(
  'DialogManager.showSpeechStatus("ピコ", japaneseGoal || "", "🎤 聞き取り中…")'
));
assert(read("engine/presenters/communication-task-presenter.js").includes(
  'DialogManager.showSpeechStatus("ピコ", "", "🎤 聞き取り中…")'
));

const departure = read("engine/stories/story-saki-departure.js");
const yes = departure.indexOf('C.dialogue("サキ", "Yes.",');
const remain = departure.indexOf("サキは、この街に残ることになった。");
const callConnected = departure.indexOf('C.dialogue("ピコ", "Yes! I can hear you!",');
const communication = departure.indexOf("ピコとサキは、ピコの通信システムを使って、離れていても連絡できるようになった。");
const notGoodbye = departure.indexOf('C.dialogue("サキ", "It\'s not goodbye.",');
assert(yes >= 0 && yes < remain && remain < callConnected);
assert(callConnected < communication && communication < notGoodbye);
assert(departure.includes('button: "S004を終了する"'));
assert(!departure.includes('button: "004を終了する"'));

const questions = read("data/questions.js");
assert(questions.includes('prompt: "バナナかオレンジ、好きなほうを英語で答えてください。"'));
assert(questions.includes('answers: ["orange", "banana", "no thank you"]'));

assert(read("index.html").includes("css/style.css?v=mobile-ui-story-polish-v1-1"));
assert(read("dev.html").includes("css/style.css?v=mobile-ui-story-polish-v1-1"));

// Locked subsystems must remain byte-identical to the Phase 1 source.
assert.strictEqual(hash("engine/managers/audio-manager.js"), "a5b1d36ce5d1fd20d85b871811c21bbbf40e1432eec97a79f63de8bd60616b09");
assert.strictEqual(hash("engine/services/speech-recognition-adapter.js"), "1261497515055b11c6caa0d26eb8773d848d656bc17ba7a5c9f7b53798b365ad");
assert.strictEqual(hash("engine/services/local-communicative-judge.js"), "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58");
assert.strictEqual(hash("engine/services/communicative-judge.js"), "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04");
assert.strictEqual(hash("data/monsters.js"), "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073");

console.log("Mobile UI + Story Polish V1 tests: PASS");
