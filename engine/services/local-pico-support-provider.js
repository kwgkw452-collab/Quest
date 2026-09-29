(function () {
  "use strict";

  var quantityWords = { 1: "one", 2: "two", 3: "three" };
  function required(taskSpec, slotId) {
    return (taskSpec.requiredInformation || []).filter(function (entry) { return entry.slotId === slotId; })[0] || {};
  }
  function form(concept, number) {
    var value = (concept.forms || []).filter(function (entry) { return entry.number === number; })[0];
    return value ? value.text : "";
  }
  function fill(text, taskSpec, concept) {
    var quantity = required(taskSpec, "quantity").value;
    return String(text).replace(/\{quantity\}/g, quantity).replace(/\{quantityWord\}/g, quantityWords[quantity] || String(quantity))
      .replace(/\{itemJa\}/g, concept.displayJapanese).replace(/\{itemPlural\}/g, form(concept, "plural"));
  }
  function support(taskSpec, focus, level, status) {
    var profile = PicoSupportProfileDatabase.get(taskSpec.action);
    var concept = CommunicationConceptCatalog.get(required(taskSpec, "item").conceptId);
    if (!profile || !concept) return "もう一度、注文に必要なことを考えてみようピコ！";
    if (status === "SPEECH_FAILURE") return profile.speechFailure;
    if (status === "JUDGE_UNAVAILABLE") return profile.unavailable;
    if (status === "UNKNOWN" && focus && focus.kind === "quantity") return profile.missingQuantity;
    var values = profile.levels[focus && focus.kind] || profile.levels.task;
    return fill(values[Math.max(0, Math.min(2, Number(level || 1) - 1))], taskSpec, concept);
  }
  function finalRescue(taskSpec) {
    var profile = PicoSupportProfileDatabase.get(taskSpec.action);
    return profile ? profile.finalRescue : "今回はここまでにしようピコ！";
  }
  window.LocalPicoSupportProvider = { support: support, finalRescue: finalRescue };
})();
