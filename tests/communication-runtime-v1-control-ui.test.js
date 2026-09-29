"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.disabled = false;
    this.className = "";
    this.textContent = "";
    this.style = {};
    this.scrollTop = 0;
    this.rect = { top: 0, bottom: 0 };
    this.value = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(name, listener) {
    this.listeners[name] = listener;
  }

  setAttribute(name, value) {
    this[name] = value;
  }

  click() {
    if (!this.disabled && this.listeners.click) return this.listeners.click();
  }

  querySelectorAll(selector) {
    if (selector !== "button") return [];
    return this.children.filter(child => child.tagName === "button");
  }

  getBoundingClientRect() {
    return this.rect;
  }

  set innerHTML(value) {
    if (value === "") this.children = [];
  }
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function result(status, resolution = null) {
  return {
    taskId: "dev.shop.order.apple.2",
    status,
    transcript: status === "ACCEPT" ? "I want two apples" : "",
    judgeResult: status === "ACCEPT" ? { verdict: "ACCEPT" } : null,
    support: "",
    resolution
  };
}

function setup(providerOverride) {
  const elements = {
    dialogueBox: new Element("section"),
    speaker: new Element("div"),
    message: new Element("div"),
    recognizedText: new Element("div"),
    controls: new Element("div"),
    body: new Element("body")
  };
  elements.dialogueBox.rect = { top: 100, bottom: 300 };
  let domReady;
  let nextStartResult = result("REJECT");
  let retryPlan = deferred();
  let retryCalls = 0;
  let buttonCreates = 0;
  const storage = {};
  const formalDictionaryEntries = [];

  const context = {
    console,
    Promise,
    Array,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); }
    },
    document: {
      body: elements.body,
      createElement: tagName => new Element(tagName),
      getElementById(id) {
        if (id === "dialogue-box") return elements.dialogueBox;
        return elements[id] || null;
      }
    },
    DialogManager: {
      button(label, action) {
        buttonCreates += 1;
        const button = new Element("button");
        button.className = "control-button";
        button.textContent = label;
        button.addEventListener("click", action);
        return button;
      },
      show(speaker, message) {
        elements.speaker.textContent = speaker;
        elements.message.textContent = message;
        elements.controls.innerHTML = "";
      }
    },
    CommunicationTaskProgressController: {
      start() { return Promise.resolve(nextStartResult); },
      retry() { retryCalls += 1; return retryPlan.promise; },
      cancel() { return result("CANCELLED", "cancelled"); }
    },
    CommunicationRecognitionDictionary: {
      all() { return formalDictionaryEntries.slice(); },
      validate(entries) {
        return entries && entries.length === 1 && entries[0].scope && entries[0].scope.type === "task" &&
          entries[0].scope.id && entries[0].match && entries[0].candidate &&
          Object.prototype.hasOwnProperty.call(entries[0].candidate, "slotId") &&
          Object.prototype.hasOwnProperty.call(entries[0].candidate, "value") ? [] : ["invalid"];
      }
    },
    CommunicationTaskSpecDatabase: (() => {
      const values = [
        ["dev.shop.order.apple.2", "item.apple", 2], ["dev.shop.order.orange.3", "item.orange", 3],
        ["dev.shop.order.banana.1", "item.banana", 1], ["dev.shop.order.banana.3", "item.banana", 3]
      ].map(value => ({ taskId: value[0], situation: "shop", speakerRole: "customer", action: "order.request",
        requiredInformation: [{ slotId: "item", conceptId: value[1] }, { slotId: "quantity", value: value[2] }] }));
      return { all() { return values.slice(); }, get(taskId) { return values.find(value => value.taskId === taskId) || null; } };
    })(),
    CommunicationConceptCatalog: (() => {
      const values = [
        ["item.apple", "apple", "apples"], ["item.orange", "orange", "oranges"], ["item.banana", "banana", "bananas"]
      ].map(value => ({ conceptId: value[0], slotId: "item", forms: [{ text: value[1] }, { text: value[2] }] }));
      return { all() { return values.slice(); }, get(id) { return values.find(value => value.conceptId === id) || null; } };
    })(),
    addEventListener(name, listener) {
      if (name === "DOMContentLoaded") domReady = listener;
    }
  };
  context.window = context;
  vm.createContext(context);
  [
    "engine/presenters/communication-task-presenter.js",
    "dev/central-candidate-store-config.js",
    "dev/central-candidate-store-provider.js",
    "dev/communication-task-v1-playtest.js"
  ].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
    if (file === "dev/central-candidate-store-config.js" && providerOverride) {
      context.CommunicationCandidateStoreConfig.provider = providerOverride;
    }
  });

  return {
    context,
    elements,
    domReady,
    get retryCalls() { return retryCalls; },
    get buttonCreates() { return buttonCreates; },
    setStartResult(value) { nextStartResult = value; },
    addFormalEntry(value) { formalDictionaryEntries.push(value); },
    resolveRetry(value) { retryPlan.resolve(value); },
    resetRetry() { retryPlan = deferred(); }
  };
}

