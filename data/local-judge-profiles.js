(function () {
  "use strict";

  var profiles = {
    "order.request.local-v1": {
      profileId: "order.request.local-v1",
      action: "order.request",
      quantityValues: { one: 1, two: 2, three: 3, four: 4, "1": 1, "2": 2, "3": 3, "4": 4 }
    }
  };

  window.LocalJudgeProfileDatabase = {
    forAction: function (action) {
      var value = profiles["order.request.local-v1"];
      if (!value || value.action !== action) return null;
      return { profileId: value.profileId, action: value.action, quantityValues: Object.assign({}, value.quantityValues) };
    }
  };
})();
