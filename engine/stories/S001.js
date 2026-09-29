(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "S001",
    title: "第1話",
    nextStoryId: "m001",
    steps: [
      C.clear(),
      C.background("morningRoom"),
      C.bgm("morningGardenAtmosphere", { loop: true, volume: 1.00, fadeInMs: 700 }),
      C.dialogue("", "ある朝起きてみると、謎の地図とメッセージが...", { button: "調べる" }),
      C.item("mysteryBook"),
      C.dialogue("", "ある朝起きてみると、謎の地図とメッセージが...", { button: "本を開く" }),
      C.dialogue("", "\"Go to the forest\"の言葉に導かれるかのように冒険の旅に出た", { button: "出発する" }),

      C.hideDialogue(),
      C.stopBgm({ fadeOutMs: 700 }),
      C.clear(),
      C.bgm("zephyrFields", { loop: true, volume: 0.46, fadeInMs: 900 }),
      C.backgroundSequence(["city", "suburb", "country", "forest"]),
      C.stopBgm({ fadeOutMs: 700 }),
      C.wait(250),

      C.characters([
        { id: "pico", character: "pico", pose: "inactive", className: "pos-center-low size-medium" }
      ]),
      C.se("picoEntrance", { volume: 0.48 }),
      C.wait(3000),
      C.bgm("zephyrFields", { loop: true, volume: 0.46 }),
      C.question("word.hello", null, { speechDucking: { restore: false } }),
      C.characterImage("pico", "normal"),
      C.se("picoWakeUp", { volume: 0.50 }),
      C.effect("flash"),
      C.dialogue("ピコ", "マスター！声を聞かせてくれてありがとう！あなたの声で目覚めることができた！"),
      C.addCompanion(1),

      C.bgm("zephyrFields", { loop: true, volume: 0.46, fadeInMs: 600 }),
      C.wait(1200),
      C.stopBgm({ fadeOutMs: 500 }),
      C.wait(250),
      C.se("kongEntrance", { volume: 0.33 }),
      C.characters([
        { id: "kong", character: "kong", pose: "intimidate", className: "pos-center-low size-medium" }
      ]),
      C.effect("shake"),
      C.wait(400),
      C.bgm("kongEmotionalSilentTears", { loop: true, volume: 0.52, fadeInMs: 900 }),
      C.dialogue("コング", "WHERE ARE YOU FROM!?", { voiceKey: "voice_c02_s001_001", supportText: "どこから来たんだ！？" }),
      C.dialogue("ピコ", "マスター！どこから来たのか尋ねているよ！"),
      C.dialogue("ピコ", "マスター！思い切って 'Japan' って叫ぶんだ！", { button: "わかった" }),
      C.question("word.japan", null, { speechDucking: { restore: true } }),
      C.characterImage("kong", "crying"),
      C.dialogue("コング", "My body is so big. But I am very shy. I want friends. But I say something, people go away... why?", { voiceKey: "voice_c02_s001_002", supportText: "俺は体がすごく大きい。でも、とても恥ずかしがり屋なんだ。友達がほしい。でも何か言うと、みんな離れていく……どうしてだ？" }),
      C.characterImage("kong", "normal"),
      C.dialogue("コング", "What's your name?", { button: "名前を答える", voiceKey: "voice_c02_s001_003", supportText: "お前の名前は？" }),
      C.confirmSpeechName("マイクに向かって、コングに教えたい名前を言ってね。", "playerName", { speechDucking: { restore: false } }),
      C.dialogue("コング", function (state) { return state.playerName + "! Friend!? Are you my friend?"; }, { button: "答える" }),
      C.question("word.yes", null, { speechDucking: { restore: false } }),
      C.dialogue("コング", "My friend! Let's go!", { voiceKey: "voice_c02_s001_005", supportText: "我が友よ！行こうぜ！" }),
      C.hideDialogue(),
      C.stopBgm({ fadeOutMs: 500 }),
      C.wait(250),
      C.se("zephyrFriendship", { volume: 0.31 }),
      C.wait(3000),
      C.dialogue("", "コングが仲間に加わった！", { button: "夜のキャンプへ" }),
      C.addCompanion(2),
      C.stopBgm(),
      C.camp("CAMP_001"),
      // Ver.1.1の正式起動はContinue時。S001では実画面確認のため一時接続する。
      C.morning("MORNING_001")
    ]
  };

  StoryRegistry.register(story);
  window.S001 = story;
})();
