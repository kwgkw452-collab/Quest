const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  setTimeout: fn => fn(),
  GameConfig: { defaultLanguage: "en-US" },
  SpeechNormalizer: {
    normalize: value => String(value).toLowerCase(),
    includesAny: (text, accepted) => accepted.indexOf(String(text).toLowerCase()) !== -1
  },
  SpeechRecognitionAdapter: { supported: true, stop: () => {} }
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "engine/services/speech-engine.js"), "utf8"),
  context,
  { filename: "speech-engine.js" }
);

(async () => {
  let heard = ["wrong", "hello"];
  let listens = 0;
  context.SpeechRecognitionAdapter.listen = async () => {
    listens += 1;
    return heard.shift();
  };
  const normal = await context.SpeechEngine.mission({ accepted: ["hello"] });
  assert.strictEqual(normal, "hello");
  assert.strictEqual(listens, 2, "normal Story mission must retry after mismatch");

  heard = ["wrong", "hello"];
  listens = 0;
  const single = await context.SpeechEngine.mission({
    accepted: ["hello"],
    retryOnMismatch: false
  });
  assert.strictEqual(single.matched, false);
  assert.strictEqual(single.answer, "wrong");
  assert.strictEqual(listens, 1, "Question mission must finish after one mismatch");

  context.SpeechRecognitionAdapter.listen = async options => {
    options.onAlternatives(["pair", "pear"]);
    return "pair";
  };
  const alternative = await context.SpeechEngine.mission({
    accepted: ["pear"],
    retryOnMismatch: false
  });
  assert.strictEqual(alternative.matched, true, "an accepted recognition alternative must be usable");
  assert.strictEqual(alternative.answer, "pear");

  console.log("Speech Engine retry contract tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
