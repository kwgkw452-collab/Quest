(function () {
  "use strict";
  // Authoritative S005 data. Core capabilities are unchanged.
  window.S005CommunicationData = [
  {
    "id": "s005.communication.1",
    "category": "word",
    "prompt": "いいえ、予約していません。",
    "answers": [
      "No, we don’t."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "「いいえ」だから……ピコ。",
      "“No” を使って答えるピコ。",
      "No, we don’t."
    ],
    "communicative": {
      "conceptId": "hotel.reservation.none",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "No, we don’t.",
      "poolId": "s005.communication.1.v1"
    }
  },
  {
    "id": "s005.communication.2",
    "category": "word",
    "prompt": "3人です。",
    "answers": [
      "Three."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "3人だから……ピコ。",
      "“Three” を使って答えるピコ。",
      "Three."
    ],
    "communicative": {
      "conceptId": "hotel.party.three",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "Three.",
      "poolId": "s005.communication.2.v1"
    }
  },
  {
    "id": "s005.communication.3",
    "category": "word",
    "prompt": "キングサイズのベッドはありますか？",
    "answers": [
      "Do you have a king-size bed?"
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“Do you...” から始めてみるピコ。",
      "“king-size bed” を使うピコ。",
      "Do you have a king-size bed?"
    ],
    "communicative": {
      "conceptId": "hotel.bed.king.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you have a king-size bed?",
      "poolId": "s005.communication.3.v1"
    }
  },
  {
    "id": "s005.communication.4",
    "category": "word",
    "prompt": "2部屋お願いします。",
    "answers": [
      "Two rooms, please."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "2だから……ピコ。",
      "“Two” から始めるピコ。",
      "Two rooms, please."
    ],
    "communicative": {
      "conceptId": "hotel.rooms.two.request",
      "difficulty": "starter",
      "promptType": "request",
      "expectedUtterance": "Two rooms, please.",
      "poolId": "s005.communication.4.v1"
    }
  },
  {
    "id": "s005.communication.5",
    "category": "word",
    "prompt": "はい、お願いします。",
    "answers": [
      "Yes, please."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "「はい」だから……ピコ。",
      "“Yes” を使って答えるピコ。",
      "Yes, please."
    ],
    "communicative": {
      "conceptId": "hotel.breakfast.yes",
      "difficulty": "starter",
      "promptType": "answer",
      "expectedUtterance": "Yes, please.",
      "poolId": "s005.communication.5.v1"
    }
  },
  {
    "id": "s005.communication.6",
    "category": "word",
    "prompt": "大丈夫ですか？",
    "answers": [
      "Are you OK?"
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“Are you...” から始めるピコ。",
      "“OK” を使うピコ。",
      "Are you OK?"
    ],
    "communicative": {
      "conceptId": "s005.social.wellbeing.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Are you OK?",
      "poolId": "s005.communication.6.v1"
    }
  },
  {
    "id": "s005.communication.7",
    "category": "word",
    "prompt": "（あなたの）名前は何ですか？",
    "answers": [
      "What’s your name?"
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“What’s...” から始めてみるピコ。",
      "“your name” を使うピコ。",
      "What’s your name?"
    ],
    "communicative": {
      "conceptId": "social.name.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "What’s your name?",
      "poolId": "s005.communication.7.v1"
    }
  },
  {
    "id": "s005.communication.8",
    "category": "word",
    "prompt": "物を盗みましたか？",
    "answers": [
      "Do you steal things?"
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“Did you...” または “Do you...” から始めるピコ。",
      "“steal” を使うピコ。",
      "Did you steal something?"
    ],
    "communicative": {
      "conceptId": "mystery.stealing.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Do you steal things?",
      "poolId": "s005.communication.8.v1"
    }
  },
  {
    "id": "s005.communication.9",
    "category": "word",
    "prompt": "私たちと一緒に来て。",
    "answers": [
      "Come with us."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“Come” または “Let’s” から始めるピコ。",
      "“with us” または “go” を使うピコ。",
      "Come with us.\nLet’s go."
    ],
    "communicative": {
      "conceptId": "social.come.with.us",
      "difficulty": "starter",
      "promptType": "invitation",
      "expectedUtterance": "Come with us.",
      "poolId": "s005.communication.9.v1"
    }
  },
  {
    "id": "s005.communication.10",
    "category": "word",
    "prompt": "バッグを見ましたか？",
    "answers": [
      "Did you see a bag?"
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“Did you...” から始めるピコ。",
      "“see” と “bag” を使うピコ。",
      "Did you see a bag?"
    ],
    "communicative": {
      "conceptId": "mystery.bag.sighting.ask",
      "difficulty": "starter",
      "promptType": "question",
      "expectedUtterance": "Did you see a bag?",
      "poolId": "s005.communication.10.v1"
    }
  },
  {
    "id": "s005.communication.11",
    "category": "word",
    "prompt": "彼の名前はBenです。",
    "answers": [
      "His name is Ben."
    ],
    "success": "",
    "failure": "",
    "hint": null,
    "picoSupport": [
      "“His...” から始めるピコ。",
      "“name” と “Ben” を使うピコ。",
      "His name is Ben."
    ],
    "communicative": {
      "conceptId": "social.ben.introduce",
      "difficulty": "starter",
      "promptType": "statement",
      "expectedUtterance": "His name is Ben.",
      "poolId": "s005.communication.11.v1"
    }
  }
];
  // Whole-word matching avoids accepting e.g. "one" inside "someone".
  function words(text) {
    var normalized = String(text || "").toLowerCase().replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
    return normalized ? normalized.split(/\s+/) : [];
  }
  function has(t, word) { return t.indexOf(word) !== -1; }
  function phrase(t, value) { return (" " + t.join(" ") + " ").indexOf(" " + value + " ") !== -1; }
  function any(t, values) { return values.some(function (value) { return has(t, value); }); }
  function negative(t) { return any(t, ["not", "dont", "no", "never"]); }
  function rule(conceptId, variants, accept, rejects, promptType) {
    var value = { conceptId: conceptId, variants: variants,
      rejects: [{ variants: rejects, reason: "contrary-goal" }],
      difficulty: "starter", promptType: promptType };
    if (accept) value.accept = accept;
    return value;
  }

  if (Array.isArray(window.CommunicativeJudgeRuleData)) {
    CommunicativeJudgeRuleData.push(
      rule("hotel.reservation.none", ["No, we don’t.", "No, we do not.", "No."],
        function (text) { var t = words(text); return has(t, "no") && !has(t, "yes"); },
        ["Yes, we do.", "We have a reservation."], "answer"),
      rule("hotel.party.three", ["Three.", "Three people.", "We are three."],
        function (text) { var t = words(text); return any(t, ["three", "3"]) && !negative(t); },
        ["Two.", "Four."], "answer"),
      rule("hotel.bed.king.ask", ["Do you have a king-size bed?"],
        function (text) {
          var t = words(text);
          return has(t, "king") && any(t, ["bed", "beds"]) && !negative(t) &&
            (phrase(t, "do you have") || phrase(t, "does this hotel have") ||
             phrase(t, "does the hotel have") || phrase(t, "is there") ||
             phrase(t, "are there") || has(t, "available") || has(t, "please") ||
             phrase(t, "can i have") || phrase(t, "can we have"));
        }, ["We don't need a bed."], "question"),
      rule("hotel.rooms.two.request", ["Two rooms, please."],
        function (text) { var t = words(text); return any(t, ["two", "2"]) &&
          any(t, ["room", "rooms"]) && !negative(t); },
        ["One room, please."], "request"),
      rule("hotel.breakfast.yes", ["Yes, please.", "Yes.", "Please.", "Sure.", "OK.", "Okay."],
        null, ["No, thank you."], "answer"),
      rule("s005.social.wellbeing.ask", ["Are you OK?", "Are you okay?", "Are you all right?",
        "Are you alright?", "You OK?", "You okay?", "All right?", "Everything OK?"],
        function (text) {
          var t = words(text);
          return !negative(t) && ((phrase(t, "are you") && any(t, ["ok", "okay", "fine", "alright"])) ||
            (phrase(t, "are you all right")) ||
            (has(t, "everything") && any(t, ["ok", "okay", "alright"])));
        }, ["I don't care."], "question"),
      rule("social.name.ask", ["What’s your name?", "Your name, please?", "Name, please?"],
        function (text) {
          var t = words(text);
          return has(t, "name") && !negative(t) &&
            ((has(t, "your") && any(t, ["what", "please", "have", "know", "tell", "want", "like"])) ||
             (phrase(t, "name please")));
        }, ["I don't want to know your name."], "question"),
      rule("mystery.stealing.ask", ["Do you steal things?", "Did you steal?", "Do you steal?"],
        function (text) {
          var t = words(text);
          if (negative(t) || phrase(t, "i stole") || phrase(t, "you stole")) return false;
          return phrase(t, "did you steal") || phrase(t, "do you steal") ||
            ((any(t, ["steal", "stole"]) && any(t, ["something", "anything", "things"])) && !has(t, "i")) ||
            (phrase(t, "did you take") && (any(t, ["something", "anything", "bag"])));
        }, ["You are a thief."], "question"),
      rule("social.come.with.us", ["Come with us.", "Come with me.", "Let’s go."],
        function (text) {
          var t = words(text);
          return !negative(t) && (any(t.slice(0, 2), ["come", "lets"])) &&
            (phrase(t, "come with us") || phrase(t, "come with me") || phrase(t, "lets go"));
        }, ["Go away."], "invitation"),
      rule("mystery.bag.sighting.ask", ["Did you see a bag?"],
        function (text) { var t = words(text); return has(t, "bag") &&
          any(t, ["see", "saw", "seen", "find", "found"]) && !negative(t); },
        ["I don't care about the bag."], "question"),
      rule("social.ben.introduce", ["His name is Ben.", "He is Ben.", "This is Ben."],
        function (text) {
          var t = words(text);
          return has(t, "ben") && !negative(t) &&
            ((has(t, "his") && any(t, ["name", "names"])) ||
             phrase(t, "he is ben") || phrase(t, "hes ben") ||
             phrase(t, "this is ben") || phrase(t, "the monster is ben"));
        }, ["He is a ghost."], "statement")
    );
  }

  S005CommunicationData.forEach(function (definition) {
    definition.communicative.judge = CommunicativeJudgeRuleData.filter(function (rule) {
      return rule.conceptId === definition.communicative.conceptId;
    })[0];
    QuestionDatabase.register(definition);
  });
})();
