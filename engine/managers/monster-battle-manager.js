(function () {
  "use strict";

  var PHASE = {
    IDLE: "IDLE", INTRO: "INTRO", QUESTION: "QUESTION", LISTEN: "LISTEN",
    JUDGE: "JUDGE", SUCCESS: "SUCCESS", COMPLETE: "COMPLETE",
    FAILURE: "FAILURE", RETRY: "RETRY", RESCUE: "RESCUE", HINT: "HINT", PSEUDO_CAMP: "PSEUDO_CAMP"
  };
  var active = null;
  var serial = 0;

  function copyContext(context) {
    if (!context) return null;
    return {
      battleId: context.battleId,
      monsterId: context.monsterId,
      phase: context.phase,
      failureCount: context.failureCount,
      retreatCount: context.retreatCount,
      hintLevel: context.hintLevel,
      hintNpcId: context.hintNpcId,
      hitCount: context.acceptedAnswers.length,
      requiredHits: context.requiredHits,
      acceptedAnswers: context.acceptedAnswers.slice(),
      cleared: context.cleared,
      aborted: context.aborted,
      controlResult: context.controlResult || null
    };
  }

  function createContext(monster) {
    serial += 1;
    return {
      battleId: "B" + String(serial).padStart(4, "0"),
      monsterId: monster.monsterId,
      phase: PHASE.IDLE,
      failureCount: 0,
      retreatCount: 0,
      hintLevel: 0,
      hintNpcId: monster.hintNpcId || "pico",
      requiredHits: Math.max(1, Number(monster.battle && monster.battle.requiredUniqueAnswers) || 1),
      acceptedAnswers: [],
      cleared: false,
      aborted: false,
      speechFailureCount: 0,
      rescueRetryUsed: false,
      controlResult: null
    };
  }

  function playEffect(key) {
    return key ? EffectManager.play(key) : Promise.resolve();
  }

  function playAudio(key) {
    if (key) AudioManager.playSe(key);
  }

  function playRegisteredAudio(key, options) {
    var registered = window.AudioDatabase && AudioDatabase.se;
    if (registered && typeof registered[key] === "string" && registered[key]) {
      AudioManager.playSe(key, options);
    }
  }

  function playBattleHit() {
    playRegisteredAudio("battleHit", { volume: 0.80 });
  }

  function setDamage(level) {
    if (EffectManager && typeof EffectManager.setBattleDamage === "function") {
      EffectManager.setBattleDamage(level);
    }
  }

  function graphicFlow(monster) {
    return monster && monster.battle && monster.battle.graphicFlow;
  }

  function playPurifyAudio(monster) {
    if (!monster || !monster.battle || monster.battle.playPurifySe !== false) {
      playRegisteredAudio("battlePurify", { volume: 0.70 });
    }
  }

  function playDefeatAudio(monster) {
    var battle = monster && monster.battle;
    if (battle && battle.defeatSe) {
      playRegisteredAudio(battle.defeatSe, {
        volume: battle.defeatSeVolume === undefined ? 1 : battle.defeatSeVolume
      });
    }
  }

  function showGraphic(monster, semanticState, fallbackState) {
    var flow = graphicFlow(monster);
    var imageState = flow && flow[semanticState] ? flow[semanticState] : fallbackState;
    return imageState ? MonsterBattlePresenter.showMonster(monster, imageState) : null;
  }

  async function playSuccessGraphic(monster, isComplete, canonicalAnswer) {
    var flow = graphicFlow(monster);
    if (!flow) return false;

    var answerVisuals = monster.battle && monster.battle.answerVisuals;
    var answerState = answerVisuals && answerVisuals[canonicalAnswer];
    if (answerState && monster.image && monster.image[answerState]) {
      MonsterBattlePresenter.showMonster(monster, answerState);
      await Promise.all([
        playEffect(monster.effect.success),
        EffectManager.wait(isComplete
          ? Math.max(0, Number(monster.battle.finalAnswerVisualMs) || 0)
          : Math.max(0, Number(flow.reactionMs) || 0))
      ]);
      if (isComplete) {
        playPurifyAudio(monster);
        showGraphic(monster, "complete", "defeated");
      }
      return true;
    }

    showGraphic(monster, "reaction", null);
    await Promise.all([
      playEffect(monster.effect.success),
      EffectManager.wait(Math.max(0, Number(flow.reactionMs) || 0))
    ]);

    if (!isComplete) {
      showGraphic(monster, "postReaction", "normal");
      return true;
    }

    showGraphic(monster, "purify", null);
    playDefeatAudio(monster);
    playPurifyAudio(monster);
    await EffectManager.wait(Math.max(0, Number(flow.purifyMs) || 0));
    showGraphic(monster, "complete", "defeated");
    return true;
  }

  async function showFailureSupport(context, monster, heard) {
    var messages = monster.battle && monster.battle.supportMessages;
    if (!Array.isArray(messages) || messages.length === 0) return;
    var stage = Math.min(context.failureCount - 1, 2);
    DialogManager.show("ピコ", messages[Math.min(stage, messages.length - 1)]);
    if (heard) DialogManager.showRecognized(heard, "聞き取った言葉：");
    await DialogManager.next("もう一度言う");
  }

  async function rescueAction(context, error) {
    context.phase = PHASE.RESCUE;
    while (true) {
      var action;
      if (window.FiniteRescue) action = await FiniteRescue.choose(true);
      else action = await DialogManager.choice([
        { label: "もう一度言う", value: "retry" },
        { label: "言わずに冒険に戻る", value: "adventure_return" }
      ]);
      if (action === "retry") {
        context.rescueRetryUsed = true;
        context.phase = PHASE.RETRY;
        return true;
      }
      if (action !== "adventure_return") continue;
      context.controlResult = "adventure_return";
      context.aborted = true;
      context.phase = PHASE.IDLE;
      setDamage(0);
      return false;
    }
  }

  async function handleFailure(context, monster, result) {
    var immediateTechnical = result && result.error && window.FiniteRescue &&
      FiniteRescue.isImmediateTechnicalFailure(result.error);
    context.failureCount += 1;
    if (immediateTechnical || context.failureCount > 3 || context.rescueRetryUsed) {
      return rescueAction(context, result && result.error);
    }
    await showFailureSupport(context, monster, result && result.answer);
    context.phase = PHASE.RETRY;
    return true;
  }

  function isTechnicalSpeechFailure(result) {
    if (!result) return false;
    if (result.status === "speech-failure") return true;
    var error = String(result.error && result.error.message ? result.error.message : result.error || "").toLowerCase();
    return ["no-speech", "speech-timeout", "timeout", "not-allowed", "permission-denied",
      "permission denied", "speech-not-supported", "unsupported", "recognition-start-failure",
      "recognition start failure", "start-failure", "browser recognition error", "recognition-error"].some(function (code) {
      return error === code || error.indexOf(code) !== -1;
    });
  }

  async function handleTechnicalSpeechFailure(context, result) {
    context.speechFailureCount += 1;
    return rescueAction(context, result && result.error);
  }

  async function handleDuplicate(context, monster) {
    context.failureCount += 1;
    DialogManager.show("ピコ", monster.battle.duplicateMessage || "One more word!");
    await DialogManager.next("Try again");
    if (context.failureCount > 3 || context.rescueRetryUsed) {
      return rescueAction(context);
    }
    context.phase = PHASE.RETRY;
    return true;
  }

  async function showProgressMessage(monster, hitCount) {
    var messages = monster.battle && monster.battle.progressMessages;
    if (!Array.isArray(messages) || !messages[hitCount - 1]) return;
    DialogManager.show("ピコ", messages[hitCount - 1]);
    await DialogManager.next(hitCount >= monster.battle.requiredUniqueAnswers ? "話を聞く" : "次の季節を言う");
  }

  async function showCompletionDialogue(monster) {
    var dialogue = monster.battle && monster.battle.completionDialogue;
    if (!Array.isArray(dialogue)) return;
    for (var i = 0; i < dialogue.length; i += 1) {
      var line = dialogue[i] || {};
      if (line.voiceKey && window.PicoSupportController && typeof PicoSupportController.present === "function") {
        await PicoSupportController.present({
          speaker: line.speaker || "",
          text: line.text || "",
          voiceKey: line.voiceKey,
          supportText: line.supportText || "",
          supportSpeaker: line.supportSpeaker || "ピコ",
          button: line.button
        });
        continue;
      }
      if (window.PicoSupportController && typeof PicoSupportController.dismiss === "function") {
        PicoSupportController.dismiss();
      }
      if (line.voiceKey && window.DialogueVoiceController) DialogueVoiceController.play(line.voiceKey);
      DialogManager.show(line.speaker || "", line.text || "");
      await DialogManager.next(line.button || "次へ");
    }
  }

  async function pseudoCamp(context, monster) {
    context.retreatCount += 1;
    context.hintLevel = Math.min(3, context.retreatCount);

    context.phase = PHASE.HINT;
    var campId = monster.campIds[context.hintLevel - 1];
    if (!campId) throw new Error("Pseudo camp is not configured: " + monster.monsterId);
    var campResult = await CampManager.start(campId);
    if (campResult.status === "failure") throw new Error("Camp execution failed: " + campResult.error);
    if (campResult.status === "cancelled") {
      context.aborted = true;
      return;
    }

    context.phase = PHASE.PSEUDO_CAMP;
    playAudio(monster.audio.retreat);
    if (EffectManager && typeof EffectManager.playPseudoCampTransition === "function") {
      await EffectManager.playPseudoCampTransition();
    } else {
      await playEffect(monster.effect.retreat);
      await playEffect(monster.effect.intro);
    }
  }

  async function start(monsterId) {
    if (active && !active.aborted && !active.cleared && active.phase !== PHASE.COMPLETE) {
      throw new Error("A monster battle is already running: " + active.battleId);
    }

    var monster = MonsterBattleData.getMonster(monsterId);
    var context = createContext(monster);
    active = context;
    setDamage(0);

    context.phase = PHASE.INTRO;
    SaveManager.recordMonsterEncounter(monster.monsterId);
    if (monster.presentation && monster.presentation.background &&
        EffectManager && typeof EffectManager.setBackground === "function") {
      EffectManager.setBackground(monster.presentation.background);
    }
    showGraphic(monster, "normal", "normal");
    playRegisteredAudio(monster.audio.warning || "monsterWarning", {
      volume: monster.audio.warning === "monsterWarningTensePiano" ? 0.60 : 0.50
    });
    playAudio(monster.audio.intro);
    await Promise.all([
      playEffect(monster.effect.intro),
      EffectManager.wait(Math.max(0, Number(monster.battle && monster.battle.introHoldMs) || 0))
    ]);
    if (monster.battle && monster.battle.guide) {
      DialogManager.show("ピコ", monster.battle.guide);
      await DialogManager.next("挑戦する");
    }

    while (!context.aborted) {
      context.phase = PHASE.QUESTION;
      context.phase = PHASE.LISTEN;
      var result = await QuestionManager.start(monster.questionId, {
        __legacyTraceContext: { runtime: "monster", monsterId: monster.monsterId }
      });
      var speechControl = window.FiniteRescue && FiniteRescue.consume();
      if (speechControl && speechControl.controlResult === "adventure_return") {
        context.controlResult = "adventure_return";
        context.aborted = true;
        break;
      }
      if (context.aborted) break;

      if (result && result.answer) {
        DialogManager.showRecognized(result.answer, "聞き取った言葉：");
        await EffectManager.wait(1600);
      }

      context.phase = PHASE.JUDGE;
      if (isTechnicalSpeechFailure(result)) {
        if (await handleTechnicalSpeechFailure(context, result)) continue;
        return copyContext(context);
      }
      if (result && result.error) {
        if (await handleFailure(context, monster, result)) continue;
        return copyContext(context);
      }
      if (result && result.status === "adventure_return") {
        context.controlResult = "adventure_return";
        context.aborted = true;
        break;
      }
      if (result && result.status === "success") {
        var canonical = MonsterBattleData.canonicalAnswer(monster, result.answer);
        if (!canonical) {
          context.phase = PHASE.FAILURE;
          if (await handleFailure(context, monster, result)) continue;
          return copyContext(context);
        }
        if (context.acceptedAnswers.indexOf(canonical) !== -1) {
          if (await handleDuplicate(context, monster)) continue;
          return copyContext(context);
        }
        context.acceptedAnswers.push(canonical);
        context.phase = PHASE.SUCCESS;
        setDamage(Math.ceil((context.acceptedAnswers.length / context.requiredHits) * 3));
        var battleAudio = monster.battle || {};
        var isComplete = context.acceptedAnswers.length >= context.requiredHits;
        if (!isComplete || !battleAudio.completionSe) {
          if (battleAudio.hitSe) {
            playRegisteredAudio(battleAudio.hitSe, {
              volume: battleAudio.hitSeVolume === undefined ? 0.80 : battleAudio.hitSeVolume
            });
          } else {
            playBattleHit();
          }
        }
        if (!isComplete) {
          if (!(await playSuccessGraphic(monster, false, canonical))) {
            await playEffect(monster.effect.success);
          }
          await showProgressMessage(monster, context.acceptedAnswers.length);
          context.phase = PHASE.RETRY;
          continue;
        }
        if (await playSuccessGraphic(monster, true, canonical)) {
          // Database-driven reaction -> purify -> complete flow finished.
        } else if (EffectManager && typeof EffectManager.playBattleDefeatTransition === "function") {
          playPurifyAudio(monster);
          await EffectManager.playBattleDefeatTransition(function () {
            MonsterBattlePresenter.showMonster(monster, "defeated");
          });
        } else {
          playPurifyAudio(monster);
          await playEffect(monster.effect.success);
          MonsterBattlePresenter.showMonster(monster, "defeated");
        }
        if (battleAudio.completionSe) {
          playRegisteredAudio(battleAudio.completionSe, {
            volume: battleAudio.completionSeVolume === undefined ? 0.85 : battleAudio.completionSeVolume
          });
        }
        if (monster.battle && monster.battle.completionMessage) {
          DialogManager.show("", monster.battle.completionMessage);
          await DialogManager.next(monster.battle.completionButton || "次へ");
        }
        await showProgressMessage(monster, context.acceptedAnswers.length);
        if (monster.battle && monster.battle.victorySe) {
          playRegisteredAudio(monster.battle.victorySe, {
            volume: monster.battle.victoryVolume === undefined ? 0.35 : monster.battle.victoryVolume
          });
          await EffectManager.wait(Math.max(0, Number(monster.battle.victoryHoldMs) || 0));
        }
        if (battleAudio.completionSeHoldMs) {
          await EffectManager.wait(Math.max(0, Number(battleAudio.completionSeHoldMs) || 0));
        }
        if (battleAudio.stopBgmAfterCompletion && window.AudioManager && typeof AudioManager.stopBgm === "function") {
          await AudioManager.stopBgm({ fadeOutMs: Math.max(0, Number(battleAudio.stopBgmFadeOutMs) || 0) });
        }
        if (battleAudio.postRecoverySe) {
          playRegisteredAudio(battleAudio.postRecoverySe, {
            volume: battleAudio.postRecoverySeVolume === undefined ? 0.35 : battleAudio.postRecoverySeVolume
          });
          await EffectManager.wait(Math.max(0, Number(battleAudio.postRecoverySeHoldMs) || 0));
        }
        if (monster.battle && monster.battle.postRecoveryBgm) {
          await EffectManager.wait(750);
          if (window.AudioManager && typeof AudioManager.playBgm === "function") AudioManager.playBgm(monster.battle.postRecoveryBgm, {
            loop: true,
            volume: monster.battle.postRecoveryBgmVolume === undefined ? 0.20 : monster.battle.postRecoveryBgmVolume,
            fadeInMs: monster.battle.postRecoveryBgmFadeInMs || 0
          });
          await EffectManager.wait(3000);
        }
        await showCompletionDialogue(monster);
        playAudio(monster.audio.success);
        SaveManager.recordMonsterDefeat(monster.monsterId);
        context.cleared = true;
        context.phase = PHASE.COMPLETE;
        setDamage(0);
        return copyContext(context);
      }

      if (result && result.status === "cancelled") {
        context.aborted = true;
        break;
      }

      context.phase = PHASE.FAILURE;
      if (await handleFailure(context, monster, result)) continue;
      return copyContext(context);
    }

    context.phase = PHASE.IDLE;
    setDamage(0);
    return copyContext(context);
  }

  function cancel() {
    if (!active) return null;
    active.aborted = true;
    QuestionManager.cancel();
    CampManager.cancel();
    active.phase = PHASE.IDLE;
    setDamage(0);
    return copyContext(active);
  }

  window.MonsterBattleManager = {
    start: start,
    cancel: cancel,
    getContext: function () { return copyContext(active); },
    PHASE: Object.freeze(PHASE)
  };
})();
