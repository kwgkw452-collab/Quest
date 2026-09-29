(function () {
  "use strict";

  var VERDICTS = ["ACCEPT", "REJECT", "UNKNOWN"];

  function result(input, values) {
    values = values || {};
    return {
      verdict: VERDICTS.indexOf(values.verdict) === -1 ? "UNKNOWN" : values.verdict,
      source: values.source || "fallback",
      reason: values.reason || "judge-unavailable",
      conceptId: input && typeof input.conceptId === "string" ? input.conceptId : null,
      normalizedUtterance: input && typeof input.utterance === "string" ? LocalCommunicativeJudge.normalize(input.utterance) : "",
      matchedVariant: values.matchedVariant || null,
      confidence: typeof values.confidence === "number" ? values.confidence : null,
      retryable: Boolean(values.retryable),
      providerTrace: values.providerTrace || null,
      difficulty: input && input.difficulty !== undefined ? input.difficulty : null,
      context: input && input.context && typeof input.context === "object" && !Array.isArray(input.context) ? input.context : null
    };
  }

  function validateInput(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return "input-not-object";
    if (typeof input.conceptId !== "string" || !input.conceptId.trim()) return "concept-id-required";
    if (typeof input.utterance !== "string" || !input.utterance.trim()) return "utterance-required";
    if (input.alternatives !== undefined && (!Array.isArray(input.alternatives) || input.alternatives.some(function (value) { return typeof value !== "string"; }))) return "invalid-alternatives";
    if (input.acceptedVariants !== undefined && (!Array.isArray(input.acceptedVariants) || input.acceptedVariants.some(function (value) { return typeof value !== "string" || !value.trim(); }))) return "invalid-accepted-variants";
    if (input.difficulty !== undefined && typeof input.difficulty !== "string") return "invalid-difficulty";
    if (input.context !== undefined && (!input.context || typeof input.context !== "object" || Array.isArray(input.context))) return "invalid-context";
    return null;
  }

  function inputRules(input) {
    var rules = (window.CommunicativeJudgeRuleData || []).slice();
    if (!Array.isArray(input.acceptedVariants) || !input.acceptedVariants.length) return rules;
    var found = false;
    rules = rules.map(function (rule) {
      if (rule.conceptId !== input.conceptId) return rule;
      found = true;
      var copy = Object.assign({}, rule);
      copy.variants = (rule.variants || []).concat(input.acceptedVariants);
      return copy;
    });
    if (!found) rules.push({ conceptId: input.conceptId, variants: input.acceptedVariants.slice() });
    return rules;
  }

  function providerFailure(input, reason) {
    return result(input, { verdict: "UNKNOWN", source: "fallback", reason: reason, retryable: true });
  }

  async function judge(input, options) {
    options = options || {};
    var inputError = validateInput(input);
    if (inputError) return result(input, { verdict: "UNKNOWN", source: "fallback", reason: inputError, retryable: false });

    var ruleErrors = LocalCommunicativeJudge.validateRules(inputRules(input));
    if (ruleErrors.length) return result(input, { verdict: "UNKNOWN", source: "fallback", reason: "invalid-local-rules", retryable: false });
    var local = LocalCommunicativeJudge.evaluate(input, inputRules(input));
    if (local.verdict !== "UNKNOWN") return result(input, local);

    var provider = options.provider;
    var isS005 = input && input.context && typeof input.context.poolId === "string" &&
      input.context.poolId.indexOf("s005.communication.") === 0;
    if (isS005) {
      var registry = Array.isArray(window.CommunicativeJudgeRuleData) ? window.CommunicativeJudgeRuleData : [];
      var ruleFound = registry.some(function (candidate) {
        return candidate && candidate.conceptId === input.conceptId;
      });
      console.log("[S005 RULE TRACE] fallback-enter", {
        conceptId: input.conceptId,
        localNotAcceptedBecause: local.reason,
        ruleFound: ruleFound,
        localVerdict: local.verdict,
        localReason: local.reason
      });
    }
    if (!provider || typeof provider.judge !== "function") {
      return result(input, { verdict: "UNKNOWN", source: "fallback", reason: "no-provider", retryable: true });
    }
    try {
      var providerResult = await provider.judge(input);
      if (!providerResult || typeof providerResult !== "object" || VERDICTS.indexOf(providerResult.verdict) === -1) {
        return providerFailure(input, "provider-invalid-result");
      }
      return result(input, {
        verdict: providerResult.verdict,
        source: "provider",
        reason: providerResult.reason || "provider-result",
        matchedVariant: providerResult.matchedVariant,
        confidence: providerResult.confidence,
        retryable: providerResult.retryable,
        providerTrace: providerResult.providerTrace
      });
    } catch (error) {
      var message = error && error.message ? String(error.message).toLowerCase() : "";
      return providerFailure(input, message.indexOf("timeout") !== -1 ? "provider-timeout" : "provider-error");
    }
  }

  window.CommunicativeJudge = {
    judge: judge,
    validateInput: validateInput,
    verdicts: VERDICTS.slice()
  };
})();
