(function () {
  "use strict";

  // Local rules include the Foundation sample and formally connected concepts.
  // This file is also loaded by the dev pilot. Preserve the canonical array so
  // later dependency loads cannot discard rules registered by a story asset.
  var canonicalRegistry = Array.isArray(window.CommunicativeJudgeRuleData) ?
    window.CommunicativeJudgeRuleData : [];
  window.CommunicativeJudgeRuleData = canonicalRegistry;
  var foundationRules = [
    {
      conceptId: "shopping.fruit.apple.order",
      variants: [
        "Apple, please.",
        "An apple, please.",
        "Can I have an apple?",
        "Can I get an apple?",
        "Could I get an apple?",
        "I'd like an apple, please."
      ],
      rejects: [
        { variants: ["I don't want an apple."], reason: "explicit-negative" }
      ],
      difficulty: ["starter", "basic"],
      promptType: "order",
      metadata: { sample: true, lotteryPoolId: "shopping.fruit.order.v1" }
    },
    {
      conceptId: "social.wellbeing.ask",
      variants: [
        "Are you OK?",
        "Are you okay?",
        "Are you all right?",
        "Are you alright?",
        "Is everything okay?"
      ],
      rejects: [
        { variants: ["I don't care."], reason: "explicit-refusal" }
      ],
      difficulty: "starter",
      promptType: "question",
      metadata: { formal: true }
    }
  ];
  foundationRules.forEach(function (candidate) {
    var exists = canonicalRegistry.some(function (registered) {
      return registered && registered.conceptId === candidate.conceptId;
    });
    if (!exists) canonicalRegistry.push(candidate);
  });
})();
