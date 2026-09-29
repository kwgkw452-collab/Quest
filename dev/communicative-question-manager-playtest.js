(function () {
  "use strict";

  var QUESTION_ID = "dev.communicative.apple-order.playtest";
  var EXPECTED_CONCEPT_ID = "shopping.fruit.apple.order";
  var RUNTIME_MISMATCH = "dev-runtime-version-mismatch";
  var MAX_RETRIES = 1;
  var RETRYABLE = ["reject", "unknown", "speech-failure"];
  var state = {
    registered: false,
    status: "idle",
    retries: 0,
    runId: 0,
    resolution: null,
    inputMode: null,
    lastResult: null
  };
  var ui = {};
  var queuedText = null;
  var originalStartListening = null;

  function copy(value) {
    if (!value) return null;
    var result = Object.assign({}, value);
    if (Array.isArray(value.alternatives)) result.alternatives = value.alternatives.slice();
    if (value.judge) result.judge = Object.assign({}, value.judge);
    if (value.diagnosticResult) result.diagnosticResult = Object.assign({}, value.diagnosticResult);
    return result;
  }

  function registerPlaytestQuestion() {
    var existing = window.QuestionDatabase.get(QUESTION_ID);
    if (existing) {
      state.registered = true;
      return existing;
    }
    var question = window.QuestionDatabase.register({
      id: QUESTION_ID,
      category: "word",
      prompt: "Appleを英語で注文してください。",
      answers: ["unused-dev-playtest-answer"],
      success: "伝わったよ！",
      failure: "もう一度言ってみよう。",
      hint: "Apple, please.",
      communicative: {
        conceptId: EXPECTED_CONCEPT_ID,
        difficulty: "starter",
        promptType: "order",
        expectedUtterance: "Apple, please."
      }
    });
    state.registered = true;
    return question;
  }

  function hasFunctions(value, names) {
    return value && names.every(function (name) { return typeof value[name] === "function"; });
  }

  function checkRuntime() {
    if (!hasFunctions(window.QuestionDatabase, ["get", "register"])) return { ok: false, detail: "question-database" };
    if (!hasFunctions(window.QuestionManager, ["start", "cancel", "getResult", "reset"])) return { ok: false, detail: "question-manager" };
    if (!hasFunctions(window.CommunicativeQuestionAdapter, ["begin", "cancel", "evaluate", "speechFailure"])) {
      return { ok: false, detail: "communicative-question-adapter" };
    }
    if (!hasFunctions(window.CommunicativeJudge, ["judge"])) return { ok: false, detail: "communicative-judge" };
    if (!hasFunctions(window.LocalCommunicativeJudge, ["evaluate"])) return { ok: false, detail: "local-communicative-judge" };
    if (!Array.isArray(window.CommunicativeJudgeRuleData)) return { ok: false, detail: "communicative-judge-rules" };
    if (!hasFunctions(window.WordDictionaryDatabase, ["get"])) return { ok: false, detail: "word-dictionaries" };
    if (!hasFunctions(window.SpeechStartController, ["startListening", "cancel"])) return { ok: false, detail: "speech-start-controller" };
    try {
      registerPlaytestQuestion();
      var question = window.QuestionDatabase.get(QUESTION_ID);
      if (!question || !question.communicative || question.communicative.conceptId !== EXPECTED_CONCEPT_ID) {
        return { ok: false, detail: "playtest-question-communicative" };
      }
      return { ok: true, question: question };
    } catch (error) {
      return { ok: false, detail: "question-registration", error: error };
    }
  }

  function runtimeError(detail, originalResult) {
    var result = {
      questionId: QUESTION_ID,
      category: originalResult && originalResult.category || "word",
      judgeMode: "runtime-check",
      status: "runtime-error",
      answer: originalResult && originalResult.answer || null,
      alternatives: originalResult && Array.isArray(originalResult.alternatives) ? originalResult.alternatives.slice() : [],
      judge: null,
      attemptCount: state.retries + 1,
      maxRetries: MAX_RETRIES,
      resolution: null,
      error: RUNTIME_MISMATCH,
      diagnosticDetail: detail || null,
      diagnosticResult: originalResult ? copy(originalResult) : null
    };
    state.lastResult = result;
    state.status = result.status;
    state.resolution = null;
    render();
    return copy(result);
  }

  function installTextInjection() {
    if (originalStartListening) return;
    originalStartListening = window.SpeechStartController.startListening;
    window.SpeechStartController.startListening = function (options, controls) {
      if (queuedText === null) return originalStartListening.call(window.SpeechStartController, options, controls);
      var value = queuedText;
      queuedText = null;
      if (options && typeof options.onAlternatives === "function") options.onAlternatives([]);
      return Promise.resolve(value);
    };
  }

  function element(tag, text) {
    var node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, action) {
    var node = element("button", label);
    node.type = "button";
    node.style.cssText = "margin:4px;padding:7px 10px;border:1px solid #777;border-radius:5px;background:#fff;color:#222;cursor:pointer";
    node.addEventListener("click", action);
    return node;
  }

  function setText(node, value) {
    if (node) node.textContent = value === undefined || value === null || value === "" ? "-" : String(value);
  }

  function messageFor(status) {
    if (status === "success") return "伝わったよ！";
    if (status === "reject") return "もう一度言ってみよう。";
    if (status === "unknown") return "うまく判断できなかったよ。";
    if (status === "speech-failure") return "声をうまく聞き取れなかったよ。";
    if (status === "runtime-error") return "Playtest runtimeの世代が一致していません。";
    if (status === "continued") return "Playtestを続行します。";
    if (status === "cancelled") return "Playtestをキャンセルしました。";
    if (status === "running") return "聞いています…";
    return "Question Manager経由でAppleを注文してみよう。";
  }

  function retryable() {
    return state.lastResult && RETRYABLE.indexOf(state.lastResult.status) !== -1;
  }

  function render() {
    var result = state.lastResult || {};
    var judge = result.judge || {};
    setText(ui.message, messageFor(state.status));
    setText(ui.status, state.status);
    setText(ui.transcript, result.answer);
    setText(ui.alternatives, (result.alternatives || []).join(" | "));
    setText(ui.verdict, judge.verdict);
    setText(ui.source, judge.source);
    setText(ui.reason, judge.reason || result.error);
    setText(ui.attemptCount, state.status === "idle" ? 0 : state.retries + 1);
    setText(ui.maxRetries, MAX_RETRIES);
    setText(ui.resolution, state.resolution);
    if (ui.retry) ui.retry.disabled = state.status === "running" || !retryable() || state.retries >= MAX_RETRIES;
    if (ui.textButton) ui.textButton.disabled = state.status === "running" || !retryable();
    if (ui.continueButton) ui.continueButton.disabled = state.status === "running" || !state.lastResult;
  }

  async function runQuestion(inputMode, textValue) {
    var runtime = checkRuntime();
    if (!runtime.ok) return runtimeError(runtime.detail);
    installTextInjection();
    var currentRun = ++state.runId;
    var traceContext = {
      source: "dev-question-manager-playtest",
      flowRunId: currentRun,
      questionManagerRunId: null,
      presenterToken: null,
      attemptCount: state.retries + 1,
      speechRetries: state.retries
    };
    state.inputMode = inputMode;
    state.status = "running";
    state.resolution = null;
    queuedText = inputMode === "text" ? textValue : null;
    render();
    var result;
    try {
      result = await window.QuestionManager.start(QUESTION_ID, { __formalTraceContext: traceContext });
    } catch (error) {
      if (currentRun !== state.runId) return null;
      return runtimeError("question-manager-start", { error: error && error.message || String(error) });
    }
    if (currentRun !== state.runId) return null;
    if (!result || result.judgeMode !== "communicative") return runtimeError("non-communicative-result", result);
    state.lastResult = copy(result);
    state.status = result.status;
    state.resolution = result.resolution;
    render();
    return copy(result);
  }

  function start() {
    state.retries = 0;
    state.lastResult = null;
    state.resolution = null;
    return runQuestion("speech");
  }

  function retry() {
    if (!retryable() || state.retries >= MAX_RETRIES || state.status === "running") {
      return Promise.resolve(null);
    }
    state.retries += 1;
    return runQuestion("speech");
  }

  function judgeText(value) {
    if (!retryable() || state.status === "running") return Promise.resolve(null);
    var textValue = value === undefined && ui.textInput ? ui.textInput.value : value;
    textValue = String(textValue || "").trim();
    if (!textValue) return Promise.resolve(null);
    return runQuestion("text", textValue);
  }

  function skipContinue() {
    state.runId += 1;
    queuedText = null;
    if (window.QuestionManager && typeof window.QuestionManager.cancel === "function") window.QuestionManager.cancel();
    state.status = "continued";
    state.resolution = "continue";
    render();
    return getState();
  }

  function cancel() {
    state.runId += 1;
    queuedText = null;
    var cancelled = window.QuestionManager && typeof window.QuestionManager.cancel === "function"
      ? window.QuestionManager.cancel() : null;
    if (cancelled && cancelled.status === "cancelled") state.lastResult = copy(cancelled);
    state.status = "cancelled";
    state.resolution = "cancelled";
    render();
    return getState();
  }

  function line(label, key) {
    var row = element("div");
    row.style.cssText = "margin:3px 0;word-break:break-word";
    row.appendChild(element("strong", label + ": "));
    var value = element("span", "-");
    row.appendChild(value);
    ui[key] = value;
    return row;
  }

  function show() {
    var scene = document.getElementById("scene");
    if (!scene || document.getElementById("communicative-question-manager-playtest")) return;
    var panel = element("section");
    panel.id = "communicative-question-manager-playtest";
    panel.style.cssText = "position:absolute;z-index:10002;top:16px;left:16px;width:min(410px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:14px;background:rgba(24,18,48,.96);color:#fff;border:1px solid #ac91ff;border-radius:8px;font:14px/1.4 sans-serif";
    ui.panel = panel;
    var heading = element("h2", "Communicative Question Manager Playtest");
    heading.style.cssText = "font-size:18px;margin:0 0 8px";
    panel.appendChild(heading);
    ui.message = element("p", messageFor("idle"));
    ui.message.style.cssText = "margin:6px 0;padding:7px;background:#352963;border-radius:5px";
    panel.appendChild(ui.message);
    panel.appendChild(line("status", "status"));
    panel.appendChild(line("transcript", "transcript"));
    panel.appendChild(line("alternatives", "alternatives"));
    panel.appendChild(line("Judge verdict", "verdict"));
    panel.appendChild(line("Judge source", "source"));
    panel.appendChild(line("Judge reason", "reason"));
    panel.appendChild(line("attemptCount", "attemptCount"));
    panel.appendChild(line("maxRetries", "maxRetries"));
    panel.appendChild(line("resolution", "resolution"));
    var controls = element("div");
    controls.appendChild(button("開始", start));
    ui.retry = button("Retry（最大1回）", retry);
    controls.appendChild(ui.retry);
    ui.continueButton = button("Skip / Continue", skipContinue);
    controls.appendChild(ui.continueButton);
    controls.appendChild(button("Cancel", cancel));
    panel.appendChild(controls);
    var textRow = element("div");
    ui.textInput = element("input");
    ui.textInput.type = "text";
    ui.textInput.placeholder = "Text fallback";
    ui.textInput.style.cssText = "width:calc(100% - 105px);padding:7px;box-sizing:border-box";
    textRow.appendChild(ui.textInput);
    ui.textButton = button("Text判定", function () { return judgeText(); });
    textRow.appendChild(ui.textButton);
    panel.appendChild(textRow);
    scene.appendChild(panel);
    var runtime = checkRuntime();
    if (runtime.ok) installTextInjection();
    else runtimeError(runtime.detail);
    render();
  }

  function getState() {
    return {
      registered: state.registered,
      status: state.status,
      retries: state.retries,
      runId: state.runId,
      resolution: state.resolution,
      inputMode: state.inputMode,
      lastResult: copy(state.lastResult)
    };
  }

  window.CommunicativeQuestionManagerPlaytest = {
    show: show,
    start: start,
    retry: retry,
    judgeText: judgeText,
    skipContinue: skipContinue,
    cancel: cancel,
    getState: getState,
    questionId: QUESTION_ID,
    maxRetries: MAX_RETRIES
  };

  window.addEventListener("DOMContentLoaded", show);
})();
