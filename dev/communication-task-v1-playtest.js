(function () {
  "use strict";
  var taskId = "dev.shop.order.apple.2";
  var retryRunning = false;
  var traceStartedAt = 0;
  var traceEntries = [];
  var tracePanel = null;
  var reviewPanel = null;
  var reviewFilter = "needs_review";
  var showAllCandidates = false;
  var reviewMode = "needs_review";
  var reviewLoadError = null;
  var unresolvedUnknowns = [];
  var dismissedSuggestions = {};
  var candidateStorageKey = "eigo-de-quest.communication-runtime-v1.recognition-candidates";
  var storeProvider = window.CommunicationCandidateStoreProvider.create(window.CommunicationCandidateStoreConfig || {});
  var candidates = [];
  function candidateCopy(value) {
    return { taskId: value.taskId, rawExpression: value.rawExpression,
      candidate: Object.assign({}, value.candidate), observationCount: value.observationCount,
      reviewStatus: value.reviewStatus, promotionStatus: value.promotionStatus || "not_ready" };
  }
  function candidateIdentity(value) {
    var candidate = value.candidate || {};
    return [String(value.taskId || ""), String(value.rawExpression || "").trim().toLowerCase(),
      String(candidate.slotId || ""), String(candidate.value), String(candidate.conceptId || ""), String(candidate.token || "")].join("|");
  }
  function loadCandidates() {
    try {
      var saved = window.localStorage && localStorage.getItem(candidateStorageKey);
      var parsed = saved ? JSON.parse(saved) : [];
      candidates = Array.isArray(parsed) ? parsed.filter(function (value) {
        return value && value.taskId && value.rawExpression && value.candidate &&
          ["pending", "approved", "rejected"].indexOf(value.reviewStatus) !== -1;
      }).map(candidateCopy) : [];
    } catch (error) { candidates = []; }
  }
  function saveCandidates() {
    try {
      if (window.localStorage) localStorage.setItem(candidateStorageKey, JSON.stringify(candidates));
    } catch (error) { /* Dev storage may be unavailable under file://. */ }
  }
  function applyCentralCandidates(items) {
    if (!Array.isArray(items)) return;
    candidates = items.map(candidateCopy);
    saveCandidates(); renderReview();
  }
  function centralRequest(path, method, body) {
    var request;
    if (path === "/candidates") request = storeProvider.getCandidates();
    else if (path === "/observations") request = storeProvider.recordObservation(body);
    else if (path === "/candidates/review") request = storeProvider.updateReviewStatus(body);
    else if (path === "/dev/teacher-review-sample") request = storeProvider.generateTeacherReviewSample();
    else request = Promise.reject(new Error("unknown-store-operation"));
    return request.then(function (payload) {
      applyCentralCandidates(payload.candidates); return payload.candidates || [];
    });
  }
  function traceStoreFailure() {
    if (window.CommunicationTaskV1Trace && typeof CommunicationTaskV1Trace.record === "function") {
      CommunicationTaskV1Trace.record("candidate-store-send-failed");
    }
  }
  function syncCentral() { return centralRequest("/candidates", "GET").catch(function () { return candidates.map(candidateCopy); }); }
  function unknownCopy(value) {
    return { taskId: value.taskId, rawTranscript: value.rawTranscript, unknownReason: value.unknownReason,
      reasonSlotId: value.reasonSlotId || null, observationCount: Number(value.observationCount || 0), reviewStatus: value.reviewStatus || "pending" };
  }
  function unknownKey(value) {
    return [String(value.taskId || ""), String(value.rawTranscript || "").trim().toLowerCase(), String(value.unknownReason || ""),
      String(value.reasonSlotId || "")].join("|");
  }
  function applyUnresolvedUnknowns(items) {
    if (!Array.isArray(items)) return;
    unresolvedUnknowns = items.map(unknownCopy); renderReview();
  }
  function syncUnresolvedUnknowns() {
    return storeProvider.getUnresolvedUnknowns().then(function (payload) {
      applyUnresolvedUnknowns(payload.unresolvedUnknowns); return unresolvedUnknowns.map(unknownCopy);
    }).catch(function () { return unresolvedUnknowns.map(unknownCopy); });
  }
  function observeUnresolvedResult(result) {
    if (!result || result.status !== "UNKNOWN" || !result.transcript || !result.judgeResult || result.judgeResult.candidate) return null;
    var value = { taskId: String(result.taskId || ""), rawTranscript: String(result.transcript),
      unknownReason: String(result.judgeResult.reason || "unknown_expression"), reasonSlotId: result.judgeResult.reasonSlotId || null };
    var key = unknownKey(value), existing = unresolvedUnknowns.filter(function (item) { return unknownKey(item) === key; })[0];
    if (existing) existing.observationCount += 1;
    else { existing = Object.assign({}, value, { observationCount: 1, reviewStatus: "pending" }); unresolvedUnknowns.push(existing); }
    renderReview();
    storeProvider.recordUnresolvedUnknown(value).then(function (payload) { applyUnresolvedUnknowns(payload.unresolvedUnknowns); }).catch(traceStoreFailure);
    return unknownCopy(existing);
  }
  function updateUnresolved(value, status) {
    if (["reviewed", "ignored"].indexOf(status) < 0) return null;
    var existing = unresolvedUnknowns.filter(function (item) { return unknownKey(item) === unknownKey(value); })[0];
    if (!existing) return null;
    existing.reviewStatus = status; renderReview();
    storeProvider.updateUnresolvedReviewStatus(Object.assign({}, value, { reviewStatus: status }))
      .then(function (payload) { applyUnresolvedUnknowns(payload.unresolvedUnknowns); }).catch(traceStoreFailure);
    return unknownCopy(existing);
  }
  function unresolvedQueue(includeAll) {
    var items = unresolvedUnknowns.filter(function (value) { return value.reviewStatus === "pending"; }).sort(function (left, right) {
      return right.observationCount - left.observationCount || unknownKey(left).localeCompare(unknownKey(right));
    });
    return { total: items.length, visible: (includeAll ? items : items.slice(0, 20)).map(unknownCopy) };
  }
  function normalizeWords(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9']+/g, " ").trim().split(/\s+/).filter(Boolean);
  }
  function editDistance(left, right) {
    var previous = [], current = [], i, j;
    for (j = 0; j <= right.length; j += 1) previous[j] = j;
    for (i = 1; i <= left.length; i += 1) {
      current = [i];
      for (j = 1; j <= right.length; j += 1) {
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
          previous[j - 1] + (left.charAt(i - 1) === right.charAt(j - 1) ? 0 : 1));
      }
      previous = current;
    }
    return previous[right.length];
  }
  function candidateLabel(candidate) {
    if (Object.prototype.hasOwnProperty.call(candidate, "value")) return candidate.slotId + " = " + candidate.value;
    if (candidate.conceptId) return "item = " + candidate.conceptId;
    return "token = " + candidate.token;
  }
  function suggestionIdentity(value, candidate) {
    return unknownKey(value) + "|" + JSON.stringify(candidate);
  }
  function requiredEntry(task, slotId) {
    return (task.requiredInformation || []).filter(function (entry) { return entry.slotId === slotId; })[0] || null;
  }
  function applicableKnowledge(taskId) {
    var task = window.CommunicationTaskSpecDatabase && CommunicationTaskSpecDatabase.get(taskId);
    var requiredConcept = task && requiredEntry(task, "item");
    var requiredSlots = task ? (task.requiredInformation || []).map(function (entry) { return entry.slotId; }) : [];
    var formal = formalEntries().filter(function (entry) {
      return entry.scope && ((entry.scope.type === "task" && entry.scope.id === taskId) ||
        (entry.scope.type === "slot" && requiredSlots.indexOf(entry.scope.id) >= 0) ||
        (entry.scope.type === "concept" && requiredConcept && entry.scope.id === requiredConcept.conceptId));
    });
    var approved = candidates.filter(function (value) { return value.taskId === taskId && value.reviewStatus === "approved"; }).map(function (value) {
      return { scope: { type: "task", id: taskId }, match: value.rawExpression, candidate: Object.assign({}, value.candidate), approvedHistory: true };
    });
    return formal.concat(approved);
  }
  function preferredKnowledge(words, knowledge) {
    var priority = { slot: 1, concept: 2, task: 3 }, grouped = {};
    knowledge.forEach(function (entry) {
      var match = String(entry.match || "").toLowerCase();
      if (words.indexOf(match) < 0) return;
      grouped[match] = grouped[match] || [];
      grouped[match].push(entry);
    });
    return Object.keys(grouped).reduce(function (all, match) {
      var highest = Math.max.apply(null, grouped[match].map(function (entry) { return priority[entry.scope.type] || 0; }));
      return all.concat(grouped[match].filter(function (entry) { return (priority[entry.scope.type] || 0) === highest; }));
    }, []);
  }
  function gateReason(value, task, words, knowledge) {
    var text = " " + words.join(" ") + " ";
    if (/\b(?:don't|dont|do not|not|never|cannot|can't|wont|won't|no)\b/.test(text)) return "negation";
    if (/\b(?:did you say|do you mean|so you want|he wants|she wants|they want)\b/.test(text)) return "different-speech-act";
    var quantities = { one: 1, "1": 1, two: 2, "2": 2, three: 3, "3": 3, four: 4, "4": 4 };
    var requiredQuantity = requiredEntry(task, "quantity");
    var explicitQuantity = words.map(function (word) { return quantities[word]; }).filter(function (number) { return number !== undefined; });
    if (requiredQuantity && explicitQuantity.some(function (number) { return number !== requiredQuantity.value; })) return "quantity-contradiction";
    var requiredItem = requiredEntry(task, "item"), itemConflict = false;
    if (window.CommunicationConceptCatalog && requiredItem) CommunicationConceptCatalog.all().forEach(function (concept) {
      if (concept.conceptId !== requiredItem.conceptId && concept.forms.some(function (form) { return words.indexOf(form.text.toLowerCase()) >= 0; })) itemConflict = true;
    });
    if (itemConflict) return "item-contradiction";
    if (words.indexOf("airport") >= 0 || words.indexOf("question") >= 0) return "alternate-meaning";
    var matched = preferredKnowledge(words, knowledge);
    var byMatch = {};
    matched.forEach(function (entry) {
      var key = String(entry.match).toLowerCase();
      byMatch[key] = byMatch[key] || {};
      byMatch[key][JSON.stringify(entry.candidate || {})] = true;
    });
    if (Object.keys(byMatch).some(function (key) { return Object.keys(byMatch[key]).length > 1; })) return "recognition-conflict";
    return null;
  }
  function localSuggestions(value) {
    if (!value || value.reviewStatus !== "pending" || Number(value.observationCount || 0) < 2) return [];
    var task = window.CommunicationTaskSpecDatabase && CommunicationTaskSpecDatabase.get(value.taskId);
    if (!task || task.action !== "order.request") return [];
    var words = normalizeWords(value.rawTranscript), knowledge = applicableKnowledge(value.taskId);
    if (gateReason(value, task, words, knowledge)) return [];
    var suggestions = [], seen = {};
    function add(rawExpression, candidate, reason) {
      var id = String(rawExpression).toLowerCase() + "|" + JSON.stringify(candidate);
      if (!seen[id] && !dismissedSuggestions[suggestionIdentity(value, candidate)]) {
        seen[id] = true; suggestions.push({ rawExpression: rawExpression, candidate: Object.assign({}, candidate), reason: reason });
      }
    }
    preferredKnowledge(words, knowledge).forEach(function (entry) {
      add(String(entry.match), entry.candidate, entry.approvedHistory ? "同じTaskのapproved履歴" : "Task固有・正式Recognition Knowledge");
    });
    var item = requiredEntry(task, "item"), concept = window.CommunicationConceptCatalog && item && CommunicationConceptCatalog.get(item.conceptId);
    if (concept) concept.forms.forEach(function (form) {
      var matchedWord = words.filter(function (word) { return editDistance(word, form.text.toLowerCase()) <= (form.text.length >= 5 ? 2 : 1); })[0];
      if (matchedWord) add(matchedWord, { conceptId: concept.conceptId }, "TaskSpecのitemとConcept formに近い表現");
    });
    var quantity = requiredEntry(task, "quantity"), quantityForms = { 1: ["one", "1"], 2: ["two", "2"], 3: ["three", "3"] };
    if (quantity) (quantityForms[quantity.value] || []).forEach(function (form) {
      var matchedWord = words.filter(function (word) { return editDistance(word, form) <= 1; })[0];
      if (matchedWord) add(matchedWord, { slotId: "quantity", value: quantity.value }, "TaskSpecのquantity formに近い表現");
    });
    return suggestions.slice(0, 3);
  }
  function registerSuggestion(value, suggestion) {
    var payload = { taskId: value.taskId, rawExpression: suggestion.rawExpression, candidate: Object.assign({}, suggestion.candidate) };
    var remotePromise = null;
    var recorded = CommunicationRecognitionCandidateStore.recordObservation(payload, function (promise) { remotePromise = promise; });
    dismissedSuggestions[suggestionIdentity(value, suggestion.candidate)] = true;
    renderReview();
    return Promise.resolve(remotePromise).then(syncCentral).then(function () { return recorded; }).catch(function () { return recorded; });
  }
  function dismissSuggestion(value, suggestion) {
    dismissedSuggestions[suggestionIdentity(value, suggestion.candidate)] = true;
    renderReview();
  }
  function addLocalUnknown(value, count) {
    var copy = unknownCopy(Object.assign({}, value, { observationCount: count, reviewStatus: "pending" }));
    var existing = unresolvedUnknowns.filter(function (item) { return unknownKey(item) === unknownKey(copy); })[0];
    if (existing) existing.observationCount += count; else unresolvedUnknowns.push(copy);
  }
  function generateSuggestionSamples() {
    addLocalUnknown({ taskId: "dev.shop.order.apple.2", rawTranscript: "I want tu aple.", unknownReason: "missing_information", reasonSlotId: null }, 12);
    addLocalUnknown({ taskId: "dev.shop.order.apple.2", rawTranscript: "I don't want two apples.", unknownReason: "unknown_expression", reasonSlotId: null }, 5);
    addLocalUnknown({ taskId: "dev.shop.order.apple.2", rawTranscript: "I want four apples.", unknownReason: "quantity_mismatch", reasonSlotId: "quantity" }, 4);
    renderReview();
  }
  function renderUnresolvedReview() {
    var reload = document.createElement("button"); reload.type = "button"; reload.textContent = "Reload Unresolved UNKNOWN";
    reload.addEventListener("click", syncUnresolvedUnknowns); reviewPanel.appendChild(reload);
    var sample = document.createElement("button"); sample.type = "button"; sample.textContent = "Generate Phase 9 Suggestion Samples";
    sample.addEventListener("click", generateSuggestionSamples); reviewPanel.appendChild(sample);
    var queue = unresolvedQueue(showAllCandidates);
    var count = document.createElement("div"); count.textContent = "Unresolved UNKNOWN: " + queue.visible.length + " / " + queue.total; reviewPanel.appendChild(count);
    queue.visible.forEach(function (value) {
      var row = document.createElement("div"); row.style.cssText = "margin-top:8px;padding-top:6px;border-top:1px solid #777";
      var detail = document.createElement("div");
      detail.textContent = (value.observationCount > 1 ? "FREQUENT" : "LOW_PRIORITY") + " | Task: " + taskSummary(value.taskId) +
        " | ID: " + value.taskId + " | Raw: " + value.rawTranscript + " | Reason: " + value.unknownReason +
        " | Slot: " + (value.reasonSlotId || "-") + " | Observations: " + value.observationCount + " | Review: " + value.reviewStatus;
      row.appendChild(detail);
      var ignore = document.createElement("button"); ignore.type = "button"; ignore.textContent = "Ignore";
      ignore.addEventListener("click", function () { updateUnresolved(value, "ignored"); }); row.appendChild(ignore);
      var reviewed = document.createElement("button"); reviewed.type = "button"; reviewed.textContent = "Mark Reviewed";
      reviewed.addEventListener("click", function () { updateUnresolved(value, "reviewed"); }); row.appendChild(reviewed);
      var suggestionTitle = document.createElement("div"); suggestionTitle.textContent = "Suggested Candidates:"; row.appendChild(suggestionTitle);
      var suggestions = localSuggestions(value);
      if (!suggestions.length) {
        var empty = document.createElement("div"); empty.textContent = "提案なし（頻度またはSuggestion Gate）"; row.appendChild(empty);
      }
      suggestions.forEach(function (suggestion) {
        var proposal = document.createElement("div"); proposal.textContent = suggestion.rawExpression + " → " + candidateLabel(suggestion.candidate) + " | " + suggestion.reason;
        var register = document.createElement("button"); register.type = "button"; register.textContent = "候補として登録";
        register.addEventListener("click", function () { registerSuggestion(value, suggestion); }); proposal.appendChild(register);
        var dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.textContent = "提案を却下";
        dismiss.addEventListener("click", function () { dismissSuggestion(value, suggestion); }); proposal.appendChild(dismiss);
        row.appendChild(proposal);
      });
      reviewPanel.appendChild(row);
    });
    var showAll = document.createElement("button"); showAll.type = "button"; showAll.textContent = "Show All";
    showAll.addEventListener("click", function () { showAllCandidates = true; renderReview(); }); reviewPanel.appendChild(showAll);
  }
  function dictionaryEntry(value) {
    return { scope: { type: "task", id: value.taskId }, match: value.rawExpression,
      candidate: Object.assign({}, value.candidate) };
  }
  function formalEntries() {
    return window.CommunicationRecognitionDictionary && typeof CommunicationRecognitionDictionary.all === "function" ?
      CommunicationRecognitionDictionary.all() : [];
  }
  function sameExpression(left, right) {
    return left.taskId === right.taskId && String(left.rawExpression).trim().toLowerCase() === String(right.rawExpression).trim().toLowerCase();
  }
  function validPromotionCandidate(value) {
    if (!value || value.reviewStatus !== "approved" || !value.taskId || !String(value.rawExpression || "").trim()) return false;
    if (!window.CommunicationRecognitionDictionary || typeof CommunicationRecognitionDictionary.validate !== "function" ||
        CommunicationRecognitionDictionary.validate([dictionaryEntry(value)]).length) return false;
    var identity = candidateIdentity(value);
    var candidateConflict = candidates.some(function (entry) {
      return entry !== value && sameExpression(entry, value) && candidateIdentity(entry) !== identity;
    });
    if (candidateConflict) return false;
    return !formalEntries().some(function (entry) {
      return entry.scope && entry.scope.type === "task" && entry.scope.id === value.taskId &&
        String(entry.match).trim().toLowerCase() === String(value.rawExpression).trim().toLowerCase();
    });
  }
  function isFormallyPromoted(value) {
    var identity = candidateIdentity(value);
    return formalEntries().some(function (entry) {
      return candidateIdentity({ taskId: entry.scope && entry.scope.id, rawExpression: entry.match,
        candidate: entry.candidate || {} }) === identity;
    });
  }
  function promotionStatus(value) {
    if (isFormallyPromoted(value)) return "promoted";
    return value.promotionStatus === "ready" && validPromotionCandidate(value) ? "ready" : "not_ready";
  }
  function promotionExport() {
    return candidates.filter(function (value) { return promotionStatus(value) === "ready"; }).map(dictionaryEntry);
  }
  function queueCategory(value) {
    var identity = candidateIdentity(value);
    var conflict = candidates.some(function (entry) {
      return entry !== value && sameExpression(entry, value) && candidateIdentity(entry) !== identity;
    });
    if (conflict) return "CONFLICT";
    if (value.observationCount > 1) return "FREQUENT";
    var task = window.CommunicationTaskSpecDatabase && CommunicationTaskSpecDatabase.get(value.taskId);
    var requiredQuantity = task && (task.requiredInformation || []).filter(function (entry) { return entry.slotId === "quantity"; })[0];
    if (value.candidate && value.candidate.slotId === "quantity" && requiredQuantity && value.candidate.value === requiredQuantity.value) {
      return "SAFE_REVIEW";
    }
    return "LOW_PRIORITY";
  }
  function reviewQueue(filter, includeAll) {
    var priority = { CONFLICT: 0, FREQUENT: 1, SAFE_REVIEW: 2, LOW_PRIORITY: 3 };
    var items = candidates.map(function (value) {
      var copy = candidateCopy(value); copy.promotionStatus = promotionStatus(value); copy.queueCategory = queueCategory(value); return copy;
    }).filter(function (value) {
      if (filter === "all") return true;
      var reviewed = value.reviewStatus !== "pending" || value.promotionStatus === "promoted" || value.promotionStatus === "ready";
      if (filter === "reviewed") return reviewed;
      if (reviewed) return false;
      if (filter === "conflict") return value.queueCategory === "CONFLICT";
      if (filter === "frequent") return value.queueCategory === "FREQUENT";
      if (filter === "safe") return value.queueCategory === "SAFE_REVIEW";
      return value.reviewStatus === "pending";
    }).sort(function (left, right) {
      return priority[left.queueCategory] - priority[right.queueCategory] ||
        right.observationCount - left.observationCount || candidateIdentity(left).localeCompare(candidateIdentity(right));
    });
    return { total: items.length, visible: (includeAll ? items : items.slice(0, 20)).map(candidateCopyWithQueue) };
  }
  function candidateCopyWithQueue(value) {
    var copy = candidateCopy(value); copy.queueCategory = value.queueCategory; return copy;
  }
  function taskSummary(taskId) {
    var task = window.CommunicationTaskSpecDatabase && CommunicationTaskSpecDatabase.get(taskId);
    if (!task) return taskId;
    var item = (task.requiredInformation || []).filter(function (entry) { return entry.slotId === "item"; })[0];
    var quantity = (task.requiredInformation || []).filter(function (entry) { return entry.slotId === "quantity"; })[0];
    var itemName = item && item.conceptId ? item.conceptId.split(".").pop() : "item";
    itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
    var actionName = String(task.action || "").split(".")[0];
    actionName = actionName.charAt(0).toUpperCase() + actionName.slice(1);
    function title(value) { value = String(value || ""); return value.charAt(0).toUpperCase() + value.slice(1); }
    return title(task.situation) + " / " + title(task.speakerRole) + " / " + actionName + " / " + itemName + " / " +
      (quantity ? quantity.value : "-");
  }
  function summaryCounts() {
    var all = reviewQueue("all", true).visible;
    function reviewed(value) { return value.reviewStatus !== "pending" || value.promotionStatus === "ready" || value.promotionStatus === "promoted"; }
    return {
      needsReview: all.filter(function (value) { return !reviewed(value); }).length,
      conflict: all.filter(function (value) { return !reviewed(value) && value.queueCategory === "CONFLICT"; }).length,
      frequent: all.filter(function (value) { return !reviewed(value) && value.queueCategory === "FREQUENT"; }).length,
      safe: all.filter(function (value) { return !reviewed(value) && value.queueCategory === "SAFE_REVIEW"; }).length,
      reviewed: all.filter(reviewed).length
    };
  }
  function generateTeacherReviewSample() {
    addSampleObservations();
  }
  function addSampleObservations() {
    var samples = [
      [{ taskId: "dev.shop.order.orange.3", rawExpression: "thlee", candidate: { slotId: "quantity", value: 3 } }, 12],
      [{ taskId: "dev.shop.order.banana.1", rawExpression: "won", candidate: { slotId: "quantity", value: 1 } }, 5],
      [{ taskId: "dev.shop.order.banana.3", rawExpression: "single", candidate: { slotId: "quantity", value: 1 } }, 1],
      [{ taskId: "dev.shop.order.apple.2", rawExpression: "tuu", candidate: { slotId: "quantity", value: 2 } }, 3],
      [{ taskId: "dev.shop.order.apple.2", rawExpression: "tuu", candidate: { slotId: "quantity", value: 3 } }, 2]
    ];
    samples.forEach(function (sample) {
      for (var index = 0; index < sample[1]; index += 1) CommunicationRecognitionCandidateStore.observe(sample[0]);
    });
    addLocalUnknown({ taskId: "dev.shop.order.apple.2", rawTranscript: "local sample unknown",
      unknownReason: "unknown_expression", reasonSlotId: null }, 2);
    renderReview();
  }
  function simulateOneHundredCentralObservations() {
    var observation = { taskId: "dev.shop.order.orange.3", rawExpression: "central-hundred",
      candidate: { slotId: "quantity", value: 3 } };
    var sends = [];
    for (var index = 0; index < 100; index += 1) {
      CommunicationRecognitionCandidateStore.observe(observation);
      sends.push(centralRequest("/observations", "POST", observation).catch(function () { traceStoreFailure(); return null; }));
    }
    Promise.all(sends).then(syncCentral);
  }
  function comparisonRaw(value) {
    return String(value || "").toLowerCase().trim().replace(/[.,!?;:]+/g, "").replace(/\s+/g, " ");
  }
  function phase10CandidateBody(candidate) {
    if (candidate && typeof candidate.conceptId === "string") return { type: "concept", body: { conceptId: candidate.conceptId } };
    if (candidate && typeof candidate.slotId === "string" && Object.prototype.hasOwnProperty.call(candidate, "value")) {
      return { type: "slot", body: { slotId: candidate.slotId, value: candidate.value } };
    }
    return { type: "token", body: { token: candidate && candidate.token } };
  }
  function phase10CandidateKey(value) {
    var typed = phase10CandidateBody(value.candidate);
    return [String(value.taskId || ""), comparisonRaw(value.rawExpression), typed.type, JSON.stringify(typed.body)].join("|");
  }
  function phase10Status(value) {
    if (value.promotionStatus === "promoted" || isFormallyPromoted(value)) return "promoted";
    if (value.promotionStatus === "ready") return "ready";
    if (value.reviewStatus === "approved") return "approved";
    if (value.reviewStatus === "rejected") return "rejected";
    return "pending";
  }
  function mergePhase10Status(statuses) {
    var hasRejected = statuses.indexOf("rejected") >= 0;
    var incompatible = hasRejected && ["approved", "ready", "promoted"].some(function (status) { return statuses.indexOf(status) >= 0; });
    if (incompatible) return { status: "conflict", incompatible: true };
    for (var index = 0, order = ["promoted", "ready", "approved", "rejected", "pending"]; index < order.length; index += 1) {
      if (statuses.indexOf(order[index]) >= 0) return { status: order[index], incompatible: false };
    }
    return { status: "pending", incompatible: false };
  }
  function buildPhase10Model(candidateSource, unknownSource) {
    var candidateGroups = {}, rawGroups = {};
    (candidateSource || []).forEach(function (source) {
      var value = candidateCopy(source), key = phase10CandidateKey(value), status = phase10Status(value);
      if (!candidateGroups[key]) candidateGroups[key] = { kind: "candidate", key: key, taskId: value.taskId,
        comparisonRaw: comparisonRaw(value.rawExpression), rawExpression: value.rawExpression, candidate: value.candidate,
        observationCount: 0, statuses: [], members: [] };
      var group = candidateGroups[key];
      group.observationCount = Math.max(group.observationCount, Number(value.observationCount || 0));
      if (group.statuses.indexOf(status) < 0) group.statuses.push(status);
      group.members.push(value);
    });
    Object.keys(candidateGroups).forEach(function (key) {
      var group = candidateGroups[key], merged = mergePhase10Status(group.statuses);
      group.status = merged.status; group.incompatible = merged.incompatible;
      var rawKey = group.taskId + "|" + group.comparisonRaw;
      rawGroups[rawKey] = rawGroups[rawKey] || [];
      rawGroups[rawKey].push(group);
    });
    var needs = [], ready = [], history = [], activeRaw = {};
    Object.keys(rawGroups).forEach(function (rawKey) {
      var groups = rawGroups[rawKey], active = groups.filter(function (group) { return group.status !== "rejected"; });
      if (active.length) activeRaw[rawKey] = true;
      var conflict = groups.some(function (group) { return group.incompatible; }) || active.length > 1;
      if (conflict) {
        needs.push({ kind: "candidate-conflict", category: "Conflict", key: "0|" + rawKey,
          taskId: groups[0].taskId, comparisonRaw: groups[0].comparisonRaw, rawExpression: groups[0].rawExpression,
          observationCount: Math.max.apply(null, groups.map(function (group) { return group.observationCount; })), groups: groups });
        return;
      }
      groups.forEach(function (group) {
        if (group.status === "pending" || group.status === "approved") {
          group.category = "Teacher Candidate"; group.key = "1|" + group.key; needs.push(group);
        } else if (group.status === "ready") ready.push(group);
        else history.push(group);
      });
    });
    var pendingUnknownGroups = {};
    (unknownSource || []).forEach(function (source) {
      var value = unknownCopy(source), rawKey = value.taskId + "|" + comparisonRaw(value.rawTranscript);
      if (value.reviewStatus === "reviewed" || value.reviewStatus === "ignored") {
        history.push({ kind: "unknown", key: "history|" + rawKey + "|" + value.reviewStatus, status: value.reviewStatus,
          taskId: value.taskId, rawTranscript: value.rawTranscript, observationCount: value.observationCount, value: value });
      } else if (!activeRaw[rawKey]) {
        if (!pendingUnknownGroups[rawKey] || pendingUnknownGroups[rawKey].observationCount < value.observationCount) pendingUnknownGroups[rawKey] = value;
      }
    });
    Object.keys(pendingUnknownGroups).forEach(function (rawKey) {
      var value = pendingUnknownGroups[rawKey], frequent = value.observationCount >= 3;
      needs.push({ kind: "unknown", category: frequent ? "Frequent UNKNOWN" : "Other UNKNOWN",
        key: (frequent ? "2|" : "3|") + rawKey, taskId: value.taskId, rawTranscript: value.rawTranscript,
        observationCount: value.observationCount, value: value });
    });
    function sorted(items) { return items.sort(function (left, right) {
      return right.observationCount - left.observationCount || left.key.localeCompare(right.key);
    }); }
    needs.sort(function (left, right) {
      return Number(left.key.charAt(0)) - Number(right.key.charAt(0)) ||
        right.observationCount - left.observationCount || left.key.localeCompare(right.key);
    });
    return { needsReview: { total: needs.length, visible: needs.slice(0, 20) },
      ready: { total: ready.length, visible: sorted(ready).slice(0, 20) }, history: sorted(history) };
  }
  function appendCandidateOperations(row, group) {
    group.members.forEach(function (value) {
      var status = phase10Status(value), detail = document.createElement("div");
      detail.textContent = "Candidate: " + candidateLabel(value.candidate) + " | Observations: " + value.observationCount +
        " | Review: " + value.reviewStatus + " | Promotion: " + promotionStatus(value);
      row.appendChild(detail);
      if (status === "pending") {
        var approve = document.createElement("button"); approve.type = "button"; approve.textContent = "Approve";
        approve.addEventListener("click", function () { CommunicationRecognitionCandidateStore.review(value, "approved"); }); row.appendChild(approve);
        var reject = document.createElement("button"); reject.type = "button"; reject.textContent = "Reject";
        reject.addEventListener("click", function () { CommunicationRecognitionCandidateStore.review(value, "rejected"); }); row.appendChild(reject);
      } else if (status === "approved") {
        var readyButton = document.createElement("button"); readyButton.type = "button"; readyButton.textContent = "Mark Ready for Promotion";
        readyButton.disabled = !validPromotionCandidate(value);
        readyButton.addEventListener("click", function () { CommunicationRecognitionCandidateStore.markReady(value); }); row.appendChild(readyButton);
      }
    });
  }
  function appendUnknownOperations(row, value) {
    var ignore = document.createElement("button"); ignore.type = "button"; ignore.textContent = "Ignore";
    ignore.addEventListener("click", function () { updateUnresolved(value, "ignored"); }); row.appendChild(ignore);
    var reviewed = document.createElement("button"); reviewed.type = "button"; reviewed.textContent = "Mark Reviewed";
    reviewed.addEventListener("click", function () { updateUnresolved(value, "reviewed"); }); row.appendChild(reviewed);
    var title = document.createElement("div"); title.textContent = "Suggested Candidates:"; row.appendChild(title);
    var suggestions = localSuggestions(value);
    if (!suggestions.length) { var empty = document.createElement("div"); empty.textContent = "提案なし（頻度またはSuggestion Gate）"; row.appendChild(empty); }
    suggestions.forEach(function (suggestion) {
      var proposal = document.createElement("div"); proposal.textContent = suggestion.rawExpression + " → " + candidateLabel(suggestion.candidate) + " | " + suggestion.reason;
      var register = document.createElement("button"); register.type = "button"; register.textContent = "候補として登録";
      register.addEventListener("click", function () { registerSuggestion(value, suggestion); }); proposal.appendChild(register);
      var dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.textContent = "提案を却下";
      dismiss.addEventListener("click", function () { dismissSuggestion(value, suggestion); }); proposal.appendChild(dismiss); row.appendChild(proposal);
    });
  }
  function reloadTeacherReview() {
    reviewLoadError = null;
    return Promise.all([centralRequest("/candidates", "GET"), storeProvider.getUnresolvedUnknowns().then(function (payload) {
      applyUnresolvedUnknowns(payload.unresolvedUnknowns); return unresolvedUnknowns;
    })]).catch(function (error) { reviewLoadError = error && error.message ? error.message : "teacher-review-load-failed"; renderReview(); });
  }
  function renderReview() {
    if (!reviewPanel) return;
    reviewPanel.innerHTML = "";
    var title = document.createElement("div"); title.textContent = "Teacher Recognition Review"; reviewPanel.appendChild(title);
    [["Needs Review", "needs_review"], ["Ready for Promotion", "ready"], ["History", "history"]].forEach(function (mode) {
      var tab = document.createElement("button"); tab.type = "button"; tab.textContent = mode[0];
      tab.addEventListener("click", function () { reviewMode = mode[1]; showAllCandidates = false; renderReview(); }); reviewPanel.appendChild(tab);
    });
    var centralSample = document.createElement("button"); centralSample.type = "button"; centralSample.textContent = "Generate Teacher Review Sample";
    centralSample.addEventListener("click", generateTeacherReviewSample); reviewPanel.appendChild(centralSample);
    var suggestionSample = document.createElement("button"); suggestionSample.type = "button"; suggestionSample.textContent = "Generate Phase 9 Suggestion Samples";
    suggestionSample.addEventListener("click", generateSuggestionSamples); reviewPanel.appendChild(suggestionSample);
    var reloadCentral = document.createElement("button"); reloadCentral.type = "button"; reloadCentral.textContent = "Reload Central Review Queue";
    reloadCentral.addEventListener("click", reloadTeacherReview); reviewPanel.appendChild(reloadCentral);
    if (reviewLoadError) { var errorView = document.createElement("div"); errorView.textContent = "Teacher Review Error: " + reviewLoadError; reviewPanel.appendChild(errorView); }
    var model = buildPhase10Model(candidates, unresolvedUnknowns);
    var queue = reviewMode === "ready" ? model.ready : (reviewMode === "history" ? { total: model.history.length, visible: model.history } : model.needsReview);
    var count = document.createElement("div"); count.textContent = (reviewMode === "history" ? "History" : "Queue") + ": " + queue.visible.length + " / " + queue.total; reviewPanel.appendChild(count);
    queue.visible.forEach(function (value) {
      var row = document.createElement("div");
      row.style.cssText = "margin-top:8px;padding-top:6px;border-top:1px solid #777";
      if (value.kind === "candidate-conflict") row.setAttribute("data-conflict-group", value.taskId + ":" + value.comparisonRaw);
      var summary = document.createElement("div");
      summary.textContent = (value.category || value.status) + " | Task: " + taskSummary(value.taskId) + " | ID: " + value.taskId +
        " | Raw: " + (value.rawExpression || value.rawTranscript);
      row.appendChild(summary);
      if (value.kind === "candidate-conflict") value.groups.forEach(function (group) { appendCandidateOperations(row, group); });
      else if (value.kind === "candidate") appendCandidateOperations(row, value);
      else if (value.status !== "reviewed" && value.status !== "ignored") appendUnknownOperations(row, value.value);
      reviewPanel.appendChild(row);
    });
    if (reviewMode === "ready") {
      var exportTitle = document.createElement("div"); exportTitle.textContent = "Promotion Export"; reviewPanel.appendChild(exportTitle);
      var exportView = document.createElement("pre"); exportView.id = "promotion-export";
      exportView.textContent = JSON.stringify(promotionExport(), null, 2); reviewPanel.appendChild(exportView);
    }
  }
  window.CommunicationRecognitionCandidateStore = {
    observe: function (value) {
      var normalized = candidateCopy({ taskId: String(value.taskId || ""), rawExpression: String(value.rawExpression || "").trim(),
        candidate: value.candidate || {}, observationCount: 1, reviewStatus: "pending", promotionStatus: "not_ready" });
      var identity = candidateIdentity(normalized);
      var existing = candidates.filter(function (entry) { return candidateIdentity(entry) === identity; })[0];
      if (existing) existing.observationCount += 1;
      else candidates.push(normalized);
      saveCandidates(); renderReview();
      return candidateCopy(existing || normalized);
    },
    recordObservation: function (observation, observeRemote) {
      var localResult = this.observe(observation);
      var known = formalEntries().some(function (entry) {
        return entry.scope && entry.scope.type === "task" && entry.scope.id === localResult.taskId &&
          String(entry.match || "").trim().toLowerCase() === localResult.rawExpression.toLowerCase();
      });
      var remotePromise = known ? Promise.resolve(candidates.map(candidateCopy)) : centralRequest("/observations", "POST", observation);
      if (typeof observeRemote === "function") observeRemote(remotePromise);
      remotePromise.catch(traceStoreFailure);
      return localResult;
    },
    review: function (value, status) {
      if (["approved", "rejected"].indexOf(status) === -1) return null;
      var identity = candidateIdentity(value);
      var existing = candidates.filter(function (entry) { return candidateIdentity(entry) === identity; })[0];
      if (!existing) return null;
      existing.reviewStatus = status; existing.promotionStatus = "not_ready";
      saveCandidates(); renderReview();
      centralRequest("/candidates/review", "PATCH", { taskId: existing.taskId, rawExpression: existing.rawExpression,
        candidate: Object.assign({}, existing.candidate), reviewStatus: status }).catch(traceStoreFailure);
      return candidateCopy(existing);
    },
    markReady: function (value) {
      var identity = candidateIdentity(value);
      var existing = candidates.filter(function (entry) { return candidateIdentity(entry) === identity; })[0];
      if (!existing || !validPromotionCandidate(existing)) return null;
      existing.promotionStatus = "ready"; saveCandidates(); renderReview();
      centralRequest("/candidates/review", "PATCH", { taskId: existing.taskId, rawExpression: existing.rawExpression,
        candidate: Object.assign({}, existing.candidate), promotionStatus: "ready" }).catch(traceStoreFailure);
      return candidateCopy(existing);
    },
    all: function () { return candidates.map(function (value) {
      var copy = candidateCopy(value); copy.promotionStatus = promotionStatus(value); return copy;
    }); },
    promotionExport: function () { return promotionExport().map(function (entry) {
      return { scope: Object.assign({}, entry.scope), match: entry.match, candidate: Object.assign({}, entry.candidate) };
    }); },
    reviewQueue: function (filter, includeAll) { return reviewQueue(filter || "needs_review", Boolean(includeAll)); },
    summaryCounts: function () { return summaryCounts(); },
    taskSummary: function (taskId) { return taskSummary(taskId); },
    getAggregatedCandidates: function () { return syncCentral(); },
    approvedDictionaryEntries: function () {
      return candidates.filter(function (value) { return value.reviewStatus === "approved"; }).map(function (value) {
        return { scope: { type: "task", id: value.taskId }, match: value.rawExpression,
          candidate: Object.assign({}, value.candidate) };
      });
    }
  };
  window.CommunicationUnresolvedUnknownStore = {
    observeResult: observeUnresolvedResult,
    all: function () { return unresolvedUnknowns.map(unknownCopy); },
    reviewQueue: function (includeAll) { return unresolvedQueue(Boolean(includeAll)); },
    updateReviewStatus: updateUnresolved,
    getUnresolvedUnknowns: syncUnresolvedUnknowns
  };
  window.CommunicationLocalSuggestionSupport = {
    suggest: function (value) { return localSuggestions(unknownCopy(value)); },
    register: registerSuggestion,
    dismiss: dismissSuggestion,
    generateDevSamples: generateSuggestionSamples
  };
  window.CommunicationTeacherReviewOperations = {
    comparisonRaw: comparisonRaw,
    candidateIdentity: phase10CandidateKey,
    build: function (candidateSource, unknownSource) { return buildPhase10Model(candidateSource || [], unknownSource || []); },
    current: function () { return buildPhase10Model(candidates, unresolvedUnknowns); },
    reload: reloadTeacherReview
  };
  loadCandidates();
  function renderTrace() {
    if (!tracePanel) return;
    tracePanel.textContent = "Trace:\n" + traceEntries.map(function (entry) {
      return entry.elapsedMs + "ms " + entry.text;
    }).join("\n");
  }
  window.CommunicationTaskV1Trace = {
    record: function (name, detail) {
      if (name === "phase1-speech-request") {
        traceStartedAt = Date.now();
        traceEntries = [];
        CommunicationTaskPresenter.showListening();
      }
      var text = name;
      if (name === "speech-error-name" && detail) text += " " + (detail.name || "Error") + (detail.message ? ": " + detail.message : "");
      if (name === "speech-result-transcript" && detail) text += " " + detail.transcript;
      traceEntries.push({ elapsedMs: Math.max(0, Date.now() - traceStartedAt), text: text });
      if (traceEntries.length > 11) traceEntries.shift();
      renderTrace();
    }
  };
  function button(label, action) { return CommunicationTaskPresenter.createControl(label, action); }
  function present(promise) { return promise.then(function (result) {
    observeUnresolvedResult(result); CommunicationTaskPresenter.show(result); renderControls(result); return result;
  }); }
  function disableControls(controls) {
    Array.prototype.forEach.call(controls.querySelectorAll("button"), function (control) { control.disabled = true; });
  }
  function retry(controls) {
    if (retryRunning) return;
    retryRunning = true;
    disableControls(controls);
    CommunicationTaskPresenter.showListening();
    return present(CommunicationTaskProgressController.retry()).finally(function () { retryRunning = false; });
  }
  function renderControls(result) {
    var controls = document.getElementById("controls"); if (!controls) return; CommunicationTaskPresenter.clearControls();
    if (!result || result.status === "CANCELLED" || result.resolution) {
      CommunicationTaskPresenter.appendControl(button("Local Task開始", function () { present(CommunicationTaskProgressController.start(taskId)); }));
    } else {
      CommunicationTaskPresenter.appendControl(button("もう一度話す", function () { retry(controls); }));
    }
    CommunicationTaskPresenter.appendControl(button("終了", function () { CommunicationTaskPresenter.show(CommunicationTaskProgressController.cancel()); }));
  }
  window.CommunicationTaskV1Playtest = {
    start: function () { return present(CommunicationTaskProgressController.start(taskId)); },
    getTaskId: function () { return taskId; }
  };
  window.addEventListener("DOMContentLoaded", function () {
    tracePanel = document.createElement("pre");
    tracePanel.id = "phase1-speech-trace";
    tracePanel.setAttribute("aria-live", "polite");
    tracePanel.style.cssText = "position:absolute;z-index:10010;left:12px;top:12px;max-width:calc(100% - 320px);max-height:42vh;overflow:auto;margin:0;padding:8px;background:rgba(0,0,0,.72);color:#fff;font:12px/1.35 monospace;white-space:pre-wrap";
    tracePanel.textContent = "Trace:\n待機中";
    document.body.appendChild(tracePanel);
    reviewPanel = document.createElement("section");
    reviewPanel.id = "recognition-candidate-review";
    reviewPanel.setAttribute("aria-label", "Recognition Candidate Review");
    reviewPanel.style.cssText = "position:absolute;z-index:10010;left:12px;bottom:12px;width:min(560px,calc(100% - 190px));max-height:38vh;overflow:auto;padding:8px;background:rgba(255,255,255,.94);color:#111;font:12px/1.35 sans-serif";
    document.body.appendChild(reviewPanel);
    renderReview();
    reloadTeacherReview();
    if (window.CommunicationTaskSpecDatabase && typeof CommunicationTaskSpecDatabase.all === "function") {
      var selector = document.createElement("select");
      selector.setAttribute("aria-label", "Communication Task");
      selector.style.cssText = "position:absolute;z-index:10010;right:12px;top:12px;padding:8px;max-width:calc(100% - 24px)";
      CommunicationTaskSpecDatabase.all().forEach(function (task) {
        var option = document.createElement("option"); option.value = task.taskId; option.textContent = task.taskId; selector.appendChild(option);
      });
      selector.value = taskId;
      selector.addEventListener("change", function () { taskId = selector.value; });
      document.body.appendChild(selector);
    }
    var launcher = document.createElement("button"); launcher.type = "button"; launcher.textContent = "話す — Communication Runtime V1";
    launcher.style.cssText = "position:absolute;z-index:10010;right:12px;bottom:12px;padding:8px";
    launcher.addEventListener("click", function () { CommunicationTaskV1Playtest.start(); }); document.body.appendChild(launcher);
  });
})();
