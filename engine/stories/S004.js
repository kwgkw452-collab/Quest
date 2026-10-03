(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "S004",
    title: "バーニーの料理",
    nextStoryId: "st004",
    steps: [
      C.clear(),
      C.background("forest"),
      C.characters([
        { id: "pico", character: "pico", pose: "normal", className: "pos-left-low size-medium" },
        { id: "kong", character: "kong", pose: "normal", className: "pos-center-low size-medium" },
        { id: "saki", character: "saki", pose: "normal", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("", "一行は森の中を進んでいた。", { button: "先へ進む" }),

      C.clear(),
      C.background("s004CookingPlace"),
      C.dialogue("ピコ", "森の中に料理場があるピコ！", {
        button: "見てみる",
        supportText: "森の中に料理をする場所を見つけたよ。",
        supportSpeaker: "ピコ"
      }),
      C.characters([
        { id: "bernie", character: "bernie", pose: "apron", className: "s004-center-upper size-medium" }
      ]),
      C.bgm("bernieUncertain", { loop: true, volume: 0.60, fadeInMs: 900 }),
      C.dialogue("バーニー", "I'm Bernie.", {
        voiceKey: "voice_c04_s004_001",
        supportText: "僕はバーニー。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "I am a chef.", {
        voiceKey: "voice_c04_s004_002",
        supportText: "僕は料理人なんだ。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "I was a good chef. But I can't cook well now.", {
        voiceKey: "voice_c04_s004_003",
        supportText: "料理には自信があった。でも、今はうまく料理できないんだ。",
        supportSpeaker: "ピコ"
      }),
      C.characterImage("bernie", "sad"),
      C.dialogue("ピコ", "“Are you OK?”（大丈夫ですか？）と尋ねてみよう。", { button: "話す" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.are_you_ok", "askBernie"),
      C.bgm("bernieUncertain", { loop: true, volume: 0.60, fadeInMs: 600 }),
      C.dialogue("バーニー", "No...", {
        voiceKey: "voice_c04_s004_004",
        supportText: "ううん……。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "I can't cook well.", {
        voiceKey: "voice_c04_s004_005",
        supportText: "うまく料理ができないんだ。",
        supportSpeaker: "ピコ"
      }),

      C.characters([
        { id: "kong", character: "kong", pose: "surprised", className: "s004-left-upper size-medium" },
        { id: "bernie", character: "bernie", pose: "sad", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("コング", "Oh, no! I'm very hungry!", {
        voiceKey: "voice_c02_s004_001",
        supportText: "ああ！すごくお腹がすいた！",
        supportSpeaker: "ピコ"
      }),
      C.characters([
        { id: "saki", character: "saki", pose: "sad", className: "s004-left-upper size-medium" },
        { id: "bernie", character: "bernie", pose: "sad", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("サキ", "He looks sad.", {
        voiceKey: "voice_c03_s004_001",
        supportText: "悲しそうに見えるね。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "みんなでバーニーの料理を手伝うピコ！", { button: "料理を手伝う" }),

      C.characters([
        { id: "bernie", character: "bernie", pose: "apron", className: "pos-right-low size-medium" }
      ]),
      C.item("s004FryingPan01", "item-image"),
      C.dialogue("ピコ", "食材を英語で言って、バーニーを手伝おう！", { button: "食材を選ぶ" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("cooking.meat", "meatAdded", {
        supportMessages: [
          "肉の英語を思い出してみよう！肉、牛肉、豚肉、鶏肉のどれでもいいピコ！",
          "牛肉は英語で何と言うかな？最初の音は『ビ』だよ！",
          "beef（ビーフ）と言ってみよう！"
        ]
      }),
      C.bgm("bernieUncertain", { loop: true, volume: 0.60, fadeInMs: 600 }),
      C.item("s004FryingPan02", "item-image"),
      C.dialogue("バーニー", "Good! One more!", {
        voiceKey: "voice_c04_s004_006",
        supportText: "いいね！もう一つ！",
        supportSpeaker: "ピコ"
      }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("cooking.vegetable", "vegetableAdded", {
        supportMessages: [
          "知っている野菜の英語を思い出してみよう！",
          "玉ねぎは英語で何と言うかな？最初の音は『オ』だよ！",
          "onion（オニオン・玉ねぎ）と言ってみよう！"
        ]
      }),
      C.bgm("bernieUncertain", { loop: true, volume: 0.60, fadeInMs: 600 }),
      C.item("s004FryingPan03", "item-image"),
      C.dialogue("バーニー", "Great! One last food!", {
        voiceKey: "voice_c04_s004_007",
        supportText: "いいぞ！最後の食材だ！",
        supportSpeaker: "ピコ"
      }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("cooking.fruit", "fruitAdded", {
        supportMessages: [
          "知っているフルーツの英語を思い出してみよう！",
          "ももは英語で何と言うかな？最初の音は『ピー』だよ！",
          "peach（ピーチ・もも）と言ってみよう！"
        ]
      }),
      C.bgm("bernieUncertain", { loop: true, volume: 0.60, fadeInMs: 600 }),
      C.item("s004FryingPan04", "item-image"),
      C.dialogue("バーニー", "Now, I will cook!", {
        voiceKey: "voice_c04_s004_008",
        button: "バーニーに任せる",
        supportText: "さあ、僕が料理するよ！",
        supportSpeaker: "ピコ"
      }),
      C.effect("flash"),
      C.dialogue("バーニー", "I did it! The food is ready!", {
        voiceKey: "voice_c04_s004_009",
        button: "みんなで食べる",
        supportText: "できた！料理の完成だ！",
        supportSpeaker: "ピコ"
      }),

      C.clear(),
      C.background("s004CookingPlace"),
      C.item("s004MealEvent", "event-fullscreen"),
      C.dialogue("バーニー", "Is it good?", {
        voiceKey: "voice_c04_s004_010",
        supportText: "おいしい？",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "“Yes! It's good!”（はい！おいしいです！）と言ってみよう。", { button: "話す" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.yes_its_good", "praiseBernieFood"),
      C.dialogue("バーニー", "Thank you! I can cook!", {
        voiceKey: "voice_c04_s004_011",
        button: "話を聞く",
        supportText: "ありがとう！僕は料理できる！",
        supportSpeaker: "ピコ"
      }),
      C.hideDialogue(),
      C.se("zephyrSuccess", { volume: 0.27 }),
      C.wait(3000),
      C.bgm("bernieConfident", { loop: true, volume: 0.30, fadeInMs: 900, stopAllBefore: true, preDelayMs: 300 }),

      C.clear(),
      C.background("s004CookingPlace"),
      C.characters([
        { id: "kong", character: "kong", pose: "smile", className: "s004-left-upper size-medium" },
        { id: "bernie", character: "bernie", pose: "smile", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("コング", "There is a lot of food in the world!", {
        voiceKey: "voice_c02_s004_002",
        supportText: "世界にはたくさんの食べ物があるぞ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "French food! Italian food! Chinese food!", {
        voiceKey: "voice_c02_s004_003",
        supportText: "フランス料理！イタリア料理！中国料理！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "Fruits! Vegetables! Drinks!", {
        voiceKey: "voice_c02_s004_004",
        supportText: "果物！野菜！飲み物！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "And more!", {
        voiceKey: "voice_c02_s004_005",
        supportText: "ほかにもあるぞ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "Let's go and find them!", {
        voiceKey: "voice_c02_s004_006",
        supportText: "探しに行こう！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "Food from around the world...", {
        voiceKey: "voice_c04_s004_012",
        supportText: "世界の食べ物……。",
        supportSpeaker: "ピコ"
      }),
      C.characterImage("bernie", "surprised"),
      C.dialogue("バーニー", "I want to see it!", {
        voiceKey: "voice_c04_s004_013",
        supportText: "見てみたい！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "『一緒に行こう』を英語で言ってみよう。", { button: "話す" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.come_with_us", "inviteBernie"),
      C.bgm("bernieConfident", { loop: true, volume: 0.30, fadeInMs: 600 }),
      C.characterImage("bernie", "smile"),
      C.dialogue("バーニー", "Really!?", {
        voiceKey: "voice_c04_s004_014",
        supportText: "本当に！？",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "OK! I will go with you!", {
        voiceKey: "voice_c04_s004_015",
        supportText: "うん！みんなと一緒に行くよ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("バーニー", "I will cook for you!", {
        voiceKey: "voice_c04_s004_016",
        supportText: "みんなのために料理するよ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("", "バーニーが仲間に加わった！", { button: "S003を終了する" }),
      C.addCompanion(4),
      C.save(),
      C.stopBgm({ fadeOutMs: 700 }),
      C.monsterBattle("m003", "seasonTreeBattle")
    ]
  };

  StoryRegistry.register(story);
  window.S004 = story;
})();
