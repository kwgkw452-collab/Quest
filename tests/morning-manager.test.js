"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function createContext(answer, randomValue, choices) {
  const calls = [];
  const context = {
    console,
    Promise,
    Math: Object.create(Math),
    window: {},
    GameConfig: { dialogueNextLabel: "つぎへ" },
    GameCore: { clearVisuals() { calls.push(["clear"]); } },
    EffectManager: {
      setFilter(value) { calls.push(["filter", value]); },
      setBackground(src) { calls.push(["background", src]); },
      async play(key, ms) { calls.push(["effect", key, ms]); },
      async wait(ms) { calls.push(["wait", ms]); }
    },
    CharacterManager: {
      show(items) { calls.push(["characters", items]); },
      clear() { calls.push(["characters-clear"]); }
    },
    DialogManager: {
      show(speaker, text) { calls.push(["dialogue", speaker, text]); },
      async next(button) { calls.push(["button", button]); },
      async choice(options) {
        calls.push(["choice", options]);
        return choices && choices.length ? choices.shift() : "depart";
      },
      hide() { calls.push(["hide"]); },
      showRecognized(text) { calls.push(["recognized", text]); },
      hideRecognized() { calls.push(["recognized-hide"]); },
      async textInput() { return answer; }
    },
    FiniteRescue: {
      isImmediateTechnicalFailure(error) { return String(error || "").includes("not-allowed"); },
      async choose(allowRetry) {
        return context.DialogManager.choice((allowRetry ? [{ label: "もう一度言う", value: "retry" }] : []).concat([
          { label: "言わずに冒険に戻る", value: "adventure_return" }
        ]));
      }
    },
    SpeechEngine: {
      supported: true,
      async listen() { return answer; },
      normalize(text) { return String(text || "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(); },
      includesAny(text, words) { return words.some(word => this.normalize(text).includes(this.normalize(word))); },
      stop() { calls.push(["speech-stop"]); }
    },
    AudioManager: { playVoice(src) { calls.push(["voice", src]); } },
    SaveManager: { getData() { return { player: { name: "Hiro" }, flags: { lastCamp: "forest" } }; } }
  };
  context.Math.random = () => randomValue === undefined ? 0 : randomValue;
  context.window = context;
  vm.createContext(context);
  for (const file of ["data/mornings.js", "engine/managers/morning-manager.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return { context, calls };
}

(async () => {
  const positive = createContext("I'm feeling great today.", 0);
  assert.deepStrictEqual(Object.keys(positive.context.MorningManager).sort(), ["cancel", "getResult", "reset", "start"]);
  const result = await positive.context.MorningManager.start("MORNING_001");
  assert.strictEqual(result.status, "completed");
  assert.strictEqual(result.sceneId, "scene_morning_routine");
  assert.strictEqual(result.category, "positive");
  assert.strictEqual(result.reactionId, "positive_a");
  assert(positive.calls.some(call => call[0] === "background" && call[1] === "forestMorning"));
  assert(positive.calls.some(call => call[0] === "effect" && call[1] === "morning-fade-in" && call[2] === 3000));
  assert(positive.calls.some(call => call[0] === "dialogue" && call[2].includes("Good morning, Hiro!")));
  assert(positive.calls.some(call => call[0] === "button" && call[1] === "出発"));
  assert(!positive.calls.some(call => call[0] === "voice"), "empty future voice paths must not be played");

  const negative = createContext("I am unhappy and tired.", 0.99);
  const negativeResult = await negative.context.MorningManager.start("MORNING_001");
  assert.strictEqual(negativeResult.category, "negative", "unhappy must not be mistaken for happy");
  assert.strictEqual(negativeResult.reactionId, "negative_c");

  const neutral = createContext("I'm pretty good.", 0);
  assert.strictEqual((await neutral.context.MorningManager.start("MORNING_001")).category, "neutral");

  const unknown = createContext("mysterious", 0);
  assert.strictEqual((await unknown.context.MorningManager.start("MORNING_001")).category, "unknown");

  const silent = createContext("", 0);
  assert.strictEqual((await silent.context.MorningManager.start("MORNING_001")).category, "silent");

  const retry = createContext("happy", 0, ["retry"]);
  let listenCount = 0;
  retry.context.SpeechEngine.listen = async function () {
    listenCount += 1;
    if (listenCount === 1) throw new Error("not-allowed");
    return "happy";
  };
  assert.strictEqual((await retry.context.MorningManager.start("MORNING_001")).category, "positive");
  assert.strictEqual(listenCount, 2, "microphone startup errors must retry instead of becoming Silent");
  assert(retry.calls.some(call => call[0] === "choice"));

  const earlyNoSpeech = createContext("", 0);
  earlyNoSpeech.context.SpeechEngine.listen = async function () { throw new Error("no-speech"); };
  assert.strictEqual((await earlyNoSpeech.context.MorningManager.start("MORNING_001")).category, "silent");
  assert(earlyNoSpeech.calls.some(call => call[0] === "wait" && call[1] >= 7900),
    "an early no-speech event must wait for the configured timeout");

  const data = positive.context.MorningDatabase.get("MORNING_001");
  const keywordCount = Object.values(data.categories).reduce((sum, category) => sum + category.keywords.length, 0);
  const reactionCount = Object.values(data.categories).reduce((sum, category) => sum + category.reactions.length, 0);
  assert(keywordCount >= 70, "the approximately-80-term emotion dictionary must be present");
  assert.strictEqual(reactionCount, 18);
  assert(!JSON.stringify(data).includes("バーニー"));
  assert(!JSON.stringify(data).includes("Barney"));
  assert(data.categories.positive.reactions.every(item => Object.hasOwn(item, "voice")), "future voice slot must remain");

  positive.context.MorningManager.reset();
  assert.strictEqual(positive.context.MorningManager.getResult(), null);
  await assert.rejects(() => positive.context.MorningManager.start("UNKNOWN"), /Morning not found/);
  console.log("Morning Manager Ver.1.1 test: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
