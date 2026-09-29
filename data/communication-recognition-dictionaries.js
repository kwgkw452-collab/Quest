(function () {
  "use strict";
  function entry(type, id, match, candidate) {
    return { scope: { type: type, id: id }, match: match, candidate: candidate };
  }
  var entries = [
    entry("slot", "quantity", "one", { slotId: "quantity", value: 1 }),
    entry("slot", "quantity", "1", { slotId: "quantity", value: 1 }),
    entry("slot", "quantity", "two", { slotId: "quantity", value: 2 }),
    entry("slot", "quantity", "2", { slotId: "quantity", value: 2 }),
    entry("slot", "quantity", "three", { slotId: "quantity", value: 3 }),
    entry("slot", "quantity", "3", { slotId: "quantity", value: 3 }),
    entry("task", "dev.shop.order.orange.3", "free", { slotId: "quantity", value: 3 }),
    entry("task", "dev.shop.order.orange.3", "tree", { slotId: "quantity", value: 3 }),
    entry("task", "dev.shop.order.orange.3", "watt", { token: "want" })
  ];
  function copy(value) {
    return { scope: Object.assign({}, value.scope), match: value.match, candidate: Object.assign({}, value.candidate) };
  }
  function validate(source) {
    var errors = [];
    (Array.isArray(source) ? source : []).forEach(function (value, index) {
      var label = "dictionary[" + index + "]";
      if (!value || !value.scope || ["task", "concept", "slot"].indexOf(value.scope.type) === -1 ||
          typeof value.scope.id !== "string" || !value.scope.id) errors.push(label + " has invalid scope");
      if (!value || typeof value.match !== "string" || !value.match.trim()) errors.push(label + " has invalid match");
      var candidate = value && value.candidate;
      var concept = candidate && Object.prototype.hasOwnProperty.call(candidate, "conceptId");
      var token = candidate && Object.prototype.hasOwnProperty.call(candidate, "token");
      var slot = candidate && Object.prototype.hasOwnProperty.call(candidate, "slotId") && Object.prototype.hasOwnProperty.call(candidate, "value");
      if ([concept, token, slot].filter(Boolean).length !== 1) errors.push(label + " has invalid candidate");
    });
    if (!Array.isArray(source)) errors.push("dictionary must be an array");
    return errors;
  }
  window.CommunicationRecognitionDictionary = {
    all: function () { return entries.map(copy); },
    validate: validate
  };
})();
