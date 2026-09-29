(function () {
  "use strict";

  var runId = 0;
  var cancelPending = null;
  var japaneseGoal = null;

  function withGoal(message) {
    return japaneseGoal ? japaneseGoal + "\n\n" + message : message;
  }

  function trace(eventName, context, detail) {
    if (!window.FormalSpeechTrace || typeof window.FormalSpeechTrace.record !== "function") return;
    window.FormalSpeechTrace.record(eventName, Object.assign({
      source: context && context.source || "formal-story",
      runId: context && context.flowRunId,
      questionManagerRunId: context && context.questionManagerRunId,
      presenterToken: context && context.presenterToken,
      attemptCount: context && context.attemptCount,
      speechRetries: context && context.speechRetries,
      component: "presenter"
    }, detail || {}));
  }

  function begin() {
    cancel();
    return runId;
  }

  function active(token) {
    return token === runId;
  }

  function waitFor(value, token) {
    var cancelled = new Promise(function (resolve) {
      cancelPending = function () { resolve("cancelled"); };
    });
    return Promise.race([value, cancelled]).then(function (result) {
      if (active(token)) cancelPending = null;
      return active(token) ? result : "cancelled";
    });
  }

  function supportMessage(status) {
    if (status === "reject") return "もう一度、ゆっくり尋ねてみよう。";
    if (status === "unknown") return "英語が間違いとは限らないよ。\nうまく判断できなかったピコ。";
    if (status === "speech-failure") return "声をうまく聞き取れなかったピコ。";
    return "うまく判断できなかったピコ。";
  }

  function listening(value, token) {
    if (!active(token)) return;
    var text = String(value || "").trim();
    if (!text) {
      DialogManager.show("ピコ", withGoal(japaneseGoal ? "🎤 聞き取り中…" : "聞き取り中…"));
      return;
    }
    DialogManager.showRecognized(text, "聞き取り中：");
  }

  function speech(startListening, token, traceContext, japanesePrompt) {
    if (!active(token)) return Promise.resolve("cancelled");
    japaneseGoal = japanesePrompt || null;
    trace("speech-gate-create", traceContext);
    DialogManager.show("ピコ", japanesePrompt || "準備できたよ。話してみよう。");
    trace("speech-gate-shown", traceContext);
    var pending = new Promise(function (resolve, reject) {
      var controls = document.getElementById("controls");
      if (!controls || typeof DialogManager.button !== "function") {
        reject(new Error("formal-speech-controls-unavailable"));
        return;
      }
      var started = false;
      controls.appendChild(DialogManager.button("話す", function () {
        if (started || !active(token)) return;
        started = true;
        trace("speech-gate-click", traceContext);
        listening("", token);
        try {
          Promise.resolve(startListening()).then(resolve, reject);
        } catch (error) {
          reject(error);
        }
      }));
    });
    return waitFor(pending, token);
  }

  function recovery(result, options, token, traceContext) {
    if (!active(token)) return Promise.resolve("cancelled");
    trace("recovery-show", traceContext, {
      status: result && result.status,
      errorCode: result && result.error,
      transcript: result && result.answer,
      candidateCount: result && Array.isArray(result.alternatives) ? result.alternatives.length : 0
    });
    DialogManager.show("ピコ", withGoal(options && options.supportText || supportMessage(result && result.status)));
    if (result && result.answer) DialogManager.showRecognized(result.answer, "You said:\n");
    var choices = [];
    if (options && options.retry) choices.push({ label: "もう一度話す", value: "retry" });
    if (options && options.support) choices.push({ label: "ピコの次のヒント", value: "support" });
    if (options && options.text) choices.push({ label: "文字で答える", value: "text" });
    choices.push({ label: "冒険を続ける", value: "continue" });
    return waitFor(DialogManager.choice(choices), token);
  }

  function textInput(token) {
    if (!active(token)) return Promise.resolve("cancelled");
    return waitFor(DialogManager.textInput("マイクを使わず、英語を文字で入力してね。"), token);
  }

  async function continued(token) {
    if (!active(token)) return "cancelled";
    DialogManager.show("ピコ", withGoal("大丈夫。冒険を続けよう。"));
    return waitFor(DialogManager.next("次へ"), token);
  }

  function cancel() {
    runId += 1;
    japaneseGoal = null;
    if (cancelPending) cancelPending();
    cancelPending = null;
    try { DialogManager.hideRecognized(); } catch (_) { /* UI may not be initialized. */ }
    return runId;
  }

  window.CommunicativeQuestionPresenter = {
    begin: begin,
    speech: speech,
    listening: listening,
    recovery: recovery,
    textInput: textInput,
    continued: continued,
    cancel: cancel
  };
})();
