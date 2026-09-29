(function () {
  "use strict";

  var POOL_ID = "shopping.fruit.order.v1";
  var SUPPORTED_CONCEPT = "shopping.fruit.apple.order";
  var MAX_RETRIES = 1;
  var initialized = false;
  var state = { draw: null, retries: 0, status: "idle", runId: 0 };
  var ui = {};

  function trace(eventName, detail) {
    if (!window.FormalSpeechTrace || typeof window.FormalSpeechTrace.record !== "function") return;
    window.FormalSpeechTrace.record(eventName, Object.assign({
      source: "dev-judge-pilot",
      runId: state.runId,
      attemptCount: state.retries + 1,
      speechRetries: state.retries,
      component: "dev-judge-pilot"
    }, detail || {}));
  }

  function loadScript(path) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = path;
      script.onload = resolve;
      script.onerror = function () { reject(new Error("judge-pilot-load-failed: " + path)); };
      document.head.appendChild(script);
    });
  }

  async function loadPilotDependencies() {
    var paths = [
      "data/lottery-pools.js",
      "data/communicative-judge-rules.js?v=s005-registry-instance-fix-v1",
      "engine/services/lottery-engine.js",
      "engine/services/local-communicative-judge.js",
      "engine/services/communicative-judge.js",
      "engine/services/communicative-question-adapter.js"
    ];
    for (var i = 0; i < paths.length; i += 1) await loadScript(paths[i]);
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
    if (node) node.textContent = value === undefined || value === null ? "-" : String(value);
  }

  function messageFor(status) {
    if (status === "accept") return "伝わったよ！";
    if (status === "reject") return "もう一度言ってみよう。";
    if (status === "unknown") return "うまく判断できなかったよ。";
    if (status === "speech-failure") return "声をうまく聞き取れなかったよ。";
    if (status === "skipped") return "この回答はSkipしました。続けられます。";
    return "Appleを英語で注文してみよう。";
  }

  function renderResult(result) {
    state.status = result.status;
    setText(ui.message, messageFor(result.status));
    setText(ui.status, result.status);
    setText(ui.transcript, result.transcript || "-");
    setText(ui.alternatives, (result.alternatives || []).join(" | ") || "-");
    setText(ui.verdict, result.judge ? result.judge.verdict : "-");
    setText(ui.source, result.judge ? result.judge.source : "-");
    setText(ui.reason, result.judge ? result.judge.reason : result.speechError || "-");
    setText(ui.attempt, String(state.retries + 1) + " / " + String(MAX_RETRIES + 1));
    ui.retry.disabled = ["reject", "unknown", "speech-failure"].indexOf(result.status) === -1 || state.retries >= MAX_RETRIES;
    ui.continueButton.disabled = false;
  }

  function initializeLottery() {
    if (initialized) return;
    LotteryEngine.init(LotteryPoolData);
    initialized = true;
  }

  function drawApple() {
    initializeLottery();
    var pool = LotteryEngine.getPool(POOL_ID);
    var candidateCount = 0;
    (pool && pool.items || []).forEach(function (item) {
      candidateCount += Array.isArray(item.prompts) ? item.prompts.length : 0;
    });
    var selected = null;
    for (var index = 0; index < candidateCount; index += 1) {
      var candidateIndex = index;
      var candidate = LotteryEngine.draw(POOL_ID, {
        randomFn: function () { return (candidateIndex + 0.5) / candidateCount; }
      });
      if (candidate.status === "selected" && candidate.conceptId === SUPPORTED_CONCEPT) {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error("judge-pilot-supported-concept-unavailable");
    state.draw = selected;
    state.retries = 0;
    state.status = "ready";
    setText(ui.display, selected.displayValue);
    setText(ui.concept, selected.conceptId);
    setText(ui.difficulty, selected.difficulty);
    setText(ui.promptType, selected.promptType);
    setText(ui.expected, selected.expectedUtterance);
    renderResult({ status: "ready", transcript: "", alternatives: [], judge: null });
  }

  async function judgeSpeech(transcript, alternatives, token) {
    if (token !== state.runId) return;
    trace("judge-start", { transcript: transcript, candidateCount: (alternatives || []).length });
    var result = await CommunicativeQuestionAdapter.evaluate(state.draw, {
      status: "recognized",
      transcript: transcript,
      alternatives: alternatives || []
    }, token);
    if (token !== state.runId) return;
    trace("judge-result", {
      transcript: result.transcript,
      candidateCount: (result.alternatives || []).length,
      verdict: result.judge && result.judge.verdict,
      status: result.status
    });
    renderResult(result);
  }

  async function listen() {
    if (!state.draw) drawApple();
    var token = CommunicativeQuestionAdapter.begin();
    state.runId = token;
    state.status = "listening";
    setText(ui.status, "listening");
    setText(ui.message, "聞いています…");
    var alternatives = [];
    try {
      trace("prepare-start");
      await SpeechStartController.prepare();
      trace("prepare-complete");
      trace("startListening-call");
      var transcript = await SpeechStartController.startListening({
        lang: "en-US",
        timeoutMs: 8000,
        maxAlternatives: 5,
        onStart: function () { trace("listening-start"); },
        onInterim: function (value) { trace("interim", { transcript: String(value || "") }); },
        onAlternatives: function (values) {
          alternatives = Array.isArray(values) ? values.slice() : [];
          trace("alternatives", { candidateCount: alternatives.length });
        }
      }, {});
      trace("final", { transcript: transcript, candidateCount: alternatives.length });
      await judgeSpeech(transcript, alternatives, token);
    } catch (error) {
      if (token !== state.runId) return;
      var message = error && error.message ? error.message : String(error || "speech-error");
      var eventName = ["no-speech", "speech-timeout", "not-allowed", "speech-not-supported"].indexOf(message) !== -1 ?
        message : "recognition-error";
      trace(eventName, { errorCode: message, candidateCount: alternatives.length });
      var failure = CommunicativeQuestionAdapter.speechFailure(state.draw, error);
      trace("speech-failure-result", { errorCode: failure.speechError, status: failure.status });
      renderResult(failure);
    }
  }

  async function judgeText() {
    if (!state.draw) drawApple();
    var value = String(ui.textInput.value || "").trim();
    if (!value) return;
    var token = CommunicativeQuestionAdapter.begin();
    state.runId = token;
    await judgeSpeech(value, [], token);
  }

  function retry() {
    if (state.retries >= MAX_RETRIES) return;
    state.retries += 1;
    trace("retry-selected");
    setText(ui.attempt, String(state.retries + 1) + " / " + String(MAX_RETRIES + 1));
    listen();
  }

  function skip() {
    CommunicativeQuestionAdapter.cancel();
    SpeechStartController.cancel();
    state.runId += 1;
    renderResult({ status: "skipped", transcript: "", alternatives: [], judge: null });
  }

  function cancel() {
    trace("cancel");
    CommunicativeQuestionAdapter.cancel();
    SpeechStartController.cancel();
    state.runId += 1;
    state.status = "cancelled";
    ui.panel.hidden = true;
  }

  function line(label, key) {
    var row = element("div");
    row.style.cssText = "margin:3px 0;word-break:break-word";
    var strong = element("strong", label + ": ");
    var value = element("span", "-");
    row.appendChild(strong);
    row.appendChild(value);
    ui[key] = value;
    return row;
  }

  function show() {
    var scene = document.getElementById("scene");
    if (!scene || document.getElementById("communicative-judge-pilot")) return;
    var panel = element("section");
    panel.id = "communicative-judge-pilot";
    panel.style.cssText = "position:absolute;z-index:10001;top:16px;right:16px;width:min(390px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:14px;background:rgba(8,24,35,.96);color:#fff;border:1px solid #6bc5dc;border-radius:8px;font:14px/1.4 sans-serif";
    ui.panel = panel;
    var heading = element("h2", "Communicative Judge Pilot");
    heading.style.cssText = "font-size:18px;margin:0 0 8px";
    panel.appendChild(heading);
    ui.message = element("p", messageFor("ready"));
    ui.message.style.cssText = "margin:6px 0;padding:7px;background:#17384a;border-radius:5px";
    panel.appendChild(ui.message);
    panel.appendChild(line("Lottery", "display"));
    panel.appendChild(line("conceptId", "concept"));
    panel.appendChild(line("difficulty", "difficulty"));
    panel.appendChild(line("promptType", "promptType"));
    panel.appendChild(line("expected", "expected"));
    panel.appendChild(line("Pilot status", "status"));
    panel.appendChild(line("attempt", "attempt"));
    panel.appendChild(line("transcript", "transcript"));
    panel.appendChild(line("alternatives", "alternatives"));
    panel.appendChild(line("verdict", "verdict"));
    panel.appendChild(line("source", "source"));
    panel.appendChild(line("reason", "reason"));
    var controls = element("div");
    controls.appendChild(button("Judge Pilot開始", drawApple));
    controls.appendChild(button("話す", listen));
    ui.retry = button("1回だけRetry", retry);
    controls.appendChild(ui.retry);
    ui.continueButton = button("Skip／続行", skip);
    controls.appendChild(ui.continueButton);
    controls.appendChild(button("閉じる", cancel));
    panel.appendChild(controls);
    var textRow = element("div");
    ui.textInput = element("input");
    ui.textInput.type = "text";
    ui.textInput.placeholder = "Text fallback";
    ui.textInput.style.cssText = "width:calc(100% - 95px);padding:7px;box-sizing:border-box";
    textRow.appendChild(ui.textInput);
    textRow.appendChild(button("判定", judgeText));
    panel.appendChild(textRow);
    scene.appendChild(panel);
    drawApple();
  }

  window.CommunicativeJudgePilot = {
    show: show,
    cancel: cancel,
    getState: function () { return Object.assign({}, state); },
    maxRetries: MAX_RETRIES
  };
  window.addEventListener("DOMContentLoaded", function () {
    loadPilotDependencies().then(show).catch(function (error) {
      console.error(error);
    });
  });
})();
