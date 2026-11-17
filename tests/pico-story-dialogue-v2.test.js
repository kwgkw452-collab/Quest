"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function harness() {
  const state = { speaker: "", text: "", controls: [], plays: 0, stops: 0 };
  const dialog = {
    show: (speaker, text) => { state.speaker = speaker; state.text = text; },
    setContent: (speaker, text) => { state.speaker = speaker; state.text = text; },
    clearControls: () => { state.controls = []; },
    addControl: (label, click, options) => {
      state.controls.push({ label, click, disabled: Boolean(options && options.disabled) });
    }
  };
  const voice = {
    stop: () => { state.stops++; },
    play: () => { state.plays++; return Promise.resolve({ status: "ended" }); }
  };
  const ctx = { Promise, window: null, DialogManager: dialog,
    GameConfig: { dialogueNextLabel: "次へ" }, DialogueVoiceController: voice };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("engine/controllers/pico-support-controller.js"), ctx);
  return { ctx, state, click(label) {
    const b = state.controls.find(c => c.label === label);
    assert(b && !b.disabled, "No enabled control: " + label);
    b.click();
  }, button(label) { return state.controls.find(c => c.label === label); } };
}

(async () => {
  const h = harness();
  const silent = h.ctx.PicoSupportController.present({
    speaker: "Meg", text: "Hello!", showEnglishInitially: true, button: "次へ"
  });
  assert.equal(h.state.text, "Hello!", "Silent dialogue remains readable");
  assert.deepEqual(h.state.controls.map(b => b.label), ["次へ", "ピコサポート"]);
  h.click("ピコサポート");
  assert(h.button("英文を見る"));
  assert(!h.button("日本語を見る"), "No fabricated Japanese translation");
  assert(h.button("もう一度聞く").disabled, "No fabricated voice");
  h.click("英文を見る");
  assert.equal(h.state.text, "Hello!");
  h.click("次へ");
  await silent;
  const voiced = h.ctx.PicoSupportController.present({
    speaker: "Bernie", text: "Look!", voiceKey: "existing_voice", button: "次へ"
  });
  assert.equal(h.state.text, "", "Previously voiced dialogue stays hidden initially");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.state.plays, 1);
  h.click("ピコサポート"); h.click("英文を見る");
  assert.equal(h.state.text, "Look!");
  h.click("次へ"); await voiced;

  for (const page of ["dev.html", "index.html"]) {
    const html = read(page);
    assert(html.includes("pico-support-controller.js?v=pico-story-dialogue-v2"));
    assert(html.includes("story-engine.js?v=pico-story-dialogue-v2"));
  }
  const engine = read("engine/core/story-engine.js");
  assert(engine.includes('if (window.PicoSupportController && typeof PicoSupportController.present === "function")'));
  assert(engine.includes("showEnglishInitially: !step.voiceKey"));
  console.log("pico-story-dialogue-v2: PASS (silent/voiced display, button, missing media, both entries)");
})().catch(e => { console.error(e); process.exitCode = 1; });
