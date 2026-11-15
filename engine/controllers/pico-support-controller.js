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
    stopVoice();
    var initialView = options.initialView === "english" || options.initialView === "japanese" ? options.initialView : null;
    var state = {
      supportOpen: Boolean(initialView),
      englishVisible: initialView === "english",
      japaneseVisible: initialView === "japanese",
      voiceAvailable: Boolean(options.voiceKey && String(options.voiceKey).trim() && window.DialogueVoiceController &&
        typeof DialogueVoiceController.play === "function"),
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

    function playVoice() {
      try {
        return Promise.resolve(DialogueVoiceController.play(options.voiceKey, { sceneGain: options.voiceGain, voiceEffect: options.voiceEffect }));
      } catch (error) {
        return Promise.reject(error);
      }
    }

    function voiceSettled(result) {
      if (!isCurrent()) return;
      if (result && /^(missing|invalid-key|unavailable)$/.test(result.status)) state.voiceAvailable = false;
      state.voicePlaying = false;
      renderControls();
    }

    function startVoice() {
      if (!isCurrent() || state.voicePlaying || !state.voiceAvailable ||
          !window.DialogueVoiceController || typeof DialogueVoiceController.play !== "function") return;
      state.voicePlaying = true;
      renderControls();
      playVoice().then(voiceSettled, function () { voiceSettled(); });
    }

    function addNext() {
      if (options.button === false) return;
      DialogManager.addControl((options.button && !/^(Next|つぎへ|次へ)$/.test(options.button) ? options.button : "次へ"), finish, {
        disabled: state.voicePlaying
      });
    }

    function renderControls() {
      if (!isCurrent()) return;
      DialogManager.clearControls();
      addNext();
      if (!state.supportOpen) {
        DialogManager.addControl("ピコサポート", function () {
          if (!isCurrent()) return;
          state.supportOpen = true;
          renderControls();
        });
        return;
      }
      DialogManager.addControl("英語を見る", function () {
        if (!isCurrent()) return;
        state.englishVisible = true;
        state.japaneseVisible = false;
        setVisibleContent();
      });
      DialogManager.addControl("日本語を見る", function () {
        if (!isCurrent() || !options.supportText) return;
        state.englishVisible = false;
        state.japaneseVisible = true;
        setVisibleContent();
      }, { disabled: !options.supportText });
      DialogManager.addControl("もう一度聞く", startVoice, {
        disabled: state.voicePlaying || !state.voiceAvailable ||
          !window.DialogueVoiceController || typeof DialogueVoiceController.play !== "function"
      });
    }

    DialogManager.show(options.speaker || "", "", options.modeClass);
    if (initialView) setVisibleContent();
    renderControls();
    startVoice();
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
