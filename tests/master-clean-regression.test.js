const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const story = fs.readFileSync(path.join(root, "engine/stories/S001.js"), "utf8");

assert(!index.includes('id="pico-break-demo"'), "product index must not contain the demo panel");
assert(!index.includes("js/pico-break-demo.js"), "product index must not load the demo script");
assert(index.includes('id="pico-break-layer"'), "production Pico Break UI must remain available");
assert(index.includes("engine/managers/pico-break-manager.js"), "Pico Break Manager must remain loaded");
assert(story.includes('C.camp("CAMP_001")'), "S001 must use the formal Camp command");
assert(story.includes('C.morning("MORNING_001")'), "S001 must temporarily connect Camp to formal Morning");
assert(!story.includes('backgroundSequence", items: ["camp"]'), "legacy Camp rendering must be removed");

console.log("Master clean regression test: PASS");
