(function () {
  "use strict";
  var pendingKey = "eigo-de-quest.communication-runtime-v1.pending-observations";
  var pendingUnknownKey = "eigo-de-quest.communication-runtime-v1.pending-unresolved-unknowns";

  function cleanCandidate(value) {
    if (!value || typeof value !== "object") return null;
    if (typeof value.slotId === "string" && Object.prototype.hasOwnProperty.call(value, "value")) {
      return { slotId: value.slotId, value: value.value };
    }
    if (typeof value.conceptId === "string") return { conceptId: value.conceptId };
    if (typeof value.token === "string") return { token: value.token };
    return null;
  }
  function cleanObservation(value) {
    var candidate = cleanCandidate(value && value.candidate);
    var taskId = value && typeof value.taskId === "string" ? value.taskId.trim() : "";
    var rawExpression = value && typeof value.rawExpression === "string" ? value.rawExpression.trim() : "";
    if (!candidate || !taskId || !rawExpression || taskId.length > 200 || rawExpression.length > 500) return null;
    return { taskId: taskId, rawExpression: rawExpression, candidate: candidate };
  }
  function stableCandidateKey(value) {
    var clean = cleanObservation(value);
    if (!clean) return null;
    return JSON.stringify([clean.taskId, clean.rawExpression.toLowerCase(), clean.candidate.slotId || "",
      Object.prototype.hasOwnProperty.call(clean.candidate, "value") ? clean.candidate.value : null,
      clean.candidate.conceptId || "", clean.candidate.token || ""]);
  }
  function cleanUnresolvedUnknown(value) {
    var taskId = value && typeof value.taskId === "string" ? value.taskId.trim() : "";
    var rawTranscript = value && typeof value.rawTranscript === "string" ? value.rawTranscript.trim() : "";
    var unknownReason = value && typeof value.unknownReason === "string" ? value.unknownReason.trim() : "";
    var reasonSlotId = value && typeof value.reasonSlotId === "string" ? value.reasonSlotId.trim() : null;
    if (!taskId || !rawTranscript || !unknownReason || taskId.length > 200 || rawTranscript.length > 500 || unknownReason.length > 100) return null;
    return { taskId: taskId, rawTranscript: rawTranscript, unknownReason: unknownReason, reasonSlotId: reasonSlotId };
  }
  function stableUnknownKey(value) {
    var clean = cleanUnresolvedUnknown(value);
    return clean ? JSON.stringify([clean.taskId, clean.rawTranscript.toLowerCase(), clean.unknownReason, clean.reasonSlotId]) : null;
  }
  function fetchJson(url, options) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("candidate-store-fetch-unavailable"));
    return window.fetch(url, options).then(function (response) {
      if (!response.ok) throw new Error("candidate-store-http-" + response.status);
      return response.json().then(function (payload) {
        if (payload && payload.error) throw new Error("candidate-store-" + payload.error);
        return payload;
      });
    });
  }
  function localProvider(config) {
    function call(path, method, body) {
      var options = { method: method || "GET", headers: { "Content-Type": "application/json" } };
      if (body) options.body = JSON.stringify(body);
      return fetchJson(config.localUrl + path, options);
    }
    return {
      name: "local",
      getCandidates: function () { return call("/candidates", "GET"); },
      recordObservation: function (value) { return call("/observations", "POST", cleanObservation(value)); },
      updateReviewStatus: function (value) { return call("/candidates/review", "PATCH", value); },
      generateTeacherReviewSample: function () { return call("/dev/teacher-review-sample", "POST", {}); },
      getUnresolvedUnknowns: function () { return Promise.resolve({ unresolvedUnknowns: loadPendingUnknowns() }); },
      recordUnresolvedUnknown: function (value) {
        var clean = cleanUnresolvedUnknown(value); if (!clean) return Promise.reject(new Error("invalid-unresolved-unknown"));
        savePendingUnknown(clean); return Promise.resolve({ unresolvedUnknowns: loadPendingUnknowns() });
      },
      updateUnresolvedReviewStatus: function (value) { return Promise.resolve({ unresolvedUnknowns: updatePendingUnknown(value) }); }
    };
  }
  function loadPendingUnknowns() {
    try { var value = JSON.parse(localStorage.getItem(pendingUnknownKey) || "[]"); return Array.isArray(value) ? value : []; }
    catch (error) { return []; }
  }
  function savePendingUnknown(value) {
    try {
      var current = loadPendingUnknowns(), key = stableUnknownKey(value);
      var existing = current.filter(function (item) { return stableUnknownKey(item) === key; })[0];
      if (existing) existing.observationCount = Number(existing.observationCount || 0) + 1;
      else current.push(Object.assign({}, value, { observationCount: 1, reviewStatus: "pending" }));
      localStorage.setItem(pendingUnknownKey, JSON.stringify(current.slice(-50)));
    } catch (error) { /* Optional knowledge collection never blocks gameplay. */ }
  }
  function updatePendingUnknown(value) {
    if (!value || ["reviewed", "ignored"].indexOf(value.reviewStatus) < 0) return loadPendingUnknowns();
    var current = loadPendingUnknowns(), key = stableUnknownKey(value);
    current.forEach(function (item) { if (stableUnknownKey(item) === key) item.reviewStatus = value.reviewStatus; });
    try { localStorage.setItem(pendingUnknownKey, JSON.stringify(current.slice(-50))); } catch (error) { /* optional */ }
    return current;
  }
  function savePending(value) {
    try {
      var current = JSON.parse(localStorage.getItem(pendingKey) || "[]");
      if (!Array.isArray(current)) current = [];
      var key = stableCandidateKey(value);
      if (!current.some(function (item) { return stableCandidateKey(item) === key; })) current.push(cleanObservation(value));
      localStorage.setItem(pendingKey, JSON.stringify(current.slice(-50)));
    } catch (error) { /* Collection failure must never affect gameplay. */ }
  }
  function gasProvider(config) {
    function post(action, field, value) {
      if (!config.gasWebAppUrl) return Promise.reject(new Error("gas-url-not-configured"));
      var payload = { action: action }; payload[field] = value;
      return fetchJson(config.gasWebAppUrl, { method: "POST", redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(payload) });
    }
    return {
      name: "gas",
      getCandidates: function () {
        if (!config.gasWebAppUrl) return Promise.reject(new Error("gas-url-not-configured"));
        return fetchJson(config.gasWebAppUrl + "?action=getCandidates", { method: "GET", redirect: "follow" });
      },
      recordObservation: function (value) {
        var clean = cleanObservation(value);
        if (!clean) return Promise.reject(new Error("invalid-observation"));
        return post("recordObservation", "observation", clean).catch(function (error) { savePending(clean); throw error; });
      },
      updateReviewStatus: function (value) { return post("updateReviewStatus", "update", value); },
      generateTeacherReviewSample: function () { return Promise.reject(new Error("dev-sample-local-only")); },
      getUnresolvedUnknowns: function () {
        if (!config.gasWebAppUrl) return Promise.reject(new Error("gas-url-not-configured"));
        return fetchJson(config.gasWebAppUrl + "?action=getUnresolvedUnknowns", { method: "GET", redirect: "follow" });
      },
      recordUnresolvedUnknown: function (value) {
        var clean = cleanUnresolvedUnknown(value);
        if (!clean) return Promise.reject(new Error("invalid-unresolved-unknown"));
        return post("recordUnresolvedUnknown", "observation", clean).catch(function (error) { savePendingUnknown(clean); throw error; });
      },
      updateUnresolvedReviewStatus: function (value) { return post("updateUnresolvedReviewStatus", "update", value); }
    };
  }
  window.CommunicationCandidateStoreProvider = {
    create: function (config) {
      config = config || {};
      return config.provider === "gas" && config.gasWebAppUrl ? gasProvider(config) : localProvider(config);
    },
    cleanObservation: cleanObservation,
    stableCandidateKey: stableCandidateKey,
    cleanUnresolvedUnknown: cleanUnresolvedUnknown,
    stableUnknownKey: stableUnknownKey
  };
})();
