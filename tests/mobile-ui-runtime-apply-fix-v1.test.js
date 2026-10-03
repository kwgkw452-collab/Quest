const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const version = "mobile-ui-story-polish-v1-1";

for (const htmlName of ["index.html", "dev.html"]) {
  const html = read(htmlName);
  for (const asset of [
    "css/style.css",
    "data/questions.js",
    "engine/managers/dialog-manager.js",
    "engine/presenters/communicative-question-presenter.js"
  ]) assert(html.includes(`${asset}?v=${version}`), `${htmlName}: ${asset} version`);
}

const css = read("css/style.css");
for (const expected of [
  "--dialog-control-font-size: 14px",
  "--dialog-control-min-height: 32px",
  "--dialog-control-font-size: 13px",
  "--dialog-control-min-height: 28px",
  "--dialog-speaker-font-size: 12px",
  "padding: 2px 10px",
  "line-height: 1.1",
  ".dialogue-box.speech-listening",
  "margin-top: 3px",
  "padding: 2px 8px"
]) assert(css.includes(expected), `CSS policy missing: ${expected}`);

const questions = read("data/questions.js");
assert(questions.includes("バナナかオレンジ、好きなほうを英語で答えてください。"));
const story = read("engine/stories/story-saki-departure.js");
assert(story.includes("サキは、この街に残ることになった。"));
assert(story.includes("ピコとサキは、ピコの通信システムを使って、離れていても連絡できるようになった。"));
assert(story.includes('button: "S004を終了する"'));

function element() {
  const classes = new Set();
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    className: "dialogue-box",
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      contains(value) { return classes.has(value); }
    },
    appendChild() {}
  };
}
const elements = {
  dialogueBox: element(), speaker: element(), message: element(),
  controls: element(), recognizedText: element()
};
const context = {
  window: {},
  document: { createElement: element },
  GameConfig: { recognizedPrefix: "" },
  console
};
vm.createContext(context);
vm.runInContext(read("engine/managers/dialog-manager.js"), context);
context.window.DialogManager.init(elements);
context.window.DialogManager.show("ピコ", "目標");
context.window.DialogManager.showRecognized("…");
assert(elements.dialogueBox.classList.contains("speech-listening"), "legacy showRecognized uses compact layout");
context.window.DialogManager.hideRecognized();
assert(!elements.dialogueBox.classList.contains("speech-listening"), "compact layout clears with status");
context.window.DialogManager.showSpeechStatus("ピコ", "日本語目標", "🎤 聞き取り中…");
assert(elements.dialogueBox.classList.contains("speech-listening"));
assert.strictEqual(elements.message.textContent, "日本語目標");
assert.strictEqual(elements.recognizedText.textContent, "🎤 聞き取り中…");

console.log("Mobile UI Runtime Apply Fix V1 tests passed.");
