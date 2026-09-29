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

load("data/poses.js");
load("data/characters.js");

const bernie = context.CharacterDatabase.get(4);
assert(bernie);
assert.strictEqual(bernie.id, 4);
assert.strictEqual(bernie.key, "bernie");
assert.strictEqual(bernie.name, "バーニー");
assert.strictEqual(bernie.folder, "images/characters/bernie");
assert.strictEqual(bernie.filePrefix, "bernie_");
assert.strictEqual(bernie.extension, ".png");
assert.strictEqual(bernie.defaultPose, "normal");
assert.deepStrictEqual(Array.from(bernie.availablePoses),
  ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11"]);

bernie.availablePoses.forEach(id => {
  assert(fs.existsSync(path.join(root, bernie.folder, bernie.filePrefix + id + bernie.extension)),
    "Bernie pose image must exist: " + id);
});

const s004 = fs.readFileSync(path.join(root, "engine/stories/S004.js"), "utf8");
["normal", "smile", "surprised", "sad", "apron"].forEach(pose => {
  assert(s004.includes('pose: "' + pose + '"') || s004.includes('"bernie", "' + pose + '"'),
    "S004 Bernie pose must remain available: " + pose);
});
assert(s004.includes('character: "bernie"'));
assert(s004.includes('pose: "apron"'));
assert(!/barney/i.test(s004));

console.log("Bernie graphics replacement test: PASS");
