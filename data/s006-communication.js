(function () {
  "use strict";

  // Sole S006 specification: approved Final Review, 2026-11-19.
  // Public IDs/Story positions remain unchanged; no V1 definitions or patches.
  var tasks = [
  {
    "number": 1,
    "goal": "お手伝いしましょうか？",
    "model": "Can I help you?",
    "variants": [
      "Can we help you?",
      "Do you need help?",
      "Let me help you.",
      "Would you like some help?",
      "May I help?"
    ],
    "hints": [
      "「手伝う」は help。Can I ...? で始めるピコ。",
      "Can I のあとに help you を続けるピコ。",
      "Can I help you?"
    ],
    "type": "offer",
    "rejectExamples": [
      "I can't help you.",
      "Help me."
    ]
  },
  {
    "number": 2,
    "goal": "あなたの箱は何色ですか？",
    "model": "What color is it?",
    "variants": [
      "What color is your box?",
      "What colour is the box?",
      "What does your box look like?",
      "Can you describe your box?"
    ],
    "hints": [
      "「何色」は What color。これで始めるピコ。",
      "What color のあとに is it を続けるピコ。",
      "What color is it?"
    ],
    "type": "question",
    "rejectExamples": [
      "Is it brown?",
      "What size is the box?"
    ]
  },
  {
    "number": 3,
    "goal": "ほかの箱はどこにありますか？",
    "model": "Where are the other boxes?",
    "variants": [
      "Where is the other box?",
      "Where are the boxes?",
      "Where can we find the other boxes?",
      "Where did the other box go?"
    ],
    "hints": [
      "「どこ」は Where。「ほかの箱」は the other boxes だピコ。",
      "Where are のあとに the other boxes を続けるピコ。",
      "Where are the other boxes?"
    ],
    "type": "question",
    "rejectExamples": [
      "Where is the bus?",
      "The box is here."
    ]
  },
  {
    "number": 4,
    "goal": "その箱を見せてもらえますか？",
    "model": "Can I see the box?",
    "variants": [
      "Can we see that box?",
      "May I look at the box?",
      "Please show me the box.",
      "Could you show us that box?"
    ],
    "hints": [
      "「見てもいい？」は Can I see ...? だピコ。",
      "Can I see のあとに the box を続けるピコ。",
      "Can I see the box?"
    ],
    "type": "request",
    "rejectExamples": [
      "I can't see the box.",
      "Open the box."
    ]
  },
  {
    "number": 5,
    "goal": "その箱を持っていますか？",
    "model": "Do you have the box?",
    "variants": [
      "Have you got the box?",
      "Do you have my box?",
      "Is the box here?",
      "Have you got it?"
    ],
    "hints": [
      "「持っていますか？」は Do you have ...? だピコ。",
      "Do you have のあとに the box を続けるピコ。",
      "Do you have the box?"
    ],
    "type": "question",
    "rejectExamples": [
      "I have the box.",
      "You don't have the box."
    ]
  },
  {
    "number": 6,
    "goal": "このリボンを見てください。",
    "model": "Look at this ribbon.",
    "variants": [
      "Please look at the ribbon.",
      "Can you look at this ribbon?",
      "Take a look at this red ribbon.",
      "Please check this ribbon."
    ],
    "hints": [
      "「見て」は Look at ...。「リボン」は ribbon だピコ。",
      "Look at のあとに this ribbon を続けるピコ。",
      "Look at this ribbon."
    ],
    "type": "request",
    "rejectExamples": [
      "Give me the ribbon.",
      "Don't look at the ribbon."
    ]
  },
  {
    "number": 7,
    "goal": "探している箱を見ましたか？",
    "model": "Did you see the box?",
    "variants": [
      "Have you seen the box?",
      "Have you seen a brown box?",
      "Did you see a box with a red ribbon?",
      "Do you know where the box is?"
    ],
    "hints": [
      "「見ましたか？」は Did you see ...? だピコ。",
      "Did you see のあとに the box を続けるピコ。",
      "Did you see the box?"
    ],
    "type": "question",
    "rejectExamples": [
      "Is the box on the cart?",
      "Did you see the book?"
    ]
  },
  {
    "number": 8,
    "goal": "ちょっと待ってください！",
    "model": "Wait, please!",
    "variants": [
      "Please wait!",
      "Wait!",
      "Just a moment!",
      "Hold on!",
      "Please don't leave yet!"
    ],
    "hints": [
      "「待って」は Wait。一言でも伝わるピコ。",
      "Wait に please を添えると丁寧になるピコ。",
      "Wait, please!"
    ],
    "type": "request",
    "rejectExamples": [
      "Go!",
      "Don't wait!",
      "Hurry up!"
    ]
  },
  {
    "number": 9,
    "goal": "その箱を探してください。",
    "model": "Please look for the box.",
    "variants": [
      "Can you look for the box?",
      "Please help us find the box.",
      "Can you check for the box?",
      "Please find my box."
    ],
    "hints": [
      "「探す」は look for。「箱」は box だピコ。",
      "Please のあとに look for the box を続けるピコ。",
      "Please look for the box."
    ],
    "type": "request",
    "rejectExamples": [
      "I found the box.",
      "Don't find the box.",
      "Please look at the box."
    ]
  },
  {
    "number": 10,
    "goal": "はい、あなたの箱です！",
    "model": "Here is your box!",
    "variants": [
      "Here's your box!",
      "This is your box!",
      "Here you are!",
      "I found your box!",
      "We have your box!"
    ],
    "hints": [
      "「はい、どうぞ」は Here is ...。「あなたの箱」は your box だピコ。",
      "Here is のあとに your box を続けるピコ。",
      "Here is your box!"
    ],
    "type": "statement",
    "rejectExamples": [
      "Where is your box?",
      "This is not your box.",
      "Give me your box."
    ]
  }
];

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[’‘]/g, "'")
      .replace(/\b(can't|cant)\b/g, "cannot")
      .replace(/\b(don't|dont)\b/g, "do not")
      .replace(/\b(doesn't|doesnt)\b/g, "does not")
      .replace(/\b(didn't|didnt)\b/g, "did not")
      .replace(/\b(won't|wont)\b/g, "will not")
      .replace(/\b(couldn't|couldnt)\b/g, "could not")
      .replace(/\b(wouldn't|wouldnt)\b/g, "would not")
      .replace(/\b(isn't|isnt)\b/g, "is not")
      .replace(/\b(aren't|arent)\b/g, "are not")
      .replace(/\b(haven't|havent)\b/g, "have not")
      .replace(/\b(hasn't|hasnt)\b/g, "has not")
      .replace(/\b(we've|weve)\b/g, "we have")
      .replace(/\b(i've|ive)\b/g, "i have")
      .replace(/\b(here's|heres)\b/g, "here is")
      .replace(/\b(where's|wheres)\b/g, "where is")
      .replace(/\b(it's|its)\b/g, "it is")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function polite(text) {
    return text.replace(/\bplease\b/g, " ").replace(/\s+/g, " ").trim();
  }
  function whole(text, pattern) { return new RegExp("^(?:" + pattern + ")$").test(text); }
  var box = "(?:(?:the|a|an|this|that|these|those|my|your|our|some|any|another) )?" +
    "(?:(?:other|brown|wooden|small) )*box(?:es)?" +
    "(?: with (?:(?:a|the) )?red ribbons?)?";
  var target = "(?:" + box + "|it|this|that|them)";
  var ribbon = "(?:(?:the|a|this|that|these|those|my|your|our) )?(?:red )?ribbons?";
  var ribbonTarget = "(?:" + ribbon + "|it|this|that)";
  var request = "(?:(?:can|could|would|will) you )?";
  // Complete intents, never substring matching of a positive prefix.
  var intentPatterns = [
    "(?:can|could|may|shall) (?:i|we) help(?: you)?|(?:i|we) (?:can )?help you|" +
      "let (?:me|us) help(?: you)?|(?:do you )?need (?:some )?help|would you like (?:some )?help",
    "what colou?r (?:(?:is|are) )?" + target +
      "|what (?:is|are) the colou?r of " + target +
      "|what (?:does|do) " + target + " look like|" + request + "describe " + target,
    "where (?:(?:is|are) )?" + target +
      "|where (?:can|could) (?:i|we) find " + target +
      "|where did " + target + " go|" + target + " where",
    "(?:can|could|may|shall) (?:i|we) (?:see|look at|check|have a look at) " + target +
      "|" + request + "show (?:me|us) " + target + "|let (?:me|us) (?:see|look at) " + target,
    "(?:(?:do|does) )?you (?:have|has) " + target +
      "|have you got " + target + "|(?:is|are) " + target + " here",
    request + "(?:look(?: at)?|take a look at|check) " + ribbonTarget,
    "(?:did|do|does) you (?:see|saw) " + target +
      "|have you seen " + target + "|you (?:see|saw) " + target +
      "|do you know where " + target + " (?:is|are)",
    "(?:(?:can|could|would|will) you )?wait(?: (?:for )?(?:me|us)| here| a (?:moment|minute|second))?" +
      "|(?:just )?(?:a|one) (?:moment|minute|second)|hold on|do not (?:leave|go)(?: yet)?",
    request + "(?:look for|find|finds|check for) " + target +
      "|" + request + "help (?:me|us) (?:to )?(?:find|look for) " + target,
    "here (?:(?:is|are) )?" + target + "|(?:this is|these are) " + target +
      "|here you are|(?:i|we) (?:found|find|have|have found|got|have got) " + target
  ];
  // Known different intents; an unsupported phrase alone is NOT a rejection.
  var otherIntentPatterns = [
    request + "help (?:me|us)",
    "(?:is|are) " + target + " (?:brown|red|blue|green)|what (?:size|weight) (?:is|are) " + target,
    target + " (?:is|are) here",
    request + "(?:open|close|take|buy) " + target,
    "(?:i|we) (?:have|has|have got) " + target,
    request + "(?:give (?:me|us)|take|hide) " + ribbonTarget,
    "(?:is|are) " + target + " (?:on|in|under|near) .+",
    "(?:go|leave)(?: now)?|hurry up",
    "(?:i|we) (?:found|have found|have) " + target + "|" + request + "look at " + target,
    "where (?:is|are) " + target + "|" + request + "give (?:me|us) " + target
  ];
  function hasNegativeIntent(text) {
    // "I am not sure ..." is not an automatic rejection.
    return /\b(?:cannot|can not|could not|do not|does not|did not|will not|would not|never)\b/.test(text) ||
      /\b(?:is|are|have|has) not\b/.test(text);
  }
  function wrongObject(task, text) {
    // No book/box ASR alias. Reject only recognizable, named other objects.
    var relevant = /\b(?:help|see|saw|seen|look|find|finds|found|have|has|got|show|describe|where|color|colour|give|open|check)\b/.test(text);
    if (!relevant || task.number === 1 || task.number === 8) return false;
    var wrong = task.number === 6 ?
      /\b(?:box|boxes|book|books|bus|train|cart|trolley|ticket|tickets)\b/ :
      /\b(?:book|books|bag|bags|ticket|tickets)\b/;
    if (wrong.test(text)) return true;
    // A box with a ribbon (or transported to the bus) is still a box.
    return task.number !== 6 && !/\bbox(?:es)?\b/.test(text) &&
      /\b(?:bus|train|cart|trolley|ribbon|ribbons)\b/.test(text);
  }
  var rules = [], pools = [];
  tasks.forEach(function (task, index) {
    var variants = [task.model].concat(task.variants);
    var approved = variants.map(function (value) { return polite(normalize(value)); });
    var explicitRejects = task.rejectExamples.map(function (value) { return polite(normalize(value)); });
    function acceptText(text) {
      return approved.indexOf(text) !== -1 || whole(text, intentPatterns[index]);
    }
    function rejectText(value) {
      var text = polite(normalize(value));
      if (!text) return false;
      // Approved negative forms such as Q8 "don't leave" express the RIGHT intent.
      if (acceptText(text)) return false;
      return explicitRejects.indexOf(text) !== -1 || wrongObject(task, text) ||
        whole(text, otherIntentPatterns[index]) ||
        (hasNegativeIntent(text) &&
          /\b(?:help|see|saw|seen|look|find|found|have|box|boxes|ribbon|wait|go|leave)\b/.test(text));
    }
    var id = "s006.communication." + task.number;
    var conceptId = "s006.mystery.v2." + task.number;
    var poolId = id + ".v2";
    QuestionDatabase.register({
      id: id, category: "word", prompt: task.goal, answers: variants.slice(),
      success: "", failure: "", picoSupport: task.hints.slice(),
      communicative: {
        conceptId: conceptId, difficulty: "starter", promptType: task.type,
        expectedUtterance: task.model, poolId: poolId
      }
    });
    rules.push({
      conceptId: conceptId, variants: variants.slice(), difficulty: "starter",
      promptType: task.type,
      accept: function (value) {
        var text = polite(normalize(value));
        return !wrongObject(task, text) && acceptText(text);
      },
      reject: rejectText
    });
    pools.push({ poolId: poolId, items: [{
      itemId: id, conceptId: conceptId, displayValue: task.goal,
      prompts: [{
        promptType: task.type, difficulty: "starter",
        expectedUtterance: task.model, acceptedVariants: variants.slice()
      }]
    }] });
  });
  Array.prototype.push.apply(CommunicativeJudgeRuleData, rules);
  Array.prototype.push.apply(LotteryPoolData, pools);
  LotteryEngine.init(LotteryPoolData);
})();
