(function () {
  "use strict";

  var bgm = null;
  var voices = [];
  var dialogueVoices = [];
  var effects = [];
  var fadeSerial = 0;
  var speechDucking = null;
  var radioTraceSerial = 0;

  function voiceTrace(event, detail, extra) {
    try { console.log("[VoiceTrace] " + event, Object.assign({}, detail || {}, extra || {})); } catch (_) {}
  }

  function resolve(type, keyOrPath) {
    return window.AssetManager ? AssetManager.audio(type, keyOrPath) : keyOrPath;
  }

  function safePlay(audio) {
    var playback;
    try {
      if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-call", audio.__eigoRadioTrace);
      var result = audio.play();
      if (result && typeof result.then === "function") {
        playback = Promise.resolve(result).then(function () {
          if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-resolved", audio.__eigoRadioTrace);
          return { ok: true, error: null };
        }, function (error) {
          if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-rejected", audio.__eigoRadioTrace, { error: String(error) });
          console.warn("Audio playback was blocked or failed:", error);
          return { ok: false, error: error };
        });
      } else {
        if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-resolved", audio.__eigoRadioTrace);
        playback = Promise.resolve({ ok: true, error: null });
      }
    } catch (error) {
      if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-rejected", audio.__eigoRadioTrace, { error: String(error) });
      console.warn("Audio playback was blocked or failed:", error);
      playback = Promise.resolve({ ok: false, error: error });
    }
    audio.__eigoPlaybackOutcome = playback;
    return audio;
  }

  function stop(audio) {
    if (!audio) return;
    if (audio.__eigoRadioTrace) voiceTrace("radio-stop", audio.__eigoRadioTrace);
    if (typeof audio.__eigoDialogueComplete === "function") audio.__eigoDialogueComplete("stopped");
    audio.pause();
    try { audio.currentTime = 0; } catch (_) {}
  }

  function fade(audio, from, to, durationMs, onComplete) {
    var token = ++fadeSerial;
    var duration = Math.max(0, Number(durationMs) || 0);
    var startedAt = Date.now();
    audio.volume = Math.max(0, Math.min(1, from));
    if (!duration) {
      audio.volume = Math.max(0, Math.min(1, to));
      if (onComplete) onComplete();
      return Promise.resolve();
    }
    return new Promise(function (resolveFade) {
      function tick() {
        if (token !== fadeSerial && audio.paused) return resolveFade();
        var progress = Math.min(1, (Date.now() - startedAt) / duration);
        audio.volume = Math.max(0, Math.min(1, from + ((to - from) * progress)));
        if (progress >= 1) {
          if (onComplete) onComplete();
          resolveFade();
          return;
        }
        setTimeout(tick, 40);
      }
      tick();
    });
  }

  function playBgm(keyOrPath, options) {
    options = options || {};
    speechDucking = null;
    var path = resolve("bgm", keyOrPath);
    var targetVolume = options.volume === undefined ? 1 : options.volume;
    if (bgm && bgm.src && bgm.getAttribute("src") === path && !bgm.paused) {
      if (options.fadeInMs) fade(bgm, bgm.volume, targetVolume, options.fadeInMs);
      return bgm;
    }
    var previous = bgm;
    var next = new Audio(path);
    next.loop = options.loop !== false;
    next.volume = options.fadeInMs || options.crossfadeMs ? 0 : targetVolume;
    next.preload = "auto";
    bgm = next;
    safePlay(next);
    if (previous) {
      if (options.crossfadeMs) fade(previous, previous.volume, 0, options.crossfadeMs, function () { stop(previous); });
      else stop(previous);
    }
    if (options.fadeInMs || options.crossfadeMs) {
      fade(next, 0, targetVolume, options.fadeInMs || options.crossfadeMs);
    }
    if (options.fadeToVolume !== undefined) {
      fade(next, targetVolume, options.fadeToVolume, options.fadeToMs || 0);
    }
    return next;
  }

  function stopBgm() {
    var options = arguments[0] || {};
    speechDucking = null;
    var current = bgm;
    bgm = null;
    if (!current) return Promise.resolve();
    if (options.fadeOutMs) {
      return fade(current, current.volume, 0, options.fadeOutMs, function () { stop(current); });
    }
    stop(current);
    return Promise.resolve();
  }

  function isZephyrMotif(type, keyOrPath, path) {
    if (type !== "se") return false;
    // category=MOTIF now identifies keys such as "zephyrFriendship".
    var assets = window.AudioDatabase && AudioDatabase.assets;
    // 旧string-only Databaseを単独で読み込む既存環境でも、ファイルの
    // 意味が明確なZephyr jingleだけは従来どおりMotifとして扱う。
    if (!assets) return /^audio\/jingle\/jingle_zephyr_[^/]+\.mp3(?:[?#].*)?$/.test(path);
    var direct = assets[keyOrPath];
    if (direct && direct.category === "MOTIF") return true;
    return Object.keys(assets).some(function (key) {
      var definition = assets[key];
      return definition && definition.category === "MOTIF" && definition.file === path;
    });
  }

  function playOneShot(type, keyOrPath, options, collection) {
    options = options || {};
    var path = resolve(type, keyOrPath);
    if (isZephyrMotif(type, keyOrPath, path)) {
      var active = collection.find(function (item) {
        return item.getAttribute("src") === path && !item.paused;
      });
      if (active) return active;
    }
    var audio = new Audio(path);
    audio.volume = options.volume === undefined ? 1 : options.volume;
    audio.preload = "auto";
    collection.push(audio);
    audio.addEventListener("ended", function () {
      var index = collection.indexOf(audio);
      if (index !== -1) collection.splice(index, 1);
    }, { once: true });
    return safePlay(audio);
  }

  function playSe(keyOrPath, options) { return playOneShot("se", keyOrPath, options, effects); }
  function playVoice(keyOrPath, options) { return playOneShot("voice", keyOrPath, options, voices); }

  function playDialogueVoice(keyOrPath, options) {
    options = options || {};
    var radio = options.voiceEffect === "radio";
    var kong = !radio && /^voice_c02_/.test(keyOrPath);
    var bernie = !radio && /^voice_c04_/.test(keyOrPath);
    var traceDetail = radio ? { traceId: ++radioTraceSerial, voiceKey: keyOrPath, voiceEffect: options.voiceEffect } : null;
    if (radio) voiceTrace("radio-play-request", traceDetail);
    else voiceTrace("normal-voice-play-call", { voiceKey: keyOrPath });
    var audio = radio || kong || bernie
      ? new Audio(resolve("voice", keyOrPath))
      : playOneShot("voice", keyOrPath, options, voices);
    if (kong || bernie) {
      audio.volume = options.volume === undefined ? 1 : options.volume;
      audio.preload = "auto";
      voices.push(audio);
      audio.addEventListener("ended", function () {
        var index = voices.indexOf(audio);
        if (index !== -1) voices.splice(index, 1);
      }, { once: true });
    }
    if (radio) {
      audio.__eigoRadioTrace = traceDetail;
      voiceTrace("radio-audio-created", traceDetail, { src: audio.src });
      audio.volume = options.volume === undefined ? 1 : options.volume;
      audio.preload = "auto";
      voices.push(audio);
    }
    audio.addEventListener("playing", function () {
      if (radio) voiceTrace("radio-audio-event-playing", traceDetail);
      else voiceTrace("normal-voice-playing", { voiceKey: keyOrPath });
    });
    dialogueVoices.push(audio);
    var settled = false;
    var radioContext = null;
    var radioNodes = [];
    var mixContext = null;
    var mixNodes = [];
    var resolveCompletion;
    var completion = new Promise(function (resolve) { resolveCompletion = resolve; });

    function disposeRadio() {
      radioNodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
      radioNodes = [];
      if (radioContext) {
        var context = radioContext;
        radioContext = null;
        try { Promise.resolve(context.close()).catch(function () {}); } catch (_) {}
      }
      mixNodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
      mixNodes = [];
      if (mixContext) {
        var mix = mixContext;
        mixContext = null;
        try { Promise.resolve(mix.close()).catch(function () {}); } catch (_) {}
      }
    }

    function complete(status, error) {
      if (settled) return;
      settled = true;
      disposeRadio();
      var dialogueIndex = dialogueVoices.indexOf(audio);
      if (dialogueIndex !== -1) dialogueVoices.splice(dialogueIndex, 1);
      var voiceIndex = voices.indexOf(audio);
      if (voiceIndex !== -1) voices.splice(voiceIndex, 1);
      resolveCompletion({ status: status, error: error && error.message ? error.message : null });
    }

    audio.__eigoDialogueComplete = complete;
    audio.addEventListener("ended", function () {
      if (radio) voiceTrace("radio-audio-event-ended", traceDetail);
      complete("ended");
    }, { once: true });
    audio.addEventListener("error", function () { complete("failed", new Error("audio-error")); }, { once: true });
    audio.addEventListener("abort", function () { complete("failed", new Error("audio-abort")); }, { once: true });

    function startPlayback() {
      if (settled) return;
      safePlay(audio);
      Promise.resolve(audio.__eigoPlaybackOutcome).then(function (outcome) {
        if (outcome && outcome.ok === false) complete("failed", outcome.error);
      });
    }

    if (radio) {
      var AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (AudioContextType) {
        try {
          radioContext = new AudioContextType();
          voiceTrace("radio-context-created", traceDetail, { contextState: radioContext.state });
          voiceTrace("radio-resume-before", traceDetail, { contextState: radioContext.state });
          Promise.resolve(typeof radioContext.resume === "function" ? radioContext.resume() : null).then(function () {
            voiceTrace("radio-resume-resolved", traceDetail, { contextState: radioContext && radioContext.state });
            if (settled) return;
            try {
              var highPass = radioContext.createBiquadFilter();
              highPass.type = "highpass";
              highPass.frequency.value = 700;
              var lowPass = radioContext.createBiquadFilter();
              lowPass.type = "lowpass";
              lowPass.frequency.value = 2000;
              var presence = radioContext.createBiquadFilter();
              presence.type = "peaking";
              presence.frequency.value = 1700;
              presence.Q.value = 1.0;
              presence.gain.value = 12;
              var compressor = radioContext.createDynamicsCompressor();
              compressor.threshold.value = -18;
              compressor.ratio.value = 10;
              compressor.attack.value = 0.008;
              compressor.release.value = 0.15;
              var saturation = radioContext.createWaveShaper();
              var curve = new Float32Array(2048);
              var drive = 2.8;
              var normalization = Math.tanh(drive);
              for (var sample = 0; sample < curve.length; sample += 1) {
                var input = (sample * 2 / (curve.length - 1)) - 1;
                curve[sample] = 0.9 * Math.tanh(drive * input) / normalization;
              }
              saturation.curve = curve;
              saturation.oversample = "2x";
              highPass.connect(lowPass);
              lowPass.connect(presence);
              presence.connect(compressor);
              compressor.connect(saturation);
              saturation.connect(radioContext.destination);
              var source = radioContext.createMediaElementSource(audio);
              voiceTrace("radio-source-created", traceDetail, { contextState: radioContext.state });
              radioNodes = [source, highPass, lowPass, presence, compressor, saturation];
              try {
                source.connect(highPass);
                voiceTrace("radio-graph-connected", traceDetail, { route: "filtered", contextState: radioContext.state });
              } catch (error) {
                voiceTrace("radio-fallback-enter", traceDetail, { reason: "source-filter-connect-failed", error: String(error) });
                source.connect(radioContext.destination);
                voiceTrace("radio-graph-connected", traceDetail, { route: "direct", contextState: radioContext.state });
              }
            } catch (error) {
              voiceTrace("radio-fallback-enter", traceDetail, { reason: "graph-initialization-failed", error: String(error) });
              // An unavailable effect must never prevent the original voice from playing.
              disposeRadio();
            }
            startPlayback();
          }, function (error) {
            voiceTrace("radio-resume-rejected", traceDetail, { error: String(error), contextState: radioContext && radioContext.state });
            voiceTrace("radio-fallback-enter", traceDetail, { reason: "resume-rejected", error: String(error) });
            disposeRadio();
            startPlayback();
          });
        } catch (error) {
          voiceTrace("radio-fallback-enter", traceDetail, { reason: "context-or-resume-threw", error: String(error) });
          disposeRadio();
          startPlayback();
        }
      } else {
        voiceTrace("radio-fallback-enter", traceDetail, { reason: "audio-context-unavailable" });
        startPlayback();
      }
    } else if (kong || bernie) {
      var MixContextType = window.AudioContext || window.webkitAudioContext;
      if (MixContextType) {
        try {
          mixContext = new MixContextType();
          var source = mixContext.createMediaElementSource(audio);
          mixNodes.push(source);
          if (kong) {
            var kongGain = mixContext.createGain();
            kongGain.gain.value = 1.65;
            var kongLimiter = mixContext.createDynamicsCompressor();
            kongLimiter.threshold.value = -3;
            kongLimiter.knee.value = 0;
            kongLimiter.ratio.value = 20;
            kongLimiter.attack.value = 0.001;
            kongLimiter.release.value = 0.08;
            source.connect(kongGain);
            kongGain.connect(kongLimiter);
            kongLimiter.connect(mixContext.destination);
            mixNodes.push(kongGain, kongLimiter);
          } else {
            var lowMid = mixContext.createBiquadFilter();
            lowMid.type = "peaking";
            lowMid.frequency.value = 320;
            lowMid.Q.value = 0.9;
            lowMid.gain.value = -2.5;
            var presence = mixContext.createBiquadFilter();
            presence.type = "peaking";
            presence.frequency.value = 3200;
            presence.Q.value = 1.0;
            presence.gain.value = 2.0;
            source.connect(lowMid);
            lowMid.connect(presence);
            presence.connect(mixContext.destination);
            mixNodes.push(lowMid, presence);
          }
          Promise.resolve(typeof mixContext.resume === "function" ? mixContext.resume() : null).then(startPlayback, function () {
            startPlayback();
          });
        } catch (error) {
          disposeRadio();
          startPlayback();
        }
      } else {
        startPlayback();
      }
    } else {
      Promise.resolve(audio.__eigoPlaybackOutcome).then(function (outcome) {
        if (outcome && outcome.ok === false) complete("failed", outcome.error);
      });
    }
    return { audio: audio, completion: completion };
  }

  function stopDialogueVoices() {
    dialogueVoices.slice().forEach(stop);
    dialogueVoices = [];
  }

  function stopAll() {
    stopBgm();
    voices.concat(effects).forEach(stop);
    voices = [];
    effects = [];
    dialogueVoices = [];
    if (window.DialogueVoiceController && typeof DialogueVoiceController.onAudioStopAll === "function") {
      DialogueVoiceController.onAudioStopAll();
    }
  }

  function stopOneShots() {
    voices.concat(effects).forEach(stop);
    voices = [];
    effects = [];
    dialogueVoices = [];
    if (window.DialogueVoiceController && typeof DialogueVoiceController.onAudioStopAll === "function") {
      DialogueVoiceController.onAudioStopAll();
    }
  }

  function armSpeechDucking(options) {
    options = options || {};
    var profile = window.AudioMixProfile && AudioMixProfile.ducking && AudioMixProfile.ducking.speechRecognition || {};
    if (options.ratio === undefined && profile.ratio !== undefined) options.ratio = profile.ratio;
    if (options.duckMs === undefined && profile.duckMs !== undefined) options.duckMs = profile.duckMs;
    if (options.restoreMs === undefined && profile.restoreMs !== undefined) options.restoreMs = profile.restoreMs;
    if (speechDucking && speechDucking.active) return;
    speechDucking = {
      armed: true,
      active: false,
      audio: null,
      normalVolume: null,
      ratio: options.ratio === undefined ? 0.25 : options.ratio,
      duckMs: options.duckMs === undefined ? 300 : options.duckMs,
      restoreMs: options.restoreMs === undefined ? 600 : options.restoreMs
    };
  }

  async function beginSpeechDucking() {
    if (!speechDucking || !speechDucking.armed) return false;
    stopOneShots();
    if (speechDucking.active) return true;
    if (!bgm || bgm.paused) return false;
    speechDucking.active = true;
    speechDucking.audio = bgm;
    speechDucking.normalVolume = bgm.volume;
    await fade(bgm, bgm.volume, bgm.volume * speechDucking.ratio, speechDucking.duckMs);
    return true;
  }

  async function finishSpeechDucking(restore) {
    var current = speechDucking;
    if (current && restore === false) return;
    speechDucking = null;
    if (!current || !current.active || !current.audio || current.audio.paused) return;
    if (restore && bgm === current.audio) {
      await fade(current.audio, current.audio.volume, current.normalVolume, current.restoreMs);
    }
  }

  function speechDuckingIsArmed() {
    return !!(speechDucking && speechDucking.armed);
  }

  window.AudioManager = {
    playBgm: playBgm,
    stopBgm: stopBgm,
    playSe: playSe,
    playVoice: playVoice,
    stopAll: stopAll
  };
  window.SpeechAudioDuckingInternal = {
    arm: armSpeechDucking,
    begin: beginSpeechDucking,
    finish: finishSpeechDucking,
    isArmed: speechDuckingIsArmed
  };
  window.DialogueVoiceAudioInternal = {
    play: playDialogueVoice,
    stop: stopDialogueVoices,
    isPlaying: function () { return dialogueVoices.length > 0; }
  };
})();
