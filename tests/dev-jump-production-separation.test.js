const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");

const index = read("index.html");
const devHtml = read("dev.html");
const saveManager = read("engine/managers/save-manager.js");

assert(!index.includes("dev/dev-"));
assert(!index.includes("__EIGO_DEV_SAVE__"));
assert(index.includes('<script src="js/main.js"></script>'));
assert(devHtml.includes("__EIGO_DEV_SAVE__ = true"));
assert(devHtml.includes('<script src="dev/dev-jump-runtime-trace.js"></script>'));
assert(devHtml.includes('<script src="dev/dev-checkpoints.js"></script>'));
assert(devHtml.includes('<script src="dev/dev-jump-manager.js"></script>'));
assert(devHtml.includes('<script src="dev/dev-jump-ui.js"></script>'));
assert(!devHtml.includes('<script src="js/main.js"></script>'));
assert(!index.includes("dev-jump-runtime-trace"));
assert(read("dev/dev-jump-ui.js").includes('window.location.replace("index.html")'));

assert(saveManager.includes('"eigo-de-quest:dev-save:v1"'));
assert(saveManager.includes('"eigo-de-quest:save:v2"'));
const publicBlock = saveManager.slice(saveManager.indexOf("window.SaveManager ="));
["init", "load", "save", "reset", "getData", "setPlayerName", "setFlag", "getFlag",
 "addCompanion", "removeCompanion", "getCompanionIds", "addItem", "removeItem", "getItemCount",
 "registerMonster", "recordMonsterEncounter", "recordMonsterDefeat", "setProgress", "completeStory",
 "getStoryState", "exportData", "importData"].forEach(name => assert(publicBlock.includes(name + ":")));

const storyHashes = {
  "engine/stories/S001.js": "e7aae0d4f4bf81915bcdcec44254b1414135e4fbb1a80907fe306971e38a52e1",
  "engine/stories/S002.js": "bd05226b3e51d12a27e1504579f69cd97200231a68edecd8a8d6e6b2e7aaf525",
  "engine/stories/S003.js": "e532ff803cf57398d0cd457ba118a9ec004d484af27a77e6fce81dc5da5c991c",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905",
  "engine/stories/m001.js": "187c5139107ab8c6f8a35a758d4bc3976f164fe161dccb341926778456fa6e2a",
  "engine/stories/story-saki-departure.js": "a44a0787a94544fa7bcc8987e01088dd8af77aab90a605d3206e1fd7daa34fe4"
};
Object.entries(storyHashes).forEach(([file, expected]) => assert.strictEqual(hash(file), expected, file));

const audio = read("engine/managers/audio-manager.js");
const s001 = read("engine/stories/S001.js");
const opening = read("engine/services/opening.js");
assert(audio.includes("ratio: options.ratio === undefined ? 0.25"));
assert(audio.includes("duckMs: options.duckMs === undefined ? 300"));
assert(audio.includes("restoreMs: options.restoreMs === undefined ? 600"));
assert(opening.includes('volume: 0.23'));
assert.strictEqual((s001.match(/C\.bgm\("zephyrFields", \{ loop: true, volume: 0\.46/g) || []).length, 3);
assert(s001.includes('C.bgm("kongEmotionalSilentTears", { loop: true, volume: 0.52'));
assert(read("data/audio.js").includes("ambient_morning_garden_v2.mp3"));

console.log("dev-jump-production-separation.test.js: PASS");
