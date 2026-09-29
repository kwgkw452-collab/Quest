(function () {
  "use strict";

  var C = StoryCommands;
  var story = {
    id: "m004",
    title: "Face Parts Monster Battle",
    nextStoryId: "S005",
    steps: [
      C.clear(),
      C.background("forestClearing"),
      C.bgm("nocturnalBloom", { loop: true, volume: 0.20, fadeInMs: 800 }),
      C.monster("m004", "normal"),
      C.effect("scene-fade-in", 900),
      C.dialogue("", "突然、顔のないモンスターが現れた。"),
      C.dialogue("Monster", "I lost my face.", {
        voiceKey: "voice_c14_m004_001", supportText: "顔をなくしたんだ。", supportSpeaker: "ピコ"
      }),
      C.dialogue("Monster", "Please help me.", {
        voiceKey: "voice_c14_m004_002", supportText: "助けてください。", supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "顔をなくして困っているみたいピコ！"),
      C.dialogue("ピコ", "顔のパーツを英語で言って助けるピコ！", { button: "バトル開始" }),
      C.monsterBattle("m004", "facePartsBattle", { preserveBgm: true }),
      C.branch(function (state) { return !!(state.facePartsBattle && state.facePartsBattle.cleared); }, [
        C.camp("CAMP_M004", "facePartsCamp"),
        C.morning("MORNING_M004", "facePartsMorning")
      ])
    ]
  };

  StoryRegistry.register(story);
  var previous = StoryRegistry.get("st004");
  if (previous) previous.nextStoryId = "m004";
  window.m004 = story;
})();
