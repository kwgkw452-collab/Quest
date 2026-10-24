(function () {
  "use strict";

  if (window.DevJumpRuntimeTrace && typeof window.DevJumpRuntimeTrace.registerRuntimeComponent === "function") {
    window.DevJumpRuntimeTrace.registerRuntimeComponent(
      "dev-jump-ui.js",
      "eigo-de-quest/dev-jump-ui/runtime-dispatch-trace-v1"
    );
  }

  function button(label, action) {
    var element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.style.cssText = "display:block;width:100%;margin:6px 0;padding:9px;border:1px solid #777;border-radius:6px;background:#fff;color:#222;cursor:pointer";
    element.addEventListener("click", action);
    return element;
  }

  function show() {
    GameCore.cache();
    SaveManager.init();

    var requestedCheckpointId = new URLSearchParams(window.location.search).get("jump");
    var requestedCheckpoint = requestedCheckpointId ? DevCheckpointDatabase.get(requestedCheckpointId) : null;

    var panel = document.createElement("section");
    panel.id = "dev-jump-panel";
    panel.style.cssText = "position:absolute;z-index:10000;top:16px;left:50%;transform:translateX(-50%);width:min(360px,calc(100% - 32px));max-height:calc(100% - 32px);overflow:auto;padding:16px;background:rgba(20,20,24,.96);color:#fff;border:1px solid #888;border-radius:8px;font-family:sans-serif";

    var title = document.createElement("h1");
    title.textContent = "DEV JUMP";
    title.style.cssText = "font-size:20px;margin:0 0 12px";
    panel.appendChild(title);

    panel.appendChild(button("Normal Start", function () {
      window.location.replace("index.html");
    }));

    async function startCheckpoint(checkpoint, source) {
        var traceOperationId = window.DevJumpRuntimeTrace &&
          typeof window.DevJumpRuntimeTrace.beginOperation === "function" ?
          window.DevJumpRuntimeTrace.beginOperation(checkpoint.id, source) : null;
        panel.querySelectorAll("button").forEach(function (item) { item.disabled = true; });
        panel.hidden = true;
        try {
          await DevJumpManager.start(checkpoint.id, traceOperationId);
        } catch (error) {
          panel.hidden = false;
          panel.querySelectorAll("button").forEach(function (item) { item.disabled = false; });
          DialogManager.show("DEV", error && error.message ? error.message : String(error));
        }
    }

    DevCheckpointDatabase.list().forEach(function (checkpoint) {
      panel.appendChild(button(checkpoint.label, function () {
        return startCheckpoint(checkpoint, "dev-jump-ui-click");
      }));
    });

    document.getElementById("scene").appendChild(panel);
    if (requestedCheckpoint) startCheckpoint(requestedCheckpoint, "dev-jump-query");
  }

  window.addEventListener("DOMContentLoaded", show);
})();
