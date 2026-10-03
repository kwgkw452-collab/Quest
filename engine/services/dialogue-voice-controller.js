(function () {
  "use strict";

  // Dialogue Voiceだけを自然終了順に直列化する薄い内部層。
  // Effect Voiceは従来どおりAudioManager.playVoice()で重奏可能。
  var generation = 0;
  var queue = Promise.resolve();
  var activeAudio = null;

  function hasAsset(voiceKey) {
    var database = window.AudioDatabase || {};
    if (database.voice && Object.prototype.hasOwnProperty.call(database.voice, voiceKey)) return true;
    var definition = database.assets && database.assets[voiceKey];
    return !!(definition && definition.category === "VOICE" && definition.file);
  }

  function result(voiceKey, status, detail) {
    return {
      voiceKey: voiceKey || null,
      status: status,
      character: window.VoiceProfileDatabase ? VoiceProfileDatabase.getForVoiceKey(voiceKey) : null,
      detail: detail || null
    };
  }

  async function start(voiceKey, options, requestGeneration) {
    if (requestGeneration !== generation) return result(voiceKey, "cancelled");
    if (!window.VoiceProfileDatabase || !VoiceProfileDatabase.parseVoiceKey(voiceKey)) {
      return result(voiceKey, "invalid-key");
    }
    if (!hasAsset(voiceKey)) return result(voiceKey, "missing");
    if (!window.DialogueVoiceAudioInternal || typeof DialogueVoiceAudioInternal.play !== "function") {
      return result(voiceKey, "unavailable");
    }

    try {
      var gain = VoiceProfileDatabase.resolveGain(voiceKey, options.sceneGain);
      var tracked = DialogueVoiceAudioInternal.play(voiceKey, {
        volume: Math.max(0, Math.min(1, gain)),
        voiceEffect: options.voiceEffect
      });
      activeAudio = tracked;
      var completion = await tracked.completion;
      if (activeAudio === tracked) activeAudio = null;
      return result(voiceKey, completion.status, completion.error);
    } catch (error) {
      activeAudio = null;
      console.warn("Dialogue Voice failed safely:", error);
      return result(voiceKey, "failed", error && error.message ? error.message : String(error));
    }
  }

  function play(voiceKey, options) {
    options = options || {};
    var requestGeneration = generation;
    var requested = queue.then(function () {
      return start(voiceKey, options, requestGeneration);
    }, function () {
      return start(voiceKey, options, requestGeneration);
    });
    queue = requested.then(function () {}, function () {});
    return requested;
  }

  function stop() {
    generation += 1;
    if (window.DialogueVoiceAudioInternal && typeof DialogueVoiceAudioInternal.stop === "function") {
      DialogueVoiceAudioInternal.stop();
    }
    activeAudio = null;
    queue = Promise.resolve();
  }

  function onAudioStopAll() {
    // AudioManager側で実音声停止済み。予約中Dialogue Voiceだけを失効させる。
    generation += 1;
    activeAudio = null;
    queue = Promise.resolve();
  }

  window.DialogueVoiceController = {
    play: play,
    stop: stop,
    onAudioStopAll: onAudioStopAll,
    waitForIdle: function () { return queue; },
    isActive: function () { return activeAudio !== null; }
  };
})();
