(function () {
  "use strict";
  var C = StoryCommands;
  var root = "images/005/";
  function bg(name) { return C.background(root + name + ".png"); }
  function ben(stage) { return C.item(root + "ben_" + stage + ".png"); }
  function say(who, text) { return C.dialogue(who, text); }
  function ask(n) { return C.question("s005.communication." + n, "s005Challenge" + n); }

  // Question prompts are Japanese. Expected English remains judge data, never
  // the initial speech screen. The three support levels are S005-only data.
  var tasks = [
    ["いいえ、予約していません。", "No, we don’t.", "hotel.reservation.none", "answer",
      ["「いいえ」だから……ピコ。", "“No” を使って答えるピコ。", "No, we don’t."]],
    ["3人です。", "Three.", "hotel.party.three", "answer",
      ["3人だから……ピコ。", "“Three” を使って答えるピコ。", "Three."]],
    ["キングサイズのベッドはありますか？", "Do you have a king-size bed?", "hotel.bed.king.ask", "question",
      ["“Do you...” から始めてみるピコ。", "“king-size bed” を使うピコ。", "Do you have a king-size bed?"]],
    ["2部屋お願いします。", "Two rooms, please.", "hotel.rooms.two.request", "request",
      ["2だから……ピコ。", "“Two” から始めるピコ。", "Two rooms, please."]],
    ["はい、お願いします。", "Yes, please.", "hotel.breakfast.yes", "answer",
      ["「はい」だから……ピコ。", "“Yes” を使って答えるピコ。", "Yes, please."]],
    ["大丈夫ですか？", "Are you OK?", "s005.social.wellbeing.ask", "question",
      ["“Are you...” から始めるピコ。", "“OK” を使うピコ。", "Are you OK?"]],
    ["（あなたの）名前は何ですか？", "What’s your name?", "social.name.ask", "question",
      ["“What’s...” から始めてみるピコ。", "“your name” を使うピコ。", "What’s your name?"]],
    ["物を盗みましたか？", "Do you steal things?", "mystery.stealing.ask", "question",
      ["“Did you...” または “Do you...” から始めるピコ。", "“steal” を使うピコ。", "Did you steal something?"]],
    ["私たちと一緒に来て。", "Come with us.", "social.come.with.us", "invitation",
      ["“Come” または “Let’s” から始めるピコ。", "“with us” または “go” を使うピコ。", "Come with us.\nLet’s go."]],
    ["バッグを見ましたか？", "Did you see a bag?", "mystery.bag.sighting.ask", "question",
      ["“Did you...” から始めるピコ。", "“see” と “bag” を使うピコ。", "Did you see a bag?"]],
    ["彼の名前はBenです。", "His name is Ben.", "social.ben.introduce", "statement",
      ["“His...” から始めるピコ。", "“name” と “Ben” を使うピコ。", "His name is Ben."]]
  ];
  // Both draws in each pool express the same locked Japanese communication goal.
  // Judge rules keep accepting every Phase A expression regardless of the draw.
  var lotteryAlternates = [
    "No.", "3.", "King-size bed, please.", "2 rooms", "Sure.",
    "Are you all right?", "Name, please?", "Did you steal?",
    "Let’s go.", "Did you find a bag?", "This is Ben."
  ];
  if (Array.isArray(window.LotteryPoolData) && window.LotteryEngine) {
    tasks.forEach(function (task, index) {
      var id = "s005.communication." + (index + 1);
      LotteryPoolData.push({
        poolId: id + ".v1",
        items: [{
          itemId: id, conceptId: task[2], displayValue: task[0],
          prompts: [task[1], lotteryAlternates[index]].map(function (example) {
            return { promptType: task[3], difficulty: "starter",
              expectedUtterance: example, acceptedVariants: [] };
          })
        }]
      });
    });
    LotteryEngine.init(LotteryPoolData);
  }
  if (window.QuestionDatabase && typeof QuestionDatabase.register === "function") {
    tasks.forEach(function (task, index) {
      QuestionDatabase.register({
        id: "s005.communication." + (index + 1), category: "word",
        prompt: task[0], answers: [task[1]], success: "", failure: "", hint: null,
        picoSupport: task[4],
        communicative: { conceptId: task[2], difficulty: "starter", promptType: task[3],
          expectedUtterance: task[1], poolId: "s005.communication." + (index + 1) + ".v1" }
      });
    });
  }

  // Whole-word matching avoids accepting e.g. "one" inside "someone".
  function words(text) {
    var normalized = String(text || "").toLowerCase().replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
    return normalized ? normalized.split(/\s+/) : [];
  }
  function has(t, word) { return t.indexOf(word) !== -1; }
  function phrase(t, value) { return (" " + t.join(" ") + " ").indexOf(" " + value + " ") !== -1; }
  function any(t, values) { return values.some(function (value) { return has(t, value); }); }
  function negative(t) { return any(t, ["not", "dont", "no", "never"]); }
  function rule(conceptId, variants, accept, rejects, promptType) {
    var value = { conceptId: conceptId, variants: variants,
      rejects: [{ variants: rejects, reason: "contrary-goal" }],
      difficulty: "starter", promptType: promptType };
    if (accept) value.accept = accept;
    return value;
  }

  if (Array.isArray(window.CommunicativeJudgeRuleData)) {
    CommunicativeJudgeRuleData.push(
      rule("hotel.reservation.none", ["No, we don’t.", "No, we do not.", "No."],
        function (text) { var t = words(text); return has(t, "no") && !has(t, "yes"); },
        ["Yes, we do.", "We have a reservation."], "answer"),
      rule("hotel.party.three", ["Three.", "Three people.", "We are three."],
        function (text) { var t = words(text); return any(t, ["three", "3"]) && !negative(t); },
        ["Two.", "Four."], "answer"),
      rule("hotel.bed.king.ask", ["Do you have a king-size bed?"],
        function (text) {
          var t = words(text);
          return has(t, "king") && any(t, ["bed", "beds"]) && !negative(t) &&
            (phrase(t, "do you have") || phrase(t, "does this hotel have") ||
             phrase(t, "does the hotel have") || phrase(t, "is there") ||
             phrase(t, "are there") || has(t, "available") || has(t, "please") ||
             phrase(t, "can i have") || phrase(t, "can we have"));
        }, ["We don't need a bed."], "question"),
      rule("hotel.rooms.two.request", ["Two rooms, please."],
        function (text) { var t = words(text); return any(t, ["two", "2"]) &&
          any(t, ["room", "rooms"]) && !negative(t); },
        ["One room, please."], "request"),
      rule("hotel.breakfast.yes", ["Yes, please.", "Yes.", "Please.", "Sure.", "OK.", "Okay."],
        null, ["No, thank you."], "answer"),
      rule("s005.social.wellbeing.ask", ["Are you OK?", "Are you okay?", "Are you all right?",
        "Are you alright?", "You OK?", "You okay?", "All right?", "Everything OK?"],
        function (text) {
          var t = words(text);
          return !negative(t) && ((phrase(t, "are you") && any(t, ["ok", "okay", "fine", "alright"])) ||
            (phrase(t, "are you all right")) ||
            (has(t, "everything") && any(t, ["ok", "okay", "alright"])));
        }, ["I don't care."], "question"),
      rule("social.name.ask", ["What’s your name?", "Your name, please?", "Name, please?"],
        function (text) {
          var t = words(text);
          return has(t, "name") && !negative(t) &&
            ((has(t, "your") && any(t, ["what", "please", "have", "know", "tell", "want", "like"])) ||
             (phrase(t, "name please")));
        }, ["I don't want to know your name."], "question"),
      rule("mystery.stealing.ask", ["Do you steal things?", "Did you steal?", "Do you steal?"],
        function (text) {
          var t = words(text);
          if (negative(t) || phrase(t, "i stole") || phrase(t, "you stole")) return false;
          return phrase(t, "did you steal") || phrase(t, "do you steal") ||
            ((any(t, ["steal", "stole"]) && any(t, ["something", "anything", "things"])) && !has(t, "i")) ||
            (phrase(t, "did you take") && (any(t, ["something", "anything", "bag"])));
        }, ["You are a thief."], "question"),
      rule("social.come.with.us", ["Come with us.", "Come with me.", "Let’s go."],
        function (text) {
          var t = words(text);
          return !negative(t) && (any(t.slice(0, 2), ["come", "lets"])) &&
            (phrase(t, "come with us") || phrase(t, "come with me") || phrase(t, "lets go"));
        }, ["Go away."], "invitation"),
      rule("mystery.bag.sighting.ask", ["Did you see a bag?"],
        function (text) { var t = words(text); return has(t, "bag") &&
          any(t, ["see", "saw", "seen", "find", "found"]) && !negative(t); },
        ["I don't care about the bag."], "question"),
      rule("social.ben.introduce", ["His name is Ben.", "He is Ben.", "This is Ben."],
        function (text) {
          var t = words(text);
          return has(t, "ben") && !negative(t) &&
            ((has(t, "his") && any(t, ["name", "names"])) ||
             phrase(t, "he is ben") || phrase(t, "hes ben") ||
             phrase(t, "this is ben") || phrase(t, "the monster is ben"));
        }, ["He is a ghost."], "statement")
    );
  }

  var story = {
    id: "S005",
    title: "S005 Ben ― 見えない夜",
    steps: [
      // 1．町に到着
      C.clear(), bg("ben_town_night"),
      say("", "夕方、一行が新しい町に着く。"),
      say("", "町は一見普通だが、店を早めに閉める人が多く、どこか落ち着かない。"),
      say("", "突然――"),
      say("Kong", "What was that?"),
      bg("ben_town_night_anomaly"),
      say("", "振り向く。"),
      say("", "何も見えない。"),
      say("Kong", "Nothing!"),
      say("", "町の女性が言う。"),
      say("Woman", "Be careful."),
      say("Kong", "Why?"),
      say("Woman", "Strange things happen at night."),
      say("Townsperson", "We hear footsteps."),
      say("Woman", "But we can’t see anything."),
      say("Townsperson", "Maybe a ghost."),
      say("Townsperson", "Or a thief."),
      say("Pico", "最近、この町では夜になると変なことが起きるみたいだピコ。"),
      say("", "そこへ別の女性が慌てて走ってくる。"),
      say("Woman 2", "My bag was gone!"),
      say("Woman 2", "Someone stole it!"),
      say("", "女性は交番へ向かう。"),
      say("Pico", "なんだか物騒な町だピコ……。"),

      // 2．今日はキャンプではなくホテル
      say("", "いつものようにキャンプしようとする一行。"),
      say("", "しかしPicoが止める。"),
      say("Pico", "今日はキャンプはやめるピコ。"),
      say("Kong", "Why?"),
      say("Pico", "この町は夜がちょっと物騒ピコ。安全のためホテルにするピコ！"),

      // 3．ホテルにチェックイン
      say("Hotel Clerk", "Welcome."),
      say("Hotel Clerk", "Do you have a reservation?"), ask(1),
      say("Hotel Clerk", "How many people?"), ask(2),
      say("Hotel Clerk", "We have a twin room and a single room."),
      say("", "主人公がKongを見る。"), ask(3),
      say("Hotel Clerk", "Yes. The single room has a king-size bed."), ask(4),
      say("Pico", "The king-size bed is for Kong."),
      say("Kong", "Yes!"),
      say("Hotel Clerk", "Do you want breakfast?"), ask(5),
      say("Hotel Clerk", "Breakfast is from seven to nine."),
      say("Hotel Clerk", "Here are your room keys."),
      say("Hotel Clerk", "The twin room is on the second floor."),
      say("Hotel Clerk", "The single room is next to it."),
      say("", "時計を指す。"),
      say("Hotel Clerk", "The front door closes at twelve."),
      say("Kong", "Twelve?"),
      say("Pico", "12時に入口が閉まるピコ！"),
      say("Hotel Clerk", "Please come back before twelve."),

      // 4．夜の町
      bg("ben_town_shops_night"),
      say("", "一行は夕食のため外へ出る。"),
      say("", "誰もいないのに何かが動く。"),
      say("Kong", "There!"),
      say("", "姿は見えない。"),
      say("", "一行が追う。"),
      bg("ben_alley_dead_end"),
      say("", "路地へ。"),
      say("", "行き止まり。"),
      say("Kong", "Stop!"),
      say("", "何も見えない。"),
      say("", "しかし息遣いが聞こえる。"),
      say("Kong", "A ghost?"),
      say("", "少しずつ輪郭が見える。"),
      say("Pico", "幽霊じゃないピコ！"),
      say("", "モンスターだった。"),
      ben("stage0"),

      // 5．Ben
      C.clear(), bg("ben_alley_kong"), ben("stage0"),
      say("", "Kongが近づく。"),
      say("", "Benが怖がり、さらに色が薄くなる。"),
      say("Pico", "待つピコ！コングを怖がってるピコ！"),
      say("Kong", "Me?"),
      say("", "主人公が前へ出る。"),
      ask(6), say("Ben", "No..."),
      ask(7), say("Ben", "Ben."),
      say("主人公", "Ben?"),
      say("Ben", "Yes."),
      say("", "ここでBenに少し色が戻る。"),
      ben("stage1"),
      say("", "主人公はバッグ事件を思い出す。"),
      ask(8), say("Ben", "No! I don’t!"),
      say("Kong", "Really?"),
      say("Ben", "Yes!"),
      ask(9), say("Ben", "Where?"),
      say("Kong", "The police station."),

      // 6．交番からパン屋へ
      bg("ben_police_station"),
      say("", "交番にはバッグをなくした女性がいる。"),
      say("Police Officer", "Where did you see your bag?"),
      say("Woman", "Near the bakery."),
      say("Woman", "I bought some bread."),
      say("Woman", "I had my bag then."),
      say("Woman", "Then I sat on the bench."),
      say("Woman", "I ate the bread."),
      say("Woman", "Then I left."),
      say("Police Officer", "The bench?"),
      say("Woman", "Yes."),
      say("Kong", "Let’s go."),
      say("", "全員でパン屋へ。"),
      bg("ben_bakery_bench"),

      // 7．バッグ発見
      ask(10),
      say("Bakery Clerk", "Yes."),
      say("", "店の奥からバッグを出す。"),
      say("Bakery Clerk", "I found it on the bench."),
      say("Bakery Clerk", "I kept it inside."),
      say("Bakery Clerk", "It is not safe outside at night."),
      say("Woman", "My bag!"),
      say("Woman", "先にパン屋さんで聞けばよかった……。"),
      say("Kong", "Ben didn’t take it."),
      say("", "女性がBenを見る。"),
      say("Woman", "I’m sorry, Ben."),
      say("Ben", "It’s OK."),
      say("", "ここでBenの色がさらに戻る。"),
      ben("stage2"),

      // 8．怪現象の正体
      say("Townsperson", "But... the footsteps?"),
      say("Ben", "When I am afraid, my color goes away."),
      say("Ben", "When I am very afraid, people can’t see me."),
      say("Pico", "ベンはすごく怖くなると、姿が見えなくなるみたいだピコ。"),
      say("Townsperson", "It’s not a ghost."),
      say("Woman", "We heard footsteps."),
      say("Townsperson", "We thought something moved."),
      say("Pico", "ベンが見えなかったから、足音だけ聞こえたり、何かが動いたと思ったピコ！"),
      say("", "Benが少しずつ落ち着き、姿が見えてくる。"),

      // 9．His name is Ben
      say("", "Benはまだ少し怖そう。"),
      say("主人公", "Wait."),
      say("", "KongがBenの前に立つ。"),
      say("", "最初はBenを追い詰めるためだったKong。"),
      say("", "今度はBenを守るために立つ。"),
      ask(11),
      say("町の人", "Ben?"),
      say("Kong", "Yes. He is Ben."),
      say("Woman", "Good evening, Ben."),
      say("Ben", "Good evening."),
      say("", "Benの色がさらに戻る。"),
      ben("stage3"),
      say("Townsperson", "It’s not a ghost."),
      say("Woman", "We can see Ben now."),
      say("Townsperson", "We are happy now."),
      say("", "そして――"),
      say("", "Benの色が完全に戻る。"),
      ben("stage4_full"),
      say("Ben", "My color is back."),
      say("Kong", "Wow!"),
      say("Woman", "I’m sorry, Ben."),
      say("Ben", "It’s OK."),
      say("", "もう誰もBenを「ghost」「thief」と呼ばない。"),
      C.clear(), bg("ben_town_relief_cast_night"),
      say("", "一行がホテルへ戻ろうとする。"),
      say("Woman", "Good night, Ben."),
      say("Townsperson", "Good night, Ben."),
      say("Ben", "Good night."),
      say("Pico", "もう誰もベンを怖がっていないピコ！"),
      say("Pico", "今夜のベンは、もう一人じゃないピコ。"),
      say("", "町を見る。"),
      say("Pico", "街の変な物音も、もうなくなるピコ！"),

      // 10．ホテルへ急ぐ
      bg("ben_town_night"),
      say("", "時計を見る。"),
      say("", "11:55"),
      say("Kong", "Oh!"),
      say("Pico", "ホテルが閉まるピコ！"),
      say("", "一行が走る。"),
      say("", "11:57"), say("", "11:58"),
      say("", "そしてホテルへ。"),
      say("", "11:59"),
      say("Hotel Clerk", "Before twelve."),
      say("Kong", "Yes!"),
      say("Pico", "間に合ったピコ！"),

      // 11．ホテル
      bg("ben_hotel_kong_sleep"),
      say("", "Kongの部屋。"),
      say("", "大きなking-size bed。"),
      say("", "Kongがベッドを見る。"),
      say("Kong", "My bed!"),
      say("", "Kongがベッドへ。"),
      say("Kong", "Good night!")
    ]
  };
  StoryRegistry.register(story);
  window.S005 = story;
})();
