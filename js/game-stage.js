(function () {
  "use strict";
  var root = document.getElementById("game");
  if (!root || document.getElementById("game-stage")) return;

  // Shared layout policy. Later numbered stories inherit the same profile.
  // Non-numbered scenes and earlier stories retain the shipped canvas.
  var profiles = {
    legacy: { width: 1280, height: 720 },
    "wide-story": { width: 1560, height: 720 }
  };
  var storyPolicy = { pattern: /^S(\d+)$/, firstNumber: 5, profile: "wide-story" };
  var profile = profiles.legacy;
  var viewport = document.createElement("div");
  viewport.id = "game-stage-viewport";
  var stage = document.createElement("div");
  stage.id = "game-stage";
  root.parentNode.insertBefore(viewport, root);
  viewport.appendChild(stage);
  stage.appendChild(root);

  function fit() {
    var width = viewport.clientWidth;
    var height = viewport.clientHeight;
    if (!(width > 0 && height > 0)) return;
    var scale = Math.min(width / profile.width, height / profile.height);
    stage.style.setProperty("--game-stage-scale", String(scale));
  }
  function selectProfile(story) {
    var match = storyPolicy.pattern.exec(story && story.id || "");
    var name = match && Number(match[1]) >= storyPolicy.firstNumber ? storyPolicy.profile : "legacy";
    profile = profiles[name];
    stage.dataset.stageProfile = name;
    stage.style.setProperty("--game-stage-width", profile.width + "px");
    stage.style.setProperty("--game-stage-height", profile.height + "px");
    fit();
  }
  selectProfile(null);
  // Existing lifecycle event runs before any Story command; no engine hook or polling.
  window.addEventListener("DOMContentLoaded", function () {
    if (window.StoryEvents) {
      StoryEvents.on("story:enter", function (detail) { selectProfile(detail.story); });
    }
  });
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(viewport);
})();
