(function () {
  "use strict";

  var bgm = null;
  var voices = [];
  var dialogueVoices = [];
  var effects = [];
  var speechDucking = null;
  var radioTraceSerial = 0;
  var canonicalAudioContext = null;
  var unlockAttempted = false;
  var unlockPromise = null;
  var bgmTracks = [];
  var audioState = {
    currentBgmAsset: null,
    baseBgmVolume: 0,
    effectiveBgmVolume: 0,
    fadeState: "idle",
    duckState: {
      dialogue: { multiplier: 1, owners: 0, serial: 0 },
      speech: { multiplier: 1, serial: 0 }
    },
    speechMode: { active: false, preserveBgm: false, held: false },
    voicePlaying: 0
  };

  function voiceTrace(event, detail, extra) {
    try { console.log("[VoiceTrace] " + event, Object.assign({}, detail || {}, extra || {})); } catch (_) {}
  }

  function resolve(type, keyOrPath) {
    return window.AssetManager ? AssetManager.audio(type, keyOrPath) : keyOrPath;
  }

  function mixAssetGain(keyOrPath) {
    var value = window.AudioMixProfile && AudioMixProfile.assets ?
      Number(AudioMixProfile.assets[keyOrPath]) : 1;
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }

  function audioContextType() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function getCanonicalAudioContext() {
    if (canonicalAudioContext) return canonicalAudioContext;
    var ContextType = audioContextType();
    if (!ContextType) return null;
    try { canonicalAudioContext = new ContextType(); } catch (_) { canonicalAudioContext = null; }
    return canonicalAudioContext;
  }

  async function ensureCanonicalAudioContextRunning() {
    var context = getCanonicalAudioContext();
    if (!context) return false;
    if (context.state === "suspended" && typeof context.resume === "function") {
      try { await context.resume(); } catch (_) { return false; }
    }
    // Minimal test/legacy shims may not expose state; real browsers must report running.
    return context.state === undefined || context.state === "running";
  }

  function unlock() {
    if (unlockAttempted) return unlockPromise || Promise.resolve(false);
    unlockAttempted = true;
    unlockPromise = (async function () {
      var contextRunning = await ensureCanonicalAudioContextRunning();
      var mediaUnlocked = false;
      try {
        var probe = new Audio("data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICA");
        probe.volume = 0;
        var outcome = probe.play();
        if (outcome && typeof outcome.then === "function") await outcome;
        probe.pause();
        mediaUnlocked = true;
      } catch (_) { /* Unlock failure must never block game progress. */ }
      return contextRunning || mediaUnlocked;
    })().catch(function () { return false; });
    return unlockPromise;
  }

  function installUnlockGesture() {
    if (!window.document || typeof document.addEventListener !== "function") return;
    var events = ["pointerdown", "touchend", "click", "keydown"];
    function firstGesture() {
      events.forEach(function (name) { document.removeEventListener(name, firstGesture, true); });
      unlock();
    }
    events.forEach(function (name) { document.addEventListener(name, firstGesture, true); });
  }

  function dialogueDuckProfile() {
    return window.AudioMixProfile && AudioMixProfile.ducking && AudioMixProfile.ducking.dialogueVoice || {};
  }

  function speechDuckProfile() {
    return window.AudioMixProfile && AudioMixProfile.ducking && AudioMixProfile.ducking.speechRecognition || {};
  }

  function policyMultiplier() {
    return audioState.duckState.dialogue.multiplier * audioState.duckState.speech.multiplier;
  }

  function clampVolume(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function applyBgmTrackVolume(track) {
    if (!track || !track.audio) return;
    var effective = clampVolume(track.baseVolume * track.envelope * policyMultiplier());
    track.audio.volume = effective;
    if (track.audio === bgm) {
      audioState.currentBgmAsset = track.asset;
      audioState.baseBgmVolume = track.baseVolume;
      audioState.effectiveBgmVolume = effective;
      audioState.fadeState = track.fadeState;
    }
  }

  function oneShotPolicy(type, keyOrPath) {
    var definition = window.AudioDatabase && AudioDatabase.assets && AudioDatabase.assets[keyOrPath];
    var category = definition && definition.category ? definition.category : (type === "se" ? "SE" : "VOICE");
    var policy = window.AudioMixProfile && AudioMixProfile.oneShots && AudioMixProfile.oneShots[category] || {};
    return { category: category, duckable: policy.duckable === true };
  }

  function applyOneShotVolume(audio) {
    var metadata = audio && audio.__eigoMixPolicy;
    if (!metadata) return;
    var multiplier = metadata.duckable ? audioState.duckState.dialogue.multiplier : 1;
    audio.volume = clampVolume(metadata.baseVolume * multiplier);
  }

  function applyCanonicalMix() {
    bgmTracks.slice().forEach(applyBgmTrackVolume);
    effects.concat(voices).forEach(applyOneShotVolume);
  }

  function animatePolicy(kind, target, durationMs) {
    var state = audioState.duckState[kind];
    var serial = ++state.serial;
    var from = state.multiplier;
    var duration = Math.max(0, Number(durationMs) || 0);
    var startedAt = Date.now();
    if (!duration) {
      state.multiplier = target;
      applyCanonicalMix();
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      function tick() {
        if (serial !== state.serial) return resolve();
        var progress = Math.min(1, (Date.now() - startedAt) / duration);
        state.multiplier = from + ((target - from) * progress);
        applyCanonicalMix();
        if (progress >= 1) return resolve();
        setTimeout(tick, 40);
      }
      tick();
    });
  }

  function enterDialogueVoiceMode() {
    audioState.duckState.dialogue.owners += 1;
    audioState.voicePlaying += 1;
    var owner = { active: true };
    if (audioState.duckState.dialogue.owners === 1) {
      var profile = dialogueDuckProfile();
      animatePolicy("dialogue", profile.ratio === undefined ? 0.35 : Number(profile.ratio),
        profile.duckMs === undefined ? 160 : profile.duckMs);
    }
    return owner;
  }

  function exitDialogueVoiceMode(owner) {
    if (!owner || !owner.active) return Promise.resolve();
    owner.active = false;
    audioState.duckState.dialogue.owners = Math.max(0, audioState.duckState.dialogue.owners - 1);
    audioState.voicePlaying = Math.max(0, audioState.voicePlaying - 1);
    if (audioState.duckState.dialogue.owners !== 0) return Promise.resolve();
    var profile = dialogueDuckProfile();
    return animatePolicy("dialogue", 1, profile.restoreMs === undefined ? 280 : profile.restoreMs);
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
    if (audio.__eigoBgmTrack) {
      audio.__eigoBgmTrack.serial += 1;
      audio.__eigoBgmTrack.fadeState = "stopped";
      var trackIndex = bgmTracks.indexOf(audio.__eigoBgmTrack);
      if (trackIndex !== -1) bgmTracks.splice(trackIndex, 1);
    }
    audio.pause();
    try { audio.currentTime = 0; } catch (_) {}
    if (!bgm && audioState.currentBgmAsset && audio.__eigoBgmTrack &&
        audioState.currentBgmAsset === audio.__eigoBgmTrack.asset) {
      audioState.currentBgmAsset = null;
      audioState.baseBgmVolume = 0;
      audioState.effectiveBgmVolume = 0;
      audioState.fadeState = "idle";
    }
  }

  function animateTrack(track, property, to, durationMs, label, onComplete) {
    if (!track) return Promise.resolve();
    var token = ++track.serial;
    var duration = Math.max(0, Number(durationMs) || 0);
    var startedAt = Date.now();
    var from = track[property];
    track.fadeState = label || "fading";
    if (!duration) {
      track[property] = to;
      track.fadeState = "idle";
      applyBgmTrackVolume(track);
      if (onComplete) onComplete();
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      function tick() {
        if (token !== track.serial) return resolve();
        var progress = Math.min(1, (Date.now() - startedAt) / duration);
        track[property] = from + ((to - from) * progress);
        applyBgmTrackVolume(track);
        if (progress >= 1) {
          track.fadeState = "idle";
          applyBgmTrackVolume(track);
          if (onComplete) onComplete();
          return resolve();
        }
        setTimeout(tick, 40);
      }
      tick();
    });
  }

  function createBgmTrack(audio, asset, baseVolume, envelope) {
    var track = {
      audio: audio,
      asset: asset,
      baseVolume: clampVolume(baseVolume),
      envelope: envelope === undefined ? 1 : envelope,
      fadeState: "idle",
      serial: 0
    };
    audio.__eigoBgmTrack = track;
    bgmTracks.push(track);
    return track;
  }

  function resetHeldSpeechPolicy() {
    speechDucking = null;
    if (!audioState.speechMode.active) {
      audioState.speechMode.held = false;
      audioState.duckState.speech.serial += 1;
      audioState.duckState.speech.multiplier = 1;
    }
  }

  function playBgm(keyOrPath, options) {
    options = options || {};
    resetHeldSpeechPolicy();
    var path = resolve("bgm", keyOrPath);
    var targetVolume = (options.volume === undefined ? 1 : options.volume) * mixAssetGain(keyOrPath);
    if (bgm && bgm.src && bgm.getAttribute("src") === path && !bgm.paused) {
      var existingTrack = bgm.__eigoBgmTrack || createBgmTrack(bgm, keyOrPath, targetVolume, 1);
      if (options.fadeInMs) animateTrack(existingTrack, "baseVolume", targetVolume, options.fadeInMs, "base-volume");
      else {
        existingTrack.baseVolume = targetVolume;
        existingTrack.envelope = 1;
        applyBgmTrackVolume(existingTrack);
      }
      return bgm;
    }
    var previous = bgm;
    var next = new Audio(path);
    next.loop = options.loop !== false;
    next.preload = "auto";
    var nextTrack = createBgmTrack(next, keyOrPath, targetVolume, options.fadeInMs || options.crossfadeMs ? 0 : 1);
    bgm = next;
    applyBgmTrackVolume(nextTrack);
    safePlay(next);
    if (previous) {
      var previousTrack = previous.__eigoBgmTrack;
      if (options.crossfadeMs && previousTrack) {
        animateTrack(previousTrack, "envelope", 0, options.crossfadeMs, "crossfade-out", function () { stop(previous); });
      }
      else stop(previous);
    }
    if (options.fadeInMs || options.crossfadeMs) {
      animateTrack(nextTrack, "envelope", 1, options.fadeInMs || options.crossfadeMs,
        options.crossfadeMs ? "crossfade-in" : "fade-in");
    }
    if (options.fadeToVolume !== undefined) {
      animateTrack(nextTrack, "baseVolume", options.fadeToVolume * mixAssetGain(keyOrPath),
        options.fadeToMs || 0, "base-volume");
    }
    return next;
  }

  function stopBgm() {
    var options = arguments[0] || {};
    resetHeldSpeechPolicy();
    var current = bgm;
    bgm = null;
    if (!current) return Promise.resolve();
    var currentTrack = current.__eigoBgmTrack;
    if (options.fadeOutMs && currentTrack) {
      return animateTrack(currentTrack, "envelope", 0, options.fadeOutMs, "fade-out", function () { stop(current); });
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
    var policy = oneShotPolicy(type, keyOrPath);
    audio.__eigoMixPolicy = {
      category: policy.category,
      duckable: policy.duckable,
      baseVolume: options.volume === undefined ? 1 : options.volume
    };
    applyOneShotVolume(audio);
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
    var voiceModeOwner = enterDialogueVoiceMode();

    function disposeRadio() {
      radioNodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
      radioNodes = [];
      radioContext = null;
      mixNodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
      mixNodes = [];
      mixContext = null;
    }

    function complete(status, error) {
      if (settled) return;
      settled = true;
      disposeRadio();
      var dialogueIndex = dialogueVoices.indexOf(audio);
      if (dialogueIndex !== -1) dialogueVoices.splice(dialogueIndex, 1);
      var voiceIndex = voices.indexOf(audio);
      if (voiceIndex !== -1) voices.splice(voiceIndex, 1);
      exitDialogueVoiceMode(voiceModeOwner);
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
      var AudioContextType = audioContextType();
      if (AudioContextType) {
        try {
          radioContext = getCanonicalAudioContext();
          voiceTrace("radio-context-created", traceDetail, { contextState: radioContext.state });
          voiceTrace("radio-resume-before", traceDetail, { contextState: radioContext.state });
          ensureCanonicalAudioContextRunning().then(function (running) {
            voiceTrace("radio-resume-resolved", traceDetail, { contextState: radioContext && radioContext.state });
            if (settled) return;
            if (!running) {
              voiceTrace("radio-fallback-enter", traceDetail, { reason: "context-not-running" });
              startPlayback();
              return;
            }
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
      var MixContextType = audioContextType();
      if (MixContextType) {
        try {
          mixContext = getCanonicalAudioContext();
          ensureCanonicalAudioContextRunning().then(function (running) {
            if (!running || settled) {
              startPlayback();
              return;
            }
            var source = mixContext.createMediaElementSource(audio);
            mixNodes.push(source);
            if (kong) {
            var kongGain = mixContext.createGain();
            var processing = window.AudioMixProfile && AudioMixProfile.characterProcessing &&
              AudioMixProfile.characterProcessing.c02 || {};
            kongGain.gain.value = processing.webAudioGain === undefined ? 1 : Number(processing.webAudioGain);
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
            startPlayback();
          }).catch(function () { startPlayback(); });
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
    speechDucking = null;
    audioState.speechMode.active = false;
    audioState.speechMode.preserveBgm = false;
    audioState.speechMode.held = false;
    audioState.duckState.speech.serial += 1;
    audioState.duckState.speech.multiplier = 1;
    applyCanonicalMix();
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
    if (speechDucking && speechDucking.active) return;
    speechDucking = {
      armed: true,
      active: false,
      restore: options.restore !== false
    };
  }

  async function enterSpeechMode(options) {
    options = options || {};
    var preserveBgm = options.preserveBgm === true;
    stopOneShots();
    audioState.speechMode.active = true;
    audioState.speechMode.preserveBgm = preserveBgm;
    audioState.speechMode.held = false;
    if (!preserveBgm) {
      audioState.duckState.speech.serial += 1;
      audioState.duckState.speech.multiplier = 1;
      applyCanonicalMix();
      await stopBgm(options.stopOptions);
      return true;
    }
    var profile = speechDuckProfile();
    await animatePolicy("speech", profile.ratio === undefined ? 0.25 : Number(profile.ratio),
      profile.duckMs === undefined ? 300 : profile.duckMs);
    return !!(bgm && !bgm.paused);
  }

  async function exitSpeechMode(options) {
    options = options || {};
    var restore = options.restore !== false;
    audioState.speechMode.active = false;
    audioState.speechMode.held = !restore;
    if (!restore) return;
    var profile = speechDuckProfile();
    await animatePolicy("speech", 1, profile.restoreMs === undefined ? 600 : profile.restoreMs);
    audioState.speechMode.preserveBgm = false;
  }

  async function beginSpeechDucking() {
    if (!speechDucking || !speechDucking.armed) return false;
    if (speechDucking.active) return true;
    speechDucking.active = true;
    return enterSpeechMode({ preserveBgm: true });
  }

  async function finishSpeechDucking(restore) {
    var current = speechDucking;
    speechDucking = null;
    if (!current || !current.active) return;
    await exitSpeechMode({ restore: restore !== false });
  }

  function speechDuckingIsArmed() {
    return !!(speechDucking && speechDucking.armed);
  }

  function getAudioState() {
    return {
      currentBgmAsset: audioState.currentBgmAsset,
      baseBgmVolume: audioState.baseBgmVolume,
      effectiveBgmVolume: audioState.effectiveBgmVolume,
      fadeState: audioState.fadeState,
      duckState: {
        dialogueMultiplier: audioState.duckState.dialogue.multiplier,
        dialogueOwners: audioState.duckState.dialogue.owners,
        speechMultiplier: audioState.duckState.speech.multiplier
      },
      speechMode: Object.assign({}, audioState.speechMode),
      voicePlaying: audioState.voicePlaying
    };
  }

  window.AudioManager = {
    playBgm: playBgm,
    stopBgm: stopBgm,
    playSe: playSe,
    playVoice: playVoice,
    stopAll: stopAll,
    unlock: unlock,
    ensureContextRunning: ensureCanonicalAudioContextRunning,
    getAudioContext: getCanonicalAudioContext,
    getState: getAudioState,
    enterDialogueVoiceMode: enterDialogueVoiceMode,
    exitDialogueVoiceMode: exitDialogueVoiceMode,
    enterSpeechMode: enterSpeechMode,
    exitSpeechMode: exitSpeechMode
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
  installUnlockGesture();
})();
