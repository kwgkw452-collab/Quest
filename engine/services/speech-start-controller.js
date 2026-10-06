(function () {
  "use strict";

  // Speech開始だけを共有する薄い内部層。
  // Question判定・Morning分類・Story進行は担当しない。
  var activePromise = null;
  var startSerial = 0;

  function prepare() {
    try {
      if (window.DialogueVoiceController && typeof DialogueVoiceController.stop === "function") {
        DialogueVoiceController.stop();
      }
      // Isolation belongs to the actual SpeechEngine.listen attempt, after the
      // user trigger. Preparing a button must not stop or duck the Story BGM.
      if (window.AudioManager && typeof AudioManager.enterSpeechMode === "function") {
        return Promise.resolve();
      }
      // Retain the existing preparation contract in runtimes without the new API.
      if (window.SpeechAudioDuckingInternal && SpeechAudioDuckingInternal.isArmed()) {
        return Promise.resolve(SpeechAudioDuckingInternal.begin());
      }
      if (window.AudioManager && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
      return Promise.resolve();
    } catch (error) {
      console.warn("Audio stop before speech recognition failed:", error);
      return Promise.resolve();
    }
  }

  function startListening(options, ui) {
    options = options || {};
    ui = ui || {};
    if (activePromise) return activePromise;

    if (typeof ui.clearControls === "function") ui.clearControls();
    if (typeof ui.showRecognized === "function") ui.showRecognized("…");

    var serial = ++startSerial;
    try {
      activePromise = Promise.resolve(SpeechEngine.listen(options));
    } catch (error) {
      activePromise = Promise.reject(error);
    }

    activePromise = activePromise.then(function (heard) {
      if (serial === startSerial) activePromise = null;
      return heard;
    }, function (error) {
      if (serial === startSerial) activePromise = null;
      throw error;
    });
    return activePromise;
  }

  function cancel() {
    startSerial += 1;
    activePromise = null;
    if (window.SpeechEngine && typeof SpeechEngine.stop === "function") SpeechEngine.stop();
  }

  window.SpeechStartController = {
    prepare: prepare,
    startListening: startListening,
    cancel: cancel,
    isListening: function () { return activePromise !== null; }
  };
})();
