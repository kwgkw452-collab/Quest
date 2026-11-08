(function () {
  "use strict";
  // S006 Ending only. Never reads/writes QuestionManager's Support Level.
  var lines = [
  {
    "english": "Dear Grandpa,",
    "japanese": "おじいちゃんへ",
    "voiceKey": "voice_c15_s006_001"
  },
  {
    "english": "This is your music box.",
    "japanese": "これは、おじいちゃんのオルゴールだよ。",
    "voiceKey": "voice_c15_s006_002"
  },
  {
    "english": "It was broken.",
    "japanese": "壊れていたんだ。",
    "voiceKey": "voice_c15_s006_003"
  },
  {
    "english": "So you think you can't listen to it again.",
    "japanese": "だから、もう聴けないと思っているよね。",
    "voiceKey": "voice_c15_s006_004"
  },
  {
    "english": "But I fixed it!",
    "japanese": "でも、ぼくが直したよ！",
    "voiceKey": "voice_c15_s006_005"
  },
  {
    "english": "Now you can listen to it again!",
    "japanese": "これで、また聴けるよ！",
    "voiceKey": "voice_c15_s006_006"
  },
  {
    "english": "It's Grandma's favorite song.",
    "japanese": "おばあちゃんの大好きな曲だよ。",
    "voiceKey": "voice_c15_s006_007"
  },
  {
    "english": "Look at this picture.",
    "japanese": "この写真を見て。",
    "voiceKey": "voice_c15_s006_008"
  },
  {
    "english": "It's you, Grandma, and me.",
    "japanese": "おじいちゃんと、おばあちゃんと、ぼくだよ。",
    "voiceKey": "voice_c15_s006_009"
  },
  {
    "english": "Grandma is not here now.",
    "japanese": "おばあちゃんは、今ここにはいないね。",
    "voiceKey": "voice_c15_s006_010"
  },
  {
    "english": "We can't see her again.",
    "japanese": "もう会うことはできない。",
    "voiceKey": "voice_c15_s006_011"
  },
  {
    "english": "But Grandma is always in our hearts.",
    "japanese": "でも、おばあちゃんはいつも、ぼくたちの心の中にいるよ。",
    "voiceKey": "voice_c15_s006_012"
  },
  {
    "english": "I want to see your smile.",
    "japanese": "おじいちゃんの笑顔が見たいんだ。",
    "voiceKey": "voice_c15_s006_013"
  },
  {
    "english": "I love you, Grandpa!",
    "japanese": "大好きだよ、おじいちゃん！",
    "voiceKey": "voice_c15_s006_014"
  },
  {
    "english": "With love,",
    "japanese": "愛をこめて",
    "voiceKey": "voice_c15_s006_015"
  },
  {
    "english": "Your grandson",
    "japanese": "おじいちゃんの孫より",
    "voiceKey": "voice_c15_s006_016"
  }
];
  lines.forEach(function (line, index) {
    AudioDatabase.voice[line.voiceKey] = "audio/voice/s006/letter-" + String(index + 1).padStart(2, "0") + ".mp3";
    Object.freeze(line);
  });
  window.S006EndingData = Object.freeze({
    card: "images/006/S006-Ending-Letter-V5.png",
    lines: Object.freeze(lines)
  });
})();
