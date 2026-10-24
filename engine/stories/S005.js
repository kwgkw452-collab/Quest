(function () {
  "use strict";
  // Story data only, using the unchanged S004 Story Engine.
  var story = {
  "id": "S005",
  "title": "S005 Ben ― 見えない夜",
  "steps": [
    {
      "type": "clear"
    },
    {
      "type": "background",
      "src": "images/005/ben_town_night.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "夕方、一行が新しい町に着く。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "町は一見普通だが、店を早めに閉める人が多く、どこか落ち着かない。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "突然――"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "What was that?"
    },
    {
      "type": "background",
      "src": "images/005/ben_town_night_anomaly.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "振り向く。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "何も見えない。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Nothing!"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "町の女性が言う。"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Be careful."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Why?"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Strange things happen at night."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "We hear footsteps."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "But we can’t see anything."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "Maybe a ghost."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "Or a thief."
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "最近、この町では夜になると変なことが起きるみたいだピコ。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "そこへ別の女性が慌てて走ってくる。"
    },
    {
      "type": "background",
      "src": "images/005/scene1.5.png"
    },
    {
      "type": "dialogue",
      "speaker": "Woman 2",
      "text": "My bag was gone!"
    },
    {
      "type": "dialogue",
      "speaker": "Woman 2",
      "text": "Someone stole it!"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "女性は交番へ向かう。"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "なんだか物騒な町だピコ……。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "いつものようにキャンプしようとする一行。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "しかしPicoが止める。"
    },
    {
      "type": "background",
      "src": "images/005/scene1.7.png"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "今日はキャンプはやめるピコ。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Why?"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "この町は夜がちょっと物騒ピコ。安全のためホテルにするピコ！"
    },
    {
      "type": "background",
      "src": "images/005/scene2.png"
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Welcome."
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Do you have a reservation?"
    },
    {
      "type": "question",
      "questionId": "s005.communication.1",
      "saveAs": "s005Challenge1",
      "supportMessages": [
        "「いいえ」だから……ピコ。",
        "“No” を使って答えるピコ。",
        "No, we don’t."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "How many people?"
    },
    {
      "type": "question",
      "questionId": "s005.communication.2",
      "saveAs": "s005Challenge2",
      "supportMessages": [
        "3人だから……ピコ。",
        "“Three” を使って答えるピコ。",
        "Three."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "We have a twin room and a single room."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "主人公がKongを見る。"
    },
    {
      "type": "question",
      "questionId": "s005.communication.3",
      "saveAs": "s005Challenge3",
      "supportMessages": [
        "“Do you...” から始めてみるピコ。",
        "“king-size bed” を使うピコ。",
        "Do you have a king-size bed?"
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Yes. The single room has a king-size bed."
    },
    {
      "type": "question",
      "questionId": "s005.communication.4",
      "saveAs": "s005Challenge4",
      "supportMessages": [
        "2だから……ピコ。",
        "“Two” から始めるピコ。",
        "Two rooms, please."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "The king-size bed is for Kong."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Yes!"
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Do you want breakfast?"
    },
    {
      "type": "question",
      "questionId": "s005.communication.5",
      "saveAs": "s005Challenge5",
      "supportMessages": [
        "「はい」だから……ピコ。",
        "“Yes” を使って答えるピコ。",
        "Yes, please."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Breakfast is from seven to nine."
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Here are your room keys."
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "The twin room is on the second floor."
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "The single room is next to it."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "時計を指す。"
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "The front door closes at twelve."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Twelve?"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "12時に入口が閉まるピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Please come back before twelve."
    },
    {
      "type": "background",
      "src": "images/005/ben_town_shops_night.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "一行は夕食のため外へ出る。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "誰もいないのに何かが動く。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "There!"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "姿は見えない。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "一行が追う。"
    },
    {
      "type": "background",
      "src": "images/005/ben_alley_dead_end.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "路地へ。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "行き止まり。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Stop!"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "何も見えない。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "しかし息遣いが聞こえる。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "A ghost?"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "少しずつ輪郭が見える。"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "幽霊じゃないピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "モンスターだった。"
    },
    {
      "type": "clear"
    },
    {
      "type": "background",
      "src": "images/005/ben_alley_kong.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Kongが近づく。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Benが怖がり、さらに色が薄くなる。"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "待つピコ！コングを怖がってるピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Me?"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "主人公が前へ出る。"
    },
    {
      "type": "clear"
    },
    {
      "type": "background",
      "src": "images/005/scene6.png"
    },
    {
      "type": "question",
      "questionId": "s005.communication.6",
      "saveAs": "s005Challenge6",
      "supportMessages": [
        "“Are you...” から始めるピコ。",
        "“OK” を使うピコ。",
        "Are you OK?"
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "No..."
    },
    {
      "type": "question",
      "questionId": "s005.communication.7",
      "saveAs": "s005Challenge7",
      "supportMessages": [
        "“What’s...” から始めてみるピコ。",
        "“your name” を使うピコ。",
        "What’s your name?"
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Ben."
    },
    {
      "type": "dialogue",
      "speaker": "主人公",
      "text": "Ben?"
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Yes."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "ここでBenに少し色が戻る。"
    },
    {
      "type": "background",
      "src": "images/005/scene7.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "主人公はバッグ事件を思い出す。"
    },
    {
      "type": "question",
      "questionId": "s005.communication.8",
      "saveAs": "s005Challenge8",
      "supportMessages": [
        "“Did you...” または “Do you...” から始めるピコ。",
        "“steal” を使うピコ。",
        "Did you steal something?"
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "No! I don’t!"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Really?"
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Yes!"
    },
    {
      "type": "question",
      "questionId": "s005.communication.9",
      "saveAs": "s005Challenge9",
      "supportMessages": [
        "“Come” または “Let’s” から始めるピコ。",
        "“with us” または “go” を使うピコ。",
        "Come with us.\nLet’s go."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Where?"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "The police station."
    },
    {
      "type": "background",
      "src": "images/005/scene8.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "交番にはバッグをなくした女性がいる。"
    },
    {
      "type": "dialogue",
      "speaker": "Police Officer",
      "text": "Where did you see your bag?"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Near the bakery."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "I bought some bread."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "I had my bag then."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Then I sat on the bench."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "I ate the bread."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Then I left."
    },
    {
      "type": "dialogue",
      "speaker": "Police Officer",
      "text": "The bench?"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Yes."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Let’s go."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "全員でパン屋へ。"
    },
    {
      "type": "background",
      "src": "images/005/scene9.png"
    },
    {
      "type": "question",
      "questionId": "s005.communication.10",
      "saveAs": "s005Challenge10",
      "supportMessages": [
        "“Did you...” から始めるピコ。",
        "“see” と “bag” を使うピコ。",
        "Did you see a bag?"
      ]
    },
    {
      "type": "dialogue",
      "speaker": "Bakery Clerk",
      "text": "Yes."
    },
    {
      "type": "background",
      "src": "images/005/scene10.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "店の奥からバッグを出す。"
    },
    {
      "type": "dialogue",
      "speaker": "Bakery Clerk",
      "text": "I found it on the bench."
    },
    {
      "type": "dialogue",
      "speaker": "Bakery Clerk",
      "text": "I kept it inside."
    },
    {
      "type": "dialogue",
      "speaker": "Bakery Clerk",
      "text": "It is not safe outside at night."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "My bag!"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "先にパン屋さんで聞けばよかった……。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Ben didn’t take it."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "女性がBenを見る。"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "I’m sorry, Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "It’s OK."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "ここでBenの色がさらに戻る。"
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "But... the footsteps?"
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "When I am afraid, my color goes away."
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "When I am very afraid, people can’t see me."
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "ベンはすごく怖くなると、姿が見えなくなるみたいだピコ。"
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "It’s not a ghost."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "We heard footsteps."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "We thought something moved."
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "ベンが見えなかったから、足音だけ聞こえたり、何かが動いたと思ったピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Benが少しずつ落ち着き、姿が見えてくる。"
    },
    {
      "type": "background",
      "src": "images/005/scene10.5.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Benはまだ少し怖そう。"
    },
    {
      "type": "dialogue",
      "speaker": "主人公",
      "text": "Wait."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "KongがBenの前に立つ。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "最初はBenを追い詰めるためだったKong。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "今度はBenを守るために立つ。"
    },
    {
      "type": "question",
      "questionId": "s005.communication.11",
      "saveAs": "s005Challenge11",
      "supportMessages": [
        "“His...” から始めるピコ。",
        "“name” と “Ben” を使うピコ。",
        "His name is Ben."
      ]
    },
    {
      "type": "dialogue",
      "speaker": "町の人",
      "text": "Ben?"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Yes. He is Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Good evening, Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Good evening."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Benの色がさらに戻る。"
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "It’s not a ghost."
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "We can see Ben now."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "We are happy now."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "そして――"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Benの色が完全に戻る。"
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "My color is back."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Wow!"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "I’m sorry, Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "It’s OK."
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "もう誰もBenを「ghost」「thief」と呼ばない。"
    },
    {
      "type": "clear"
    },
    {
      "type": "background",
      "src": "images/005/scene10.5.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "一行がホテルへ戻ろうとする。"
    },
    {
      "type": "dialogue",
      "speaker": "Woman",
      "text": "Good night, Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Townsperson",
      "text": "Good night, Ben."
    },
    {
      "type": "dialogue",
      "speaker": "Ben",
      "text": "Good night."
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "もう誰もベンを怖がっていないピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "今夜のベンは、もう一人じゃないピコ。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "町を見る。"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "街の変な物音も、もうなくなるピコ！"
    },
    {
      "type": "background",
      "src": "images/005/ben_town_night.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "時計を見る。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "11:55"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Oh!"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "ホテルが閉まるピコ！"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "一行が走る。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "11:57"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "11:58"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "そしてホテルへ。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "11:59"
    },
    {
      "type": "dialogue",
      "speaker": "Hotel Clerk",
      "text": "Before twelve."
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Yes!"
    },
    {
      "type": "dialogue",
      "speaker": "Pico",
      "text": "間に合ったピコ！"
    },
    {
      "type": "background",
      "src": "images/005/scne11.5.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Kongの部屋。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "大きなking-size bed。"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Kongがベッドを見る。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "My bed!"
    },
    {
      "type": "background",
      "src": "images/005/ben_hotel_kong_sleep.png"
    },
    {
      "type": "dialogue",
      "speaker": "",
      "text": "Kongがベッドへ。"
    },
    {
      "type": "dialogue",
      "speaker": "Kong",
      "text": "Good night!"
    }
  ]
};
  StoryRegistry.register(story);
  window.S005 = story;
})();
