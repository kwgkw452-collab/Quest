(function () {
  "use strict";

  // Speech開始だけを共有する薄い内部層。
  // Question判定・Morning分類・Story進行は担当しない。
  var activePromise = null;
  var startSerial = 0;
  var releaseSpeechModeOnListenEnd = false;

  function prepare() {
    try {
      if (window.DialogueVoiceController && typeof DialogueVoiceController.stop === "function") {
        DialogueVoiceController.stop();
      }
      if (window.SpeechAudioDuckingInternal && SpeechAudioDuckingInternal.isArmed()) {
        releaseSpeechModeOnListenEnd = false;
        return Promise.resolve(SpeechAudioDuckingInternal.begin());
      }
      if (window.AudioManager && typeof AudioManager.enterSpeechMode === "function") {
        releaseSpeechModeOnListenEnd = true;
        return Promise.resolve(AudioManager.enterSpeechMode({ preserveBgm: false }));
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
      if (releaseSpeechModeOnListenEnd && window.AudioManager && typeof AudioManager.exitSpeechMode === "function") {
        releaseSpeechModeOnListenEnd = false;
        Promise.resolve(AudioManager.exitSpeechMode({ restore: true })).catch(function (error) {
          console.warn("Audio restore after speech recognition failed:", error);
        });
      }
      if (serial === startSerial) activePromise = null;
      return heard;
    }, function (error) {
      if (releaseSpeechModeOnListenEnd && window.AudioManager && typeof AudioManager.exitSpeechMode === "function") {
        releaseSpeechModeOnListenEnd = false;
        Promise.resolve(AudioManager.exitSpeechMode({ restore: true })).catch(function (restoreError) {
          console.warn("Audio restore after speech recognition failed:", restoreError);
        });
      }
      if (serial === startSerial) activePromise = null;
      throw error;
    });
    return activePromise;
  }

  function cancel() {
    startSerial += 1;
    activePromise = null;
    releaseSpeechModeOnListenEnd = false;
    if (window.SpeechEngine && typeof SpeechEngine.stop === "function") SpeechEngine.stop();
  }

  window.SpeechStartController = {
    prepare: prepare,
    startListening: startListening,
    cancel: cancel,
    isListening: function () { return activePromise !== null; }
  };
})();
