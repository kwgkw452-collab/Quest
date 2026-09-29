"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { console, window: {} };
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

[
  "data/poses.js",
  "data/characters.js",
  "data/effects.js",
  "engine/services/asset-resolver.js"
].forEach(load);

const expectedPoses = [
  ["01", "normal"], ["02", "smile"], ["03", "surprised"],
  ["04", "sad"], ["05", "smug"], ["06", "crying"],
  ["07", "applause"], ["08", "inactive"], ["09", "sideWalk"],
  ["10", "intimidate"], ["11", "apron"]
];

assert.deepStrictEqual(
  Array.from(context.PoseDatabase.all(), pose => [pose.id, pose.key]),
  expectedPoses
);
expectedPoses.forEach(([id, key]) => {
  const pose = context.PoseDatabase.get(id);
  assert.strictEqual(pose.key, key);
  assert.strictEqual(context.PoseDatabase.get(key).id, id);
  ["englishName", "japaneseName", "purpose"].forEach(field => assert(pose[field]));
  assert.strictEqual(context.CharacterDatabase.poses[key], id);
});

assert.deepStrictEqual(
  Array.from(context.CharacterDatabase.all(), character => [character.id, character.key]),
  [[1, "pico"], [2, "kong"], [3, "saki"], [4, "bernie"]]
);
const bernie = context.CharacterDatabase.get(4);
assert.strictEqual(context.CharacterDatabase.get("bernie").id, 4);
assert.strictEqual(bernie.folder, "images/characters/bernie");
assert.strictEqual(bernie.filePrefix, "bernie_");
assert.deepStrictEqual(Array.from(bernie.availablePoses), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11"]);
assert.strictEqual(context.PoseDatabase.get("10").key, "intimidate");
assert.strictEqual(context.PoseDatabase.get("11").key, "apron");
assert.strictEqual(context.AssetResolver.character(4, "06"), "images/characters/bernie/bernie_06.png");
assert.strictEqual(context.AssetResolver.character(4, "apron"), "images/characters/bernie/bernie_11.png");
assert(fs.existsSync(path.join(root, context.AssetResolver.character(4, "06"))));
assert(fs.existsSync(path.join(root, context.AssetResolver.character(4, "apron"))));

assert.deepStrictEqual(Object.keys(context.EffectDatabase), ["flash", "shake", "number-monster-hit", "fadeOut"]);
function plain(value) { return JSON.parse(JSON.stringify(value)); }
assert.deepStrictEqual(plain(context.AssetResolver.effect("flash")), { key: "flash", className: "screen-flash", duration: 550 });
assert.deepStrictEqual(plain(context.AssetResolver.effect("shake")), { key: "shake", className: "shake", duration: 600 });
assert.deepStrictEqual(plain(context.AssetResolver.effect("number-monster-hit")), { key: "number-monster-hit", className: "number-monster-hit", duration: 600 });
assert.deepStrictEqual(plain(context.AssetResolver.effect("fadeOut")), { key: "fadeOut", className: "fade-out", duration: 900 });

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(indexSource.indexOf('src="data/poses.js"') < indexSource.indexOf('src="data/characters.js"'));

console.log("ID / Asset Database Phase 1 test: PASS");
