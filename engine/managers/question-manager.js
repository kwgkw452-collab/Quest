(function () {
  "use strict";

  var runId = 0;
  var result = null;
  var activeMode = null;
  var COMMUNICATIVE_MAX_RETRIES = 1;

  function s005Trace(questionId, eventName, detail) {
    if (typeof questionId !== "string" || questionId.indexOf("s005.communication.") !== 0) return;
    console.log("[S005 TRACE] " + eventName, Object.assign({ questionId: questionId }, detail || {}));
  }

  function trace(eventName, context, detail) {
    if (!window.FormalSpeechTrace || typeof window.FormalSpeechTrace.record !== "function") return;
    window.FormalSpeechTrace.record(eventName, Object.assign({
      source: context && context.source || "unknown",
      runId: context && context.flowRunId,
      questionManagerRunId: context && context.questionManagerRunId,
      presenterToken: context && context.presenterToken,
      attemptCount: context && context.attemptCount,
      speechRetries: context && context.speechRetries,
      component: "question-manager"
    }, detail || {}));
  }

  function snapshot(value) {
    if (!value) return null;
    if (value.judgeMode === "communicative") {
      return {
        questionId: value.questionId,
        category: value.category,
        judgeMode: value.judgeMode,
        status: value.status,
        answer: value.answer,
        alternatives: Array.isArray(value.alternatives) ? value.alternatives.slice() : [],
        judge: value.judge ? Object.assign({}, value.judge) : null,
        attemptCount: value.attemptCount,
        maxRetries: value.maxRetries,
        resolution: value.resolution,
        success: value.success,
        failure: value.failure,
        hint: value.hint,
        error: value.error
      };
    }
    return {
      questionId: value.questionId,
      category: value.category,
      status: value.status,
      answer: value.answer,
      success: value.success,
      failure: value.failure,
      hint: value.hint,
      error: value.error
    };
  }

  function makeResult(question, status) {
    return {
      questionId: question ? question.id : null,
      category: question ? question.category : null,
      status: status,
      answer: null,
      success: question ? question.success : "",
      failure: question ? question.failure : "",
      hint: question ? question.hint : null,
      error: null
    };
  }

  function makeCommunicativeResult(question, status) {
    return {
      questionId: question ? question.id : null,
      category: question ? question.category : null,
      judgeMode: "communicative",
      status: status,
      answer: null,
      alternatives: [],
      judge: null,
      attemptCount: 0,
      maxRetries: COMMUNICATIVE_MAX_RETRIES,
      resolution: null,
      success: question ? question.success : "",
      failure: question ? question.failure : "",
      hint: question ? question.hint : null,
      error: null
    };
  }

  function communicativeAdapter() {
    return window["CommunicativeQuestion" + "Adapter"];
  }

  function silenceGameAudio() {
    try {
      if (window.SpeechStartController && typeof SpeechStartController.prepare === "function") {
        return SpeechStartController.prepare();
      }
      if (window.SpeechAudioDuckingInternal && SpeechAudioDuckingInternal.isArmed()) {
        return SpeechAudioDuckingInternal.begin();
      }
      if (window.AudioManager && typeof AudioManager.stopAll === "function") AudioManager.stopAll();
    } catch (error) {
      console.warn("Audio stop before speech recognition failed:", error);
    }
  }

  async function startLegacy(question, currentRun, currentResult, options) {
    options = options || {};
    var sourceContext = options.__legacyTraceContext || {};
    var legacyTraceContext = window.LegacySpeechTrace && typeof LegacySpeechTrace.begin === "function" ?
      LegacySpeechTrace.begin({
        questionId: question.id,
        storyId: sourceContext.storyId,
        runtime: sourceContext.runtime || "legacy",
        monsterId: sourceContext.monsterId,
        runId: currentRun
      }) : null;
    var audioPreparation = silenceGameAudio();
    if (audioPreparation && typeof audioPreparation.then === "function") {
      await audioPreparation;
      if (currentRun !== runId) return snapshot(currentResult);
    }

    try {
      var answer = await GameCore.speechMission({
        message: question.prompt,
        accepted: question.answers,
        failure: question.failure,
        retryOnMismatch: false,
        legacyTraceContext: legacyTraceContext,
        __legacyCommonInterimRescue: true,
        __legacyInterimFallback: question.speechPolicy ? question.speechPolicy.interimFallback : undefined,
        __legacyEarlyCommit: question.id === "word.hello" && question.speechPolicy &&
          question.speechPolicy.interimFallback === "primary-normalized-exact" ?
          "stable-primary-normalized-exact-hello" : undefined,
        __legacyInterimFallbackIsCurrent: function () {
          return currentRun === runId;
        }
      });

      if (currentRun !== runId) return snapshot(currentResult);
      currentResult.answer = answer && typeof answer === "object" ? answer.answer : answer;
      currentResult.status = answer && answer.matched === false ? "failure" : "success";
      if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
        LegacySpeechTrace.recordInvite(legacyTraceContext, "question-result", {
          status: currentResult.status,
          answer: currentResult.answer,
          error: currentResult.error
        });
      }
      if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
        LegacySpeechTrace.record(legacyTraceContext, "legacy-flow-end", {
          status: currentResult.status,
          answer: currentResult.answer
        });
      }
      return snapshot(currentResult);
    } catch (error) {
      if (currentRun !== runId) return snapshot(currentResult);
      currentResult.status = "failure";
      currentResult.error = error && error.message ? error.message : String(error);
      if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.recordInvite === "function") {
        LegacySpeechTrace.recordInvite(legacyTraceContext, "question-result", {
          status: currentResult.status,
          answer: currentResult.answer,
          error: currentResult.error
        });
      }
      if (legacyTraceContext && window.LegacySpeechTrace && typeof LegacySpeechTrace.record === "function") {
        LegacySpeechTrace.record(legacyTraceContext, "legacy-flow-end", {
          status: currentResult.status,
          error: currentResult.error
        });
      }
      return snapshot(currentResult);
    }
  }

  function communicativeTarget(question) {
    var settings = question.communicative;
    var target = {
      conceptId: settings.conceptId,
      difficulty: settings.difficulty,
      promptType: settings.promptType,
      expectedUtterance: settings.expectedUtterance,
      acceptedVariants: [],
      poolId: null,
      itemId: question.id
    };
    if (settings.poolId) {
      var draw = window.LotteryEngine && typeof LotteryEngine.draw === "function" ?
        LotteryEngine.draw(settings.poolId, {
          difficulty: settings.difficulty, promptType: settings.promptType
        }) : null;
      if (draw && draw.status === "selected" && draw.conceptId === settings.conceptId &&
          draw.difficulty === settings.difficulty && draw.promptType === settings.promptType &&
          draw.displayValue === question.prompt) {
        target = draw;
      }
    }
    return target;
  }

  function communicativeCandidateKey(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    if (window.SpeechNormalizer && typeof SpeechNormalizer.normalize === "function") {
      return SpeechNormalizer.normalize(text);
    }
    return text.toLowerCase();
  }

  function mergeCommunicativeCandidates(current, values) {
    var merged = Array.isArray(current) ? current.slice(0, 6) : [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var text = String(value || "").trim();
      var key = communicativeCandidateKey(text);
      if (!key || merged.some(function (item) { return communicativeCandidateKey(item) === key; })) return;
      // Keep one extra slot so removing a duplicate primary still leaves five alternatives.
      if (merged.length < 6) merged.push(text);
    });
    return merged;
  }

  function communicativeAlternatives(values, primary) {
    var primaryKey = communicativeCandidateKey(primary);
    return mergeCommunicativeCandidates([], values).filter(function (value) {
      return communicativeCandidateKey(value) !== primaryKey;
    }).slice(0, 5);
  }

  async function listenCommunicative(options) {
    options = options || {};
    var traceContext = options.__formalTraceContext || null;
    var alternatives = [];
    var latestInterim = "";
    var acceptsCandidates = true;
    var lateWaitActive = false;
    var lateCandidateResolve = null;
    var lateCandidate = new Promise(function (resolve) {
      lateCandidateResolve = resolve;
    });

    function candidateArrived() {
      if (lateWaitActive) trace("late-result-candidate", traceContext, {
        transcript: latestInterim,
        candidateCount: alternatives.length
      });
      if (lateCandidateResolve) {
        lateCandidateResolve();
        lateCandidateResolve = null;
      }
    }

    function waitForLateCandidate(errorCode) {
      if (latestInterim || alternatives.length > 0) return Promise.resolve();
      lateWaitActive = true;
      trace("late-result-wait-start", traceContext, { errorCode: errorCode });
      return new Promise(function (resolve) {
        var timeoutId = window.setTimeout(function () {
          trace("late-result-expire", traceContext, { candidateCount: alternatives.length });
          lateWaitActive = false;
          resolve();
        }, 250);
        lateCandidate.then(function () {
          window.clearTimeout(timeoutId);
          lateWaitActive = false;
          resolve();
        });
      });
    }

    var speechOptions = {
      lang: "en-US",
      timeoutMs: 8000,
      maxAlternatives: 5,
      s005TraceQuestionId: options.s005TraceQuestionId,
      onInterim: function (value) {
        if (!acceptsCandidates) return;
        var text = String(value || "").trim();
        if (text) {
          latestInterim = text;
          candidateArrived();
        }
        trace("interim", traceContext, { transcript: text, candidateCount: alternatives.length });
        if (typeof options.onInterim === "function") options.onInterim(value);
      },
      onAlternatives: function (values) {
        if (!acceptsCandidates) return;
        alternatives = mergeCommunicativeCandidates(alternatives, values);
        if (alternatives.length > 0) candidateArrived();
        trace("alternatives", traceContext, { candidateCount: alternatives.length });
      },
      onStart: function () {
        trace("listening-start", traceContext);
      }
    };
    function startListening() {
      trace("startListening-call", traceContext);
      if (window.SpeechStartController && typeof SpeechStartController.startListening === "function") {
        var ui = typeof options.onInterim === "function" ? { showRecognized: options.onInterim } : {};
        return SpeechStartController.startListening(speechOptions, ui);
      }
      return SpeechEngine.listen(speechOptions);
    }
    var answer;
    try {
      answer = typeof options.speechStart === "function" ?
        await options.speechStart(startListening) : await startListening();
    } catch (error) {
      var message = error && error.message ? error.message : String(error || "speech-error");
      var errorEvent = ["no-speech", "speech-timeout", "not-allowed", "speech-not-supported"].indexOf(message) !== -1 ?
        message : "recognition-error";
      trace(errorEvent, traceContext, { errorCode: message, transcript: latestInterim, candidateCount: alternatives.length });
      if ((message === "no-speech" || message === "speech-timeout") && !latestInterim && alternatives.length === 0) {
        await waitForLateCandidate(message);
      }
      var fallback = latestInterim || alternatives[0] || "";
      acceptsCandidates = false;
      if ((message === "no-speech" || message === "speech-timeout") && fallback) {
        trace("late-result-finalized", traceContext, { transcript: fallback, candidateCount: alternatives.length });
        return {
          status: "recognized",
          transcript: fallback,
          alternatives: communicativeAlternatives(alternatives, fallback)
        };
      }
      throw error;
    }
    acceptsCandidates = false;
    trace("final", traceContext, { transcript: answer, candidateCount: alternatives.length });
    return {
      status: "recognized",
      transcript: answer,
      alternatives: communicativeAlternatives(alternatives, answer)
    };
  }

  function applyCommunicativeResult(currentResult, adapterResult) {
    var statuses = {
      accept: "success",
      reject: "reject",
      unknown: "unknown",
      "speech-failure": "speech-failure",
      cancelled: "cancelled"
    };
    currentResult.status = statuses[adapterResult.status] || "unknown";
    currentResult.answer = adapterResult.transcript || null;
    currentResult.alternatives = Array.isArray(adapterResult.alternatives) ? adapterResult.alternatives.slice() : [];
    currentResult.judge = adapterResult.judge ? Object.assign({}, adapterResult.judge) : null;
    currentResult.resolution = currentResult.status === "success" ? "accepted" :
      currentResult.status === "cancelled" ? "cancelled" : null;
    currentResult.error = adapterResult.speechError || null;
  }

  function communicativeInput(options) {
    if (options && options.inputMode === "text") {
      return Promise.resolve({
        status: "recognized",
        transcript: String(options.transcript || ""),
        alternatives: []
      });
    }
    return listenCommunicative(options);
  }

  async function startCommunicative(question, currentRun, currentResult, options) {
    options = options || {};
    var traceContext = options.__formalTraceContext || null;
    if (traceContext) traceContext.questionManagerRunId = currentRun;
    trace("prepare-start", traceContext);
    var audioPreparation = silenceGameAudio();
    if (audioPreparation && typeof audioPreparation.then === "function") {
      await audioPreparation;
      if (currentRun !== runId) {
        trace("stale-result-discard", traceContext, { stage: "prepare-complete" });
        return snapshot(currentResult);
      }
    }
    trace("prepare-complete", traceContext);
    var adapter = communicativeAdapter();
    if (!adapter) {
      currentResult.status = "unknown";
      currentResult.error = "communicative-adapter-unavailable";
      return snapshot(currentResult);
    }

    var target = communicativeTarget(question);
    trace("task-selected", traceContext, {
      questionId: question.id, taskSpecId: null,
      poolId: target.poolId, itemId: target.itemId, conceptId: target.conceptId,
      lotteryStatus: target.poolId ? "selected" : (question.communicative.poolId ? "unavailable" : "not-configured"),
      displayValue: question.prompt, expectedUtterance: target.expectedUtterance
    });
    var token = adapter.begin();
    currentResult.attemptCount = 1;
    if (traceContext) traceContext.attemptCount = currentResult.attemptCount;
    var speechResult;
    try {
      var inputOptions = Object.assign({}, options, {
        s005TraceQuestionId: question.id.indexOf("s005.communication.") === 0 ? question.id : null
      });
      speechResult = await communicativeInput(inputOptions);
    } catch (error) {
      if (currentRun !== runId) {
        trace("stale-result-discard", traceContext, { stage: "speech-error" });
        return snapshot(currentResult);
      }
      var failureResult = adapter.speechFailure(target, error);
      applyCommunicativeResult(currentResult, failureResult);
      trace("speech-failure-result", traceContext, {
        errorCode: currentResult.error,
        transcript: currentResult.answer,
        candidateCount: currentResult.alternatives.length
      });
      return snapshot(currentResult);
    }

    if (currentRun !== runId) {
      trace("stale-result-discard", traceContext, { stage: "recognized" });
      return snapshot(currentResult);
    }
    try {
      if (question.id.indexOf("s005.communication.") === 0) {
        var ruleRegistry = Array.isArray(window.CommunicativeJudgeRuleData) ?
          window.CommunicativeJudgeRuleData : [];
        var selectedRule = ruleRegistry.filter(function (candidate) {
          return candidate && candidate.conceptId === target.conceptId;
        })[0] || null;
        console.log("[S005 RULE TRACE] registry-check", {
          questionId: question.id,
          conceptId: target.conceptId,
          registryLength: ruleRegistry.length,
          ruleExists: Boolean(selectedRule),
          ruleConceptId: selectedRule && selectedRule.conceptId || null,
          variants: selectedRule && Array.isArray(selectedRule.variants) ? selectedRule.variants.slice() : [],
          hasAcceptFunction: Boolean(selectedRule && typeof selectedRule.accept === "function"),
          sameRegistryAsAssetLoad: window.__S005RuleTraceRegistry === ruleRegistry
        });
      }
      s005Trace(question.id, "judge-start", {
        transcript: speechResult.transcript,
        normalizedTranscript: window.SpeechNormalizer && typeof SpeechNormalizer.normalize === "function" ?
          SpeechNormalizer.normalize(speechResult.transcript) : String(speechResult.transcript || "").toLowerCase().trim()
      });
      trace("judge-start", traceContext, { transcript: speechResult.transcript, candidateCount: speechResult.alternatives.length });
      var adapterResult = await adapter.evaluate(target, speechResult, token);
      if (currentRun !== runId) {
        trace("stale-result-discard", traceContext, { stage: "judge-result" });
        return snapshot(currentResult);
      }
      applyCommunicativeResult(currentResult, adapterResult);
      s005Trace(question.id, "judge-result", {
        verdict: currentResult.judge && currentResult.judge.verdict,
        reason: currentResult.judge && currentResult.judge.reason,
        source: currentResult.judge && currentResult.judge.source
      });
      trace("judge-result", traceContext, {
        transcript: currentResult.answer,
        candidateCount: currentResult.alternatives.length,
        verdict: currentResult.judge && currentResult.judge.verdict,
        conceptId: target.conceptId,
        poolId: target.poolId,
        itemId: target.itemId,
        normalizedUtterance: currentResult.judge && currentResult.judge.normalizedUtterance,
        judgeSource: currentResult.judge && currentResult.judge.source,
        judgeReason: currentResult.judge && currentResult.judge.reason,
        status: currentResult.status
      });
      return snapshot(currentResult);
    } catch (error) {
      if (currentRun !== runId) return snapshot(currentResult);
      currentResult.status = "unknown";
      currentResult.error = error && error.message ? error.message : String(error);
      return snapshot(currentResult);
    }
  }

  async function start(questionId, options) {
    var question = QuestionDatabase.get(questionId);
    if (!question) throw new Error("Question not found: " + questionId);
    if (question.category !== "word") {
      throw new Error("Question category is not supported in Version 1.0: " + question.category);
    }

    cancel();
    var currentRun = runId;
    var traceContext = options && options.__formalTraceContext || null;
    if (traceContext) traceContext.questionManagerRunId = currentRun;
    trace("question-manager-start", traceContext, { questionId: questionId });
    activeMode = question.communicative ? "communicative" : "legacy";
    var currentResult = question.communicative ?
      makeCommunicativeResult(question, "running") : makeResult(question, "running");
    result = currentResult;
    if (question.communicative) return startCommunicative(question, currentRun, currentResult, options);
    return startLegacy(question, currentRun, currentResult, options);
  }

  function cancel() {
    runId += 1;
    var cancelCommunicative = activeMode === "communicative";
    if (result && result.status === "running") {
      result.status = "cancelled";
      if (result.judgeMode === "communicative") result.resolution = "cancelled";
    }
    if (window.SpeechStartController && typeof SpeechStartController.cancel === "function") {
      SpeechStartController.cancel();
    } else if (window.SpeechEngine && SpeechEngine.getStatus() === "listening") SpeechEngine.stop();
    var adapter = communicativeAdapter();
    if (cancelCommunicative && adapter && typeof adapter.cancel === "function") {
      adapter.cancel();
    }
    activeMode = null;
    return snapshot(result);
  }

  function getResult() {
    return snapshot(result);
  }

  function reset() {
    cancel();
    result = null;
  }

  window.QuestionManager = {
    start: start,
    cancel: cancel,
    getResult: getResult,
    reset: reset
  };
})();
