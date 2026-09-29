(function () {
  "use strict";
  var verdicts = ["ACCEPT", "REJECT", "UNKNOWN"];
  var technicalReasons = ["unsupported_action", "unsupported_construction", "unknown_concept", "invalid_task_spec",
    "provider_disabled", "provider_timeout", "provider_error", "invalid_provider_output"];

  function unavailable(technicalReason) {
    return { technicalStatus: "JUDGE_UNAVAILABLE", verdict: null, reason: null, reasonSlotId: null,
      improvement: "none", technicalReason: technicalReasons.indexOf(technicalReason) === -1 ? "invalid_provider_output" : technicalReason };
  }

  function normalize(value) {
    if (!value || typeof value !== "object") return unavailable("invalid_provider_output");
    if (value.technicalStatus === "JUDGE_UNAVAILABLE") return unavailable(value.technicalReason);
    if (value.technicalStatus !== "AVAILABLE" || verdicts.indexOf(value.verdict) === -1 || typeof value.reason !== "string") {
      return unavailable("invalid_provider_output");
    }
    if (value.reasonSlotId !== null && typeof value.reasonSlotId !== "string") return unavailable("invalid_provider_output");
    return { technicalStatus: "AVAILABLE", verdict: value.verdict, reason: value.reason,
      reasonSlotId: value.reasonSlotId === undefined ? null : value.reasonSlotId, improvement: String(value.improvement || "none") };
  }

  window.CommunicationJudgeAdapter = { normalize: normalize, unavailable: unavailable };
})();
