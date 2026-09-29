(function () {
  "use strict";

  function setStatus(message) {
    var status = document.getElementById("pico-break-demo-status");
    if (status) status.textContent = message;
  }

  function storyId() {
    return window.SceneManager && SceneManager.getCurrentStoryId
      ? (SceneManager.getCurrentStoryId() || "S001")
      : "S001";
  }

  function bind() {
    var nowButton = document.getElementById("pico-break-demo-now");
    var waitButton = document.getElementById("pico-break-demo-wait");
    var story20Button = document.getElementById("pico-break-demo-20");
    if (!nowButton || !waitButton || !story20Button || !window.PicoBreakManager) return;

    nowButton.addEventListener("click", function () {
      setStatus("通常のピコブレークを表示しています。");
      PicoBreakManager.showSelected({ storyId: storyId(), category: "tip", allowRecent: true })
        .then(function () { setStatus("通常表示：正常に終了しました。"); });
    });

    waitButton.addEventListener("click", async function () {
      waitButton.disabled = true;
      setStatus("APIを模擬しています。1.2秒後に表示され、3秒で自動的に閉じます。");
      try {
        await PicoBreakManager.during(
          function () { return new Promise(function (resolve) { setTimeout(resolve, 3000); }); },
          { storyId: storyId(), thresholdMs: 1200 }
        );
        setStatus("API待ち表示：正常に終了しました。");
      } finally {
        waitButton.disabled = false;
      }
    });

    story20Button.addEventListener("click", function () {
      var english = PicoBreakManager.select({ storyId: "S020", category: "english", allowRecent: true });
      if (english) {
        setStatus("第20話確認：失敗。英会話ワンポイントが候補に残っています。");
        return;
      }
      setStatus("第20話確認：合格。英会話ワンポイントは除外されています。");
      PicoBreakManager.showSelected({ storyId: "S020", category: "rumor", allowRecent: true });
    });
  }

  window.addEventListener("DOMContentLoaded", bind);
})();
