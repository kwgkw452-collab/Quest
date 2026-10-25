(function () {
  "use strict";
  var root = document.getElementById("game");
  if (!root || !window.StoryEvents) return;
  var profile = { firstStoryNumber: 5, width: 1560, height: 720 };
  var viewport = null;
  var stage = null;

  function fit() {
    if (!stage) return;
    var scale = Math.min(viewport.clientWidth / profile.width, viewport.clientHeight / profile.height);
    if (scale > 0) stage.style.setProperty("--game-stage-scale", String(scale));
  }
  function leave() {
    if (!viewport) return;
    viewport.parentNode.insertBefore(root, viewport);
    viewport.remove();
    viewport = null;
    stage = null;
  }
  function enter(story) {
    var match = /^S(\d+)$/.exec(story && story.id || "");
    if (!match || Number(match[1]) < profile.firstStoryNumber) { leave(); return; }
    if (!stage) {
      viewport = document.createElement("div");
      viewport.id = "game-stage-viewport";
      stage = document.createElement("div");
      stage.id = "game-stage";
      stage.dataset.stageProfile = "wide-story";
      root.parentNode.insertBefore(viewport, root);
      viewport.appendChild(stage);
      stage.appendChild(root);
    }
    fit();
  }
  StoryEvents.on("story:enter", function (detail) { enter(detail.story); });
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.documentElement);
})();
