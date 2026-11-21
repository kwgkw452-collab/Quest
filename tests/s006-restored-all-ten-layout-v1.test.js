"use strict";
// S006 content checks moved to s006-communication-v2.test.js.
// Keep this file only for the legacy UI layout contract; no V1 Goal/Q7 assertions.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const css=read("css/dialogue-information.css");
assert(css.includes("--compact-two-row-height: 100.2px"));
assert(css.includes("--compact-three-row-height: 140px"));
const story=read("engine/stories/S006.js");
assert.equal((story.match(/C\.question\("s006\.communication\./g)||[]).length,10);
assert(story.includes('{ type: "s006EndingLetter" }'));
console.log("S006 Story connection and 100.2px / 140px layout contracts: PASS");
