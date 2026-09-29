"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function createHarness(traceEnabled) {
  const calls = [];
  const tableCalls = [];
  const normalSaveText = JSON.stringify({ player: { name: "Hiro" } });
  let saveData = { player: { name: "Old Dev" } };
  let morningReceiver = null;
  let morningArguments = null;
  const morningPromise = Promise.resolve({ status: "completed", unchanged: true });
  const runtimeBase = "http://localhost:8000/";

  const context = {
    console: {
      log: console.log,
      error: console.error,
      table(rows) { tableCalls.push(rows); }
    },
    location: { href: runtimeBase + "dev.html?trace-test=1" },
    document: {
      URL: runtimeBase + "dev.html?trace-test=1",
      scripts: [
        { src: runtimeBase + "dev/dev-jump-runtime-trace.js" },
        { src: runtimeBase + "dev/dev-checkpoints.js" },
        { src: runtimeBase + "dev/dev-jump-manager.js" },
        { src: runtimeBase + "dev/dev-jump-ui.js" }
      ]
    },
    performance: {
      getEntriesByType(type) {
        return type === "navigation" ? [{ name: runtimeBase + "dev.html?trace-test=1" }] : [];
      }
    },
    addEventListener() {},
    localStorage: {
      getItem(key) { return key === "eigo-de-quest:save:v2" ? normalSaveText : null; }
    },
    SaveManager: {
      getData() { return JSON.parse(JSON.stringify(saveData)); },
      importData(text) {
        saveData = JSON.parse(text);
        calls.push(["save.import"]);
        return saveData;
      },
      completeStory(id) {
        if (!saveData.progress.completedStories.includes(id)) saveData.progress.completedStories.push(id);
        calls.push(["save.complete", id]);
      }
    },
    SceneManager: {
      isRunning() { return false; },
      async start(id, state) { calls.push(["story", id]); return state; }
    },
    MonsterBattleManager: {
      cancel() { calls.push(["monster.cancel"]); },
      async start(id) { calls.push(["monster", id]); return { cleared: true, aborted: false }; }
    },
    CampManager: {
      cancel() { calls.push(["camp.cancel"]); },
      async start(id) { calls.push(["camp", id]); return { status: "completed" }; }
    },
    MorningManager: {
      cancel() { calls.push(["morning.cancel"]); },
      start() {
        morningReceiver = this;
        morningArguments = Array.from(arguments);
        return morningPromise;
      }
    },
    QuestionManager: { cancel() { calls.push(["question.cancel"]); } },
    SpeechEngine: { stop() { calls.push(["speech.stop"]); } },
    AudioManager: { stopAll() { calls.push(["audio.stopAll"]); } },
    VideoManager: { clear() { calls.push(["video.clear"]); } },
    DialogManager: {
      hideRecognized() { calls.push(["dialog.hideRecognized"]); },
      hide() { calls.push(["dialog.hide"]); }
    },
    CharacterManager: { clear() { calls.push(["character.clear"]); } },
    MonsterManager: { clear() { calls.push(["monster.clear"]); } },
    EffectManager: {
      setBattleDamage() { calls.push(["effect.damage"]); },
      setFilter() { calls.push(["effect.filter"]); }
    },
    GameCore: { clearVisuals() { calls.push(["visual.clear"]); } }
  };
  context.window = context;
  vm.createContext(context);

  function load(file) {
    vm.runInContext(read(file), context, { filename: file });
  }

  if (traceEnabled) load("dev/dev-jump-runtime-trace.js");
  load("dev/dev-checkpoints.js");
  load("dev/dev-jump-manager.js");
  if (traceEnabled) load("dev/dev-jump-ui.js");

  return {
    context,
    calls,
    tableCalls,
    morningPromise,
    getMorningReceiver: () => morningReceiver,
    getMorningArguments: () => morningArguments,
    getSaveData: () => JSON.parse(JSON.stringify(saveData))
  };
}

async function runDispatch(checkpointId, traceEnabled) {
  const harness = createHarness(traceEnabled);
  let operationId = null;
  if (traceEnabled) {
    operationId = harness.context.DevJumpRuntimeTrace.beginOperation(checkpointId, "dev-jump-ui-click");
  }
  await harness.context.DevJumpManager.start(checkpointId, operationId);
  return {
    harness,
    dispatchCalls: harness.calls.filter(call => ["monster", "camp", "story"].includes(call[0]))
  };
}

function dispatchSnapshot(harness) {
  return plain(harness.context.DevJumpRuntimeTrace.getEntries()).find(entry =>
    entry.event === "dev-jump-dispatch-snapshot");
}

