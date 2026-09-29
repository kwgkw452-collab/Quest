"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function element() {
  return {
    hidden: false, className: "", textContent: "", innerHTML: "", disabled: false,
    children: [], listeners: {}, scrollTop: 0,
    appendChild(child) { this.children.push(child); },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    getBoundingClientRect() { return { top: 0, bottom: 100 }; },
    click() { if (!this.disabled && this.listeners.click) this.listeners.click(); }
  };
}

function harness() {
  const pending = [];
  const calls = [];
  const context = {
    window: {}, Promise, console,
    GameConfig: { dialogueNextLabel: "Next", recognizedPrefix: "" },
    document: { createElement() { return element(); } },
    DialogueVoiceController: {
      play(key) {
        calls.push(["play", key]);
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        pending.push(resolve);
        return promise;
      },
      stop() { calls.push(["stop"]); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/managers/dialog-manager.js"), context);
  vm.runInContext(read("engine/controllers/pico-support-controller.js"), context);
  const els = {
    dialogueBox: element(), speaker: element(), message: element(),
    controls: element(), recognizedText: element()
  };
  Object.defineProperty(els.controls, "innerHTML", {
    get() { return ""; }, set() { this.children = []; }
  });
  context.DialogManager.init(els);
  return { context, els, calls, pending };
}

function button(els, label) {
  return els.controls.children.find(item => item.textContent === label);
}

(async () => {
  const first = harness();
  const completion = first.context.PicoSupportController.present({
    speaker: "サキ", text: "Can you hear me?", voiceKey: "voice_c03_s002_002",
    supportText: "私の声が聞こえるの？", supportSpeaker: "ピコ", button: "Next"
  });
  assert.strictEqual(first.els.message.textContent, "");
  assert(button(first.els, "次へ"));
  button(first.els, "ピコのサポート").click();
  assert(button(first.els, "英文を見る"));
  assert(button(first.els, "日本語を見る"));
  assert.strictEqual(button(first.els, "もう一度聞く").disabled, true);
  first.pending.shift()({ status: "ended" });
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(button(first.els, "もう一度聞く").disabled, false);
  button(first.els, "英文を見る").click();
  assert.strictEqual(first.els.message.textContent, "Can you hear me?");
  button(first.els, "日本語を見る").click();
  assert.strictEqual(first.els.message.textContent, "私の声が聞こえるの？");
  const replay = button(first.els, "もう一度聞く");
  replay.click(); replay.click();
  assert.strictEqual(first.calls.filter(call => call[0] === "play").length, 2);
  assert.strictEqual(button(first.els, "もう一度聞く").disabled, true);
  first.pending.shift()({ status: "ended" });
  await Promise.resolve(); await Promise.resolve();
  button(first.els, "次へ").click();
  assert.deepStrictEqual(first.calls[first.calls.length - 1], ["stop"]);
  assert.strictEqual(await completion, "next");

  const noJapanese = harness();
  const noJapaneseCompletion = noJapanese.context.PicoSupportController.present({
    speaker: "コング", text: "Wow!", voiceKey: "voice_c02_st004_001", button: "Next"
  });
  button(noJapanese.els, "ピコのサポート").click();
  assert(button(noJapanese.els, "英文を見る"));
  assert.strictEqual(button(noJapanese.els, "日本語を見る"), undefined);
  button(noJapanese.els, "次へ").click();
  await noJapaneseCompletion;

  const automatic = harness();
  assert.strictEqual(await automatic.context.PicoSupportController.present({
    speaker: "ピコ", text: "Master! She needs help.",
    voiceKey: "voice_c01_s002_004", button: false
  }), "automatic");
  assert.strictEqual(button(automatic.els, "次へ"), undefined);
  assert(button(automatic.els, "ピコのサポート"));
  automatic.context.PicoSupportController.dismiss();
  automatic.context.DialogManager.show("ピコ", "次の案内");
  automatic.pending.shift()({ status: "ended" });
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(button(automatic.els, "ピコのサポート"), undefined);

  const initiallyOpen = harness();
  const initiallyOpenCompletion = initiallyOpen.context.PicoSupportController.present({
    speaker: "ピコ", text: "nose\nmouth\nears", supportText: "残っているのは、鼻と口と耳ピコ！",
    initialView: "japanese", button: "もう一度言う"
  });
  assert.strictEqual(initiallyOpen.els.message.textContent, "残っているのは、鼻と口と耳ピコ！");
  assert(button(initiallyOpen.els, "英文を見る"));
  assert(button(initiallyOpen.els, "日本語を見る"));
  assert(button(initiallyOpen.els, "もう一度聞く"));
  button(initiallyOpen.els, "英文を見る").click();
  assert.strictEqual(initiallyOpen.els.message.textContent, "nose\nmouth\nears");
  button(initiallyOpen.els, "もう一度言う").click();
  await initiallyOpenCompletion;

  const storyEngine = read("engine/core/story-engine.js");
  const monsterManager = read("engine/managers/monster-battle-manager.js");
  assert(storyEngine.includes("PicoSupportController.present"));
  assert(monsterManager.includes("supportText: line.supportText || \"\""));
  assert(monsterManager.includes("await PicoSupportController.present"));
  assert(read("index.html").includes("engine/controllers/pico-support-controller.js"));
  for (const file of fs.readdirSync(path.join(root, "engine/stories")).filter(name => name.endsWith(".js"))) {
    assert(!read("engine/stories/" + file).includes("PicoSupportController"));
  }

  console.log("Pico Support Common Engine V1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
