(function () {
  "use strict";

  WordDictionaryDatabase.register({
    id: "face-parts.v1",
    entries: [
      { canonical: "eyes", aliases: ["eye"] },
      { canonical: "nose", aliases: [] },
      { canonical: "mouth", aliases: [] },
      { canonical: "ears", aliases: ["ear"] }
    ]
  });

  QuestionDatabase.register({
    id: "word.face-parts",
    category: "word",
    prompt: "顔のパーツを英語で1つ言ってみよう！",
    answers: WordDictionaryDatabase.answers("face-parts.v1"),
    success: "Great!",
    failure: "顔のパーツを英語で言ってみるピコ！",
    hint: "eyes"
  });

  var graphicRoot = "images/monsters/m004/";
  MonsterDatabase.register({
    monsterId: "m004",
    questionId: "word.face-parts",
    name: "フェイス・パーツ・モンスター",
    image: {
      normal: graphicRoot + "m004_base.png",
      layers: {
        base: graphicRoot + "m004_base.png",
        eyes: graphicRoot + "m004_eyes.png",
        nose: graphicRoot + "m004_nose.png",
        mouth: graphicRoot + "m004_mouth.png",
        ears: graphicRoot + "m004_ears.png",
        hair: graphicRoot + "m004_hair.png",
        smile: graphicRoot + "m004_smile.png"
      }
    },
    effect: { intro: "shake", success: "flash", retreat: "fadeOut" },
    audio: { warning: "monsterWarningReveal" },
    encyclopedia: { entryId: "m004", targetCategory: "顔のパーツ" },
    presentation: {
      background: "forestClearing",
      className: "monster-face-parts",
      splitLayers: ["eyes", "ears"]
    },
    hintNpcId: "pico",
    campIds: ["CAMP_M004_1", "CAMP_M004_2", "CAMP_M004_3"],
    battle: {
      introHoldMs: 1000,
      graphicFlow: {
        normal: "normal", reaction: "reaction", postReaction: "postReaction",
        complete: "complete", reactionMs: 250, purifyMs: 500
      },
      playPurifySe: false,
      hitSe: "m004RecoveryMagic",
      hitSeVolume: 0.72,
      completionSe: "m004CompletionFanfare",
      completionSeVolume: 0.86,
      completionSeLeadMs: 6614,
      completionSeHoldMs: 3600,
      stopBgmAfterCompletion: true,
      stopBgmFadeOutMs: 650,
      postRecoverySe: "zephyrGo",
      postRecoverySeVolume: 0.24,
      postRecoverySeHoldMs: 1200,
      speechDucking: { ratio: 0.25, duckMs: 300, restoreMs: 600 },
      requiredUniqueAnswers: 4,
      dictionaryId: "face-parts.v1",
      layerAnswers: { eyes: "eyes", nose: "nose", mouth: "mouth", ears: "ears" },
      duplicateMessage: "そのパーツはもう伝えたピコ！別のパーツを言ってみよう！",
      supportMessages: [
        "まだ、目と鼻と口と耳が残っているピコ！",
        "残っているのは、目と鼻と口と耳ピコ！",
        "eyes\nnose\nmouth\nears"
      ],
      pseudoCampMessages: [
        "顔のパーツを英語で言ってみよう！",
        "目、鼻、口、耳を思い出してみよう！",
        "まだ伝えていない言葉を選んでね。"
      ],
      completionDialogue: [
        { speaker: "Monster", text: "My face is back!", voiceKey: "voice_c14_m004_003", supportText: "顔が元に戻った！" },
        { speaker: "Monster", text: "Thank you!", voiceKey: "voice_c14_m004_004", supportText: "ありがとう！" },
        { speaker: "Monster", text: "I'm happy now!", voiceKey: "voice_c14_m004_005", supportText: "今はうれしいよ！" },
        { speaker: "ピコ", text: "よかったピコ！顔が元に戻ったピコ！" },
        { speaker: "", text: "顔が元に戻って安心したモンスターは、\nうれしそうに森の奥へ消えていった。" }
      ]
    }
  });
})();
