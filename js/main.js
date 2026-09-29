(function () {
  "use strict";

  async function start() {
    GameCore.cache();
    SaveManager.init();

    // 現行版は常にS001から新規再生するため、以前の周回の同行状態を持ち越さない。
    SaveManager.getCompanionIds().forEach(function (characterId) {
      SaveManager.removeCompanion(characterId);
    });

    var initialState = { playerName: SaveManager.getData().player.name || "" };
    if (GameConfig.openingEnabled) {
      initialState.playerName = await Opening.start();
    }

    AudioManager.stopBgm();
    await SceneManager.start(GameConfig.initialStoryId, initialState);
  }

  window.addEventListener("DOMContentLoaded", function () {
    start().catch(function (error) {
      console.error(error);
      GameCore.cache();
      GameCore.showDialogue(
        "ピコ",
        "ここまで進めたことがすごいよ！\n\nエラー内容：" + error.message
      );
    });
  });
})();
