"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const appended = [];
function element() {
  return {
    hidden: false, className: "", textContent: "", innerHTML: "", scrollTop: 0,
    appendChild(value) { appended.push(value); },
    addEventListener(name, listener) { this.listener = listener; },
    getBoundingClientRect() { return { top: 0, bottom: 0 }; },
    focus() {}
  };
}
const els = {
  dialogueBox: element(), speaker: element(), message: element(),
  recognizedText: element(), controls: element()
};
const context = {
  console, window: {}, GameConfig: { dialogueNextLabel: "Next", recognizedPrefix: "聞き取り中：" },
  document: { createElement: element }
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "engine/managers/dialog-manager.js"), "utf8"), context);
context.DialogManager.init(els);

const labels = {
  Next: "次へ", Continue: "続ける", Speak: "話す", Retry: "もう一度言う",
  "Try again": "もう一度言う", Battle: "バトル開始", Camp: "キャンプ",
  Finish: "終了する", "Pico's Support": "ピコのサポート", Yes: "はい", No: "いいえ"
};
for (const [source, expected] of Object.entries(labels)) {
  assert.strictEqual(context.DialogManager.button(source, () => {}).textContent, expected);
}

const messages = {
  "Say a fruit word!": "フルーツの名前を英語で言ってね。",
  "Say a number.": "数字を英語で言ってね。",
  "Say a season.": "季節を英語で言ってね。",
  "Listening...": "聞いているよ…", "Speak now.": "話してね。",
  "No speech detected.": "うまく聞き取れなかったよ。"
};
for (const [source, expected] of Object.entries(messages)) {
  context.DialogManager.show("ピコ", source);
  assert.strictEqual(els.message.textContent, expected);
}
context.DialogManager.show("Fruit Monster", "I am the strongest! But I don't like fruit!");
assert.strictEqual(els.message.textContent, "I am the strongest! But I don't like fruit!", "Character Dialogue stays English");

context.DialogManager.showRecognized("apple", "You said:\n");
assert.strictEqual(els.recognizedText.textContent, "apple と聞こえたよ。");
assert.strictEqual(context.FiniteRescue.RESCUE_MESSAGE,
  "うまく聞き取れなかったピコ。\nもう一度やってもいいし、\nこのまま冒険に戻ってもいいピコ。");

const protectedHashes = {
  "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
  "engine/stories/m001.js": "187c5139107ab8c6f8a35a758d4bc3976f164fe161dccb341926778456fa6e2a",
  "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
  "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905",
  "data/questions.js": "4c3387cce771b78dfaf7e33933a9df43da0defda28b487de84e5ac0b2a611c18",
  "engine/services/communicative-judge.js": "e37901643b7df9799ff9ad743508b0414e58b952777aa81ab97b74dadc218542",
  "engine/services/local-communicative-judge.js": "034cbf4431bcb6d5a1ab3d9afdc8526665d8ea357959383f11faa13fc3baa4d6",
  "engine/services/speech-engine.js": "3e1c4f063d048d79cb2b88e5e7786b5f8d66016191bbac619a114d7a2df5f496",
  "engine/managers/question-manager.js": "5821246389f2ca4e622cc3c8b2e75302e244cea24e502737323b37f9f46de6c8"
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.strictEqual(hash(file), expected, file);

console.log("UI Japanese V1 tests: PASS");
