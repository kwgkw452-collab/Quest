"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");

function response(payload) {
  return { ok: true, json() { return Promise.resolve(payload); } };
}

(async () => {
  const calls = [];
  const storage = {};
  const context = {
    Promise,
    localStorage: {
      getItem(key) { return storage[key] || null; },
      setItem(key, value) { storage[key] = String(value); }
    },
    fetch(url, options) {
      calls.push({ url, options: options || {} });
      return Promise.resolve(response({ candidates: [] }));
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "dev/central-candidate-store-provider.js"), "utf8"), context);
  const boundary = context.CommunicationCandidateStoreProvider;
  const observation = { taskId: "dev.shop.order.orange.3", rawExpression: "free",
    candidate: { slotId: "quantity", value: 3 }, studentName: "do-not-send", email: "do-not-send" };
  assert.strictEqual(boundary.stableCandidateKey(observation), boundary.stableCandidateKey({
    taskId: observation.taskId, rawExpression: "FREE", candidate: observation.candidate
  }), "candidateKey is stable across expression case");
  assert.strictEqual(boundary.cleanObservation({ taskId: "", rawExpression: "x", candidate: observation.candidate }), null);
  assert.strictEqual(boundary.cleanObservation({ taskId: "x", rawExpression: "x".repeat(501), candidate: observation.candidate }), null,
    "Oversized payload is rejected");

  const gas = boundary.create({ provider: "gas", gasWebAppUrl: "https://script.google.com/macros/s/test/exec" });
  await gas.recordObservation(observation);
  let sent = JSON.parse(calls[0].options.body);
  assert.strictEqual(sent.action, "recordObservation");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(sent.observation)), {
    taskId: observation.taskId, rawExpression: "free", candidate: { slotId: "quantity", value: 3 }
  });
  assert.strictEqual(calls[0].options.headers["Content-Type"], "text/plain;charset=UTF-8");
  assert.strictEqual(JSON.stringify(sent).includes("studentName"), false);
  assert.strictEqual(JSON.stringify(sent).includes("email"), false);
  await gas.updateReviewStatus(Object.assign({}, sent.observation, { reviewStatus: "approved" }));
  assert.strictEqual(JSON.parse(calls[1].options.body).update.reviewStatus, "approved");
  await gas.updateReviewStatus(Object.assign({}, sent.observation, { reviewStatus: "rejected" }));
  assert.strictEqual(JSON.parse(calls[2].options.body).update.reviewStatus, "rejected");
  await gas.updateReviewStatus(Object.assign({}, sent.observation, { promotionStatus: "ready" }));
  assert.strictEqual(JSON.parse(calls[3].options.body).update.promotionStatus, "ready");
  await gas.getCandidates();
  assert(calls[4].url.includes("?action=getCandidates"));

  const noUrl = boundary.create({ provider: "gas", gasWebAppUrl: "", localUrl: "http://127.0.0.1:8001" });
  assert.strictEqual(noUrl.name, "local", "Missing GAS URL safely selects the Local Provider");

  context.fetch = function () { return Promise.reject(new Error("offline")); };
  const failingGas = boundary.create({ provider: "gas", gasWebAppUrl: "https://script.google.com/macros/s/test/exec" });
  await assert.rejects(failingGas.recordObservation(observation), /offline/);
  const pending = JSON.parse(storage["eigo-de-quest.communication-runtime-v1.pending-observations"]);
  assert.strictEqual(pending.length, 1, "Failed observation is retained in a small local fallback");
  assert.strictEqual(JSON.stringify(pending).includes("studentName"), false);

  context.fetch = function (url, options) { calls.push({ url, options: options || {} }); return Promise.resolve(response({ unresolvedUnknowns: [] })); };
  const unknown = { taskId: "dev.shop.order.apple.2", rawTranscript: "I want to airport.",
    unknownReason: "unknown_expression", reasonSlotId: null, studentId: "do-not-send" };
  await gas.recordUnresolvedUnknown(unknown);
  const unknownPayload = JSON.parse(calls[calls.length - 1].options.body);
  assert.strictEqual(unknownPayload.action, "recordUnresolvedUnknown");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(unknownPayload.observation, "candidate"), false);
  assert.strictEqual(JSON.stringify(unknownPayload).includes("studentId"), false);
  assert.strictEqual(boundary.stableUnknownKey(unknown), boundary.stableUnknownKey(Object.assign({}, unknown, { rawTranscript: "I WANT TO AIRPORT." })));
  assert.notStrictEqual(boundary.stableUnknownKey(unknown), boundary.stableUnknownKey(Object.assign({}, unknown, { reasonSlotId: "quantity" })),
    "reasonSlotId participates in the Unresolved UNKNOWN key");
  await gas.getUnresolvedUnknowns();
  assert(calls[calls.length - 1].url.includes("?action=getUnresolvedUnknowns"));
  await gas.updateUnresolvedReviewStatus(Object.assign({}, unknown, { reviewStatus: "ignored" }));
  assert.strictEqual(JSON.parse(calls[calls.length - 1].options.body).action, "updateUnresolvedReviewStatus");

  const gasCode = fs.readFileSync(path.join(root, "gas/Code.gs"), "utf8");
  assert(gasCode.includes("LockService.getScriptLock()"), "GAS aggregation uses LockService");
  assert(gasCode.includes("observationCount"));
  ["recordUnresolvedUnknown", "getUnresolvedUnknowns", "updateUnresolvedReviewStatus", "UnresolvedUnknowns"].forEach(value => {
    assert(gasCode.includes(value), "Generated Code.gs must contain " + value);
  });
  assert(!gasCode.includes("studentName") && !gasCode.includes("studentId") && !gasCode.includes("email"));
  console.log("GAS Candidate Store Provider V1 tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