(async () => {
  const indexHtml = read("index.html");
  const devHtml = read("dev.html");
  assert(!indexHtml.includes("dev-jump-runtime-trace"), "Production index must not load the Dev trace");
  assert(devHtml.includes('<script src="dev/dev-jump-runtime-trace.js"></script>'));
  assert(!devHtml.includes('dev/dev-jump-runtime-trace.js?'), "Do not add a cache-busting query");
  assert(devHtml.indexOf("dev/dev-jump-runtime-trace.js") < devHtml.indexOf("dev/dev-checkpoints.js"));

  const m002Disabled = await runDispatch("M002_BATTLE", false);
  const m002Enabled = await runDispatch("M002_BATTLE", true);
  assert.deepStrictEqual(m002Disabled.dispatchCalls, [
    ["monster", "m002"], ["camp", "CAMP_M002"], ["story", "S004"]
  ]);
  assert.deepStrictEqual(m002Enabled.dispatchCalls, m002Disabled.dispatchCalls,
    "Trace enabled/disabled must dispatch m002 identically");

  const m002Snapshot = dispatchSnapshot(m002Enabled.harness);
  assert(m002Snapshot);
  assert.strictEqual(m002Snapshot.clickedCheckpointId, "M002_BATTLE");
  assert.deepStrictEqual(m002Snapshot.resolvedCheckpointEntry, { kind: "monster", id: "m002" });
  assert.strictEqual(m002Snapshot.dispatchAdapter, "monster");
  assert.strictEqual(m002Snapshot.monsterId, "m002");
  assert.strictEqual(m002Snapshot.storyId, null);
  assert.strictEqual(m002Snapshot.campId, null);
  assert.strictEqual(m002Snapshot.currentLocation, "http://localhost:8000/dev.html?trace-test=1");

  const runtime = m002Snapshot.loadedRuntimeVersion;
  assert.strictEqual(runtime.traceApiVersion, "DEV_JUMP_RUNTIME_DISPATCH_TRACE_V1");
  assert.strictEqual(runtime.documentUrl, "http://localhost:8000/dev.html?trace-test=1");
  assert.strictEqual(runtime.devHtmlUrl, "http://localhost:8000/dev.html?trace-test=1");
  assert.deepStrictEqual(runtime.devCheckpoints, {
    url: "http://localhost:8000/dev/dev-checkpoints.js",
    codeId: "eigo-de-quest/dev-checkpoints/runtime-dispatch-trace-v1"
  });
  assert.deepStrictEqual(runtime.devJumpManager, {
    url: "http://localhost:8000/dev/dev-jump-manager.js",
    codeId: "eigo-de-quest/dev-jump-manager/runtime-dispatch-trace-v1"
  });
  assert.deepStrictEqual(runtime.devJumpUi, {
    url: "http://localhost:8000/dev/dev-jump-ui.js",
    codeId: "eigo-de-quest/dev-jump-ui/runtime-dispatch-trace-v1"
  });

  const m003Disabled = await runDispatch("M003_BATTLE", false);
  const m003Enabled = await runDispatch("M003_BATTLE", true);
  assert.deepStrictEqual(m003Disabled.dispatchCalls, [
    ["monster", "m003"], ["story", "st004"]
  ]);
  assert.deepStrictEqual(m003Enabled.dispatchCalls, m003Disabled.dispatchCalls,
    "Trace enabled/disabled must dispatch m003 identically");

  const m003Snapshot = dispatchSnapshot(m003Enabled.harness);
  assert.strictEqual(m003Snapshot.clickedCheckpointId, "M003_BATTLE");
  assert.deepStrictEqual(m003Snapshot.resolvedCheckpointEntry, { kind: "monster", id: "m003" });
  assert.strictEqual(m003Snapshot.dispatchAdapter, "monster");
  assert.strictEqual(m003Snapshot.monsterId, "m003");
  assert.strictEqual(m003Snapshot.storyId, null);
  assert.strictEqual(m003Snapshot.campId, null);

  const api = m002Enabled.harness.context.DevJumpRuntimeTrace;
  assert.strictEqual(api, m002Enabled.harness.context.__DEV_JUMP_RUNTIME_TRACE__);
  const copied = api.getEntries();
  copied[0].event = "mutated-copy";
  assert.notStrictEqual(api.getEntries()[0].event, "mutated-copy", "getEntries must return a copy");
  const entryCount = api.getEntries().length;
  const gameStateBeforeTable = m002Enabled.harness.getSaveData();
  assert.strictEqual(api.table().length, entryCount);
  assert.strictEqual(m002Enabled.harness.tableCalls.length, 1);
  assert.deepStrictEqual(m002Enabled.harness.getSaveData(), gameStateBeforeTable,
    "table must not change game state");
  api.clear();
  assert.deepStrictEqual(plain(api.getEntries()), []);
  assert.deepStrictEqual(m002Enabled.harness.getSaveData(), gameStateBeforeTable,
    "clear must not change game state");

  const morningHarness = createHarness(true);
  const morningApi = morningHarness.context.DevJumpRuntimeTrace;
  const morningOperation = morningApi.beginOperation("M002_BATTLE", "dev-jump-ui-click");
  const receiver = { marker: "same-this" };
  const returnedPromise = morningHarness.context.MorningManager.start.call(receiver, "MORNING_001", { test: true });
  assert.strictEqual(returnedPromise, morningHarness.morningPromise,
    "Morning observer must return the original Promise unchanged");
  assert.strictEqual(morningHarness.getMorningReceiver(), receiver);
  assert.deepStrictEqual(plain(morningHarness.getMorningArguments()), ["MORNING_001", { test: true }]);
  const morningEvent = plain(morningApi.getEntries()).find(entry => entry.event === "morning-manager-start-observed");
  assert(morningEvent);
  assert.strictEqual(morningEvent.morningId, "MORNING_001");
  assert.strictEqual(morningEvent.operationId, morningOperation);
  assert.strictEqual(morningEvent.devJumpOperationId, morningOperation);
  assert.strictEqual(morningEvent.currentLocation, "http://localhost:8000/dev.html?trace-test=1");

  console.log("Dev Jump Runtime Dispatch Trace V1 tests: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
