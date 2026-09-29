(function () {
  "use strict";

  var sessionSerial = 0;

  function stopVoice() {
    if (window.DialogueVoiceController && typeof DialogueVoiceController.stop === "function") {
      DialogueVoiceController.stop();
    }
  }

  function present(options) {
    options = options || {};
    var session = ++sessionSerial;
    var initialView = options.initialView === "english" || options.initialView === "japanese" ? options.initialView : null;
    var state = {
      supportOpen: Boolean(initialView),
      englishVisible: initialView === "english",
      japaneseVisible: initialView === "japanese",
      voicePlaying: false
    };
    var resolveNext;
    var completion = options.button === false ? Promise.resolve("automatic") : new Promise(function (resolve) {
      resolveNext = resolve;
    });

    function isCurrent() {
      return session === sessionSerial;
    }

    function visibleContent() {
      if (state.japaneseVisible) {
        return { speaker: options.supportSpeaker || "ピコ", text: options.supportText || "" };
      }
      if (state.englishVisible) {
        return { speaker: options.speaker || "", text: options.text || "" };
      }
      return { speaker: options.speaker || "", text: "" };
    }

    function setVisibleContent() {
      var content = visibleContent();
      DialogManager.setContent(content.speaker, content.text);
    }

    function finish() {
      if (!isCurrent()) return;
      sessionSerial += 1;
      stopVoice();
      if (resolveNext) resolveNext("next");
    }

    function startVoice() {
      if (!isCurrent() || state.voicePlaying || !options.voiceKey ||
          !window.DialogueVoiceController || typeof DialogueVoiceController.play !== "function") return;
      state.voicePlaying = true;
      renderControls();
      Promise.resolve(DialogueVoiceController.play(options.voiceKey, { sceneGain: options.voiceGain, voiceEffect: options.voiceEffect })).then(function () {
        if (!isCurrent()) return;
        state.voicePlaying = false;
        renderControls();
      }, function () {
        if (!isCurrent()) return;
        state.voicePlaying = false;
        renderControls();
      });
    }

    function addNext() {
      if (options.button === false) return;
      DialogManager.addControl(options.button || GameConfig.dialogueNextLabel, finish);
    }

    function renderControls() {
      if (!isCurrent()) return;
      DialogManager.clearControls();
      addNext();
      if (!state.supportOpen) {
        DialogManager.addControl(options.supportLabel || "Pico's Support", function () {
          if (!isCurrent()) return;
          state.supportOpen = true;
          renderControls();
        });
        return;
      }
      DialogManager.addControl("英文を見る", function () {
        if (!isCurrent()) return;
        state.englishVisible = true;
        state.japaneseVisible = false;
        setVisibleContent();
      });
      if (options.supportText) {
        DialogManager.addControl("日本語を見る", function () {
          if (!isCurrent()) return;
          state.englishVisible = false;
          state.japaneseVisible = true;
          setVisibleContent();
        });
      }
      DialogManager.addControl("もう一度聞く", startVoice, { disabled: state.voicePlaying });
    }

    DialogManager.show(options.speaker || "", "", options.modeClass);
    if (initialView) setVisibleContent();
    state.voicePlaying = Boolean(options.voiceKey && window.DialogueVoiceController &&
      typeof DialogueVoiceController.play === "function");
    renderControls();
    if (state.voicePlaying) {
      Promise.resolve(DialogueVoiceController.play(options.voiceKey, { sceneGain: options.voiceGain, voiceEffect: options.voiceEffect })).then(function () {
        if (!isCurrent()) return;
        state.voicePlaying = false;
        renderControls();
      }, function () {
        if (!isCurrent()) return;
        state.voicePlaying = false;
        renderControls();
      });
    } else {
      state.voicePlaying = false;
      renderControls();
    }
    return completion;
  }

  window.PicoSupportController = {
    present: present,
    dismiss: function () {
      sessionSerial += 1;
      stopVoice();
    }
  };
})();
