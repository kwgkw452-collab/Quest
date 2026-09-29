(function () {
  "use strict";

  var entries = [];
  var sequence = 0;
  var sessionSequence = 0;
  var latestInviteContext = null;

  function now() {
    if (window.performance && typeof window.performance.now === "function") {
      return window.performance.now();
    }
    return Date.now();
  }

  function begin(detail) {
    detail = detail || {};
    var context = {
      sessionId: "legacy-speech-" + String(++sessionSequence),
      startedAt: now(),
      questionId: detail.questionId || null,
      storyId: detail.storyId || null,
      speechMode: "legacy",
      runtime: detail.runtime || "legacy",
      monsterId: detail.monsterId || null,
      runId: detail.runId === undefined ? null : detail.runId,
      attempt: 0
    };
    if (context.questionId === "phrase.come_with_us") latestInviteContext = context;
    return context;
  }

  function record(context, eventName, detail) {
    if (!context) return null;
    var timestampMs = now();
    var entry = Object.assign({
      sequence: ++sequence,
      event: eventName,
      timestampMs: timestampMs,
      elapsedMs: timestampMs - context.startedAt,
      sessionId: context.sessionId,
      questionId: context.questionId,
      storyId: context.storyId,
      speechMode: context.speechMode,
      runtime: context.runtime,
      monsterId: context.monsterId,
      runId: context.runId,
      attempt: context.attempt,
      attemptElapsedMs: context.attemptStartedAt === undefined ? null : timestampMs - context.attemptStartedAt
    }, detail || {});
    entries.push(entry);
    return entry;
  }

  function recordInvite(context, eventName, detail) {
    context = context || latestInviteContext;
    if (!context || context.questionId !== "phrase.come_with_us") return null;
    if (latestInviteContext && context.sessionId === latestInviteContext.sessionId) context = latestInviteContext;
    return record(context, eventName, detail);
  }

  function startAttempt(context) {
    if (!context) return null;
    context.attempt += 1;
    var attemptContext = Object.assign({}, context);
    attemptContext.attemptStartedAt = now();
    if (attemptContext.questionId === "phrase.come_with_us") latestInviteContext = attemptContext;
    record(attemptContext, "legacy-speech-start");
    return attemptContext;
  }

  function clear() {
    entries.length = 0;
    sequence = 0;
    latestInviteContext = null;
  }

  function getEntries() {
    return entries.slice();
  }

  function table() {
    if (window.console && typeof console.table === "function") console.table(entries);
    return getEntries();
  }

  window.__LEGACY_SPEECH_TRACE__ = entries;
  window.LegacySpeechTrace = {
    begin: begin,
    record: record,
    recordInvite: recordInvite,
    startAttempt: startAttempt,
    clear: clear,
    getEntries: getEntries,
    table: table
  };
})();
