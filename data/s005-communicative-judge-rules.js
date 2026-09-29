(function () {
  "use strict";

  if (!Array.isArray(window.CommunicativeJudgeRuleData)) {
    window.CommunicativeJudgeRuleData = [];
  }
  var registryBefore = window.CommunicativeJudgeRuleData;
  var lengthBefore = registryBefore.length;
  var addedConceptIds = [];

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

  var rules = [
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
  ];

  rules.forEach(function (candidate) {
    var exists = CommunicativeJudgeRuleData.some(function (registered) {
      return registered && registered.conceptId === candidate.conceptId;
    });
    if (!exists) {
      CommunicativeJudgeRuleData.push(candidate);
      addedConceptIds.push(candidate.conceptId);
    }
  });
  window.__S005RuleTraceRegistry = registryBefore;
  console.log("[S005 RULE TRACE] asset-loaded", {
    lengthBefore: lengthBefore,
    lengthAfter: CommunicativeJudgeRuleData.length,
    addedConceptIds: addedConceptIds.slice()
  });
})();
