"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

function morningContext(answer) {
  const calls = [];
  const context = {
    window: {}, console, Promise,
    Math: Object.create(Math),
    GameCore: { clearVisuals() {} },
    EffectManager: { setFilter() {}, setBackground() {}, async play() {}, async wait() {} },
    CharacterManager: { show() {}, clear() {} },
    DialogManager: {
      show(speaker, message) { calls.push(["dialogue", speaker, message]); },
      showRecognized(text, prefix) { calls.push(["recognized", text, prefix]); },
      hideRecognized() { calls.push(["recognized-hide"]); },
      hide() {},
      async next(label) { calls.push(["button", label]); },
      async choice(options) { calls.push(["choice", options]); return "depart"; },
      async textInput() { return answer; }
    },
    SpeechEngine: {
      supported: true,
      normalize(text) { return String(text || "").toLowerCase().replace(/[^a-z\s]/g, "").trim(); },
      includesAny(text, words) { return words.some(word => this.normalize(text).includes(this.normalize(word))); },
      stop() {}
    },
    SpeechStartController: {
      async prepare() { calls.push(["prepare"]); },
      async startListening(options, ui) {
        calls.push(["listening"]);
        ui.showRecognized("…");
        return answer;
      },
      cancel() {}
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
  const controllerSource = read("engine/services/speech-start-controller.js");
  const morningSource = read("engine/managers/morning-manager.js");
  const speechSource = read("engine/services/speech-engine.js");
  const questionSource = read("engine/managers/question-manager.js");

  const events = [];
  let finishListen;
  const controllerContext = {
    window: {}, Promise,
    console: { warn() {} },
    AudioManager: { stopAll() { events.push("stopAll"); } },
    SpeechAudioDuckingInternal: {
      isArmed() { return false; },
      begin() { throw new Error("not armed"); }
    },
    SpeechEngine: {
      listen() { events.push("listen"); return new Promise(resolve => { finishListen = resolve; }); },
      stop() { events.push("stop"); }
    }
  };
  controllerContext.window = controllerContext;
  vm.createContext(controllerContext);
  vm.runInContext(controllerSource, controllerContext);

  assert(controllerContext.SpeechStartController); // 1 thin layer exists
  assert.notStrictEqual(controllerContext.SpeechStartController.prepare, controllerContext.SpeechStartController.startListening); // 2 responsibilities split
  await controllerContext.SpeechStartController.prepare();
  assert(events.includes("stopAll")); // 3 Voice/SE can be stopped before Speech
  const ui = { showRecognized(value) { events.push("recognized:" + value); } };
  const first = controllerContext.SpeechStartController.startListening({}, ui);
  assert(events.includes("recognized:…")); // 4 Listening display
  assert(events.includes("listen")); // 5 SpeechEngine start
  const second = controllerContext.SpeechStartController.startListening({}, ui);
  assert.strictEqual(first, second); // 6 double-start prevention
  finishListen("happy");
  assert.strictEqual(await first, "happy"); // 7 Listening completion

  const morning = morningContext("I'm happy.");
  const morningResult = await morning.context.MorningManager.start("MORNING_001");
  assert.strictEqual(morningResult.heard, "I'm happy."); // 8 result acquisition
  assert.strictEqual(morningResult.category, "positive"); // 9 judgment unchanged
  assert(morning.calls.some(call => call[0] === "listening")); // 10 Morning starts as before
  assert(!morningSource.includes('next("話す")')); // 11 no new Talk button
  assert(morning.calls.some(call => call[0] === "recognized" && call[1] === "…")); // 12 initial display
  const finalDisplay = morning.calls.find(call => call[0] === "recognized" && call[1] === "I'm happy.");
  assert(finalDisplay); // 13 final recognized display
  assert.strictEqual(finalDisplay[2], "You said:\n"); // 14 visible label
  const finalIndex = morning.calls.indexOf(finalDisplay);
  const departureIndex = morning.calls.findIndex(call => call[0] === "button" && call[1] === "出発");
  assert(finalIndex < departureIndex); // 15 result remains visible before departure
  assert.strictEqual(morningResult.status, "completed"); // 16 Morning completion

  const silent = morningContext("");
  const silentResult = await silent.context.MorningManager.start("MORNING_001");
  assert.strictEqual(silentResult.category, "silent"); // 17 empty result safety
  assert(!silent.calls.some(call => call[0] === "recognized" && call[2] === "You said:\n")); // 18 empty is not shown as success
  assert(silent.calls.some(call => call[0] === "choice" && call[1].some(option => option.label === "出発"))); // 19 optional departure remains

  assert(speechSource.includes("ui.addStartButton(startListening, config)")); // 20 normal Talk button maintained
  assert(speechSource.includes("judge(result, config.accepted)")); // 21 normal judgment unchanged
  assert(speechSource.includes("retryOnMismatch === false")); // 22 retry contract unchanged

  const profileContext = { window: {} };
  profileContext.window = profileContext;
  vm.createContext(profileContext);
  vm.runInContext(read("data/audio-mix-profile.js"), profileContext);
  const duck = profileContext.AudioMixProfile.ducking.speechRecognition;
  assert.strictEqual(duck.ratio, 0.25); // 23
  assert.strictEqual(duck.duckMs, 300); // 24
  assert.strictEqual(duck.restoreMs, 600); // 25

  assert(questionSource.includes("SpeechStartController.prepare()")); // 26 shared preparation used by Question
  assert(morningSource.includes("SpeechStartController.startListening")); // 27 trigger-neutral future Support connection
  assert(!read("engine/stories/S001.js").includes("autoListening")); // 28 Voice-end auto Speech not enabled
  assert.strictEqual(hash("data/audio.js"), "e6c8de637d7946c9fe0107dea262a632e8fa2d703941db5169777a98bbdf4b56"); // 29 approved Voice assets
  assert.strictEqual(hash("engine/stories/S001.js"), "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1"); // 30 approved S001 Voice connections
  assert(/window\.QuestionManager\s*=\s*\{\s*start: start,\s*cancel: cancel,\s*getResult: getResult,\s*reset: reset/.test(questionSource)); // 31 Question API
  assert(/window\.SpeechEngine\s*=\s*\{[\s\S]*listen: listen,[\s\S]*mission: mission,[\s\S]*stop: stop/.test(speechSource)); // 32 Speech API
  assert(/window\.MorningManager\s*=\s*\{\s*start: start,\s*cancel: cancel,\s*getResult: getResult,\s*reset: reset/.test(morningSource)); // 33 Morning API
  assert(read("index.html").includes('engine/services/speech-start-controller.js')); // 34 production load
  assert(read("dev.html").includes('engine/services/speech-start-controller.js')); // 35 dev load

  controllerContext.SpeechStartController.cancel();
  assert(events.includes("stop")); // 36 cancel stops Recognition
  console.log("Speech UX Foundation V1.0 tests (36 checks): PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
