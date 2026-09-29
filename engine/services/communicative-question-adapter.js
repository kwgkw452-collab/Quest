(function () {
  "use strict";

  var MAX_ALTERNATIVES = 5;
  var runId = 0;

  function copyArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function copyAlternatives(value) {
    return copyArray(value).slice(0, MAX_ALTERNATIVES);
  }

  function begin() {
    runId += 1;
    return runId;
  }

  function cancel() {
    runId += 1;
    return runId;
  }

  function buildJudgeInput(lotteryResult, speechResult) {
    lotteryResult = lotteryResult || {};
    speechResult = speechResult || {};
    return {
      conceptId: lotteryResult.conceptId,
      utterance: speechResult.transcript,
      alternatives: copyAlternatives(speechResult.alternatives),
      expectedUtterance: lotteryResult.expectedUtterance,
      acceptedVariants: copyArray(lotteryResult.acceptedVariants),
      difficulty: lotteryResult.difficulty,
      context: {
        promptType: lotteryResult.promptType,
        poolId: lotteryResult.poolId,
        itemId: lotteryResult.itemId
      }
    };
  }

  function baseResult(status, lotteryResult, speechResult) {
    return {
      status: status,
      conceptId: lotteryResult && lotteryResult.conceptId || null,
      transcript: speechResult && speechResult.transcript || "",
      alternatives: copyAlternatives(speechResult && speechResult.alternatives),
      speechError: null,
      judge: null
    };
  }

  function speechFailure(lotteryResult, error) {
    var value = baseResult("speech-failure", lotteryResult, null);
    value.speechError = error && error.message ? error.message : String(error || "speech-error");
    return value;
  }

  async function evaluate(lotteryResult, speechResult, token) {
    var activeToken = token === undefined ? runId : token;
    if (activeToken !== runId) return baseResult("cancelled", lotteryResult, speechResult);
    if (!speechResult || speechResult.status === "failure" || !String(speechResult.transcript || "").trim()) {
      return speechFailure(lotteryResult, speechResult && speechResult.error);
    }
    var judgeResult = await CommunicativeJudge.judge(buildJudgeInput(lotteryResult, speechResult));
    if (activeToken !== runId) return baseResult("cancelled", lotteryResult, speechResult);
    var statuses = { ACCEPT: "accept", REJECT: "reject", UNKNOWN: "unknown" };
    var value = baseResult(statuses[judgeResult.verdict] || "unknown", lotteryResult, speechResult);
    value.judge = judgeResult;
    return value;
  }

  window.CommunicativeQuestionAdapter = {
    begin: begin,
    cancel: cancel,
    buildJudgeInput: buildJudgeInput,
    evaluate: evaluate,
    speechFailure: speechFailure
  };
})();
