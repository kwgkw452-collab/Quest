(function () {
  "use strict";

  var RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  var activeRecognition = null;
  var recognitionTraceSerial = 0;
  var MIC_RELEASE_TRACE_VERSION = "iphone-speech-native-mic-release-boundary-trace-v1";
  var MIC_RELEASE_TRACE_LIMIT = 64;
  var micReleaseTraceState = { events: [] };

  function micReleaseTraceEnabled() {
    try {
      var query = new URLSearchParams(window.location.search || "");
      return query.get("audioTrace") === "1" || query.get("micReleaseTrace") === "1";
    } catch (_) { return false; }
  }

  function micReleaseAudioSnapshot() {
    var context = null;
    var audioState = null;
    try {
      if (window.AudioManager && typeof AudioManager.getAudioContext === "function") context = AudioManager.getAudioContext();
      else if (window.AudioManager && typeof AudioManager.getState === "function") {
        audioState = AudioManager.getState();
      }
    } catch (_) {}
    try {
      if (!audioState && window.AudioManager && typeof AudioManager.getState === "function") audioState = AudioManager.getState();
    } catch (_) {}
    return {
      contextState: context ? (context.state || "unknown") :
        (audioState && audioState.audioContextState || "unavailable"),
      speechState: audioState && audioState.speechMode ?
        (audioState.speechMode.state || (audioState.speechMode.active ? "active" : "idle")) : "unavailable"
    };
  }

  function micReleaseAudioSessionSnapshot() {
    try {
      var session = window.navigator && navigator.audioSession;
      return session ? {
        type: typeof session.type === "string" ? session.type : "unavailable",
        state: typeof session.state === "string" ? session.state : "unavailable"
      } : { type: "unsupported", state: "unsupported" };
    } catch (_) { return { type: "unavailable", state: "unavailable" }; }
  }

  function activeRecognitionId() {
    return activeRecognition && activeRecognition.__eigoMicReleaseTraceId || null;
  }

  function recordMicReleaseTrace(type, detail) {
    if (!micReleaseTraceEnabled()) return;
    var audio = micReleaseAudioSnapshot();
    var session = micReleaseAudioSessionSnapshot();
    var record = Object.assign({
      type: type,
      at: Date.now(),
      instanceId: null,
      activeRecognitionId: activeRecognitionId(),
      activeRecognitionNull: activeRecognition === null,
      audioContextState: audio.contextState,
      speechModeState: audio.speechState,
      audioSessionType: session.type,
      audioSessionState: session.state,
      stopReason: null
    }, detail || {});
    micReleaseTraceState.events.push(record);
    if (micReleaseTraceState.events.length > MIC_RELEASE_TRACE_LIMIT) micReleaseTraceState.events.shift();
  }

  function installMicReleasePageTrace() {
    if (!micReleaseTraceEnabled()) return;
    function recordPageEvent(event) {
      recordMicReleaseTrace(event.type, {
        visibilityState: window.document ? document.visibilityState || "unknown" : "unavailable",
        hidden: window.document ? !!document.hidden : null
      });
    }
    if (window.document && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", recordPageEvent, true);
    }
    if (typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", recordPageEvent, true);
      window.addEventListener("pageshow", recordPageEvent, true);
    }
  }

  function teardownTrace(type, detail) {
    try {
      if (window.GainNodeVoiceRuntimeTrace && typeof GainNodeVoiceRuntimeTrace.record === "function") {
        GainNodeVoiceRuntimeTrace.record(type, detail || {});
      }
    } catch (_) {}
  }

  function restoreTimingTrace(type, detail) {
    try {
      if (window.AudioRestoreTimingDiagnostic &&
          typeof AudioRestoreTimingDiagnostic.record === "function") {
        AudioRestoreTimingDiagnostic.record(type, detail || {});
      }
    } catch (_) {}
  }

  function s005Trace(options, eventName, detail) {
    var questionId = options && options.s005TraceQuestionId;
    if (typeof questionId !== "string" || questionId.indexOf("s005.communication.") !== 0) return;
    console.log("[S005 TRACE] " + eventName, Object.assign({ questionId: questionId }, detail || {}));
  }

  function stop() {
    if (!activeRecognition) return;
    recordMicReleaseTrace("stop-call", {
      instanceId: activeRecognitionId(),
      stopReason: "adapter-stop"
    });
    teardownTrace("recognition-stop-call", { reason: "adapter-stop" });
    try { activeRecognition.stop(); } catch (error) { /* already stopped */ }
  }

  function listen(options) {
    options = options || {};
    var legacyTraceContext = options.legacyTraceContext || null;

    function legacyTrace(eventName, detail) {
      if (!legacyTraceContext || !window.LegacySpeechTrace || typeof LegacySpeechTrace.record !== "function") return;
      LegacySpeechTrace.record(legacyTraceContext, eventName, detail);
    }

    return new Promise(function (resolve, reject) {
      if (!RecognitionClass) {
        legacyTrace("adapter-reject", { error: "speech-not-supported" });
        reject(new Error("speech-not-supported"));
        return;
      }

      var recognition = new RecognitionClass();
      recognition.__eigoMicReleaseTraceId = "rec" + (++recognitionTraceSerial);
      var finalText = "";
      var settled = false;
      var timeoutId = null;
      var latestInterim = "";
      var latestAlternatives = [];
      var lastError = null;
      var pendingTerminalError = null;
      activeRecognition = recognition;
      recordMicReleaseTrace("instance-created", { instanceId: recognition.__eigoMicReleaseTraceId });

      function finish(kind, value) {
        if (settled) return;
        recordMicReleaseTrace("finish-enter", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          settlement: kind
        });
        settled = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        recordMicReleaseTrace("activeRecognition-before-clear", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          activeRecognitionId: activeRecognitionId(),
          activeRecognitionNull: activeRecognition === null
        });
        if (activeRecognition === recognition) activeRecognition = null;
        recordMicReleaseTrace("activeRecognition-cleared", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          activeRecognitionId: activeRecognitionId(),
          activeRecognitionNull: activeRecognition === null
        });
        restoreTimingTrace("adapter-settled", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          settlement: kind
        });
        if (kind === "resolve") {
          recordMicReleaseTrace("adapter-resolve", { instanceId: recognition.__eigoMicReleaseTraceId });
          teardownTrace("adapter-resolve");
          legacyTrace("adapter-resolve", { transcript: String(value || "") });
          resolve(value);
        } else {
          recordMicReleaseTrace("adapter-reject", {
            instanceId: recognition.__eigoMicReleaseTraceId,
            error: value && value.message ? value.message : String(value || "speech-error")
          });
          teardownTrace("adapter-reject", {
            error: value && value.message ? value.message : String(value || "speech-error")
          });
          legacyTrace("adapter-reject", Object.assign({
            error: value && value.message ? value.message : String(value || "speech-error")
          }, legacyTraceContext && legacyTraceContext.questionId === "phrase.come_with_us" ? {
            latestInterim: latestInterim,
            latestFinal: finalText.trim()
          } : {}));
          reject(value);
        }
      }

      recognition.lang = options.lang || "ja-JP";
      recognition.interimResults = options.interimResults !== false;
      recognition.continuous = Boolean(options.continuous);
      recognition.maxAlternatives = options.maxAlternatives || 1;

      recognition.onstart = function () {
        recordMicReleaseTrace("onstart", { instanceId: recognition.__eigoMicReleaseTraceId });
        teardownTrace("recognition-onstart");
        legacyTrace("recognition-onstart");
        if (typeof options.onStart === "function") options.onStart();
      };

      recognition.onresult = function (event) {
        var interimText = "";
        var alternatives = [];
        for (var i = event.resultIndex; i < event.results.length; i += 1) {
          var transcript = event.results[i][0].transcript;
          var resultAlternatives = [];
          for (var k = 0; k < event.results[i].length; k += 1) {
            resultAlternatives.push({
              transcript: String(event.results[i][k].transcript || "").trim(),
              confidence: typeof event.results[i][k].confidence === "number" ? event.results[i][k].confidence : null
            });
          }
          legacyTrace("recognition-result", {
            resultIndex: event.resultIndex,
            index: i,
            isFinal: Boolean(event.results[i].isFinal),
            primaryTranscript: String(transcript || "").trim(),
            primaryConfidence: resultAlternatives.length ? resultAlternatives[0].confidence : null,
            alternatives: resultAlternatives
          });
          teardownTrace("recognition-result", { final: Boolean(event.results[i].isFinal) });
          s005Trace(options, "recognition-result", {
            transcript: String(transcript || "").trim(),
            isFinal: Boolean(event.results[i].isFinal),
            confidence: resultAlternatives.length ? resultAlternatives[0].confidence : null
          });
          if (event.results[i].isFinal) finalText += transcript;
          else interimText += transcript;
          for (var j = 0; j < event.results[i].length; j += 1) {
            var alternative = String(event.results[i][j].transcript || "").trim();
            if (alternative && alternatives.indexOf(alternative) === -1) alternatives.push(alternative);
          }
          if (event.results[i].isFinal) {
            legacyTrace("legacy-final", { transcript: String(transcript || "").trim(), finalText: finalText.trim() });
          } else {
            legacyTrace("legacy-interim", { transcript: String(transcript || "").trim() });
          }
        }

        if (interimText.trim()) latestInterim = interimText.trim();
        latestAlternatives = alternatives.slice();
        var currentText = (finalText + " " + interimText).trim();
        if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
          LegacySpeechTrace.recordInvite(legacyTraceContext, "recognition-interim", { transcript: currentText });
        }
        if (typeof options.onInterim === "function") options.onInterim(currentText);
        if (typeof options.onAlternatives === "function") options.onAlternatives(alternatives);
      };

      recognition.onerror = function (event) {
        lastError = event.error || "speech-error";
        recordMicReleaseTrace("onerror", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          error: lastError
        });
        teardownTrace("recognition-onerror", { error: lastError });
        s005Trace(options, "recognition-error", { error: lastError });
        legacyTrace("recognition-error", {
          error: lastError,
          message: event.message || "",
          hadFinalText: Boolean(finalText.trim()),
          finalText: finalText.trim(),
          latestInterim: latestInterim,
          alternatives: latestAlternatives.slice()
        });
        // A started Web Speech recognition owns its teardown through onend.
        // Preserve the error verdict, but do not let the caller restore Audio
        // buses while the browser's recognition session is still ending.
        if (!pendingTerminalError) pendingTerminalError = new Error(lastError);
      };

      recognition.onend = function () {
        var result = finalText.trim();
        restoreTimingTrace("recognition-onend", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          resultAvailable: Boolean(result)
        });
        recordMicReleaseTrace("onend", {
          instanceId: recognition.__eigoMicReleaseTraceId,
          resultAvailable: Boolean(result)
        });
        teardownTrace("recognition-onend", { resultAvailable: Boolean(result) });
        s005Trace(options, "recognition-end", {
          finalText: result,
          latestInterim: latestInterim,
          alternatives: latestAlternatives.slice()
        });
        if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
          LegacySpeechTrace.recordInvite(legacyTraceContext, "recognition-final", { transcript: result });
        }
        legacyTrace("recognition-end", {
          finalText: result,
          latestInterim: latestInterim,
          candidateCount: latestAlternatives.length,
          lastError: lastError
        });
        if (pendingTerminalError) finish("reject", pendingTerminalError);
        else if (result) finish("resolve", result);
        else finish("reject", new Error("no-speech"));
      };

      if (options.timeoutMs > 0) {
        timeoutId = window.setTimeout(function () {
          recordMicReleaseTrace("stop-call", {
            instanceId: recognition.__eigoMicReleaseTraceId,
            stopReason: "timeout"
          });
          teardownTrace("recognition-stop-call", { reason: "timeout" });
          try { recognition.stop(); } catch (error) { /* ignore */ }
          // Preserve the existing synchronous-stop outcome (onend may have
          // already selected no-speech). For the browser's normal async end,
          // retain speech-timeout until onend completes teardown.
          if (!settled && !pendingTerminalError) pendingTerminalError = new Error("speech-timeout");
        }, options.timeoutMs);
      }

      try {
        recordMicReleaseTrace("start-call", { instanceId: recognition.__eigoMicReleaseTraceId });
        teardownTrace("recognition-start-call");
        legacyTrace("recognition-start-call");
        recognition.start();
      } catch (error) {
        finish("reject", error);
      }
    });
  }

  window.SpeechRecognitionAdapter = {
    listen: listen,
    stop: stop,
    supported: Boolean(RecognitionClass)
  };
  window.MicReleaseTrace = {
    version: MIC_RELEASE_TRACE_VERSION,
    limit: MIC_RELEASE_TRACE_LIMIT,
    enabled: micReleaseTraceEnabled,
    events: function () { return micReleaseTraceState.events.slice(); },
    activeRecognitionId: activeRecognitionId
  };
  installMicReleasePageTrace();
})();
