"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

function createMorning(listenResults, choices) {
  const calls = [];
  const pendingResults = listenResults.slice();
  const pendingChoices = (choices || []).slice();
  const context = {
    window: {}, console, Promise,
    Math: Object.create(Math),
    GameCore: { clearVisuals() {} },
    EffectManager: {
      setFilter() {}, setBackground() {}, async play() {},
      async wait(ms) { calls.push(["wait", ms]); }
    },
    CharacterManager: { show() {}, clear() {} },
    DialogManager: {
      show(speaker, message) { calls.push(["dialogue", speaker, message]); },
      hide() {},
      showRecognized(text, prefix) { calls.push(["recognized", text, prefix]); },
      hideRecognized() { calls.push(["recognized-hide"]); },
      async next(label) { calls.push(["next", label]); },
      async choice(options) {
        calls.push(["choice", options.map(option => option.label)]);
        return pendingChoices.length ? pendingChoices.shift() : "depart";
      },
      async textInput() { return ""; }
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
      normalize(text) { return String(text || "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(); },
      includesAny(text, words) { return words.some(word => this.normalize(text).includes(this.normalize(word))); },
      stop() {}
    },
    SpeechStartController: {
      async prepare() { calls.push(["prepare"]); },
      async startListening(options, ui) {
        calls.push(["listen"]);
        ui.showRecognized("…");
        const result = pendingResults.shift();
        if (result instanceof Error) throw result;
        return result;
      },
      cancel() {},
      isListening() { return false; }
    },
    AudioManager: { playVoice() {} },
    SaveManager: { getData() { return { player: { name: "Hiro" }, flags: { lastCamp: "forest" } }; } }
  };
  context.Math.random = () => 0;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("data/mornings.js"), context);
  vm.runInContext(read("engine/managers/morning-manager.js"), context);
  return { context, calls };
}

(async () => {
  const success = createMorning(["I'm happy."], []);
  const successResult = await success.context.MorningManager.start("MORNING_001");
  assert.strictEqual(successResult.category, "positive"); // 1
  assert(success.calls.some(call => call[0] === "recognized" && call[1] === "I'm happy." && call[2] === "You said:\n")); // 2
  assert(success.calls.some(call => call[0] === "next" && call[1] === "出発")); // 3
  assert(!success.calls.some(call => call[0] === "choice")); // 4

  for (const categoryCase of [
    ["I'm pretty good.", "neutral"],
    ["I'm tired.", "negative"],
    ["I'm sick.", "sick"],
    ["I'm hungry.", "hungry"],
    ["mysterious", "unknown"]
  ]) {
    const item = createMorning([categoryCase[0]], []);
    assert.strictEqual((await item.context.MorningManager.start("MORNING_001")).category, categoryCase[1]);
    assert(!item.calls.some(call => call[0] === "choice"));
  } // 5-10 categories and unknown remain non-silent

  const noSpeech = createMorning([new Error("no-speech")], ["depart"]);
  const noSpeechResult = await noSpeech.context.MorningManager.start("MORNING_001");
  assert.strictEqual(noSpeechResult.category, "silent"); // 11
  assert(noSpeech.calls.some(call => call[0] === "dialogue" && call[2] === "うまく聞き取れなかったピコ。\nもう一度話してみる？")); // 12

  const timeout = createMorning([new Error("speech-timeout")], ["depart"]);
  assert.strictEqual((await timeout.context.MorningManager.start("MORNING_001")).status, "completed"); // 13
  assert(timeout.calls.some(call => call[0] === "choice")); // 14

  const empty = createMorning([""], ["depart"]);
  const emptyResult = await empty.context.MorningManager.start("MORNING_001");
  assert.strictEqual(emptyResult.category, "silent"); // 15
  const emptyChoice = empty.calls.find(call => call[0] === "choice");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(emptyChoice[1])), ["もう一度言う", "出発"]); // 16-17 both choices
  assert.strictEqual(emptyResult.status, "completed"); // 18 departure completes
  assert(!empty.calls.some(call => call[0] === "recognized" && call[2] === "You said:\n")); // 19 empty not displayed as recognized

  const retry = createMorning(["", "I'm happy."], ["retry"]);
  const retryResult = await retry.context.MorningManager.start("MORNING_001");
  assert.strictEqual(retryResult.category, "positive"); // 20 retry reaches normal success
  assert.strictEqual(retry.calls.filter(call => call[0] === "listen").length, 2); // 21 Speech restarted
  assert.strictEqual(retry.calls.filter(call => call[0] === "prepare").length, 2); // 22 shared preparation reused
  assert(retry.calls.filter(call => call[0] === "recognized-hide").length >= 1); // 23 previous display cleared
  assert.strictEqual(retry.calls.filter(call => call[0] === "choice").length, 1); // 24 no forced loop after success

  const permission = createMorning([new Error("not-allowed"), "happy"], ["retry"]);
  const permissionResult = await permission.context.MorningManager.start("MORNING_001");
  assert.strictEqual(permissionResult.category, "positive"); // 25 permission recovery preserved
  assert(permission.calls.some(call => call[0] === "choice" && call[1][0] === "もう一度言う")); // 26
  assert(permission.calls.some(call => call[0] === "choice" && call[1][1] === "言わずに冒険に戻る")); // 27

  assert(read("engine/services/speech-engine.js").includes("ui.addStartButton(startListening, config)")); // 28 normal Talk button remains
  assert.strictEqual(hash("engine/managers/question-manager.js"), "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d"); // S005 trace added; shared Speech API remains preserved
  assert(/window\.SpeechStartController\s*=\s*\{\s*prepare: prepare,\s*startListening: startListening,\s*cancel: cancel,/.test(read("engine/services/speech-start-controller.js"))); // 30 public contract unchanged

  const profileContext = { window: {} };
  profileContext.window = profileContext;
  vm.createContext(profileContext);
  vm.runInContext(read("data/audio-mix-profile.js"), profileContext);
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.ratio, 0.25); // 31
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.duckMs, 300); // 32
  assert.strictEqual(profileContext.AudioMixProfile.ducking.speechRecognition.restoreMs, 600); // 33
  assert.strictEqual(hash("data/audio.js"), "e6c8de637d7946c9fe0107dea262a632e8fa2d703941db5169777a98bbdf4b56"); // 34
  assert.strictEqual(hash("engine/stories/S001.js"), "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1"); // 35
  assert.strictEqual(hash("dev/dev-jump-manager.js"), "2404155bf8862ae2a3e91d236a87841ecdcc9391ceeae042643a648407bcfa33"); // 36 Dev-only runtime dispatch trace; Morning behavior remains preserved

  console.log("Speech UX Foundation V1.1 Morning retry tests (36 checks): PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
