const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const library = JSON.parse(fs.readFileSync(path.join(root, "data/monster-library.json"), "utf8"));

assert.strictEqual(library.length, 25, "Monster Library must preserve all 25 candidates");
assert.strictEqual(new Set(library.map(item => item.library_key)).size, 25, "library_key must be unique");
assert.deepStrictEqual(library.map(item => item.library_order), Array.from({ length: 25 }, (_, i) => i + 1));
assert.strictEqual(library[6].library_key, "candidate-007");
assert.strictEqual(library[6].library_order, 7);
assert.strictEqual(library[6].name_jp, "シーズン・ツリー");
assert(!Object.prototype.hasOwnProperty.call(library[6], "monster_id"));

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(!index.includes("monster-library.json"), "Runtime must not load candidate Monster Library data");

for (const file of fs.readdirSync(path.join(root, "engine/stories")).filter(name => name.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(root, "engine/stories", file), "utf8");
  assert(!source.includes("library_key") && !source.includes("library_order"),
    "Story must not depend on Monster Library identifiers: " + file);
}

console.log("Monster Library separation test: PASS");
