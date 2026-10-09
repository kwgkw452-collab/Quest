(function () {
  "use strict";

  var listeners = {};
  var status = "idle";
  // Audio lifecycle only. Recognition candidates and Judge remain untouched.
  var speechAudioAttempt = null;
  var speechAudioExitTimer = null;
  var speechAudioRelease = Promise.resolve();
  var speechAudioRecoveryCleanup = null;

  function teardownTrace(type, detail) {
    try {
      if (window.GainNodeVoiceRuntimeTrace && typeof GainNodeVoiceRuntimeTrace.record === "function") {
        GainNodeVoiceRuntimeTrace.record(type, detail || {});
      }
    } catch (_) {}
  }

  function retrySpeechAudioExitAfterRecovery() {
    if (speechAudioRecoveryCleanup || !window.document || typeof document.addEventListener !== "function") return;
    var events = ["pointerdown", "touchend", "click", "keydown"];
    var pending = false;
    function cleanup() {
      events.forEach(function (name) { document.removeEventListener(name, retry, true); });
      speechAudioRecoveryCleanup = null;
    }
    async function retry() {
      if (pending || speechAudioAttempt) return;
      pending = true;
      try {
        // Phase 1 may return false while its existing Recovery needs a gesture.
        // Retry an unfinished exit, never a successfully completed trial exit.
        if (typeof AudioManager.unlock === "function") await AudioManager.unlock();
        if (!speechAudioAttempt && speechAudioRecoveryCleanup === cleanup) {
          speechAudioRelease = Promise.resolve(AudioManager.exitSpeechMode());
          if (await speechAudioRelease !== false) cleanup();
        }
      } catch (error) { console.warn("Audio restore after recovery failed:", error); }
      finally { pending = false; }
    }
    speechAudioRecoveryCleanup = cleanup;
    events.forEach(function (name) { document.addEventListener(name, retry, true); });
  }

  function releaseSpeechAudio(attempt) {
    if (!attempt || attempt.released) return speechAudioRelease;
    teardownTrace("release-speech-audio-start");
    attempt.released = true;
    if (speechAudioAttempt === attempt) speechAudioAttempt = null;
    speechAudioRelease = Promise.all([speechAudioRelease,
      Promise.resolve(attempt.enterPromise).catch(function () {})]).then(function () {
      return AudioManager.exitSpeechMode();
    }).then(function (exited) {
      if (exited === false) retrySpeechAudioExitAfterRecovery();
      else if (speechAudioRecoveryCleanup) speechAudioRecoveryCleanup();
      return exited;
    }).catch(function (error) {
      console.warn("Audio restore after speech recognition failed:", error);
      retrySpeechAudioExitAfterRecovery();
    });
    return speechAudioRelease;
  }

  async function enterSpeechAudio(attempt) {
    // Only the existing automatic mismatch loop inherits isolation.
    // Button/Support waits release before returning the Recognition result.
    if (speechAudioRecoveryCleanup) speechAudioRecoveryCleanup();
    if (speechAudioExitTimer !== null) {
      window.clearTimeout(speechAudioExitTimer);
      speechAudioExitTimer = null;
      if (speechAudioAttempt) speechAudioAttempt.released = true;
    }
    speechAudioAttempt = attempt;
    await speechAudioRelease;
    if (attempt.cancelled) throw new Error("aborted");
    attempt.enterPromise = Promise.resolve(AudioManager.enterSpeechMode());
    var entered = await attempt.enterPromise;
    if (attempt.cancelled) throw new Error("aborted");
    var audioState = typeof AudioManager.getState === "function" ? AudioManager.getState() : null;
    if (entered === false || (audioState && (!audioState.speechMode || audioState.speechMode.state !== "active"))) {
      throw new Error("audio-isolation-not-active");
    }
  }

  function finishSpeechAudio(attempt) {
    if (!attempt || attempt.released || speechAudioAttempt !== attempt) return;
    speechAudioExitTimer = window.setTimeout(function () {
      speechAudioExitTimer = null;
      if (speechAudioAttempt === attempt) releaseSpeechAudio(attempt);
    }, 0);
  }

  function emit(name, detail) {
    (listeners[name] || []).slice().forEach(function (listener) {
      try { listener(detail); } catch (error) { console.error(error); }
    });
  }

  function setStatus(nextStatus, detail) {
    status = nextStatus;
    emit("status", { status: nextStatus, detail: detail || null });
  }

  function on(name, listener) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(listener);
    return function () {
      listeners[name] = (listeners[name] || []).filter(function (item) {
        return item !== listener;
      });
    };
  }

  function judge(text, accepted) {
    if (!accepted || accepted.length === 0) return true;
    return SpeechNormalizer.includesAny(text, accepted);
  }

  async function listen(options) {
    options = options || {};
    teardownTrace("speech-listen-enter");
    setStatus("listening");
    var audioAttempt = window.AudioManager && typeof AudioManager.enterSpeechMode === "function" &&
      typeof AudioManager.exitSpeechMode === "function" ? {
        cancelled: false,
        released: false,
        enterPromise: null,
        recognitionPending: false
      } : null;
    var keepAudioForImmediateRetry = false;

    try {
      if (audioAttempt) await enterSpeechAudio(audioAttempt);
      var alternatives = [];
      if (audioAttempt) audioAttempt.recognitionPending = true;
      var text = await SpeechRecognitionAdapter.listen({
        lang: options.lang || GameConfig.defaultLanguage,
        timeoutMs: options.timeoutMs || 0,
        interimResults: options.interimResults !== false,
        continuous: options.continuous,
        maxAlternatives: options.maxAlternatives || 5,
        onStart: options.onStart,
        legacyTraceContext: options.legacyTraceContext,
        onInterim: function (value) {
          emit("interim", value);
          if (typeof options.onInterim === "function") options.onInterim(value);
        },
        onAlternatives: function (values) {
          alternatives = Array.isArray(values) ? values.slice() : [];
          if (typeof options.onAlternatives === "function") {
            options.onAlternatives(alternatives.slice());
          }
        }
      });
      if (Array.isArray(options.accepted) && options.accepted.length > 0) {
        var candidates = [text].concat(alternatives);
        for (var i = 0; i < candidates.length; i += 1) {
          if (judge(candidates[i], options.accepted)) {
            text = candidates[i];
            break;
          }
        }
      }
      setStatus("recognized", text);
      emit("result", text);
      keepAudioForImmediateRetry = options.__speechAudioContinuousRetry === true;
      return text;
    } catch (error) {
      setStatus("error", error);
      emit("error", error);
      throw error;
    } finally {
      teardownTrace("speech-listen-finally");
      if (keepAudioForImmediateRetry) finishSpeechAudio(audioAttempt);
      else await releaseSpeechAudio(audioAttempt);
      window.setTimeout(function () {
        if (status !== "listening") setStatus("idle");
      }, 0);
    }
  }

  async function mission(config, ui) {
    config = config || {};
    ui = ui || {};

    while (true) {
      if (typeof ui.showMission === "function") ui.showMission(config);
      var currentLegacyTraceContext = config.legacyTraceContext || null;

      var result = await new Promise(function (resolve) {
        var listening = false;
        var attemptSerial = 0;

        async function startListening() {
          if (listening) return;
          listening = true;
          var currentAttempt = ++attemptSerial;
          var latestPrimaryInterim = "";
          var consecutiveExactCount = 0;
          var earlyCommitSelected = null;
          var attemptTraceContext = config.legacyTraceContext || null;
          if (config.legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.startAttempt === "function") {
            attemptTraceContext = LegacySpeechTrace.startAttempt(config.legacyTraceContext);
          }
          currentLegacyTraceContext = attemptTraceContext;

          try {
            var listenOptions = {
              // Audio-only hint for the existing automatic mismatch loop.
              // Button or recovery UI waits always release before returning.
              __speechAudioContinuousRetry: config.retryOnMismatch !== false &&
                typeof ui.addStartButton !== "function" && typeof ui.onMismatch !== "function",
              lang: config.lang || GameConfig.defaultLanguage,
              timeoutMs: config.timeoutMs || 0,
              accepted: config.accepted,
              maxAlternatives: config.maxAlternatives || 5,
              s005TraceQuestionId: config.s005TraceQuestionId,
              onAlternatives: config.onAlternatives,
              legacyTraceContext: attemptTraceContext,
              onInterim: function (value) {
                var primary = String(value || "").trim();
                if (primary) latestPrimaryInterim = primary;
                if (typeof ui.showRecognized === "function") ui.showRecognized(value);
                var runIsCurrent = typeof config.__legacyInterimFallbackIsCurrent !== "function" ||
                  config.__legacyInterimFallbackIsCurrent();
                var attemptIsCurrent = currentAttempt === attemptSerial;
                if (config.__legacyEarlyCommit !== "stable-primary-normalized-exact-hello" ||
                    !runIsCurrent || !attemptIsCurrent || earlyCommitSelected) return;
                var normalizedPrimary = SpeechNormalizer.normalize(primary);
                if (normalizedPrimary !== "hello") {
                  consecutiveExactCount = 0;
                  return;
                }
                consecutiveExactCount += 1;
                if (consecutiveExactCount < 2) return;
                earlyCommitSelected = "hello";
                teardownTrace("hello-early-commit");
                if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
                  LegacySpeechTrace.record(attemptTraceContext, "legacy-early-commit-selected", {
                    candidate: primary,
                    normalizedCandidate: normalizedPrimary,
                    consecutiveExactCount: consecutiveExactCount,
                    attemptSerial: attemptSerial,
                    runIsCurrent: runIsCurrent,
                    attemptIsCurrent: attemptIsCurrent
                  });
                }
                stop();
              }
            };
            var heard;
            if (window.SpeechStartController && typeof SpeechStartController.startListening === "function") {
              heard = await SpeechStartController.startListening(listenOptions, {
                clearControls: ui.clearControls,
                showRecognized: ui.showRecognized
              });
            } else {
              if (typeof ui.clearControls === "function") ui.clearControls();
              if (typeof ui.showRecognized === "function") ui.showRecognized("…");
              heard = await listen(listenOptions);
            }
            var resolvedRunIsCurrent = typeof config.__legacyInterimFallbackIsCurrent !== "function" ||
              config.__legacyInterimFallbackIsCurrent();
            if (earlyCommitSelected && currentAttempt === attemptSerial && resolvedRunIsCurrent) {
              resolve(earlyCommitSelected);
              return;
            }
            resolve(heard);
          } catch (error) {
            var errorCode = error && error.message ? error.message : String(error || "speech-error");
            var commonRescueCandidate = latestPrimaryInterim;
            var fallbackCurrent = typeof config.__legacyInterimFallbackIsCurrent !== "function" ||
              config.__legacyInterimFallbackIsCurrent();
            if (earlyCommitSelected && currentAttempt === attemptSerial && fallbackCurrent) {
              resolve(earlyCommitSelected);
              return;
            }
            if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
              var fallbackAccepted = Array.isArray(config.accepted) ? config.accepted.slice() : [];
              var normalizedCandidateForCheck = SpeechNormalizer.normalize(latestPrimaryInterim);
              var normalizedAcceptedForCheck = fallbackAccepted.map(function (accepted) {
                return SpeechNormalizer.normalize(accepted);
              });
              var errorIsNoSpeech = errorCode === "no-speech";
              var policyEnabled = config.__legacyInterimFallback === "primary-normalized-exact";
              var candidatePresent = Boolean(latestPrimaryInterim);
              var attemptIsCurrent = currentAttempt === attemptSerial;
              var exactMatch = normalizedCandidateForCheck !== "" &&
                normalizedAcceptedForCheck.indexOf(normalizedCandidateForCheck) !== -1;
              LegacySpeechTrace.record(attemptTraceContext, "legacy-interim-fallback-check", {
                errorCode: errorCode,
                latestPrimaryInterim: latestPrimaryInterim,
                normalizedCandidate: normalizedCandidateForCheck,
                fallbackPolicy: config.__legacyInterimFallback,
                currentAttempt: currentAttempt,
                attemptSerial: attemptSerial,
                errorIsNoSpeech: errorIsNoSpeech,
                policyEnabled: policyEnabled,
                candidatePresent: candidatePresent,
                attemptIsCurrent: attemptIsCurrent,
                runIsCurrent: fallbackCurrent,
                accepted: fallbackAccepted,
                normalizedAccepted: normalizedAcceptedForCheck,
                exactMatch: exactMatch,
                fallbackEligible: errorIsNoSpeech && policyEnabled && candidatePresent &&
                  attemptIsCurrent && fallbackCurrent && exactMatch
              });
            }
            if (errorCode === "no-speech" &&
                config.__legacyInterimFallback === "primary-normalized-exact" &&
                currentAttempt === attemptSerial && fallbackCurrent && latestPrimaryInterim) {
              var normalizedCandidate = SpeechNormalizer.normalize(latestPrimaryInterim);
              var matchedAccepted = (config.accepted || []).find(function (accepted) {
                return normalizedCandidate !== "" && SpeechNormalizer.normalize(accepted) === normalizedCandidate;
              });
              if (matchedAccepted !== undefined) {
                if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
                  LegacySpeechTrace.record(attemptTraceContext, "legacy-interim-fallback-selected", {
                    candidate: latestPrimaryInterim,
                    normalizedCandidate: normalizedCandidate,
                    matchedAccepted: matchedAccepted
                  });
                }
                resolve(latestPrimaryInterim);
                return;
              }
            }
            if (errorCode === "no-speech" && config.__legacyCommonInterimRescue === true &&
                commonRescueCandidate && currentAttempt === attemptSerial && fallbackCurrent) {
              if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
                LegacySpeechTrace.record(attemptTraceContext, "legacy-common-interim-rescue-selected", {
                  candidate: commonRescueCandidate
                });
              }
              resolve(commonRescueCandidate);
              return;
            }
            if (!SpeechRecognitionAdapter.supported && typeof ui.textInput === "function") {
              resolve(await ui.textInput(config.fallbackPrompt || "マイクが使えないため、言葉を入力してね。"));
              return;
            }

            listening = false;
            if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
              LegacySpeechTrace.record(attemptTraceContext, "legacy-retry-show", {
                error: error && error.message ? error.message : String(error || "speech-error")
              });
            }
            if (attemptTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
              LegacySpeechTrace.recordInvite(attemptTraceContext, "retry-trigger", {
                reason: "recognition-error",
                error: error && error.message ? error.message : String(error || "speech-error")
              });
            }
            if (typeof ui.showRetry === "function") ui.showRetry(error, startListening, config);
          }
        }

        if (typeof ui.addStartButton === "function") ui.addStartButton(startListening, config);
        else startListening();
      });

      if (typeof ui.showRecognized === "function") ui.showRecognized(result);
      if (currentLegacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
        LegacySpeechTrace.record(currentLegacyTraceContext, "legacy-judge-start", {
          transcript: String(result || ""),
          accepted: Array.isArray(config.accepted) ? config.accepted.slice() : []
        });
      }
      if (currentLegacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
        LegacySpeechTrace.recordInvite(currentLegacyTraceContext, "legacy-judge-input", {
          rawTranscript: String(result || ""),
          normalizedTranscript: SpeechNormalizer.normalize(result),
          acceptedAnswers: Array.isArray(config.accepted) ? config.accepted.slice() : []
        });
      }
      if (judge(result, config.accepted)) {
        await releaseSpeechAudio(speechAudioAttempt);
        if (currentLegacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
          var matchedAnswer = currentLegacyTraceContext.questionId === "phrase.come_with_us" && Array.isArray(config.accepted) ?
            config.accepted.find(function (answer) { return SpeechNormalizer.includesAny(result, [answer]); }) || null : null;
          LegacySpeechTrace.record(currentLegacyTraceContext, "legacy-judge-result", Object.assign({ matched: true, transcript: String(result || "") },
            currentLegacyTraceContext.questionId === "phrase.come_with_us" ? { matchedAnswer: matchedAnswer } : {}));
          LegacySpeechTrace.record(currentLegacyTraceContext, "legacy-success", { transcript: String(result || "") });
        }
        setStatus("success", result);
        emit("success", result);
        if (typeof ui.onSuccess === "function") await ui.onSuccess(result, config);
        if (config.retryOnMismatch === false) return { matched: true, answer: result };
        return result;
      }

      if (config.retryOnMismatch === false) {
        if (currentLegacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
          LegacySpeechTrace.record(currentLegacyTraceContext, "legacy-judge-result", Object.assign({ matched: false, transcript: String(result || "") },
            currentLegacyTraceContext.questionId === "phrase.come_with_us" ? { matchedAnswer: null } : {}));
        }
        setStatus("failure", result);
        emit("failure", result);
        if (typeof ui.onMismatch === "function") await ui.onMismatch(result, config);
        return { matched: false, answer: result };
      }

      setStatus("retry", result);
      emit("retry", result);
      if (typeof ui.onMismatch === "function") await ui.onMismatch(result, config);
    }
  }

  function stop() {
    if (speechAudioAttempt) {
      speechAudioAttempt.cancelled = true;
      if (speechAudioExitTimer !== null) window.clearTimeout(speechAudioExitTimer);
      speechAudioExitTimer = null;
      // Once Recognition owns the attempt, its promise settles only from
      // onend. listen()'s finally then serializes Audio restoration. During
      // pre-recognition isolation entry there is no onend to wait for, so that
      // narrow cancellation path still releases immediately.
      if (!speechAudioAttempt.recognitionPending) releaseSpeechAudio(speechAudioAttempt);
    }
    SpeechRecognitionAdapter.stop();
    setStatus("idle");
  }

  window.SpeechEngine = {
    listen: listen,
    mission: mission,
    judge: judge,
    normalize: SpeechNormalizer.normalize,
    includesAny: SpeechNormalizer.includesAny,
    stop: stop,
    on: on,
    getStatus: function () { return status; },
    supported: SpeechRecognitionAdapter.supported
  };
})();
