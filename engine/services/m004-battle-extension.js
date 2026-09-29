(function () {
  "use strict";

  var canonical = ["eyes", "nose", "mouth", "ears"];
  var japanese = { eyes: "目", nose: "鼻", mouth: "口", ears: "耳" };
  var recognitionAliases = {
    i: "eyes", hi: "eyes",
    ear: "ears", year: "ears", years: "ears", yeah: "ears",
    mouse: "mouth"
  };
  var lastRemainingWords = canonical.slice();

  function normalizeRecognition(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、「」！？・…（）［］【】〈〉《》]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchingTraceEntries(context) {
    if (!context || !window.LegacySpeechTrace || typeof LegacySpeechTrace.getEntries !== "function") return [];
    return LegacySpeechTrace.getEntries().filter(function (entry) {
      return entry.sessionId === context.sessionId && entry.attempt === context.attempt;
    });
  }

  async function waitForRecognitionEnd(context) {
    var entries = matchingTraceEntries(context);
    var reachedStart = entries.some(function (entry) { return entry.event === "recognition-onstart"; });
    var reachedEnd = entries.some(function (entry) { return entry.event === "recognition-end"; });
    if (!reachedStart || reachedEnd) return;

    if (window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
      LegacySpeechTrace.record(context, "m004-retry-wait-for-recognition-end");
    }
    for (var elapsed = 0; elapsed < 1500; elapsed += 10) {
      await new Promise(function (resolve) { window.setTimeout(resolve, 10); });
      if (matchingTraceEntries(context).some(function (entry) { return entry.event === "recognition-end"; })) {
        if (window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
          LegacySpeechTrace.record(context, "m004-retry-recognition-end-confirmed", { waitedMs: elapsed + 10 });
        }
        return;
      }
    }
    if (window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
      LegacySpeechTrace.record(context, "m004-retry-recognition-end-timeout", { waitedMs: 1500 });
    }
  }

  function traceState(context, eventName, detail) {
    if (!context || !window.LegacySpeechTrace || typeof LegacySpeechTrace.record !== "function") return;
    LegacySpeechTrace.record(context, eventName, detail || {});
  }

  var originalCanonicalAnswer = MonsterBattleData.canonicalAnswer;
  MonsterBattleData.canonicalAnswer = function (monster, answer) {
    var exact = originalCanonicalAnswer(monster, answer);
    if (exact || !monster || monster.monsterId !== "m004") return exact;
    return recognitionAliases[normalizeRecognition(answer)] || null;
  };

  function remainingWords() {
    var context = MonsterBattleManager.getContext();
    var accepted = context && context.monsterId === "m004" && Array.isArray(context.acceptedAnswers) ?
      context.acceptedAnswers : [];
    var remaining = canonical.filter(function (word) { return accepted.indexOf(word) === -1; });
    if (remaining.length) lastRemainingWords = remaining.slice();
    return remaining.length ? remaining : lastRemainingWords.slice();
  }

  function supportMessage(stage) {
    var words = remainingWords();
    var remainingJapanese = words.map(function (word) { return japanese[word]; }).join("と");
    if (stage >= 2) return words.join("\n");
    if (stage === 1) return "残っているのは、" + remainingJapanese + "ピコ！";
    return "まだ、" + remainingJapanese + "が残っているピコ！";
  }

  function currentSupportStage() {
    var context = MonsterBattleManager.getContext();
    var failureCount = context && context.monsterId === "m004" ? Number(context.failureCount) || 1 : 1;
    return Math.min(Math.max(failureCount - 1, 0), 2);
  }

  async function presentPicoSupport(stage, fallbackNext) {
    var english = remainingWords().join("\n");
    var japaneseSupport = supportMessage(Math.min(stage, 1));
    if (window.PicoSupportController && typeof PicoSupportController.present === "function") {
      return PicoSupportController.present({
        speaker: "ピコ",
        text: english,
        supportSpeaker: "ピコ",
        supportText: japaneseSupport,
        supportLabel: "ピコのサポート",
        button: "もう一度言う",
        initialView: stage >= 2 ? "english" : "japanese"
      });
    }
    DialogManager.show("ピコ", supportMessage(stage));
    return (fallbackNext || DialogManager.next)("もう一度言う");
  }

  var originalGetMonster = MonsterBattleData.getMonster;
  MonsterBattleData.getMonster = function (id) {
    var monster = originalGetMonster(id);
    if (monster.monsterId !== "m004") return monster;
    Object.defineProperties(monster.battle.supportMessages, {
      "0": { configurable: true, get: function () {
        return supportMessage(0);
      }},
      "1": { configurable: true, get: function () {
        return supportMessage(1);
      }},
      "2": { configurable: true, get: function () {
        return supportMessage(2);
      }}
    });
    return monster;
  };

  var originalGetHint = MonsterBattleData.getHint;
  MonsterBattleData.getHint = function (monster, level) {
    if (monster && monster.monsterId === "m004" && level === 3) {
      return supportMessage(2);
    }
    return originalGetHint(monster, level);
  };

  var originalStart = MonsterBattleManager.start;
  MonsterBattleManager.start = async function (id) {
    if (MonsterDatabase.normalizeId(id) !== "m004") return originalStart(id);
    lastRemainingWords = canonical.slice();
    MonsterBattlePresenter.showLayers(MonsterDatabase.get("m004"), [], false);
    var originalDialogNext = DialogManager.next;
    var originalAdapterListen = SpeechRecognitionAdapter.listen;
    var originalQuestionStart = QuestionManager.start;
    var audioManager = window.AudioManager;
    var originalPlaySe = audioManager && audioManager.playSe;
    var originalStopBgm = audioManager && audioManager.stopBgm;
    var originalFiniteRescue = window.FiniteRescue;
    var activeTraceContext = null;
    var recognitionFailureCount = 0;
    var speechSupportCount = 0;
    var zephyrStarted = false;
    DialogManager.next = function (label) {
      if (label === "もう一度言う") return presentPicoSupport(currentSupportStage(), originalDialogNext);
      return originalDialogNext(label === "Try again" ? "もう一度言う" : label);
    };
    SpeechRecognitionAdapter.listen = async function (options) {
      var traceContext = options && options.legacyTraceContext;
      activeTraceContext = traceContext || activeTraceContext;
      if (traceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
        LegacySpeechTrace.record(traceContext, "m004-retry-listen-call", {
          speechStatus: window.SpeechEngine && SpeechEngine.getStatus ? SpeechEngine.getStatus() : null,
          controllerListening: window.SpeechStartController && SpeechStartController.isListening ?
            SpeechStartController.isListening() : null
        });
      }
      try {
        return await originalAdapterListen(options);
      } catch (error) {
        await waitForRecognitionEnd(traceContext);
        throw error;
      }
    };
    QuestionManager.start = async function (questionId, options) {
      var m004Definition = MonsterDatabase.get("m004");
      var ducking = m004Definition && m004Definition.battle && m004Definition.battle.speechDucking;
      if (ducking && window.SpeechAudioDuckingInternal) SpeechAudioDuckingInternal.arm(ducking);
      var result;
      try {
        result = await originalQuestionStart(questionId, options);
      } finally {
        if (ducking && window.SpeechAudioDuckingInternal) {
          await SpeechAudioDuckingInternal.finish(ducking.restore !== false);
        }
      }
      if (questionId !== "word.face-parts" || !result || !result.answer || result.status === "success") return result;
      var resolved = MonsterBattleData.canonicalAnswer(MonsterDatabase.get("m004"), result.answer);
      if (!resolved) return result;
      traceState(activeTraceContext, "m004-alias-resolved", {
        rawTranscript: String(result.answer),
        resolvedCanonical: resolved
      });
      return Object.assign({}, result, { status: "success" });
    };
    if (audioManager && originalPlaySe && originalStopBgm) audioManager.stopBgm = function (options) {
      if (!zephyrStarted) {
        zephyrStarted = true;
        originalPlaySe("zephyrGo", { volume: 0.24 });
      }
      return originalStopBgm(options);
    };
    if (audioManager && originalPlaySe) audioManager.playSe = function (key, options) {
      if (key === "monsterWarningReveal") return null;
      if (key === "zephyrGo" && zephyrStarted) return null;
      return originalPlaySe(key, options);
    };
    if (originalFiniteRescue) {
      var m004FiniteRescue = Object.create(originalFiniteRescue);
      Object.defineProperty(m004FiniteRescue, "isImmediateTechnicalFailure", { value: function (error) {
        recognitionFailureCount += 1;
        traceState(activeTraceContext, "m004-finite-rescue-state", {
          failureCount: recognitionFailureCount,
          supportLevel: Math.min(recognitionFailureCount, 3),
          finiteRescueStep: recognitionFailureCount <= 3 ? "support" : "rescue",
          retryAvailable: true,
          adventureReturnAvailable: recognitionFailureCount > 3
        });
        return false;
      }});
      Object.defineProperty(m004FiniteRescue, "choose", { value: async function (allowRetry) {
        var battleContext = MonsterBattleManager.getContext();
        var normalFailureCount = battleContext && battleContext.monsterId === "m004" ?
          Number(battleContext.failureCount) || 0 : 0;
        if (!normalFailureCount) speechSupportCount += 1;
        var effectiveFailureCount = normalFailureCount || speechSupportCount;
        var supportStage = Math.min(Math.max(effectiveFailureCount - 1, 0), 2);
        await presentPicoSupport(supportStage, originalDialogNext);
        traceState(activeTraceContext, "m004-finite-rescue-choice", {
          failureCount: effectiveFailureCount,
          supportLevel: Math.min(effectiveFailureCount, 3),
          finiteRescueStep: effectiveFailureCount <= 3 ? "support" : "rescue",
          retryAvailable: true,
          adventureReturnAvailable: effectiveFailureCount > 3
        });
        if (!normalFailureCount && effectiveFailureCount <= 3) return "retry";
        return originalFiniteRescue.choose(true);
      }});
      window.FiniteRescue = m004FiniteRescue;
    }
    try {
      return await originalStart(id);
    } finally {
      DialogManager.next = originalDialogNext;
      SpeechRecognitionAdapter.listen = originalAdapterListen;
      QuestionManager.start = originalQuestionStart;
      if (audioManager && originalPlaySe) audioManager.playSe = originalPlaySe;
      if (audioManager && originalStopBgm) audioManager.stopBgm = originalStopBgm;
      window.FiniteRescue = originalFiniteRescue;
    }
  };
})();
