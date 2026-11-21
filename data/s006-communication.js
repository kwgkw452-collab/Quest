(function () {
  "use strict";
  // S006 Communication V2: ONE authoritative question table; no V1 runtime registrations.
  var specs = [
  {
    "goal": "お手伝いしましょうか？",
    "model": "Can I help you?",
    "type": "offer",
    "h": [
      "「手伝う」は help。Can I ...? で始めるピコ。",
      "Can I のあとに help you を続けるピコ。",
      "Can I help you?"
    ],
    "yes": [
      "Can we help you?",
      "Do you need help?",
      "Let me help you.",
      "Would you like some help?",
      "May I help?",
      "Can I help?",
      "I help you?",
      "Shall I help you?",
      "Could I help you?",
      "May we help you?",
      "Let us help you."
    ],
    "no": [
      "I can't help you.",
      "Help me.",
      "Can you help me?",
      "I need help.",
      "Can I help him?",
      "Don't help me."
    ]
  },
  {
    "goal": "あなたの箱は何色ですか？",
    "model": "What color is it?",
    "type": "question",
    "h": [
      "「何色」は What color。これで始めるピコ。",
      "What color のあとに is it を続けるピコ。",
      "What color is it?"
    ],
    "yes": [
      "What color is your box?",
      "What colour is the box?",
      "What color is the box?",
      "What does your box look like?",
      "Can you describe your box?",
      "What color your box?",
      "What color are the box?",
      "What does it look like?",
      "What is the color of the box?",
      "What colour is your box?"
    ],
    "no": [
      "Is it brown?",
      "What size is the box?",
      "What color is the bus?",
      "The box is brown.",
      "Where is the box?"
    ]
  },
  {
    "goal": "ほかの箱はどこにありますか？",
    "model": "Where are the other boxes?",
    "type": "question",
    "h": [
      "「どこ」は Where。「ほかの箱」は the other boxes だピコ。",
      "Where are のあとに the other boxes を続けるピコ。",
      "Where are the other boxes?"
    ],
    "yes": [
      "Where is the other box?",
      "Where are the boxes?",
      "Where can we find the other boxes?",
      "Where did the other box go?",
      "Where is other box?",
      "Where are the other box?",
      "The other boxes, where?",
      "Where is another box?",
      "Where can I find another box?",
      "Where is box?"
    ],
    "no": [
      "Where is the bus?",
      "The box is here.",
      "I found the box.",
      "Where is the cart?"
    ]
  },
  {
    "goal": "その箱を見せてもらえますか？",
    "model": "Can I see the box?",
    "type": "request",
    "h": [
      "「見てもいい？」は Can I see ...? だピコ。",
      "Can I see のあとに the box を続けるピコ。",
      "Can I see the box?"
    ],
    "yes": [
      "Can we see that box?",
      "May I look at the box?",
      "Please show me the box.",
      "Could you show us that box?",
      "Can I see box?",
      "Show me box, please.",
      "Can we see the box?",
      "Could you show me the box?",
      "Can I look at the box?",
      "May I see the box?"
    ],
    "no": [
      "I can't see the box.",
      "Open the box.",
      "Don't show me the box.",
      "Can I see the bus?",
      "I see the box."
    ]
  },
  {
    "goal": "その箱を持っていますか？",
    "model": "Do you have the box?",
    "type": "question",
    "h": [
      "「持っていますか？」は Do you have ...? だピコ。",
      "Do you have のあとに the box を続けるピコ。",
      "Do you have the box?"
    ],
    "yes": [
      "Have you got the box?",
      "Do you have my box?",
      "Is the box here?",
      "Have you got it?",
      "You have the box?",
      "Do you has the box?",
      "Do you have that box?",
      "Have you got that box?",
      "Is that box here?",
      "Do you have a box?"
    ],
    "no": [
      "I have the box.",
      "You don't have the box.",
      "Do you have a ticket?",
      "The box is not here.",
      "Where did you take the boxes?"
    ]
  },
  {
    "goal": "このリボンを見てください。",
    "model": "Look at this ribbon.",
    "type": "request",
    "h": [
      "「見て」は Look at ...。「リボン」は ribbon だピコ。",
      "Look at のあとに this ribbon を続けるピコ。",
      "Look at this ribbon."
    ],
    "yes": [
      "Please look at the ribbon.",
      "Can you look at this ribbon?",
      "Take a look at this red ribbon.",
      "Please check this ribbon.",
      "Look this ribbon.",
      "Look at ribbon.",
      "Please look at this ribbon.",
      "Look at my ribbon, please.",
      "Could you look at these ribbons?"
    ],
    "no": [
      "Give me the ribbon.",
      "Don't look at the ribbon.",
      "Do not look at the ribbon.",
      "Look at the bus.",
      "The ribbon is red."
    ]
  },
  {
    "goal": "探している箱を見ましたか？",
    "model": "Did you see the box?",
    "type": "question",
    "h": [
      "「見ましたか？」は Did you see ...? だピコ。",
      "Did you see のあとに the box を続けるピコ。",
      "Did you see the box?"
    ],
    "yes": [
      "Have you seen the box?",
      "Have you seen a brown box?",
      "Did you see a box with a red ribbon?",
      "Do you know where the box is?",
      "Did you saw the box?",
      "You see the box?",
      "Do you see the box?",
      "Did you see a box?",
      "Have you seen my box?",
      "Can you see the box?",
      "Did you see my box?",
      "You saw the box?"
    ],
    "no": [
      "Is the box on the cart?",
      "Did you see the book?",
      "Did you see the books?",
      "Did you hear the box?",
      "Where is the cart?"
    ]
  },
  {
    "goal": "ちょっと待ってください！",
    "model": "Wait, please!",
    "type": "request",
    "h": [
      "「待って」は Wait。一言でも伝わるピコ。",
      "Wait に please を添えると丁寧になるピコ。",
      "Wait, please!"
    ],
    "yes": [
      "Please wait!",
      "Wait!",
      "Just a moment!",
      "Hold on!",
      "Please don't leave yet!",
      "Please wait me.",
      "Can you wait?",
      "Could you wait?",
      "Just a minute!",
      "One moment, please.",
      "Hang on!",
      "Wait a second!",
      "Stop the bus, please!",
      "Please don't go yet!"
    ],
    "no": [
      "Go!",
      "Don't wait!",
      "Hurry up!",
      "Go now.",
      "Don't stop the bus.",
      "I will wait.",
      "I can't wait.",
      "Please don't wait."
    ]
  },
  {
    "goal": "その箱を探してください。",
    "model": "Please look for the box.",
    "type": "request",
    "h": [
      "「探す」は look for。「箱」は box だピコ。",
      "Please のあとに look for the box を続けるピコ。",
      "Please look for the box."
    ],
    "yes": [
      "Can you look for the box?",
      "Please help us find the box.",
      "Can you check for the box?",
      "Please find my box.",
      "Please look for box.",
      "Please find box.",
      "Can you finds the box?",
      "Please find the box.",
      "Find the box, please.",
      "Can you find the box?",
      "Can you help me find the box?",
      "Can you check the luggage for the box?"
    ],
    "no": [
      "I found the box.",
      "Don't find the box.",
      "Please look at the box.",
      "Do not look for the box.",
      "Can you find my ticket?",
      "I cannot find the box."
    ]
  },
  {
    "goal": "はい、あなたの箱です！",
    "model": "Here is your box!",
    "type": "statement",
    "h": [
      "「はい、どうぞ」は Here is ...。「あなたの箱」は your box だピコ。",
      "Here is のあとに your box を続けるピコ。",
      "Here is your box!"
    ],
    "yes": [
      "Here's your box!",
      "This is your box!",
      "Here you are!",
      "I found your box!",
      "We have your box!",
      "Here your box!",
      "Here are your box!",
      "I find your box!",
      "We found the box!",
      "I found the box!",
      "We found your box!",
      "I have your box!",
      "There is your box!"
    ],
    "no": [
      "Where is your box?",
      "This is not your box.",
      "Give me your box.",
      "I did not find the box.",
      "We don't have the box.",
      "Can you find the box?",
      "I will find the box.",
      "We want to get the box."
    ]
  }
];
  function norm(value) {
    return String(value || "").toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\b(colour)\b/g, "color").replace(/\b(here's)\b/g, "here is")
      .replace(/\b(can't|cant)\b/g, "cannot").replace(/\b(don't|dont)\b/g, "do not")
      .replace(/\b(doesn't|doesnt)\b/g, "does not").replace(/\b(didn't|didnt)\b/g, "did not")
      .replace(/\b(we've|weve)\b/g, "we have").replace(/\b(i've|ive)\b/g, "i have")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function unique(values) {
    var known = Object.create(null);
    return values.filter(function (value) {
      var key = norm(value);
      if (!key || known[key]) return false;
      known[key] = true;
      return true;
    });
  }
  // Purpose-bound patterns permit common combinations, not arbitrary semantic guesses.
  var box = "(?:(?:the|that|this|your|my|our|a|another|other|those|these) )*box(?:es)?";
  var obj = "(?:" + box + "|it|this|that)";
  var ribbon = "(?:(?:the|that|this|your|my|a|red|these|those) )*ribbons?";
  var ribbonObject = "(?:" + ribbon + "|it|this|that)";
  var patterns = [
    "^(?:(?:can|could|may|shall) (?:i|we) help(?: you)?|(?:do you )?need (?:some )?help|let (?:me|us) help(?: you)?|would you like (?:some )?help)$",
    "^(?:what color (?:is|are) " + obj + "|what color " + obj + "|what (?:is|are) the color of " + obj + "|what (?:does|do) " + obj + " look like|(?:can|could) you describe " + obj + ")$",
    "^(?:where (?:is|are) " + obj + "|where (?:can|could) (?:i|we) find " + obj + "|where did " + obj + " go|" + obj + " where)$",
    "^(?:(?:can|could|may) (?:i|we) (?:see|look at) " + obj + "|(?:can|could|would) you show (?:me|us) " + obj + "|show (?:me|us) " + obj + ")$",
    "^(?:(?:do|does) you (?:have|has) " + obj + "|you have " + obj + "|have you got " + obj + "|is " + obj + " here)$",
    "^(?:(?:(?:can|could|would) you )?(?:look at|look|check) " + ribbonObject + "|(?:take a look at|look at) " + ribbonObject + ")$",
    "^(?:(?:did|do|does) you (?:see|saw) " + obj + "|(?:have you|did you) seen " + obj + "|you (?:saw|see) " + obj + "|(?:can|could) you see " + obj + "|do you know where " + obj + " is)$",
    "^(?:(?:can|could|would) you )?wait(?: (?:for )?(?:me|us))?$|^(?:(?:just )?(?:a|one) (?:moment|minute|second)|(?:hold|hang) on|stop the bus|do not (?:go|leave)(?: yet)?)$",
    "^(?:(?:(?:can|could|will|would) you )?(?:find|finds|look for|check for) " + obj + "|(?:can|could) you help (?:me|us) find " + obj + "|help (?:me|us) find " + obj + ")$",
    "^(?:(?:here (?:is|are)|this is|there is) " + obj + "|(?:i|we) (?:found|find|got|get|have|have found|have got) " + obj + "|here you are)$"
  ];
  function withoutPlease(s) { return s.replace(/\bplease\b/g, " ").replace(/\s+/g, " ").trim(); }
  specs.forEach(function (spec, i) {
    var id = "s006.communication." + (i + 1);
    var conceptId = "s006.mystery.v2." + (i + 1);
    var poolId = id + ".v2";
    var answers = unique([spec.model].concat(spec.yes));
    var accepted = Object.create(null), rejected = Object.create(null);
    answers.forEach(function (x) { accepted[norm(x)] = true; });
    spec.no.forEach(function (x) { rejected[norm(x)] = true; });
    var matcher = new RegExp(patterns[i]);
    function accepts(value) {
      var t = norm(value);
      if (!t || rejected[t]) return false;
      if (accepted[t]) return true;
      return matcher.test(withoutPlease(t));
    }
    function rejects(value) {
      var t = norm(value);
      if (!t || accepts(t)) return false;
      if (rejected[t]) return true;
      // Explicit contradictory intent is rejected; other unrecognized speech is UNKNOWN.
      // A negative word alone (e.g. "I am not sure") is not contrary intent.
      // Only a negated, otherwise recognized target action is rejected.
      if (/\b(?:cannot|do not|does not|did not|not|never|no)\b/.test(t)) {
        var positive = t.replace(/\bcannot\b/g, "can")
          .replace(/\bdo not\b/g, "").replace(/\bdoes not\b/g, "does")
          .replace(/\bdid not\b/g, "did").replace(/\b(?:not|never|no)\b/g, "")
          .replace(/\s+/g, " ").trim();
        if (accepts(positive)) return true;
      }
      return false;
    }
    var question = {
      id: id, category: "word", prompt: spec.goal, answers: answers,
      success: "", failure: "", picoSupport: spec.h.slice(),
      communicative: { conceptId: conceptId, difficulty: "starter",
        promptType: spec.type, expectedUtterance: spec.model, poolId: poolId }
    };
    QuestionDatabase.register(question);
    CommunicativeJudgeRuleData.push({
      conceptId: conceptId, variants: answers.slice(), difficulty: "starter",
      promptType: spec.type, accept: accepts, reject: rejects
    });
    LotteryPoolData.push({ poolId: poolId, items: [{
      itemId: id, conceptId: conceptId, displayValue: spec.goal,
      prompts: [{ promptType: spec.type, difficulty: "starter",
        expectedUtterance: spec.model, acceptedVariants: answers.slice() }]
    }] });
  });
  LotteryEngine.init(LotteryPoolData);
})();