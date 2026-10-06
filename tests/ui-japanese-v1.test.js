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
  "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070",
  "data/questions.js": "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904",
  "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04",
  "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
  "engine/services/speech-engine.js": "a2a9242796cb2cba759ee99d270a1ee0e3e11a761314546a376135b645bc1e13",
  "engine/managers/question-manager.js": "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d"
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.strictEqual(hash(file), expected, file);

console.log("UI Japanese V1 tests: PASS");
