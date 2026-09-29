(function () {
  "use strict";

  if (window.DevJumpRuntimeTrace && typeof window.DevJumpRuntimeTrace.registerRuntimeComponent === "function") {
    window.DevJumpRuntimeTrace.registerRuntimeComponent(
      "dev-jump-manager.js",
      "eigo-de-quest/dev-jump-manager/runtime-dispatch-trace-v1"
    );
  }

  var NORMAL_SAVE_KEY = "eigo-de-quest:save:v2";
  var running = false;

  function runtimeTrace() {
    return window.DevJumpRuntimeTrace || null;
  }

  function traceEvent(eventName, detail, operationId) {
    var trace = runtimeTrace();
    if (trace && typeof trace.recordEvent === "function") {
      trace.recordEvent(eventName, detail, operationId);
    }
  }

  function readNormalPlayerName() {
    try {
      var raw = localStorage.getItem(NORMAL_SAVE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      return data && data.player && String(data.player.name || "").trim();
    } catch (_) {
      return "";
    }
  }

  function cleanup(operationId, entry) {
    try { QuestionManager.cancel(); } catch (_) {}
    try { SpeechEngine.stop(); } catch (_) {}
    try { MonsterBattleManager.cancel(); } catch (_) {}
    try { CampManager.cancel(); } catch (_) {}
    try { MorningManager.cancel(); } catch (_) {}
    try { AudioManager.stopAll(); } catch (_) {}
    try { VideoManager.clear(); } catch (_) {}
    try { DialogManager.hideRecognized(); } catch (_) {}
    try { DialogManager.hide(); } catch (_) {}
    try { CharacterManager.clear(); } catch (_) {}
    try { MonsterManager.clear(); } catch (_) {}
    try { EffectManager.setBattleDamage(0); } catch (_) {}
    try { EffectManager.setFilter(false); } catch (_) {}
    try { GameCore.clearVisuals(); } catch (_) {}
    traceEvent("dev-jump-cleanup-completed", {
      entry: entry ? { kind: entry.kind, id: entry.id } : null
    }, operationId);
  }

  function buildDevSave(checkpoint, playerName) {
    return {
      saveVersion: 1,
      player: { name: playerName, playTimeMs: 0 },
      progress: {
        currentStoryId: checkpoint.progressStoryId || checkpoint.entry.id,
        currentStepIndex: 0,
        completedStories: checkpoint.completedStories.slice()
      },
      flags: Object.assign({}, checkpoint.flags || {}),
      party: { companionIds: checkpoint.party.slice() },
      inventory: Object.assign({}, checkpoint.inventory || {}),
      bestiary: Object.assign({}, checkpoint.bestiary || {}),
      storyState: Object.assign({}, checkpoint.storyState || {})
    };
  }

  function prepareDevState(checkpoint) {
    var currentDev = SaveManager.getData();
    var playerName = readNormalPlayerName() ||
      (currentDev.player && String(currentDev.player.name || "").trim()) ||
      "マスター";
    SaveManager.importData(JSON.stringify(buildDevSave(checkpoint, playerName)));
    return { playerName: playerName, devCheckpointId: checkpoint.id };
  }

  function applyTransition(entry, state) {
    (entry.completeStories || []).forEach(function (storyId) {
      SaveManager.completeStory(storyId, state);
    });
  }

  var adapters = {
    story: async function (entry, state) {
      return SceneManager.start(entry.id, state);
    },
    monster: async function (entry) {
      var result = await MonsterBattleManager.start(entry.id);
      if (!result || !result.cleared || result.aborted) throw new Error("Dev monster entry did not complete: " + entry.id);
      return result;
    },
    camp: async function (entry) {
      var result = await CampManager.start(entry.id);
      if (!result || result.status !== "completed") throw new Error("Dev camp entry did not complete: " + entry.id);
      return result;
    }
  };

  async function runEntry(entry, state, operationId, initialEntry) {
    var adapter = adapters[entry.kind];
    if (!adapter) throw new Error("Unsupported Dev entry kind: " + entry.kind);
    var trace = runtimeTrace();
    if (initialEntry && trace && typeof trace.recordDispatchSnapshot === "function") {
      trace.recordDispatchSnapshot(operationId, entry, entry.kind);
    }
    cleanup(operationId, entry);
    applyTransition(entry, state);
    traceEvent("dev-jump-adapter-dispatch-before", {
      dispatchAdapter: entry.kind,
      entry: { kind: entry.kind, id: entry.id }
    }, operationId);
    if (entry.kind === "monster") {
      traceEvent("monster-battle-manager-start-before", { monsterId: entry.id }, operationId);
    }
    return adapter(entry, state);
  }

  async function start(checkpointId, traceOperationId) {
    if (running || SceneManager.isRunning()) throw new Error("Dev Jump is available only before Story start.");
    var trace = runtimeTrace();
    var operationId = traceOperationId;
    if (!operationId && trace && typeof trace.beginOperation === "function") {
      operationId = trace.beginOperation(checkpointId, "dev-jump-manager-direct");
    }
    traceEvent("dev-jump-manager-start", { checkpointId: checkpointId }, operationId);
    var checkpoint = DevCheckpointDatabase.get(checkpointId);
    if (!checkpoint) throw new Error("Dev checkpoint not found: " + checkpointId);
    traceEvent("dev-jump-checkpoint-resolved", {
      checkpointId: checkpoint.id,
      entry: { kind: checkpoint.entry.kind, id: checkpoint.entry.id }
    }, operationId);

    running = true;
    try {
      var state = prepareDevState(checkpoint);
      state.devEntryResult = await runEntry(checkpoint.entry, state, operationId, true);
      for (var i = 0; i < checkpoint.continueWith.length; i += 1) {
        state.devEntryResult = await runEntry(checkpoint.continueWith[i], state, operationId, false);
      }
      return state;
    } finally {
      traceEvent("dev-jump-manager-finished", { checkpointId: checkpoint.id }, operationId);
      running = false;
    }
  }

  window.DevJumpManager = {
    start: start,
    isRunning: function () { return running; }
  };
})();
