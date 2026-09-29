(function () {
  "use strict";

  var MAX_SPEECH_RETRIES = 1;
  var MAX_TEXT_FALLBACKS = 1;
  var runId = 0;
  var result = null;

  function trace(eventName, context, detail) {
    if (!window.FormalSpeechTrace || typeof window.FormalSpeechTrace.record !== "function") return;
    window.FormalSpeechTrace.record(eventName, Object.assign({
      source: context && context.source || "formal-story",
      runId: context && context.flowRunId,
      questionManagerRunId: context && context.questionManagerRunId,
      presenterToken: context && context.presenterToken,
      attemptCount: context && context.attemptCount,
      speechRetries: context && context.speechRetries,
      component: "flow-controller"
    }, detail || {}));
  }

  function snapshot(value) {
    if (!value) return null;
    var copy = Object.assign({}, value);
    if (Array.isArray(value.alternatives)) copy.alternatives = value.alternatives.slice();
    if (value.judge) copy.judge = Object.assign({}, value.judge);
    return copy;
  }

  function cancelled(value) {
    var copy = snapshot(value) || {
      questionId: null,
      category: null,
      judgeMode: "communicative",
      answer: null,
      alternatives: [],
      judge: null,
      error: null
    };
    copy.status = "cancelled";
    copy.resolution = "cancelled";
    return copy;
  }

  function continued(value) {
    var copy = snapshot(value);
    copy.status = "continued";
    copy.resolution = "continue";
    copy.error = null;
    return copy;
  }

  function speechRetryAllowed(value, used, textUsed) {
    if (used >= MAX_SPEECH_RETRIES || textUsed > 0) return false;
    if (!value || value.status !== "speech-failure") return true;
    return value.error !== "not-allowed" && value.error !== "speech-not-supported";
  }

  async function start(questionId) {
    var question = QuestionDatabase.get(questionId);
    if (!question || !question.communicative) {
      throw new Error("Formal Communicative flow needs a Communicative Question: " + questionId);
    }

    cancel();
    var currentRun = runId;
    var traceContext = {
      source: "formal-story",
      flowRunId: currentRun,
      questionManagerRunId: null,
      presenterToken: null,
      attemptCount: 0,
      speechRetries: 0
    };
    var presenterToken = CommunicativeQuestionPresenter.begin();
    traceContext.presenterToken = presenterToken;
    var speechRetries = 0;
    var textFallbacks = 0;
    var attempts = 0;
    var supportStage = 0;
    var supportedAttempt = 0;
    var attemptTraceContext = traceContext;
    trace("formal-flow-start", traceContext, { questionId: questionId });

    function finish(value) {
      trace("flow-end", traceContext, { status: value && value.status, resolution: value && value.resolution });
      return value;
    }

    async function runQuestion(options) {
      attempts += 1;
      traceContext.attemptCount = attempts;
      traceContext.speechRetries = speechRetries;
      var currentAttemptTraceContext = Object.assign({}, traceContext);
      attemptTraceContext = currentAttemptTraceContext;
      var questionOptions = Object.assign({}, options || {});
      questionOptions.__formalTraceContext = currentAttemptTraceContext;
      if (questionOptions.inputMode !== "text") {
        questionOptions.speechStart = function (startListening) {
          return CommunicativeQuestionPresenter.speech(startListening, presenterToken, currentAttemptTraceContext,
            question.picoSupport ? question.prompt : null);
        };
        questionOptions.onInterim = function (value) {
          CommunicativeQuestionPresenter.listening(value, presenterToken);
        };
      }
      var value = await QuestionManager.start(questionId, questionOptions);
      if (currentRun !== runId) {
        trace("stale-result-discard", currentAttemptTraceContext, { stage: "question-result" });
        return cancelled(value);
      }
      value.attemptCount = attempts;
      value.maxRetries = MAX_SPEECH_RETRIES;
      return value;
    }

    result = await runQuestion();
    while (currentRun === runId) {
      if (result.status === "success" || result.status === "cancelled") return finish(snapshot(result));

      if (question.picoSupport && supportedAttempt < attempts) {
        supportStage = Math.min(3, supportStage + 1);
        supportedAttempt = attempts;
      }

      var action = await CommunicativeQuestionPresenter.recovery(result, {
        retry: speechRetryAllowed(result, speechRetries, textFallbacks),
        text: !question.picoSupport && textFallbacks < MAX_TEXT_FALLBACKS,
        support: Boolean(question.picoSupport && supportStage < 3),
        supportText: question.picoSupport ? question.picoSupport[supportStage - 1] : null
      }, presenterToken, attemptTraceContext);
      if (currentRun !== runId || action === "cancelled") {
        result = cancelled(result);
        return finish(snapshot(result));
      }

      if (action === "retry") {
        speechRetries += 1;
        traceContext.speechRetries = speechRetries;
        trace("retry-selected", traceContext);
        result = await runQuestion();
        continue;
      }

      if (action === "support" && question.picoSupport && supportStage < 3) {
        supportStage += 1;
        continue;
      }

      if (action === "text") {
        textFallbacks += 1;
        var typedText = await CommunicativeQuestionPresenter.textInput(presenterToken);
        if (currentRun !== runId || typedText === "cancelled") {
          result = cancelled(result);
          return snapshot(result);
        }
        result = await runQuestion({ inputMode: "text", transcript: typedText });
        continue;
      }

      result = continued(result);
      var continueAction = await CommunicativeQuestionPresenter.continued(presenterToken);
      if (currentRun !== runId || continueAction === "cancelled") {
        result = cancelled(result);
      }
      return finish(snapshot(result));
    }

    result = cancelled(result);
    return finish(snapshot(result));
  }

  function cancel() {
    runId += 1;
    trace("cancel", { source: "formal-story", flowRunId: runId }, { stage: "flow-cancel" });
    try { QuestionManager.cancel(); } catch (_) { /* Question may not be initialized. */ }
    try { CommunicativeQuestionPresenter.cancel(); } catch (_) { /* Presenter may not be initialized. */ }
    if (result && result.status !== "success" && result.status !== "continued") result = cancelled(result);
    return snapshot(result);
  }

  function getResult() {
    return snapshot(result);
  }

  function reset() {
    cancel();
    result = null;
  }

  window.CommunicativeQuestionFlowController = {
    start: start,
    cancel: cancel,
    getResult: getResult,
    reset: reset
  };
})();
