(function () {
  "use strict";

  // Local rules include the Foundation sample and formally connected concepts.
  window.CommunicativeJudgeRuleData = [
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
})();