(async () => {
  const devHtml = fs.readFileSync(path.join(root, "dev-communication-runtime-v1.html"), "utf8");
  const cacheVersion = "communication-runtime-data-spec-v1-phase1-playtest-fix1";
  assert(devHtml.includes("data/communication-task-specs.js?v=" + cacheVersion),
    "Task Specs must not be reused from an older browser cache");
  assert(devHtml.includes("data/communication-recognition-dictionaries.js?v=growing-recognition-knowledge-v1-phase2-promotion"),
    "Recognition dictionaries must stay on the same Data Spec build");
  assert(devHtml.includes("dev/communication-task-v1-playtest.js?v=growing-recognition-knowledge-v1-phase10-sample-local-only"),
    "Playtest UI must not be reused from an older browser cache");
  assert(devHtml.includes("engine/controllers/communication-task-progress-controller.js?v=communication-runtime-phase1-realmic-trace-v1"),
    "Phase 1 Trace hooks must not be reused from an older browser cache");
  assert(devHtml.includes("engine/services/local-communication-judge-provider.js?v=growing-recognition-knowledge-v1"),
    "The playtest must load the article-aware Local Judge instead of a cached copy");

  const runtime = setup();
  runtime.domReady();
  const tracePanel = runtime.elements.body.children.find(node => node.id === "phase1-speech-trace");
  assert(tracePanel, "A visible Phase 1 Speech Trace panel is created");
  runtime.context.CommunicationTaskV1Trace.record("phase1-speech-request");
  runtime.context.CommunicationTaskV1Trace.record("startListening-call");
  runtime.context.CommunicationTaskV1Trace.record("speech-promise-pending");
  assert(tracePanel.textContent.includes("speech-promise-pending"));
  assert.strictEqual(runtime.elements.message.textContent, "聞き取り中…");
  const reviewPanel = runtime.elements.body.children.find(node => node.id === "recognition-candidate-review");
  assert(reviewPanel, "Candidate Review UI is created");
  ["Needs Review", "Ready for Promotion", "History"].forEach(label => {
    assert(reviewPanel.children.some(node => node.textContent === label), "Phase 10 view exists: " + label);
  });
  assert(reviewPanel.children.some(node => node.textContent === "Generate Teacher Review Sample"),
    "Teacher Review sample generation requires only one click");
  assert(reviewPanel.children.some(node => node.textContent === "Reload Central Review Queue"),
    "A second client can explicitly reload the Central Review State");
  const sampleRuntime = setup("local");
  const sampleCalls = [];
  sampleRuntime.context.fetch = (url, options) => {
    sampleCalls.push({ url, method: options.method });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes("unresolved") ? { unresolvedUnknowns: [] } : { candidates: [] }) });
  };
  sampleRuntime.domReady();
  await Promise.resolve(); await Promise.resolve();
  sampleCalls.length = 0;
  let sampleRecordCalls = 0;
  const originalSampleRecord = sampleRuntime.context.CommunicationRecognitionCandidateStore.recordObservation;
  sampleRuntime.context.CommunicationRecognitionCandidateStore.recordObservation = function () {
    sampleRecordCalls += 1; return originalSampleRecord.apply(this, arguments);
  };
  const samplePanel = sampleRuntime.elements.body.children.find(node => node.id === "recognition-candidate-review");
  samplePanel.children.find(node => node.textContent === "Generate Teacher Review Sample").click();
  const sampleModel = sampleRuntime.context.CommunicationTeacherReviewOperations.current();
  assert.strictEqual(sampleRecordCalls, 0, "Dev Sample never calls recordObservation");
  assert.strictEqual(sampleCalls.filter(call => call.method === "POST").length, 0, "Dev Sample sends no GAS POST");
  assert(sampleModel.needsReview.visible.some(value => value.category === "Conflict"), "Conflict Sample remains visible");
  assert(sampleModel.needsReview.visible.some(value => value.category === "Teacher Candidate"), "Teacher Candidate Sample remains visible");
  assert(sampleModel.needsReview.visible.some(value => value.category === "Other UNKNOWN"), "Other UNKNOWN Sample remains visible");
  const store = runtime.context.CommunicationRecognitionCandidateStore;
  const unresolvedStore = runtime.context.CommunicationUnresolvedUnknownStore;
  const operations = runtime.context.CommunicationTeacherReviewOperations;
  const candidate = (taskId, raw, body, reviewStatus, promotionStatus = "not_ready", observationCount = 1) => ({
    taskId, rawExpression: raw, candidate: body, reviewStatus, promotionStatus, observationCount
  });
  const unknown = (raw, observationCount, reviewStatus = "pending") => ({ taskId: "dev.shop.order.apple.2",
    rawTranscript: raw, unknownReason: "unknown_expression", reasonSlotId: null, observationCount, reviewStatus });
  assert.strictEqual(operations.comparisonRaw("  I   Want Two Apples. "), "i want two apples");
  assert.strictEqual(operations.comparisonRaw("I want two apples"), "i want two apples");
  assert.notStrictEqual(operations.comparisonRaw("I want to apples"), operations.comparisonRaw("I want two apples"));
  assert.notStrictEqual(operations.candidateIdentity(candidate("dev.shop.order.apple.2", "same", { conceptId: "item.apple" }, "pending")),
    operations.candidateIdentity(candidate("dev.shop.order.apple.2", "same", { slotId: "item", value: "apple" }, "pending")),
    "Candidate identity includes its type");
  let model = operations.build([
    candidate("dev.shop.order.apple.2", "DUP", { conceptId: "item.apple" }, "pending", "not_ready", 2),
    candidate("dev.shop.order.apple.2", "dup", { conceptId: "item.apple" }, "pending", "not_ready", 3)
  ], []);
  assert.strictEqual(model.needsReview.total, 1, "Same Task/raw/Candidate is displayed once");
  assert.strictEqual(model.needsReview.visible[0].category, "Teacher Candidate");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "again", { conceptId: "item.apple" }, "pending"),
    candidate("dev.shop.order.apple.2", "again", { conceptId: "item.apple" }, "approved")
  ], []);
  assert.strictEqual(model.needsReview.visible[0].status, "approved", "pending + approved merges to approved in Needs Review");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "gone", { conceptId: "item.apple" }, "pending"),
    candidate("dev.shop.order.apple.2", "gone", { conceptId: "item.apple" }, "rejected")
  ], []);
  assert.strictEqual(model.needsReview.total, 0);
  assert.strictEqual(model.history[0].status, "rejected", "pending + rejected is suppressed into rejected History");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "clash", { conceptId: "item.apple" }, "approved"),
    candidate("dev.shop.order.apple.2", "clash", { slotId: "quantity", value: 2 }, "pending")
  ], []);
  assert.strictEqual(model.needsReview.visible[0].category, "Conflict", "Approved plus different pending Candidate conflicts");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "shared", { conceptId: "item.apple" }, "pending"),
    candidate("dev.shop.order.orange.3", "shared", { conceptId: "item.orange" }, "pending")
  ], []);
  assert.strictEqual(model.needsReview.total, 2, "Same raw in another Task stays separate");
  model = operations.build([], [unknown("low", 2), unknown("frequent", 3)]);
  assert.strictEqual(model.needsReview.visible[0].category, "Frequent UNKNOWN");
  assert.strictEqual(model.needsReview.visible[1].category, "Other UNKNOWN");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "ready", { conceptId: "item.apple" }, "approved", "ready"),
    candidate("dev.shop.order.apple.2", "promoted", { conceptId: "item.apple" }, "approved", "promoted")
  ], [unknown("reviewed", 2, "reviewed"), unknown("ignored", 2, "ignored")]);
  assert.strictEqual(model.ready.total, 1, "Ready Candidate enters Promotion Queue");
  assert.deepStrictEqual(Array.from(model.history, value => value.status).sort(), ["ignored", "promoted", "reviewed"]);
  const twentyOne = Array.from({ length: 21 }, (_, index) => candidate("dev.shop.order.apple.2", "row " + index,
    { conceptId: "item.apple" }, "pending", "not_ready", 21 - index));
  model = operations.build(twentyOne, []);
  assert.strictEqual(model.needsReview.visible.length, 20);
  assert.strictEqual(model.needsReview.total, 21, "The 21st item remains active outside Top 20");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "zeta", { conceptId: "item.apple" }, "pending", "not_ready", 2),
    candidate("dev.shop.order.apple.2", "alpha", { conceptId: "item.apple" }, "pending", "not_ready", 2)
  ], []);
  assert(model.needsReview.visible[0].key < model.needsReview.visible[1].key, "Equal-category/count ordering uses stable key");
  model = operations.build([candidate("dev.shop.order.apple.2", "covered", { conceptId: "item.apple" }, "approved")], [unknown("covered", 9)]);
  assert.strictEqual(model.needsReview.total, 1, "Active Candidate suppresses matching pending UNKNOWN only in the view");
  model = operations.build([
    candidate("dev.shop.order.apple.2", "not-conflict", { conceptId: "item.apple" }, "rejected"),
    candidate("dev.shop.order.apple.2", "not-conflict", { slotId: "quantity", value: 2 }, "pending")
  ], []);
  assert.strictEqual(model.needsReview.visible[0].category, "Teacher Candidate", "Rejected A plus different pending B is not a conflict");
  for (const activeStatus of ["approved", "ready", "promoted"]) {
    model = operations.build([
      candidate("dev.shop.order.apple.2", "bad-status-" + activeStatus, { conceptId: "item.apple" }, activeStatus === "approved" ? "approved" : "approved",
        activeStatus === "approved" ? "not_ready" : activeStatus),
      candidate("dev.shop.order.apple.2", "bad-status-" + activeStatus, { conceptId: "item.apple" }, "rejected")
    ], []);
    assert.strictEqual(model.needsReview.visible[0].category, "Conflict", activeStatus + " plus rejected is incompatible");
  }
  model = operations.build([
    candidate("dev.shop.order.apple.2", "ready-clash", { conceptId: "item.apple" }, "approved", "ready"),
    candidate("dev.shop.order.apple.2", "ready-clash", { slotId: "quantity", value: 2 }, "pending")
  ], []);
  assert.strictEqual(model.needsReview.visible[0].category, "Conflict");
  assert.strictEqual(model.ready.total, 0, "Ready Candidate in conflict is hidden from Promotion Queue");
  model = operations.build([], [unknown("I Want Two Apples.", 1), unknown("I   want two apples", 2)]);
  assert.strictEqual(model.needsReview.total, 1, "UNKNOWN comparison normalization suppresses duplicate display without changing raw");
  const errorRuntime = setup();
  errorRuntime.domReady();
  const errorPanel = errorRuntime.elements.body.children.find(node => node.id === "recognition-candidate-review");
  const reloadFailure = errorPanel.children.find(node => node.textContent === "Reload Central Review Queue");
  await reloadFailure.click();
  assert(errorPanel.children.some(node => node.textContent.startsWith("Teacher Review Error:")),
    "GAS retrieval failure is visible without changing any status");
  const candidateCountBeforeUnknown = store.all().length;
  const unresolvedResult = { taskId: "dev.shop.order.apple.2", status: "UNKNOWN", transcript: "I want to airport.",
    judgeResult: { verdict: "UNKNOWN", reason: "unknown_expression", reasonSlotId: null } };
  for (let index = 0; index < 10; index += 1) unresolvedStore.observeResult(unresolvedResult);
  assert.strictEqual(unresolvedStore.all().length, 1);
  assert.strictEqual(unresolvedStore.all()[0].observationCount, 10);
  assert.strictEqual(unresolvedStore.all()[0].rawTranscript, "I want to airport.");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(unresolvedStore.all()[0], "candidate"), false);
  assert.strictEqual(store.all().length, candidateCountBeforeUnknown, "UNKNOWN does not create a Candidate automatically");
  const suggestionRuntime = setup();
  const suggestionStore = suggestionRuntime.context.CommunicationRecognitionCandidateStore;
  const suggestion = suggestionRuntime.context.CommunicationLocalSuggestionSupport;
  const safeUnknown = { taskId: "dev.shop.order.apple.2", rawTranscript: "I want tu aple.",
    unknownReason: "missing_information", reasonSlotId: null, observationCount: 12, reviewStatus: "pending" };
  const beforeSuggestionDisplay = suggestionStore.all().length;
  const safeSuggestions = Array.from(suggestion.suggest(safeUnknown));
  assert(safeSuggestions.length > 0 && safeSuggestions.length <= 3, "Safe local suggestions are capped at three");
  assert.strictEqual(suggestionStore.all().length, beforeSuggestionDisplay, "Displaying suggestions saves nothing");
  assert.strictEqual(safeUnknown.rawTranscript, "I want tu aple.", "Raw transcript remains unchanged");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { observationCount: 1 })).length, 0,
    "Low-frequency UNKNOWN receives no suggestion");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I don't want two apples." })).length, 0,
    "Negation is blocked by the Suggestion Gate");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want four apples." })).length, 0,
    "Explicit quantity contradiction is blocked");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want two oranges." })).length, 0,
    "Item contradiction is blocked");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "Did you say two apples?" })).length, 0,
    "Different speech act is blocked");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want to airport." })).length, 0,
    "Clear alternate meaning is blocked");
  const registered = await suggestion.register(safeUnknown, safeSuggestions[0]);
  assert.strictEqual(registered.reviewStatus, "pending", "Explicit registration creates only a pending Candidate");
  assert.strictEqual(registered.promotionStatus, "not_ready", "Explicit registration does not mark a Candidate ready");
  assert.strictEqual(suggestionStore.approvedDictionaryEntries().some(entry => entry.match === registered.rawExpression), false,
    "Explicit registration does not approve or promote knowledge");
  const history = { taskId: "dev.shop.order.apple.2", rawExpression: "tuu", candidate: { slotId: "quantity", value: 2 } };
  suggestionStore.observe(history);
  suggestionStore.review(history, "approved");
  const historySuggestions = Array.from(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want tuu apples." })));
  assert(historySuggestions.some(value => value.rawExpression === "tuu" && value.reason.includes("approved")),
    "Only same-task approved history is a suggestion source");
  suggestionRuntime.addFormalEntry({ scope: { type: "task", id: "dev.shop.order.apple.2" }, match: "clash",
    candidate: { slotId: "quantity", value: 2 } });
  suggestionRuntime.addFormalEntry({ scope: { type: "task", id: "dev.shop.order.apple.2" }, match: "clash",
    candidate: { slotId: "quantity", value: 3 } });
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want clash apples." })).length, 0,
    "Recognition conflicts are blocked");
  const otherTask = { taskId: "dev.shop.order.orange.3", rawExpression: "zree", candidate: { slotId: "quantity", value: 3 } };
  suggestionStore.observe(otherTask); suggestionStore.review(otherTask, "approved");
  assert.strictEqual(suggestion.suggest(Object.assign({}, safeUnknown, { rawTranscript: "I want zree apples." }))
    .some(value => value.rawExpression === "zree"), false, "Approved history from another Task is not reused");
  const scopedRuntime = setup();
  scopedRuntime.addFormalEntry({ scope: { type: "slot", id: "quantity" }, match: "free", candidate: { slotId: "quantity", value: 2 } });
  scopedRuntime.addFormalEntry({ scope: { type: "task", id: "dev.shop.order.orange.3" }, match: "free", candidate: { slotId: "quantity", value: 3 } });
  const scoped = Array.from(scopedRuntime.context.CommunicationLocalSuggestionSupport.suggest({
    taskId: "dev.shop.order.orange.3", rawTranscript: "I want free oranges.", unknownReason: "unknown_expression",
    reasonSlotId: "quantity", observationCount: 3, reviewStatus: "pending"
  }));
  assert(scoped.some(value => value.rawExpression === "free" && value.candidate.value === 3) &&
    !scoped.some(value => value.rawExpression === "free" && value.candidate.value === 2), "Task-specific knowledge has priority");
  const dismissRuntime = setup();
  const dismissSupport = dismissRuntime.context.CommunicationLocalSuggestionSupport;
  const dismissStore = dismissRuntime.context.CommunicationRecognitionCandidateStore;
  const dismissValue = Object.assign({}, safeUnknown);
  const dismissCandidate = Array.from(dismissSupport.suggest(dismissValue))[0];
  dismissSupport.dismiss(dismissValue, dismissCandidate);
  assert.strictEqual(dismissStore.all().length, 0, "Dismissing a suggestion does not register a Candidate");
  const duplicateRuntime = setup();
  const duplicateSupport = duplicateRuntime.context.CommunicationLocalSuggestionSupport;
  const duplicateStore = duplicateRuntime.context.CommunicationRecognitionCandidateStore;
  const duplicateCandidate = Array.from(duplicateSupport.suggest(safeUnknown))[0];
  await duplicateSupport.register(safeUnknown, duplicateCandidate);
  await duplicateSupport.register(safeUnknown, duplicateCandidate);
  assert.strictEqual(duplicateStore.all().length, 1, "Repeated explicit registration does not create duplicate rows");
  assert.strictEqual(duplicateStore.all()[0].observationCount, 2, "Repeated explicit registration aggregates observations");
  const tracedRuntime = setup("local");
  const tracedSupport = tracedRuntime.context.CommunicationLocalSuggestionSupport;
  const tracedValue = Object.assign({}, safeUnknown);
  const tracedSuggestion = Array.from(tracedSupport.suggest(tracedValue))[0];
  let centralRows = [];
  const registrationCalls = [];
  tracedRuntime.context.fetch = (url, options) => {
    registrationCalls.push({ url, method: options.method });
    if (options.method === "POST") {
      const observation = JSON.parse(options.body);
      centralRows = [{ taskId: observation.taskId, rawExpression: observation.rawExpression,
        candidate: observation.candidate, observationCount: 1, reviewStatus: "pending", promotionStatus: "not_ready" }];
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ candidates: centralRows }) });
  };
  const tracedCandidate = await tracedSupport.register(tracedValue, tracedSuggestion);
  assert.strictEqual(centralRows.length, 1, "Successful registration reloads and retains the Central Candidate Queue");
  assert.strictEqual(registrationCalls[0].method, "POST", "Registration writes before reloading");
  assert(registrationCalls.slice(1).some(call => call.method === "GET"), "Central Queue reload runs only after POST resolves");
  assert.strictEqual(tracedCandidate.reviewStatus, "pending");
  assert.strictEqual(tracedCandidate.promotionStatus, "not_ready");
  const rejectedRuntime = setup();
  const rejectedSupport = rejectedRuntime.context.CommunicationLocalSuggestionSupport;
  const rejectedSuggestion = Array.from(rejectedSupport.suggest(safeUnknown))[0];
  await rejectedSupport.register(safeUnknown, rejectedSuggestion);
  assert.strictEqual(rejectedRuntime.context.CommunicationRecognitionCandidateStore.all()[0].reviewStatus, "pending",
    "Failed POST leaves the local Candidate pending and does not alter Judge behavior");
  ["ACCEPT", "REJECT", "JUDGE_UNAVAILABLE", "SPEECH_FAILURE"].forEach(status => {
    unresolvedStore.observeResult(Object.assign({}, unresolvedResult, { status }));
  });
  assert.strictEqual(unresolvedStore.all().length, 1, "Only UNKNOWN creates an Unresolved Observation");
  unresolvedStore.observeResult(Object.assign({}, unresolvedResult, { transcript: "another unknown" }));
  assert.strictEqual(unresolvedStore.all().length, 2, "Different UNKNOWN is a separate row");
  for (let index = 0; index < 25; index += 1) unresolvedStore.observeResult(Object.assign({}, unresolvedResult, { transcript: "bulk unknown " + index }));
  assert.strictEqual(unresolvedStore.reviewQueue(false).visible.length, 20);
  assert.strictEqual(unresolvedStore.reviewQueue(true).visible[0].observationCount, 10, "Unresolved queue is frequency ordered");
  unresolvedStore.updateReviewStatus(unresolvedStore.all()[1], "ignored");
  assert.strictEqual(unresolvedStore.all()[1].reviewStatus, "ignored");
  unresolvedStore.updateReviewStatus(unresolvedStore.all()[2], "reviewed");
  assert.strictEqual(unresolvedStore.all()[2].reviewStatus, "reviewed");
  const fixedCandidate = { taskId: "dev.shop.order.orange.3", rawExpression: "free",
    candidate: { slotId: "quantity", value: 3 } };
  assert.strictEqual(store.observe(fixedCandidate).reviewStatus, "pending");
  assert.strictEqual(store.markReady(fixedCandidate), null, "Pending Candidate cannot be marked Ready");
  assert.strictEqual(store.approvedDictionaryEntries().length, 0, "Pending Candidate is not active");
  assert.strictEqual(store.observe(fixedCandidate).observationCount, 2, "Duplicate observation increments one row");
  assert.strictEqual(store.all().length, 1);
  assert.strictEqual(store.review(fixedCandidate, "approved").reviewStatus, "approved");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(store.approvedDictionaryEntries()[0].scope)),
    { type: "task", id: "dev.shop.order.orange.3" });
  assert.strictEqual(store.markReady(fixedCandidate).promotionStatus, "ready");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(store.promotionExport())), [{
    scope: { type: "task", id: "dev.shop.order.orange.3" }, match: "free",
    candidate: { slotId: "quantity", value: 3 }
  }]);
  const rejectedCandidate = { taskId: "dev.shop.order.orange.3", rawExpression: "free",
    candidate: { slotId: "quantity", value: 2 } };
  store.observe(rejectedCandidate);
  assert.strictEqual(store.markReady(rejectedCandidate), null, "Pending conflict cannot be marked Ready");
  assert.strictEqual(store.review(rejectedCandidate, "rejected").reviewStatus, "rejected");
  assert.strictEqual(store.markReady(rejectedCandidate), null, "Rejected Candidate cannot be marked Ready");
  assert.strictEqual(store.approvedDictionaryEntries().length, 1, "Rejected Candidate is not active");
  assert.strictEqual(store.all().filter(value => value.candidate.value === 3)[0].promotionStatus, "not_ready",
    "Rejected conflicting history blocks Ready status");
  assert.strictEqual(store.promotionExport().length, 0, "Conflicted Candidate is not exported");
  runtime.addFormalEntry({ scope: { type: "task", id: "dev.shop.order.orange.3" }, match: "free",
    candidate: { slotId: "quantity", value: 3 } });
  assert.strictEqual(store.all().filter(value => value.candidate.value === 3)[0].promotionStatus, "promoted");
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  runtime.context.CommunicationTaskV1Trace.record("phase1-speech-request");
  store.recordObservation(fixedCandidate);
  await Promise.resolve(); await Promise.resolve();
  assert.strictEqual(tracePanel.textContent.includes("candidate-store-send-failed"), false,
    "A formally known expression is not sent as a Candidate Observation");
  const unsentFailure = { taskId: "dev.shop.order.orange.3", rawExpression: "new-unknown",
    candidate: { slotId: "quantity", value: 3 } };
  const returnedImmediately = store.recordObservation(unsentFailure);
  assert.strictEqual(returnedImmediately.rawExpression, "new-unknown", "Candidate collection does not await the remote Store");
  await new Promise(resolve => setImmediate(resolve));
  assert(tracePanel.textContent.includes("candidate-store-send-failed"), "Store failure is isolated as collection failure");

  const ten = { taskId: "dev.shop.order.orange.3", rawExpression: "crowd-ten",
    candidate: { slotId: "quantity", value: 3 }, studentName: "must-not-persist" };
  for (let index = 0; index < 10; index += 1) store.recordObservation(ten);
  const tenRows = store.all().filter(value => value.rawExpression === "crowd-ten");
  assert.strictEqual(tenRows.length, 1);
  assert.strictEqual(tenRows[0].observationCount, 10);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(tenRows[0], "studentName"), false, "PII is not stored");
  const hundred = { taskId: "dev.shop.order.orange.3", rawExpression: "crowd-hundred",
    candidate: { slotId: "quantity", value: 3 } };
  for (let index = 0; index < 100; index += 1) store.recordObservation(hundred);
  assert.strictEqual(store.all().filter(value => value.rawExpression === "crowd-hundred").length, 1,
    "100 observations remain one Candidate row");
  const low = { taskId: "dev.shop.order.banana.3", rawExpression: "low-once",
    candidate: { slotId: "quantity", value: 1 } };
  store.recordObservation(low);
  const safe = { taskId: "dev.shop.order.banana.3", rawExpression: "safe-once",
    candidate: { slotId: "quantity", value: 3 } };
  store.recordObservation(safe);
  const conflictOne = { taskId: "dev.shop.order.apple.2", rawExpression: "clash",
    candidate: { slotId: "quantity", value: 2 } };
  const conflictTwo = { taskId: "dev.shop.order.apple.2", rawExpression: "clash",
    candidate: { slotId: "quantity", value: 3 } };
  store.recordObservation(conflictOne); store.recordObservation(conflictTwo);
  store.review(conflictOne, "approved");
  assert.strictEqual(store.markReady(conflictOne), null, "A conflicting approved Candidate cannot be marked Ready");
  const allQueue = store.reviewQueue("all", true).visible;
  assert.strictEqual(allQueue.filter(value => value.rawExpression === "crowd-ten")[0].queueCategory, "FREQUENT");
  assert.strictEqual(allQueue.filter(value => value.rawExpression === "safe-once")[0].queueCategory, "SAFE_REVIEW");
  assert.strictEqual(allQueue.filter(value => value.rawExpression === "low-once")[0].queueCategory, "LOW_PRIORITY");
  assert(allQueue.filter(value => value.rawExpression === "clash").every(value => value.queueCategory === "CONFLICT"));
  assert.strictEqual(reviewPanel.children.filter(node => node["data-conflict-group"] === "dev.shop.order.apple.2:clash").length, 1,
    "Candidates with the same conflicting expression are rendered together");
  assert.strictEqual(store.reviewQueue("needs_review", true).visible[0].queueCategory, "CONFLICT",
    "Needs Review puts conflicts first");
  assert.strictEqual(store.taskSummary("dev.shop.order.orange.3"), "Shop / Customer / Order / Orange / 3",
    "Teacher Review derives a human-readable Task summary from TaskSpec");
  const frequent = store.reviewQueue("frequent", true).visible;
  assert(frequent[0].observationCount >= frequent[frequent.length - 1].observationCount,
    "A Queue category is ordered by observationCount descending");
  for (let index = 0; index < 25; index += 1) store.recordObservation({
    taskId: "dev.shop.order.banana.1", rawExpression: "bulk-" + index,
    candidate: { slotId: "quantity", value: 1 }
  });
  const limited = store.reviewQueue("needs_review", false);
  const expanded = store.reviewQueue("needs_review", true);
  assert.strictEqual(limited.visible.length, 20, "Initial Queue is limited to 20 Candidates");
  assert.strictEqual(expanded.visible.length, expanded.total, "Show All exposes the complete filtered Queue");
  const counts = store.summaryCounts();
  assert(counts.needsReview >= 1 && counts.conflict >= 1 && counts.frequent >= 1 && counts.safe >= 1 && counts.reviewed >= 1,
    "Teacher summary exposes every required category count");
  assert(store.reviewQueue("reviewed", true).visible.every(value => value.reviewStatus !== "pending" ||
    value.promotionStatus === "ready" || value.promotionStatus === "promoted"));
  const immediate = { taskId: "dev.shop.order.orange.3", rawExpression: "approve-and-hide",
    candidate: { slotId: "quantity", value: 3 } };
  store.observe(immediate);
  assert(store.reviewQueue("needs_review", true).visible.some(value => value.rawExpression === immediate.rawExpression));
  store.review(immediate, "approved");
  assert.strictEqual(store.reviewQueue("needs_review", true).visible.some(value => value.rawExpression === immediate.rawExpression), false,
    "Approved Candidate disappears from Needs Review immediately");
  const rejectImmediate = { taskId: "dev.shop.order.orange.3", rawExpression: "reject-and-hide",
    candidate: { slotId: "quantity", value: 2 } };
  store.observe(rejectImmediate);
  store.review(rejectImmediate, "rejected");
  assert.strictEqual(store.reviewQueue("needs_review", true).visible.some(value => value.rawExpression === rejectImmediate.rawExpression), false,
    "Rejected Candidate disappears from Needs Review immediately");
  const rejectedBefore = store.all().filter(value => value.candidate.value === 2 && value.rawExpression === "free")[0];
  store.recordObservation(rejectedCandidate);
  const rejectedAfter = store.all().filter(value => value.candidate.value === 2 && value.rawExpression === "free")[0];
  assert.strictEqual(rejectedBefore.reviewStatus, "rejected");
  assert.strictEqual(rejectedAfter.reviewStatus, "rejected", "A repeated rejected Observation never returns to pending");
  const promotedInNeedsReview = store.reviewQueue("needs_review", true).visible.some(value =>
    value.rawExpression === "free" && value.candidate.value === 3);
  assert.strictEqual(promotedInNeedsReview, false, "A formally registered Candidate is not re-queued for Review");
  const selector = runtime.elements.body.children.find(node => node.tagName === "select");
  assert.strictEqual(selector.tagName, "select");
  assert.strictEqual(selector.children.length, 4);
  selector.value = "dev.shop.order.orange.3";
  selector.listeners.change();
  assert.strictEqual(runtime.context.CommunicationTaskV1Playtest.getTaskId(), "dev.shop.order.orange.3");
  selector.value = "dev.shop.order.apple.2";
  selector.listeners.change();
  await runtime.context.CommunicationTaskV1Playtest.start();
  const retryButton = runtime.elements.controls.children[0];
  assert.strictEqual(retryButton.textContent, "もう一度話す");
  assert.strictEqual(retryButton.className, "control-button");

  retryButton.click();
  assert.strictEqual(retryButton.disabled, true, "Retry is disabled immediately");
  assert.strictEqual(runtime.elements.message.textContent, "聞き取り中…", "Listening feedback is immediate");
  retryButton.click();
  assert.strictEqual(runtime.retryCalls, 1, "A second click must not start another Retry");

  const buttonsBeforeRetryResult = runtime.buttonCreates;
  runtime.resolveRetry(result("UNKNOWN"));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepStrictEqual(runtime.elements.controls.children.map(node => node.textContent), ["もう一度話す", "終了"],
    "Controls are redrawn once after Retry completes");
  assert.strictEqual(runtime.buttonCreates - buttonsBeforeRetryResult, 2, "Retry result renders one complete Control set");

  runtime.setStartResult(result("ACCEPT", "accepted"));
  await runtime.context.CommunicationTaskV1Playtest.start();
  assert.deepStrictEqual(runtime.elements.controls.children.map(node => node.textContent), ["Local Task開始", "終了"]);
  runtime.elements.controls.children.forEach(node => assert.strictEqual(node.className, "control-button"));

  runtime.setStartResult(result("FINAL_RESCUE", "adventure_return"));
  await runtime.context.CommunicationTaskV1Playtest.start();
  assert.deepStrictEqual(runtime.elements.controls.children.map(node => node.textContent), ["Local Task開始", "終了"]);

  const presenter = runtime.context.CommunicationTaskPresenter;
  const below = new Element("button");
  below.rect = { top: 320, bottom: 360 };
  runtime.elements.dialogueBox.scrollTop = 0;
  presenter.revealControl(below);
  assert.strictEqual(runtime.elements.dialogueBox.scrollTop, 60, "Only the required downward distance is applied");

  const visible = new Element("button");
  visible.rect = { top: 220, bottom: 280 };
  runtime.elements.dialogueBox.scrollTop = 15;
  presenter.revealControl(visible);
  assert.strictEqual(runtime.elements.dialogueBox.scrollTop, 15, "Visible Controls do not move the dialogue viewport");

  const above = new Element("button");
  above.rect = { top: 60, bottom: 90 };
  runtime.elements.dialogueBox.scrollTop = 80;
  presenter.revealControl(above);
  assert.strictEqual(runtime.elements.dialogueBox.scrollTop, 40, "Only the required upward distance is applied");

  for (const status of ["REJECT", "UNKNOWN", "SPEECH_FAILURE", "JUDGE_UNAVAILABLE"]) {
    runtime.setStartResult(result(status));
    await runtime.context.CommunicationTaskV1Playtest.start();
    assert.strictEqual(runtime.elements.controls.children[0].textContent, "もう一度話す", status + " exposes Retry");
  }

  const syncRuntime = setup("local");
  const syncCandidate = { taskId: "dev.shop.order.orange.3", rawExpression: "central-sync",
    candidate: { slotId: "quantity", value: 3 } };
  syncRuntime.context.CommunicationRecognitionCandidateStore.observe(syncCandidate);
  syncRuntime.context.CommunicationRecognitionCandidateStore.review(syncCandidate, "rejected");
  const centralState = [{ taskId: syncCandidate.taskId, rawExpression: syncCandidate.rawExpression,
    candidate: syncCandidate.candidate, observationCount: 8, reviewStatus: "approved", promotionStatus: "ready" }];
  const centralCalls = [];
  syncRuntime.context.fetch = (url, options) => {
    centralCalls.push({ url, method: options.method });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ candidates: centralState }) });
  };
  syncRuntime.domReady();
  await syncRuntime.context.CommunicationRecognitionCandidateStore.getAggregatedCandidates();
  const synchronized = syncRuntime.context.CommunicationRecognitionCandidateStore.all()[0];
  assert.strictEqual(synchronized.reviewStatus, "approved", "Central reviewStatus overrides stale localStorage state");
  assert.strictEqual(synchronized.promotionStatus, "ready", "Central promotionStatus overrides stale localStorage state");
  syncRuntime.context.CommunicationRecognitionCandidateStore.review(syncCandidate, "rejected");
  await Promise.resolve(); await Promise.resolve();
  assert(centralCalls.some(call => call.url.endsWith("/candidates/review") && call.method === "PATCH"),
    "Review UI writes state through the Central Store boundary");

  const sources = [
    "engine/presenters/communication-task-presenter.js",
    "dev/communication-task-v1-playtest.js"
  ].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.strictEqual(/scrollIntoView|window\.scroll|scrollTo\s*\(/.test(sources), false,
    "Auto-Reveal must not scroll the window or page");
  console.log("Communication Runtime V1 Control UI tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
