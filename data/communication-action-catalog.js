(function () {
  "use strict";
  var actions = {
    "order.request": { action: "order.request", situation: "shop", requiredSlotIds: ["item", "quantity"],
      positiveCues: ["i want", "i'd like", "can i have", "can i get", "could i have", "please"],
      oppositeCues: ["i don't want", "i do not want"],
      differentActionCues: ["did you say", "do you mean", "so you want"] }
  };
  function get(action) {
    var value = actions[action];
    if (!value) return null;
    return { action: value.action, situation: value.situation, requiredSlotIds: value.requiredSlotIds.slice(),
      positiveCues: value.positiveCues.slice(), oppositeCues: value.oppositeCues.slice(), differentActionCues: value.differentActionCues.slice() };
  }
  window.CommunicationActionCatalog = { get: get };
})();
