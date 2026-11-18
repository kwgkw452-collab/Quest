"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const root = path.resolve(__dirname, "..");
const base = "70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f";
const git = (...args) => cp.execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const original = p => cp.execFileSync("git", ["show", base + ":" + p], { cwd: root, encoding: "utf8" });
const allowed = new Set([
  "data/s006-communication.js", "index.html", "dev.html",
  "tests/s006-communication-final-v1.test.js", "tests/s006-communication-final-cases.json",
  "tests/s006-q7-final-correction-v1.test.js", "tests/s006-q7-final-cases.json",
  "tests/s006-restored-all-ten-layout-v1.test.js",
  "tests/s006-communication-v2.test.js", "tests/s006-communication-v2-cases.json",
  "tests/s006-communication-v2-lock.test.js", "tests/s006-communication-v2-browser.test.js"
]);
const changed = git("diff", "--name-only", base).split("\n").filter(Boolean);
const untracked = git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
for (const p of [...changed, ...untracked]) assert(allowed.has(p), "Out-of-scope change: " + p);
for (const page of ["index.html", "dev.html"]) {
  assert.equal(read(page).replace(
    "data/s006-communication.js?v=s006-communication-v2-20261119",
    "data/s006-communication.js?v=s006-final-q7-v1&s006RestoredAll10=20261118-v1"
  ), original(page), "Only S006 script version may change: " + page);
}
const story = read("engine/stories/S006.js");
assert.equal(story, original("engine/stories/S006.js"));
assert.deepEqual([...story.matchAll(/C\.question\("([^"]+)", "([^"]+)"\)/g)].map(m => m.slice(1)),
  Array.from({ length: 10 }, (_, i) => ["s006.communication." + (i+1), "s006Challenge" + (i+1)]));
assert.deepEqual([...story.matchAll(/C\.background\("([^"]+)"\)/g)].map(m => m[1]),
  Array.from({ length: 13 }, (_, i) => "images/006/S006-Scene-" + String(i+1).padStart(2,"0") + ".png?v=s006-v22"));
for (let i = 1; i <= 13; i++) {
  const p = "images/006/S006-Scene-" + String(i).padStart(2,"0") + ".png";
  assert.equal(git("hash-object", p), git("rev-parse", base + ":" + p), p);
}
const oldTests = [
  "tests/s006-communication-final-v1.test.js", "tests/s006-communication-final-cases.json",
  "tests/s006-q7-final-correction-v1.test.js", "tests/s006-q7-final-cases.json",
  "tests/s006-restored-all-ten-layout-v1.test.js"
];
for (const p of oldTests) assert(!fs.existsSync(path.join(root,p)), "Obsolete spec still active: " + p);
const activeTestSources = fs.readdirSync(path.join(root, "tests")).filter(p => /\.(js|json)$/.test(p) && p !== path.basename(__filename))
  .map(p => read("tests/" + p)).join("\n");
for (const p of oldTests) assert(!activeTestSources.includes(p.split("/").pop()), "Stale test reference: " + p);
console.log("S006 V2 LOCK PASS: only allowed files differ; all 13 image blobs, Story/IDs/positions, Ending, shared code/CSS/Audio/Speech/Judge, S005/S007 unchanged.");

