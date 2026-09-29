(function () {
  "use strict";

  var runToken = 0;
  var state = null;
  function trace(name, detail) {
    if (window.CommunicationTaskV1Trace && typeof CommunicationTaskV1Trace.record === "function") {
      CommunicationTaskV1Trace.record(name, detail || null);
    }
  }
  function snapshot() { return state ? Object.assign({}, state, { judgeResult: state.judgeResult && Object.assign({}, state.judgeResult) }) : null; }
  function newState(taskId) { return { taskId: taskId, status: "ready", transcript: "", judgeResult: null, support: "", supportLevel: 0,
    semanticAttemptCount: 0, speechFailureCount: 0, resolution: null }; }

  async function perform(token, options) {
    var task = CommunicationTaskSpecDatabase.get(state.taskId);
    if (!task) { state.status = "JUDGE_UNAVAILABLE"; state.resolution = "final_rescue"; return snapshot(); }
    var transcript;
    trace("phase1-speech-request");
    try {
      if (options && Object.prototype.hasOwnProperty.call(options, "transcript")) transcript = String(options.transcript || "");
      else {
        trace("prepare-start");
        if (window.SpeechStartController && typeof SpeechStartController.prepare === "function") await SpeechStartController.prepare();
        trace("prepare-complete");
        trace("startListening-call");
        var speechPromise = SpeechStartController.startListening({ lang: "en-US", timeoutMs: 8000 }, {});
        trace("speech-promise-pending");
        transcript = await speechPromise;
        trace("speech-resolved");
        trace("speech-result-transcript", { transcript: String(transcript || "") });
      }
    } catch (error) {
      trace("speech-rejected");
      trace("speech-error-name", { name: error && error.name ? error.name : "Error", message: error && error.message ? error.message : String(error || "") });
      if (token !== runToken) return snapshot();
      state.speechFailureCount += 1; state.status = "SPEECH_FAILURE"; state.judgeResult = null;
      state.support = LocalPicoSupportProvider.support(task, { kind: "task", slotId: null }, 1, "SPEECH_FAILURE");
      return snapshot();
    }
    if (token !== runToken) return snapshot();
    state.transcript = transcript;
    trace("judge-start");
    var judged = await CommunicationJudgeGateway.judge(task, transcript);
    trace("judge-complete");
    if (token !== runToken) return snapshot();
    state.judgeResult = judged;
    if (judged.technicalStatus === "JUDGE_UNAVAILABLE") {
      state.status = "JUDGE_UNAVAILABLE"; state.semanticAttemptCount += 1;
    } else if (judged.verdict === "ACCEPT") {
      state.status = "ACCEPT"; state.resolution = "accepted"; state.support = ""; return snapshot();
    } else {
      state.status = judged.verdict; state.semanticAttemptCount += 1;
    }
    state.supportLevel = Math.min(3, state.semanticAttemptCount);
    var focus = SupportFocusResolver.resolve(task, transcript, judged);
    state.support = LocalPicoSupportProvider.support(task, focus, state.supportLevel, state.status);
    if (state.semanticAttemptCount >= 3) {
      state.status = "FINAL_RESCUE"; state.resolution = "adventure_return";
      state.support = LocalPicoSupportProvider.finalRescue(task);
    }
    return snapshot();
  }

  function start(taskId, options) { runToken += 1; state = newState(taskId); return perform(runToken, options || {}); }
  function retry(options) {
    if (!state || state.resolution) return Promise.resolve(snapshot());
    runToken += 1; return perform(runToken, options || {});
  }
  function cancel() {
    runToken += 1;
    if (window.SpeechStartController && typeof SpeechStartController.cancel === "function") SpeechStartController.cancel();
    if (state) { state.status = "CANCELLED"; state.resolution = "cancelled"; }
    return snapshot();
  }
  window.CommunicationTaskProgressController = { start: start, retry: retry, cancel: cancel, getResult: snapshot };
})();
