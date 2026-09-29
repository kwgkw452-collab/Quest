(function () {
  "use strict";
  function resolve(taskSpec, transcript, judgeResult) {
    if (!judgeResult || judgeResult.technicalStatus !== "AVAILABLE") return { kind: "task", slotId: null };
    if (judgeResult.reason === "missing_required_information" && judgeResult.reasonSlotId === "item") return { kind: "item", slotId: "item" };
    if (judgeResult.reason === "wrong_quantity" || judgeResult.reason === "missing_required_information") return { kind: "quantity", slotId: "quantity" };
    if (judgeResult.reason === "wrong_item") return { kind: "item", slotId: "item" };
    if (judgeResult.reason === "unknown_expression") return { kind: "structure", slotId: null };
    return { kind: "task", slotId: null };
  }
  window.SupportFocusResolver = { resolve: resolve };
})();
