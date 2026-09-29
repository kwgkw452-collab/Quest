"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

function nameHarness(speechResult, choiceResult) {
  const calls = [];
  const context = {
    window: {}, console, GameConfig: {}, StoryEvents: null,
    GameCore: { async speechMission() {
      if (speechResult instanceof Error) throw speechResult;
      return speechResult;
    } },
    DialogManager: {
      show(...args) { calls.push(["show", ...args]); },
      async choice() { calls.push(["choice"]); return choiceResult; },
      async textInput() { calls.push(["textInput"]); return "Text Name"; }
    },
    SaveManager: { setPlayerName(name) { calls.push(["save", name]); } },
    FiniteRescue: { consume() { calls.push(["consume"]); } },
    EffectManager: {}, CharacterManager: {}, MonsterManager: {}, AudioManager: {}, VideoManager: {},
    PicoBreakManager: {}, MonsterBattleManager: {}, QuestionManager: {}, CampManager: {}, MorningManager: {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/core/story-engine.js"), context);
  return { context, calls };
}

class MockAudio {
  constructor(src) { this.src = src; this.listeners = {}; this.paused = true; MockAudio.items.push(this); }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  emit(type) { (this.listeners[type] || []).forEach(handler => handler()); }
}
MockAudio.items = [];

function audioHarness(mode) {
  const graphs = [];
  class MockContext {
    constructor() { this.nodes = []; this.destination = {}; this.closed = false; graphs.push(this); if (mode === "construct") throw Error("context failed"); }
    resume() { return mode === "resume" ? Promise.reject(Error("resume failed")) : Promise.resolve(); }
    createBiquadFilter() { if (mode === "filter") throw Error("filter failed"); return this.node(); }
    createDynamicsCompressor() { return this.node(); }
    createWaveShaper() { return this.node(); }
    createMediaElementSource(audio) { this.sourceAudio = audio; return this.node(); }
    node() { const node = { frequency: {}, Q: {}, gain: {}, threshold: {}, ratio: {}, attack: {}, release: {},
      connect(destination) { this.destination = destination; }, disconnect() { this.disconnected = true; } };
      this.nodes.push(node); return node;
    }
    close() { this.closed = true; return Promise.resolve(); }
  }
  const context = { window: {}, Promise, setTimeout, Date, console, Audio: MockAudio,
    AssetManager: { audio(_type, key) { return key; } } };
  context.window = context;
  if (mode !== "unavailable") context.AudioContext = MockContext;
  vm.createContext(context);
  vm.runInContext(read("engine/managers/audio-manager.js"), context);
  return { context, graphs };
}

function controlHarness() {
  const plays = [];
  const controls = [];
  const context = { window: {}, Promise, GameConfig: { dialogueNextLabel: "Next" },
    DialogManager: {
      show() {}, setContent() {}, clearControls() { controls.length = 0; },
      addControl(label, handler) { controls.push({ label, handler }); }
    },
    DialogueVoiceController: {
      play(key, options) { plays.push([key, options]); return Promise.resolve({ status: "ended" }); },
      stop() { plays.push(["stop"]); }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("engine/controllers/pico-support-controller.js"), context);
  return { context, plays, click(label) { const control = controls.find(item => item.label === label); assert(control, label); control.handler(); } };
}

(async () => {
  for (const [heard, choice, expected, confirmation] of [
    ["Alex", "yes", "Alex", true],
    ["Alex", "no", "Text Name", true],
    ["   ", "yes", "Text Name", false],
    [new Error("no-speech"), "yes", "Text Name", false],
    [new Error("speech-timeout"), "yes", "Text Name", false],
    [new Error("not-allowed"), "yes", "Text Name", false],
    [{ status: "adventure_return", controlResult: "adventure_return" }, "yes", "Text Name", false]
  ]) {
    const { context, calls } = nameHarness(heard, choice);
    const state = {};
    await context.StoryEngine.runStep({ type: "confirmSpeechName", message: "name", saveAs: "playerName" }, state, 0, { id: "S001" });
    assert.strictEqual(state.playerName, expected);
    assert(calls.some(call => call[0] === "save" && call[1] === expected));
    assert.strictEqual(calls.some(call => call[0] === "choice"), confirmation);
    assert.strictEqual(calls.some(call => call[0] === "textInput"), expected === "Text Name");
  }

  const commandContext = { window: {} };
  commandContext.window = commandContext;
  vm.createContext(commandContext);
  vm.runInContext(read("engine/commands/story-commands.js"), commandContext);
  commandContext.StoryRegistry = { register(story) { commandContext.story = story; } };
  vm.runInContext(read("engine/stories/story-saki-departure.js"), commandContext);
  const steps = commandContext.story.steps;
  const radio = steps.filter(step => step.voiceEffect === "radio");
  assert.strictEqual(radio.length, 6);
  assert.deepStrictEqual(Array.from(radio, step => step.voiceKey), [
    "voice_c03_st004_010", "voice_c01_st004_003", "voice_c03_st004_011",
    "voice_c01_st004_004", "voice_c03_st004_012", "voice_c01_st004_005"
  ]);
  assert(steps.filter(step => step.type === "dialogue" && !radio.includes(step)).every(step => !step.voiceEffect));
  const farewellIndex = steps.findIndex(step => step.questionId === "phrase.farewell_saki");
  assert(farewellIndex > 0 && !steps[farewellIndex].voiceEffect);
  assert(steps.slice(farewellIndex + 1).filter(step => step.type === "dialogue").every(step => !step.voiceEffect));
  for (const key of ["voice_c03_st004_013", "voice_c03_st004_014", "voice_c03_st004_015", "voice_c03_st004_016", "voice_c03_st004_018"]) {
    assert.strictEqual(steps.find(step => step.voiceKey === key).voiceEffect, undefined, key);
  }

  const support = controlHarness();
  const completed = support.context.PicoSupportController.present(radio[0]);
  await flush();
  support.click("Pico's Support");
  support.click("もう一度聞く");
  assert.strictEqual(support.plays[0][1].voiceEffect, "radio");
  assert.strictEqual(support.plays[1][1].voiceEffect, "radio");
  support.click("Next");
  await completed;
  assert.strictEqual(support.plays.at(-1)[0], "stop");
  const next = support.context.PicoSupportController.present({ voiceKey: "voice_c03_st004_009", text: "Yes." });
  assert.strictEqual(support.plays.at(-1)[1].voiceEffect, undefined);
  support.click("Next");
  await next;
  const farewellNormal = support.context.PicoSupportController.present(steps.find(step => step.voiceKey === "voice_c03_st004_018"));
  await flush();
  support.click("Pico's Support");
  support.click("もう一度聞く");
  assert.strictEqual(support.plays.at(-1)[1].voiceEffect, undefined);
  support.click("004を終了する");
  await farewellNormal;

  const normal = audioHarness("ok");
  const plain = normal.context.DialogueVoiceAudioInternal.play("plain", { volume: 0.7 });
  assert.strictEqual(normal.graphs.length, 0);
  plain.audio.emit("ended");
  assert.strictEqual((await plain.completion).status, "ended");
  const effected = normal.context.DialogueVoiceAudioInternal.play("radio", { voiceEffect: "radio", volume: 0.7 });
  await flush();
  const graph = normal.graphs[0];
  assert.strictEqual(graph.nodes[0].frequency.value, 700);
  assert.strictEqual(graph.nodes[1].frequency.value, 2000);
  assert.strictEqual(graph.nodes[2].type, "peaking");
  assert.strictEqual(graph.nodes[2].frequency.value, 1700);
  assert.strictEqual(graph.nodes[2].Q.value, 1.0);
  assert.strictEqual(graph.nodes[2].gain.value, 12);
  assert.strictEqual(graph.nodes[3].ratio.value, 10);
  assert.strictEqual(graph.nodes[4].oversample, "2x");
  assert.strictEqual(graph.nodes[4].curve.length, 2048);
  assert(Array.from(graph.nodes[4].curve).every(value => value >= -0.901 && value <= 0.901), "saturation output retains clipping headroom");
  assert(Math.abs(graph.nodes[4].curve[1535]) > 0.78, "saturation is stronger than V5");
  assert.strictEqual(graph.nodes[0].destination, graph.nodes[1]);
  assert.strictEqual(graph.nodes[1].destination, graph.nodes[2]);
  assert.strictEqual(graph.nodes[2].destination, graph.nodes[3]);
  assert.strictEqual(graph.nodes[3].destination, graph.nodes[4]);
  assert.strictEqual(graph.nodes[4].destination, graph.destination);
  assert.strictEqual(graph.sourceAudio, effected.audio);
  normal.context.DialogueVoiceAudioInternal.stop();
  assert.strictEqual((await effected.completion).status, "stopped");
  assert(graph.closed && graph.nodes.every(node => node.disconnected));
  for (const mode of ["unavailable", "construct", "resume", "filter"]) {
    const fallback = audioHarness(mode);
    const tracked = fallback.context.DialogueVoiceAudioInternal.play("radio", { voiceEffect: "radio" });
    await flush();
    assert.strictEqual(tracked.audio.paused, false, mode + " must play the original voice");
    tracked.audio.emit("ended");
    assert.strictEqual((await tracked.completion).status, "ended");
  }
  console.log("Voice / Communication Polish V1 Phase 1: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
