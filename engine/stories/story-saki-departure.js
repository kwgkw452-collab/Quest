(function () {
  "use strict";

  var C = StoryCommands;

  function answered(state, resultKey, word) {
    var result = state[resultKey];
    return SpeechNormalizer.includesAny(result && result.answer, [word]);
  }

  function choseKey(resultKey) {
    return function (state) { return answered(state, resultKey, "key"); };
  }

  var mapKeyEvent = C.sequence([
    C.stopBgm({ fadeOutMs: 700 }),
    C.wait(300),
    C.characters([]),
    C.background("images/004/s004_mysterious_bazaar_shop.png"),
    C.se("mysteryShopSting", { volume: 0.45 }),
    C.dialogue("店主", "I'm waiting for you.", { voiceKey: "voice_c06_st004_001", supportText: "待っていたぞ。" }),
    C.background("images/004/s004_map_key_choice_final.png"),
    C.dialogue("店主", "Which do you want?", { voiceKey: "voice_c06_st004_002", supportText: "どちらがほしい？" }),
    C.question("word.map_or_key", "mapKeyChoice1"),
    C.branch(choseKey("mapKeyChoice1"), [
      C.dialogue("ピコ", "その鍵、気になるピコ！"),
      C.dialogue("ピコ", "でも、今は旅を続けるためのものが必要だピコ。"),
      C.dialogue("店主", "Which do you want?", { voiceKey: "voice_c06_st004_003", supportText: "どちらがほしい？" }),
      C.question("word.map_or_key", "mapKeyChoice2"),
      C.branch(choseKey("mapKeyChoice2"), [
        C.dialogue("ピコ", "道がわかるものは、どっちかな？"),
        C.dialogue("店主", "Which do you want?", { voiceKey: "voice_c06_st004_004", supportText: "どちらがほしい？" }),
        C.question("word.map_or_key", "mapKeyChoice3"),
        C.branch(choseKey("mapKeyChoice3"), [
          C.dialogue("ピコ", "今は MAP を選んで！"),
          C.dialogue("ピコ", "“Map.” と言ってみよう！"),
          C.question("word.map_only", "finalMapChoice"),
          C.dialogue("店主", "OK.", { voiceKey: "voice_c06_st004_005", supportText: "わかった。" })
        ], [
          C.dialogue("店主", "OK.", { voiceKey: "voice_c06_st004_006", supportText: "わかった。" })
        ])
      ], [
        C.dialogue("店主", "OK.", { voiceKey: "voice_c06_st004_007", supportText: "わかった。" })
      ])
    ], [
      C.dialogue("店主", "OK.", { voiceKey: "voice_c06_st004_008", supportText: "わかった。" })
    ])
  ]);

  var story = {
    id: "st004",
    title: "004 サキの旅立ち",
    nextStoryId: "m004",
    steps: [
      C.clear(),
      C.characters([]),
      C.background("images/004/s004_ethnic_bazaar_overview_illustrated.png"),
      C.bgm("bazaarCrowd", { loop: true, volume: 0.55, fadeInMs: 500 }),
      C.wait(3500),
      C.bgm("bazaarMiddleEast", { loop: true, volume: 0.08, crossfadeMs: 1200 }),
      C.wait(1200),
      C.dialogue("コング", "Wow!", { voiceKey: "voice_c02_st004_001", supportText: "わあ！" }),
      C.dialogue("コング", "I want to eat bananas.", { voiceKey: "voice_c02_st004_002", supportText: "バナナが食べたい！" }),
      C.dialogue("バーニー", "So much food!", { voiceKey: "voice_c04_st004_001", supportText: "食べ物がいっぱいだ！" }),

      C.background("images/004/s004_kong_fruit_shop.png"),
      C.dialogue("コング", "Wow! Bananas!", { voiceKey: "voice_c02_st004_003", supportText: "わあ！バナナだ！" }),
      C.dialogue("コング", "I want to eat bananas!", { voiceKey: "voice_c02_st004_004", supportText: "バナナが食べたい！" }),
      C.dialogue("コング", "Banana, please!", { voiceKey: "voice_c02_st004_005", supportText: "バナナをください！" }),
      C.dialogue("店員", "Ten gold.", { voiceKey: "voice_c07_st004_001", supportText: "10ゴールドです。" }),
      C.dialogue("コング", "Ten!?", { voiceKey: "voice_c02_st004_006", supportText: "10ゴールド！？" }),
      C.dialogue("コング", "OK!", { voiceKey: "voice_c02_st004_007", supportText: "わかった！" }),

      C.background("images/004/s004_bernie_ingredient_shop.png"),
      C.dialogue("バーニー", "What's this?", { voiceKey: "voice_c04_st004_002", supportText: "これは何？" }),
      C.dialogue("店員", "Dragon pepper.", { voiceKey: "voice_c07_st004_002", supportText: "ドラゴンペッパーです。" }),
      C.dialogue("バーニー", "Dragon pepper?", { voiceKey: "voice_c04_st004_003", supportText: "ドラゴンペッパー？" }),
      C.dialogue("店員", "Very hot!", { voiceKey: "voice_c07_st004_003", supportText: "とても辛いですよ！" }),
      C.dialogue("バーニー", "I want it!", { voiceKey: "voice_c04_st004_004", supportText: "それがほしい！" }),

      C.background("images/004/s004_orange_banana_choice.png"),
      C.dialogue("店員", "Which do you like better?", { voiceKey: "voice_c07_st004_004", supportText: "どちらのほうが好きですか？" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("word.orange_or_banana", "fruitShopChoice"),
      C.bgm("bazaarMiddleEast", { loop: true, volume: 0.08, fadeInMs: 600 }),
      C.dialogue("店員", "OK!", { voiceKey: "voice_c07_st004_005", supportText: "わかりました！" }),

      C.background("images/004/s004_bazaar_rumor_scene.png"),
      C.dialogue("旅人A", "There is a black forest in the north.", { voiceKey: "voice_c08_st004_001", supportText: "北には黒い森があるよ。" }),
      C.dialogue("旅人B", "People see a blue light in the desert at night.", { voiceKey: "voice_c09_st004_001", supportText: "夜の砂漠では、青い光が見えるよ。" }),
      C.dialogue("旅人C", "There is an old castle in the mountains.", { voiceKey: "voice_c10_st004_001", supportText: "山には古い城があるよ。" }),

      C.background("images/004/s004_saki_bazaar_conversation.png"),
      C.dialogue("現地の女性", "Where are you from?", { voiceKey: "voice_c11_st004_001", supportText: "どこから来たの？" }),
      C.dialogue("サキ", "I'm from Future City.", { voiceKey: "voice_c03_st004_001", supportText: "未来都市から来たの。" }),
      C.dialogue("現地の女性", "Do you like this town?", { voiceKey: "voice_c11_st004_002", supportText: "この街は好き？" }),
      C.dialogue("サキ", "Yes! I love it!", { voiceKey: "voice_c03_st004_002", supportText: "うん！大好き！" }),
      C.dialogue("現地の女性", "Me too!", { voiceKey: "voice_c11_st004_003", supportText: "私も！" }),
      C.dialogue("サキ", "It's fun!", { voiceKey: "voice_c03_st004_003", supportText: "楽しい！" }),
      C.dialogue("ピコ", "Let's go!", { voiceKey: "voice_c01_st004_001", supportText: "行こうピコ！" }),

      mapKeyEvent,
      C.background("images/004/s004_ethnic_bazaar_overview_illustrated.png"),
      C.bgm("bazaarMiddleEast", { loop: true, volume: 0.08, fadeInMs: 700 }),
      C.characters([
        { id: "pico", character: "pico", pose: "normal", className: "st004-saki-pico-low size-medium" },
        { id: "saki", character: "saki", pose: "normal", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("ピコ", "Saki?", { voiceKey: "voice_c01_st004_002", supportText: "サキ？" }),
      C.dialogue("サキ", "Yes...", { voiceKey: "voice_c03_st004_004", supportText: "うん……。" }),
      C.dialogue("サキ", "Master...", { voiceKey: "voice_c03_st004_005", supportText: "マスター……。" }),
      C.dialogue("サキ", "I love this town.", { voiceKey: "voice_c03_st004_006", supportText: "この街が大好き。" }),
      C.dialogue("サキ", "I want to talk with many people.", { voiceKey: "voice_c03_st004_007", supportText: "もっとたくさんの人と話したい。" }),
      C.dialogue("サキ", "I want to stay here.", { voiceKey: "voice_c03_st004_008", supportText: "ここにいたい。" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.stay_here", "askSakiStay", {
        supportMessages: [
          "『いる』は “stay” を使うよ！",
          "“stay” と “here” を使ってみよう！",
          "“Stay here?” と言ってみよう！"
        ]
      }),
      C.bgm("bazaarMiddleEast", { loop: true, volume: 0.08, fadeInMs: 600 }),
      C.dialogue("サキ", "Yes.", { voiceKey: "voice_c03_st004_009", supportText: "うん。" }),

      C.characters([]),
      C.background("images/004/s004_saki_headset_call_final.png"),
      C.dialogue("サキ", "Pico?", { voiceKey: "voice_c03_st004_010", supportText: "ピコ？", voiceEffect: "radio" }),
      C.dialogue("ピコ", "Yes?", { voiceKey: "voice_c01_st004_003", supportText: "なにピコ？", voiceEffect: "radio" }),
      C.dialogue("サキ", "Call me!", { voiceKey: "voice_c03_st004_011", supportText: "私に連絡してね！", voiceEffect: "radio" }),
      C.dialogue("ピコ", "OK!", { voiceKey: "voice_c01_st004_004", supportText: "わかったピコ！", voiceEffect: "radio" }),
      C.dialogue("サキ", "Can you hear me?", { voiceKey: "voice_c03_st004_012", supportText: "私の声が聞こえる？", voiceEffect: "radio" }),
      C.dialogue("ピコ", "Yes! I can hear you!", { voiceKey: "voice_c01_st004_005", supportText: "うん！聞こえるピコ！", voiceEffect: "radio" }),
      C.dialogue("サキ", "It's not goodbye.", { voiceKey: "voice_c03_st004_013", supportText: "さよならじゃないよ。" }),
      C.dialogue("サキ", "See you again, Master!", { voiceKey: "voice_c03_st004_014", supportText: "またね、マスター！" }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.farewell_saki", "farewellSaki", {
        supportMessages: [
          "お別れするときの英語だよ！",
          "“Bye!” や “See you!” でもいいよ！",
          "“Goodbye!” って言ってみよう！"
        ]
      }),

      C.dialogue("サキ", "Thank you!", { voiceKey: "voice_c03_st004_015", supportText: "ありがとう！" }),
      C.dialogue("サキ", "See you!", { voiceKey: "voice_c03_st004_016", supportText: "さようなら！" }),
      C.hideDialogue(),
      C.se("zephyrDeparture", { volume: 0.27 }),
      C.wait(3000),
      C.background("images/004/s004_ethnic_bazaar_overview_illustrated.png"),
      C.characters([
        { id: "saki", character: "saki", pose: "sideWalk", className: "pos-center-low size-medium" }
      ]),
      C.dialogue("街の人", "Hello!", { voiceKey: "voice_c12_st004_001", supportText: "こんにちは！" }),
      C.characterImage("saki", "smile"),
      C.dialogue("サキ", "Hello!", { voiceKey: "voice_c03_st004_017", supportText: "こんにちは！" }),

      C.removeCompanion(3),
      C.save(),
      C.characters([
        { id: "pico", character: "pico", pose: "normal", className: "st004-farewell-pico size-medium" },
        { id: "kong", character: "kong", pose: "normal", className: "pos-center-low size-medium" },
        { id: "bernie", character: "bernie", pose: "normal", className: "pos-right-low size-medium" }
      ]),
      C.dialogue("ピコ", "ちょっと寂しくなったピコ……。"),
      C.dialogue("ピコ", "Let's go, Master!", { voiceKey: "voice_c01_st004_006", supportText: "行こう、マスター！" }),
      C.hideDialogue(),
      C.se("zephyrGo", { volume: 0.25, stopAllBefore: true }),
      C.wait(3000),
      C.dialogue("サキ（遠くから）", "See you, Master!", { button: "004を終了する", voiceKey: "voice_c03_st004_018", supportText: "さようなら、マスター！" }),
      C.effect("fadeOut")
    ]
  };

  StoryRegistry.register(story);
  window.st004 = story;
})();
