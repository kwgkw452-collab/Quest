(function () {
  "use strict";

  var RUNTIME_VERSION = "audio-gainnode-unification-v1";
  var TRACE_VERSION = "iphone-audio-lifecycle-trace-v1";
  var SPEECH_TRACE_VERSION = "iphone-speech-teardown-order-trace-v2";
  var RECOVERY_VERSION = "audio-context-interrupted-recovery-fix-v1";
  var SIGNAL_TRACE_VERSION = "running-but-silent-signal-trace-v1";
  var CENTRAL_RECOVERY_VERSION = "central-audio-recovery-v1";
  var INITIAL_AUDIO_UNLOCK_TRACE_VERSION = "iphone-safari-initial-audio-unlock-trace-v1";
  var RELOAD_AUDIO_IDENTITY_TRACE_VERSION = "iphone-reload-audio-identity-trace-v1";
  var LOUD_AUDIO_GRAPH_IDENTITY_TRACE_VERSION = "iphone-safari-loud-audio-graph-identity-trace-v2";
  var SPEECH_RESULT_AUDIO_ROUTE_TRACE_VERSION = "iphone-safari-speech-result-audio-route-trace-v1";
  var AUDIO_FINAL_ISOLATION_DIAGNOSTIC_VERSION = "iphone-safari-audio-final-isolation-diagnostic-v1";
  var SOURCE_LOST_FATAL_MS = 1500;
  var SOURCE_LOST_MIN_MEDIA_ADVANCE = 0.5;
  var RECOVERY_COOLDOWN_BASE_MS = 5000;
  var RECOVERY_COOLDOWN_MAX_MS = 30000;
  window.AudioRuntimeVersion = RUNTIME_VERSION;

  var bgm = null;
  var voices = [];
  var dialogueVoices = [];
  var effects = [];
  var speechDucking = null;
  // Phase 1 isolation is opt-in through the no-options API. Existing Speech
  // callers retain their option-based duck/stop policy until Phase 2 wiring.
  var speechIsolation = { state: "idle", snapshot: null };
  var speechIsolationQueue = Promise.resolve();
  var centralRecoveryPromise = null;
  var radioTraceSerial = 0;
  var canonicalAudioContext = null;
  var canonicalBuses = null;
  var canonicalSignalAnalysers = null;
  var lastDialogueVoiceTraceAudio = null;
  var lastDialogueVoiceTraceMeta = null;
  var signalMeterState = {
    master: { signalSeen: false, lastSignalTime: null },
    bgmSource: { signalSeen: false, lastSignalTime: null },
    bgmBus: { signalSeen: false, lastSignalTime: null },
    voiceSource: { signalSeen: false, lastSignalTime: null },
    voiceBus: { signalSeen: false, lastSignalTime: null }
  };
  var unlockPromise = null;
  var unlockComplete = false;
  var unlockGestureCleanup = null;
  var audioOutputRecoveryRequired = false;
  var pendingBgmGestureCleanup = null;
  var pendingBgm = null;
  var bgmRequestSerial = 0;
  var bgmTracks = [];
  var voiceTraceSerial = 0;
  var audioContextTraceSerial = 0;
  var audioInstanceTraceSerial = 0;
  var audioLiveTraceTimer = null;
  var audioLiveTraceLastStart = null;
  var centralRecoveryState = {
    state: "healthy",
    attempt: 0,
    reason: null,
    lastResult: "none",
    lastAt: null,
    cooldownUntil: 0,
    candidateKey: null,
    candidateSince: null,
    candidateStartMediaTime: null,
    candidateLastMediaTime: null,
    candidateLastProgressAt: null,
    pendingBgmSnapshot: null,
    expectedRequestSerial: null,
    timer: null,
    rebuilding: false
  };
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

  function runtimeTracePanelEnabled() {
    try {
      var query = new URLSearchParams(window.location.search || "");
      return query.get("audioTrace") === "1" || query.get("gainNodeTrace") === "1" ||
        query.get("speechRestoreDiagnostic") === "delay1500";
    } catch (_) { return false; }
  }

  var voiceRuntimeTraceState = {
    panelEnabled: runtimeTracePanelEnabled(),
    latest: null,
    latched: null,
    history: []
  };

  var audioLifecycleTraceState = {
    resumeCalls: 0,
    resumeSuccess: 0,
    resumeReject: 0,
    lastResumeAt: null,
    lastResumeResult: "none",
    stateChangeCount: 0,
    suspendSeen: false,
    recoveryRequired: false,
    lastContextState: "uninitialized",
    lastGestureType: "none",
    lastGestureAt: null,
    lastGestureContextState: "uninitialized",
    lastGestureResumeCalled: false,
    lastGestureResumeResult: "none",
    events: []
  };

  var SPEECH_ORDER_STORAGE_LIMIT = 48;
  var SPEECH_ORDER_DISPLAY_LIMIT = 30;
  var SPEECH_ORDER_EVENT_TYPES = {
    "speech-listen-enter": true,
    "speech-mode-enter-start": true,
    "speech-mode-active": true,
    "recognition-start-call": true,
    "recognition-onstart": true,
    "recognition-result": true,
    "hello-early-commit": true,
    "release-speech-audio-start": true,
    "recognition-stop-call": true,
    "recognition-onerror": true,
    "recognition-onend": true,
    "adapter-resolve": true,
    "adapter-reject": true,
    "speech-listen-finally": true,
    "exit-speech-mode-start": true,
    "audio-context-before-resume": true,
    "audio-context-resume-call": true,
    "audio-context-resume-resolved": true,
    "audio-context-resume-rejected": true,
    "context-statechange": true,
    "speech-mode-idle": true,
    "bgm-restore-start": true,
    "bgm-play-call": true,
    "bgm-play-resolved": true,
    "bgm-play-rejected": true,
    "bgm-playing-event": true
  };
  var SPEECH_ORDER_EVENT_LABELS = {
    "speech-listen-enter": "listen-enter",
    "speech-mode-enter-start": "mode-enter",
    "speech-mode-active": "mode-active",
    "recognition-start-call": "rec-start",
    "recognition-onstart": "rec-onstart",
    "recognition-result": "rec-result",
    "hello-early-commit": "early-commit",
    "release-speech-audio-start": "release-start",
    "recognition-stop-call": "rec-stop",
    "recognition-onerror": "rec-error",
    "recognition-onend": "rec-onend",
    "adapter-resolve": "adapter-ok",
    "adapter-reject": "adapter-error",
    "speech-listen-finally": "listen-finally",
    "exit-speech-mode-start": "exit-start",
    "audio-context-before-resume": "ctx-before-resume",
    "audio-context-resume-call": "ctx-resume",
    "audio-context-resume-resolved": "ctx-resumed",
    "audio-context-resume-rejected": "ctx-resume-error",
    "context-statechange": "ctx-statechange",
    "speech-mode-idle": "mode-idle",
    "bgm-restore-start": "bgm-restore",
    "bgm-play-call": "bgm-play",
    "bgm-play-resolved": "bgm-play-ok",
    "bgm-play-rejected": "bgm-play-error",
    "bgm-playing-event": "bgm-playing"
  };
  var speechOrderTraceState = {
    events: [],
    resultSeen: { interim: false, final: false }
  };
  var AUDIO_RESTORE_TIMING_TRACE_VERSION = "iphone-speech-audio-restore-timing-ab-v1";
  var AUDIO_RESTORE_TIMING_TRACE_LIMIT = 64;
  var AUDIO_RESTORE_TIMING_EVENT_TYPES = {
    "recognition-onend": true,
    "adapter-settled": true,
    "speech-finally": true,
    "audio-release-request": true,
    "restore-delay-start": true,
    "restore-delay-end": true,
    "exitSpeechMode-start": true,
    "ctx-before-restore": true,
    "bgm-restore-start": true,
    "bgm-play-call": true,
    "bgm-playing": true,
    "bgm-play-resolved": true
  };
  var audioRestoreTimingTraceState = {
    events: [],
    recognitionOnendAt: null
  };
  var INITIAL_AUDIO_UNLOCK_TRACE_LIMIT = 64;
  var initialAudioUnlockTraceState = {
    events: [],
    firstTrustedPointerdownSeen: false,
    firstTrustedPointerdownActive: false,
    picoSe: null,
    zephyr: null
  };
  var RELOAD_AUDIO_IDENTITY_TRACE_LIMIT = 96;
  var reloadAudioIdentityTraceState = {
    events: [],
    maps: null,
    counters: { context: 0, element: 0, source: 0, gain: 0, node: 0, graph: 0 },
    graphs: [],
    pageLoadId: null
  };
  var SPEECH_RESULT_AUDIO_ROUTE_TRACE_LIMIT = 128;
  var speechResultAudioRouteTraceState = {
    events: [],
    audioSessionListenerInstalled: false,
    lastAudioSessionState: null
  };
  var AUDIO_FINAL_DIAGNOSTIC_EVENT_LIMIT = 256;
  var audioFinalDiagnosticState = {
    runId: "RUN#" + Date.now().toString(36),
    mediaElementSourceCreates: 0,
    gainCreates: 0,
    connectCalls: 0,
    disconnectCalls: 0,
    interruptedCount: 0,
    resumePendingMaxMs: 0,
    resumeSerial: 0,
    pendingResumes: Object.create(null),
    duplicateConnectPairs: Object.create(null),
    sourceCreatesByElementRole: Object.create(null),
    appDuplicateCreationSeen: false,
    maxSourceCount: 0,
    maxNodeCount: 0,
    activeSeRequests: 0,
    lastMonsterSe: null,
    events: []
  };

  function speechRestoreDiagnosticMode() {
    try {
      var query = new URLSearchParams(window.location.search || "");
      return query.get("speechRestoreDiagnostic") === "delay1500" ? "B" : "A";
    } catch (_) { return "A"; }
  }

  function speechRestoreDiagnosticDelayMs() {
    return speechRestoreDiagnosticMode() === "B" ? 1500 : 0;
  }

  function audioRestoreTimingTraceEnabled() {
    return voiceRuntimeTraceState.panelEnabled || speechRestoreDiagnosticMode() === "B";
  }

  function audioRestoreTimingBgmSnapshot() {
    var live = liveAudioSnapshot();
    var current = live && live.bgm;
    return current ? {
      asset: current.asset || null,
      src: current.src || null,
      trackGain: current.trackGain,
      busGain: current.busGain,
      effectiveGain: current.effectiveGain,
      masterGain: current.masterGain,
      graph: current.path === "web-audio",
      fallback: current.fallback === true
    } : {
      asset: null,
      src: null,
      trackGain: null,
      busGain: canonicalBuses ? finiteTraceNumber(canonicalBuses.bgm.gain.value) : null,
      effectiveGain: null,
      masterGain: canonicalBuses ? finiteTraceNumber(canonicalBuses.master.gain.value) : null,
      graph: false,
      fallback: false
    };
  }

  function recordAudioRestoreTimingEvent(type, detail) {
    if (!audioRestoreTimingTraceEnabled() || !AUDIO_RESTORE_TIMING_EVENT_TYPES[type]) return;
    var at = Date.now();
    if (type === "recognition-onend") audioRestoreTimingTraceState.recognitionOnendAt = at;
    var context = contextLifecycleSnapshot();
    var session = audioSessionTraceSnapshot();
    var bgmState = audioRestoreTimingBgmSnapshot();
    var record = Object.assign({
      type: type,
      at: at,
      diagnosticMode: speechRestoreDiagnosticMode(),
      delayMs: speechRestoreDiagnosticDelayMs(),
      elapsedFromOnend: audioRestoreTimingTraceState.recognitionOnendAt === null ? null :
        at - audioRestoreTimingTraceState.recognitionOnendAt,
      audioContextState: context.state,
      audioSession: session.label,
      bgmAsset: bgmState.asset,
      bgmSrc: bgmState.src,
      bgmTrackGain: bgmState.trackGain,
      bgmBusGain: bgmState.busGain,
      bgmEffectiveGain: bgmState.effectiveGain,
      masterGain: bgmState.masterGain,
      graph: bgmState.graph,
      fallback: bgmState.fallback
    }, detail || {});
    audioRestoreTimingTraceState.events.push(record);
    if (audioRestoreTimingTraceState.events.length > AUDIO_RESTORE_TIMING_TRACE_LIMIT) {
      audioRestoreTimingTraceState.events.shift();
    }
  }

  function finiteTraceNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 10000) / 10000 : null;
  }

  function audioElementSnapshot(audio) {
    return audio ? {
      elementId: audio.__eigoTraceElementId || null,
      currentTime: finiteTraceNumber(audio.currentTime),
      paused: !!audio.paused,
      ended: !!audio.ended,
      readyState: finiteTraceNumber(audio.readyState),
      networkState: finiteTraceNumber(audio.networkState),
      muted: !!audio.muted,
      volume: finiteTraceNumber(audio.volume)
    } : null;
  }

  function initialAudioUnlockTargetSnapshot(audio) {
    var snapshot = audioElementSnapshot(audio);
    if (!snapshot) return {
      currentTime: null,
      paused: null,
      playing: false,
      readyState: null
    };
    return {
      currentTime: snapshot.currentTime,
      paused: snapshot.paused,
      playing: snapshot.paused === false && snapshot.ended !== true,
      readyState: snapshot.readyState
    };
  }

  function initialAudioUnlockSnapshot() {
    var context = contextLifecycleSnapshot();
    return {
      contextState: context.state,
      contextCurrentTime: context.currentTime,
      picoSe: initialAudioUnlockTargetSnapshot(initialAudioUnlockTraceState.picoSe),
      zephyr: initialAudioUnlockTargetSnapshot(initialAudioUnlockTraceState.zephyr)
    };
  }

  function recordInitialAudioUnlockTrace(type, detail) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var record = Object.assign({
      type: type,
      at: Date.now()
    }, initialAudioUnlockSnapshot(), detail || {});
    initialAudioUnlockTraceState.events.push(record);
    if (initialAudioUnlockTraceState.events.length > INITIAL_AUDIO_UNLOCK_TRACE_LIMIT) {
      initialAudioUnlockTraceState.events.shift();
    }
    try { console.log("[INITIAL AUDIO UNLOCK TRACE] " + type, record); } catch (_) {}
  }

  function trackInitialAudioUnlockTarget(audio, target) {
    if (!voiceRuntimeTraceState.panelEnabled || !audio) return;
    audio.__eigoInitialAudioUnlockTarget = target;
    if (target === "PICO SE") initialAudioUnlockTraceState.picoSe = audio;
    if (target === "ZEPHYR") initialAudioUnlockTraceState.zephyr = audio;
    if (!audio.__eigoInitialAudioUnlockListeners && typeof audio.addEventListener === "function") {
      audio.__eigoInitialAudioUnlockListeners = true;
      ["playing", "ended", "error"].forEach(function (eventName) {
        audio.addEventListener(eventName, function () {
          recordInitialAudioUnlockTrace(target.toLowerCase().replace(" ", "-") + "-" + eventName);
        });
      });
    }
  }

  function reloadIdentityMaps() {
    if (!reloadAudioIdentityTraceState.maps) {
      reloadAudioIdentityTraceState.maps = {
        context: new WeakMap(),
        element: new WeakMap(),
        source: new WeakMap(),
        gain: new WeakMap(),
        node: new WeakMap(),
        graph: new WeakMap()
      };
    }
    if (!reloadAudioIdentityTraceState.pageLoadId) {
      reloadAudioIdentityTraceState.pageLoadId = "load-" + Date.now().toString(36);
    }
    return reloadAudioIdentityTraceState.maps;
  }

  function reloadObjectIdentity(object, kind) {
    if (!voiceRuntimeTraceState.panelEnabled || !object) return null;
    var maps = reloadIdentityMaps();
    var map = maps[kind];
    if (!map) return null;
    var existing = map.get(object);
    if (existing) return existing;
    reloadAudioIdentityTraceState.counters[kind] += 1;
    var identity = reloadAudioIdentityTraceState.pageLoadId + "-" + kind + "-" +
      reloadAudioIdentityTraceState.counters[kind];
    map.set(object, identity);
    return identity;
  }

  function finalDiagnosticCaller() {
    if (!voiceRuntimeTraceState.panelEnabled) return null;
    try {
      var lines = String(new Error().stack || "").split("\n");
      return (lines[3] || lines[2] || "").trim() || null;
    } catch (_) { return null; }
  }

  function finalDiagnosticNodeType(node) {
    try { return node && node.constructor && node.constructor.name || "AudioNode"; }
    catch (_) { return "AudioNode"; }
  }

  function recordFinalDiagnosticEvent(type, detail) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var context = detail && detail.context || canonicalAudioContext;
    var record = Object.assign({
      type: type,
      at: Date.now(),
      runId: audioFinalDiagnosticState.runId,
      contextIdentity: reloadObjectIdentity(context, "context"),
      contextState: context ? (context.state || "unknown") : "uninitialized"
    }, detail || {});
    delete record.context;
    audioFinalDiagnosticState.events.push(record);
    if (audioFinalDiagnosticState.events.length > AUDIO_FINAL_DIAGNOSTIC_EVENT_LIMIT) {
      audioFinalDiagnosticState.events.shift();
    }
    try { console.log("[AUDIO FINAL DIAGNOSTIC] " + type, record); } catch (_) {}
  }

  function finalDiagnosticCreateMediaElementSource(context, element, meta) {
    var source;
    try {
      source = context.createMediaElementSource(element);
    } catch (error) {
      recordFinalDiagnosticEvent("createMediaElementSource-error", Object.assign({
        context: context,
        elementIdentity: reloadObjectIdentity(element, "element"),
        mediaSrc: shortAudioSource(element),
        error: String(error),
        caller: finalDiagnosticCaller()
      }, meta || {}));
      throw error;
    }
    if (voiceRuntimeTraceState.panelEnabled) {
      audioFinalDiagnosticState.mediaElementSourceCreates += 1;
      var role = meta && meta.role || "unknown";
      var elementIdentity = reloadObjectIdentity(element, "element");
      var duplicateKey = role + "|" + elementIdentity;
      audioFinalDiagnosticState.sourceCreatesByElementRole[duplicateKey] =
        (audioFinalDiagnosticState.sourceCreatesByElementRole[duplicateKey] || 0) + 1;
      if (audioFinalDiagnosticState.sourceCreatesByElementRole[duplicateKey] > 1) {
        audioFinalDiagnosticState.appDuplicateCreationSeen = true;
      }
      recordFinalDiagnosticEvent("createMediaElementSource", Object.assign({
        context: context,
        count: audioFinalDiagnosticState.mediaElementSourceCreates,
        elementIdentity: elementIdentity,
        mediaSrc: shortAudioSource(element),
        sourceIdentity: reloadObjectIdentity(source, "source"),
        existing: audioFinalDiagnosticState.sourceCreatesByElementRole[duplicateKey] > 1,
        caller: finalDiagnosticCaller()
      }, meta || {}));
    }
    return source;
  }

  function finalDiagnosticCreateGain(context, meta) {
    var gainNode = context.createGain();
    if (voiceRuntimeTraceState.panelEnabled) {
      audioFinalDiagnosticState.gainCreates += 1;
      recordFinalDiagnosticEvent("createGain", Object.assign({
        context: context,
        count: audioFinalDiagnosticState.gainCreates,
        gainIdentity: reloadObjectIdentity(gainNode, "gain"),
        initialGainValue: gainNode && gainNode.gain ? finiteTraceNumber(gainNode.gain.value) : null,
        caller: finalDiagnosticCaller()
      }, meta || {}));
    }
    return gainNode;
  }

  function finalDiagnosticConnect(sourceNode, destinationNode, meta) {
    var result;
    try {
      result = sourceNode.connect(destinationNode);
    } catch (error) {
      recordFinalDiagnosticEvent("connect-error", Object.assign({
        context: sourceNode && sourceNode.context,
        sourceNodeIdentity: reloadObjectIdentity(sourceNode, "node"),
        destinationNodeIdentity: reloadObjectIdentity(destinationNode, "node"),
        error: String(error),
        caller: finalDiagnosticCaller()
      }, meta || {}));
      throw error;
    }
    if (voiceRuntimeTraceState.panelEnabled) {
      audioFinalDiagnosticState.connectCalls += 1;
      var sourceIdentity = reloadObjectIdentity(sourceNode, "node");
      var destinationIdentity = reloadObjectIdentity(destinationNode, "node");
      var pair = sourceIdentity + ">" + destinationIdentity;
      var duplicatePair = !!audioFinalDiagnosticState.duplicateConnectPairs[pair];
      audioFinalDiagnosticState.duplicateConnectPairs[pair] =
        (audioFinalDiagnosticState.duplicateConnectPairs[pair] || 0) + 1;
      recordFinalDiagnosticEvent("connect", Object.assign({
        context: sourceNode && sourceNode.context,
        count: audioFinalDiagnosticState.connectCalls,
        sourceNodeIdentity: sourceIdentity,
        destinationNodeIdentity: destinationIdentity,
        sourceNodeType: finalDiagnosticNodeType(sourceNode),
        destinationNodeType: finalDiagnosticNodeType(destinationNode),
        duplicatePair: duplicatePair,
        caller: finalDiagnosticCaller()
      }, meta || {}));
    }
    return result;
  }

  function finalDiagnosticDisconnect(node, meta) {
    var result;
    try {
      result = node.disconnect();
    } catch (error) {
      recordFinalDiagnosticEvent("disconnect-error", Object.assign({
        context: node && node.context,
        nodeIdentity: reloadObjectIdentity(node, "node"),
        error: String(error),
        caller: finalDiagnosticCaller()
      }, meta || {}));
      throw error;
    }
    if (voiceRuntimeTraceState.panelEnabled) {
      audioFinalDiagnosticState.disconnectCalls += 1;
      recordFinalDiagnosticEvent("disconnect", Object.assign({
        context: node && node.context,
        count: audioFinalDiagnosticState.disconnectCalls,
        nodeIdentity: reloadObjectIdentity(node, "node"),
        nodeType: finalDiagnosticNodeType(node),
        caller: finalDiagnosticCaller()
      }, meta || {}));
    }
    return result;
  }

  function updateFinalDiagnosticGraphMax() {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var snapshot = reloadAudioIdentitySnapshot();
    audioFinalDiagnosticState.maxSourceCount = Math.max(
      audioFinalDiagnosticState.maxSourceCount, Number(snapshot.activeSourceCount) || 0);
    audioFinalDiagnosticState.maxNodeCount = Math.max(
      audioFinalDiagnosticState.maxNodeCount, Number(snapshot.activeNodeCount) || 0);
  }

  function finalDiagnosticActiveGraphCount(busName) {
    return reloadAudioIdentityTraceState.graphs.filter(function (graph) {
      return graph && graph.busName === busName && graph.disconnected !== true;
    }).length;
  }

  function isMonsterSeAsset(asset) {
    return /^(monster|battle)/i.test(String(asset || ""));
  }

  function finalDiagnosticMonsterSeSnapshot(audio, result, error) {
    var graph = latestObservedGraphForAudio(audio);
    return {
      seName: audio && audio.__eigoTraceAssetId || null,
      elementIdentity: reloadObjectIdentity(audio, "element"),
      playResult: result,
      audible: "unknown",
      error: error ? String(error) : null,
      contextIdentity: reloadObjectIdentity(canonicalAudioContext, "context"),
      contextState: canonicalAudioContext ? (canonicalAudioContext.state || "unknown") : "uninitialized",
      canonicalContextMatch: graph ? graph.context === canonicalAudioContext : null,
      gainIdentity: reloadObjectIdentity(graph && graph.gainNode, "gain"),
      gainValue: graph && graph.gainNode && graph.gainNode.gain ? finiteTraceNumber(graph.gainNode.gain.value) : null,
      sourceIdentity: reloadObjectIdentity(graph && graph.source, "source"),
      activeBgmGraphCount: finalDiagnosticActiveGraphCount("bgm"),
      activeSeGraphCount: finalDiagnosticActiveGraphCount("se"),
      routing: graph ? "se>canonical-se-bus" : (audio && audio.__eigoAudioPath || "pending")
    };
  }

  function recordFinalDiagnosticMonsterSe(audio, result, error) {
    if (!voiceRuntimeTraceState.panelEnabled || !audio || !audio.__eigoFinalDiagnosticMonsterSe) return;
    var snapshot = finalDiagnosticMonsterSeSnapshot(audio, result, error);
    audioFinalDiagnosticState.lastMonsterSe = snapshot;
    recordFinalDiagnosticEvent("monster-se-" + result, Object.assign({ context: canonicalAudioContext }, snapshot));
  }

  function finalDiagnosticResumeCall(context) {
    if (!voiceRuntimeTraceState.panelEnabled) return null;
    var id = ++audioFinalDiagnosticState.resumeSerial;
    var startedAt = Date.now();
    audioFinalDiagnosticState.pendingResumes[id] = startedAt;
    recordFinalDiagnosticEvent("resume-call", {
      context: context,
      resumeId: id,
      stateBefore: context ? (context.state || "unknown") : "uninitialized"
    });
    [1000, 3000].forEach(function (threshold) {
      window.setTimeout(function () {
        if (!audioFinalDiagnosticState.pendingResumes[id]) return;
        var elapsed = Date.now() - startedAt;
        audioFinalDiagnosticState.resumePendingMaxMs = Math.max(audioFinalDiagnosticState.resumePendingMaxMs, elapsed);
        recordFinalDiagnosticEvent("resume-pending", {
          context: context,
          resumeId: id,
          thresholdMs: threshold,
          elapsedMs: elapsed
        });
      }, threshold);
    });
    return id;
  }

  function finalDiagnosticResumeSettlement(context, id, result, error) {
    if (!voiceRuntimeTraceState.panelEnabled || !id) return;
    var startedAt = audioFinalDiagnosticState.pendingResumes[id];
    var elapsed = startedAt ? Date.now() - startedAt : null;
    if (elapsed !== null) {
      audioFinalDiagnosticState.resumePendingMaxMs = Math.max(audioFinalDiagnosticState.resumePendingMaxMs, elapsed);
    }
    delete audioFinalDiagnosticState.pendingResumes[id];
    recordFinalDiagnosticEvent("resume-" + result, {
      context: context,
      resumeId: id,
      elapsedMs: elapsed,
      error: error ? String(error) : null
    });
  }

  function observeExistingAudioGraph(audio, context, source, gainNode, nodes, busName) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var graph = {
      audio: audio,
      context: context,
      source: source,
      gainNode: gainNode,
      nodes: nodes,
      busName: busName,
      createdAt: Date.now(),
      createdBy: "buildSimpleGraph",
      creationReason: busName + "-canonical-bus-graph",
      generationSequence: reloadAudioIdentityTraceState.graphs.length + 1,
      asset: audio && (audio.__eigoTraceAssetId ||
        (audio.__eigoBgmTrack && audio.__eigoBgmTrack.asset)) || null,
      destinationConnected: true,
      disconnected: false,
      disconnectedAt: null
    };
    reloadAudioIdentityTraceState.graphs.push(graph);
    reloadObjectIdentity(context, "context");
    reloadObjectIdentity(audio, "element");
    reloadObjectIdentity(source, "source");
    reloadObjectIdentity(gainNode, "gain");
    reloadObjectIdentity(graph, "graph");
    (nodes || []).forEach(function (node) { reloadObjectIdentity(node, "node"); });
  }

  function markObservedGraphsDisconnected(nodes) {
    if (!voiceRuntimeTraceState.panelEnabled || !nodes || !nodes.length) return;
    reloadAudioIdentityTraceState.graphs.forEach(function (graph) {
      if (graph.disconnected || !graph.nodes) return;
      var belongsToGraph = nodes.some(function (node) { return graph.nodes.indexOf(node) !== -1; });
      if (!belongsToGraph) return;
      graph.disconnected = true;
      graph.destinationConnected = false;
      graph.disconnectedAt = Date.now();
    });
  }

  function graphAsset(graph) {
    var audio = graph && graph.audio;
    return graph && graph.asset || audio && (audio.__eigoTraceAssetId ||
      (audio.__eigoBgmTrack && audio.__eigoBgmTrack.asset)) || null;
  }

  function latestObservedGraphForAudio(audio) {
    for (var index = reloadAudioIdentityTraceState.graphs.length - 1; index >= 0; index -= 1) {
      if (reloadAudioIdentityTraceState.graphs[index].audio === audio) {
        return reloadAudioIdentityTraceState.graphs[index];
      }
    }
    return null;
  }

  function loudAudioGraphDetailSnapshot() {
    var managed = uniqueManagedAudio();
    var canonicalElement = bgm;
    var canonicalGraph = latestObservedGraphForAudio(canonicalElement);
    var canonicalSource = canonicalGraph && canonicalGraph.source;
    var canonicalGain = canonicalGraph && canonicalGraph.gainNode;
    var sourceIndex = 0;
    var nodeIndex = 0;
    var details = reloadAudioIdentityTraceState.graphs.map(function (graph) {
      var audio = graph.audio;
      var managedNow = !!(audio && managed.indexOf(audio) !== -1);
      var latestForElement = latestObservedGraphForAudio(audio);
      var sourceDisplayIndex = graph.source ? ++sourceIndex : null;
      var nodes = (graph.nodes || []).map(function (node) {
        nodeIndex += 1;
        return {
          index: nodeIndex,
          identity: node === graph.source ? reloadObjectIdentity(node, "source") :
            (node === graph.gainNode ? reloadObjectIdentity(node, "gain") : reloadObjectIdentity(node, "node")),
          kind: node === graph.source ? "MediaElementSource" :
            (node === graph.gainNode ? "GainNode" : "AudioNode"),
          connected: graph.destinationConnected === true && graph.disconnected !== true
        };
      });
      return {
        graphIdentity: reloadObjectIdentity(graph, "graph"),
        generationSequence: graph.generationSequence,
        createdAt: graph.createdAt,
        createdBy: graph.createdBy,
        creationReason: graph.creationReason,
        asset: graphAsset(graph),
        busName: graph.busName,
        contextIdentity: reloadObjectIdentity(graph.context, "context"),
        contextState: graph.context ? (graph.context.state || "unknown") : "unavailable",
        canonicalContextMatch: graph.context === canonicalAudioContext,
        elementIdentity: reloadObjectIdentity(audio, "element"),
        elementSource: shortAudioSource(audio),
        elementCurrentTime: audio ? finiteTraceNumber(audio.currentTime) : null,
        elementPaused: audio ? !!audio.paused : null,
        elementEnded: audio ? !!audio.ended : null,
        elementMuted: audio ? !!audio.muted : null,
        elementVolume: audio ? finiteTraceNumber(audio.volume) : null,
        canonicalElementMatch: audio === canonicalElement,
        sourceIndex: sourceDisplayIndex,
        sourceIdentity: reloadObjectIdentity(graph.source, "source"),
        canonicalSourceMatch: !!graph.source && graph.source === canonicalSource,
        gainIdentity: reloadObjectIdentity(graph.gainNode, "gain"),
        gainValue: graph.gainNode && graph.gainNode.gain ? finiteTraceNumber(graph.gainNode.gain.value) : null,
        canonicalGainMatch: !!graph.gainNode && graph.gainNode === canonicalGain,
        managed: managedNow,
        playing: isAudioPlaying(audio),
        active: managedNow && graph.disconnected !== true,
        retired: !managedNow || graph.disconnected === true,
        stale: managedNow && latestForElement !== graph,
        destinationConnected: graph.destinationConnected === true && graph.disconnected !== true,
        disconnected: graph.disconnected === true,
        disconnectedAt: graph.disconnectedAt,
        nodes: nodes
      };
    });
    return {
      version: LOUD_AUDIO_GRAPH_IDENTITY_TRACE_VERSION,
      contextIdentity: reloadObjectIdentity(canonicalAudioContext, "context"),
      contextState: canonicalAudioContext ? (canonicalAudioContext.state || "unknown") : "uninitialized",
      graphRegisteredCount: details.length,
      sourceRegisteredCount: details.filter(function (detail) { return !!detail.sourceIdentity; }).length,
      nodeRegisteredCount: details.reduce(function (sum, detail) { return sum + detail.nodes.length; }, 0),
      graphs: details
    };
  }

  function speechResultAudioRouteSnapshot() {
    var identity = reloadAudioIdentitySnapshot();
    var context = canonicalAudioContext;
    var currentAudio = bgm;
    var currentGraph = latestObservedGraphForAudio(currentAudio);
    var session = audioSessionTraceSnapshot();
    var currentSrc = null;
    try { currentSrc = currentAudio && (currentAudio.currentSrc || currentAudio.src || null); } catch (_) {}
    return {
      contextIdentity: reloadObjectIdentity(context, "context"),
      contextState: context ? (context.state || "unknown") : "uninitialized",
      contextCurrentTime: context ? finiteTraceNumber(context.currentTime) : null,
      contextSampleRate: context ? finiteTraceNumber(context.sampleRate) : null,
      contextBaseLatency: context ? finiteTraceNumber(context.baseLatency) : null,
      audioSessionSupported: session.supported === true,
      audioSessionType: session.supported === true ? session.type : session.label,
      audioSessionState: session.supported === true ? session.state : session.label,
      bgmAsset: currentAudio && currentAudio.__eigoBgmTrack ? currentAudio.__eigoBgmTrack.asset : null,
      bgmElementIdentity: reloadObjectIdentity(currentAudio, "element"),
      bgmSrc: shortAudioSource(currentAudio),
      bgmCurrentSrc: currentSrc,
      bgmCurrentTime: currentAudio ? finiteTraceNumber(currentAudio.currentTime) : null,
      bgmPaused: currentAudio ? !!currentAudio.paused : null,
      bgmEnded: currentAudio ? !!currentAudio.ended : null,
      bgmMuted: currentAudio ? !!currentAudio.muted : null,
      bgmVolume: currentAudio ? finiteTraceNumber(currentAudio.volume) : null,
      bgmReadyState: currentAudio ? finiteTraceNumber(currentAudio.readyState) : null,
      bgmNetworkState: currentAudio ? finiteTraceNumber(currentAudio.networkState) : null,
      sourceIdentity: reloadObjectIdentity(currentGraph && currentGraph.source, "source"),
      gainIdentity: reloadObjectIdentity(currentGraph && currentGraph.gainNode, "gain"),
      gainValue: currentGraph && currentGraph.gainNode && currentGraph.gainNode.gain ?
        finiteTraceNumber(currentGraph.gainNode.gain.value) : null,
      graphContextIdentity: reloadObjectIdentity(currentGraph && currentGraph.context, "context"),
      canonicalContextMatch: currentGraph ? currentGraph.context === canonicalAudioContext : null,
      bgmSourceCount: identity.bgmSourceCount,
      managedSourceCount: identity.activeSourceCount,
      bgmNodeCount: identity.bgmNodeCount,
      managedNodeCount: identity.activeNodeCount
    };
  }

  function recordSpeechResultAudioRouteCheckpoint(checkpoint, detail) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var record = Object.assign({
      checkpoint: checkpoint,
      at: Date.now(),
      recognitionInstanceIdentity: null,
      recognitionEvent: null,
      resultIndex: null,
      resultsLength: null,
      isFinal: null,
      transcript: null
    }, speechResultAudioRouteSnapshot(), detail || {});
    speechResultAudioRouteTraceState.events.push(record);
    if (speechResultAudioRouteTraceState.events.length > SPEECH_RESULT_AUDIO_ROUTE_TRACE_LIMIT) {
      speechResultAudioRouteTraceState.events.shift();
    }
    try { console.log("[SPEECH RESULT AUDIO ROUTE TRACE] " + checkpoint, record); } catch (_) {}
    renderVoiceRuntimeTracePanel();
  }

  function installSpeechResultAudioSessionTrace() {
    if (!voiceRuntimeTraceState.panelEnabled || speechResultAudioRouteTraceState.audioSessionListenerInstalled) return;
    try {
      var session = window.navigator && navigator.audioSession;
      if (!session || typeof session.addEventListener !== "function") return;
      speechResultAudioRouteTraceState.audioSessionListenerInstalled = true;
      speechResultAudioRouteTraceState.lastAudioSessionState =
        typeof session.state === "string" ? session.state : "unavailable";
      session.addEventListener("statechange", function () {
        var previousState = speechResultAudioRouteTraceState.lastAudioSessionState;
        var currentState = typeof session.state === "string" ? session.state : "unavailable";
        speechResultAudioRouteTraceState.lastAudioSessionState = currentState;
        recordSpeechResultAudioRouteCheckpoint("audio-session-statechange", {
          recognitionEvent: "audio-session-statechange",
          previousAudioSessionState: previousState,
          currentAudioSessionState: currentState
        });
      });
    } catch (_) {}
  }

  function reloadNavigationType() {
    try {
      if (window.performance && typeof performance.getEntriesByType === "function") {
        var entries = performance.getEntriesByType("navigation");
        if (entries && entries[0] && entries[0].type) return entries[0].type;
      }
      if (window.performance && performance.navigation) {
        return performance.navigation.type === 1 ? "reload" : "navigate";
      }
    } catch (_) {}
    return "unknown";
  }

  function reloadAudioIdentitySnapshot(focusAudio) {
    var context = canonicalAudioContext;
    var currentAudio = bgm;
    var managed = uniqueManagedAudio();
    var activeGraphs = reloadAudioIdentityTraceState.graphs.filter(function (graph) {
      return graph.audio && managed.indexOf(graph.audio) !== -1;
    });
    var bgmGraph = null;
    var focusGraph = null;
    for (var index = activeGraphs.length - 1; index >= 0; index -= 1) {
      if (activeGraphs[index].audio === currentAudio) { bgmGraph = activeGraphs[index]; break; }
    }
    for (var focusIndex = activeGraphs.length - 1; focusIndex >= 0; focusIndex -= 1) {
      if (activeGraphs[focusIndex].audio === focusAudio) { focusGraph = activeGraphs[focusIndex]; break; }
    }
    return {
      pageLoadId: voiceRuntimeTraceState.panelEnabled ? (reloadIdentityMaps(), reloadAudioIdentityTraceState.pageLoadId) : null,
      navigationType: reloadNavigationType(),
      contextIdentity: reloadObjectIdentity(context, "context"),
      contextState: context ? (context.state || "unknown") : "uninitialized",
      contextCurrentTime: context ? finiteTraceNumber(context.currentTime) : null,
      bgmAsset: currentAudio && currentAudio.__eigoBgmTrack ? currentAudio.__eigoBgmTrack.asset : null,
      elementIdentity: reloadObjectIdentity(currentAudio, "element"),
      elementCurrentTime: currentAudio ? finiteTraceNumber(currentAudio.currentTime) : null,
      elementPaused: currentAudio ? !!currentAudio.paused : null,
      elementVolume: currentAudio ? finiteTraceNumber(currentAudio.volume) : null,
      elementMuted: currentAudio ? !!currentAudio.muted : null,
      sourceIdentity: reloadObjectIdentity(bgmGraph && bgmGraph.source, "source"),
      gainIdentity: reloadObjectIdentity(bgmGraph && bgmGraph.gainNode, "gain"),
      gainValue: bgmGraph && bgmGraph.gainNode && bgmGraph.gainNode.gain ?
        finiteTraceNumber(bgmGraph.gainNode.gain.value) : null,
      graphContextIdentity: reloadObjectIdentity(bgmGraph && bgmGraph.context, "context"),
      canonicalContextMatch: bgmGraph ? bgmGraph.context === canonicalAudioContext : null,
      bgmSourceCount: bgmGraph && bgmGraph.source ? 1 : 0,
      bgmNodeCount: bgmGraph && bgmGraph.nodes ? bgmGraph.nodes.length : 0,
      activeSourceCount: activeGraphs.filter(function (graph) { return !!graph.source; }).length,
      activeNodeCount: activeGraphs.reduce(function (sum, graph) {
        return sum + (graph.nodes ? graph.nodes.length : 0);
      }, 0),
      focusElementIdentity: reloadObjectIdentity(focusAudio, "element"),
      focusSourceIdentity: reloadObjectIdentity(focusGraph && focusGraph.source, "source"),
      focusGainIdentity: reloadObjectIdentity(focusGraph && focusGraph.gainNode, "gain"),
      focusGainValue: focusGraph && focusGraph.gainNode && focusGraph.gainNode.gain ?
        finiteTraceNumber(focusGraph.gainNode.gain.value) : null,
      focusCanonicalContextMatch: focusGraph ? focusGraph.context === canonicalAudioContext : null
    };
  }

  function recordReloadAudioIdentityCheckpoint(checkpoint, detail, focusAudio) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var record = Object.assign({
      checkpoint: checkpoint,
      at: Date.now()
    }, reloadAudioIdentitySnapshot(focusAudio), detail || {}, {
      loudGraphDetail: loudAudioGraphDetailSnapshot()
    });
    reloadAudioIdentityTraceState.events.push(record);
    if (reloadAudioIdentityTraceState.events.length > RELOAD_AUDIO_IDENTITY_TRACE_LIMIT) {
      reloadAudioIdentityTraceState.events.shift();
    }
    try { console.log("[RELOAD AUDIO IDENTITY TRACE] " + checkpoint, record); } catch (_) {}
  }

  function markReloadAudioIdentityTarget(audio, target) {
    if (voiceRuntimeTraceState.panelEnabled && audio) audio.__eigoReloadIdentityTarget = target;
  }

  function audioContextSnapshot(context) {
    return context ? {
      contextId: context.__eigoTraceContextId || null,
      state: context.state || "unknown",
      currentTime: finiteTraceNumber(context.currentTime)
    } : { contextId: null, state: "unavailable", currentTime: null };
  }

  function stringifyTraceValue(value) {
    if (value === undefined) return "-";
    if (value === null) return "null";
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value);
  }

  function traceClock(at) {
    var date = new Date(at || Date.now());
    function pad(value, size) { return String(value).padStart(size, "0"); }
    return pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2) + ":" +
      pad(date.getSeconds(), 2) + "." + pad(date.getMilliseconds(), 3);
  }

  function currentOrientation() {
    try {
      if (window.screen && screen.orientation && screen.orientation.type) return screen.orientation.type;
    } catch (_) {}
    var angle = Number(window.orientation);
    if (Number.isFinite(angle)) return Math.abs(angle) === 90 ? "landscape" : "portrait";
    return Number(window.innerWidth) > Number(window.innerHeight) ? "landscape" : "portrait";
  }

  function documentLifecycleSnapshot() {
    var focus = null;
    try { focus = typeof document.hasFocus === "function" ? !!document.hasFocus() : null; } catch (_) {}
    return {
      visibility: window.document ? (document.visibilityState || "unknown") : "unavailable",
      hidden: window.document ? !!document.hidden : null,
      focus: focus
    };
  }

  function contextLifecycleSnapshot() {
    var context = canonicalAudioContext;
    return {
      id: context && context.__eigoTraceContextId || null,
      state: context ? (context.state || "unknown") : "uninitialized",
      currentTime: context ? finiteTraceNumber(context.currentTime) : null
    };
  }

  function audioSessionTraceSnapshot() {
    try {
      var session = window.navigator && navigator.audioSession;
      if (!session) return { supported: false, label: "unsupported" };
      var type = typeof session.type === "string" ? session.type : "unavailable";
      var state = typeof session.state === "string" ? session.state : "unavailable";
      return { supported: true, type: type, state: state, label: type + "/" + state };
    } catch (_) {
      return { supported: false, label: "unavailable" };
    }
  }

  function recordSpeechOrderEvent(record) {
    if (!record || !SPEECH_ORDER_EVENT_TYPES[record.type]) return;
    if (record.type === "speech-listen-enter") {
      speechOrderTraceState.resultSeen = { interim: false, final: false };
    }
    if (record.type === "recognition-result") {
      var resultType = record.final === true ? "final" : "interim";
      if (speechOrderTraceState.resultSeen[resultType]) return;
      speechOrderTraceState.resultSeen[resultType] = true;
    }
    speechOrderTraceState.events.push(record);
    if (speechOrderTraceState.events.length > SPEECH_ORDER_STORAGE_LIMIT) {
      speechOrderTraceState.events.shift();
    }
  }

  function recordAudioLifecycleEvent(type, detail) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var live = liveAudioSnapshot();
    var context = contextLifecycleSnapshot();
    var audioSession = audioSessionTraceSnapshot();
    var record = Object.assign({
      type: type,
      at: Date.now(),
      contextState: context.state,
      audioSession: audioSession.label,
      bgmPlaying: live.bgmPlaying.length,
      motifPlaying: live.motifs.length,
      voicePlaying: live.voicePlaying.length
    }, detail || {});
    audioLifecycleTraceState.events.push(record);
    if (audioLifecycleTraceState.events.length > 20) audioLifecycleTraceState.events.shift();
    recordSpeechOrderEvent(record);
    if (type === "bgm-restore-start" || type === "bgm-play-call" ||
        type === "bgm-play-resolved" || type === "bgm-playing-event") {
      recordAudioRestoreTimingEvent(type === "bgm-playing-event" ? "bgm-playing" : type, detail || {});
    }
    renderVoiceRuntimeTracePanel();
  }

  function recordOrientationLifecycleEvent(type) {
    if (!voiceRuntimeTraceState.panelEnabled) return;
    var before = contextLifecycleSnapshot().state;
    var resumeCallsBefore = audioLifecycleTraceState.resumeCalls;
    var orientation = currentOrientation();
    var width = Number(window.innerWidth) || 0;
    var height = Number(window.innerHeight) || 0;
    window.setTimeout(function () {
      recordAudioLifecycleEvent(type, {
        orientation: orientation,
        width: width,
        height: height,
        contextBefore: before,
        contextAfter: contextLifecycleSnapshot().state,
        resumeCalled: audioLifecycleTraceState.resumeCalls > resumeCallsBefore
      });
    }, 0);
  }

  function shortAudioSource(audio) {
    if (!audio) return "-";
    var source = "";
    try { source = audio.getAttribute("src") || audio.src || ""; } catch (_) {}
    source = String(source).split("#")[0].split("?")[0];
    return source.split("/").pop() || source || "-";
  }

  function ensureAudioInstanceTrace(audio, asset, category) {
    if (!audio) return null;
    if (!audio.__eigoTraceInstanceId) audio.__eigoTraceInstanceId = "a" + (++audioInstanceTraceSerial);
    if (asset !== undefined) audio.__eigoTraceAssetId = asset;
    if (category) audio.__eigoTraceCategory = category;
    return audio.__eigoTraceInstanceId;
  }

  function noteAudioLiveStart(audio, asset, category) {
    var instanceId = ensureAudioInstanceTrace(audio, asset, category);
    audioLiveTraceLastStart = { asset: asset, category: category, instanceId: instanceId };
    renderVoiceRuntimeTracePanel();
  }

  function isAudioPlaying(audio) {
    return !!(audio && audio.paused === false && audio.ended !== true && audio.__eigoStopped !== true);
  }

  function uniqueManagedAudio() {
    var result = [];
    function add(audio) {
      if (audio && result.indexOf(audio) === -1) result.push(audio);
    }
    bgmTracks.forEach(function (track) { add(track && track.audio); });
    add(bgm);
    effects.forEach(add);
    voices.forEach(add);
    dialogueVoices.forEach(add);
    return result;
  }

  function liveAudioSnapshot() {
    var managed = uniqueManagedAudio();
    var playing = managed.filter(isAudioPlaying);
    var currentTrack = bgm && bgm.__eigoBgmTrack ? bgm.__eigoBgmTrack : null;
    var bgmPlaying = playing.filter(function (audio) { return !!audio.__eigoBgmTrack; });
    var motifs = playing.filter(function (audio) {
      return audio.__eigoOneShotMix && audio.__eigoOneShotMix.category === "MOTIF";
    });
    var voicePlaying = playing.filter(function (audio) { return voices.indexOf(audio) !== -1; });
    var dialogueVoicePlaying = playing.filter(function (audio) { return dialogueVoices.indexOf(audio) !== -1; });
    var sourceCounts = {};
    playing.forEach(function (audio) {
      var name = shortAudioSource(audio);
      sourceCounts[name] = (sourceCounts[name] || 0) + 1;
    });
    var sameSourceMax = 0;
    var sameSourceName = "none";
    Object.keys(sourceCounts).forEach(function (name) {
      if (sourceCounts[name] > sameSourceMax) {
        sameSourceMax = sourceCounts[name];
        sameSourceName = name;
      }
    });
    var bgmBus = canonicalBuses ? finiteTraceNumber(canonicalBuses.bgm.gain.value) : null;
    var motifBus = canonicalBuses ? finiteTraceNumber(canonicalBuses.motif.gain.value) : null;
    var voiceBus = canonicalBuses ? finiteTraceNumber(canonicalBuses.voice.gain.value) : null;
    var master = canonicalBuses ? finiteTraceNumber(canonicalBuses.master.gain.value) : null;
    return {
      managed: managed,
      playing: playing,
      bgmPlaying: bgmPlaying,
      motifs: motifs,
      voicePlaying: voicePlaying,
      dialogueVoicePlaying: dialogueVoicePlaying,
      currentVoice: voicePlaying.length ? {
        asset: voicePlaying[voicePlaying.length - 1].__eigoTraceAssetId || null,
        character: voicePlaying[voicePlaying.length - 1].__eigoTraceCharacterId || null,
        path: voicePlaying[voicePlaying.length - 1].__eigoAudioPath || "unknown"
      } : null,
      sameSourceMax: sameSourceMax,
      sameSourceName: sameSourceName,
      bgm: bgm ? {
        asset: currentTrack ? currentTrack.asset : bgm.__eigoTraceAssetId,
        instanceId: ensureAudioInstanceTrace(bgm, currentTrack ? currentTrack.asset : undefined, "BGM"),
        src: shortAudioSource(bgm),
        playing: isAudioPlaying(bgm),
        paused: !!bgm.paused,
        path: currentTrack ? currentTrack.path : (bgm.__eigoAudioPath || "unknown"),
        fallback: currentTrack ? currentTrack.path === "fallback" : bgm.__eigoAudioPath === "fallback",
        baseGain: currentTrack ? finiteTraceNumber(currentTrack.baseVolume) : null,
        trackGain: currentTrack && currentTrack.gainNode ? finiteTraceNumber(currentTrack.gainNode.gain.value) :
          (currentTrack && currentTrack.path === "fallback" ? finiteTraceNumber(bgm.volume) : null),
        busGain: bgmBus,
        masterGain: master,
        effectiveGain: currentTrack ? finiteTraceNumber(bgmEffectiveGain(currentTrack)) : null
      } : null,
      motifBus: motifBus,
      voiceBusGain: voiceBus,
      master: master
    };
  }

  function createSignalTraceAnalyser(context, sourceNode) {
    if (!context || !sourceNode ||
        typeof context.createAnalyser !== "function" || typeof sourceNode.connect !== "function") return null;
    try {
      var analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0;
      finalDiagnosticConnect(sourceNode, analyser, { role: "signal-analyser", reason: "signal-trace" });
      return analyser;
    } catch (_) { return null; }
  }

  function sampleSignalTrace(analyser, meterName) {
    var meter = signalMeterState[meterName] || { signalSeen: false, lastSignalTime: null };
    signalMeterState[meterName] = meter;
    if (!analyser || typeof analyser.getFloatTimeDomainData !== "function") {
      return { peak: null, rms: null, signal: false, signalSeen: meter.signalSeen, lastSignalTime: meter.lastSignalTime };
    }
    try {
      var samples = new Float32Array(analyser.fftSize || 256);
      analyser.getFloatTimeDomainData(samples);
      var peak = 0;
      var sumSquares = 0;
      for (var index = 0; index < samples.length; index += 1) {
        var absolute = Math.abs(samples[index]);
        if (absolute > peak) peak = absolute;
        sumSquares += samples[index] * samples[index];
      }
      var rms = samples.length ? Math.sqrt(sumSquares / samples.length) : 0;
      var signal = peak > 0.001 || rms > 0.001;
      if (signal) {
        meter.signalSeen = true;
        meter.lastSignalTime = Date.now();
      }
      return {
        peak: finiteTraceNumber(peak),
        rms: finiteTraceNumber(rms),
        signal: signal,
        signalSeen: meter.signalSeen,
        lastSignalTime: meter.lastSignalTime
      };
    } catch (_) {
      return { peak: null, rms: null, signal: false, signalSeen: meter.signalSeen, lastSignalTime: meter.lastSignalTime };
    }
  }

  function mediaSignalSnapshot(audio) {
    if (!audio) return null;
    var currentTime = finiteTraceNumber(audio.currentTime);
    var previousTime = audio.__eigoSignalTraceCurrentTime;
    var moving = previousTime !== undefined && currentTime !== null && currentTime > previousTime + 0.001;
    audio.__eigoSignalTraceCurrentTime = currentTime;
    return {
      currentTime: currentTime,
      duration: finiteTraceNumber(audio.duration),
      moving: moving,
      paused: !!audio.paused,
      ended: !!audio.ended,
      readyState: finiteTraceNumber(audio.readyState),
      networkState: finiteTraceNumber(audio.networkState),
      path: audio.__eigoAudioPath || (audio.__eigoBgmTrack && audio.__eigoBgmTrack.path) || "unknown"
    };
  }

  function signalTraceSnapshot() {
    var live = liveAudioSnapshot();
    var track = bgm && bgm.__eigoBgmTrack;
    var activeVoice = live.dialogueVoicePlaying.length ?
      live.dialogueVoicePlaying[live.dialogueVoicePlaying.length - 1] : null;
    var voiceAudio = activeVoice || lastDialogueVoiceTraceAudio;
    var masterSignal = sampleSignalTrace(canonicalSignalAnalysers && canonicalSignalAnalysers.master, "master");
    var bgmSourceSignal = sampleSignalTrace(track && track.traceAnalyser, "bgmSource");
    var bgmBusSignal = sampleSignalTrace(canonicalSignalAnalysers && canonicalSignalAnalysers.bgm, "bgmBus");
    var voiceSourceSignal = sampleSignalTrace(activeVoice && activeVoice.__eigoVoiceTraceAnalyser, "voiceSource");
    var voiceBusSignal = sampleSignalTrace(canonicalSignalAnalysers && canonicalSignalAnalysers.voice, "voiceBus");
    var voicePlaying = !!activeVoice;
    var voiceResidual = !voicePlaying && voiceBusSignal.signal;
    var highOutput = (masterSignal.peak !== null && masterSignal.peak >= 0.98) ||
      (masterSignal.rms !== null && masterSignal.rms >= 0.5);
    var sourceSignal = voicePlaying ? voiceSourceSignal : bgmSourceSignal;
    var busSignal = voicePlaying ? voiceBusSignal : bgmBusSignal;
    var activeRequested = !!(live.bgm && live.bgm.playing) || voicePlaying;
    var status = "UNKNOWN";
    if (voiceResidual) status = lastDialogueVoiceTraceMeta && lastDialogueVoiceTraceMeta.character === "c02" ?
      "KONG RESIDUAL SIGNAL" : "VOICE RESIDUAL";
    else if (highOutput) status = "HIGH OUTPUT SIGNAL";
    else if (!activeRequested && masterSignal.signal) status = "MASTER ACTIVE";
    else if (!activeRequested) status = "IDLE";
    else if (sourceSignal.peak === null) status = "UNKNOWN";
    else if (!sourceSignal.signal) status = "SOURCE LOST";
    else if (!busSignal.signal) status = "BUS LOST";
    else if (!masterSignal.signal) status = "MASTER LOST";
    else status = "MASTER ACTIVE";
    return {
      live: live,
      master: masterSignal,
      bgm: {
        media: mediaSignalSnapshot(bgm),
        source: bgmSourceSignal,
        bus: bgmBusSignal
      },
      voice: {
        audio: voiceAudio,
        media: mediaSignalSnapshot(voiceAudio),
        source: voicePlaying ? voiceSourceSignal : {
          peak: voiceRuntimeTraceState.latched && voiceRuntimeTraceState.latched.maxPeak,
          rms: voiceRuntimeTraceState.latched && voiceRuntimeTraceState.latched.maxRms,
          signal: false,
          signalSeen: !!(voiceRuntimeTraceState.latched && voiceRuntimeTraceState.latched.playingSeen),
          lastSignalTime: null
        },
        bus: voiceBusSignal,
        playing: voicePlaying,
        meta: activeVoice ? {
          asset: activeVoice.__eigoTraceAssetId,
          character: activeVoice.__eigoTraceCharacterId,
          characterGain: finiteTraceNumber(activeVoice.__eigoVoiceCharacterGain),
          processingGain: finiteTraceNumber(activeVoice.__eigoVoiceProcessingGain)
        } : lastDialogueVoiceTraceMeta
      },
      residualVoice: voiceResidual,
      voiceSignalLost: voicePlaying && !voiceSourceSignal.signal,
      highOutput: highOutput,
      status: status,
      runningActiveCheck: contextLifecycleSnapshot().state === "running" && activeRequested
    };
  }

  function createVoiceRuntimeLatch(traceId) {
    return {
      traceId: traceId,
      playingSeen: false,
      contextState: null,
      contextId: null,
      audioPath: null,
      fallback: null,
      characterGain: null,
      processingGain: null,
      voiceBusGain: null,
      masterGain: null,
      graphConnected: false,
      sourceCreated: false,
      maxPeak: null,
      maxRms: null,
      lastPlayingCurrentTime: null
    };
  }

  function latchTraceNumber(current, observed, maximum) {
    if (observed === null || observed === undefined || !Number.isFinite(Number(observed))) return current;
    var value = finiteTraceNumber(observed);
    if (!maximum || current === null) return value;
    return Math.max(current, value);
  }

  function updateVoiceRuntimeLatch(event, detail) {
    detail = detail || {};
    if (!voiceRuntimeTraceState.latched || event === "enterDialogueVoiceMode" ||
        voiceRuntimeTraceState.latched.traceId !== detail.traceId) {
      voiceRuntimeTraceState.latched = createVoiceRuntimeLatch(detail.traceId);
    }
    var latched = voiceRuntimeTraceState.latched;
    var context = detail.audioContext || {};
    var graph = detail.graph || {};
    var html = detail.htmlAudio || {};
    if (context.state && context.state !== "unavailable") latched.contextState = context.state;
    if (context.contextId) latched.contextId = context.contextId;
    if (detail.audioPath && detail.audioPath !== "pending") latched.audioPath = detail.audioPath;
    if (detail.fallback === true) latched.fallback = true;
    else if (latched.fallback === null && detail.fallback === false) latched.fallback = false;
    latched.characterGain = latchTraceNumber(latched.characterGain, graph.characterGain, false);
    latched.processingGain = latchTraceNumber(latched.processingGain, graph.processingGain, false);
    latched.voiceBusGain = latchTraceNumber(latched.voiceBusGain, graph.voiceBusGain, false);
    latched.masterGain = latchTraceNumber(latched.masterGain, graph.masterGain, false);
    latched.graphConnected = latched.graphConnected || graph.destinationConnected === true;
    latched.sourceCreated = latched.sourceCreated || graph.mediaElementSourceCreated === true;
    latched.maxPeak = latchTraceNumber(latched.maxPeak, graph.signalPeak, true);
    latched.maxRms = latchTraceNumber(latched.maxRms, graph.signalRms, true);
    var playingNow = event === "playing" || (html.paused === false && html.ended !== true);
    if (playingNow) {
      latched.playingSeen = true;
      latched.lastPlayingCurrentTime = latchTraceNumber(latched.lastPlayingCurrentTime, html.currentTime, false);
    }
  }

  function loudAudioGraphDetailLines(snapshot) {
    if (!snapshot) return ["LOUD GRAPH DETAIL unavailable"];
    var lines = [
      "LOUD GRAPH DETAIL: " + snapshot.version,
      "CONTEXT " + stringifyTraceValue(snapshot.contextIdentity) + " state=" + snapshot.contextState +
        " registered graphs/sources/nodes=" + snapshot.graphRegisteredCount + "/" +
        snapshot.sourceRegisteredCount + "/" + snapshot.nodeRegisteredCount
    ];
    snapshot.graphs.forEach(function (graph, graphIndex) {
      lines.push("GRAPH[" + (graphIndex + 1) + "] " + stringifyTraceValue(graph.graphIdentity) +
        " seq=" + graph.generationSequence + " asset=" + stringifyTraceValue(graph.asset) +
        " bus=" + stringifyTraceValue(graph.busName) + " active=" + graph.active +
        " retired=" + graph.retired + " stale=" + graph.stale);
      lines.push("  created=" + traceClock(graph.createdAt) + " by=" + graph.createdBy +
        " reason=" + graph.creationReason + " ctx=" + stringifyTraceValue(graph.contextIdentity) +
        "/" + graph.contextState + " canonical=" + graph.canonicalContextMatch);
      lines.push("  ELEMENT " + stringifyTraceValue(graph.elementIdentity) + " src=" + graph.elementSource +
        " t=" + stringifyTraceValue(graph.elementCurrentTime) + " play/pause/end=" + graph.playing +
        "/" + stringifyTraceValue(graph.elementPaused) + "/" + stringifyTraceValue(graph.elementEnded) +
        " mute/vol=" + stringifyTraceValue(graph.elementMuted) + "/" +
        stringifyTraceValue(graph.elementVolume) + " canonical=" + graph.canonicalElementMatch);
      lines.push("  SOURCE[" + stringifyTraceValue(graph.sourceIndex) + "] " +
        stringifyTraceValue(graph.sourceIdentity) + " canonical=" + graph.canonicalSourceMatch +
        " connected=" + graph.destinationConnected + " disconnected=" + graph.disconnected);
      lines.push("  GAIN " + stringifyTraceValue(graph.gainIdentity) + " value=" +
        stringifyTraceValue(graph.gainValue) + " canonical=" + graph.canonicalGainMatch);
      lines.push("  NODES " + graph.nodes.map(function (node) {
        return "NODE[" + node.index + "]=" + stringifyTraceValue(node.identity) +
          "/" + node.kind + "/connected=" + node.connected;
      }).join(" | "));
    });
    return lines;
  }

  function audioFinalDiagnosticSummary() {
    updateFinalDiagnosticGraphMax();
    var identity = reloadAudioIdentitySnapshot();
    var context = canonicalAudioContext;
    var pendingMax = audioFinalDiagnosticState.resumePendingMaxMs;
    Object.keys(audioFinalDiagnosticState.pendingResumes).forEach(function (id) {
      pendingMax = Math.max(pendingMax, Date.now() - audioFinalDiagnosticState.pendingResumes[id]);
    });
    var graphGrowth = identity.activeSourceCount > audioFinalDiagnosticState.mediaElementSourceCreates;
    var duplicatePair = Object.keys(audioFinalDiagnosticState.duplicateConnectPairs).some(function (pair) {
      return audioFinalDiagnosticState.duplicateConnectPairs[pair] > 1;
    });
    var appDuplicate = audioFinalDiagnosticState.mediaElementSourceCreates === 0 ? "UNDETERMINED" :
      (audioFinalDiagnosticState.appDuplicateCreationSeen ? "YES" : "NOT OBSERVED");
    var suspicion = ((graphGrowth && !audioFinalDiagnosticState.appDuplicateCreationSeen) ||
      audioFinalDiagnosticState.interruptedCount > 0 || pendingMax >= 3000) ? "HIGH" : "UNDETERMINED";
    return {
      version: AUDIO_FINAL_ISOLATION_DIAGNOSTIC_VERSION,
      runId: audioFinalDiagnosticState.runId,
      mediaElementSourceCreates: audioFinalDiagnosticState.mediaElementSourceCreates,
      gainCreates: audioFinalDiagnosticState.gainCreates,
      connectCalls: audioFinalDiagnosticState.connectCalls,
      disconnectCalls: audioFinalDiagnosticState.disconnectCalls,
      duplicateConnectPairSeen: duplicatePair,
      bgmSourceCount: identity.bgmSourceCount,
      activeSourceCount: identity.activeSourceCount,
      bgmNodeCount: identity.bgmNodeCount,
      activeNodeCount: identity.activeNodeCount,
      maxSourceCount: audioFinalDiagnosticState.maxSourceCount,
      maxNodeCount: audioFinalDiagnosticState.maxNodeCount,
      contextIdentity: reloadObjectIdentity(context, "context"),
      contextState: context ? (context.state || "unknown") : "uninitialized",
      canonicalContextMatch: context ? context === canonicalAudioContext : null,
      interruptedCount: audioFinalDiagnosticState.interruptedCount,
      resumePendingMaxMs: pendingMax,
      monsterSe: audioFinalDiagnosticState.lastMonsterSe,
      appDuplicateCreation: appDuplicate,
      audioGraphGrowth: graphGrowth ? "DETECTED" : "NOT OBSERVED",
      webkitAudioSessionSuspicion: suspicion
    };
  }

  function audioFinalDiagnosticLines() {
    var summary = audioFinalDiagnosticSummary();
    var monster = summary.monsterSe;
    return [
      "================ AUDIO FINAL DIAGNOSTIC ================",
      summary.version + " | " + summary.runId,
      "FACTORY: MediaElementSource=" + summary.mediaElementSourceCreates +
        " Gain=" + summary.gainCreates + " connect=" + summary.connectCalls +
        " disconnect=" + summary.disconnectCalls + " duplicateConnectPair=" +
        summary.duplicateConnectPairSeen,
      "BGM GRAPH: sources=" + summary.bgmSourceCount + "/" + summary.activeSourceCount +
        " nodes=" + summary.bgmNodeCount + "/" + summary.activeNodeCount +
        " max=" + summary.maxSourceCount + "/" + summary.maxNodeCount,
      "CONTEXT: " + stringifyTraceValue(summary.contextIdentity) + " state=" +
        summary.contextState + " canonical=" + stringifyTraceValue(summary.canonicalContextMatch) +
        " interrupted=" + summary.interruptedCount + " resumePendingMax=" +
        summary.resumePendingMaxMs + "ms",
      "MONSTER SE: " + (monster ? stringifyTraceValue(monster.seName) + " play=" +
        monster.playResult + " audible=" + monster.audible + " ctx=" + monster.contextState +
        " canonical=" + stringifyTraceValue(monster.canonicalContextMatch) + " source/gain=" +
        stringifyTraceValue(monster.sourceIdentity) + "/" + stringifyTraceValue(monster.gainIdentity) +
        "@" + stringifyTraceValue(monster.gainValue) + " bgm/seGraphs=" +
        monster.activeBgmGraphCount + "/" + monster.activeSeGraphCount : "none"),
      "APP DUPLICATE CREATION: " + summary.appDuplicateCreation,
      "AUDIO GRAPH GROWTH: " + summary.audioGraphGrowth,
      "WEBKIT / AUDIO SESSION SUSPICION: " + summary.webkitAudioSessionSuspicion,
      "========================================================"
    ];
  }

  function speechResultAudioRouteLines() {
    var events = speechResultAudioRouteTraceState.events.slice(-16);
    var lines = [
      "Speech Result Audio Route Trace: " + SPEECH_RESULT_AUDIO_ROUTE_TRACE_VERSION,
      "SPEECH AUDIO ROUTE ORDER (latest " + events.length + "/" +
        SPEECH_RESULT_AUDIO_ROUTE_TRACE_LIMIT + "):"
    ];
    events.forEach(function (event) {
      lines.push(traceClock(event.at) + " " + event.checkpoint + " rec=" +
        stringifyTraceValue(event.recognitionInstanceIdentity) + " event=" +
        stringifyTraceValue(event.recognitionEvent) + " result=" +
        stringifyTraceValue(event.resultIndex) + "/" + stringifyTraceValue(event.resultsLength) +
        "/final=" + stringifyTraceValue(event.isFinal) + "/text=" +
        stringifyTraceValue(event.transcript) + " ctx=" + stringifyTraceValue(event.contextIdentity) +
        "/" + event.contextState + "@" + stringifyTraceValue(event.contextCurrentTime) +
        " sr/lat=" + stringifyTraceValue(event.contextSampleRate) + "/" +
        stringifyTraceValue(event.contextBaseLatency) + " session=" +
        stringifyTraceValue(event.audioSessionType) + "/" + stringifyTraceValue(event.audioSessionState));
      lines.push("  BGM el=" + stringifyTraceValue(event.bgmElementIdentity) + " asset/src=" +
        stringifyTraceValue(event.bgmAsset) + "/" + stringifyTraceValue(event.bgmSrc) +
        " currentSrc=" + stringifyTraceValue(event.bgmCurrentSrc) + " t=" +
        stringifyTraceValue(event.bgmCurrentTime) + " pause/end/mute/vol=" +
        stringifyTraceValue(event.bgmPaused) + "/" + stringifyTraceValue(event.bgmEnded) +
        "/" + stringifyTraceValue(event.bgmMuted) + "/" + stringifyTraceValue(event.bgmVolume) +
        " ready/net=" + stringifyTraceValue(event.bgmReadyState) + "/" +
        stringifyTraceValue(event.bgmNetworkState) + " graph=" +
        stringifyTraceValue(event.sourceIdentity) + ">" + stringifyTraceValue(event.gainIdentity) +
        "@" + stringifyTraceValue(event.gainValue) + " ctx=" +
        stringifyTraceValue(event.graphContextIdentity) + "/canonical=" +
        stringifyTraceValue(event.canonicalContextMatch) + " sources=" + event.bgmSourceCount +
        "/" + event.managedSourceCount + " nodes=" + event.bgmNodeCount + "/" +
        event.managedNodeCount);
    });
    return lines;
  }

  function renderVoiceRuntimeTracePanel() {
    if (!voiceRuntimeTraceState.panelEnabled || !window.document || !document.body) return;
    var panel = document.getElementById("gainnode-runtime-trace-panel");
    if (!panel) {
      panel = document.createElement("details");
      panel.id = "gainnode-runtime-trace-panel";
      panel.open = true;
      panel.style.cssText = "position:fixed;left:3px;right:3px;top:max(4px,env(safe-area-inset-top));z-index:2147483647;max-height:72vh;overflow:hidden;background:rgba(0,0,0,.86);color:#9ff;font:6.5px/1.05 monospace;padding:2px;border:1px solid #4cc;white-space:pre-wrap;pointer-events:none";
      var summary = document.createElement("summary");
      summary.textContent = "iPhone Audio Output Signal Trace";
      panel.appendChild(summary);
      var output = document.createElement("pre");
      output.id = "gainnode-runtime-trace-output";
      output.style.cssText = "margin:6px 0 0;white-space:pre-wrap";
      panel.appendChild(output);
      document.body.appendChild(panel);
    }
    var signalTrace = signalTraceSnapshot();
    var snapshot = signalTrace.live;
    var context = contextLifecycleSnapshot();
    var page = documentLifecycleSnapshot();
    var currentBgm = snapshot.bgm;
    var motifLines = snapshot.motifs.map(function (audio) {
      var mix = audio.__eigoOneShotMix || {};
      var gain = finiteTraceNumber(mix.baseGain);
      return stringifyTraceValue(audio.__eigoTraceAssetId) + " #" + ensureAudioInstanceTrace(audio) +
        " playing=" + isAudioPlaying(audio) + " path=" + stringifyTraceValue(audio.__eigoAudioPath) +
        " fallback=" + (audio.__eigoAudioPath === "fallback") + " asset=" + stringifyTraceValue(gain) +
        " bus=" + stringifyTraceValue(snapshot.motifBus) + " effective=" + stringifyTraceValue(oneShotEffectiveGain(mix));
    });
    var outputNode = document.getElementById("gainnode-runtime-trace-output");
    if (!outputNode) return;
    var lifecycleLines = audioLifecycleTraceState.events.slice(-10).map(function (event) {
      var extra = "";
      if (event.orientation) extra += " " + event.orientation + " " + event.width + "x" + event.height;
      if (event.contextBefore !== undefined) extra += " " + event.contextBefore + ">" + event.contextAfter;
      if (event.previousState !== undefined) extra += " " + event.previousState + ">" + event.currentState;
      if (event.visibility) extra += " visibility=" + event.visibility + " hidden=" + event.hidden + " focus=" + event.focus;
      if (event.resumeCalled !== undefined) extra += " resume=" + event.resumeCalled;
      if (event.result) extra += " " + event.result;
      return traceClock(event.at) + " " + event.type + extra + " ctx=" + event.contextState +
        " session=" + stringifyTraceValue(event.audioSession) +
        " b/m/v=" + event.bgmPlaying + "/" + event.motifPlaying + "/" + event.voicePlaying;
    });
    var speechOrderLines = speechOrderTraceState.events.slice(-SPEECH_ORDER_DISPLAY_LIMIT).map(function (event) {
      var date = new Date(event.at || Date.now());
      var seconds = String(date.getSeconds()).padStart(2, "0") + "." +
        String(date.getMilliseconds()).padStart(3, "0");
      var label = SPEECH_ORDER_EVENT_LABELS[event.type] || event.type;
      if (event.type === "recognition-result") label += event.final === true ? "-final" : "-interim";
      return seconds + " " + label + " session=" + stringifyTraceValue(event.audioSession);
    });
    var micReleaseVersion = window.MicReleaseTrace && MicReleaseTrace.version ||
      "iphone-speech-native-mic-release-boundary-trace-v1";
    var micReleaseEvents = window.MicReleaseTrace && typeof MicReleaseTrace.events === "function" ?
      MicReleaseTrace.events() : [];
    var micReleaseLines = micReleaseEvents.slice(-32).map(function (event) {
      var stopReason = event.stopReason ? " reason=" + event.stopReason : "";
      var error = event.error ? " error=" + event.error : "";
      return traceClock(event.at) + " " + stringifyTraceValue(event.instanceId) + " " + event.type +
        " active=" + stringifyTraceValue(event.activeRecognitionId) + "/null=" + event.activeRecognitionNull +
        " ctx=" + event.audioContextState + " speech=" + event.speechModeState + " session=" +
        event.audioSessionType + "/" + event.audioSessionState + stopReason + error;
    });
    var restoreTimingLines = audioRestoreTimingTraceState.events.slice(-32).map(function (event) {
      return traceClock(event.at) + " " + event.type + " mode=" + event.diagnosticMode +
        " elapsed=" + stringifyTraceValue(event.elapsedFromOnend) + "ms ctx=" + event.audioContextState +
        " session=" + event.audioSession + " bgm=" + stringifyTraceValue(event.bgmAsset) +
        "/" + stringifyTraceValue(event.bgmSrc) + " gain=" + stringifyTraceValue(event.bgmTrackGain) +
        "/" + stringifyTraceValue(event.bgmBusGain) + "/" + stringifyTraceValue(event.bgmEffectiveGain) +
        "/" + stringifyTraceValue(event.masterGain) + " graph=" + event.graph + " fallback=" + event.fallback;
    });
    var initialUnlockLines = initialAudioUnlockTraceState.events.slice(-24).map(function (event) {
      return traceClock(event.at) + " " + event.type +
        (event.eventType ? " type=" + event.eventType + " trusted=" + event.isTrusted : "") +
        (event.result ? " result=" + event.result : "") +
        " ctx=" + event.contextState + "@" + stringifyTraceValue(event.contextCurrentTime) +
        " pico=" + stringifyTraceValue(event.picoSe && event.picoSe.currentTime) +
        "/" + stringifyTraceValue(event.picoSe && event.picoSe.paused) +
        "/" + stringifyTraceValue(event.picoSe && event.picoSe.playing) +
        "/rs" + stringifyTraceValue(event.picoSe && event.picoSe.readyState) +
        " zephyr=" + stringifyTraceValue(event.zephyr && event.zephyr.currentTime) +
        "/" + stringifyTraceValue(event.zephyr && event.zephyr.paused) +
        "/" + stringifyTraceValue(event.zephyr && event.zephyr.playing) +
        "/rs" + stringifyTraceValue(event.zephyr && event.zephyr.readyState);
    });
    var initialUnlockLive = initialAudioUnlockSnapshot();
    var speechResultRouteLines = speechResultAudioRouteLines();
    var loudGraphLive = loudAudioGraphDetailSnapshot();
    var loudGraphLines = loudAudioGraphDetailLines(loudGraphLive);
    var reloadIdentityLines = reloadAudioIdentityTraceState.events.slice(-18).map(function (event) {
      return traceClock(event.at) + " " + event.checkpoint + " nav=" + event.navigationType +
        " ctx=" + stringifyTraceValue(event.contextIdentity) + "/" + event.contextState + "@" +
        stringifyTraceValue(event.contextCurrentTime) + " el=" + stringifyTraceValue(event.elementIdentity) +
        " asset=" + stringifyTraceValue(event.bgmAsset) + " t=" + stringifyTraceValue(event.elementCurrentTime) +
        " paused/vol/mute=" + stringifyTraceValue(event.elementPaused) + "/" +
        stringifyTraceValue(event.elementVolume) + "/" + stringifyTraceValue(event.elementMuted) +
        " src=" + stringifyTraceValue(event.sourceIdentity) + " gain=" +
        stringifyTraceValue(event.gainIdentity) + "/" + stringifyTraceValue(event.gainValue) +
        " graphCtx=" + stringifyTraceValue(event.graphContextIdentity) + " canonical=" +
        stringifyTraceValue(event.canonicalContextMatch) + " sources=" + event.bgmSourceCount + "/" +
        event.activeSourceCount + " nodes=" + event.bgmNodeCount + "/" + event.activeNodeCount +
        " focus=" + stringifyTraceValue(event.focusElementIdentity) + "/" +
        stringifyTraceValue(event.focusSourceIdentity) + "/" + stringifyTraceValue(event.focusGainIdentity) +
        "/" + stringifyTraceValue(event.focusGainValue) + "/canonical=" +
        stringifyTraceValue(event.focusCanonicalContextMatch);
    });
    var reloadIdentityLive = reloadAudioIdentitySnapshot();
    var finalDiagnosticLines = audioFinalDiagnosticLines();
    var lines = finalDiagnosticLines.concat(speechResultRouteLines).concat(loudGraphLines).concat([
      "Reload Audio Identity Trace: " + RELOAD_AUDIO_IDENTITY_TRACE_VERSION + " | " +
        reloadIdentityLive.pageLoadId + " | nav=" + reloadIdentityLive.navigationType,
      "IDENTITY LIVE: ctx=" + stringifyTraceValue(reloadIdentityLive.contextIdentity) + "/" +
        reloadIdentityLive.contextState + "@" + stringifyTraceValue(reloadIdentityLive.contextCurrentTime) +
        " el=" + stringifyTraceValue(reloadIdentityLive.elementIdentity) + " src=" +
        stringifyTraceValue(reloadIdentityLive.sourceIdentity) + " gain=" +
        stringifyTraceValue(reloadIdentityLive.gainIdentity) + "/" + stringifyTraceValue(reloadIdentityLive.gainValue) +
        " canonical=" + stringifyTraceValue(reloadIdentityLive.canonicalContextMatch) +
        " sources=" + reloadIdentityLive.bgmSourceCount + "/" + reloadIdentityLive.activeSourceCount +
        " nodes=" + reloadIdentityLive.bgmNodeCount + "/" + reloadIdentityLive.activeNodeCount,
      "RELOAD IDENTITY CHECKPOINTS (latest " + reloadIdentityLines.length + "/" +
        RELOAD_AUDIO_IDENTITY_TRACE_LIMIT + "):"
    ]).concat(reloadIdentityLines).concat([
      "Initial Audio Unlock Trace: " + INITIAL_AUDIO_UNLOCK_TRACE_VERSION,
      "INITIAL LIVE: ctx=" + initialUnlockLive.contextState + "@" +
        stringifyTraceValue(initialUnlockLive.contextCurrentTime) + " pico=" +
        stringifyTraceValue(initialUnlockLive.picoSe.currentTime) + "/" +
        stringifyTraceValue(initialUnlockLive.picoSe.paused) + "/" +
        stringifyTraceValue(initialUnlockLive.picoSe.playing) + "/rs" +
        stringifyTraceValue(initialUnlockLive.picoSe.readyState) + " zephyr=" +
        stringifyTraceValue(initialUnlockLive.zephyr.currentTime) + "/" +
        stringifyTraceValue(initialUnlockLive.zephyr.paused) + "/" +
        stringifyTraceValue(initialUnlockLive.zephyr.playing) + "/rs" +
        stringifyTraceValue(initialUnlockLive.zephyr.readyState),
      "INITIAL UNLOCK ORDER (latest " + initialUnlockLines.length + "/" +
        INITIAL_AUDIO_UNLOCK_TRACE_LIMIT + "):"
    ]).concat(initialUnlockLines).concat([
      "Runtime: " + RUNTIME_VERSION + " | Signal: " + SIGNAL_TRACE_VERSION,
      "Audio Restore Timing A/B: " + AUDIO_RESTORE_TIMING_TRACE_VERSION + " | mode=" +
        speechRestoreDiagnosticMode() + " | delay=" + speechRestoreDiagnosticDelayMs() + "ms",
      "AUDIO RESTORE TIMING A/B (latest " + restoreTimingLines.length + "/" +
        AUDIO_RESTORE_TIMING_TRACE_LIMIT + "):"
    ].concat(restoreTimingLines).concat([
      "Mic Release Trace: " + micReleaseVersion,
      "MIC RELEASE ORDER (latest " + micReleaseLines.length + "/64):"
    ]).concat(micReleaseLines).concat([
      "Speech Trace: " + SPEECH_TRACE_VERSION,
      "SPEECH ORDER (latest " + speechOrderLines.length + "/" + SPEECH_ORDER_STORAGE_LIMIT + "):"
    ]).concat(speechOrderLines).concat([
      "CTX: " + context.state + " #" + stringifyTraceValue(context.id) + " t=" + stringifyTraceValue(context.currentTime) +
        " statechanges=" + audioLifecycleTraceState.stateChangeCount + " suspendSeen=" + audioLifecycleTraceState.suspendSeen +
        " recovery=" + audioLifecycleTraceState.recoveryRequired,
      "PAGE: " + page.visibility + "/hidden=" + stringifyTraceValue(page.hidden) + "/focus=" + stringifyTraceValue(page.focus) +
        " | ORIENT: " + currentOrientation() + " " + (Number(window.innerWidth) || 0) + "x" + (Number(window.innerHeight) || 0),
      "GESTURE: " + audioLifecycleTraceState.lastGestureType + " @" +
        (audioLifecycleTraceState.lastGestureAt ? traceClock(audioLifecycleTraceState.lastGestureAt) : "-") +
        " ctx=" + audioLifecycleTraceState.lastGestureContextState + " | RESUME: calls=" + audioLifecycleTraceState.resumeCalls + " success=" + audioLifecycleTraceState.resumeSuccess +
        " reject=" + audioLifecycleTraceState.resumeReject + " last=" + audioLifecycleTraceState.lastResumeResult + " @" +
        (audioLifecycleTraceState.lastResumeAt ? traceClock(audioLifecycleTraceState.lastResumeAt) : "-"),
      "MASTER: peak=" + stringifyTraceValue(signalTrace.master.peak) + " rms=" + stringifyTraceValue(signalTrace.master.rms) +
        " signal=" + signalTrace.master.signal + " seen=" + signalTrace.master.signalSeen + " last=" +
        (signalTrace.master.lastSignalTime ? traceClock(signalTrace.master.lastSignalTime) : "-"),
      "SIGNAL STATUS: " + signalTrace.status + " | running-active-check=" + signalTrace.runningActiveCheck +
        " | high-output=" + signalTrace.highOutput,
      "RECOVERY: state=" + centralRecoveryState.state + " attempt=" + centralRecoveryState.attempt +
        " reason=" + stringifyTraceValue(centralRecoveryState.reason) + " last=" +
        stringifyTraceValue(centralRecoveryState.lastResult) + " context=" +
        stringifyTraceValue(context.id),
      currentBgm ? "BGM: " + stringifyTraceValue(currentBgm.asset) + " playing=" + currentBgm.playing +
        " graph=" + (currentBgm.path === "web-audio") + " fallback=" + currentBgm.fallback +
        " time=" + stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.currentTime) + "/" +
        stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.duration) + " moving=" +
        stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.moving) + " paused=" + currentBgm.paused +
        " ended=" + stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.ended) + " ready/net=" +
        stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.readyState) + "/" +
        stringifyTraceValue(signalTrace.bgm.media && signalTrace.bgm.media.networkState) : "BGM: none",
      currentBgm ? "BGM SIG: source=" + stringifyTraceValue(signalTrace.bgm.source.peak) + "/" +
        stringifyTraceValue(signalTrace.bgm.source.rms) + " bus=" + stringifyTraceValue(signalTrace.bgm.bus.peak) + "/" +
        stringifyTraceValue(signalTrace.bgm.bus.rms) + " gain track/bus/eff=" + stringifyTraceValue(currentBgm.trackGain) + "/" +
        stringifyTraceValue(currentBgm.busGain) + "/" + stringifyTraceValue(currentBgm.effectiveGain) : "BGM SIG: -",
      "VOICE: " + (signalTrace.voice.meta ? "playing=" + signalTrace.voice.playing + " character=" +
        stringifyTraceValue(signalTrace.voice.meta.character) + " asset=" + stringifyTraceValue(signalTrace.voice.meta.asset) +
        " path=" + stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.path) + " graph=" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.path === "web-audio") + " fallback=" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.path === "fallback") + " time=" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.currentTime) + "/" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.duration) + " paused/ended=" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.paused) + "/" +
        stringifyTraceValue(signalTrace.voice.media && signalTrace.voice.media.ended) : "none"),
      "VOICE SIG: source=" + stringifyTraceValue(signalTrace.voice.source.peak) + "/" +
        stringifyTraceValue(signalTrace.voice.source.rms) + " bus=" + stringifyTraceValue(signalTrace.voice.bus.peak) + "/" +
        stringifyTraceValue(signalTrace.voice.bus.rms) + " gain C/P/V=" +
        stringifyTraceValue(signalTrace.voice.meta && signalTrace.voice.meta.characterGain) + "/" +
        stringifyTraceValue(signalTrace.voice.meta && signalTrace.voice.meta.processingGain) + "/" +
        stringifyTraceValue(snapshot.voiceBusGain),
      "RESIDUAL: voice=" + signalTrace.residualVoice + " signal-lost=" + signalTrace.voiceSignalLost +
        (signalTrace.status === "KONG RESIDUAL SIGNAL" ? " KONG RESIDUAL SIGNAL" : ""),
      "MOTIF: " + (motifLines.length ? motifLines.join("\nMOTIF: ") : "none"),
      "COUNT: all=" + snapshot.playing.length + " bgm=" + snapshot.bgmPlaying.length +
        " motif=" + snapshot.motifs.length + " voice=" + snapshot.voicePlaying.length +
        " same-src-max=" + snapshot.sameSourceMax + " (" + snapshot.sameSourceName + ")",
      "EVENT LOG (latest " + lifecycleLines.length + "):"
    ]));
    outputNode.textContent = lines.concat(lifecycleLines).join("\n");
  }

  function startAudioLiveTracePanel() {
    if (!voiceRuntimeTraceState.panelEnabled || !window.document) return;
    function start() {
      renderVoiceRuntimeTracePanel();
      if (!audioLiveTraceTimer && typeof window.setInterval === "function") {
        audioLiveTraceTimer = window.setInterval(renderVoiceRuntimeTracePanel, 250);
      }
    }
    if (document.body) start();
    else if (typeof document.addEventListener === "function") document.addEventListener("DOMContentLoaded", start, { once: true });
  }

  function voiceRuntimeTrace(event, detail) {
    updateVoiceRuntimeLatch(event, detail);
    var record = { event: event, at: Date.now(), detail: detail || {} };
    voiceRuntimeTraceState.latest = record;
    voiceRuntimeTraceState.history.push(record);
    if (voiceRuntimeTraceState.history.length > 200) voiceRuntimeTraceState.history.shift();
    try { console.log("[GAINNODE VOICE TRACE] " + event, record.detail); } catch (_) {}
    renderVoiceRuntimeTracePanel();
  }

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

  function isRecoverableAudioContextState(state) {
    return state === "suspended" || state === "interrupted";
  }

  function getCanonicalAudioContext() {
    if (canonicalAudioContext) return canonicalAudioContext;
    var ContextType = audioContextType();
    if (!ContextType) return null;
    try {
      canonicalAudioContext = new ContextType();
      canonicalAudioContext.__eigoTraceContextId = "canonical-context-" + (++audioContextTraceSerial);
      var observedContext = canonicalAudioContext;
      audioLifecycleTraceState.lastContextState = canonicalAudioContext.state || "unknown";
      if (canonicalAudioContext.state === "suspended") audioLifecycleTraceState.suspendSeen = true;
      if (typeof canonicalAudioContext.addEventListener === "function") {
        canonicalAudioContext.addEventListener("statechange", function () {
          if (canonicalAudioContext !== observedContext) return;
          var previous = audioLifecycleTraceState.lastContextState;
          var current = observedContext.state || "unknown";
          if (current === "interrupted") audioFinalDiagnosticState.interruptedCount += 1;
          audioLifecycleTraceState.stateChangeCount += 1;
          audioLifecycleTraceState.lastContextState = current;
          if (current === "suspended") audioLifecycleTraceState.suspendSeen = true;
          if (isRecoverableAudioContextState(current)) {
            audioOutputRecoveryRequired = true;
            audioLifecycleTraceState.recoveryRequired = true;
            unlockComplete = false;
            installUnlockGesture();
          }
          recordAudioLifecycleEvent("context-statechange", { previousState: previous, currentState: current });
          recordReloadAudioIdentityCheckpoint("audio-context-statechange", {
            previousState: previous,
            currentState: current
          });
          recordFinalDiagnosticEvent("audio-context-statechange", {
            context: observedContext,
            oldState: previous,
            newState: current,
            speechActive: speechIsolation.state !== "idle",
            bgmPlaying: isAudioPlaying(bgm),
            seRequestActive: audioFinalDiagnosticState.activeSeRequests > 0
          });
        });
      }
      audioTrace("AUDIO_RUNTIME_VERSION", { version: RUNTIME_VERSION });
      audioTrace("AUDIO_CONTEXT_STATE", { state: canonicalAudioContext.state || "unknown" });
      recordAudioLifecycleEvent("context-created", { currentState: canonicalAudioContext.state || "unknown" });
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
    var master = finalDiagnosticCreateGain(context, { role: "master", reason: "canonical-bus" });
    var buses = {
      master: master,
      bgm: finalDiagnosticCreateGain(context, { role: "bgm-bus", reason: "canonical-bus" }),
      motif: finalDiagnosticCreateGain(context, { role: "motif-bus", reason: "canonical-bus" }),
      voice: finalDiagnosticCreateGain(context, { role: "voice-bus", reason: "canonical-bus" }),
      se: finalDiagnosticCreateGain(context, { role: "se-bus", reason: "canonical-bus" }),
      effectVoice: finalDiagnosticCreateGain(context, { role: "effect-voice-bus", reason: "canonical-bus" })
    };
    setGainValue(master, 1);
    setGainValue(buses.bgm, 1);
    setGainValue(buses.motif, 1);
    setGainValue(buses.voice, groupGain("VOICE"));
    setGainValue(buses.se, groupGain("SE"));
    setGainValue(buses.effectVoice, groupGain("VOICE"));
    finalDiagnosticConnect(buses.bgm, master, { role: "bgm-bus", reason: "canonical-bus-route" });
    finalDiagnosticConnect(buses.motif, master, { role: "motif-bus", reason: "canonical-bus-route" });
    finalDiagnosticConnect(buses.voice, master, { role: "voice-bus", reason: "canonical-bus-route" });
    finalDiagnosticConnect(buses.se, master, { role: "se-bus", reason: "canonical-bus-route" });
    finalDiagnosticConnect(buses.effectVoice, master, { role: "effect-voice-bus", reason: "canonical-bus-route" });
    finalDiagnosticConnect(master, context.destination, { role: "master", reason: "canonical-destination-route" });
    if (voiceRuntimeTraceState.panelEnabled) {
      canonicalSignalAnalysers = {
        master: createSignalTraceAnalyser(context, master),
        bgm: createSignalTraceAnalyser(context, buses.bgm),
        voice: createSignalTraceAnalyser(context, buses.voice)
      };
    }
    canonicalBuses = buses;
    return buses;
  }

  async function ensureCanonicalAudioContextRunning() {
    var context = getCanonicalAudioContext();
    if (!context) return false;
    recordAudioLifecycleEvent("audio-context-before-resume", { currentState: context.state || "unknown" });
    if (isRecoverableAudioContextState(context.state) && typeof context.resume === "function") {
      audioLifecycleTraceState.resumeCalls += 1;
      audioLifecycleTraceState.lastResumeAt = Date.now();
      audioLifecycleTraceState.lastResumeResult = "pending";
      if (initialAudioUnlockTraceState.firstTrustedPointerdownActive) {
        recordInitialAudioUnlockTrace("resume-called", { result: "pending" });
        recordInitialAudioUnlockTrace("resume-settlement-pending", { result: "pending" });
      }
      recordAudioLifecycleEvent("resume-call", { result: "pending" });
      recordAudioLifecycleEvent("audio-context-resume-call", { currentState: context.state || "unknown" });
      var finalDiagnosticResumeId = finalDiagnosticResumeCall(context);
      try {
        await context.resume();
        finalDiagnosticResumeSettlement(context, finalDiagnosticResumeId, "resolved");
        audioLifecycleTraceState.resumeSuccess += 1;
        audioLifecycleTraceState.lastResumeResult = "success";
        if (initialAudioUnlockTraceState.firstTrustedPointerdownActive) {
          recordInitialAudioUnlockTrace("resume-resolved", { result: "resolved" });
        }
        recordAudioLifecycleEvent("resume-success", { result: "success" });
        recordAudioLifecycleEvent("audio-context-resume-resolved", { currentState: context.state || "unknown" });
      } catch (error) {
        finalDiagnosticResumeSettlement(context, finalDiagnosticResumeId, "rejected", error);
        audioLifecycleTraceState.resumeReject += 1;
        audioLifecycleTraceState.lastResumeResult = "reject";
        if (initialAudioUnlockTraceState.firstTrustedPointerdownActive) {
          recordInitialAudioUnlockTrace("resume-rejected", { result: "rejected", error: String(error) });
        }
        recordAudioLifecycleEvent("resume-reject", { result: "reject", error: String(error) });
        recordAudioLifecycleEvent("audio-context-resume-rejected", {
          currentState: context.state || "unknown",
          error: String(error)
        });
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
    var currentContext = canonicalAudioContext;
    if (unlockComplete && !audioOutputRecoveryRequired &&
        !isRecoverableAudioContextState(currentContext && currentContext.state)) return Promise.resolve(true);
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
        if (contextRunning && (centralRecoveryState.state === "resume-pending" ||
            (centralRecoveryState.state === "failed" && centralRecoveryState.pendingBgmSnapshot))) {
          centralRecoveryState.state = "resume-pending";
          restoreCentralRecoveryBgm();
        }
        if (contextRunning && audioOutputRecoveryRequired) recoverCurrentBgmAfterContextResume();
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
    if (unlockGestureCleanup) return;
    var events = ["pointerdown", "touchend", "click", "keydown"];
    function cleanup() {
      events.forEach(function (name) { document.removeEventListener(name, trustedGesture, true); });
      unlockGestureCleanup = null;
    }
    function trustedGesture(event) {
      var before = audioLifecycleTraceState.resumeCalls;
      var firstTrustedPointerdown = !!(event && event.type === "pointerdown" && event.isTrusted === true &&
        !initialAudioUnlockTraceState.firstTrustedPointerdownSeen);
      if (firstTrustedPointerdown) {
        initialAudioUnlockTraceState.firstTrustedPointerdownSeen = true;
        initialAudioUnlockTraceState.firstTrustedPointerdownActive = true;
        recordInitialAudioUnlockTrace("first-trusted-pointerdown", {
          eventType: event.type,
          isTrusted: event.isTrusted,
          eventTimestamp: finiteTraceNumber(event.timeStamp)
        });
        recordInitialAudioUnlockTrace("before-resume", {
          eventType: event.type,
          isTrusted: event.isTrusted,
          eventTimestamp: finiteTraceNumber(event.timeStamp)
        });
        recordReloadAudioIdentityCheckpoint("trusted-pointerdown-before", {
          eventType: event.type,
          isTrusted: event.isTrusted,
          eventTimestamp: finiteTraceNumber(event.timeStamp)
        });
        recordReloadAudioIdentityCheckpoint("trusted-pointerdown", {
          eventType: event.type,
          isTrusted: event.isTrusted,
          eventTimestamp: finiteTraceNumber(event.timeStamp)
        });
      }
      audioLifecycleTraceState.lastGestureType = event && event.type || "unknown";
      audioLifecycleTraceState.lastGestureAt = Date.now();
      audioLifecycleTraceState.lastGestureContextState = contextLifecycleSnapshot().state;
      audioLifecycleTraceState.lastGestureResumeCalled = false;
      audioLifecycleTraceState.lastGestureResumeResult = "pending";
      recordAudioLifecycleEvent("trusted-gesture-" + audioLifecycleTraceState.lastGestureType);
      var result = unlock();
      Promise.resolve(result).then(function (success) {
        audioLifecycleTraceState.lastGestureResumeCalled = audioLifecycleTraceState.resumeCalls > before;
        audioLifecycleTraceState.lastGestureResumeResult = audioLifecycleTraceState.lastGestureResumeCalled ?
          audioLifecycleTraceState.lastResumeResult : (success ? "not-needed" : "not-called");
        recordAudioLifecycleEvent("trusted-gesture-result", {
          gesture: audioLifecycleTraceState.lastGestureType,
          resumeCalled: audioLifecycleTraceState.lastGestureResumeCalled,
          result: audioLifecycleTraceState.lastGestureResumeResult
        });
        if (firstTrustedPointerdown) {
          recordInitialAudioUnlockTrace("after-resume-settlement", {
            result: audioLifecycleTraceState.lastGestureResumeResult,
            success: success === true
          });
          recordReloadAudioIdentityCheckpoint("trusted-pointerdown-after", {
            result: audioLifecycleTraceState.lastGestureResumeResult,
            success: success === true
          });
          initialAudioUnlockTraceState.firstTrustedPointerdownActive = false;
        }
      });
      return result;
    }
    unlockGestureCleanup = cleanup;
    events.forEach(function (name) { document.addEventListener(name, trustedGesture, true); });
  }

  function installAudioLifecycleTraceListeners() {
    if (!voiceRuntimeTraceState.panelEnabled || !window.document) return;
    function pageEvent(event) {
      var page = documentLifecycleSnapshot();
      recordAudioLifecycleEvent(event.type, {
        visibility: page.visibility,
        hidden: page.hidden,
        focus: page.focus
      });
    }
    if (typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", pageEvent, true);
      ["pointerdown", "touchstart", "click", "keydown"].forEach(function (name) {
        document.addEventListener(name, function (event) {
          audioLifecycleTraceState.lastGestureType = event.type;
          audioLifecycleTraceState.lastGestureAt = Date.now();
          audioLifecycleTraceState.lastGestureContextState = contextLifecycleSnapshot().state;
          audioLifecycleTraceState.lastGestureResumeCalled = false;
          audioLifecycleTraceState.lastGestureResumeResult = "observed";
          recordAudioLifecycleEvent("gesture-" + event.type);
        }, true);
      });
    }
    if (typeof window.addEventListener === "function") {
      ["pageshow", "pagehide", "focus", "blur"].forEach(function (name) {
        window.addEventListener(name, pageEvent, true);
      });
      window.addEventListener("orientationchange", function () {
        recordOrientationLifecycleEvent("orientationchange");
      }, true);
      window.addEventListener("resize", function () {
        recordOrientationLifecycleEvent("resize");
      }, true);
    }
    try {
      if (window.screen && screen.orientation && typeof screen.orientation.addEventListener === "function") {
        screen.orientation.addEventListener("change", function () {
          recordOrientationLifecycleEvent("screen.orientation.change");
        });
      }
    } catch (_) {}
    recordAudioLifecycleEvent("trace-start", {
      orientation: currentOrientation(),
      width: Number(window.innerWidth) || 0,
      height: Number(window.innerHeight) || 0
    });
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

  function setSafeFallbackGain(audio, effectiveGain, category) {
    if (!audio || audio.__eigoGainControlFailed) return false;
    var requested = Math.max(0, Math.min(1, clampGain(effectiveGain)));
    try { audio.volume = requested; } catch (_) {}
    var observed = Number(audio.volume);
    var controlled = Number.isFinite(observed) && Math.abs(observed - requested) <= 0.001;
    if (!controlled) {
      audio.__eigoGainControlFailed = true;
      audio.__eigoPolicyMuted = true;
      try { audio.muted = true; } catch (_) {}
      try { audio.pause(); } catch (_) {}
      audioTrace("FALLBACK_GAIN_UNAVAILABLE", {
        category: category,
        requestedGain: requested,
        observedGain: Number.isFinite(observed) ? observed : null,
        action: "safe-suppress"
      });
      return false;
    }
    if (audio.__eigoPolicyMuted) {
      try { audio.muted = false; } catch (_) {}
      audio.__eigoPolicyMuted = false;
    }
    audio.__eigoEffectiveFallbackGain = requested;
    return true;
  }

  function bgmEffectiveGain(track) {
    if (speechIsolation.state !== "idle") return 0;
    return clampGain(track.baseVolume * track.envelope * policyMultiplier() * groupGain("BGM"));
  }

  function oneShotEffectiveGain(mix) {
    if (!mix) return 0;
    if (mix.category === "MOTIF") {
      return clampGain(mix.baseGain * motifDialogueMultiplier() * groupGain("MOTIF"));
    }
    if (mix.busName === "se") return clampGain(mix.baseGain * groupGain("SE"));
    return clampGain(mix.baseGain * groupGain("VOICE"));
  }

  function applyBgmFallbackGain(track) {
    if (speechIsolation.state !== "idle") {
      try { if (track) track.audio.pause(); } catch (_) {}
      return false;
    }
    return !!(track && setSafeFallbackGain(track.audio, bgmEffectiveGain(track), "BGM"));
  }

  function applyOneShotFallbackGain(audio) {
    if (speechIsolation.state !== "idle") return false;
    return !!(audio && audio.__eigoOneShotMix &&
      setSafeFallbackGain(audio, oneShotEffectiveGain(audio.__eigoOneShotMix), audio.__eigoOneShotMix.category));
  }

  function updateBusPolicy() {
    var isolated = speechIsolation.state !== "idle";
    if (canonicalBuses) {
      setGainValue(canonicalBuses.bgm, isolated ? 0 : policyMultiplier() * groupGain("BGM"));
      setGainValue(canonicalBuses.motif, isolated ? 0 : motifDialogueMultiplier() * groupGain("MOTIF"));
      setGainValue(canonicalBuses.voice, isolated ? 0 : groupGain("VOICE"));
      setGainValue(canonicalBuses.se, isolated ? 0 : groupGain("SE"));
      setGainValue(canonicalBuses.effectVoice, isolated ? 0 : groupGain("VOICE"));
    }
    bgmTracks.forEach(function (track) {
      var effective = bgmEffectiveGain(track);
      if (track.path === "fallback") {
        if (speechIsolation.state !== "idle") {
          // Pause is platform-independent; isolation never relies on volume.
          try { track.audio.pause(); } catch (_) {}
        } else applyBgmFallbackGain(track);
      }
      if (track.audio === bgm) {
        audioState.currentBgmAsset = track.asset;
        audioState.baseBgmVolume = track.baseVolume;
        audioState.effectiveBgmVolume = effective;
        audioState.fadeState = track.fadeState;
      }
      audioTrace("BGM_EFFECTIVE_GAIN", { asset: track.asset, gain: effective, path: track.path });
    });
    effects.concat(voices).forEach(function (audio) {
      if (audio && audio.__eigoAudioPath === "fallback" && audio.__eigoOneShotMix) {
        applyOneShotFallbackGain(audio);
      }
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
    if (audio && audio.__eigoFinalDiagnosticMonsterSe) {
      audioFinalDiagnosticState.activeSeRequests += 1;
      recordFinalDiagnosticMonsterSe(audio, "call");
    }
    if (speechIsolation.state !== "idle") {
      if (audio.__eigoBgmTrack) {
        try { audio.pause(); } catch (_) {}
      } else stop(audio);
      audio.__eigoPlaybackOutcome = Promise.resolve({ ok: true, suppressed: true, error: null });
      if (audio.__eigoFinalDiagnosticMonsterSe) {
        audioFinalDiagnosticState.activeSeRequests = Math.max(0, audioFinalDiagnosticState.activeSeRequests - 1);
        recordFinalDiagnosticMonsterSe(audio, "suppressed");
      }
      return audio;
    }
    var playback;
    try {
      if (audio.__eigoInitialAudioUnlockTarget) {
        recordInitialAudioUnlockTrace(audio.__eigoInitialAudioUnlockTarget.toLowerCase().replace(" ", "-") + "-play-call");
      }
      if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-call", audio.__eigoRadioTrace);
      if (audio.__eigoBgmTrack) {
        recordAudioLifecycleEvent("bgm-play-call", {
          asset: audio.__eigoBgmTrack.asset,
          instanceId: audio.__eigoTraceInstanceId || null
        });
      }
      var result = audio.play();
      if (audio.__eigoFinalDiagnosticMonsterSe) recordFinalDiagnosticMonsterSe(audio, "pending");
      if (result && typeof result.then === "function") {
        playback = Promise.resolve(result).then(function () {
        if (audio.__eigoFinalDiagnosticMonsterSe) {
          audioFinalDiagnosticState.activeSeRequests = Math.max(0, audioFinalDiagnosticState.activeSeRequests - 1);
          recordFinalDiagnosticMonsterSe(audio, "resolved");
        }
        if (audio.__eigoInitialAudioUnlockTarget) {
          recordInitialAudioUnlockTrace(audio.__eigoInitialAudioUnlockTarget.toLowerCase().replace(" ", "-") + "-play-resolved",
            { result: "resolved" });
        }
        if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-resolved", audio.__eigoRadioTrace);
        if (audio.__eigoBgmTrack) {
          recordAudioLifecycleEvent("bgm-play-resolved", {
            asset: audio.__eigoBgmTrack.asset,
            instanceId: audio.__eigoTraceInstanceId || null
          });
          recordReloadAudioIdentityCheckpoint("bgm-play-resolved-after", {
            asset: audio.__eigoBgmTrack.asset,
            instanceId: audio.__eigoTraceInstanceId || null
          }, audio);
        }
        if (audio.__eigoReloadIdentityTarget) {
          recordReloadAudioIdentityCheckpoint(audio.__eigoReloadIdentityTarget + "-after-play-resolved", null, audio);
        }
        if (audio.__eigoReloadIdentityTarget === "pico") {
          recordReloadAudioIdentityCheckpoint("pico-se-resolved-after", null, audio);
        }
        return { ok: true, error: null };
      }, function (error) {
        if (audio.__eigoFinalDiagnosticMonsterSe) {
          audioFinalDiagnosticState.activeSeRequests = Math.max(0, audioFinalDiagnosticState.activeSeRequests - 1);
          recordFinalDiagnosticMonsterSe(audio, "rejected", error);
        }
        if (audio.__eigoInitialAudioUnlockTarget) {
          recordInitialAudioUnlockTrace(audio.__eigoInitialAudioUnlockTarget.toLowerCase().replace(" ", "-") + "-play-rejected",
            { result: "rejected", error: String(error) });
        }
        if (audio.__eigoRadioTrace) voiceTrace("radio-audio-play-rejected", audio.__eigoRadioTrace, { error: String(error) });
        if (audio.__eigoBgmTrack) {
          recordAudioLifecycleEvent("bgm-play-rejected", {
            asset: audio.__eigoBgmTrack.asset,
            instanceId: audio.__eigoTraceInstanceId || null,
            error: String(error)
          });
        }
        if (audio.__eigoReloadIdentityTarget) {
          recordReloadAudioIdentityCheckpoint(audio.__eigoReloadIdentityTarget + "-play-rejected", {
            error: String(error)
          }, audio);
        }
        if (audio.__eigoReloadIdentityTarget === "pico") {
          recordReloadAudioIdentityCheckpoint("pico-se-rejected-after", { error: String(error) }, audio);
        }
        console.warn("Audio playback was blocked or failed:", error);
          return { ok: false, error: error };
        });
      } else {
        if (audio.__eigoFinalDiagnosticMonsterSe) {
          audioFinalDiagnosticState.activeSeRequests = Math.max(0, audioFinalDiagnosticState.activeSeRequests - 1);
          recordFinalDiagnosticMonsterSe(audio, "resolved");
        }
        playback = Promise.resolve({ ok: true, error: null });
      }
    } catch (error) {
      if (audio && audio.__eigoFinalDiagnosticMonsterSe) {
        audioFinalDiagnosticState.activeSeRequests = Math.max(0, audioFinalDiagnosticState.activeSeRequests - 1);
        recordFinalDiagnosticMonsterSe(audio, "rejected", error);
      }
      if (audio.__eigoInitialAudioUnlockTarget) {
        recordInitialAudioUnlockTrace(audio.__eigoInitialAudioUnlockTarget.toLowerCase().replace(" ", "-") + "-play-rejected",
          { result: "rejected", error: String(error) });
      }
      if (audio.__eigoBgmTrack) {
        recordAudioLifecycleEvent("bgm-play-rejected", {
          asset: audio.__eigoBgmTrack.asset,
          instanceId: audio.__eigoTraceInstanceId || null,
          error: String(error)
        });
      }
      if (audio.__eigoReloadIdentityTarget) {
        recordReloadAudioIdentityCheckpoint(audio.__eigoReloadIdentityTarget + "-play-rejected", {
          error: String(error)
        }, audio);
      }
      if (audio.__eigoReloadIdentityTarget === "pico") {
        recordReloadAudioIdentityCheckpoint("pico-se-rejected-after", { error: String(error) }, audio);
      }
      console.warn("Audio playback was blocked or failed:", error);
      playback = Promise.resolve({ ok: false, error: error });
    }
    audio.__eigoPlaybackOutcome = playback;
    return audio;
  }

  function disconnectNodes(nodes) {
    markObservedGraphsDisconnected(nodes || []);
    (nodes || []).forEach(function (node) {
      try { finalDiagnosticDisconnect(node, { role: "managed-graph", reason: "graph-cleanup" }); } catch (_) {}
    });
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
      traceAnalyser: null,
      nodes: [],
      path: "pending"
    };
    audio.__eigoBgmTrack = track;
    ensureAudioInstanceTrace(audio, asset, "BGM");
    if (typeof audio.addEventListener === "function") {
      audio.addEventListener("playing", function () {
        recordAudioLifecycleEvent("bgm-playing-event", {
          asset: track.asset,
          instanceId: audio.__eigoTraceInstanceId || null
        });
      });
    }
    audio.volume = 1;
    bgmTracks.push(track);
    return track;
  }

  function buildSimpleGraph(audio, busName, assetGain) {
    var context = getCanonicalAudioContext();
    var buses = createCanonicalBuses(context);
    if (!context || !buses || !buses[busName]) throw new Error("canonical-bus-unavailable");
    var role = busName === "bgm" ? "BGM" : (busName === "se" ? "SE" : busName);
    var gainNode = finalDiagnosticCreateGain(context, {
      role: role + "-track-gain",
      reason: "buildSimpleGraph"
    });
    setGainValue(gainNode, assetGain);
    finalDiagnosticConnect(gainNode, buses[busName], {
      role: role,
      reason: "track-gain-to-canonical-bus"
    });
    var source = null;
    try {
      source = finalDiagnosticCreateMediaElementSource(context, audio, {
        role: role,
        reason: "buildSimpleGraph"
      });
      finalDiagnosticConnect(source, gainNode, {
        role: role,
        reason: "media-source-to-track-gain"
      });
    } catch (error) {
      disconnectNodes(source ? [source, gainNode] : [gainNode]);
      error.__eigoSourceAttempted = true;
      throw error;
    }
    var nodes = [source, gainNode];
    observeExistingAudioGraph(audio, context, source, gainNode, nodes, busName);
    updateFinalDiagnosticGraphMax();
    return { source: source, gainNode: gainNode, nodes: nodes };
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
        replacement.__eigoBgmTrack = track;
        ensureAudioInstanceTrace(replacement, track.asset, "BGM");
        if (track.asset === "zephyrFields") trackInitialAudioUnlockTarget(replacement, "ZEPHYR");
        track.audio = replacement;
        bgm = replacement;
      }
      track.path = "fallback";
      track.traceAnalyser = null;
      audioTrace("BGM_PATH", { asset: track.asset, path: "fallback", reason: reason });
      audioTrace("GAINNODE_FALLBACK", { category: "BGM", asset: track.asset, reason: reason, error: error ? String(error) : null });
      if (applyBgmFallbackGain(track)) {
        noteAudioLiveStart(track.audio, track.asset, "BGM");
        safePlay(track.audio);
        watchBgmPlayback(track.audio, requestId);
      }
    }
    function connectAndPlay() {
      var graph = buildSimpleGraph(original, "bgm", track.baseVolume * track.envelope);
      track.gainNode = graph.gainNode;
      track.traceAnalyser = createSignalTraceAnalyser(getCanonicalAudioContext(), graph.source);
      if (track.traceAnalyser) graph.nodes.push(track.traceAnalyser);
      track.nodes = graph.nodes;
      track.path = "web-audio";
      audioTrace("BGM_PATH", { asset: track.asset, path: "web-audio" });
      applyBgmTrackGain(track);
      noteAudioLiveStart(original, track.asset, "BGM");
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
    if (speechIsolation.state !== "idle") return;
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
    var context = canonicalAudioContext;
    if (isRecoverableAudioContextState(context && context.state)) {
      audioOutputRecoveryRequired = true;
      audioLifecycleTraceState.recoveryRequired = true;
      unlockComplete = false;
      installUnlockGesture();
      return false;
    }
    safePlay(pending.audio);
    watchBgmPlayback(pending.audio, pending.requestId);
    return true;
  }

  function recoverCurrentBgmAfterContextResume() {
    if (!audioOutputRecoveryRequired) return false;
    audioOutputRecoveryRequired = false;
    audioLifecycleTraceState.recoveryRequired = false;
    var current = bgm;
    var track = current && current.__eigoBgmTrack;
    if (!current || !track || current.__eigoStopped === true || bgmTracks.indexOf(track) === -1) {
      recordAudioLifecycleEvent("recovery-no-active-bgm");
      return false;
    }
    var pending = !!(pendingBgm && pendingBgm.audio === current);
    var replayRequired = current.paused === true || current.ended === true || pending;
    if (!replayRequired) {
      recordAudioLifecycleEvent("recovery-bgm-already-playing", { asset: track.asset });
      return false;
    }
    if (pending) clearPendingBgm();
    var requestId = ++bgmRequestSerial;
    if (current.ended === true) {
      try { current.currentTime = 0; } catch (_) {}
    }
    recordAudioLifecycleEvent("recovery-bgm-replay", { asset: track.asset, instanceId: current.__eigoTraceInstanceId });
    if (track.path === "pending") {
      connectBgmTrack(track, requestId);
      return true;
    }
    if (track.path === "fallback" && !applyBgmFallbackGain(track)) return false;
    noteAudioLiveStart(current, track.asset, "BGM");
    safePlay(current);
    watchBgmPlayback(current, requestId);
    return true;
  }

  function playBgm(keyOrPath, options) {
    options = options || {};
    recordReloadAudioIdentityCheckpoint("bgm-play-request-before", { asset: keyOrPath });
    if (keyOrPath === "morningGardenAtmosphere") {
      recordReloadAudioIdentityCheckpoint("morning-bgm-before");
    }
    resetHeldSpeechPolicy();
    var path = resolve("bgm", keyOrPath);
    if (keyOrPath === "zephyrFields") recordInitialAudioUnlockTrace("zephyr-request");
    var targetVolume = (options.volume === undefined ? 1 : options.volume) * mixAssetGain(keyOrPath);
    if (bgm && bgm.src && bgm.getAttribute("src") === path) {
      if (keyOrPath === "morningGardenAtmosphere") markReloadAudioIdentityTarget(bgm, "morning-bgm");
      if (keyOrPath === "zephyrFields") trackInitialAudioUnlockTarget(bgm, "ZEPHYR");
      var replayRequired = bgm.paused === true || bgm.ended === true ||
        !!(pendingBgm && pendingBgm.audio === bgm);
      clearPendingBgm();
      var existingTrack = bgm.__eigoBgmTrack || createBgmTrack(bgm, keyOrPath, targetVolume, 1);
      if (options.fadeInMs) animateTrack(existingTrack, "baseVolume", targetVolume, options.fadeInMs, "base-volume");
      else { existingTrack.baseVolume = targetVolume; existingTrack.envelope = 1; applyBgmTrackGain(existingTrack); }
      if (replayRequired) {
        var replayRequestId = ++bgmRequestSerial;
        if (bgm.ended === true) {
          try { bgm.currentTime = 0; } catch (_) {}
        }
        if (existingTrack.path === "pending") connectBgmTrack(existingTrack, replayRequestId);
        else if (existingTrack.path !== "fallback" || applyBgmFallbackGain(existingTrack)) {
          noteAudioLiveStart(bgm, existingTrack.asset, "BGM");
          safePlay(bgm);
          watchBgmPlayback(bgm, replayRequestId);
        }
      }
      if (keyOrPath === "morningGardenAtmosphere") {
        recordReloadAudioIdentityCheckpoint("morning-bgm-after-request", null, bgm);
      }
      return bgm;
    }
    clearPendingBgm();
    var requestId = ++bgmRequestSerial;
    var previous = bgm;
    var next = new Audio(path);
    if (keyOrPath === "morningGardenAtmosphere") markReloadAudioIdentityTarget(next, "morning-bgm");
    if (keyOrPath === "zephyrFields") trackInitialAudioUnlockTarget(next, "ZEPHYR");
    next.loop = options.loop !== false;
    next.preload = "auto";
    var nextTrack = createBgmTrack(next, keyOrPath, targetVolume, options.fadeInMs || options.crossfadeMs ? 0 : 1);
    bgm = next;
    connectBgmTrack(nextTrack, requestId);
    if (keyOrPath === "morningGardenAtmosphere") {
      recordReloadAudioIdentityCheckpoint("morning-bgm-after-request", null, next);
    }
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
    if (type === "se" && keyOrPath === "picoEntrance") {
      recordReloadAudioIdentityCheckpoint("pico-before");
      recordReloadAudioIdentityCheckpoint("pico-se-request-before", { asset: keyOrPath });
    }
    var path = resolve(type, keyOrPath);
    if (isZephyrMotif(type, keyOrPath, path)) {
      var active = collection.find(function (item) { return item.getAttribute("src") === path && !item.paused; });
      if (active) return active;
    }
    var policy = oneShotPolicy(type, keyOrPath);
    var monsterSe = type === "se" && isMonsterSeAsset(keyOrPath);
    var baseGain = clampGain((options.volume === undefined ? 1 : options.volume) * mixAssetGain(keyOrPath));
    var busName = policy.category === "MOTIF" ? "motif" : (type === "se" ? "se" : "effectVoice");
    var audio = null;
    function createTrackedAudio() {
      var candidate = new Audio(path);
      candidate.__eigoStopped = false;
      ensureAudioInstanceTrace(candidate, keyOrPath, policy.category);
      candidate.__eigoOneShotMix = { baseGain: baseGain, category: policy.category, busName: busName };
      candidate.__eigoFinalDiagnosticMonsterSe = monsterSe;
      candidate.volume = 1;
      candidate.preload = "auto";
      collection.push(candidate);
      candidate.addEventListener("ended", function () {
        if (candidate.__eigoFinalDiagnosticMonsterSe) recordFinalDiagnosticMonsterSe(candidate, "ended");
        var index = collection.indexOf(candidate);
        if (index !== -1) collection.splice(index, 1);
        if (typeof candidate.__eigoDisconnect === "function") candidate.__eigoDisconnect();
      }, { once: true });
      if (candidate.__eigoFinalDiagnosticMonsterSe) {
        candidate.addEventListener("playing", function () {
          recordFinalDiagnosticMonsterSe(candidate, "playing");
        });
        candidate.addEventListener("error", function () {
          recordFinalDiagnosticMonsterSe(candidate, "error", "audio-error");
        }, { once: true });
      }
      return candidate;
    }
    audio = createTrackedAudio();
    if (monsterSe) recordFinalDiagnosticMonsterSe(audio, "request");
    if (type === "se" && keyOrPath === "picoEntrance") {
      markReloadAudioIdentityTarget(audio, "pico");
      trackInitialAudioUnlockTarget(audio, "PICO SE");
      recordInitialAudioUnlockTrace("pico-appear");
      recordReloadAudioIdentityCheckpoint("pico-after-request", null, audio);
    }
    function fallback(error) {
      if (audio.__eigoStopped) return;
      if (error && error.__eigoSourceAttempted === true) {
        var unsafe = audio;
        unsafe.__eigoStopped = true;
        try { unsafe.pause(); } catch (_) {}
        var unsafeIndex = collection.indexOf(unsafe);
        if (unsafeIndex !== -1) collection.splice(unsafeIndex, 1);
        if (typeof unsafe.__eigoDisconnect === "function") unsafe.__eigoDisconnect();
        audio = createTrackedAudio();
        if (type === "se" && keyOrPath === "picoEntrance") {
          markReloadAudioIdentityTarget(audio, "pico");
          trackInitialAudioUnlockTarget(audio, "PICO SE");
        }
      }
      audio.__eigoAudioPath = "fallback";
      audioTrace("GAINNODE_FALLBACK", { category: policy.category, asset: keyOrPath, reason: String(error) });
      if (applyOneShotFallbackGain(audio)) {
        noteAudioLiveStart(audio, keyOrPath, policy.category);
        safePlay(audio);
      }
    }
    function connectAndPlay() {
      if (audio.__eigoStopped) return;
      var graph = buildSimpleGraph(audio, busName, baseGain);
      audio.__eigoGainNode = graph.gainNode;
      audio.__eigoAudioPath = "web-audio";
      audio.__eigoDisconnect = function () { disconnectNodes(graph.nodes); audio.__eigoDisconnect = null; };
      noteAudioLiveStart(audio, keyOrPath, policy.category);
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
    var runtimeVoiceTraceId = ++voiceTraceSerial;
    var runtimeElementGeneration = 0;
    var characterId = characterCode ? Number(characterCode.slice(1)) : null;
    var voiceGraphTrace = {
      mediaElementSourceCreated: false,
      sourceConnected: false,
      destinationConnected: false,
      sourceNodeId: null,
      sourceContextId: null,
      characterGain: null,
      processingGain: radio ? null : 1,
      voiceBusGain: null,
      masterGain: null,
      theoreticalPreLimiterGain: null,
      limiter: null,
      signalPeak: null,
      signalRms: null,
      analyserNode: null
    };
    var fallbackActive = false;
    var voiceModeOwner = enterDialogueVoiceMode();
    var characterGainValue = options.characterGain === undefined ?
      (options.volume === undefined ? 1 : Number(options.volume)) : Number(options.characterGain);
    if (!Number.isFinite(characterGainValue)) characterGainValue = 1;

    function sampleVoiceSignal() {
      var analyser = voiceGraphTrace.analyserNode;
      if (!analyser || typeof analyser.getFloatTimeDomainData !== "function") return;
      try {
        var samples = new Float32Array(analyser.fftSize || 256);
        analyser.getFloatTimeDomainData(samples);
        var peak = 0;
        var sumSquares = 0;
        for (var sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
          var absolute = Math.abs(samples[sampleIndex]);
          if (absolute > peak) peak = absolute;
          sumSquares += samples[sampleIndex] * samples[sampleIndex];
        }
        voiceGraphTrace.signalPeak = finiteTraceNumber(peak);
        voiceGraphTrace.signalRms = finiteTraceNumber(Math.sqrt(sumSquares / samples.length));
        if (voiceGraphTrace.limiter && voiceGraphTrace.limiter.node) {
          voiceGraphTrace.limiter.reductionDb = finiteTraceNumber(voiceGraphTrace.limiter.node.reduction);
        }
      } catch (_) {}
    }

    function voiceGraphSnapshot() {
      sampleVoiceSignal();
      return {
        mediaElementSourceCreated: voiceGraphTrace.mediaElementSourceCreated,
        sourceConnected: voiceGraphTrace.sourceConnected,
        destinationConnected: voiceGraphTrace.destinationConnected,
        sourceNodeId: voiceGraphTrace.sourceNodeId,
        sourceContextId: voiceGraphTrace.sourceContextId,
        characterGain: voiceGraphTrace.characterGain,
        processingGain: voiceGraphTrace.processingGain,
        voiceBusGain: voiceGraphTrace.voiceBusGain,
        masterGain: voiceGraphTrace.masterGain,
        theoreticalPreLimiterGain: voiceGraphTrace.theoreticalPreLimiterGain,
        limiter: voiceGraphTrace.limiter ? {
          threshold: voiceGraphTrace.limiter.threshold,
          ratio: voiceGraphTrace.limiter.ratio,
          attack: voiceGraphTrace.limiter.attack,
          release: voiceGraphTrace.limiter.release,
          reductionDb: voiceGraphTrace.limiter.reductionDb
        } : null,
        signalPeak: voiceGraphTrace.signalPeak,
        signalRms: voiceGraphTrace.signalRms
      };
    }

    function emitVoiceRuntimeTrace(event, candidate, extra) {
      var context = canonicalAudioContext;
      voiceRuntimeTrace(event, Object.assign({
        traceId: runtimeVoiceTraceId,
        voiceAssetId: keyOrPath,
        characterId: characterId,
        characterCode: characterCode,
        voicePath: voicePath,
        audioPath: (candidate || audio).__eigoAudioPath || (fallbackActive ? "fallback" : "pending"),
        fallback: fallbackActive,
        audioContext: audioContextSnapshot(context),
        htmlAudio: audioElementSnapshot(candidate || audio),
        graph: voiceGraphSnapshot()
      }, extra || {}));
    }

    emitVoiceRuntimeTrace("enterDialogueVoiceMode", audio);

    function removeFrom(collection, item) {
      var index = collection.indexOf(item);
      if (index !== -1) collection.splice(index, 1);
    }

    function disposeProcessing() {
      disconnectNodes(processingNodes);
      processingNodes = [];
      voiceGraphTrace.destinationConnected = false;
      voiceGraphTrace.sourceConnected = false;
    }

    function complete(status, error) {
      if (settled) return;
      settled = true;
      disposeProcessing();
      removeFrom(dialogueVoices, audio);
      removeFrom(voices, audio);
      exitDialogueVoiceMode(voiceModeOwner);
      emitVoiceRuntimeTrace("exitDialogueVoiceMode", audio, { completionStatus: status, error: error ? String(error) : null });
      resolveCompletion({ status: status, error: error && error.message ? error.message : null });
    }

    function attachDialogueAudio(candidate) {
      runtimeElementGeneration += 1;
      ensureAudioInstanceTrace(candidate, keyOrPath, "DIALOGUE_VOICE");
      candidate.__eigoTraceCharacterId = characterCode || characterId;
      lastDialogueVoiceTraceAudio = candidate;
      lastDialogueVoiceTraceMeta = {
        asset: keyOrPath,
        character: characterCode || characterId,
        characterGain: finiteTraceNumber(characterGainValue),
        processingGain: finiteTraceNumber(voiceGraphTrace.processingGain)
      };
      candidate.__eigoTraceElementId = "voice-element-" + runtimeVoiceTraceId + "-" + runtimeElementGeneration;
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
        emitVoiceRuntimeTrace("playing", candidate);
        if (radio) voiceTrace("radio-audio-event-playing", traceDetail);
        else voiceTrace("normal-voice-playing", { voiceKey: keyOrPath });
      });
      candidate.addEventListener("timeupdate", function () {
        if (candidate === audio) emitVoiceRuntimeTrace("timeupdate", candidate);
      });
      candidate.addEventListener("ended", function () {
        if (candidate !== audio) return;
        emitVoiceRuntimeTrace("ended", candidate);
        if (radio) voiceTrace("radio-audio-event-ended", traceDetail);
        complete("ended");
      }, { once: true });
      candidate.addEventListener("error", function () {
        if (candidate !== audio) return;
        emitVoiceRuntimeTrace("error", candidate, { error: "audio-error" });
        complete("failed", new Error("audio-error"));
      }, { once: true });
      candidate.addEventListener("abort", function () {
        if (candidate !== audio) return;
        emitVoiceRuntimeTrace("error", candidate, { error: "audio-abort" });
        complete("failed", new Error("audio-abort"));
      }, { once: true });
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
      fallbackActive = true;
      voiceGraphTrace.mediaElementSourceCreated = false;
      voiceGraphTrace.sourceConnected = false;
      voiceGraphTrace.destinationConnected = false;
      voiceGraphTrace.sourceNodeId = null;
      voiceGraphTrace.sourceContextId = null;
      voiceGraphTrace.analyserNode = null;
      attachDialogueAudio(audio);
      audio.__eigoAudioPath = "fallback";
      emitVoiceRuntimeTrace("fallback", audio, { fallbackReason: reason, error: error ? String(error) : null });
      audioTrace("GAINNODE_FALLBACK", { category: "VOICE", voiceKey: keyOrPath, reason: reason, error: error ? String(error) : null });
      if (radio) voiceTrace("radio-fallback-enter", traceDetail, { reason: reason, error: error ? String(error) : null, freshAudioElement: true });
      return true;
    }

    function startPlayback() {
      if (settled) return;
      var startedAudio = audio;
      emitVoiceRuntimeTrace("play-call", startedAudio);
      safePlay(startedAudio);
      Promise.resolve(startedAudio.__eigoPlaybackOutcome).then(function (outcome) {
        emitVoiceRuntimeTrace(outcome && outcome.ok === false ? "play-rejected" : "play-resolved", startedAudio, {
          playError: outcome && outcome.error ? String(outcome.error) : null
        });
        if (startedAudio === audio && outcome && outcome.ok === false) complete("failed", outcome.error);
      });
    }

    function buildVoiceGraph(context) {
      var buses = createCanonicalBuses(context);
      if (!buses) throw new Error("voice-bus-unavailable");
      var characterGain = finalDiagnosticCreateGain(context, {
        role: "dialogue-voice-character",
        reason: "buildVoiceGraph"
      });
      setGainValue(characterGain, characterGainValue);
      voiceGraphTrace.characterGain = finiteTraceNumber(characterGain.gain.value);
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
        var radioOutput = finalDiagnosticCreateGain(context, {
          role: "radio-processing",
          reason: "buildVoiceGraph"
        });
        setGainValue(radioOutput, radioProfile.outputGain === undefined ? 0.72 : Number(radioProfile.outputGain));
        voiceGraphTrace.processingGain = finiteTraceNumber(radioOutput.gain.value);
        finalDiagnosticConnect(characterGain, highPass, { role: "radio", reason: "character-to-highpass" });
        finalDiagnosticConnect(highPass, lowPass, { role: "radio", reason: "highpass-to-lowpass" });
        finalDiagnosticConnect(lowPass, presence, { role: "radio", reason: "lowpass-to-presence" });
        finalDiagnosticConnect(presence, compressor, { role: "radio", reason: "presence-to-compressor" });
        finalDiagnosticConnect(compressor, saturation, { role: "radio", reason: "compressor-to-saturation" });
        finalDiagnosticConnect(saturation, radioOutput, { role: "radio", reason: "saturation-to-output" });
        routeEnd = radioOutput;
        nodes = nodes.concat([highPass, lowPass, presence, compressor, saturation, radioOutput]);
      } else if (kong) {
        var kongGain = finalDiagnosticCreateGain(context, {
          role: "kong-processing",
          reason: "buildVoiceGraph"
        });
        var processing = window.AudioMixProfile && AudioMixProfile.characterProcessing && AudioMixProfile.characterProcessing.c02 || {};
        setGainValue(kongGain, processing.webAudioGain === undefined ? 1 : Number(processing.webAudioGain));
        voiceGraphTrace.processingGain = finiteTraceNumber(kongGain.gain.value);
        var limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
        voiceGraphTrace.theoreticalPreLimiterGain = finiteTraceNumber(characterGain.gain.value * kongGain.gain.value);
        voiceGraphTrace.limiter = {
          node: limiter,
          threshold: finiteTraceNumber(limiter.threshold.value),
          ratio: finiteTraceNumber(limiter.ratio.value),
          attack: finiteTraceNumber(limiter.attack.value),
          release: finiteTraceNumber(limiter.release.value),
          reductionDb: finiteTraceNumber(limiter.reduction)
        };
        finalDiagnosticConnect(characterGain, kongGain, { role: "dialogue-voice", reason: "character-to-kong-gain" });
        finalDiagnosticConnect(kongGain, limiter, { role: "dialogue-voice", reason: "kong-gain-to-limiter" });
        routeEnd = limiter;
        nodes = nodes.concat([kongGain, limiter]);
      } else if (bernie) {
        var lowMid = context.createBiquadFilter(); lowMid.type = "peaking"; lowMid.frequency.value = 320; lowMid.Q.value = 0.9; lowMid.gain.value = -2.5;
        var berniePresence = context.createBiquadFilter(); berniePresence.type = "peaking"; berniePresence.frequency.value = 3200; berniePresence.Q.value = 1.0; berniePresence.gain.value = 2.0;
        finalDiagnosticConnect(characterGain, lowMid, { role: "dialogue-voice", reason: "character-to-bernie-lowmid" });
        finalDiagnosticConnect(lowMid, berniePresence, { role: "dialogue-voice", reason: "bernie-lowmid-to-presence" });
        routeEnd = berniePresence;
        nodes = nodes.concat([lowMid, berniePresence]);
      }
      var analyser = null;
      if (typeof context.createAnalyser === "function") {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0;
        finalDiagnosticConnect(routeEnd, analyser, { role: "dialogue-voice", reason: "route-to-analyser" });
        finalDiagnosticConnect(analyser, buses.voice, { role: "dialogue-voice", reason: "analyser-to-voice-bus" });
        nodes.push(analyser);
        voiceGraphTrace.analyserNode = analyser;
      } else finalDiagnosticConnect(routeEnd, buses.voice, { role: "dialogue-voice", reason: "route-to-voice-bus" });
      voiceGraphTrace.voiceBusGain = finiteTraceNumber(buses.voice.gain.value);
      voiceGraphTrace.masterGain = finiteTraceNumber(buses.master.gain.value);
      voiceGraphTrace.destinationConnected = true;
      var source;
      try {
        source = finalDiagnosticCreateMediaElementSource(context, audio, {
          role: "DIALOGUE-VOICE",
          reason: "buildVoiceGraph"
        });
      } catch (sourceError) {
        emitVoiceRuntimeTrace("media-element-source-create-failed", audio, { error: String(sourceError) });
        throw sourceError;
      }
      voiceGraphTrace.mediaElementSourceCreated = true;
      voiceGraphTrace.sourceNodeId = "voice-source-" + runtimeVoiceTraceId;
      voiceGraphTrace.sourceContextId = context.__eigoTraceContextId || null;
      var recoveryAnalyser = createSignalTraceAnalyser(context, source);
      if (recoveryAnalyser) nodes.push(recoveryAnalyser);
      emitVoiceRuntimeTrace("media-element-source-created", audio);
      if (radio) voiceTrace("radio-source-created", traceDetail, { contextState: context.state });
      try {
        finalDiagnosticConnect(source, routeStart, {
          role: "DIALOGUE-VOICE",
          reason: "media-source-to-character-gain"
        });
        voiceGraphTrace.sourceConnected = true;
      } catch (error) {
        emitVoiceRuntimeTrace("source-connect-failed", audio, { error: String(error) });
        disconnectNodes([source].concat(nodes));
        error.__eigoSourceAttempted = true;
        throw error;
      }
      processingNodes = [source].concat(nodes);
      audio.__eigoAudioPath = "web-audio";
      audio.__eigoCharacterGainNode = characterGain;
      audio.__eigoVoiceTraceAnalyser = analyser;
      audio.__eigoVoiceRecoveryAnalyser = recoveryAnalyser;
      audio.__eigoVoiceCharacterGain = voiceGraphTrace.characterGain;
      audio.__eigoVoiceProcessingGain = voiceGraphTrace.processingGain;
      lastDialogueVoiceTraceMeta = {
        asset: keyOrPath,
        character: characterCode || characterId,
        characterGain: voiceGraphTrace.characterGain,
        processingGain: voiceGraphTrace.processingGain
      };
      audioTrace("VOICE_PATH", { voiceKey: keyOrPath, path: "web-audio", characterCode: characterCode, radio: radio });
      audioTrace("VOICE_CHARACTER_GAIN", { voiceKey: keyOrPath, gain: characterGainValue });
      audioTrace("VOICE_BUS_GAIN", { gain: canonicalBuses.voice.gain.value });
      emitVoiceRuntimeTrace("graph-connected", audio);
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
    speechIsolation.snapshot = null;
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

  function resetCentralRecoveryCandidate() {
    centralRecoveryState.candidateKey = null;
    centralRecoveryState.candidateSince = null;
    centralRecoveryState.candidateStartMediaTime = null;
    centralRecoveryState.candidateLastMediaTime = null;
    centralRecoveryState.candidateLastProgressAt = null;
  }

  function centralRecoveryPublicState() {
    return {
      version: CENTRAL_RECOVERY_VERSION,
      state: centralRecoveryState.state,
      attempt: centralRecoveryState.attempt,
      reason: centralRecoveryState.reason,
      lastResult: centralRecoveryState.lastResult,
      lastAt: centralRecoveryState.lastAt,
      cooldownUntil: centralRecoveryState.cooldownUntil,
      candidateKey: centralRecoveryState.candidateKey,
      candidateSince: centralRecoveryState.candidateSince,
      pendingBgm: !!centralRecoveryState.pendingBgmSnapshot,
      contextId: canonicalAudioContext && canonicalAudioContext.__eigoTraceContextId || null
    };
  }

  function activeRecoverySource() {
    var activeVoice = null;
    for (var voiceIndex = dialogueVoices.length - 1; voiceIndex >= 0; voiceIndex -= 1) {
      var candidate = dialogueVoices[voiceIndex];
      if (candidate && candidate.paused === false && candidate.ended !== true &&
          candidate.__eigoAudioPath === "web-audio" &&
          (candidate.__eigoVoiceRecoveryAnalyser || candidate.__eigoVoiceTraceAnalyser)) {
        activeVoice = candidate;
        break;
      }
    }
    if (activeVoice) {
      var characterGain = Number(activeVoice.__eigoVoiceCharacterGain);
      var processingGain = Number(activeVoice.__eigoVoiceProcessingGain);
      if (!Number.isFinite(characterGain)) characterGain = 1;
      if (!Number.isFinite(processingGain)) processingGain = 1;
      if (characterGain * processingGain > 0.001) {
        return {
          type: "VOICE",
          key: "VOICE:" + ensureAudioInstanceTrace(activeVoice),
          audio: activeVoice,
          analyser: activeVoice.__eigoVoiceRecoveryAnalyser || activeVoice.__eigoVoiceTraceAnalyser,
          meter: "voiceSource"
        };
      }
    }
    var track = bgm && bgm.__eigoBgmTrack;
    if (bgm && track && bgm.paused === false && bgm.ended !== true && track.path === "web-audio" &&
        track.traceAnalyser && bgmEffectiveGain(track) > 0.001) {
      return {
        type: "BGM",
        key: "BGM:" + ensureAudioInstanceTrace(bgm),
        audio: bgm,
        analyser: track.traceAnalyser,
        meter: "bgmSource"
      };
    }
    return null;
  }

  function monitorCentralAudioRecovery(now) {
    now = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (centralRecoveryState.rebuilding || centralRecoveryState.state === "resume-pending" ||
        now < centralRecoveryState.cooldownUntil) {
      resetCentralRecoveryCandidate();
      return false;
    }
    var context = canonicalAudioContext;
    if (!context || context.state !== "running") {
      resetCentralRecoveryCandidate();
      if (centralRecoveryState.state === "source-lost-candidate") centralRecoveryState.state = "healthy";
      return false;
    }
    var active = activeRecoverySource();
    if (!active) {
      resetCentralRecoveryCandidate();
      if (centralRecoveryState.state === "source-lost-candidate") centralRecoveryState.state = "healthy";
      return false;
    }
    var mediaTime = Number(active.audio.currentTime);
    if (!Number.isFinite(mediaTime) || active.audio.paused === true || active.audio.ended === true) {
      resetCentralRecoveryCandidate();
      return false;
    }
    var sourceSignal = sampleSignalTrace(active.analyser, active.meter);
    if (sourceSignal.peak === null || sourceSignal.signal) {
      resetCentralRecoveryCandidate();
      if (centralRecoveryState.state === "source-lost-candidate") centralRecoveryState.state = "healthy";
      return false;
    }
    if (centralRecoveryState.candidateKey !== active.key) {
      centralRecoveryState.candidateKey = active.key;
      centralRecoveryState.candidateSince = now;
      centralRecoveryState.candidateStartMediaTime = mediaTime;
      centralRecoveryState.candidateLastMediaTime = mediaTime;
      centralRecoveryState.candidateLastProgressAt = now;
      centralRecoveryState.state = "source-lost-candidate";
      centralRecoveryState.reason = "SOURCE_LOST_" + active.type;
      return false;
    }
    if (mediaTime + 0.001 < centralRecoveryState.candidateLastMediaTime) {
      resetCentralRecoveryCandidate();
      centralRecoveryState.state = "healthy";
      return false;
    }
    if (mediaTime > centralRecoveryState.candidateLastMediaTime + 0.001) {
      centralRecoveryState.candidateLastMediaTime = mediaTime;
      centralRecoveryState.candidateLastProgressAt = now;
    }
    if (now - centralRecoveryState.candidateLastProgressAt > 500) {
      resetCentralRecoveryCandidate();
      centralRecoveryState.state = "healthy";
      return false;
    }
    var duration = now - centralRecoveryState.candidateSince;
    var mediaAdvance = mediaTime - centralRecoveryState.candidateStartMediaTime;
    if (duration < SOURCE_LOST_FATAL_MS || mediaAdvance < SOURCE_LOST_MIN_MEDIA_ADVANCE) return false;
    requestCentralAudioRecovery("SOURCE_LOST_" + active.type, now);
    return true;
  }

  function snapshotCentralRecoveryBgm() {
    var current = bgm;
    var track = current && current.__eigoBgmTrack;
    if (!current || !track || current.__eigoStopped === true || bgmTracks.indexOf(track) === -1) return null;
    var src = "";
    try { src = current.getAttribute("src") || current.src || ""; } catch (_) {}
    return {
      asset: track.asset,
      src: src,
      currentTime: Number(current.currentTime) || 0,
      loop: current.loop !== false,
      baseVolume: track.baseVolume,
      envelope: track.envelope,
      fadeState: track.fadeState,
      duckDialogue: audioState.duckState.dialogue.multiplier,
      duckSpeech: audioState.duckState.speech.multiplier,
      speechActive: audioState.speechMode.active === true
    };
  }

  function disconnectCanonicalGraph() {
    if (canonicalSignalAnalysers) {
      disconnectNodes([canonicalSignalAnalysers.master, canonicalSignalAnalysers.bgm, canonicalSignalAnalysers.voice]);
    }
    if (canonicalBuses) {
      disconnectNodes([
        canonicalBuses.bgm, canonicalBuses.motif, canonicalBuses.voice,
        canonicalBuses.se, canonicalBuses.effectVoice, canonicalBuses.master
      ]);
    }
    canonicalSignalAnalysers = null;
    canonicalBuses = null;
  }

  function teardownCentralAudioGraph() {
    clearPendingBgm();
    centralRecoveryState.expectedRequestSerial = ++bgmRequestSerial;
    bgmTracks.slice().forEach(function (track) {
      track.serial += 1;
      track.fadeState = "stopped";
      track.audio.__eigoStopped = true;
      disconnectNodes(track.nodes);
      try { track.audio.pause(); } catch (_) {}
    });
    bgmTracks = [];
    bgm = null;
    stopOneShots();
    disconnectCanonicalGraph();
  }

  function setRecoveredBgmTime(audio, time) {
    var target = Math.max(0, Number(time) || 0);
    try { audio.currentTime = target; } catch (_) {}
    if (typeof audio.addEventListener === "function") {
      audio.addEventListener("loadedmetadata", function () {
        try {
          if (Math.abs((Number(audio.currentTime) || 0) - target) > 0.25) audio.currentTime = target;
        } catch (_) {}
      }, { once: true });
    }
  }

  function markCentralRecoveryFailed(reason) {
    centralRecoveryState.rebuilding = false;
    centralRecoveryState.state = "failed";
    centralRecoveryState.lastResult = reason || "failed";
    audioTrace("CENTRAL_AUDIO_RECOVERY", centralRecoveryPublicState());
    recordAudioLifecycleEvent("central-recovery-failed", { reason: centralRecoveryState.lastResult });
    unlockComplete = false;
    installUnlockGesture();
  }

  function restoreCentralRecoveryBgm() {
    if (centralRecoveryState.state !== "resume-pending" && centralRecoveryState.state !== "rebuilding") return false;
    var context = canonicalAudioContext;
    if (!context || context.state !== "running") return false;
    var snapshot = centralRecoveryState.pendingBgmSnapshot;
    if (centralRecoveryState.expectedRequestSerial !== bgmRequestSerial) {
      centralRecoveryState.pendingBgmSnapshot = null;
      centralRecoveryState.rebuilding = false;
      centralRecoveryState.state = "recovered";
      centralRecoveryState.lastResult = "story-audio-superseded-recovery";
      audioOutputRecoveryRequired = false;
      return false;
    }
    createCanonicalBuses(context);
    updateBusPolicy();
    if (!snapshot) {
      centralRecoveryState.rebuilding = false;
      centralRecoveryState.state = "recovered";
      centralRecoveryState.lastResult = "new-context-no-bgm";
      audioOutputRecoveryRequired = false;
      recordAudioLifecycleEvent("central-recovery-complete", { contextId: context.__eigoTraceContextId, bgm: false });
      return true;
    }
    var fresh = new Audio(snapshot.src);
    fresh.loop = snapshot.loop;
    fresh.preload = "auto";
    fresh.__eigoStopped = false;
    setRecoveredBgmTime(fresh, snapshot.currentTime);
    var track = createBgmTrack(fresh, snapshot.asset, snapshot.baseVolume, snapshot.envelope);
    track.fadeState = snapshot.fadeState;
    bgm = fresh;
    var requestId = ++bgmRequestSerial;
    centralRecoveryState.expectedRequestSerial = requestId;
    connectBgmTrack(track, requestId);
    centralRecoveryState.pendingBgmSnapshot = null;
    centralRecoveryState.rebuilding = false;
    centralRecoveryState.state = "recovered";
    centralRecoveryState.lastResult = "bgm-restored:" + (context.__eigoTraceContextId || "new-context");
    audioOutputRecoveryRequired = false;
    audioLifecycleTraceState.recoveryRequired = false;
    audioTrace("CENTRAL_AUDIO_RECOVERY", centralRecoveryPublicState());
    recordAudioLifecycleEvent("central-recovery-complete", {
      contextId: context.__eigoTraceContextId,
      bgm: true,
      asset: snapshot.asset,
      currentTime: snapshot.currentTime
    });
    return true;
  }

  function rebuildCentralAudioEngine() {
    centralRecoveryState.state = "rebuilding";
    centralRecoveryState.rebuilding = true;
    centralRecoveryState.pendingBgmSnapshot = snapshotCentralRecoveryBgm();
    var oldContext = canonicalAudioContext;
    recordAudioLifecycleEvent("central-recovery-rebuilding", { reason: centralRecoveryState.reason });
    teardownCentralAudioGraph();
    canonicalAudioContext = null;
    unlockComplete = false;
    unlockPromise = null;
    audioOutputRecoveryRequired = false;
    var closeResult = null;
    try { if (oldContext && typeof oldContext.close === "function") closeResult = oldContext.close(); } catch (_) {}
    return Promise.resolve(closeResult).catch(function () { return null; }).then(function () {
      var newContext = getCanonicalAudioContext();
      if (!newContext) {
        markCentralRecoveryFailed("context-create-failed");
        return false;
      }
      return ensureCanonicalAudioContextRunning().then(function (running) {
        if (running) return restoreCentralRecoveryBgm();
        centralRecoveryState.rebuilding = false;
        centralRecoveryState.state = "resume-pending";
        centralRecoveryState.lastResult = "trusted-gesture-required";
        audioOutputRecoveryRequired = true;
        audioLifecycleTraceState.recoveryRequired = true;
        installUnlockGesture();
        return false;
      });
    }).catch(function (error) {
      markCentralRecoveryFailed("rebuild-error:" + String(error));
      return false;
    });
  }

  function requestCentralAudioRecovery(reason, now) {
    now = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (centralRecoveryState.rebuilding || centralRecoveryState.state === "resume-pending" ||
        now < centralRecoveryState.cooldownUntil) return false;
    centralRecoveryState.attempt += 1;
    centralRecoveryState.reason = reason || "SOURCE_LOST";
    centralRecoveryState.lastAt = now;
    centralRecoveryState.lastResult = "rebuild-required";
    centralRecoveryState.state = "rebuild-required";
    centralRecoveryState.cooldownUntil = now + Math.min(
      RECOVERY_COOLDOWN_MAX_MS,
      RECOVERY_COOLDOWN_BASE_MS * centralRecoveryState.attempt
    );
    resetCentralRecoveryCandidate();
    audioTrace("CENTRAL_AUDIO_RECOVERY", centralRecoveryPublicState());
    centralRecoveryPromise = rebuildCentralAudioEngine();
    return true;
  }

  function startCentralAudioRecoveryMonitor() {
    if (centralRecoveryState.timer || typeof window.setInterval !== "function") return;
    centralRecoveryState.timer = window.setInterval(function () { monitorCentralAudioRecovery(); }, 250);
  }

  function armSpeechDucking(options) {
    options = options || {};
    if (speechDucking && speechDucking.active) return;
    speechDucking = { armed: true, active: false, restore: options.restore !== false };
  }

  async function enterLegacySpeechMode(options) {
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

  async function exitLegacySpeechMode(options) {
    options = options || {};
    var restore = options.restore !== false;
    audioState.speechMode.active = false;
    audioState.speechMode.held = !restore;
    if (!restore) return;
    var profile = speechDuckProfile();
    await animatePolicy("speech", 1, profile.restoreMs === undefined ? 600 : profile.restoreMs);
    audioState.speechMode.preserveBgm = false;
  }

  function speechBgmIsStoryValid(audio) {
    var track = audio && audio.__eigoBgmTrack;
    return !!(audio && audio === bgm && track && audio.__eigoStopped !== true &&
      bgmTracks.indexOf(track) !== -1 && track.fadeState !== "stopped" &&
      track.fadeState !== "fade-out" && track.fadeState !== "crossfade-out");
  }

  function snapshotSpeechBgm() {
    var snapshot = snapshotCentralRecoveryBgm();
    if (!snapshot && centralRecoveryState.pendingBgmSnapshot &&
        centralRecoveryState.expectedRequestSerial === bgmRequestSerial) {
      snapshot = Object.assign({}, centralRecoveryState.pendingBgmSnapshot);
    }
    if (!snapshot) return null;
    snapshot.baseGain = snapshot.baseVolume;
    snapshot.storyValid = speechBgmIsStoryValid(bgm) || !!(centralRecoveryState.pendingBgmSnapshot &&
      centralRecoveryState.expectedRequestSerial === bgmRequestSerial);
    snapshot.requestSerial = bgmRequestSerial;
    snapshot.duckState = {
      dialogue: Object.assign({}, audioState.duckState.dialogue),
      speech: Object.assign({}, audioState.duckState.speech)
    };
    return snapshot;
  }

  function queueSpeechIsolation(operation) {
    var result = speechIsolationQueue.then(operation);
    speechIsolationQueue = result.catch(function () { return false; });
    return result;
  }

  function enterSpeechMode(options) {
    // Explicit options always belong to the pre-existing legacy lifecycle.
    // Its bookkeeping may continue, but updateBusPolicy keeps every canonical
    // bus at zero while SpeechEngine.listen() owns isolation.
    if (options !== undefined) return enterLegacySpeechMode(options);
    return queueSpeechIsolation(async function () {
      if (speechIsolation.state === "active") return true;
      recordReloadAudioIdentityCheckpoint("speech-mode-enter-before");
      recordAudioLifecycleEvent("speech-mode-enter-start");
      // Let the existing fatal-loss detector confirm any loss before pausing.
      monitorCentralAudioRecovery();
      speechIsolation.snapshot = snapshotSpeechBgm();
      speechIsolation.state = "entering";
      updateBusPolicy();
      bgmTracks.slice().forEach(function (track) {
        try { track.audio.pause(); } catch (_) {}
      });
      stopOneShots();
      stopDialogueVoices();
      // Keep all canonical Master/Bus nodes and every gain/duck calibration.
      updateBusPolicy();
      speechIsolation.state = "active";
      recordAudioLifecycleEvent("speech-mode-active");
      recordReloadAudioIdentityCheckpoint("speech-start-before-recognition");
      recordSpeechResultAudioRouteCheckpoint("speech-start-before-recognition", {
        recognitionEvent: "speech-start-before-recognition"
      });
      return true;
    });
  }

  function exitSpeechMode(options) {
    if (options !== undefined) return exitLegacySpeechMode(options);
    return queueSpeechIsolation(async function () {
      if (speechIsolation.state === "idle") return true;
      recordReloadAudioIdentityCheckpoint("speech-end-after");
      recordSpeechResultAudioRouteCheckpoint("speech-exit-mode-before", {
        recognitionEvent: "speech-exit-mode-before"
      });
      var diagnosticDelayMs = speechRestoreDiagnosticDelayMs();
      recordAudioRestoreTimingEvent("restore-delay-start", { delayMs: diagnosticDelayMs });
      if (diagnosticDelayMs > 0) {
        await new Promise(function (resolve) { window.setTimeout(resolve, diagnosticDelayMs); });
      }
      recordAudioRestoreTimingEvent("restore-delay-end", { delayMs: diagnosticDelayMs });
      recordAudioRestoreTimingEvent("exitSpeechMode-start");
      recordAudioLifecycleEvent("exit-speech-mode-start");
      speechIsolation.state = "exiting";
      recordSpeechResultAudioRouteCheckpoint("speech-exit-mode-after", {
        recognitionEvent: "speech-exit-mode-after"
      });
      // SOURCE LOST rebuilding remains owned by Central Audio Recovery.
      if (centralRecoveryPromise) await centralRecoveryPromise;
      recordAudioRestoreTimingEvent("ctx-before-restore");
      var running = await ensureCanonicalAudioContextRunning();
      if (!running || !canonicalAudioContext || canonicalAudioContext.state !== "running") {
        // Keep isolation closed; a trusted gesture can run the existing recovery,
        // then the caller may retry exit. Never restore through a fallback here.
        speechIsolation.state = "active";
        audioOutputRecoveryRequired = true;
        audioLifecycleTraceState.recoveryRequired = true;
        unlockComplete = false;
        installUnlockGesture();
        return false;
      }
      if (centralRecoveryState.state === "resume-pending" ||
          (centralRecoveryState.state === "failed" && centralRecoveryState.pendingBgmSnapshot)) {
        centralRecoveryState.state = "resume-pending";
        restoreCentralRecoveryBgm();
      }
      if (audioOutputRecoveryRequired) recoverCurrentBgmAfterContextResume();
      // Story play/stop requests made during Speech supersede the entry snapshot.
      // Use the live managed BGM; never resurrect the historical entry asset.
      var current = speechBgmIsStoryValid(bgm) ? bgm : null;
      bgmTracks.slice().forEach(function (track) {
        if (track.audio !== current) stop(track.audio);
      });
      recordReloadAudioIdentityCheckpoint("bgm-restore-before", null, current);
      recordSpeechResultAudioRouteCheckpoint("speech-bgm-restore-before", {
        recognitionEvent: "speech-bgm-restore-before"
      });
      recordAudioLifecycleEvent("bgm-restore-start", {
        asset: current && current.__eigoBgmTrack ? current.__eigoBgmTrack.asset : null,
        instanceId: current && current.__eigoTraceInstanceId || null
      });
      speechIsolation.state = "idle";
      speechIsolation.snapshot = null;
      updateBusPolicy();
      recordAudioLifecycleEvent("speech-mode-idle");
      if (current && (current.paused === true || current.ended === true)) {
        var track = current.__eigoBgmTrack;
        if (track.path === "pending") connectBgmTrack(track, bgmRequestSerial);
        else if (track.path !== "fallback" || applyBgmFallbackGain(track)) {
          noteAudioLiveStart(current, track.asset, "BGM");
          safePlay(current);
          watchBgmPlayback(current, bgmRequestSerial);
        }
      }
      recordReloadAudioIdentityCheckpoint("speech-end-bgm-restore-after");
      recordReloadAudioIdentityCheckpoint("bgm-restore-after", null, current);
      recordSpeechResultAudioRouteCheckpoint("speech-bgm-restore-after", {
        recognitionEvent: "speech-bgm-restore-after"
      });
      return true;
    });
  }

  async function beginSpeechDucking() {
    if (!speechDucking || !speechDucking.armed) return false;
    if (speechDucking.active) return true;
    speechDucking.active = true;
    return enterLegacySpeechMode({ preserveBgm: true });
  }

  async function finishSpeechDucking(restore) {
    var current = speechDucking;
    speechDucking = null;
    if (!current || !current.active) return;
    await exitLegacySpeechMode({ restore: restore !== false });
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
      speechMode: Object.assign({}, audioState.speechMode, {
        state: speechIsolation.state,
        active: speechIsolation.state !== "idle" || audioState.speechMode.active,
        snapshot: speechIsolation.snapshot ? Object.assign({}, speechIsolation.snapshot, {
          duckState: {
            dialogue: Object.assign({}, speechIsolation.snapshot.duckState.dialogue),
            speech: Object.assign({}, speechIsolation.snapshot.duckState.speech)
          }
        }) : null
      }),
      voicePlaying: audioState.voicePlaying,
      audioContextState: canonicalAudioContext ? canonicalAudioContext.state : "uninitialized",
      unlockComplete: unlockComplete,
      pendingBgm: !!pendingBgm,
      centralRecovery: centralRecoveryPublicState(),
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
  window.GainNodeVoiceRuntimeTrace = {
    version: TRACE_VERSION,
    speechTraceVersion: SPEECH_TRACE_VERSION,
    recoveryVersion: RECOVERY_VERSION,
    signalTraceVersion: SIGNAL_TRACE_VERSION,
    panelEnabled: function () { return voiceRuntimeTraceState.panelEnabled; },
    latest: function () { return voiceRuntimeTraceState.latest; },
    latched: function () { return voiceRuntimeTraceState.latched; },
    history: function () { return voiceRuntimeTraceState.history.slice(); },
    live: liveAudioSnapshot,
    signal: signalTraceSnapshot,
    lifecycle: function () {
      return Object.assign({}, audioLifecycleTraceState, { events: audioLifecycleTraceState.events.slice() });
    },
    speechOrder: function () { return speechOrderTraceState.events.slice(); },
    audioSession: audioSessionTraceSnapshot,
    record: recordAudioLifecycleEvent,
    render: renderVoiceRuntimeTracePanel
  };
  window.AudioRestoreTimingDiagnostic = {
    version: AUDIO_RESTORE_TIMING_TRACE_VERSION,
    limit: AUDIO_RESTORE_TIMING_TRACE_LIMIT,
    mode: speechRestoreDiagnosticMode,
    delayMs: speechRestoreDiagnosticDelayMs,
    enabled: audioRestoreTimingTraceEnabled,
    events: function () { return audioRestoreTimingTraceState.events.slice(); },
    record: recordAudioRestoreTimingEvent
  };
  window.InitialAudioUnlockTrace = {
    version: INITIAL_AUDIO_UNLOCK_TRACE_VERSION,
    limit: INITIAL_AUDIO_UNLOCK_TRACE_LIMIT,
    events: function () { return initialAudioUnlockTraceState.events.slice(); },
    snapshot: initialAudioUnlockSnapshot
  };
  window.ReloadAudioIdentityTrace = {
    version: RELOAD_AUDIO_IDENTITY_TRACE_VERSION,
    limit: RELOAD_AUDIO_IDENTITY_TRACE_LIMIT,
    events: function () { return reloadAudioIdentityTraceState.events.slice(); },
    snapshot: reloadAudioIdentitySnapshot,
    checkpoint: recordReloadAudioIdentityCheckpoint
  };
  window.LoudAudioGraphIdentityTrace = {
    version: LOUD_AUDIO_GRAPH_IDENTITY_TRACE_VERSION,
    snapshot: loudAudioGraphDetailSnapshot,
    lines: function () { return loudAudioGraphDetailLines(loudAudioGraphDetailSnapshot()); },
    checkpoint: recordReloadAudioIdentityCheckpoint
  };
  window.SpeechResultAudioRouteTrace = {
    version: SPEECH_RESULT_AUDIO_ROUTE_TRACE_VERSION,
    limit: SPEECH_RESULT_AUDIO_ROUTE_TRACE_LIMIT,
    events: function () { return speechResultAudioRouteTraceState.events.slice(); },
    snapshot: speechResultAudioRouteSnapshot,
    record: recordSpeechResultAudioRouteCheckpoint
  };
  window.AudioFinalIsolationDiagnostic = {
    version: AUDIO_FINAL_ISOLATION_DIAGNOSTIC_VERSION,
    eventLimit: AUDIO_FINAL_DIAGNOSTIC_EVENT_LIMIT,
    summary: audioFinalDiagnosticSummary,
    events: function () { return audioFinalDiagnosticState.events.slice(); }
  };
  window.CentralAudioRecoveryTrace = {
    version: CENTRAL_RECOVERY_VERSION,
    state: centralRecoveryPublicState,
    check: monitorCentralAudioRecovery,
    request: requestCentralAudioRecovery
  };
  if (voiceRuntimeTraceState.panelEnabled && window.document) {
    startAudioLiveTracePanel();
    installAudioLifecycleTraceListeners();
    installSpeechResultAudioSessionTrace();
  }
  recordReloadAudioIdentityCheckpoint("startup");
  installUnlockGesture();
  startCentralAudioRecoveryMonitor();
})();
