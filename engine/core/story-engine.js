(function () {
  "use strict";

  var actions = {};

  function adventureReturn(error) {
    return window.FiniteRescue ? FiniteRescue.result(error) : {
      status: "adventure_return", controlResult: "adventure_return", error: error || null
    };
  }

  function chooseRescue(allowRetry) {
    if (window.FiniteRescue) return FiniteRescue.choose(allowRetry);
    return DialogManager.choice((allowRetry ? [
      { label: "もう一度言う", value: "retry" }
    ] : []).concat([
      { label: "言わずに冒険に戻る", value: "adventure_return" }
    ]));
  }

  function isAdventureReturn(value) {
    return Boolean(value && (value.controlResult === "adventure_return" ||
      value.status === "adventure_return"));
  }

  function valueOf(value, state) {
    if (typeof value === "function") {
      return value(state);
    }

    if (typeof value !== "string") {
      return value;
    }

    return value.replace(/\{\{([^}]+)\}\}/g, function (_, key) {
      var name = key.trim();
      return state[name] === undefined || state[name] === null ? "" : String(state[name]);
    });
  }

  function requireField(step, field, index) {
    if (step[field] === undefined || step[field] === null || step[field] === "") {
      throw new Error("Story step " + index + " (" + step.type + ") needs '" + field + "'.");
    }
  }

  function validateNestedSteps(steps, label, errors) {
    if (!Array.isArray(steps)) {
      errors.push(label + " must be an array.");
      return;
    }
    steps.forEach(function (nested, nestedIndex) {
      if (!nested || typeof nested !== "object" || !nested.type) {
        errors.push(label + " step " + nestedIndex + " is invalid.");
        return;
      }
      if (!actions[nested.type]) errors.push(label + " step " + nestedIndex + " uses unknown type: " + nested.type);
    });
  }

  function validate(story) {
    var errors = [];

    if (!story || typeof story !== "object") {
      return ["Story data is missing."];
    }

    if (!story.id) errors.push("Story id is missing.");
    if (story.onEnter !== undefined && typeof story.onEnter !== "function") errors.push("Story onEnter must be a function.");
    if (story.onExit !== undefined && typeof story.onExit !== "function") errors.push("Story onExit must be a function.");
    if (story.onComplete !== undefined && typeof story.onComplete !== "function") errors.push("Story onComplete must be a function.");

    if (!Array.isArray(story.steps)) {
      errors.push("Story steps must be an array.");
      return errors;
    }

    story.steps.forEach(function (step, index) {
      if (!step || typeof step !== "object") {
        errors.push("Step " + index + " is not an object.");
        return;
      }
      if (!step.type) {
        errors.push("Step " + index + " has no type.");
        return;
      }
      if (!actions[step.type]) {
        errors.push("Step " + index + " uses unknown type: " + step.type);
        return;
      }
      if (step.onEnter !== undefined && typeof step.onEnter !== "function") errors.push("Step " + index + " onEnter must be a function.");
      if (step.onComplete !== undefined && typeof step.onComplete !== "function") errors.push("Step " + index + " onComplete must be a function.");

      var requiredByType = {
        background: ["src"],
        travelTransition: ["src"],
        item: ["src"],
        characterImage: ["id"],
        monster: ["id"],
        monsterState: ["id", "state"],
        dialogue: ["text"],
        effect: ["className"],
        bgm: ["src"],
        se: ["src"],
        voice: ["src"],
        video: ["src"],
        speech: ["message"],
        question: ["questionId"],
        confirmSpeechName: ["message"],
        set: ["key"],
        setFlag: ["key"],
        addCompanion: ["characterId"],
        removeCompanion: ["characterId"],
        addItem: ["itemId"],
        removeItem: ["itemId"],
        discoverMonster: ["id"],
        defeatMonster: ["id"],
        monsterBattle: ["monsterId"],
        camp: ["campId"],
        morning: ["morningId"],
        picoBreakForce: ["id"],
        picoBreakForced: ["id"]
      };

      (requiredByType[step.type] || []).forEach(function (field) {
        if (step[field] === undefined || step[field] === null || step[field] === "") {
          errors.push("Step " + index + " (" + step.type + ") needs '" + field + "'.");
        }
      });

      if (step.type === "characterImage" && step.src === undefined && step.pose === undefined) errors.push("Step " + index + " (characterImage) needs src or pose.");
      if (step.type === "characters" && !Array.isArray(step.items)) errors.push("Step " + index + " (characters) needs items array.");
      if (step.type === "choice" && !Array.isArray(step.options)) errors.push("Step " + index + " (choice) needs options array.");
      if (step.type === "backgroundSequence" && !Array.isArray(step.items)) errors.push("Step " + index + " (backgroundSequence) needs items array.");
      if (step.type === "sequence" || step.type === "parallel" || step.type === "repeat") {
        validateNestedSteps(step.steps, "Step " + index + " (" + step.type + ") steps", errors);
      }
      if (step.type === "branch") {
        if (step.condition === undefined) errors.push("Step " + index + " (branch) needs condition.");
        validateNestedSteps(step.thenSteps || [], "Step " + index + " (branch) thenSteps", errors);
        validateNestedSteps(step.elseSteps || [], "Step " + index + " (branch) elseSteps", errors);
      }
      if (step.type === "event" && !step.name) errors.push("Step " + index + " (event) needs name.");
    });

    return errors;
  }

  function register(type, handler) {
    if (!type || typeof handler !== "function") {
      throw new Error("StoryEngine.register needs a type and function.");
    }
    actions[type] = handler;
  }

  async function callHook(hook, context) {
    if (typeof hook === "function") await hook(context);
  }

  async function emit(eventName, detail) {
    if (window.StoryEvents) await StoryEvents.emit(eventName, detail);
  }

  async function runStep(step, state, index, story) {
    var handler = actions[step.type];
    if (!handler) throw new Error("Unknown story step: " + step.type);

    var context = { story: story, step: step, state: state, index: index };
    await emit("step:enter", context);
    await callHook(step.onEnter, context);
    var result = await handler(step, state, index, story);
    await callHook(step.onComplete, context);
    await emit("step:complete", context);
    return result;
  }

  async function runSteps(steps, state, story, parentIndex) {
    var list = Array.isArray(steps) ? steps : [];
    for (var i = 0; i < list.length; i += 1) {
      await runStep(list[i], state, String(parentIndex === undefined ? "nested" : parentIndex) + "." + i, story);
    }
    return state;
  }

  async function play(story, initialState) {
    var errors = validate(story);
    if (errors.length) throw new Error(errors.join("\n"));

    var state = initialState || {};
    state.storyId = story.id;
    state.storyTitle = story.title || story.id;

    var storyContext = { story: story, state: state };
    await emit("story:enter", storyContext);
    await callHook(story.onEnter, storyContext);

    try {
      for (var i = 0; i < story.steps.length; i += 1) {
        state.stepIndex = i;
        await runStep(story.steps[i], state, i, story);
      }

      await callHook(story.onComplete, storyContext);
      await emit("story:complete", storyContext);
      return state;
    } finally {
      await callHook(story.onExit, storyContext);
      await emit("story:exit", storyContext);
    }
  }

  async function playById(storyId, initialState) {
    if (!window.StoryRegistry) throw new Error("StoryRegistry is not loaded.");
    var story = StoryRegistry.get(storyId);
    if (!story) throw new Error("Story is not registered: " + storyId);
    return play(story, initialState);
  }

  register("clear", async function () { GameCore.clearVisuals(); });
  register("background", async function (step) { requireField(step, "src", 0); EffectManager.setBackground(step.src); });
  register("backgroundSequence", async function (step) { await EffectManager.backgroundSequence(step.items || [], step.fadeMs, step.holdMs); });
  register("travelTransition", async function (step) { await EffectManager.playTravelTransition(step.src); });
  register("item", async function (step) { requireField(step, "src", 0); GameCore.showItem(step.src, step.className); });
  register("characters", async function (step) { CharacterManager.show(step.items || []); });
  register("characterImage", async function (step) { CharacterManager.changeImage(step.id, step.pose !== undefined ? step.pose : step.src); });
  register("monster", async function (step) { MonsterManager.show(step.id, step.state || "normal", { className: step.className, replace: step.replace }); });
  register("monsterState", async function (step) { MonsterManager.changeState(step.id, step.state); });
  register("clearMonsters", async function () { MonsterManager.clear(); });
  register("floatingText", async function (step, state) { CharacterManager.addFloatingText(valueOf(step.text, state), step.className); });

  register("dialogue", async function (step, state) {
    if (step.voiceKey && window.PicoSupportController && typeof PicoSupportController.present === "function") {
      await PicoSupportController.present({
        speaker: valueOf(step.speaker, state) || "",
        text: valueOf(step.text, state) || "",
        voiceKey: step.voiceKey,
        voiceGain: step.voiceGain,
        voiceEffect: step.voiceEffect,
        supportText: valueOf(step.supportText, state) || "",
        supportSpeaker: valueOf(step.supportSpeaker, state) || "ピコ",
        supportLabel: step.supportLabel,
        button: step.button,
        modeClass: step.modeClass
      });
      return;
    }
    if (window.PicoSupportController && typeof PicoSupportController.dismiss === "function") {
      PicoSupportController.dismiss();
    }
    DialogManager.show(valueOf(step.speaker, state) || "", valueOf(step.text, state) || "", step.modeClass);
    if (step.voiceKey && window.DialogueVoiceController && typeof DialogueVoiceController.play === "function") {
      // 現在のDialogue進行はVoice終了を待たない。Promiseは将来自動進行時にawait可能。
      DialogueVoiceController.play(step.voiceKey, { sceneGain: step.voiceGain, voiceEffect: step.voiceEffect });
    }
    if (step.button === false) return;
    if (step.supportText) {
      var action = await DialogManager.choice([
        { label: step.button || GameConfig.dialogueNextLabel, value: "next" },
        { label: step.supportLabel || "Pico's Support", value: "support" }
      ]);
      if (action === "support") {
        DialogManager.show(valueOf(step.supportSpeaker, state) || "ピコ", valueOf(step.supportText, state) || "");
        await DialogManager.next(step.button || GameConfig.dialogueNextLabel);
      }
      return;
    }
    await DialogManager.next(step.button || GameConfig.dialogueNextLabel);
  });

  register("hideDialogue", async function () {
    if (window.PicoSupportController && typeof PicoSupportController.dismiss === "function") {
      PicoSupportController.dismiss();
    }
    if (window.DialogManager && typeof DialogManager.hide === "function") DialogManager.hide();
  });
  register("wait", async function (step) { await EffectManager.wait(step.ms || 0); });
  register("effect", async function (step) { await EffectManager.play(step.className, step.ms); });
  register("bgm", async function (step) {
    if (step.options && step.options.stopAllBefore && window.AudioManager && typeof AudioManager.stopAll === "function") {
      AudioManager.stopAll();
      await EffectManager.wait(step.options.preDelayMs || 0);
    }
    if (window.AudioManager && typeof AudioManager.playBgm === "function") AudioManager.playBgm(step.src, step.options);
  });
  register("stopBgm", async function (step) {
    if (window.AudioManager && typeof AudioManager.stopBgm === "function") await AudioManager.stopBgm(step.options);
  });
  register("se", async function (step) {
    if (window.AudioManager && typeof AudioManager.playSe === "function") {
      if (step.options && step.options.stopAllBefore && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
      AudioManager.playSe(step.src, step.options);
    }
  });
  register("voice", async function (step) { AudioManager.playVoice(step.src, step.options); });
  register("video", async function (step) { await VideoManager.play(step.src, step.options); });
  register("stopVideo", async function () { VideoManager.clear(); });
  register("filter", async function (step) { EffectManager.setFilter(step.visible); });

  register("speech", async function (step, state) {
    var result = await GameCore.speechMission({
      speaker: valueOf(step.speaker, state) || "",
      message: valueOf(step.message, state) || "",
      accepted: step.accepted,
      lang: step.lang || GameConfig.defaultLanguage,
      timeoutMs: step.timeoutMs,
      buttonLabel: step.buttonLabel,
      fallbackPrompt: step.fallbackPrompt
    });
    var speechControl = window.FiniteRescue && FiniteRescue.consume();
    if (speechControl && speechControl.controlResult === "adventure_return") result = speechControl;
    state[step.saveAs || "lastSpeech"] = result;
    return result;
  });

  register("confirmSpeechName", async function (step, state) {
    if (step.speechDucking && window.SpeechAudioDuckingInternal) {
      SpeechAudioDuckingInternal.arm(step.speechDucking);
      await SpeechAudioDuckingInternal.begin();
    }
    try {
      var heard;
      try {
        heard = await GameCore.speechMission({
          message: valueOf(step.message, state),
          lang: step.lang || "ja-JP"
        });
      } catch (_) {
        heard = null;
      }

      if (typeof heard !== "string" || !heard.trim()) {
        if (window.FiniteRescue && typeof FiniteRescue.consume === "function") FiniteRescue.consume();
        heard = await DialogManager.textInput("ごめんね！本当の名前を教えて！");
      } else {
        heard = heard.trim();
        DialogManager.show("", "コンピュータには『" + heard + "』と聞こえたみたい！これで合ってる？ (Yes / No)");
        var answer = await DialogManager.choice([
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" }
        ]);
        if (answer === "no") heard = await DialogManager.textInput("ごめんね！本当の名前を教えて！");
      }
      state[step.saveAs || "playerName"] = heard;
      SaveManager.setPlayerName(heard);
    } finally {
      if (step.speechDucking && window.SpeechAudioDuckingInternal) {
        await SpeechAudioDuckingInternal.finish(step.speechDucking.restore !== false);
      }
    }
  });

  register("question", async function (step, state) {
    var result;
    var failureCount = 0;
    var supportMessages = Array.isArray(step.supportMessages) ? step.supportMessages : [];
    if (step.speechDucking && window.SpeechAudioDuckingInternal) {
      SpeechAudioDuckingInternal.arm(step.speechDucking);
    }
    var question = window.QuestionDatabase && typeof QuestionDatabase.get === "function" ?
      QuestionDatabase.get(step.questionId) : null;
    if (question && question.communicative) {
      if (!window.CommunicativeQuestionFlowController) {
        throw new Error("Communicative Question Flow Controller is not loaded.");
      }
      result = await CommunicativeQuestionFlowController.start(step.questionId);
    } else {
      while (true) {
        result = await QuestionManager.start(step.questionId, {
          __legacyTraceContext: { runtime: "story", storyId: state.storyId }
        });
        var speechControl = window.FiniteRescue && FiniteRescue.consume();
        if (speechControl && speechControl.controlResult === "adventure_return") {
          result = speechControl;
          break;
        }
        if (result.status === "success" || result.status === "cancelled" ||
            result.status === "adventure_return") break;
        var immediateTechnical = result.error && window.FiniteRescue &&
          FiniteRescue.isImmediateTechnicalFailure(result.error);
        if (immediateTechnical || failureCount >= 3) {
          var rescueAction = await chooseRescue(true);
          if (rescueAction !== "retry") {
            result = adventureReturn(result.error);
            break;
          }
          if (step.questionId === "phrase.come_with_us" && window.LegacySpeechTrace &&
              typeof LegacySpeechTrace.recordInvite === "function") {
            LegacySpeechTrace.recordInvite(null, "retry-trigger", {
              reason: "rescue-retry",
              status: result.status,
              error: result.error || null
            });
          }
          result = await QuestionManager.start(step.questionId, {
            __legacyTraceContext: { runtime: "story", storyId: state.storyId }
          });
          var rescueSpeechControl = window.FiniteRescue && FiniteRescue.consume();
          if (rescueSpeechControl && rescueSpeechControl.controlResult === "adventure_return") {
            result = rescueSpeechControl;
            break;
          }
          if (result.status !== "success" && result.status !== "cancelled" &&
              result.status !== "adventure_return") {
            await chooseRescue(false);
            result = adventureReturn(result.error);
          }
          break;
        }
        if (step.questionId === "phrase.come_with_us" && window.LegacySpeechTrace &&
            typeof LegacySpeechTrace.recordInvite === "function") {
          LegacySpeechTrace.recordInvite(null, "retry-trigger", {
            reason: "question-result-not-success",
            status: result.status,
            error: result.error || null
          });
        }
        if (result.status !== "success" && supportMessages.length > 0) {
          failureCount += 1;
          DialogManager.show("ピコ", supportMessages[Math.min(failureCount - 1, supportMessages.length - 1)]);
          await DialogManager.next("もう一度言う");
        } else {
          failureCount += 1;
        }
      }
    }
    state[step.saveAs || "lastQuestion"] = result;
    if (step.speechDucking && window.SpeechAudioDuckingInternal) {
      await SpeechAudioDuckingInternal.finish(step.speechDucking.restore !== false);
    }
    return result;
  });

  register("set", async function (step, state) { requireField(step, "key", 0); state[step.key] = valueOf(step.value, state); });

  register("save", async function () { SaveManager.save(); });
  register("setFlag", async function (step, state) { SaveManager.setFlag(step.key, valueOf(step.value, state)); });
  register("addCompanion", async function (step) { SaveManager.addCompanion(step.characterId); });
  register("removeCompanion", async function (step) { SaveManager.removeCompanion(step.characterId); });
  register("addItem", async function (step) { SaveManager.addItem(step.itemId, step.quantity); });
  register("removeItem", async function (step) { SaveManager.removeItem(step.itemId, step.quantity); });
  register("discoverMonster", async function (step) { SaveManager.recordMonsterEncounter(step.id); });
  register("defeatMonster", async function (step) { SaveManager.recordMonsterDefeat(step.id); });
  register("monsterBattle", async function (step, state) {
    if (!step.preserveBgm && window.AudioManager && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
    var result = await MonsterBattleManager.start(step.monsterId);
    state[step.saveAs || "lastBattle"] = result;
    return result;
  });
  register("camp", async function (step, state) {
    if (window.AudioManager && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
    state[step.saveAs || "lastCamp"] = await CampManager.start(step.campId);
  });
  register("morning", async function (step, state) {
    var result = await MorningManager.start(step.morningId);
    state[step.saveAs || "lastMorning"] = result;
    return result;
  });

  function picoBreakContext(step, story) {
    return {
      storyId: story.id,
      category: step.category,
      allowedCategories: step.allowedCategories,
      chance: step.chance,
      every: step.every,
      thresholdMs: step.thresholdMs
    };
  }

  register("picoBreak", async function (step, state, index, story) {
    var context = picoBreakContext(step, story);
    // 旧Experimental版のmode指定も読み取るが、新しいPICO_BREAKは
    // Manager内のinterval→random共通判定だけを呼び出す。
    if (step.mode === "forced") return PicoBreakManager.force(step.id, context);
    if (step.mode === "interval") return PicoBreakManager.maybeInterval(context);
    if (step.mode === "random") return PicoBreakManager.maybeRandom(context);
    if (step.mode === "manual") return PicoBreakManager.showSelected(context);
    return PicoBreakManager.evaluate(context);
  });

  async function runPicoBreakForce(step, story) {
    return PicoBreakManager.force(step.id, picoBreakContext(step, story));
  }

  register("picoBreakForce", async function (step, state, index, story) {
    return runPicoBreakForce(step, story);
  });

  register("picoBreakWait", async function (step, state, index, story) {
    var context = picoBreakContext(step, story);
    if (step.task !== undefined) {
      var task = step.task;
      var result = await PicoBreakManager.during(
        typeof task === "function" ? function () { return task(state, story); } : task,
        context
      );
      if (step.saveAs) state[step.saveAs] = result;
      return result;
    }
    var token = PicoBreakManager.beginApiWait(context);
    state[step.saveAs || "picoBreakWaitToken"] = token;
    return token;
  });

  register("picoBreakOff", async function () { PicoBreakManager.setEnabled(false); });
  register("picoBreakOn", async function () { PicoBreakManager.setEnabled(true); });

  // Experimental 0.2互換。
  register("picoBreakForced", async function (step, state, index, story) {
    return runPicoBreakForce(step, story);
  });

  register("branch", async function (step, state, index, story) {
    var selected = valueOf(step.condition, state) ? step.thenSteps : step.elseSteps;
    return runSteps(selected || [], state, story, index);
  });

  register("choice", async function (step, state) {
    var options = (step.options || []).map(function (option) {
      return { label: valueOf(option.label, state), value: option.value };
    });
    state[step.saveAs || "lastChoice"] = await GameCore.choice(options);
  });

  window.StoryEngine = {
    play: play,
    playById: playById,
    validate: validate,
    register: register,
    valueOf: valueOf,
    runStep: runStep,
    runSteps: runSteps
  };
})();
