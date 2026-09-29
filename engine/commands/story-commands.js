(function () {
  "use strict";

  function command(type, data) {
    var step = { type: type };
    Object.keys(data || {}).forEach(function (key) {
      if (data[key] !== undefined) step[key] = data[key];
    });
    return step;
  }

  window.StoryCommands = {
    clear: function () { return command("clear"); },
    background: function (keyOrPath) { return command("background", { src: keyOrPath }); },
    backgroundSequence: function (items, fadeMs, holdMs) {
      return command("backgroundSequence", { items: items, fadeMs: fadeMs, holdMs: holdMs });
    },
    travelTransition: function (keyOrPath) { return command("travelTransition", { src: keyOrPath }); },
    item: function (keyOrPath, className) { return command("item", { src: keyOrPath, className: className }); },
    characters: function (items) { return command("characters", { items: items }); },
    monster: function (id, state, options) {
      options = options || {};
      return command("monster", { id: id, state: state || "normal", className: options.className, replace: options.replace });
    },
    monsterState: function (id, state) { return command("monsterState", { id: id, state: state }); },
    clearMonsters: function () { return command("clearMonsters"); },
    characterImage: function (id, poseOrPath) {
      var data = { id: id };
      if (typeof poseOrPath === "string" && (poseOrPath.indexOf("/") !== -1 || /\.[a-z0-9]+$/i.test(poseOrPath))) data.src = poseOrPath;
      else data.pose = poseOrPath;
      return command("characterImage", data);
    },
    floatingText: function (text, className) { return command("floatingText", { text: text, className: className }); },
    dialogue: function (speaker, text, options) {
      options = options || {};
      return command("dialogue", {
        speaker: speaker,
        text: text,
        button: options.button,
        modeClass: options.modeClass,
        voiceKey: options.voiceKey,
        voiceGain: options.voiceGain,
        voiceEffect: options.voiceEffect,
        supportText: options.supportText,
        supportSpeaker: options.supportSpeaker,
        supportLabel: options.supportLabel
      });
    },
    hideDialogue: function () { return command("hideDialogue"); },
    wait: function (ms) { return command("wait", { ms: ms }); },
    effect: function (keyOrClassName, ms) { return command("effect", { className: keyOrClassName, ms: ms }); },
    bgm: function (keyOrPath, options) { return command("bgm", { src: keyOrPath, options: options }); },
    stopBgm: function (options) { return command("stopBgm", { options: options }); },
    se: function (keyOrPath, options) { return command("se", { src: keyOrPath, options: options }); },
    voice: function (keyOrPath, options) { return command("voice", { src: keyOrPath, options: options }); },
    video: function (keyOrPath, options) { return command("video", { src: keyOrPath, options: options }); },
    stopVideo: function () { return command("stopVideo"); },
    filter: function (visible) { return command("filter", { visible: visible }); },
    speech: function (message, accepted, options) {
      options = options || {};
      return command("speech", {
        message: message,
        accepted: accepted,
        speaker: options.speaker,
        lang: options.lang,
        timeoutMs: options.timeoutMs,
        buttonLabel: options.buttonLabel,
        fallbackPrompt: options.fallbackPrompt,
        saveAs: options.saveAs
      });
    },
    question: function (questionId, saveAs, options) {
      options = options || {};
      return command("question", {
        questionId: questionId,
        saveAs: saveAs,
        supportMessages: options.supportMessages,
        speechDucking: options.speechDucking
      });
    },
    confirmSpeechName: function (message, saveAs, options) {
      options = options || {};
      return command("confirmSpeechName", { message: message, saveAs: saveAs, speechDucking: options.speechDucking });
    },
    set: function (key, value) { return command("set", { key: key, value: value }); },
    choice: function (options, saveAs) { return command("choice", { options: options, saveAs: saveAs }); },
    save: function () { return command("save"); },
    setFlag: function (key, value) { return command("setFlag", { key: key, value: value }); },
    addCompanion: function (characterId) { return command("addCompanion", { characterId: characterId }); },
    removeCompanion: function (characterId) { return command("removeCompanion", { characterId: characterId }); },
    addItem: function (itemId, quantity) { return command("addItem", { itemId: itemId, quantity: quantity }); },
    removeItem: function (itemId, quantity) { return command("removeItem", { itemId: itemId, quantity: quantity }); },
    discoverMonster: function (id) { return command("discoverMonster", { id: id }); },
    defeatMonster: function (id) { return command("defeatMonster", { id: id }); },
    monsterBattle: function (monsterId, saveAs, options) {
      options = options || {};
      return command("monsterBattle", {
        monsterId: monsterId,
        saveAs: saveAs,
        preserveBgm: options.preserveBgm === true
      });
    },
    camp: function (campId, saveAs) {
      return command("camp", { campId: campId, saveAs: saveAs });
    },
    morning: function (morningId, saveAs) {
      return command("morning", { morningId: morningId, saveAs: saveAs });
    },
    picoBreak: function (options, legacyOptions) {
      var mode;
      if (typeof options === "string") {
        mode = options;
        options = legacyOptions || {};
      } else {
        options = options || {};
      }
      return command("picoBreak", {
        mode: mode,
        category: options.category,
        allowedCategories: options.allowedCategories,
        chance: options.chance,
        every: options.every
      });
    },
    picoBreakForce: function (id) { return command("picoBreakForce", { id: id }); },
    picoBreakWait: function (task, options) {
      options = options || {};
      return command("picoBreakWait", {
        task: task,
        thresholdMs: options.thresholdMs,
        saveAs: options.saveAs
      });
    },
    picoBreakOff: function () { return command("picoBreakOff"); },
    picoBreakOn: function () { return command("picoBreakOn"); },
    // Experimental 0.2互換。新規StoryではpicoBreakForceを使う。
    picoBreakForced: function (id) { return command("picoBreakForce", { id: id }); },
    sequence: function (steps) { return command("sequence", { steps: steps || [] }); },
    parallel: function (steps) { return command("parallel", { steps: steps || [] }); },
    branch: function (condition, thenSteps, elseSteps) {
      return command("branch", { condition: condition, thenSteps: thenSteps || [], elseSteps: elseSteps || [] });
    },
    repeat: function (steps, times) { return command("repeat", { steps: steps || [], times: times }); },
    event: function (name, payload, saveAs) { return command("event", { name: name, payload: payload || {}, saveAs: saveAs }); },
    checkpoint: function (id) { return command("checkpoint", { id: id }); }
  };
})();
