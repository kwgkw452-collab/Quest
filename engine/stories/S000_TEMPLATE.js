(function () {
  "use strict";

  var C = StoryCommands;

  var story = {
    id: "S000",
    title: "テンプレート",
    steps: [
      C.clear(),
      C.background("images/backgrounds/example.png"),
      C.dialogue("ピコ", "ここに台詞を書きます。")
    ]
  };

  // 必要な場合だけ story.onEnter / onComplete / onExit を追加する。
  // 実際に使うときはidを重複しない番号へ変更して登録する。
  // StoryRegistry.register(story);
  window.S000_TEMPLATE = story;
})();
