(function () {
  "use strict";

  var C = StoryCommands;
  var story = {
    id: "S005",
    title: "S005 Ben ― 見えない夜",
    onExit: function () {
      try {
        if (window.SpeechEngine && typeof SpeechEngine.stop === "function") SpeechEngine.stop();
      } catch (_) {}
    },
    metadata: { perspective: "player", guests: ["player", "kong", "pico", "bernie"], nonGuestCompanions: [] },
    steps: [
      // Scene 1: arrival and the missing bag.
      C.sequence([
        C.clear(),
        C.background("images/005/reference-v1/Scene1.png"),
        C.dialogue("", "夕方、一行が新しい町に着く。"),
        C.dialogue("", "町は一見普通だが、店を早めに閉める人が多く、どこか落ち着かない。"),
        C.dialogue("", "突然――"),
        C.dialogue("Kong", "What was that?", { supportText: "今のは何だ？" }),
        C.background("images/005/ben_town_night_anomaly.png"),
        C.dialogue("", "振り向く。"),
        C.dialogue("", "何も見えない。"),
        C.dialogue("Kong", "Nothing!", { supportText: "何もない！" }),
        C.dialogue("", "町の女性が言う。"),
        C.dialogue("Woman", "Be careful.", { supportText: "気をつけて。" }),
        C.dialogue("Kong", "Why?", { supportText: "どうして？" }),
        C.dialogue("Woman", "Strange things happen at night.", { supportText: "夜になると変なことが起きるの。" }),
        C.dialogue("Townsperson", "We hear footsteps.", { supportText: "足音が聞こえるんだ。" }),
        C.dialogue("Woman", "But we can’t see anything.", { supportText: "でも、何も見えないの。" }),
        C.dialogue("Townsperson", "Maybe a ghost.", { supportText: "幽霊かもしれない。" }),
        C.dialogue("Townsperson", "Or a thief.", { supportText: "それとも泥棒かも。" }),
        C.dialogue("Pico", "最近、この町では夜になると変なことが起きるみたいだピコ。"),
        C.dialogue("", "そこへ別の女性が慌てて走ってくる。"),
        C.background("images/005/clean-v1/missing-bag-report.png"),
        C.dialogue("Woman 2", "My bag was gone!", { supportText: "バッグがなくなったの！" }),
        C.dialogue("Woman 2", "Someone stole it!", { supportText: "誰かが盗んだのよ！" }),
        C.dialogue("", "女性は交番へ向かう。"),
        C.dialogue("Pico", "なんだか物騒な町だピコ……。")
      ]),
      // Scene 2: choose a hotel instead of camping.
      C.sequence([
        C.dialogue("", "いつものようにキャンプしようとする一行。"),
        C.dialogue("", "しかしPicoが止める。"),
        C.background("images/005/reference-v1/Scene2.1.png"),
        C.dialogue("Pico", "今日はキャンプはやめるピコ。"),
        C.dialogue("Kong", "Why?", { supportText: "どうして？" }),
        C.dialogue("Pico", "この町は夜がちょっと物騒ピコ。安全のためホテルにするピコ！")
      ]),
      // Scene 3: hotel reception; Challenges 1–6.
      C.sequence([
        C.background("images/005/reference-v1/Scene3.png"),
        C.dialogue("Hotel Clerk", "Welcome.", { supportText: "いらっしゃいませ。" }),
        C.dialogue("Hotel Clerk", "Do you have a reservation?", { supportText: "ご予約はありますか？" }),
        C.question("s005.communication.1", "s005Challenge1"),
        C.dialogue("Hotel Clerk", "How many people?", { supportText: "何名様ですか？" }),
        C.question("s005.communication.2", "s005Challenge2"),
        C.dialogue("Hotel Clerk", "We have rooms for four people.", { supportText: "4人用のお部屋があります。" }),
        C.dialogue("", "主人公がKongを見る。"),
        C.question("s005.communication.3", "s005Challenge3"),
        C.dialogue("Hotel Clerk", "Yes, we do.", { supportText: "はい、ありますよ。" }),
        C.question("s005.communication.4", "s005Challenge4"),
        C.question("s005.communication.5", "s005Challenge5"),
        C.dialogue("Pico", "The king-size bed is for Kong.", { supportText: "キングサイズのベッドはコング用だピコ。" }),
        C.dialogue("Kong", "Yes!", { supportText: "うん！" }),
        C.dialogue("Pico", "ピコは寝ないから、ベッドは必要ないピコ。"),
        C.dialogue("Hotel Clerk", "Do you want breakfast?", { supportText: "朝食はいかがですか？" }),
        C.question("s005.communication.6", "s005Challenge6"),
        C.dialogue("Hotel Clerk", "Breakfast is from seven to nine.", { supportText: "朝食は7時から9時までです。" }),
        C.dialogue("Hotel Clerk", "Here are your room keys.", { supportText: "こちらがお部屋の鍵です。" }),
        C.dialogue("Hotel Clerk", "The twin room is on the second floor.", { supportText: "ツインルームは2階です。" }),
        C.dialogue("Hotel Clerk", "The other room is next to it.", { supportText: "もう一つのお部屋はその隣です。" }),
        C.dialogue("", "時計を指す。"),
        C.dialogue("Hotel Clerk", "The front door closes at twelve.", { supportText: "正面のドアは12時に閉まります。" }),
        C.dialogue("Kong", "Twelve?", { supportText: "12時？" }),
        C.dialogue("Pico", "12時に入口が閉まるピコ！"),
        C.dialogue("Hotel Clerk", "Please come back before twelve.", { supportText: "12時までにお戻りください。" })
      ]),
      // Scene 4: follow the unseen visitor.
      C.sequence([
        C.background("images/005/ben_town_shops_night.png"),
        C.dialogue("", "一行は夕食のため外へ出る。"),
        C.dialogue("", "誰もいないのに何かが動く。"),
        C.dialogue("Kong", "There!", { supportText: "あそこ！" }),
        C.dialogue("", "姿は見えない。"),
        C.dialogue("", "一行が追う。"),
        C.background("images/005/ben_alley_dead_end.png"),
        C.dialogue("", "路地へ。"),
        C.dialogue("", "行き止まり。"),
        C.dialogue("Kong", "Stop!", { supportText: "止まれ！" }),
        C.dialogue("", "何も見えない。"),
        C.dialogue("", "しかし息遣いが聞こえる。"),
        C.dialogue("Kong", "A ghost?", { supportText: "幽霊？" }),
        C.dialogue("", "少しずつ輪郭が見える。"),
        C.dialogue("Pico", "幽霊じゃないピコ！"),
        C.dialogue("", "モンスターだった。"),
        C.background("images/005/clean-v1/ben-introduction.png")
      ]),
      // Scene 5: meet Ben; Challenges 7–10.
      C.sequence([
        C.clear(),
        C.background("images/005/s005_regen_b_alley_v1.png"),
        C.dialogue("", "Kongが近づく。"),
        C.dialogue("Pico", "待つピコ！コングを怖がってるピコ！"),
        C.dialogue("Kong", "Me?", { supportText: "僕が？" }),
        C.dialogue("", "主人公が前へ出る。"),
        C.clear(),
        C.background("images/005/clean-v1/ben-introduction.png"),
        C.question("s005.communication.7", "s005Challenge7"),
        C.dialogue("Ben", "No...", { supportText: "いいえ……。" }),
        C.question("s005.communication.8", "s005Challenge8"),
        C.dialogue("Ben", "Ben.", { supportText: "ベン。" }),
        C.dialogue("主人公", "Ben?", { supportText: "ベン？" }),
        C.dialogue("Ben", "Yes.", { supportText: "はい。" }),
        C.background("images/005/clean-v1/ben-trust.png"),
        C.dialogue("", "主人公はバッグ事件を思い出す。"),
        C.question("s005.communication.9", "s005Challenge9"),
        C.dialogue("Ben", "No! I don’t!", { supportText: "違う！僕はやってない！" }),
        C.dialogue("Kong", "Really?", { supportText: "本当に？" }),
        C.dialogue("Ben", "Yes!", { supportText: "うん！" }),
        C.question("s005.communication.10", "s005Challenge10"),
        C.dialogue("Ben", "Where?", { supportText: "どこ？" }),
        C.dialogue("Kong", "The police station.", { supportText: "交番だよ。" })
      ]),
      // Scene 6: the police station and the bakery.
      C.sequence([
        C.background("images/005/clean-v1/police.png"),
        C.dialogue("", "交番にはバッグをなくした女性がいる。"),
        C.dialogue("Police Officer", "Where did you see your bag?", { supportText: "バッグを最後に見たのはどこですか？" }),
        C.dialogue("Woman", "Near the bakery.", { supportText: "パン屋の近くです。" }),
        C.dialogue("Woman", "I bought some bread.", { supportText: "パンを買いました。" }),
        C.dialogue("Woman", "I had my bag then.", { supportText: "そのときはバッグを持っていました。" }),
        C.dialogue("Woman", "Then I sat on the bench.", { supportText: "それからベンチに座りました。" }),
        C.dialogue("Woman", "I ate the bread.", { supportText: "パンを食べました。" }),
        C.dialogue("Woman", "Then I left.", { supportText: "それからそこを離れました。" }),
        C.dialogue("Police Officer", "The bench?", { supportText: "ベンチですか？" }),
        C.dialogue("Woman", "Yes.", { supportText: "はい。" }),
        C.dialogue("Kong", "Let’s go.", { supportText: "行こう。" }),
        C.dialogue("", "全員でパン屋へ。"),
        C.background("images/005/clean-v1/bakery-question.png")
      ]),
      // Scene 7: recover the bag; Challenge 11.
      C.sequence([
        C.question("s005.communication.11", "s005Challenge11"),
        C.dialogue("Bakery Clerk", "Yes.", { supportText: "はい。" }),
        C.background("images/005/clean-v1/bag-recovered.png"),
        C.dialogue("", "店の奥からバッグを出す。"),
        C.dialogue("Bakery Clerk", "I found it on the bench.", { supportText: "ベンチで見つけました。" }),
        C.dialogue("Bakery Clerk", "I kept it inside.", { supportText: "店の中で預かっていました。" }),
        C.dialogue("Bakery Clerk", "It is not safe outside at night.", { supportText: "夜、外に置いておくのは危険ですから。" }),
        C.dialogue("Woman", "My bag!", { supportText: "私のバッグ！" }),
        C.dialogue("Woman", "先にパン屋さんで聞けばよかった……。"),
        C.dialogue("Kong", "Ben didn’t take it.", { supportText: "ベンは盗んでいなかったんだ。" }),
        C.dialogue("", "女性がBenを見る。"),
        C.dialogue("Woman", "I’m sorry, Ben.", { supportText: "ごめんなさい、ベン。" }),
        C.dialogue("Ben", "It’s OK.", { supportText: "大丈夫だよ。" })
      ]),
      // Scene 8: understand the strange footsteps.
      C.sequence([
        C.dialogue("Townsperson", "But... the footsteps?", { supportText: "でも……足音は？" }),
        C.dialogue("Ben", "When I am afraid, my color goes away.", { supportText: "怖くなると、僕の色が消えるんだ。" }),
        C.dialogue("Ben", "When I am very afraid, people can’t see me.", { supportText: "すごく怖くなると、みんなに僕が見えなくなるんだ。" }),
        C.dialogue("Pico", "ベンはすごく怖くなると、姿が見えなくなるみたいだピコ。"),
        C.dialogue("Townsperson", "It’s not a ghost.", { supportText: "幽霊じゃなかったんだ。" }),
        C.dialogue("Woman", "We heard footsteps.", { supportText: "足音は聞こえたよね。" }),
        C.dialogue("Townsperson", "We thought something moved.", { supportText: "何かが動いたと思ったんだ。" }),
        C.dialogue("Pico", "ベンが見えなかったから、足音だけ聞こえたり、何かが動いたと思ったピコ！"),
        C.dialogue("", "Benが少しずつ落ち着き、姿が見えてくる。")
      ]),
      // Scene 9: introduce Ben; Challenge 12.
      C.sequence([
        C.clear(),
        C.background("images/005/reference-v1/Scene9.3.png"),
        C.dialogue("", "Benはまだ少し怖そう。"),
        C.dialogue("主人公", "Wait.", { supportText: "待って。" }),
        C.dialogue("町の人", "Ben?", { supportText: "ベン？" }),
        C.dialogue("Kong", "Yes. He is Ben.", { supportText: "うん。彼はベンだよ。" }),
        C.dialogue("Woman", "Good evening, Ben.", { supportText: "こんばんは、ベン。" }),
        C.dialogue("Ben", "Good evening.", { supportText: "こんばんは。" }),
        C.background("images/005/reference-v1/Scene9.5.png"),
        C.dialogue("Townsperson", "It’s not a ghost.", { supportText: "幽霊じゃなかったんだ。" }),
        C.dialogue("Woman", "We can see Ben now.", { supportText: "今はベンが見えるよ。" }),
        C.dialogue("Townsperson", "We are happy now.", { supportText: "もう安心だよ。" }),
        C.dialogue("", "そして――"),
        C.background("images/005/reference-v1/Scene9.7.png"),
        C.dialogue("Ben", "My color is back!", { supportText: "色が戻った！" }),
        C.dialogue("町の人", "How cute!", { supportText: "かわいい！" }),
        C.dialogue("Kong", "Ben is cool!", { supportText: "ベン、かっこいい！" }),
        C.question("s005.communication.12", "s005Challenge12"),
        C.dialogue("", "Benの色が戻り、街は幽霊の心配がなくなった。"),
        C.clear(),
        C.background("images/005/reference-v1/Scene9.7.png"),
        C.dialogue("", "一行がホテルへ戻ろうとする。"),
        C.dialogue("Woman", "Good night, Ben.", { supportText: "おやすみ、ベン。" }),
        C.dialogue("Townsperson", "Good night, Ben.", { supportText: "おやすみ、ベン。" }),
        C.dialogue("Ben", "Good night.", { supportText: "おやすみ。" })
      ]),
      // Scene 10: return before the hotel closes.
      C.sequence([
        C.background("images/005/reference-v1/Scene10.5.png"),
        C.dialogue("", "時計を見る。"),
        C.dialogue("", "11:55"),
        C.dialogue("Kong", "Oh!", { supportText: "あっ！" }),
        C.dialogue("Pico", "ホテルが閉まるピコ！"),
        C.dialogue("", "一行が走る。"),
        C.dialogue("", "11:57"),
        C.dialogue("", "11:58"),
        C.dialogue("", "そしてホテルへ。"),
        C.dialogue("", "11:59"),
        C.dialogue("Hotel Clerk", "Before twelve.", { supportText: "12時より前ですね。" }),
        C.dialogue("Kong", "Yes!", { supportText: "うん！" }),
        C.dialogue("Pico", "間に合ったピコ！")
      ]),
      // Scene 11: Kong's king-size bed.
      C.sequence([
        C.clear(),
        C.background("images/005/clean-v1/king-size-room.png"),
        C.dialogue("", "Kongの部屋。"),
        C.dialogue("", "大きなking-size bed。"),
        C.dialogue("", "Kongがベッドを見る。"),
        C.dialogue("Kong", "My bed!", { supportText: "僕のベッド！" }),
        C.background("images/005/reference-v1/Scene11.1.png"),
        C.dialogue("", "Kongがベッドへ。"),
        C.dialogue("Kong", "Good night!", { supportText: "おやすみ！" }),
        C.hideDialogue(),
        C.clear()
      ])
    ]
  };

  StoryRegistry.register(story);
  window.S005 = story;
})();