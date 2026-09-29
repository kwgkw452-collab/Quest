(function () {
  "use strict";

  var layer = null;
  var currentVideo = null;

  function init(element) {
    layer = element;
  }

  function clear() {
    if (currentVideo) currentVideo.pause();
    currentVideo = null;
    if (layer) {
      layer.innerHTML = "";
      layer.hidden = true;
    }
  }

  function play(keyOrPath, options) {
    options = options || {};
    if (!layer) return Promise.reject(new Error("VideoManager is not initialized."));

    return new Promise(function (resolve) {
      clear();
      layer.hidden = false;

      var video = document.createElement("video");
      video.className = options.className || "story-video";
      video.src = window.AssetManager ? AssetManager.video(keyOrPath) : keyOrPath;
      video.autoplay = options.autoplay !== false;
      video.playsInline = true;
      video.preload = "auto";
      video.controls = options.controls === true;
      video.loop = options.loop === true;
      currentVideo = video;

      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clear();
        resolve();
      }

      video.addEventListener("ended", finish);
      video.addEventListener("error", function () {
        console.warn("Video playback failed:", video.src);
        finish();
      });
      layer.appendChild(video);

      if (options.skippable !== false) {
        var skip = document.createElement("button");
        skip.type = "button";
        skip.className = "control-button video-skip";
        skip.textContent = options.skipLabel || "スキップ";
        skip.addEventListener("click", finish);
        layer.appendChild(skip);
      }

      var promise = video.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(function () {
          if (options.autoplay !== false) console.warn("Video autoplay was blocked.");
        });
      }
    });
  }

  window.VideoManager = {
    init: init,
    play: play,
    clear: clear
  };
})();
