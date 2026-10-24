"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const VERSION = "communicative-formal-runtime-unified-v1-legacy-speech-trace-v1";
const sharedAssets = [
  "data/questions.js",
  "data/communicative-judge-rules.js",
  "engine/services/speech-normalizer.js",
  "engine/services/speech-recognition-adapter.js",
  "engine/services/speech-engine.js",
  "engine/services/speech-start-controller.js",
  "engine/services/local-communicative-judge.js",
  "engine/services/communicative-judge.js",
  "engine/services/communicative-question-adapter.js",
  "engine/managers/question-manager.js",
  "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
];

function scripts(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), match => match[1]);
}

const indexHtml = read("index.html");
const devHtml = read("dev.html");
const indexScripts = scripts(indexHtml);
const devScripts = scripts(devHtml);

assert.strictEqual(indexScripts.filter(value => value === "engine/core/story-engine.js?v=adventure-return-fix-v1").length, 1);
assert.strictEqual(devScripts.filter(value => value === `engine/core/story-engine.js?v=${VERSION}`).length, 1);

for (const asset of sharedAssets) {
  const expected = `${asset}?v=${VERSION}`;
  assert.strictEqual(indexScripts.filter(value => value === expected).length, 1, `index loads ${expected} once`);
  assert.strictEqual(devScripts.filter(value => value === expected).length, 1, `dev loads ${expected} once`);
  assert.strictEqual(indexScripts.find(value => value.split("?")[0] === asset), expected, `index URL for ${asset}`);
  assert.strictEqual(devScripts.find(value => value.split("?")[0] === asset), expected, `dev URL for ${asset}`);
}

for (const list of [indexScripts, devScripts]) {
  let previous = -1;
  for (const asset of sharedAssets) {
    const current = list.indexOf(`${asset}?v=${VERSION}`);
    assert(current > previous, `Formal dependency order: ${asset}`);
    previous = current;
  }
}

assert.strictEqual((indexHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 12);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 13);
assert(!indexHtml.includes("dev/formal-speech-trace.js"), "index must not load Formal trace");
assert(devHtml.includes("dev/formal-speech-trace.js?v=communicative-formal-trace-v1"), "dev keeps Formal trace");

const protectedHashes = {
  "data/questions.js": "4c3387cce771b78dfaf7e33933a9df43da0defda28b487de84e5ac0b2a611c18",
  "data/communicative-judge-rules.js": "86488ef0705d709fac04183cdd0ccd90edf1de4a236b3e1015d84589d159a828",
  "engine/services/speech-normalizer.js": "c891131b3fc76dafa87f4500e2f5913eb0d2d4d1ee94ae7350a5b2e6a6f61e6f",
  "engine/services/speech-recognition-adapter.js": "c3670904dcbaf6880d5f4486122bae82c707dfc362273334f804e0bba52285d3",
  "engine/services/speech-engine.js": "3e1c4f063d048d79cb2b88e5e7786b5f8d66016191bbac619a114d7a2df5f496",
  "engine/services/speech-start-controller.js": "b241bc1f079eb9c4b645cb0084c62236994934b222f00589d1d1bb2934fee450",
  "engine/services/local-communicative-judge.js": "034cbf4431bcb6d5a1ab3d9afdc8526665d8ea357959383f11faa13fc3baa4d6",
  "engine/services/communicative-judge.js": "e37901643b7df9799ff9ad743508b0414e58b952777aa81ab97b74dadc218542",
  "engine/services/communicative-question-adapter.js": "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f",
  "engine/managers/question-manager.js": "5821246389f2ca4e622cc3c8b2e75302e244cea24e502737323b37f9f46de6c8",
  "engine/presenters/communicative-question-presenter.js": "323a1947b8b09033387fd57899b7a74412aa58cf11e9b7cd5d29843b08263653",
  "engine/controllers/communicative-question-flow-controller.js": "b674ea304e2097350149c7e59394c47bf7a2f5d387555c849d4ebb882936e1b3",
  "engine/core/story-engine.js": "ecca2bac442d5002fec99d8f9e826756bee6afd2efd24a093c187d041f5afbeb",
  "engine/stories/S004.js": "b004f23146691f28a420e8918dd61577ad0f45a9daee4af63e2c82c42b0cc905",
  "data/monsters.js": "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073",
  "data/mornings.js": "89007415f111ab883dd2a10b47e9a7026608bfd377dd8ee1ec7ad0f5d9027470",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} content remains unchanged`);
}

console.log("Formal Communicative Runtime Version Unified V1: PASS");
