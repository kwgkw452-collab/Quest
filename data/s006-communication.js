(function () {
  "use strict";
  // S006 definitions only. Existing Question / Lottery / Local Judge contracts.
  var defs = [
  {
    "id": "s006.communication.1",
    "category": "word",
    "prompt": "お手伝いしましょうか？",
    "answers": [
      "Can we help you?",
      "Can I help you?",
      "Shall I help you?",
      "Shall we help you?",
      "Could I help you?",
      "Could we help you?",
      "May I help you?",
      "May we help you?",
      "Do you need help?",
      "Let me help you.",
      "Let us help you.",
      "Would you like some help?",
      "Can I give you a hand?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "駅員さんに、お手伝いを申し出るピコ。",
      "『手伝う』は help。Can I ...? などを使うピコ。",
      "Can we help you? と言うピコ。"
    ],
    "communicative": {
      "conceptId": "s006.mystery.1",
      "difficulty": "starter",
      "promptType": "offer",
      "expectedUtterance": "Can we help you?",
      "poolId": "s006.communication.1.v1"
    }
  },
  {
    "id": "s006.communication.2",
    "category": "word",
    "prompt": "その箱は何色ですか？",
    "answers": [
      "What color is the box?",
      "What color is it?",
      "What color is that box?",
      "What color is your box?",
      "What is the color of the box?",
      "What colour is your box?",
      "What does it look like?",
      "What does your box look like?",
      "Can you describe your box?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "箱の色を聞いてみるピコ。",
      "『何色』は What color、『箱』は box だピコ。",
      "What color is the box? と聞くピコ。"
    ],
    "communicative": {
      "conceptId": "s006.mystery.2",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "What color is the box?",
      "poolId": "s006.communication.2.v1"
    }
  },
  {
    "id": "s006.communication.3",
    "category": "word",
    "prompt": "ほかの箱はどこにありますか？",
    "answers": [
      "Where are the other boxes?",
      "Where is the other box?",
      "Where is another box?",
      "Where are the boxes?",
      "Where can I find another box?",
      "Where can we find the other boxes?",
      "Where is box?",
      "Where are the other box?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "場所を尋ねるピコ。",
      "“Where” と “boxes” を使ってみるピコ。",
      "Where are the other boxes?"
    ],
    "communicative": {
      "conceptId": "s006.mystery.3",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Where are the other boxes?",
      "poolId": "s006.communication.3.v1"
    }
  },
  {
    "id": "s006.communication.4",
    "category": "word",
    "prompt": "その箱を見せてもらえますか？",
    "answers": [
      "Can we see that box?",
      "Can I see the box?",
      "Can we see the box?",
      "Can I see that box?",
      "May I see the box?",
      "Could you show me the box?",
      "Please show me the box.",
      "Can I look at the box?",
      "Can we check the box?",
      "Could we have a look at that box?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "箱を見せてもらうようお願いするピコ。",
      "“Can we see” と “box” を使うピコ。",
      "Can we see that box?"
    ],
    "communicative": {
      "conceptId": "s006.mystery.4",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Can we see that box?",
      "poolId": "s006.communication.4.v1"
    }
  },
  {
    "id": "s006.communication.5",
    "category": "word",
    "prompt": "その箱を持っていますか？",
    "answers": [
      "Do you have the box?",
      "Do you have that box?",
      "Do you have my box?",
      "Have you got the box?",
      "Have you got that box?",
      "Is the box here?",
      "Is that box here?",
      "Do you have a box?",
      "Have you got my boxes?",
      "You have the box?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "荷物係さんが、その箱を持っているか聞くピコ。",
      "『持っていますか？』は Do you have ...? を使うピコ。",
      "Do you have the box? と聞くピコ。"
    ],
    "communicative": {
      "conceptId": "s006.mystery.5",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you have the box?",
      "poolId": "s006.communication.5.v1"
    }
  },
  {
    "id": "s006.communication.6",
    "category": "word",
    "prompt": "このリボンを見てください。",
    "answers": [
      "Please look at this ribbon.",
      "Look at this ribbon.",
      "Look at the ribbon.",
      "Look at ribbon.",
      "Look at this red ribbon.",
      "Can you look at the ribbon?",
      "Please look at the red ribbon.",
      "Look at my ribbon, please.",
      "Could you look at these ribbons?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "赤い切れ端に注目してもらうピコ。",
      "“Look at” と “ribbon” を使うピコ。",
      "Please look at this ribbon."
    ],
    "communicative": {
      "conceptId": "s006.mystery.6",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Please look at this ribbon.",
      "poolId": "s006.communication.6.v1"
    }
  },
  {
    "id": "s006.communication.7",
    "category": "word",
    "prompt": "その台車（カート）に箱はありますか？",
    "answers": [
      "Is the box on the cart?",
      "The box on the cart?",
      "Box on the cart?",
      "My box on the cart?",
      "Is my box on the cart?",
      "Is the box in the cart?",
      "Is there a box on the cart?",
      "Is there my box on the cart?",
      "Are there boxes on the cart?",
      "Are there any boxes on the cart?",
      "There is a box on the cart?",
      "Do you have the box on the cart?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "Is the box ...? で始めるピコ！",
      "台車は cart、上にあるなら on だピコ！",
      "Is the box on the cart? と聞くピコ！"
    ],
    "communicative": {
      "conceptId": "s006.mystery.7",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Is the box on the cart?",
      "poolId": "s006.communication.7.v1"
    }
  },

  {
    "id": "s006.communication.8",
    "category": "word",
    "prompt": "ちょっと待ってください！",
    "answers": [
      "Please wait!",
      "Wait!",
      "Wait, please!",
      "Can you wait?",
      "Could you wait?",
      "Just a moment.",
      "Just a minute.",
      "Just one moment.",
      "One moment, please.",
      "One minute, please.",
      "A moment, please.",
      "A minute, please.",
      "Hold on!",
      "Hang on!",
      "Wait a second!",
      "Just a second!",
      "Give me a second.",
      "Please don't go yet!",
      "Stop the bus, please!",
      "Please wait for us.",
      "WAIT!!!"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "運転手さんに、ちょっと待ってもらうピコ！",
      "『待つ』は wait。一言でもいいピコ！",
      "Please wait! と言うピコ！"
    ],
    "communicative": {
      "conceptId": "s006.mystery.8",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Please wait!",
      "poolId": "s006.communication.8.v1"
    }
  },
  {
    "id": "s006.communication.9",
    "category": "word",
    "prompt": "私の箱を見つけてもらえますか？",
    "answers": [
      "Can you find my box?",
      "Can you find the box?",
      "Could you find my box?",
      "Will you find my box?",
      "Please find my box.",
      "Can you help me find my box?",
      "Can you look for my box?",
      "Please look for my box.",
      "Would you help us find our box?"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "運転手さんに、箱を見つけてもらうようお願いするピコ。",
      "『見つける』は find。Can you ...? を使うピコ。",
      "Can you find my box? とお願いするピコ。"
    ],
    "communicative": {
      "conceptId": "s006.mystery.9",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Can you find my box?",
      "poolId": "s006.communication.9.v1"
    }
  },
  {
    "id": "s006.communication.10",
    "category": "word",
    "prompt": "私は箱を見つけました！",
    "answers": [
      "I found the box!",
      "We found the box!",
      "I found your box!",
      "We found your box!",
      "I find the box!",
      "We find the box!",
      "Here is your box!",
      "This is your box!",
      "I got the box!",
      "We got the box!",
      "I have the box!",
      "We have the box!",
      "I have your box!",
      "We have your box!",
      "I get the box!",
      "We get the box!",
      "I get your box!",
      "We get your box!",
      "We've found your box!",
      "I've got the box!",
      "Here are your boxes!"
    ],
    "success": "",
    "failure": "",
    "picoSupport": [
      "やっと箱が見つかったピコ！ そのことを伝えるピコ。",
      "『見つけた』は found。find の過去形だピコ。",
      "I found the box! と言うピコ。"
    ],
    "communicative": {
      "conceptId": "s006.mystery.10",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "I found the box!",
      "poolId": "s006.communication.10.v1"
    }
  }
];

  function norm(value) {
    return String(value || "").toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\b(can't|cant)\b/g, "cannot")
      .replace(/\b(don't|dont)\b/g, "do not")
      .replace(/\b(doesn't|doesnt)\b/g, "does not")
      .replace(/\b(didn't|didnt)\b/g, "did not")
      .replace(/\b(won't|wont)\b/g, "will not")
      .replace(/\b(we've|weve)\b/g, "we have")
      .replace(/\b(i've|ive)\b/g, "i have")
      .replace(/\b(where's|wheres)\b/g, "where is")
      .replace(/\b(it's|its)\b/g, "it is")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  var box = "(?:(?:the|that|this|your|my|our|a|another|other|those|these) )*box(?:es)?";
  var target = "(?:" + box + "|it)";
  var cart = "(?:(?:the|that|this|a) )*(?:cart|trolley)";
  var ribbon = "(?:(?:the|that|this|these|those|your|my|a|red) )*ribbons?";
  function matches(t, pattern) { return new RegExp("^(?:" + pattern + ")$").test(t); }
  function polite(t) { return t.replace(/\bplease\b/g, " ").replace(/\s+/g, " ").trim(); }
  // All patterns match a complete utterance and require both intent and object.
  // Negated / contradictory tails cannot inherit ACCEPT from a positive prefix.
  var accept = [
    function (t) { return matches(polite(t), "(?:can|could|may|shall|should) (?:i|we) help(?: you)?|let (?:me|us) help(?: you)?|(?:do you )?need (?:some )?help|would you like (?:some )?help|(?:i|we) can help you|(?:can|could|may|shall) (?:i|we) give you a hand"); },
    function (t) { return matches(polite(t), "what colou?r (?:is|are) " + target + "|what (?:is|are) the colou?r of " + target + "|what (?:does|do) " + target + " look like|what (?:kind|type) of box is it|what is " + target + " like|(?:can|could|would) you describe " + target + "|describe " + target); },
    function (t) { return matches(polite(t), "where (?:is|are) " + box + "|where (?:can|could) (?:i|we) find " + box + "|where did " + box + " go|" + box + " where"); },
    function (t) { return matches(polite(t), "(?:can|could|may|shall) (?:i|we) (?:see|check|look at|have a look at) " + box + "|(?:(?:can|could|would|will) you )?show (?:me|us) " + box + "|let (?:me|us) (?:see|check|look at) " + box); },
    function (t) { return matches(polite(t), "(?:(?:do|does) )?you have " + box + "|have you got " + box + "|(?:is|are) " + box + " here"); },
    function (t) { return matches(polite(t), "(?:(?:can|could|would|will) you )?(?:look at|take a look at|check) " + ribbon); },
    function (t) {
      // Q7 only: confirmation that a box is on/in a cart, including ellipsis.
      var b = "(?:(?:any|some) )?" + box;
      var c = "(?:(?:the|that|this|a|your|my|our|these|those) )*(?:carts?|trolleys?)";
      var place = "(?:on|in) " + c;
      return matches(polite(t), "(?:(?:is|are) (?:there )?)?" + b + " " + place +
        "|there (?:(?:is|are) )?" + b + " " + place +
        "|" + b + " (?:is|are) " + place +
        "|(?:(?:do|does) )?you have " + b + " " + place +
        "|have you got " + b + " " + place +
        "|" + place + " (?:(?:is|are) )?" + b);
    },
    function (t) {
      t = polite(t);
      return matches(t, "(?:(?:can|could|would|will) you )?wait(?: (?:for (?:me|us)|here|a (?:second|minute|moment)))?|(?:just )?(?:a|one) (?:moment|minute|second)|(?:hold|hang) on|give (?:me|us) (?:a|one) (?:second|minute|moment)|do not (?:go|leave)(?: yet)?|stop(?: the bus)?");
    },
    function (t) { return matches(polite(t), "(?:(?:can|could|will|would) you )?(?:find|look for) " + box + "|(?:(?:can|could|will|would) you )?help (?:me|us) (?:to )?find " + box); },
    function (t) { return matches(polite(t), "(?:i|we) (?:found|find|got|get|have|have found|have got) " + box + "(?: (?:now|at last|finally))?|(?:here (?:is|are)|this is|these are) " + box + "|" + box + " (?:is|are) here"); }
  ];
  var rules = defs.map(function (d, i) {
    return {
      conceptId: d.communicative.conceptId,
      variants: d.answers.slice(), difficulty: "starter", promptType: d.communicative.promptType,
      accept: function (value) { return accept[i](norm(value)); },
      reject: function (value) { var t = norm(value); return Boolean(t) && !accept[i](t); }
    };
  });
  var pools = defs.map(function (d) {
    return { poolId: d.communicative.poolId, items: [{
      itemId: d.id, conceptId: d.communicative.conceptId, displayValue: d.prompt,
      prompts: [{ promptType: d.communicative.promptType, difficulty: "starter",
        expectedUtterance: d.communicative.expectedUtterance, acceptedVariants: d.answers.slice() }]
    }] };
  });
  defs.forEach(function (d) { QuestionDatabase.register(d); });
  Array.prototype.push.apply(CommunicativeJudgeRuleData, rules);
  Array.prototype.push.apply(LotteryPoolData, pools);
  LotteryEngine.init(LotteryPoolData);
})();
