// Birdie battle candidate. Deliberately not connected to Story progression or Dev Menu until asset review.
(function () {
  "use strict";
  var C = StoryCommands;
  var story = {
    id: "m005",
    title: "Birdie — 鳥の名前",
    nextStoryId: null,
    steps: [
      C.clear(),
      C.background("forestClearing"),
      C.monster("m005", "normal"),
      C.dialogue("", "森の道で、色あざやかな鳥のモンスターに出会った。"),
      C.dialogue("Birdie", "I want to make bird friends!"),
      C.dialogue("ピコ", "鳥の名前を覚えたいみたいピコ！英語で3種類教えてあげよう！", { button: "バトル開始" }),
      C.monsterBattle("m005", "birdieBattle", { preserveBgm: true })
    ]
  };
  StoryRegistry.register(story);
  window.m005 = story;
})();
