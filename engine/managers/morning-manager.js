(function () {
  "use strict";

  var runId = 0;
  var result = null;
  var cancelWait = null;

  function cleanup() {
    try {
      if (window.AudioManager && typeof AudioManager.stopBgm === "function") AudioManager.stopBgm();
    } catch (_) { /* Audio may not be initialized in tests. */ }
    try {
      if (window.SpeechStartController && typeof SpeechStartController.cancel === "function") {
        SpeechStartController.cancel();
      } else {
        SpeechEngine.stop();
      }
    } catch (_) { /* Speech may not be initialized in tests. */ }
    try { DialogManager.hideRecognized(); } catch (_) { /* UI may not be initialized yet. */ }
    try { DialogManager.hide(); } catch (_) { /* UI may not be initialized yet. */ }
    try { CharacterManager.clear(); } catch (_) { /* UI may not be initialized yet. */ }
  }

  function snapshot(value) {
    if (!value) return null;
    return {
      morningId: value.morningId,
      sceneId: value.sceneId,
      status: value.status,
      category: value.category,
      heard: value.heard,
      reactionId: value.reactionId,
      error: value.error,
      controlResult: value.controlResult || null
    };
  }

  function saveData() {
    try { return SaveManager.getData(); } catch (_) { return {}; }
  }

  function configure(morning) {
    var data = saveData();
    var playerName = data.player && data.player.name ? data.player.name : "マスター";
    var lastCamp = data.lastCamp || (data.flags && data.flags.lastCamp) || "forest";
    var location = typeof lastCamp === "string" ? lastCamp.toLowerCase() : "forest";
    var background = morning.defaultBackground;
    Object.keys(morning.backgrounds || {}).some(function (key) {
      if (location.indexOf(key) === -1) return false;
      background = morning.backgrounds[key];
      return true;
    });
    return { playerName: playerName, background: background };
  }

  function promptText(prompt, playerName) {
    return prompt.english.replace("{playerName}", playerName) + "\n" + prompt.japanese;
  }

  function classify(morning, heard) {
    var normalized = SpeechEngine.normalize(heard);
    var order = morning.categoryOrder || [];
    for (var i = 0; i < order.length; i += 1) {
      var category = morning.categories[order[i]];
      var keywords = (category.keywords || []).slice().sort(function (a, b) { return b.length - a.length; });
      if (SpeechEngine.includesAny(normalized, keywords)) return order[i];
    }
    return "unknown";
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function playOptionalVoice(path) {
    if (!path) return Promise.resolve();
    try { return Promise.resolve(AudioManager.playVoice(path)); } catch (_) { return Promise.resolve(); }
  }

  async function hear(prompt) {
    var timeoutMs = prompt.timeoutMs || 8000;
    while (true) {
      var startedAt = Date.now();
      try {
        var listenOptions = {
          lang: "en-US",
          timeoutMs: timeoutMs,
          onInterim: DialogManager.showRecognized
        };
        if (window.SpeechStartController && typeof SpeechStartController.startListening === "function") {
          return await SpeechStartController.startListening(listenOptions, {
            showRecognized: DialogManager.showRecognized
          });
        }
        DialogManager.showRecognized("…");
        return await SpeechEngine.listen(listenOptions);
      } catch (error) {
        var message = error && error.message ? error.message : "speech-error";
        if (message === "no-speech" || message === "speech-timeout") {
          // Recognitionが早く終了しても、規定時間より前にSilent返答を出さない。
          var remaining = Math.max(0, timeoutMs - (Date.now() - startedAt));
          if (remaining > 0) await EffectManager.wait(remaining);
          return "";
        }
        return { technicalFailure: true, error: message };
      }
    }
  }

  async function start(morningId) {
    var morning = MorningDatabase.get(morningId);
    if (!morning) throw new Error("Morning not found: " + morningId);

    cancel();
    var currentRun = runId;
    var currentResult = {
      morningId: morning.id,
      sceneId: morning.sceneId,
      status: morning.enabled ? "running" : "disabled",
      category: null,
      heard: "",
      reactionId: null,
      error: null,
      controlResult: null
    };
    result = currentResult;
    if (!morning.enabled) return snapshot(currentResult);

    var cancelled = new Promise(function (resolve) { cancelWait = resolve; });
    var settings = configure(morning);
    cleanup();

    try {
      GameCore.clearVisuals();
      EffectManager.setFilter(false);
      EffectManager.setBackground(settings.background);
      if (morning.startEffect) {
        await EffectManager.play(morning.startEffect.key, morning.startEffect.ms);
        if (currentRun !== runId) return snapshot(currentResult);
      }
      if (window.AudioManager && typeof AudioManager.playBgm === "function") {
        AudioManager.playBgm("morningGardenAtmosphere", { loop: true, volume: 0.85, fadeInMs: 700 });
      }
      CharacterManager.show([morning.character]);

      DialogManager.show(morning.prompt.speaker, promptText(morning.prompt, settings.playerName));
      await playOptionalVoice(morning.prompt.voice);
      if (window.SpeechStartController && typeof SpeechStartController.prepare === "function") {
        await SpeechStartController.prepare();
      } else if (window.AudioManager && typeof AudioManager.stopAll === "function") {
        AudioManager.stopAll();
      }

      var heard = await Promise.race([hear(morning.prompt), cancelled]);
      var failureCount = 0;
      var rescueRetryUsed = false;
      while (true) {
        if (currentRun !== runId) return snapshot(currentResult);
        var technicalError = heard && typeof heard === "object" && heard.technicalFailure ? heard.error : null;
        heard = heard || "";
        if (!technicalError && heard.trim()) break;

        currentResult.heard = "";
        currentResult.category = "silent";
        currentResult.reactionId = null;
        DialogManager.hideRecognized();
        failureCount += 1;
        var immediateTechnical = technicalError && window.FiniteRescue &&
          FiniteRescue.isImmediateTechnicalFailure(technicalError);
        var mustRescue = immediateTechnical || failureCount > 3 || rescueRetryUsed;
        var silentAction;
        if (mustRescue) {
          silentAction = await Promise.race([
            window.FiniteRescue ? FiniteRescue.choose(!rescueRetryUsed) :
              DialogManager.choice((!rescueRetryUsed ? [{ label: "もう一度言う", value: "retry" }] : []).concat([
                { label: "言わずに冒険に戻る", value: "adventure_return" }
              ])),
            cancelled
          ]);
          if (silentAction === "retry" && !rescueRetryUsed) rescueRetryUsed = true;
        } else {
          DialogManager.show("ピコ", "うまく聞き取れなかったピコ。\nもう一度話してみる？");
          silentAction = await Promise.race([
            DialogManager.choice([
              { label: "もう一度言う", value: "retry" },
              { label: "出発", value: "depart" }
            ]),
            cancelled
          ]);
        }
        if (currentRun !== runId) return snapshot(currentResult);
        if (silentAction !== "retry") {
          cleanup();
          currentResult.status = silentAction === "adventure_return" ? "adventure_return" : "completed";
          currentResult.controlResult = silentAction === "adventure_return" ? "adventure_return" : null;
          currentResult.error = technicalError;
          cancelWait = null;
          return snapshot(currentResult);
        }

        DialogManager.hideRecognized();
        DialogManager.show(morning.prompt.speaker, promptText(morning.prompt, settings.playerName));
        if (window.SpeechStartController && typeof SpeechStartController.prepare === "function") {
          await SpeechStartController.prepare();
        } else if (window.AudioManager && typeof AudioManager.stopAll === "function") {
          AudioManager.stopAll();
        }
        heard = await Promise.race([hear(morning.prompt), cancelled]);
      }

      currentResult.heard = heard;
      currentResult.category = classify(morning, heard);
      var reaction = pick(morning.categories[currentResult.category].reactions);
      currentResult.reactionId = reaction.id;

      DialogManager.show("ピコ", reaction.english + "\n" + reaction.japanese);
      if (currentResult.heard.trim()) {
        DialogManager.showRecognized(currentResult.heard, "You said:\n");
      } else {
        DialogManager.hideRecognized();
      }
      await playOptionalVoice(reaction.voice);
      await Promise.race([DialogManager.next("出発"), cancelled]);
      if (currentRun !== runId) return snapshot(currentResult);

      cleanup();
      currentResult.status = "completed";
      cancelWait = null;
      return snapshot(currentResult);
    } catch (error) {
      if (currentRun !== runId) return snapshot(currentResult);
      cleanup();
      currentResult.status = "failure";
      currentResult.error = error && error.message ? error.message : String(error);
      cancelWait = null;
      return snapshot(currentResult);
    }
  }

  function cancel() {
    runId += 1;
    if (result && result.status === "running") result.status = "cancelled";
    if (cancelWait) cancelWait();
    cancelWait = null;
    cleanup();
    return snapshot(result);
  }

  function getResult() { return snapshot(result); }

  function reset() {
    cancel();
    result = null;
  }

  window.MorningManager = {
    start: start,
    cancel: cancel,
    getResult: getResult,
    reset: reset
  };
})();
