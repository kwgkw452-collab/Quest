(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "S002",
    title: "過去からのSOSと本当の声",
    nextStoryId: "S003",
    steps: [
      C.morning("MORNING_001", "s002Morning"),
      C.clear(),
      C.travelTransition("s002FutureCityOverview"),
      C.bgm("futureCityPixel", { loop: true, volume: 0.30, fadeToVolume: 0.15, fadeToMs: 3000 }),
      C.wait(3000),
      C.dialogue("", "この都市では、人々は声を出さず、インカムだけでコミュニケーションをとっている。", {
        button: "Next"
      }),
      C.dialogue("ピコ", "Wow! Look at those buildings!", {
        voiceKey: "voice_c01_s002_001",
        button: "Next",
        supportText: "わあ！あの建物を見てピコ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "What a big city!", {
        voiceKey: "voice_c02_s002_001",
        button: "Next",
        supportText: "なんて大きな街なんだ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "Everyone is wearing a headset.", {
        voiceKey: "voice_c01_s002_002",
        button: "Next",
        supportText: "みんなインカムを着けているピコ。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("コング", "People are not talking.", {
        voiceKey: "voice_c02_s002_002",
        button: "Next",
        supportText: "みんな話していないぞ。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "They talk by using their headsets.", {
        voiceKey: "voice_c01_s002_003",
        button: "Next",
        supportText: "この街の人たちは、インカムを使って話しているピコ。",
        supportSpeaker: "ピコ"
      }),

      C.clear(),
      C.background("s002FutureCitySos"),
      C.characters([
        { id: "saki", character: "saki", pose: "sad", className: "pos-center-low size-medium" }
      ]),
      C.dialogue("サキ", "Help me... Can you hear me?", {
        voiceKey: "voice_c03_s002_001",
        button: "Next",
        supportText: "助けて……私の声が聞こえる？",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "Master! She needs help.", {
        voiceKey: "voice_c01_s002_004", button: false,
        supportText: "マスター！彼女を助けるピコ！" }),
      C.wait(3500),
      C.dialogue("ピコ", "「It's OK.（大丈夫！）」と言ってみよう。", {
        button: "話す"
      }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.its_ok", "calmSaki"),
      C.bgm("futureCityPixel", { loop: true, volume: 0.15, fadeInMs: 600 }),
      C.characterImage("saki", "normal"),
      C.dialogue("サキ", "You can hear me?", {
        voiceKey: "voice_c03_s002_002",
        button: "Next",
        supportText: "私の声が聞こえるの？",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "「はい」または「はい、聞こえます」と英語で言ってみよう。", {
        button: "話す"
      }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.yes_can_hear_you", "answerSaki", {
        supportMessages: [
          "『はい』は英語で何と言うかな？短い一言で大丈夫ピコ！",
          "最初の音は『イ』だよ。ゆっくり英語で答えてみよう！",
          "『Yes.』と言ってください。"
        ]
      }),

      C.clear(),
      C.background("s002FutureCityActive"),
      C.characters([
        { id: "saki", character: "saki", pose: "smile", className: "pos-center-low size-medium" }
      ]),
      C.effect("flash"),
      C.dialogue("サキ", "I did it! I can talk!", {
        voiceKey: "voice_c03_s002_003",
        button: "Next",
        supportText: "できた！私、話せる！",
        supportSpeaker: "ピコ"
      }),
      C.hideDialogue(),
      C.se("zephyrSuccess", { volume: 0.27 }),
      C.wait(3000),
      C.dialogue("ピコ", "Yes! That is your real voice!", {
        voiceKey: "voice_c01_s002_005",
        button: "Next",
        supportText: "そう！それがサキの本当の声だピコ！",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("サキ", "I don't use my voice here.", {
        voiceKey: "voice_c03_s002_004",
        button: "Next",
        supportText: "この街では、自分の声を使わないの。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("サキ", "But I like my voice.", {
        voiceKey: "voice_c03_s002_005",
        button: "Next",
        supportText: "でも、私は自分の声が好き。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("サキ", "I want to see other cities.", {
        voiceKey: "voice_c03_s002_006",
        button: "Next",
        supportText: "ほかの街を見てみたい。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("サキ", "I want to use my voice more and make many friends.", {
        voiceKey: "voice_c03_s002_007",
        button: "Next",
        supportText: "もっと自分の声を使って、たくさん友達を作りたい。",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("サキ", "Can I go with you?", {
        voiceKey: "voice_c03_s002_008",
        button: "Next",
        supportText: "あなたたちと一緒に行ってもいい？",
        supportSpeaker: "ピコ"
      }),
      C.dialogue("ピコ", "Master, answer her!", {
        voiceKey: "voice_c01_s002_006", button: false,
        supportText: "マスター、彼女に答えるピコ！" }),
      C.wait(3500),
      C.dialogue("ピコ", "「Come with me.（俺たちと一緒に行こう）」と言ってみよう。", {
        button: "話す"
      }),
      C.stopBgm({ fadeOutMs: 500 }),
      C.question("phrase.come_with_me", "inviteSaki"),
      C.characters([
        { id: "saki", character: "saki", pose: "sideWalk", className: "pos-center-low size-medium" }
      ]),
      C.dialogue("サキ", "Thank you! Let's go!", {
        voiceKey: "voice_c03_s002_009",
        button: "Finish",
        supportText: "ありがとう！行こう！",
        supportSpeaker: "ピコ"
      }),
      C.addCompanion(3),
      C.stopBgm(),
      C.camp("CAMP_S002", "s002Camp")
    ]
  };

  StoryRegistry.register(story);
  window.S002 = story;
})();
