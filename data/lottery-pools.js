(function () {
  "use strict";

  // Foundation検証用Sample。実Storyからは参照しない。
  window.LotteryPoolData = [
    {
      poolId: "shopping.fruit.order.v1",
      metadata: { category: "shopping", sample: true },
      items: [
        {
          itemId: "apple",
          conceptId: "shopping.fruit.apple.order",
          displayValue: "🍎",
          metadata: { fruit: "apple" },
          prompts: [
            {
              promptType: "order",
              difficulty: "starter",
              expectedUtterance: "Apple, please.",
              acceptedVariants: ["apple please"],
              metadata: { pattern: "noun-please" }
            },
            {
              promptType: "order",
              difficulty: "basic",
              expectedUtterance: "Can I have an apple?",
              acceptedVariants: ["can i have an apple", "can i get an apple"],
              metadata: { pattern: "can-i-have" }
            }
          ]
        },
        {
          itemId: "banana",
          conceptId: "shopping.fruit.banana.order",
          displayValue: "🍌",
          metadata: { fruit: "banana" },
          prompts: [
            {
              promptType: "order",
              difficulty: "starter",
              expectedUtterance: "Banana, please.",
              acceptedVariants: ["banana please"],
              metadata: { pattern: "noun-please" }
            },
            {
              promptType: "order",
              difficulty: "basic",
              expectedUtterance: "Can I have a banana?",
              acceptedVariants: ["can i have a banana", "can i get a banana"],
              metadata: { pattern: "can-i-have" }
            }
          ]
        }
      ]
    }
  ];
})();
