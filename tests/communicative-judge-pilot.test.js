const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
let checks = 0;
function ok(value, message) { assert(value, message); checks += 1; }
function equal(actual, expected, message) { assert.strictEqual(actual, expected, message); checks += 1; }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const context = { console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
function load(file) { vm.runInContext(read(file), context, { filename: file }); }

load("engine/services/speech-normalizer.js");
load("data/word-dictionaries.js");
load("data/lottery-pools.js");
load("data/communicative-judge-rules.js");
load("engine/services/lottery-engine.js");
load("engine/services/local-communicative-judge.js");
load("engine/services/communicative-judge.js");
load("engine/services/communicative-question-adapter.js");

context.LotteryEngine.init(context.LotteryPoolData);
const draw = context.LotteryEngine.draw("shopping.fruit.order.v1", { randomFn: () => 0 });
const adapterSource = read("engine/services/communicative-question-adapter.js");
const pilotSource = read("dev/communicative-judge-pilot.js");
const speechSource = read("engine/services/speech-engine.js");
const devHtml = read("dev.html");
const indexHtml = read("index.html");

(async () => {
  const pilotNodes = [];
  const scene = {
    id: "scene",
    children: [],
    appendChild(node) { this.children.push(node); }
  };
  const pilotDocument = {
    createElement(tag) {
      const node = {
        tag,
        children: [],
        style: {},
        hidden: false,
        disabled: false,
        textContent: "",
        appendChild(child) { this.children.push(child); },
        addEventListener(name, listener) { this[name] = listener; }
      };
      pilotNodes.push(node);
      return node;
    },
    getElementById(id) {
      if (id === "scene") return scene;
      return pilotNodes.find(node => node.id === id) || null;
    }
  };
  const pilotContext = { console, setTimeout, clearTimeout, document: pilotDocument };
  pilotContext.window = pilotContext;
  pilotContext.addEventListener = () => {};
  const pilotSpeechQueue = [];
  pilotContext.SpeechStartController = {
    prepare: async () => {},
    startListening: async options => {
      const pendingSpeech = pilotSpeechQueue.shift();
      if (!pendingSpeech) throw new Error("missing-test-speech");
      options.onAlternatives(["Can I get an apple?"]);
      return pendingSpeech.promise;
    },
    cancel: () => {}
  };
  vm.createContext(pilotContext);
  for (const file of [
    "engine/services/speech-normalizer.js",
    "data/word-dictionaries.js",
    "data/lottery-pools.js",
    "data/communicative-judge-rules.js",
    "engine/services/lottery-engine.js",
    "engine/services/local-communicative-judge.js",
    "engine/services/communicative-judge.js",
    "engine/services/communicative-question-adapter.js"
  ]) vm.runInContext(read(file), pilotContext, { filename: file });
  pilotContext.LotteryPoolData[0].items.reverse();
  vm.runInContext(pilotSource, pilotContext, { filename: "dev/communicative-judge-pilot.js" });
  pilotContext.CommunicativeJudgePilot.show();
  equal(pilotContext.CommunicativeJudgePilot.getState().draw.itemId, "apple", "Pilot finds apple after pool reorder");
  equal(pilotContext.CommunicativeJudgePilot.getState().draw.conceptId, "shopping.fruit.apple.order");
  ok(!pilotSource.includes("randomFn: function () { return 0; }"), "Pilot no longer assumes the first candidate");

  const speechButton = pilotNodes.find(node => node.textContent === "話す");
  const pilotJudge = pilotContext.CommunicativeJudge.judge;
  let pilotJudgeCalls = 0;
  pilotContext.CommunicativeJudge.judge = async value => {
    pilotJudgeCalls += 1;
    return pilotJudge(value);
  };
  const cancelledPilotSpeech = deferred();
  pilotSpeechQueue.push(cancelledPilotSpeech);
  const cancelledPilotRun = speechButton.click();
  await Promise.resolve();
  pilotContext.CommunicativeJudgePilot.cancel();
  cancelledPilotSpeech.resolve("Can I get an apple?");
  await cancelledPilotRun;
  equal(pilotJudgeCalls, 0, "Pilot cancel blocks an old Speech result before Judge");

  const oldPilotSpeech = deferred();
  const newPilotSpeech = deferred();
  pilotSpeechQueue.push(oldPilotSpeech, newPilotSpeech);
  const oldPilotRun = speechButton.click();
  await Promise.resolve();
  const newPilotRun = speechButton.click();
  await Promise.resolve();
  oldPilotSpeech.resolve("Can I get an apple?");
  await oldPilotRun;
  equal(pilotJudgeCalls, 0, "A new Pilot run blocks the old Speech result before Judge");
  newPilotSpeech.resolve("Can I get an apple?");
  await newPilotRun;
  equal(pilotJudgeCalls, 1, "The current Pilot run calls Judge once");
  pilotContext.CommunicativeJudge.judge = pilotJudge;

  ok(context.CommunicativeQuestionAdapter, "Adapter exists"); // 1
  ok(!adapterSource.includes("LotteryEngine.draw"), "Adapter does not draw"); // 2
  ok(!adapterSource.includes("SpeechRecognitionAdapter"), "Adapter does not call recognition adapter"); // 3
  ok(!adapterSource.includes("approved-variant") && !adapterSource.includes("explicit-negative"), "Adapter has no Judge rules"); // 4

  const input = context.CommunicativeQuestionAdapter.buildJudgeInput(draw, {
    transcript: "Can I have an apple?",
    alternatives: ["Can I get an apple?"]
  });
  ok(input && typeof input === "object"); // 5
  equal(input.conceptId, draw.conceptId); // 6
  equal(input.expectedUtterance, draw.expectedUtterance); // 7
  equal(JSON.stringify(input.acceptedVariants), JSON.stringify(Array.from(draw.acceptedVariants))); // 8
  equal(input.difficulty, draw.difficulty); // 9
  equal(input.context.promptType, draw.promptType); // 10
  equal(input.context.poolId, draw.poolId); // 11
  equal(input.context.itemId, draw.itemId); // 12
  equal(input.utterance, "Can I have an apple?"); // 13
  equal(JSON.stringify(input.alternatives), JSON.stringify(["Can I get an apple?"])); // 14

  const originalAlternatives = [
    "I don't want an apple.",
    "Can I get an apple?",
    "alternative 3",
    "alternative 4",
    "alternative 5",
    "alternative 6"
  ];
  const originalSnapshot = originalAlternatives.slice();
  let capturedInput = null;
  const actualJudge = context.CommunicativeJudge.judge;
  context.CommunicativeJudge.judge = async value => {
    capturedInput = value;
    return actualJudge(value);
  };
  const cappedToken = context.CommunicativeQuestionAdapter.begin();
  const cappedResult = await context.CommunicativeQuestionAdapter.evaluate(draw, {
    status: "recognized",
    transcript: "Can I get an apple?",
    alternatives: originalAlternatives
  }, cappedToken);
  equal(capturedInput.alternatives.length, 5, "Judge receives at most five alternatives");
  equal(JSON.stringify(originalAlternatives), JSON.stringify(originalSnapshot), "Source alternatives stay unchanged");
  equal(capturedInput.utterance, "Can I get an apple?", "Primary transcript stays separate and first");
  equal(cappedResult.judge.matchedVariant, "Can I get an apple?", "Primary transcript keeps priority");
  context.CommunicativeJudge.judge = actualJudge;

  async function evaluate(text, alternatives) {
    const token = context.CommunicativeQuestionAdapter.begin();
    return context.CommunicativeQuestionAdapter.evaluate(draw, {
      status: "recognized", transcript: text, alternatives: alternatives || []
    }, token);
  }
  equal((await evaluate("Can I have an apple?")).status, "accept"); // 15
  equal((await evaluate("I don't want an apple.")).status, "reject"); // 16
  const unknown = await evaluate("May I get an apple?");
  equal(unknown.status, "unknown"); // 17
  ok(unknown.status !== "failure"); // 18

  let judgeCalls = 0;
  const realJudge = context.CommunicativeJudge.judge;
  context.CommunicativeJudge.judge = async value => { judgeCalls += 1; return realJudge(value); };
  const speechFailure = await context.CommunicativeQuestionAdapter.evaluate(draw, { status: "failure", transcript: "", error: "no-speech" });
  equal(judgeCalls, 0); // 19
  equal(speechFailure.status, "speech-failure"); // 20
  ok(speechFailure.status !== unknown.status); // 21
  context.CommunicativeJudge.judge = realJudge;

  judgeCalls = 0;
  context.CommunicativeJudge.judge = async value => { judgeCalls += 1; return realJudge(value); };
  const cancelledSpeech = deferred();
  const cancelledToken = context.CommunicativeQuestionAdapter.begin();
  const cancelledFlow = cancelledSpeech.promise.then(transcript => context.CommunicativeQuestionAdapter.evaluate(draw, {
    status: "recognized", transcript, alternatives: []
  }, cancelledToken));
  context.CommunicativeQuestionAdapter.cancel();
  cancelledSpeech.resolve("Can I get an apple?");
  equal((await cancelledFlow).status, "cancelled", "Cancelled speech result is discarded before Judge");
  equal(judgeCalls, 0, "Cancelled speech result does not call Judge");

  const oldSpeech = deferred();
  const staleToken = context.CommunicativeQuestionAdapter.begin();
  const staleFlow = oldSpeech.promise.then(transcript => context.CommunicativeQuestionAdapter.evaluate(draw, {
    status: "recognized", transcript, alternatives: []
  }, staleToken));
  const currentToken = context.CommunicativeQuestionAdapter.begin();
  oldSpeech.resolve("Can I get an apple?");
  equal((await staleFlow).status, "cancelled", "Old run is discarded after a new run begins");
  equal(judgeCalls, 0, "Old run does not call Judge");
  const currentResult = await context.CommunicativeQuestionAdapter.evaluate(draw, {
    status: "recognized", transcript: "Can I get an apple?", alternatives: []
  }, currentToken);
  equal(currentResult.status, "accept", "Current run still evaluates normally");
  equal(judgeCalls, 1, "Current run calls Judge exactly once");
  context.CommunicativeJudge.judge = realJudge;

  equal(unknown.judge.reason, "no-provider"); // 22
  equal((await evaluate("Can I have an apple?")).judge.verdict, "ACCEPT"); // 23
  equal((await evaluate("I don't want an apple.")).judge.verdict, "REJECT"); // 24
  equal((await evaluate("May I get an apple?")).judge.verdict, "UNKNOWN"); // 25
  ok(pilotSource.includes("judgeSpeech(value, [], token)"), "Text fallback uses Adapter path"); // 26
  ok(pilotSource.includes("MAX_RETRIES = 1")); // 27
  ok(!/while\s*\(\s*true\s*\)/.test(pilotSource + adapterSource)); // 28
  ok(pilotSource.includes('status: "skipped"')); // 29
  ok(!pilotSource.includes("SaveManager") && !pilotSource.includes("StoryEngine")); // 30

  let release;
  context.CommunicativeJudge.judge = () => new Promise(resolve => { release = resolve; });
  const oldToken = context.CommunicativeQuestionAdapter.begin();
  const pending = context.CommunicativeQuestionAdapter.evaluate(draw, { status: "recognized", transcript: "anything", alternatives: [] }, oldToken);
  context.CommunicativeQuestionAdapter.cancel();
  release({ verdict: "ACCEPT", source: "local", reason: "test" });
  equal((await pending).status, "cancelled"); // 31
  context.CommunicativeJudge.judge = realJudge;

  const speechContext = {
    console,
    setTimeout: fn => fn(),
    GameConfig: { defaultLanguage: "en-US" },
    SpeechNormalizer: context.SpeechNormalizer,
    SpeechRecognitionAdapter: {
      supported: true,
      stop() {},
      async listen(options) {
        options.onAlternatives(["Can I get an apple?", "Can I have an apple?"]);
        return "recognition noise";
      }
    }
  };
  speechContext.window = speechContext;
  vm.createContext(speechContext);
  vm.runInContext(speechSource, speechContext, { filename: "speech-engine.js" });
  let forwarded = null;
  const heard = await speechContext.SpeechEngine.listen({ onAlternatives: values => { forwarded = values; } });
  equal(JSON.stringify(forwarded), JSON.stringify(["Can I get an apple?", "Can I have an apple?"])); // 32
  equal(heard, "recognition noise"); // 33
  equal(await speechContext.SpeechEngine.listen({}), "recognition noise"); // 34
  const speechPublic = speechSource.slice(speechSource.indexOf("window.SpeechEngine ="));
  ["listen", "mission", "judge", "normalize", "includesAny", "stop", "on", "getStatus"].forEach(name => ok(speechPublic.includes(name))); // 35-42

  const questionSource = read("engine/managers/question-manager.js");
  ["start", "cancel", "getResult", "reset"].forEach(name => ok(questionSource.includes(name + ": " + name))); // 43-46
  ok(!questionSource.includes("CommunicativeQuestionAdapter")); // 47
  ok(!read("data/questions.js").includes("CommunicativeJudge")); // 48
  ok(!read("engine/core/story-engine.js").includes("CommunicativeJudge")); // 49
  ok(!read("engine/managers/monster-battle-manager.js").includes("CommunicativeJudge")); // 50
  ok(!read("engine/managers/morning-manager.js").includes("CommunicativeJudge")); // 51
  ok(!indexHtml.includes("communicative-judge-pilot") && indexHtml.includes("engine/services/communicative-question-adapter.js?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1")); // 52
  ok(devHtml.includes("dev/communicative-judge-pilot.js")); // 53
  ok(pilotSource.includes("engine/services/communicative-question-adapter.js")); // 54
  ok(!read("engine/services/lottery-engine.js").includes("CommunicativeQuestionAdapter")); // 55
  ok(!read("engine/services/communicative-judge.js").includes("CommunicativeQuestionAdapter")); // 56
  ok(!read("data/word-dictionaries.js").includes("CommunicativeQuestionAdapter")); // 57

  const newSources = adapterSource + pilotSource;
  ["fetch(", "XMLHttpRequest", "API_KEY", "Gemini", "OpenAI", "localStorage", "Candidate"].forEach(value => ok(!newSources.includes(value))); // 58-64
  ok(!pilotSource.includes("SceneManager.start") && !pilotSource.includes("StoryManager")); // 65
  equal((await evaluate("Can I have an apple?")).status, "accept"); // 66
  equal((await evaluate("Can I get an apple?")).status, "accept"); // 67
  equal((await evaluate("Could I get an apple?")).status, "accept"); // 68
  equal((await evaluate("I don't want an apple.")).status, "reject"); // 69
  equal((await evaluate("May I get an apple?")).status, "unknown"); // 70
  equal((await evaluate("Can I have apple")).status, "unknown", "Missing article remains UNKNOWN");
  equal((await evaluate("Can I have a apple")).status, "unknown", "Wrong article remains UNKNOWN");
  equal((await evaluate("Can I have Appel")).status, "unknown", "Recognition spelling drift remains UNKNOWN");
  equal((await evaluate("Can I have a ball")).status, "unknown", "Different noun remains UNKNOWN");

  for (const [utterance, variant] of [
    ["eighteen", "eight"],
    ["pineapple", "apple"],
    ["10", "1"],
    ["yesterday", "yes"],
    ["someone", "one"],
    ["can't", "can"]
  ]) {
    const fakeDraw = Object.assign({}, draw, { conceptId: "pilot.exact", acceptedVariants: [variant] });
    const token = context.CommunicativeQuestionAdapter.begin();
    const value = await context.CommunicativeQuestionAdapter.evaluate(fakeDraw, { status: "recognized", transcript: utterance, alternatives: [] }, token);
    equal(value.status, "unknown", `${utterance} must not match ${variant}`);
  } // 71-73

  equal(hash("data/lottery-pools.js"), "c4af3112d18e7eaa29e9aa512b4cdafe6f35e8c22781737c0c21b9d02df0d490"); // 74
  equal(hash("engine/services/lottery-engine.js"), "70743782f3461c4b4c351ee98a1fb21787fc01a2fc11908d2a50c5cbc04f7758"); // 75
  equal(hash("data/communicative-judge-rules.js"), "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279"); // 76 Formal Rule added
  equal(hash("engine/services/local-communicative-judge.js"), "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58"); // 77
  equal(hash("engine/services/communicative-judge.js"), "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04"); // 78

  console.log(`Communicative Judge Pilot V1 tests (${checks} checks): PASS`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
