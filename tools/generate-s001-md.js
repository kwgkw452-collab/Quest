"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "stories/S001.md");
const context = { console, window: {} };
context.window = context;
context.StoryRegistry = { register(story) { context.story = story; return story; } };
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

load("engine/commands/story-commands.js");
load("engine/stories/S001.js");

function value(value) {
  if (typeof value === "function") return "Story stateを使う動的テキスト";
  if (Array.isArray(value)) return value.join(" → ");
  return value === undefined ? "" : String(value);
}

function describe(step) {
  if (step.type === "dialogue") return `${value(step.speaker) || "ナレーション"}: ${value(step.text)}${step.button ? ` [${step.button}]` : ""}`;
  if (step.type === "background") return `背景: ${step.src}`;
  if (step.type === "backgroundSequence") return `背景移動: ${value(step.items)}`;
  if (step.type === "characters") return `キャラクター表示: ${(step.items || []).map(item => `${item.character || item.id}/${item.pose || "default"}`).join(", ")}`;
  if (step.type === "characterImage") return `キャラクター状態: ${step.id}/${step.pose || step.src}`;
  if (step.type === "item") return `アイテム表示: ${step.src}`;
  if (step.type === "effect") return `画面効果: ${step.className}`;
  if (step.type === "question") return `Question: ${step.questionId}`;
  if (step.type === "confirmSpeechName") return `名前確認: ${step.message}`;
  if (step.type === "camp") return `Camp: ${step.campId}`;
  return step.type;
}

const lines = [
  "<!-- GENERATED FILE: engine/stories/S001.js が正本です。直接編集しないでください。 -->",
  "# S001 第1話（生成仕様）",
  "",
  "このファイルは `engine/stories/S001.js` から生成されます。Story本文・会話・演出順の正本はS001.jsです。",
  "",
  "## 実行順",
  "",
  ...context.story.steps.map((step, index) => `${index + 1}. \`${step.type}\` — ${describe(step)}`),
  "",
  "## 正式な終点",
  "",
  "`CAMP CAMP_001` の完了後にS001を終了し、SceneManagerの呼び出し元へ結果を返します。次話遷移は行いません。",
  "",
  "## 編集手順",
  "",
  "1. `engine/stories/S001.js` をStoryCommands形式で編集する。",
  "2. `node tools/generate-s001-md.js` を実行する。",
  "3. `node tools/generate-s001-md.js --check` と全テストを実行する。",
  ""
];
const output = lines.join("\n");

if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output) {
    console.error("stories/S001.md is not generated from engine/stories/S001.js");
    process.exit(1);
  }
  console.log("S001 generated documentation check: PASS");
} else {
  fs.writeFileSync(target, output);
  console.log("Generated stories/S001.md");
}
