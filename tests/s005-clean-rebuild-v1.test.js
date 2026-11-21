"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
// Content protection is centralized in specs/locked-content-baseline.json.
// Avoid obsolete whole-file hashes that prohibit approved shared UI changes.
const story = fs.readFileSync(path.join(root, "engine/stories/S005.js"), "utf8");
// Preserve the complete Production Story, including its existing wrappers.
const {execFileSync}=require("node:child_process");
assert.equal(story,execFileSync("git",["show","70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f:engine/stories/S005.js"],{cwd:root,encoding:"utf8"}));
assert.equal((story.match(/C\.sequence\(/g) || []).length, 11);
assert.equal((story.match(/C\.question\(/g) || []).length, 12);
for (const html of ["index.html", "dev.html"]) {
  const page = fs.readFileSync(path.join(root, html), "utf8");
  assert(page.indexOf("data/s005-communication.js") < page.indexOf("engine/stories/S005.js"));
  assert.equal((page.match(/data\/s005-communication\.js/g) || []).length, 1);
  assert(!page.includes("data/s005-communicative-judge-rules.js"));
}
assert(!fs.existsSync(path.join(root, "data/s005-communicative-judge-rules.js")), "Old S005 judge registration is removed");
assert(!fs.readFileSync(path.join(root, "engine/presenters/communicative-question-presenter.js"), "utf8").includes("addLanguageControls"));
console.log("S005 Clean Rebuild architecture: PASS (" + "central locked-content gate; no Story-specific engine or callbacks)");
