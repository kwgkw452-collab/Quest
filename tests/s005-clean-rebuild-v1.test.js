"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const protectedBlobs = {
  "css/dialogue-information.css": "d98ab03c477edfbbe4d8580964e1a4b8d49b34cf",
  "css/fixed-game-stage.css": "ca8dd5fee019f67c0e87d552b407301d1caf108c",
  "css/style.css": "37750f000a4f1aa663f1a47719a66f93980ab881",
  "data/audio-mix-profile.js": "4ed8f6f6689d126d7197800491e0617bb97659ea",
  "data/audio.js": "238d950483ca8d3f20cdd103d6530cb7b8860b17",
  "data/backgrounds.js": "a9c0a6c72cac241aa613dabdc40d99a59eb743ef",
  "data/camps.js": "2fb125681b9ad7a9c00d4806d8fc19309ac58e6b",
  "data/characters.js": "3189602b435ab11dbc80c47ef05f55896b2c0e93",
  "data/communication-action-catalog.js": "aeb9af0b5cebf9dd2f05de504069cbaeb8808c7b",
  "data/communication-concept-catalog.js": "6b771b303dc98e97a9442eeafbc31ccd379f04ce",
  "data/communication-recognition-dictionaries.js": "3400aae8a5f069aa3e41d9cd47d1a378ecb9e00e",
  "data/communication-task-specs.js": "45bfe9516dab835589e0f6a106a9ad80ab0d945c",
  "data/communicative-judge-rules.js": "eaf606c0c265be3ee02f83c17dd99a8bbec9ac79",
  "data/effects.js": "d2671061e21d7655afab8d4b1cfb8d79a06539f1",
  "data/items.js": "0e9a06567ec450cb6b104a630f2950217ca2a238",
  "data/local-judge-profiles.js": "520317719db92492b67078f4e20ee02be59218bb",
  "data/lottery-pools.js": "b3f77397c3ef09d3bd48bbdf3108dcbec605c710",
  "data/m004.js": "288c27b281a7fde700336cbdb84e976babf60f45",
  "data/monster-library.json": "5847de534c5e93adb237106c8203f256559420cd",
  "data/monsters.js": "27ce478818754e40f30934ffe9e4c9183dc7d0fb",
  "data/mornings.js": "075e75eb5f822018ac253e7a1f3b325cf893e0a1",
  "data/pico-breaks.js": "d2a130f1765d6e5f1609e7088664ae39303dae96",
  "data/pico-support-profiles.js": "1007ea12239589c60a3927efdb48a14fbcbe0674",
  "data/poses.js": "6f00429e64166cba1a3bd122f422afac3f64f28c",
  "data/questions.js": "3f98b8ebe7aa2ea6a3b9cec1369a211059f4427b",
  "data/videos.js": "c2c0ae2db8791a51fe553393874c277c72869080",
  "data/voice-profiles.js": "1b98fd71bed9709d6bd0a33499eeaa7b37684caa",
  "data/word-dictionaries.js": "0d0babcb1caa2e66e87d432004167d2ba1f657a4",
  "engine/commands/story-commands.js": "7fb778b8ecf5faae0de404fb97df4945f72aac43",
  "engine/config.js": "4242bd64a1b02e69fb24d373b5bb9c59de4aa551",
  "engine/controllers/communication-task-progress-controller.js": "d75c92b8981ae0dced5a24fe9795647e67ffb493",
  "engine/controllers/communicative-question-flow-controller.js": "437d98216bd7323952d6be912e2025624be194f3",
  "engine/controllers/pico-support-controller.js": "3c1330f935c63199ae15abf8da2515aaf3a111b8",
  "engine/core/core.js": "4488586ff25cfbee8c54c9d33264ee42407ac140",
  "engine/core/event-system.js": "e741408e4749daa541c2d1cf53dbb81367e7c94e",
  "engine/core/scene-manager.js": "1c746f8fd5612dbbe44d64c49306e06bfb66caef",
  "engine/core/story-compiler.js": "f15a006df58be0e191663620f0ceea4c6c4e5963",
  "engine/core/story-engine.js": "b920b0d524a8b85df60846b4f08809d9567ad6f5",
  "engine/core/story-events.js": "7958bc1cb1a5a995246490f7312fe9c63629b177",
  "engine/core/story-registry.js": "310824a57a768ab3af921542ad26134166f79193",
  "engine/managers/audio-manager.js": "8a738625f74b5d7875b6fbfbc7bf3cd2a225a343",
  "engine/managers/camp-manager.js": "daaf9474f59962c93ffbf09a89cae62b716c228b",
  "engine/managers/character-manager.js": "4ae1a427dd3d0ef4a02f5d3c3da44491e7bf8ce3",
  "engine/managers/dialog-manager.js": "308d0d1f5e8257094aec08c8eef19498c47b7f13",
  "engine/managers/effect-manager.js": "6f89fce14c1f32735d316ce2f4d82af1256d4132",
  "engine/managers/monster-battle-manager.js": "3a9b75855a69314d1b6adae593e9595858e79ad5",
  "engine/managers/monster-battle-presenter.js": "b93fe4ffa8ba469bb33ce6338a724c35877b3ff0",
  "engine/managers/monster-manager.js": "adc3fec79ec9eca862e04b2aaef0dff336dbf17f",
  "engine/managers/morning-manager.js": "1f276c0cb8e0802c13425eab43e30d344592987a",
  "engine/managers/pico-break-manager.js": "d63d50b62dd4d1c14e9d1245fef04fb8448a9ce5",
  "engine/managers/question-manager.js": "3d8859ff4805031b7958968b74aa8a13819d91a6",
  "engine/managers/save-manager.js": "46e5d3141925e12807ac048da151984487dc91a4",
  "engine/managers/video-manager.js": "a333690d49ba0789f60076c6227658ff3145d3dd",
  "engine/presenters/communication-task-presenter.js": "7e971d039c6f70d5c3ce278b74aea5ea623f03d4",
  "engine/presenters/communicative-question-presenter.js": "c681f525770549131dd552cec2aa657516d77633",
  "engine/services/asset-resolver.js": "184038192372fe3b6a58eaba004f4f18dd953191",
  "engine/services/communication-judge-adapter.js": "0dd6911779d9ead60ed5f0b7725e916a8d94036c",
  "engine/services/communication-judge-gateway.js": "702dbccd8590fddbbbfb7533ece5e0cd0e646b6f",
  "engine/services/communicative-judge.js": "66de53ecd3630f1eebd9552d446857814e7ec7c6",
  "engine/services/communicative-question-adapter.js": "fa07f9984710b6b59cc45dd21fda4e931098a674",
  "engine/services/dialogue-voice-controller.js": "e6c08cbcdf8e4674b767458fbc32eedab239acf8",
  "engine/services/legacy-speech-trace.js": "caa33ca56cf7deb8994e67481dcac5345e90aca9",
  "engine/services/local-communication-judge-provider.js": "28ddc6ddcdfd28aa8435d91c59f4abf3edc372df",
  "engine/services/local-communicative-judge.js": "68a5531ee810caac7765ded70d25ac9bdc4c945f",
  "engine/services/local-pico-support-provider.js": "21d5e15d5725450c789c364f7a7a47b080fdaabe",
  "engine/services/lottery-engine.js": "8072ec55acc9108a8550953eca1cfb056e10ffb1",
  "engine/services/m004-battle-extension.js": "b402b8047aa549f42f1b85e90ab582d18ec1d0a3",
  "engine/services/monster-battle-data.js": "07ae7aa986cc15ed4bb3590f5778cf92aa344a5d",
  "engine/services/opening.js": "8a45ffd6bc3203ba338dd99d815437d496f39038",
  "engine/services/pico-break-catalog.js": "4057e6bffaedb8c0660b49d5133e9e35bdee5ab7",
  "engine/services/pico-break-store.js": "fd721ea1a4a95555682efee54159a22868d105d4",
  "engine/services/speech-engine.js": "a628eb19c9d8cf07c691003fd6ecb8a040ba9637",
  "engine/services/speech-normalizer.js": "2201e53a73be1a5894eb8a564ca3ed5679685ee0",
  "engine/services/speech-recognition-adapter.js": "e9cefc56238609da7b277949ffd7c62dfc64bfea",
  "engine/services/speech-start-controller.js": "c729047fda63131f86e66ac4f82ef97cff24ec82",
  "engine/services/speech.js": "26301ab5040d3becd2f26ef1f9f2c1be6330b958",
  "engine/services/support-focus-resolver.js": "c8b6ef16f516daf9819bed954ac211df722fc76b",
  "engine/stories/S000_TEMPLATE.js": "0eb5254c54be98b11be81684d99afe1b953915ce",
  "engine/stories/S001.js": "ee4ae43f75d971b87f2463180cca129caafb03e7",
  "engine/stories/S002.js": "1d5dd872fbe94fc2b50f7e50dab6ec728b59ed9f",
  "engine/stories/S003.js": "4e086522ae49f6b8fdf67a2683567f9cd79739d4",
  "engine/stories/S004.js": "019eeb7d10ad94b9c61eaaac4bc6eeb77606dfa5",
  "engine/stories/m001.js": "04044849da8e3d7ed9b405cd45b049b9bec641fa",
  "engine/stories/m004.js": "a77452e958bfb0306b7f385441999df66701b377",
  "engine/stories/story-saki-departure.js": "2bd6e18b6c3ff19a5fb3b75f3496a2917bb69435",
  "js/fixed-game-stage.js": "84cf656809f86d644d5f150205f4fa6c8c833d04",
  "js/main.js": "6575bbc113d8190faf06965cc1e948e6e99f8f28"
};
for (const [file, expected] of Object.entries(protectedBlobs)) {
  const bytes = fs.readFileSync(path.join(root, file));
  const hash = crypto.createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
  assert.equal(hash, expected, file + " must remain byte-identical to formal HEAD 006d312");
}
const story = fs.readFileSync(path.join(root, "engine/stories/S005.js"), "utf8");
assert.equal((story.match(/function\s*\(/g) || []).length, 1, "Only the conventional Story registration wrapper is allowed");
assert(!/\bif\s*\(|\bnew\s+|\bsetTimeout\b|\bconsole\.|onEnter|onComplete|onExit|Controller|Presenter|SpeechEngine|QuestionDatabase|CommunicativeJudgeRuleData|\.replace\s*\(/.test(story), "Story contains no runtime, judge, recovery, trace, callback or path patch");
assert.equal((story.match(/C\.sequence\(/g) || []).length, 11);
assert.equal((story.match(/C\.question\(/g) || []).length, 11);
for (const html of ["index.html", "dev.html"]) {
  const page = fs.readFileSync(path.join(root, html), "utf8");
  assert(page.indexOf("data/s005-communication.js") < page.indexOf("engine/stories/S005.js"));
  assert.equal((page.match(/data\/s005-communication\.js/g) || []).length, 1);
  assert(!page.includes("data/s005-communicative-judge-rules.js"));
}
assert(!fs.existsSync(path.join(root, "data/s005-communicative-judge-rules.js")), "Old S005 judge registration is removed");
console.log("S005 Clean Rebuild architecture: PASS (" + Object.keys(protectedBlobs).length + " shared files byte-identical; no Story-specific engine or callbacks)");
