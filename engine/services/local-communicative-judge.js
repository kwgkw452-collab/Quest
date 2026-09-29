(function () {
  "use strict";

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function normalize(text) {
    if (window.SpeechNormalizer && typeof SpeechNormalizer.normalize === "function") {
      return SpeechNormalizer.normalize(text);
    }
    return String(text || "")
      .toLowerCase()
      .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、「」！？・…（）［］【】〈〉《》]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function validateRules(source) {
    var errors = [];
    var ids = Object.create(null);
    if (!Array.isArray(source)) return ["CommunicativeJudgeRuleData must be an array."];
    source.forEach(function (rule, index) {
      var label = "CommunicativeJudgeRuleData[" + index + "]";
      if (!isObject(rule)) {
        errors.push(label + " must be an object.");
        return;
      }
      if (!rule.conceptId || typeof rule.conceptId !== "string") {
        errors.push(label + " needs string 'conceptId'.");
      } else if (ids[rule.conceptId]) {
        errors.push("Duplicate communicative judge conceptId: " + rule.conceptId);
      } else ids[rule.conceptId] = true;
      if (!Array.isArray(rule.variants) || rule.variants.some(function (variant) {
        return typeof variant !== "string" || !variant.trim();
      })) errors.push(label + " variants must be an array of non-empty strings.");
      if (rule.accept !== undefined && typeof rule.accept !== "function") {
        errors.push(label + " accept must be a function.");
      }
      if (rule.difficulty !== undefined && !(typeof rule.difficulty === "string" ||
          (Array.isArray(rule.difficulty) && rule.difficulty.every(function (value) { return typeof value === "string" && value; })))) {
        errors.push(label + " difficulty must be a string or an array of strings.");
      }
      if (rule.promptType !== undefined && typeof rule.promptType !== "string") {
        errors.push(label + " promptType must be a string.");
      }
      if (rule.metadata !== undefined && !isObject(rule.metadata)) errors.push(label + " metadata must be an object.");
      if (rule.dictionary !== undefined && (!isObject(rule.dictionary) ||
          typeof rule.dictionary.dictionaryId !== "string" || typeof rule.dictionary.canonical !== "string")) {
        errors.push(label + " dictionary needs string dictionaryId and canonical.");
      }
      if (rule.rejects !== undefined && (!Array.isArray(rule.rejects) || rule.rejects.some(function (reject) {
        return !isObject(reject) || !Array.isArray(reject.variants) || reject.variants.length === 0 ||
          reject.variants.some(function (variant) { return typeof variant !== "string" || !variant.trim(); }) ||
          (reject.reason !== undefined && typeof reject.reason !== "string");
      }))) errors.push(label + " rejects must contain non-empty variant arrays.");
    });
    return errors;
  }

  function exactMatch(text, variants) {
    var normalized = normalize(text);
    for (var i = 0; i < (variants || []).length; i += 1) {
      if (normalized && normalized === normalize(variants[i])) return variants[i];
    }
    return null;
  }

  function difficultyMatches(rule, difficulty) {
    if (!difficulty || rule.difficulty === undefined) return true;
    return Array.isArray(rule.difficulty) ? rule.difficulty.indexOf(difficulty) !== -1 : rule.difficulty === difficulty;
  }

  function evaluateCandidate(rule, text, traceState) {
    var rejects = rule.rejects || [];
    for (var i = 0; i < rejects.length; i += 1) {
      var rejected = exactMatch(text, rejects[i].variants);
      if (rejected) {
        if (traceState) traceState.variantMatch = false;
        return { verdict: "REJECT", source: "rule", reason: rejects[i].reason || "explicit-reject", matchedVariant: rejected };
      }
    }
    var approved = exactMatch(text, rule.variants || []);
    if (traceState) traceState.variantMatch = Boolean(approved);
    if (approved) return { verdict: "ACCEPT", source: "local", reason: "approved-variant", matchedVariant: approved };
    if (typeof rule.accept === "function") {
      try {
        var accepted = Boolean(rule.accept(text));
        if (traceState) traceState.customAcceptResult = accepted;
        if (accepted) return { verdict: "ACCEPT", source: "local", reason: "goal-pattern", matchedVariant: String(text) };
      } catch (_) {
        if (traceState) traceState.customAcceptResult = "error";
        /* A malformed optional pattern remains UNKNOWN. */
      }
    } else if (traceState) {
      traceState.customAcceptResult = null;
    }
    if (rule.dictionary && window.WordDictionaryDatabase && typeof WordDictionaryDatabase.match === "function") {
      var canonical = WordDictionaryDatabase.match(rule.dictionary.dictionaryId, text);
      if (canonical === rule.dictionary.canonical) {
        return { verdict: "ACCEPT", source: "dictionary", reason: "dictionary-canonical", matchedVariant: canonical };
      }
      if (canonical) return { verdict: "REJECT", source: "dictionary", reason: "different-canonical", matchedVariant: canonical };
    }
    return null;
  }

  function evaluate(input, rules) {
    var rule = (rules || []).filter(function (item) { return item.conceptId === input.conceptId; })[0];
    var isS005 = input && input.context && typeof input.context.poolId === "string" &&
      input.context.poolId.indexOf("s005.communication.") === 0;
    var traceState = { variantMatch: false, customAcceptResult: null };
    function finish(value) {
      if (isS005) console.log("[S005 RULE TRACE] local-evaluate", {
        conceptId: input.conceptId,
        normalizedTranscript: normalize(input.utterance),
        ruleFound: Boolean(rule),
        variantMatch: traceState.variantMatch,
        customAcceptResult: traceState.customAcceptResult,
        localVerdict: value.verdict,
        localReason: value.reason
      });
      return value;
    }
    if (!rule) return finish({ verdict: "UNKNOWN", source: "fallback", reason: "rule-not-found", matchedVariant: null });
    if (!difficultyMatches(rule, input.difficulty)) {
      return finish({ verdict: "UNKNOWN", source: "fallback", reason: "difficulty-not-covered", matchedVariant: null });
    }
    var primary = evaluateCandidate(rule, input.utterance, traceState);
    if (primary) return finish(primary);
    var alternatives = Array.isArray(input.alternatives) ? input.alternatives : [];
    for (var i = 0; i < alternatives.length; i += 1) {
      var alternative = evaluateCandidate(rule, alternatives[i]);
      if (alternative && alternative.verdict === "ACCEPT") return finish(alternative);
    }
    return finish({ verdict: "UNKNOWN", source: "fallback", reason: "local-miss", matchedVariant: null });
  }

  window.LocalCommunicativeJudge = {
    normalize: normalize,
    validateRules: validateRules,
    evaluate: evaluate
  };
})();
