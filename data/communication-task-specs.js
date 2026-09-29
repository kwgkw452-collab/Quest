(function () {
  "use strict";
  var tasks = {
    "dev.shop.order.apple.2": task("dev.shop.order.apple.2", "item.apple", 2),
    "dev.shop.order.orange.3": task("dev.shop.order.orange.3", "item.orange", 3),
    "dev.shop.order.banana.1": task("dev.shop.order.banana.1", "item.banana", 1),
    "dev.shop.order.banana.3": task("dev.shop.order.banana.3", "item.banana", 3)
  };
  function task(taskId, conceptId, quantity) {
    return { taskId: taskId, mode: "communication", situation: "shop", speakerRole: "customer", action: "order.request",
      requiredInformation: [{ slotId: "item", conceptId: conceptId }, { slotId: "quantity", value: quantity }] };
  }
  function copy(value) {
    if (!value) return null;
    return { taskId: value.taskId, mode: value.mode, situation: value.situation, speakerRole: value.speakerRole, action: value.action,
      requiredInformation: value.requiredInformation.map(function (entry) { return Object.assign({}, entry); }) };
  }
  function validate(value) {
    var errors = [];
    ["taskId", "mode", "situation", "speakerRole", "action"].forEach(function (field) {
      if (!value || typeof value[field] !== "string" || !value[field].trim()) errors.push(field + " is required");
    });
    if (!value || !Array.isArray(value.requiredInformation) || value.requiredInformation.length === 0) {
      errors.push("requiredInformation must be a non-empty array");
    } else value.requiredInformation.forEach(function (entry, index) {
      if (!entry || typeof entry.slotId !== "string" || !entry.slotId.trim()) errors.push("requiredInformation[" + index + "].slotId is required");
      var hasConcept = !!entry && Object.prototype.hasOwnProperty.call(entry, "conceptId");
      var hasValue = !!entry && Object.prototype.hasOwnProperty.call(entry, "value");
      if (hasConcept === hasValue) errors.push("requiredInformation[" + index + "] needs exactly one of conceptId or value");
      if (hasConcept && (typeof entry.conceptId !== "string" || !entry.conceptId.trim())) errors.push("requiredInformation[" + index + "].conceptId is invalid");
    });
    return errors;
  }
  window.CommunicationTaskSpecDatabase = {
    get: function (taskId) { return copy(tasks[taskId]); },
    all: function () { return Object.keys(tasks).map(function (taskId) { return copy(tasks[taskId]); }); },
    validate: validate
  };
})();
