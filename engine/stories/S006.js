(function () {
  "use strict";
  var C = StoryCommands;
  var story = {
    id: "S006",
    title: "S006 消えた赤いリボンの木箱",
    metadata: { perspective: "player", guests: ["player", "kong", "pico", "bernie"], nonGuestCompanions: [] },
    onExit: function (context) {
      if (window.S006Ending) S006Ending.cancel(context && context.state);
      try { if (window.SpeechEngine && typeof SpeechEngine.stop === "function") SpeechEngine.stop(); } catch (_) {}
    },
    steps: [
      // Scene 1
      [
        C.clear(),
        C.background("images/006/S006-Scene-01.png?v=s006-v22"),
        C.dialogue("", "祭りの翌日。電車、バス、馬車が集まる大ターミナル駅は大混雑。"),
        C.dialogue("Kong", "Wow! So many people!"),
        C.background("images/006/S006-Scene-02.png?v=s006-v22"),
        C.dialogue("Bernie", "Look at that line!"),
        C.dialogue("Pico", "切符を買うだけで日が暮れそうピコ！"),
        C.background("images/006/S006-Scene-03.png?v=s006-v22"),
        C.dialogue("", "荷物預かり所から、困った声が聞こえてくる。")
      ],
      // Scene 2
      [
        C.background("images/006/S006-Scene-04.png?v=s006-v22"),
        C.dialogue("Station Staff", "Here is your box."),
        C.dialogue("Little Monster", "No! That's not my box!"),
        C.dialogue("", "赤いリボンの木箱。しかし、カワウソの子は首を横に振る。"),
        C.dialogue("Station Staff", "But it has a red ribbon..."),
        C.dialogue("Pico", "困っているみたいピコ！"),
        C.question("s006.communication.1", "s006Challenge1"),
        C.dialogue("Station Staff", "Oh, thank you!")
      ],
      // Scene 3
      [
        C.background("images/006/S006-Scene-05.png?v=s006-v22"),
        C.dialogue("Little Monster", "It's a gift for my grandpa."),
        C.dialogue("", "食事の間になくさないよう、駅の預かり所に置いていたという。"),
        C.dialogue("Kong", "A gift?"),
        C.dialogue("Little Monster", "Yes. It's very special."),
        C.question("s006.communication.2", "s006Challenge2"),
        C.dialogue("Little Monster", "It's brown. It's a wooden box with a red ribbon.", { supportText: "茶色だよ。赤いリボンのついた木の箱なんだ。" }),
        C.dialogue("Pico", "赤いリボンが目印ピコ！")
      ],
      // Scene 4
      [
        C.background("images/006/S006-Scene-06.png?v=s006-v22"),
        C.dialogue("", "駅員が今日の荷物の記録を調べる。"),
        C.dialogue("Station Staff", "Oh no! Three boxes!"),
        C.dialogue("Bernie", "Three?"),
        C.dialogue("Station Staff", "They all have red ribbons."),
        C.dialogue("Pico", "似た木箱が3つあったピコ！"),
        C.question("s006.communication.3", "s006Challenge3"),
        C.dialogue("Station Staff", "One went to the train. I don't know about the other.")
      ],
      // Scene 5
      [
        C.background("images/006/S006-Scene-07.png?v=s006-v22"),
        C.dialogue("", "電車の荷物積み込み場。荷物係のそばに赤いリボンの木箱がある。"),
        C.dialogue("Kong", "There it is!"),
        C.question("s006.communication.4", "s006Challenge4"),
        C.dialogue("Worker", "Sure."),
        C.dialogue("Little Monster", "No. Not mine."),
        C.dialogue("Pico", "2つ目も違ったピコ……。")
      ],
      // Scene 6
      [
        C.background("images/006/S006-Scene-08.png?v=s006-v22"),
        C.dialogue("Worker", "We moved many boxes today."),
        C.dialogue("", "混雑で預かり荷物も発送荷物も、何台もの台車で運ばれたという。"),
        C.dialogue("Bernie", "Maybe the box is still here."),
        C.question("s006.communication.5", "s006Challenge5"),
        C.dialogue("Worker", "No. It's over there.", { supportText: "いいえ。あちらにあります。" })
      ],
      // Scene 7
      [
        C.background("images/006/S006-Scene-09.png?v=s006-v22"),
        C.dialogue("", "仕分け場には空の台車が並んでいる。"),
        C.dialogue("Bernie", "Look!"),
        C.dialogue("", "台車の金具に、赤いリボンの切れ端が引っかかっていた。"),
        C.dialogue("Kong", "A red ribbon!"),
        C.dialogue("Pico", "これは手がかりかもしれないピコ！"),
        C.question("s006.communication.6", "s006Challenge6"),
        C.dialogue("Station Staff", "It may be from that box."),
        C.dialogue("", "しかし、ここに木箱はない。")
      ],
      // Scene 8
      [
        C.background("images/006/S006-Scene-10.png?v=s006-v22"),
        C.dialogue("Pico", "この台車に、探している箱があるか聞いてみるピコ！"),
        C.question("s006.communication.7", "s006Challenge7"),
        C.dialogue("Worker", "No. It's at the bus terminal.", { supportText: "いいえ。バス乗り場にあります。" }),
        C.dialogue("Kong", "The bus!"),
        C.dialogue("Bernie", "Let's hurry!")
      ],
      // Scene 9
      [
        C.background("images/006/S006-Scene-11.png?v=s006-v22"),
        C.dialogue("", "バス乗り場。運転手が荷物室を閉めようとしている。"),
        C.dialogue("Driver", "We're leaving!"),
        C.dialogue("Pico", "バスが出ちゃうピコ！"),
        C.question("s006.communication.8", "s006Challenge8"),
        C.dialogue("Driver", "What's wrong?"),
        C.question("s006.communication.9", "s006Challenge9"),
        C.dialogue("Driver", "Sure. Let me check.", { supportText: "もちろん。確認してみますね。" })
      ],
      // Scene 10
      [
        C.background("images/006/S006-Scene-12.png?v=s006-v22"),
        C.dialogue("", "運転手が荷物を動かすと、奥から小さな木箱が現れた。"),
        C.dialogue("Bernie", "The ribbon!"),
        C.dialogue("", "リボンの一部が切れている。台車で見つけた切れ端とぴったり合った。"),
        C.dialogue("Little Monster", "That's my box!"),
        C.question("s006.communication.10", "s006Challenge10"),
        C.dialogue("Little Monster", "Thank you! Thank you!"),
        C.dialogue("", "カワウソの子は、赤いリボンの木箱を抱えて出発するバスに乗り込んだ。")
      ],
      // Scene 11
      [
        C.background("images/006/S006-Scene-13.png?v=s006-v22"),
        C.dialogue("", "おじいちゃんのもとに、木箱が届く。"),
        C.dialogue("", "中には、修理したオルゴールと3人の写真、手紙。"),
        C.dialogue("", "おばあちゃんが大好きだった曲が、久しぶりに流れる。"),
        { type: "s006EndingLetter" },
        C.dialogue("", "おじいちゃんが写真を見て、静かに微笑む。"),
        C.dialogue("Grandpa", "Thank you.", { button: "終了する" })
      ]
    ].flat()
  };
  StoryRegistry.register(story);
  window.S006 = story;
})();
