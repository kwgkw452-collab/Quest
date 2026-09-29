(function () {
  "use strict";

  window.PicoBreakData = [
    {
      id: "PB-RUMOR-001",
      category: "rumor",
      title: "ピコのうわさ話",
      text: "森の奥では、夜になると誰も触っていない鐘が鳴るらしいピコ……。",
      minStory: 1,
      maxStory: 30,
      weight: 3,
      once: true
    },
    {
      id: "PB-FORESHADOW-001",
      category: "foreshadow",
      title: "ピコのひとりごと",
      text: "あの紋章……どこかで見た気がする。でも、今はまだ思い出せないピコ。",
      minStory: 3,
      weight: 2,
      once: true
    },
    {
      id: "PB-TIP-001",
      category: "tip",
      title: "ピコの冒険メモ",
      text: "困ったときは、さっき聞いた言葉を思い出してみるピコ！",
      minStory: 1,
      weight: 2,
      once: false
    },
    {
      id: "PB-ENGLISH-001",
      category: "english",
      title: "英会話ワンポイント",
      text: "“Are you okay?” は、相手を心配するときに使えるピコ！",
      minStory: 1,
      excludeStories: [20],
      weight: 2,
      once: false
    },
    {
      id: "PB-WAIT-001",
      category: "wait",
      title: "ピコブレーク",
      text: "ただいま準備中ピコ。少しだけ、深呼吸して待っていてね！",
      minStory: 1,
      weight: 1,
      once: false
    }
  ];
})();
