const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "dev/dev-checkpoints.js"), "utf8"), context);

const list = JSON.parse(JSON.stringify(context.DevCheckpointDatabase.list()));
assert.strictEqual(context.DevCheckpointDatabase.validate(), true);
assert.strictEqual(list.length, 9);
assert.strictEqual(new Set(list.map(item => item.id)).size, 9);

const expected = {
  S001: { kind: "story", target: "S001", party: [] },
  S002: { kind: "story", target: "S002", party: [1, 2] },
  S003: { kind: "story", target: "S003", party: [1, 2, 3] },
  M002_BATTLE: { kind: "monster", target: "m002", party: [1, 2, 3] },
  CAMP_M002: { kind: "camp", target: "CAMP_M002", party: [1, 2, 3] },
  S004: { kind: "story", target: "S004", party: [1, 2, 3] },
  M003_BATTLE: { kind: "monster", target: "m003", party: [1, 2, 3, 4] },
  ST004: { kind: "story", target: "st004", party: [1, 2, 3, 4] },
  M004: { kind: "story", target: "m004", party: [1, 2, 4] }
};

Object.keys(expected).forEach(id => {
  const checkpoint = list.find(item => item.id === id);
  assert(checkpoint, id);
  assert.strictEqual(checkpoint.entry.kind, expected[id].kind);
  assert.strictEqual(checkpoint.entry.id, expected[id].target);
  assert.deepStrictEqual(checkpoint.party, expected[id].party);
  assert(Array.isArray(checkpoint.completedStories));
  assert(checkpoint.bestiary && typeof checkpoint.bestiary === "object");
  assert(Array.isArray(checkpoint.continueWith));
});

const m002 = list.find(item => item.id === "M002_BATTLE");
assert.deepStrictEqual(m002.continueWith.map(item => item.kind + ":" + item.id), [
  "camp:CAMP_M002", "story:S004"
]);
assert.deepStrictEqual(m002.continueWith[1].completeStories, ["S003"]);

const campM002 = list.find(item => item.id === "CAMP_M002");
assert.deepStrictEqual(campM002.continueWith[0].completeStories, ["S003"]);
assert.strictEqual(campM002.bestiary.m002.defeated, true);

const m003 = list.find(item => item.id === "M003_BATTLE");
assert.deepStrictEqual(m003.continueWith.map(item => item.kind + ":" + item.id), ["story:st004"]);
assert.deepStrictEqual(m003.continueWith[0].completeStories, ["S004"]);

const st004 = list.find(item => item.id === "ST004");
assert.strictEqual(st004.bestiary.m003.defeated, true);
assert(st004.completedStories.includes("S004"));

const m004 = list.find(item => item.id === "M004");
assert.strictEqual(m004.label, "m004");
assert(m004.completedStories.includes("st004"));
assert.strictEqual(m004.progressStoryId, "m004");

console.log("dev-jump-checkpoints.test.js: PASS");
