"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const data = read("data/m004.js");
const extension = read("engine/services/m004-battle-extension.js");

assert(data.includes("completionSeHoldMs: 3600"),
  "Zephyr Go transition must begin 2.000s earlier, before the measured 4.2s main-tone end");
assert(data.includes("completionSeLeadMs: 6614"),
  "10.214s file length minus 3.600s start must document the 6.614s tail overlap");
assert(extension.includes('if (key === "monsterWarningReveal") return null;'),
  "m004 must suppress only its reveal/start SE");
assert(extension.includes('originalPlaySe("zephyrGo", { volume: 0.24 })'));

for (const forbidden of ["eyes", "nose", "mouth", "ears"])
  assert(data.includes(forbidden));

console.log("m004 Final Audio Timing Polish V1: PASS");
