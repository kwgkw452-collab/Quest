(function () {
  "use strict";

  var TRACE_API_VERSION = "DEV_JUMP_RUNTIME_DISPATCH_TRACE_V1";
  var entries = [];
  var operations = Object.create(null);
  var runtimeComponents = Object.create(null);
  var operationSerial = 0;
  var latestOperationId = null;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function timestamp() {
    return new Date().toISOString();
  }

  function currentLocation() {
    if (window.location && window.location.href) return String(window.location.href);
    if (window.document && document.URL) return String(document.URL);
    return null;
  }

  function documentUrl() {
    return window.document && document.URL ? String(document.URL) : currentLocation();
  }

  function devHtmlUrl() {
    try {
      if (window.performance && typeof performance.getEntriesByType === "function") {
        var navigation = performance.getEntriesByType("navigation");
        if (navigation && navigation[0] && navigation[0].name) return String(navigation[0].name);
      }
    } catch (_) {}
    return documentUrl();
  }

  function loadedScriptUrl(suffix) {
    if (!window.document || !document.scripts) return null;
    for (var i = 0; i < document.scripts.length; i += 1) {
      var source = document.scripts[i] && document.scripts[i].src;
      if (!source) continue;
      var clean = String(source).split("#")[0].split("?")[0];
      if (clean.slice(-suffix.length) === suffix) return String(source);
    }
    return null;
  }

  function component(name, scriptSuffix) {
    return {
      url: loadedScriptUrl(scriptSuffix),
      codeId: runtimeComponents[name] || null
    };
  }

  function loadedRuntimeVersion() {
    return {
      traceApiVersion: TRACE_API_VERSION,
      documentUrl: documentUrl(),
      devHtmlUrl: devHtmlUrl(),
      devCheckpoints: component("dev-checkpoints.js", "dev/dev-checkpoints.js"),
      devJumpManager: component("dev-jump-manager.js", "dev/dev-jump-manager.js"),
      devJumpUi: component("dev-jump-ui.js", "dev/dev-jump-ui.js"),
      devJumpRuntimeTrace: component("dev-jump-runtime-trace.js", "dev/dev-jump-runtime-trace.js")
    };
  }

  function append(eventName, operationId, detail) {
    var entry = Object.assign({
      sequence: entries.length + 1,
      event: eventName,
      operationId: operationId || null,
      timestamp: timestamp()
    }, clone(detail || {}));
    entries.push(entry);
    return clone(entry);
  }

  function recordEvent(eventName, detail, operationId) {
    return append(eventName, operationId, detail);
  }

  function beginOperation(clickedCheckpointId, source) {
    operationSerial += 1;
    var operationId = "DEV-JUMP-" + String(operationSerial).padStart(4, "0");
    operations[operationId] = {
      operationId: operationId,
      clickedCheckpointId: String(clickedCheckpointId || ""),
      source: source || "dev-jump-ui-click",
      startedAt: timestamp()
    };
    latestOperationId = operationId;
    append("dev-jump-operation-started", operationId, {
      clickedCheckpointId: operations[operationId].clickedCheckpointId,
      source: operations[operationId].source,
      currentLocation: currentLocation()
    });
    return operationId;
  }

  function recordDispatchSnapshot(operationId, resolvedEntry, dispatchAdapter) {
    var operation = operations[operationId] || null;
    var entry = resolvedEntry ? {
      kind: resolvedEntry.kind || null,
      id: resolvedEntry.id || null
    } : null;
    var targetId = entry && entry.id ? entry.id : null;
    return append("dev-jump-dispatch-snapshot", operationId, {
      clickedCheckpointId: operation ? operation.clickedCheckpointId : null,
      resolvedCheckpointEntry: entry,
      dispatchAdapter: dispatchAdapter || null,
      monsterId: entry && entry.kind === "monster" ? targetId : null,
      storyId: entry && entry.kind === "story" ? targetId : null,
      campId: entry && entry.kind === "camp" ? targetId : null,
      loadedRuntimeVersion: loadedRuntimeVersion(),
      currentLocation: currentLocation()
    });
  }

  function registerRuntimeComponent(name, codeId) {
    runtimeComponents[String(name)] = String(codeId);
  }

  function getEntries() {
    return clone(entries);
  }

  function clear() {
    entries.length = 0;
    operations = Object.create(null);
    operationSerial = 0;
    latestOperationId = null;
  }

  function table() {
    var snapshot = getEntries();
    if (window.console && typeof console.table === "function") console.table(snapshot);
    else if (window.console && typeof console.log === "function") console.log(snapshot);
    return snapshot;
  }

  function getLatestOperationId() {
    return latestOperationId;
  }

  function installMorningObserver() {
    if (!window.MorningManager || typeof MorningManager.start !== "function") return false;
    if (MorningManager.start.__devJumpRuntimeTraceObserved === true) return true;

    var originalStart = MorningManager.start;
    function observedMorningStart(morningId) {
      recordEvent("morning-manager-start-observed", {
        morningId: morningId || null,
        currentLocation: currentLocation(),
        devJumpOperationId: latestOperationId
      }, latestOperationId);
      return originalStart.apply(this, arguments);
    }
    observedMorningStart.__devJumpRuntimeTraceObserved = true;
    observedMorningStart.__devJumpRuntimeTraceOriginal = originalStart;
    MorningManager.start = observedMorningStart;
    return true;
  }

  var api = {
    beginOperation: beginOperation,
    recordDispatchSnapshot: recordDispatchSnapshot,
    recordEvent: recordEvent,
    registerRuntimeComponent: registerRuntimeComponent,
    getLatestOperationId: getLatestOperationId,
    getEntries: getEntries,
    clear: clear,
    table: table
  };

  window.DevJumpRuntimeTrace = api;
  window.__DEV_JUMP_RUNTIME_TRACE__ = api;
  registerRuntimeComponent("dev-jump-runtime-trace.js", "eigo-de-quest/dev-jump-runtime-trace/v1");
  installMorningObserver();
})();
