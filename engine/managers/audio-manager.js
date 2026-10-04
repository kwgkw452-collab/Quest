(function () {
  "use strict";

  var RUNTIME_VERSION = "audio-gainnode-unification-v1";
  window.AudioRuntimeVersion = RUNTIME_VERSION;

  var bgm = null;
  var voices = [];
  var dialogueVoices = [];
  var effects = [];
  var speechDucking = null;
  var radioTraceSerial = 0;
  var canonicalAudioContext = null;
  var canonicalBuses = null;
  var unlockPromise = null;
  var unlockComplete = false;
  var unlockGestureCleanup = null;
  var pendingBgmGestureCleanup = null;
  var pendingBgm = null;
  var bgmRequestSerial = 0;
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

  function audioTrace(event, detail) {
    try { console.log("[AudioTrace] " + event, Object.assign({ runtimeVersion: RUNTIME_VERSION }, detail || {})); } catch (_) {}
  }

  function voiceTrace(event, detail, extra) {
    try { console.log("[VoiceTrace] " + event, Object.assign({}, detail || {}, extra || {})); } catch (_) {}
  }

  function resolve(type, keyOrPath) {
    return window.AssetManager ? AssetManager.audio(type, keyOrPath) : keyOrPath;
  }

  function mixAssetGain(keyOrPath) {
    var value = window.AudioMixProfile && AudioMixProfile.assets ? Number(AudioMixProfile.assets[keyOrPath]) : 1;
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }

  function groupGain(name) {
    var value = window.AudioMixProfile && AudioMixProfile.groups ? Number(AudioMixProfile.groups[name]) : 1;
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }

  function audioContextType() {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function getCanonicalAudioContext() {
    if (canonicalAudioContext) return canonicalAudioContext;
    var ContextType = audioContextType();
    if (!ContextType) return null;
    try {
      canonicalAudioContext = new ContextType();
      audioTrace("AUDIO_RUNTIME_VERSION", { version: RUNTIME_VERSION });
      audioTrace("AUDIO_CONTEXT_STATE", { state: canonicalAudioContext.state || "unknown" });
    } catch (error) {
      canonicalAudioContext = null;
      audioTrace("GAINNODE_FALLBACK", { category: "context", reason: String(error) });
    }
    return canonicalAudioContext;
  }

  function setGainValue(node, value) {
    if (!node || !node.gain) return;
    var normalized = Math.max(0, Number(value) || 0);
    try {
      if (typeof node.gain.cancelScheduledValues === "function") {
        node.gain.cancelScheduledValues(canonicalAudioContext && canonicalAudioContext.currentTime || 0);
      }
      node.gain.value = normalized;
    } catch (_) {}
  }

  function createCanonicalBuses(context) {
    if (canonicalBuses) return canonicalBuses;
    if (!context || typeof context.createGain !== "function") return null;
    var master = context.createGain();
    var buses = {
      master: master,
      bgm: context.createGain(),
      motif: context.createGain(),
      voice: context.createGain(),
      se: context.createGain(),
      effectVoice: context.createGain()
    };
    setGainValue(master, 1);
    setGainValue(buses.bgm, 1);
    setGainValue(buses.motif, 1);
    setGainValue(buses.voice, groupGain("VOICE"));
    setGainValue(buses.se, groupGain("SE"));
    setGainValue(buses.effectVoice, groupGain("VOICE"));
    buses.bgm.connect(master);
    buses.motif.connect(master);
    buses.voice.connect(master);
    buses.se.connect(master);
    buses.effectVoice.connect(master);
    master.connect(context.destination);
    canonicalBuses = buses;
    return buses;
  }

  async function ensureCanonicalAudioContextRunning() {
    var context = getCanonicalAudioContext();
    if (!context) return false;
    if (context.state === "suspended" && typeof context.resume === "function") {
      try { await context.resume(); } catch (error) {
        audioTrace("AUDIO_CONTEXT_STATE", { state: context.state || "unknown", resume: "failed", error: String(error) });
        return false;
      }
    }
    var running = context.state === undefined || context.state === "running";
    if (running) {
      try { createCanonicalBuses(context); } catch (error) {
        audioTrace("GAINNODE_FALLBACK", { category: "bus", reason: String(error) });
        return false;
      }
    }
    audioTrace("AUDIO_CONTEXT_STATE", { state: context.state || "unknown", running: running });
    return running;
  }

  function unlock() {
    if (unlockComplete) return Promise.resolve(true);
    if (unlockPromise) return unlockPromise;
    unlockPromise = (async function () {
      var contextRunning = await ensureCanonicalAudioContextRunning();
      var mediaUnlocked = false;
      try {
        var probe = new Audio("data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICA");
        probe.muted = true;
        var outcome = probe.play();
        if (outcome && typeof outcome.then === "function") await outcome;
        probe.pause();
        mediaUnlocked = true;
      } catch (_) {}
      var success = contextRunning || (!audioContextType() && mediaUnlocked);
      if (success) {
        unlockComplete = true;
        if (unlockGestureCleanup) unlockGestureCleanup();
      }
      return success;
    })().catch(function () { return false; }).then(function (success) {
      unlockPromise = null;
      return success;
    });
    return unlockPromise;
  }

  function installUnlockGesture() {
    if (!window.document || typeof document.addEventListener !== "function") return;
    var events = ["pointerdown", "touchend", "click", "keydown"];
    function cleanup() {
      events.forEach(function (name) { document.removeEventListener(name, trustedGesture, true); });
      unlockGestureCleanup = null;
    }
    function trustedGesture() { return unlock(); }
    unlockGestureCleanup = cleanup;
    events.forEach(function (name) { document.addEventListener(name, trustedGesture, true); });
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

  function clampGain(value) {
    return Math.max(0, Number(value) || 0);
  }

  function oneShotPolicy(type, keyOrPath) {
    var definition = window.AudioDatabase && AudioDatabase.assets && AudioDatabase.assets[keyOrPath];
    var category = definition && definition.category ? definition.category : (type === "se" ? "SE" : "VOICE");
    var policy = window.AudioMixProfile && AudioMixProfile.oneShots && AudioMixProfile.oneShots[category] || {};
    return { category: category, duckable: policy.duckable === true, dialogueRatio: Number(policy.dialogueRatio) };
  }

  function motifDialogueMultiplier() {
    var dialogueMultiplier = audioState.duckState.dialogue.multiplier;
    var policy = window.AudioMixProfile && AudioMixProfile.oneShots && AudioMixProfile.oneShots.MOTIF || {};
    var motifTarget = Number(policy.dialogueRatio);
    if (!Number.isFinite(motifTarget)) return dialogueMultiplier;
    var dialogueTarget = Number(dialogueDuckProfile().ratio);
    if (!Number.isFinite(dialogueTarget)) dialogueTarget = 0.18;
    if (dialogueTarget >= 1) return dialogueMultiplier;
    var progress = Math.max(0, Math.min(1, (1 - dialogueMultiplier) / (1 - dialogueTarget)));
    return 1 - ((1 - motifTarget) * progress);
  }

  function updateBusPolicy() {
    if (canonicalBuses) {
      setGainValue(canonicalBuses.bgm, policyMultiplier() * groupGain("BGM"));
      setGainValue(canonicalBuses.motif, motifDialogueMultiplier() * groupGain("MOTIF"));
    }
    bgmTracks.forEach(function (track) {
      var effective = clampGain(track.baseVolume * track.envelope * policyMultiplier() * groupGain("BGM"));
      if (track.audio === bgm) {
        audioState.currentBgmAsset = track.asset;
        audioState.baseBgmVolume = track.baseVolume;
        audioState.effectiveBgmVolume = effective;
        audioState.fadeState = track.fadeState;
      }
      audioTrace("BGM_EFFECTIVE_GAIN", { asset: track.asset, gain: effective, path: track.path });
    });
    audioTrace("MOTIF_EFFECTIVE_GAIN", { gain: motifDialogueMultiplier() * groupGain("MOTIF") });
  }

  function applyBgmTrackGain(track) {
    if (!track) return;
    var assetGain = clampGain(track.baseVolume * track.envelope);
    setGainValue(track.gainNode, assetGain);
    updateBusPolicy();
    audioTrace("BGM_BASE_GAIN", { asset: track.asset, gain: assetGain, path: track.path });
  }

  function animatePolicy(kind, target, durationMs) {
    var state = audioState.duckState[kind];
    var serial = ++state.serial;
    var from = state.multiplier;
    var duration = Math.max(0, Number(durationMs) || 0);
    var startedAt = Date.now();
    if (!duration) {
      state.multiplier = target;
      updateBusPolicy();
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      function tick() {
        if (serial !== state.serial) return resolve();
        var progress = Math.min(1, (Date.now() - startedAt) / duration);
        state.multiplier = from + ((target - from) * progress);
        updateBusPolicy();
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
      audioTrace("DIALOGUE_DUCK_ENTER", { ratio: profile.ratio === undefined ? 0.18 : Number(profile.ratio) });
      animatePolicy("dialogue", profile.ratio === undefined ? 0.18 : Number(profile.ratio),
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
    audioTrace("DIALOGUE_DUCK_EXIT", { restore: 1 });
    return animatePolicy("dialogue", 1, profile.restoreMs === undefined ? 280 : profile.restoreMs);
  }

  function safePlay(audio) {
    var playback;
    try {
      if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-call", audio.__eigoRadioTrace);
      var result = audio.play();
      playback = result && typeof result.then === "function" ? Promise.resolve(result).then(function () {
        if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-resolved", audio.__eigoRadioTrace);
        return { ok: true, error: null };
      }, function (error) {
        if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-rejected", audio.__eigoRadioTrace, { error: String(error) });
        console.warn("Audio playback was blocked or failed:", error);
        return { ok: false, error: error };
      }) : Promise.resolve({ ok: true, error: null });
    } catch (error) {
      console.warn("Audio playback was blocked or failed:", error);
      playback = Promise.resolve({ ok: false, error: error });
    }
    audio.__eigoPlaybackOutcome = playback;
    return audio;
  }

  function disconnectNodes(nodes) {
    (nodes || []).forEach(function (node) { try { node.disconnect(); } catch (_) {} });
  }

  function stop(audio) {
    if (!audio) return;
    audio.__eigoStopped = true;
    if (audio.__eigoRadioTrace) voiceTrace("radio-stop", audio.__eigoRadioTrace);
    if (typeof audio.__eigoDialogueComplete === "function") audio.__eigoDialogueComplete("stopped");
    if (audio.__eigoBgmTrack) {
      var track = audio.__eigoBgmTrack;
      track.serial += 1;
      track.fadeState = "stopped";
      var trackIndex = bgmTracks.indexOf(track);
      if (trackIndex !== -1) bgmTracks.splice(trackIndex, 1);
      disconnectNodes(track.nodes);
    }
    if (typeof audio.__eigoDisconnect === "function") audio.__eigoDisconnect();
    try { audio.pause(); } catch (_) {}
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
      applyBgmTrackGain(track);
      if (onComplete) onComplete();
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      function tick() {
        if (token !== track.serial) return resolve();
        var progress = Math.min(1, (Date.now() - startedAt) / duration);
        track[property] = from + ((to - from) * progress);
        applyBgmTrackGain(track);
        if (progress >= 1) {
          track.fadeState = "idle";
          applyBgmTrackGain(track);
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
      baseVolume: clampGain(baseVolume),
      envelope: envelope === undefined ? 1 : envelope,
      fadeState: "idle",
      serial: 0,
      gainNode: null,
      nodes: [],
      path: "pending"
    };
    audio.__eigoBgmTrack = track;
    audio.volume = 1;
    bgmTracks.push(track);
    return track;
  }

  function buildSimpleGraph(audio, busName, assetGain) {
    var context = getCanonicalAudioContext();
    var buses = createCanonicalBuses(context);
    if (!context || !buses || !buses[busName]) throw new Error("canonical-bus-unavailable");
    var gainNode = context.createGain();
    setGainValue(gainNode, assetGain);
    gainNode.connect(buses[busName]);
    var source = context.createMediaElementSource(audio);
    try { source.connect(gainNode); } catch (error) {
      disconnectNodes([source, gainNode]);
      error.__eigoSourceAttempted = true;
      throw error;
    }
    return { source: source, gainNode: gainNode, nodes: [source, gainNode] };
  }

  function connectBgmTrack(track, requestId) {
    if (!track || requestId !== bgmRequestSerial || track.audio !== bgm) return;
    var original = track.audio;
    function fallback(reason, error, sourceAttempted) {
      if (requestId !== bgmRequestSerial || track.audio !== bgm) return;
      if (sourceAttempted) {
        try { original.pause(); } catch (_) {}
        var replacement = new Audio(original.getAttribute("src") || original.src);
        replacement.loop = original.loop;
        replacement.preload = "auto";
        replacement.volume = 1;
        replacement.__eigoBgmTrack = track;
        track.audio = replacement;
        bgm = replacement;
      }
      track.path = "fallback";
      audioTrace("BGM_PATH", { asset: track.asset, path: "fallback", reason: reason });
      audioTrace("GAINNODE_FALLBACK", { category: "BGM", asset: track.asset, reason: reason, error: error ? String(error) : null });
      safePlay(track.audio);
      watchBgmPlayback(track.audio, requestId);
    }
    function connectAndPlay() {
      var graph = buildSimpleGraph(original, "bgm", track.baseVolume * track.envelope);
      track.gainNode = graph.gainNode;
      track.nodes = graph.nodes;
      track.path = "web-audio";
      audioTrace("BGM_PATH", { asset: track.asset, path: "web-audio" });
      applyBgmTrackGain(track);
      safePlay(original);
      watchBgmPlayback(original, requestId);
    }
    if (!audioContextType()) {
      fallback("audio-context-unavailable");
      return;
    }
    var immediateContext = getCanonicalAudioContext();
    if (immediateContext && (immediateContext.state === undefined || immediateContext.state === "running")) {
      try {
        createCanonicalBuses(immediateContext);
        connectAndPlay();
      } catch (error) {
        fallback("graph-construction-failed", error, error && error.__eigoSourceAttempted === true);
      }
      return;
    }
    ensureCanonicalAudioContextRunning().then(function (running) {
      if (requestId !== bgmRequestSerial || track.audio !== bgm) return;
      if (!running) return fallback("context-not-running");
      try { connectAndPlay(); } catch (error) {
        fallback("graph-construction-failed", error, error && error.__eigoSourceAttempted === true);
      }
    }).catch(function (error) { fallback("context-resume-failed", error); });
  }

  function resetHeldSpeechPolicy() {
    speechDucking = null;
    if (!audioState.speechMode.active) {
      audioState.speechMode.held = false;
      audioState.duckState.speech.serial += 1;
      audioState.duckState.speech.multiplier = 1;
      updateBusPolicy();
    }
  }

  function clearPendingBgm() {
    pendingBgm = null;
    if (pendingBgmGestureCleanup) pendingBgmGestureCleanup();
  }

  function installPendingBgmRetryGesture() {
    if (pendingBgmGestureCleanup || !window.document || typeof document.addEventListener !== "function") return;
    var events = ["pointerdown", "touchend", "click", "keydown"];
    function cleanup() {
      events.forEach(function (name) { document.removeEventListener(name, retry, true); });
      pendingBgmGestureCleanup = null;
    }
    function retry() { retryPendingBgm(); }
    pendingBgmGestureCleanup = cleanup;
    events.forEach(function (name) { document.addEventListener(name, retry, true); });
  }

  function watchBgmPlayback(audio, requestId) {
    Promise.resolve(audio && audio.__eigoPlaybackOutcome).then(function (outcome) {
      if (!audio || requestId !== bgmRequestSerial || audio !== bgm) return;
      if (outcome && outcome.ok === false) {
        pendingBgm = { audio: audio, requestId: requestId };
        installPendingBgmRetryGesture();
      } else if (pendingBgm && pendingBgm.audio === audio) clearPendingBgm();
    });
  }

  function retryPendingBgm() {
    var pending = pendingBgm;
    if (!pending || pending.requestId !== bgmRequestSerial || pending.audio !== bgm) {
      clearPendingBgm();
      return false;
    }
    safePlay(pending.audio);
    watchBgmPlayback(pending.audio, pending.requestId);
    return true;
  }

  function playBgm(keyOrPath, options) {
    options = options || {};
    resetHeldSpeechPolicy();
    clearPendingBgm();
    var path = resolve("bgm", keyOrPath);
    var targetVolume = (options.volume === undefined ? 1 : options.volume) * mixAssetGain(keyOrPath);
    if (bgm && bgm.src && bgm.getAttribute("src") === path) {
      var existingTrack = bgm.__eigoBgmTrack || createBgmTrack(bgm, keyOrPath, targetVolume, 1);
      if (options.fadeInMs) animateTrack(existingTrack, "baseVolume", targetVolume, options.fadeInMs, "base-volume");
      else { existingTrack.baseVolume = targetVolume; existingTrack.envelope = 1; applyBgmTrackGain(existingTrack); }
      return bgm;
    }
    var requestId = ++bgmRequestSerial;
    var previous = bgm;
    var next = new Audio(path);
    next.loop = options.loop !== false;
    next.preload = "auto";
    var nextTrack = createBgmTrack(next, keyOrPath, targetVolume, options.fadeInMs || options.crossfadeMs ? 0 : 1);
    bgm = next;
    connectBgmTrack(nextTrack, requestId);
    if (previous) {
      var previousTrack = previous.__eigoBgmTrack;
      if (options.crossfadeMs && previousTrack) {
        animateTrack(previousTrack, "envelope", 0, options.crossfadeMs, "crossfade-out", function () { stop(previousTrack.audio); });
      } else stop(previousTrack ? previousTrack.audio : previous);
    }
    if (options.fadeInMs || options.crossfadeMs) {
      animateTrack(nextTrack, "envelope", 1, options.fadeInMs || options.crossfadeMs,
        options.crossfadeMs ? "crossfade-in" : "fade-in");
    }
    if (options.fadeToVolume !== undefined) {
      animateTrack(nextTrack, "baseVolume", options.fadeToVolume * mixAssetGain(keyOrPath), options.fadeToMs || 0, "base-volume");
    }
    return next;
  }

  function stopBgm() {
    var options = arguments[0] || {};
    resetHeldSpeechPolicy();
    clearPendingBgm();
    bgmRequestSerial += 1;
    var current = bgm;
    bgm = null;
    if (!current) return Promise.resolve();
    var currentTrack = current.__eigoBgmTrack;
    if (options.fadeOutMs && currentTrack) {
      return animateTrack(currentTrack, "envelope", 0, options.fadeOutMs, "fade-out", function () { stop(currentTrack.audio); });
    }
    stop(currentTrack ? currentTrack.audio : current);
    return Promise.resolve();
  }

  function isZephyrMotif(type, keyOrPath, path) {
    if (type !== "se") return false;
    var assets = window.AudioDatabase && AudioDatabase.assets;
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
      var active = collection.find(function (item) { return item.getAttribute("src") === path && !item.paused; });
      if (active) return active;
    }
    var audio = new Audio(path);
    audio.__eigoStopped = false;
    var policy = oneShotPolicy(type, keyOrPath);
    var baseGain = clampGain((options.volume === undefined ? 1 : options.volume) * mixAssetGain(keyOrPath));
    var busName = policy.category === "MOTIF" ? "motif" : (type === "se" ? "se" : "effectVoice");
    audio.volume = 1;
    audio.preload = "auto";
    collection.push(audio);
    audio.addEventListener("ended", function () {
      var index = collection.indexOf(audio);
      if (index !== -1) collection.splice(index, 1);
      if (typeof audio.__eigoDisconnect === "function") audio.__eigoDisconnect();
    }, { once: true });
    function fallback(error) {
      if (audio.__eigoStopped) return;
      audio.__eigoAudioPath = "fallback";
      audioTrace("GAINNODE_FALLBACK", { category: policy.category, asset: keyOrPath, reason: String(error) });
      safePlay(audio);
    }
    function connectAndPlay() {
      if (audio.__eigoStopped) return;
      var graph = buildSimpleGraph(audio, busName, baseGain);
      audio.__eigoGainNode = graph.gainNode;
      audio.__eigoAudioPath = "web-audio";
      audio.__eigoDisconnect = function () { disconnectNodes(graph.nodes); audio.__eigoDisconnect = null; };
      safePlay(audio);
    }
    if (!audioContextType()) {
      fallback(new Error("audio-context-unavailable"));
      return audio;
    }
    var immediateContext = getCanonicalAudioContext();
    if (immediateContext && (immediateContext.state === undefined || immediateContext.state === "running")) {
      try { createCanonicalBuses(immediateContext); connectAndPlay(); }
      catch (error) { fallback(error); }
      return audio;
    }
    ensureCanonicalAudioContextRunning().then(function (running) {
      if (audio.__eigoStopped) return;
      if (!running) throw new Error("context-not-running");
      connectAndPlay();
    }).catch(fallback);
    return audio;
  }

  function playSe(keyOrPath, options) { return playOneShot("se", keyOrPath, options, effects); }
  function playVoice(keyOrPath, options) { return playOneShot("voice", keyOrPath, options, voices); }

  function characterCodeForVoiceKey(keyOrPath) {
    var match = /^voice_(c\d{2})_/i.exec(String(keyOrPath || ""));
    return match ? match[1].toLowerCase() : null;
  }

  function playDialogueVoice(keyOrPath, options) {
    options = options || {};
    var radio = options.voiceEffect === "radio";
    var characterCode = characterCodeForVoiceKey(keyOrPath);
    var kong = !radio && characterCode === "c02";
    var bernie = !radio && characterCode === "c04";
    var voicePath = resolve("voice", keyOrPath);
    var traceDetail = radio ? { traceId: ++radioTraceSerial, voiceKey: keyOrPath, voiceEffect: options.voiceEffect } : null;
    if (radio) voiceTrace("radio-play-request", traceDetail);
    else voiceTrace("normal-voice-play-call", { voiceKey: keyOrPath });
    var audio = new Audio(voicePath);
    var settled = false;
    var processingNodes = [];
    var resolveCompletion;
    var completion = new Promise(function (resolveCompletionPromise) { resolveCompletion = resolveCompletionPromise; });
    var tracked = { audio: audio, completion: completion };
    var voiceModeOwner = enterDialogueVoiceMode();
    var characterGainValue = options.characterGain === undefined ?
      (options.volume === undefined ? 1 : Number(options.volume)) : Number(options.characterGain);
    if (!Number.isFinite(characterGainValue)) characterGainValue = 1;

    function removeFrom(collection, item) {
      var index = collection.indexOf(item);
      if (index !== -1) collection.splice(index, 1);
    }

    function disposeProcessing() {
      disconnectNodes(processingNodes);
      processingNodes = [];
    }

    function complete(status, error) {
      if (settled) return;
      settled = true;
      disposeProcessing();
      removeFrom(dialogueVoices, audio);
      removeFrom(voices, audio);
      exitDialogueVoiceMode(voiceModeOwner);
      resolveCompletion({ status: status, error: error && error.message ? error.message : null });
    }

    function attachDialogueAudio(candidate) {
      candidate.volume = 1;
      candidate.preload = "auto";
      if (radio) {
        candidate.__eigoRadioTrace = traceDetail;
        voiceTrace("radio-audio-created", traceDetail, { src: candidate.src });
      }
      if (voices.indexOf(candidate) === -1) voices.push(candidate);
      if (dialogueVoices.indexOf(candidate) === -1) dialogueVoices.push(candidate);
      candidate.__eigoDialogueComplete = complete;
      candidate.addEventListener("playing", function () {
        if (radio) voiceTrace("radio-audio-event-playing", traceDetail);
        else voiceTrace("normal-voice-playing", { voiceKey: keyOrPath });
      });
      candidate.addEventListener("ended", function () {
        if (candidate !== audio) return;
        if (radio) voiceTrace("radio-audio-event-ended", traceDetail);
        complete("ended");
      }, { once: true });
      candidate.addEventListener("error", function () { if (candidate === audio) complete("failed", new Error("audio-error")); }, { once: true });
      candidate.addEventListener("abort", function () { if (candidate === audio) complete("failed", new Error("audio-abort")); }, { once: true });
    }

    attachDialogueAudio(audio);

    function useFreshHtmlAudioFallback(reason, error) {
      if (settled) return false;
      var replaced = audio;
      disposeProcessing();
      removeFrom(dialogueVoices, replaced);
      removeFrom(voices, replaced);
      replaced.__eigoDialogueComplete = null;
      try { replaced.pause(); } catch (_) {}
      audio = new Audio(voicePath);
      tracked.audio = audio;
      attachDialogueAudio(audio);
      audio.__eigoAudioPath = "fallback";
      audioTrace("GAINNODE_FALLBACK", { category: "VOICE", voiceKey: keyOrPath, reason: reason, error: error ? String(error) : null });
      if (radio) voiceTrace("radio-fallback-enter", traceDetail, { reason: reason, error: error ? String(error) : null, freshAudioElement: true });
      return true;
    }

    function startPlayback() {
      if (settled) return;
      var startedAudio = audio;
      safePlay(startedAudio);
      Promise.resolve(startedAudio.__eigoPlaybackOutcome).then(function (outcome) {
        if (startedAudio === audio && outcome && outcome.ok === false) complete("failed", outcome.error);
      });
    }

    function buildVoiceGraph(context) {
      var buses = createCanonicalBuses(context);
      if (!buses) throw new Error("voice-bus-unavailable");
      var characterGain = context.createGain();
      setGainValue(characterGain, characterGainValue);
      var routeStart = characterGain;
      var routeEnd = characterGain;
      var nodes = [characterGain];
      if (radio) {
        var highPass = context.createBiquadFilter(); highPass.type = "highpass"; highPass.frequency.value = 700;
        var lowPass = context.createBiquadFilter(); lowPass.type = "lowpass"; lowPass.frequency.value = 2000;
        var presence = context.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 1700; presence.Q.value = 1.0;
        var radioProfile = window.AudioMixProfile && AudioMixProfile.radioProcessing || {};
        presence.gain.value = radioProfile.presenceGainDb === undefined ? 4 : Number(radioProfile.presenceGainDb);
        var compressor = context.createDynamicsCompressor(); compressor.threshold.value = -18; compressor.ratio.value = 10; compressor.attack.value = 0.008; compressor.release.value = 0.15;
        var saturation = context.createWaveShaper();
        var curve = new Float32Array(2048); var drive = 2.8; var normalization = Math.tanh(drive);
        for (var sample = 0; sample < curve.length; sample += 1) {
          var input = (sample * 2 / (curve.length - 1)) - 1;
          curve[sample] = 0.9 * Math.tanh(drive * input) / normalization;
        }
        saturation.curve = curve; saturation.oversample = "2x";
        var radioOutput = context.createGain();
        setGainValue(radioOutput, radioProfile.outputGain === undefined ? 0.72 : Number(radioProfile.outputGain));
        characterGain.connect(highPass); highPass.connect(lowPass); lowPass.connect(presence); presence.connect(compressor); compressor.connect(saturation); saturation.connect(radioOutput);
        routeEnd = radioOutput;
        nodes = nodes.concat([highPass, lowPass, presence, compressor, saturation, radioOutput]);
      } else if (kong) {
        var kongGain = context.createGain();
        var processing = window.AudioMixProfile && AudioMixProfile.characterProcessing && AudioMixProfile.characterProcessing.c02 || {};
        setGainValue(kongGain, processing.webAudioGain === undefined ? 1 : Number(processing.webAudioGain));
        var limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
        characterGain.connect(kongGain); kongGain.connect(limiter);
        routeEnd = limiter;
        nodes = nodes.concat([kongGain, limiter]);
      } else if (bernie) {
        var lowMid = context.createBiquadFilter(); lowMid.type = "peaking"; lowMid.frequency.value = 320; lowMid.Q.value = 0.9; lowMid.gain.value = -2.5;
        var berniePresence = context.createBiquadFilter(); berniePresence.type = "peaking"; berniePresence.frequency.value = 3200; berniePresence.Q.value = 1.0; berniePresence.gain.value = 2.0;
        characterGain.connect(lowMid); lowMid.connect(berniePresence);
        routeEnd = berniePresence;
        nodes = nodes.concat([lowMid, berniePresence]);
      }
      routeEnd.connect(buses.voice);
      var source = context.createMediaElementSource(audio);
      if (radio) voiceTrace("radio-source-created", traceDetail, { contextState: context.state });
      try { source.connect(routeStart); } catch (error) {
        disconnectNodes([source].concat(nodes));
        error.__eigoSourceAttempted = true;
        throw error;
      }
      processingNodes = [source].concat(nodes);
      audio.__eigoAudioPath = "web-audio";
      audio.__eigoCharacterGainNode = characterGain;
      audioTrace("VOICE_PATH", { voiceKey: keyOrPath, path: "web-audio", characterCode: characterCode, radio: radio });
      audioTrace("VOICE_CHARACTER_GAIN", { voiceKey: keyOrPath, gain: characterGainValue });
      audioTrace("VOICE_BUS_GAIN", { gain: canonicalBuses.voice.gain.value });
      if (radio) voiceTrace("radio-graph-connected", traceDetail, { route: "filtered", contextState: context.state });
    }

    if (!audioContextType()) {
      audio.__eigoAudioPath = "fallback";
      audioTrace("GAINNODE_FALLBACK", { category: "VOICE", voiceKey: keyOrPath, reason: "audio-context-unavailable" });
      if (radio) voiceTrace("radio-fallback-enter", traceDetail, { reason: "audio-context-unavailable" });
      startPlayback();
      return tracked;
    }
    var immediateContext = getCanonicalAudioContext();
    if (radio) {
      voiceTrace("radio-context-created", traceDetail, { contextState: immediateContext && immediateContext.state });
      voiceTrace("radio-resume-before", traceDetail, { contextState: immediateContext && immediateContext.state });
    }
    if (immediateContext && (immediateContext.state === undefined || immediateContext.state === "running")) {
      if (radio) voiceTrace("radio-resume-resolved", traceDetail, { contextState: immediateContext.state });
      try { createCanonicalBuses(immediateContext); buildVoiceGraph(immediateContext); }
      catch (error) { useFreshHtmlAudioFallback("graph-construction-failed", error); }
      startPlayback();
      return tracked;
    }
    ensureCanonicalAudioContextRunning().then(function (running) {
      if (radio) voiceTrace("radio-resume-resolved", traceDetail, { contextState: immediateContext && immediateContext.state });
      if (settled) return;
      if (!running) {
        useFreshHtmlAudioFallback("context-not-running");
        return startPlayback();
      }
      try { buildVoiceGraph(getCanonicalAudioContext()); }
      catch (error) { useFreshHtmlAudioFallback("graph-construction-failed", error); }
      startPlayback();
    }).catch(function (error) {
      useFreshHtmlAudioFallback("context-resume-failed", error);
      startPlayback();
    });
    return tracked;
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
    if (window.DialogueVoiceController && typeof DialogueVoiceController.onAudioStopAll === "function") DialogueVoiceController.onAudioStopAll();
    speechDucking = null;
    audioState.speechMode.active = false;
    audioState.speechMode.preserveBgm = false;
    audioState.speechMode.held = false;
    audioState.duckState.speech.serial += 1;
    audioState.duckState.speech.multiplier = 1;
    updateBusPolicy();
  }

  function stopOneShots() {
    voices.concat(effects).forEach(stop);
    voices = [];
    effects = [];
    dialogueVoices = [];
    if (window.DialogueVoiceController && typeof DialogueVoiceController.onAudioStopAll === "function") DialogueVoiceController.onAudioStopAll();
  }

  function armSpeechDucking(options) {
    options = options || {};
    if (speechDucking && speechDucking.active) return;
    speechDucking = { armed: true, active: false, restore: options.restore !== false };
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
      updateBusPolicy();
      await stopBgm(options.stopOptions);
      return true;
    }
    var profile = speechDuckProfile();
    await animatePolicy("speech", profile.ratio === undefined ? 0.25 : Number(profile.ratio), profile.duckMs === undefined ? 300 : profile.duckMs);
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

  function getAudioState() {
    return {
      runtimeVersion: RUNTIME_VERSION,
      currentBgmAsset: audioState.currentBgmAsset,
      bgmPath: bgm && bgm.__eigoBgmTrack ? bgm.__eigoBgmTrack.path : null,
      baseBgmVolume: audioState.baseBgmVolume,
      effectiveBgmVolume: audioState.effectiveBgmVolume,
      fadeState: audioState.fadeState,
      duckState: {
        dialogueMultiplier: audioState.duckState.dialogue.multiplier,
        dialogueOwners: audioState.duckState.dialogue.owners,
        speechMultiplier: audioState.duckState.speech.multiplier
      },
      speechMode: Object.assign({}, audioState.speechMode),
      voicePlaying: audioState.voicePlaying,
      audioContextState: canonicalAudioContext ? canonicalAudioContext.state : "uninitialized",
      unlockComplete: unlockComplete,
      pendingBgm: !!pendingBgm,
      busGains: canonicalBuses ? {
        master: canonicalBuses.master.gain.value,
        bgm: canonicalBuses.bgm.gain.value,
        motif: canonicalBuses.motif.gain.value,
        voice: canonicalBuses.voice.gain.value,
        se: canonicalBuses.se.gain.value,
        effectVoice: canonicalBuses.effectVoice.gain.value
      } : null
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
    isArmed: function () { return !!(speechDucking && speechDucking.armed); }
  };
  window.DialogueVoiceAudioInternal = {
    play: playDialogueVoice,
    stop: stopDialogueVoices,
    isPlaying: function () { return dialogueVoices.length > 0; }
  };
  installUnlockGesture();
})();
