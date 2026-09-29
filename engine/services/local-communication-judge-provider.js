(function () {
  "use strict";

  function unavailable(technicalReason) {
    return { technicalStatus: "JUDGE_UNAVAILABLE", verdict: null, reason: null, reasonSlotId: null,
      improvement: "none", technicalReason: technicalReason };
  }

  function result(verdict, reason, reasonSlotId, improvement) {
    return { technicalStatus: "AVAILABLE", verdict: verdict, reason: reason, reasonSlotId: reasonSlotId || null,
      improvement: improvement || "none" };
  }

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/[.,!?']/g, "").replace(/\s+/g, " ").trim();
  }

  function required(task, slotId) {
    return (task.requiredInformation || []).filter(function (entry) { return entry.slotId === slotId; })[0] || null;
  }

  function positions(tokens, match) {
    var wanted = normalize(match).split(" ").filter(Boolean);
    var found = [];
    if (!wanted.length) return found;
    for (var index = 0; index <= tokens.length - wanted.length; index += 1) {
      var matches = wanted.every(function (token, offset) { return tokens[index + offset] === token; });
      if (matches) found.push({ start: index, end: index + wanted.length });
    }
    return found;
  }

  function candidateKey(candidate) {
    if (Object.prototype.hasOwnProperty.call(candidate, "conceptId")) return "concept:" + candidate.conceptId;
    if (Object.prototype.hasOwnProperty.call(candidate, "token")) return "token:" + candidate.token;
    return "slot:" + candidate.slotId + ":" + String(candidate.value);
  }

  function relevantCommon(entry, task) {
    if (entry.scope.type === "slot") return !!required(task, entry.scope.id);
    if (entry.scope.type === "concept") {
      return (task.requiredInformation || []).some(function (information) { return information.conceptId === entry.scope.id; });
    }
    return false;
  }

  function dictionaryEvidence(task, tokens, source) {
    var matches = [];
    (source || []).forEach(function (entry) {
      var taskScoped = entry.scope && entry.scope.type === "task" && entry.scope.id === task.taskId;
      var commonScoped = entry.scope && relevantCommon(entry, task);
      if (!taskScoped && !commonScoped) return;
      positions(tokens, entry.match).forEach(function (location) {
        matches.push({ rawMatch: entry.match, start: location.start, end: location.end,
          scope: Object.assign({}, entry.scope), candidate: Object.assign({}, entry.candidate), taskScoped: taskScoped });
      });
    });

    var groups = Object.create(null);
    matches.forEach(function (match) {
      var key = match.start + ":" + match.end;
      if (!groups[key]) groups[key] = [];
      groups[key].push(match);
    });
    var selected = [];
    var conflict = false;
    Object.keys(groups).forEach(function (key) {
      var group = groups[key];
      var taskMatches = group.filter(function (match) { return match.taskScoped; });
      var level = taskMatches.length ? taskMatches : group.filter(function (match) { return !match.taskScoped; });
      var keys = level.map(function (match) { return candidateKey(match.candidate); })
        .filter(function (value, index, values) { return values.indexOf(value) === index; });
      if (keys.length > 1) conflict = true;
      else if (level.length) selected.push(level[0]);
    });
    return { evidence: selected, conflict: conflict };
  }

  function articleQuantityEvidence(task, tokens, conceptEvidence) {
    if (!task || task.action !== "order.request" || !required(task, "quantity")) return [];
    var itemRequirement = required(task, "item");
    if (!itemRequirement) return [];
    return conceptEvidence.filter(function (evidence) {
      return evidence.candidate.conceptId === itemRequirement.conceptId && evidence.start > 0 &&
        (tokens[evidence.start - 1] === "a" || tokens[evidence.start - 1] === "an");
    }).map(function (evidence) {
      return { rawMatch: tokens[evidence.start - 1] + " " + evidence.rawMatch,
        start: evidence.start - 1, end: evidence.end, scope: { type: "slot", id: "quantity" },
        candidate: { slotId: "quantity", value: 1 }, relation: "article-modifies-item" };
    });
  }

  function buildEvidence(input, dictionaryEntries) {
    input = input || {};
    var task = input.taskSpec || { requiredInformation: [] };
    var rawTranscript = String(input.transcript || "");
    var normalizedSurface = normalize(rawTranscript);
    var tokens = normalizedSurface ? normalizedSurface.split(" ") : [];
    var source = dictionaryEntries || (window.CommunicationRecognitionDictionary ? CommunicationRecognitionDictionary.all() : []);
    if (!dictionaryEntries && window.CommunicationRecognitionCandidateStore &&
        typeof CommunicationRecognitionCandidateStore.approvedDictionaryEntries === "function") {
      source = source.concat(CommunicationRecognitionCandidateStore.approvedDictionaryEntries());
    }
    var dictionary = dictionaryEvidence(task, tokens, source);
    var concepts = Array.isArray(input.concepts) ? input.concepts : [];
    var conceptEvidence = [];
    concepts.forEach(function (concept) {
      (concept.forms || []).forEach(function (form) {
        positions(tokens, form.text).forEach(function (location) {
          conceptEvidence.push({ rawMatch: form.text, start: location.start, end: location.end,
            scope: { type: "concept", id: concept.conceptId },
            candidate: { conceptId: concept.conceptId }, form: Object.assign({}, form) });
        });
      });
    });
    var articleEvidence = articleQuantityEvidence(task, tokens, conceptEvidence);
    return { rawTranscript: rawTranscript, normalizedSurface: normalizedSurface, tokens: tokens,
      evidence: conceptEvidence.concat(dictionary.evidence, articleEvidence), dictionaryConflict: dictionary.conflict };
  }

  function cueMatches(cue, analysis) {
    var wanted = normalize(cue).split(" ").filter(Boolean);
    if (!wanted.length) return false;
    for (var index = 0; index <= analysis.tokens.length - wanted.length; index += 1) {
      var matched = wanted.every(function (token, offset) {
        var position = index + offset;
        if (analysis.tokens[position] === token) return true;
        return analysis.evidence.some(function (evidence) {
          return evidence.start === position && evidence.end === position + 1 && evidence.candidate.token === token;
        });
      });
      if (matched) return true;
    }
    return false;
  }

  function anyCue(cues, analysis) {
    return (cues || []).some(function (cue) { return cueMatches(cue, analysis); });
  }

  function judge(input) {
    input = input || {};
    var task = input.taskSpec;
    if (!task || !window.CommunicationTaskSpecDatabase || CommunicationTaskSpecDatabase.validate(task).length) {
      return unavailable("invalid_task_spec");
    }
    var action = input.actionProfile;
    var profile = input.judgeProfile;
    if (!action || !profile) return unavailable("unsupported_action");
    var itemRequirement = required(task, "item");
    var quantityRequirement = required(task, "quantity");
    var requiredConcept = input.requiredConcept;
    var concepts = input.concepts;
    if (!itemRequirement || !quantityRequirement) return unavailable("invalid_task_spec");
    if (!requiredConcept || !Array.isArray(concepts)) return unavailable("unknown_concept");

    var analysis = buildEvidence(input);
    if (analysis.dictionaryConflict) return result("UNKNOWN", "recognition_conflict", null);

    var itemEvidence = analysis.evidence.filter(function (evidence) { return evidence.candidate.conceptId; });
    var requiredItems = itemEvidence.filter(function (evidence) { return evidence.candidate.conceptId === requiredConcept.conceptId; });
    var wrongItem = itemEvidence.filter(function (evidence) { return evidence.candidate.conceptId !== requiredConcept.conceptId; })[0];
    var quantityValues = analysis.evidence.filter(function (evidence) { return evidence.candidate.slotId === "quantity"; })
      .map(function (evidence) { return evidence.candidate.value; });
    analysis.tokens.forEach(function (token, index) {
      var dictionaryCovered = analysis.evidence.some(function (evidence) {
        return evidence.start === index && evidence.candidate.slotId === "quantity";
      });
      if (!dictionaryCovered && Object.prototype.hasOwnProperty.call(profile.quantityValues, token)) quantityValues.push(profile.quantityValues[token]);
    });
    quantityValues = quantityValues.filter(function (value, index, values) { return values.indexOf(value) === index; });

    if (quantityValues.length > 1) return result("UNKNOWN", "recognition_conflict", "quantity");
    if (wrongItem) return result("REJECT", "wrong_item", "item");
    if (quantityValues.length === 1 && quantityValues[0] !== quantityRequirement.value) {
      return result("REJECT", "wrong_quantity", "quantity");
    }
    if (anyCue(action.oppositeCues, analysis)) return result("REJECT", "opposite_intent", null);
    if (anyCue(action.differentActionCues, analysis)) return result("REJECT", "different_action", null);

    var missingSlot = !requiredItems.length ? "item" : quantityValues.length !== 1 ? "quantity" : null;
    if (missingSlot) return result("UNKNOWN", "missing_required_information", missingSlot);
    if (!anyCue(action.positiveCues, analysis)) return result("UNKNOWN", "unknown_expression", null);

    var singular = requiredItems.some(function (evidence) { return evidence.form && evidence.form.number === "singular"; });
    var improvement = quantityRequirement.value !== 1 && singular ? "plural_form" : "none";
    return result("ACCEPT", "goal_achieved", null, improvement);
  }

  window.LocalCommunicationJudgeProvider = { judge: judge, normalize: normalize, buildEvidence: buildEvidence };
})();
