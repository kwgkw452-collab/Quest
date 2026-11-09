// Birdie (m005) implementation candidate. Not loaded by index.html or dev.html until approved graphics are installed.
(function () {
  "use strict";

  WordDictionaryDatabase.register({
    id: "bird-names.v1",
    entries: [
      { canonical: "bird", aliases: ["birdy"] },
      { canonical: "crow", aliases: [] },
      { canonical: "duck", aliases: [] },
      { canonical: "owl", aliases: [] },
      { canonical: "eagle", aliases: [] },
      { canonical: "penguin", aliases: [] },
      { canonical: "parrot", aliases: [] },
      { canonical: "swan", aliases: [] },
      { canonical: "sparrow", aliases: [] },
      { canonical: "pigeon", aliases: [] },
      { canonical: "flamingo", aliases: [] },
      { canonical: "peacock", aliases: [] },
      { canonical: "swallow", aliases: [] },
      { canonical: "chicken", aliases: ["chiken"] },
      { canonical: "hawk", aliases: [] }
    ]
  });

  QuestionDatabase.register({
    id: "word.bird-names",
    category: "word",
    prompt: "鳥の名前を英語で1つ言ってみよう！",
    answers: WordDictionaryDatabase.answers("bird-names.v1"),
    success: "Great!",
    failure: "知っている鳥の名前を英語で言ってみるピコ！",
    hint: "duck"
  });

  var root = "images/monsters/m005/";
  MonsterDatabase.register({
    monsterId: "m005",
    questionId: "word.bird-names",
    name: "バーディ",
    image: {
      normal: root + "birdie_stage0.png",
      reaction: root + "birdie_stage1.png",
      stage2: root + "birdie_stage2.png",
      defeated: root + "birdie_stage3.png"
    },
    effect: { intro: "shake", success: "flash", retreat: "fadeOut" },
    audio: { warning: "monsterWarning" },
    encyclopedia: { entryId: "m005", targetCategory: "鳥の名前" },
    presentation: { background: "forestClearing", className: "monster-birdie" },
    hintNpcId: "pico",
    campIds: [],
    battle: {
      introHoldMs: 900,
      guide: "鳥たちと友達になりたいバーディに、鳥の名前を英語で3つ教えてあげるピコ！",
      requiredUniqueAnswers: 3,
      dictionaryId: "bird-names.v1",
      graphicFlow: {
        normal: "normal", reaction: "reaction", postReaction: "reaction",
        complete: "defeated", reactionMs: 450, purifyMs: 300
      },
      playPurifySe: false,
      duplicateMessage: "その鳥の名前はもう聞いたピコ！別の鳥を教えてあげよう！",
      supportMessages: [
        "知っている鳥を思い出してみようピコ！",
        "アヒルは duck、カラスは crow だピコ！",
        "duck / crow / swallow / sparrow など、まだ言っていない鳥の名前を選ぶピコ！"
      ],
      progressMessages: [
        "ひとつ覚えたピコ！あと2種類！",
        "2種類覚えたピコ！あと1種類！",
        "3種類そろったピコ！バーディも大喜び！"
      ],
      completionDialogue: [
        { speaker: "Birdie", text: "I remember!" },
        { speaker: "Birdie", text: "Thank you!" },
        { speaker: "Birdie", text: "Let's fly!" }
      ]
    }
  });
})();
