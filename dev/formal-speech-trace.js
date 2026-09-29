(function () {
  "use strict";

  var entries = [];
  var sequence = 0;

  function now() {
    if (window.performance && typeof window.performance.now === "function") {
      return window.performance.now();
    }
    return Date.now();
  }

  function record(eventName, detail) {
    var entry = Object.assign({
      sequence: ++sequence,
      time: now(),
      event: eventName,
      source: "unknown"
    }, detail || {});
    entries.push(entry);
    console.log("[FormalSpeechTrace]", entry);
    return entry;
  }

  function clear() {
    entries.length = 0;
    sequence = 0;
  }

  function getEntries() {
    return entries.slice();
  }

  function table() {
    console.table(entries);
    return getEntries();
  }

  window.__FORMAL_SPEECH_TRACE__ = entries;
  window.FormalSpeechTrace = {
    record: record,
    clear: clear,
    getEntries: getEntries,
    table: table
  };
})();
