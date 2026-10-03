"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const VERSION = "communicative-formal-runtime-unified-v1-legacy-speech-trace-v1";
const phaseA2Assets = new Set([
  "data/questions.js", "engine/services/local-communicative-judge.js",
  "engine/managers/question-manager.js", "engine/presenters/communicative-question-presenter.js",
  "engine/controllers/communicative-question-flow-controller.js"
]);
const fixedVersions = {
  "data/questions.js": "mobile-ui-story-polish-v1-1",
  "data/communicative-judge-rules.js": "s005-registry-instance-fix-v1",
  "engine/presenters/communicative-question-presenter.js": "mobile-ui-story-polish-v1-1",
  "engine/services/local-communicative-judge.js": "s005-rule-real-browser-trace-v1",
  "engine/services/communicative-judge.js": "s005-rule-real-browser-trace-v1",
  "engine/managers/question-manager.js": "s005-rule-real-browser-trace-v1"
};
const versioned = asset => `${asset}?v=${fixedVersions[asset] || (phaseA2Assets.has(asset) ? "s005-phase-a2-v1" : VERSION)}`;
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
  const expected = versioned(asset);
  assert.strictEqual(indexScripts.filter(value => value === expected).length, 1, `index loads ${expected} once`);
  assert.strictEqual(devScripts.filter(value => value === expected).length, 1, `dev loads ${expected} once`);
  assert.strictEqual(indexScripts.find(value => value.split("?")[0] === asset), expected, `index URL for ${asset}`);
  assert.strictEqual(devScripts.find(value => value.split("?")[0] === asset), expected, `dev URL for ${asset}`);
}

for (const list of [indexScripts, devScripts]) {
  let previous = -1;
  for (const asset of sharedAssets) {
    const current = list.indexOf(versioned(asset));
    assert(current > previous, `Formal dependency order: ${asset}`);
    previous = current;
  }
}

assert.strictEqual((indexHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 5);
assert.strictEqual((devHtml.match(/\?v=communicative-formal-runtime-unified-v1-legacy-speech-trace-v1/g) || []).length, 6);
assert(!indexHtml.includes("dev/formal-speech-trace.js"), "index must not load Formal trace");
assert(devHtml.includes("dev/formal-speech-trace.js?v=communicative-formal-trace-v1"), "dev keeps Formal trace");

const protectedHashes = {
  "data/questions.js": "7f94f150fff8ef7af49e4bd7f86614900eafb0fb1d3d772861142feb68d75904",
  "data/communicative-judge-rules.js": "acae74a247318a54ef09ac75c04c444c14dedc798c67abf3b793fc0529dd9279",
  "engine/services/speech-normalizer.js": "c891131b3fc76dafa87f4500e2f5913eb0d2d4d1ee94ae7350a5b2e6a6f61e6f",
  "engine/services/speech-recognition-adapter.js": "1261497515055b11c6caa0d26eb8773d848d656bc17ba7a5c9f7b53798b365ad",
  "engine/services/speech-engine.js": "3318e03a55a2506fccfeca2481d0b286e69074c63f5539d73b1b5b27e6371264",
  "engine/services/speech-start-controller.js": "73ea61ec3cc4a2532b220f298d2e48d8e66d03fac9901cbf4662bc89c65a883b",
  "engine/services/local-communicative-judge.js": "d124c63e412c4e6553026141361ab608da5603bd29854f93f6b8c06bf1f57e58",
  "engine/services/communicative-judge.js": "a8b8482768e480f609ff9b569774509a881d503769ca5f3452783ff94c7ecb04",
  "engine/services/communicative-question-adapter.js": "1fe6fbb7090c6d61c666771edcab963b23596ba399e59fa3650503d4c3473e3f",
  "engine/managers/question-manager.js": "98047b0cb21bd12f4fd5e2c432ea28836a6b82b7b0a3067639781ad538d87c6d",
  "engine/presenters/communicative-question-presenter.js": "8272cb38358bd5f4e4190a826e75bd07143eee3f8fd1f24e731e9263413a2e67",
  "engine/controllers/communicative-question-flow-controller.js": "8bf9a35dc37a6296b8afc0924e41824f3ae8a7a71f5eefbc5a624f05828f200e",
  "engine/core/story-engine.js": "ecca2bac442d5002fec99d8f9e826756bee6afd2efd24a093c187d041f5afbeb",
  "engine/stories/S004.js": "ca801b7658fe1bddf98cf8c21ee1794adf602b68afa5a7f94599758fb3437070",
  "data/monsters.js": "af1afabcf11f4536eacb69b8370c465273b1b9adce8e98b94b69bac4e38b8073",
  "data/mornings.js": "89007415f111ab883dd2a10b47e9a7026608bfd377dd8ee1ec7ad0f5d9027470",
  "engine/managers/monster-battle-manager.js": "0451a45a75e35c9c4418f40126e55d8659cbbf407deca78089f9c12058026ee3",
  "engine/managers/morning-manager.js": "f123747d417d3aa632d84ca828ffa0ff85c8b14f62753ad8a77655e56e819856"
};
for (const [file, expected] of Object.entries(protectedHashes)) {
  assert.strictEqual(hash(file), expected, `${file} content remains unchanged`);
}

console.log("Formal Communicative Runtime Version Unified V1: PASS");
