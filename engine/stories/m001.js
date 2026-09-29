(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "m001",
    title: "フルーツモンスター",
    nextStoryId: "S002",
    steps: [
      C.clear(),
      C.background("forest"),
      C.monster("m001", "normal"),
      C.dialogue("Fruit Monster", "I am the strongest! But I don't like fruit!", {
        voiceKey: "voice_c13_m001_001",
        button: "Next",
        supportText: "『俺は最強だ！でも、フルーツは苦手だ！』と言っているよ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "Master! He doesn't like fruit! Say three fruit words!", {
        voiceKey: "voice_c01_m001_001",
        button: "Battle",
        supportText: "マスター！あいつはフルーツが苦手だ！違うフルーツの英単語を3つ言おう！",
        supportSpeaker: "ピコ"
      }),
      C.monsterBattle("m001", "fruitBattle"),
      C.branch(function (state) {
        return Boolean(state.fruitBattle && state.fruitBattle.cleared);
      }, [
        C.dialogue("ピコ", "Great! So much delicious fruit!", {
          voiceKey: "voice_c01_m001_002",
          button: "Camp",
          supportText: "やったー！おいしそうなフルーツがいっぱいだピコ！",
          supportSpeaker: "ピコ"
        })
      ], []),
      C.camp("CAMP_M001")
    ]
  };

  StoryRegistry.register(story);
  window.m001 = story;
})();
